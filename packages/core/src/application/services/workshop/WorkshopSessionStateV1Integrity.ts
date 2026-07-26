/**
 * Semantic and referential invariants for structurally valid V1 Workshop state.
 */

import { WorkshopPersonaId, WorkshopToolId } from '@messages';
import { isWorkshopPersonaId } from '@shared/constants/workshopPersonas';
import { isWorkshopToolId } from '@shared/constants/workshopTools';
import {
  isWorkshopTurnAlreadyVisibleToPrincipal,
  isWorkshopPublishableCapabilityEvidence
} from '@/application/services/workshop/WorkshopRoomAudience';
import type {
  WorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';

export interface WorkshopSessionStateV1ValidationOptions {
  /**
   * The pre-lock product could persist `scope: open` with a pinned excerpt.
   * Only raw-checkpoint preflight may tolerate it; hydration normalizes the
   * state and validates again under the current invariant.
   */
  allowLegacyOpenSessionWithExcerpt?: boolean;
}

export function validateWorkshopSessionStateV1(
  state: WorkshopSessionStateV1,
  options: WorkshopSessionStateV1ValidationOptions = {}
): void {
  const requireCounter = (value: number, label: string): void => {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Persisted Workshop ${label} must be a non-negative safe integer`);
    }
  };
  requireCounter(state.revisions.excerpt, 'excerpt revision');
  requireCounter(state.revisions.replacementCount, 'replacement count');
  requireCounter(state.revisions.context, 'context revision');
  requireCounter(state.counters.attachment, 'attachment counter');
  requireCounter(state.counters.threadArtifact, 'thread-artifact counter');
  requireCounter(state.counters.turn, 'turn counter');
  requireCounter(state.counters.todo, 'todo counter');

  // Sprint 13A: the revision counter belongs to the passage, and a SHELVED
  // passage still owns it — shelving is not a deletion, so the version stands
  // and a later re-pin restores that exact version. Exactly one of the two
  // slots may hold it.
  if (state.excerpt && state.shelvedExcerpt) {
    throw new Error('Persisted Workshop state has both a pinned and a shelved excerpt');
  }
  if (
    state.scope === 'open'
    && state.excerpt !== undefined
    && options.allowLegacyOpenSessionWithExcerpt !== true
  ) {
    throw new Error('Persisted Workshop open session cannot hold a pinned excerpt');
  }
  const versionedExcerpt = state.excerpt ?? state.shelvedExcerpt;
  if (versionedExcerpt) {
    if (versionedExcerpt.version !== state.revisions.excerpt) {
      throw new Error('Persisted Workshop excerpt version does not match its revision counter');
    }
  } else if (state.revisions.excerpt !== 0) {
    throw new Error('Persisted Workshop state has an excerpt revision without an excerpt');
  }
  if (
    state.revisions.pendingExcerpt !== undefined
    && state.revisions.pendingExcerpt !== state.revisions.excerpt
  ) {
    throw new Error('Persisted Workshop pending excerpt revision is not current');
  }
  // `pendingExcerptWithdrawal` and `pendingExcerptChange` are deliberately NOT
  // validated. ADR 2026-07-25 retired both; they survive in the grammar only
  // so pre-lock checkpoints parse, and they are discarded on hydrate. Asserting
  // consistency between fields we are about to throw away would fail a
  // writer's real session open over state that no longer means anything.
  if (
    state.revisions.pendingContext !== undefined
    && (
      !Number.isSafeInteger(state.revisions.pendingContext)
      || state.revisions.pendingContext < 1
      || state.revisions.pendingContext > state.revisions.context
    )
  ) {
    throw new Error('Persisted Workshop pending context revision is invalid');
  }

  const attachmentIds = new Set<string>();
  let greatestAttachmentNumber = 0;
  for (const attachment of state.contextAttachments) {
    if (attachmentIds.has(attachment.id)) {
      throw new Error(`Duplicate persisted Workshop context attachment ${attachment.id}`);
    }
    attachmentIds.add(attachment.id);
    greatestAttachmentNumber = Math.max(
      greatestAttachmentNumber,
      numericIdSuffix(attachment.id, /^ctx-(\d+)$/, 'context attachment')
    );
  }
  if (greatestAttachmentNumber > state.counters.attachment) {
    throw new Error('Persisted Workshop attachment counter trails an existing id');
  }

  const turnIds = new Set<string>();
  let greatestTurnNumber = 0;
  let greatestThreadArtifactNumber = 0;
  for (const turn of state.turns) {
    if (turnIds.has(turn.id)) {
      throw new Error(`Duplicate persisted Workshop turn ${turn.id}`);
    }
    turnIds.add(turn.id);
    greatestTurnNumber = Math.max(
      greatestTurnNumber,
      numericIdSuffix(
        turn.id,
        /^turn-(\d+)-(?:user|assistant|system)-\d+$/,
        'turn'
      )
    );
    for (const attachment of turn.messageAttachments ?? []) {
      greatestThreadArtifactNumber = Math.max(
        greatestThreadArtifactNumber,
        numericIdSuffix(attachment.id, /^ta-(\d+)$/, 'thread artifact')
      );
    }
  }
  if (greatestTurnNumber > state.counters.turn) {
    throw new Error('Persisted Workshop turn counter trails an existing id');
  }

  const turnIndexes = new Map(state.turns.map((turn, index) => [turn.id, index]));
  for (const [index, turn] of state.turns.entries()) {
    const publicationTurnId = turn.capability?.publishedWithTurnId;
    if (publicationTurnId === undefined) {
      continue;
    }
    const principal = turn.capability?.invokedBy;
    const responseIndex = turnIndexes.get(publicationTurnId);
    const response = responseIndex === undefined ? undefined : state.turns[responseIndex];
    if (
      !turn.capability
      || !principal
      || !isWorkshopPublishableCapabilityEvidence(turn.capability)
      || responseIndex === undefined
      || responseIndex <= index
      || response?.role !== 'assistant'
      || (response.artifact !== 'persona_message' && response.artifact !== 'persona_synthesis')
      || !isWorkshopTurnAlreadyVisibleToPrincipal(response, principal)
    ) {
      throw new Error(
        `Persisted Workshop capability ${turn.id} has an invalid publication response`
      );
    }
  }

  const pendingMessageIds = new Set<string>();
  for (const attachment of state.pendingMessageAttachments) {
    if (pendingMessageIds.has(attachment.id)) {
      throw new Error(`Duplicate persisted Workshop pending message attachment ${attachment.id}`);
    }
    pendingMessageIds.add(attachment.id);
    greatestThreadArtifactNumber = Math.max(
      greatestThreadArtifactNumber,
      numericIdSuffix(attachment.id, /^ta-(\d+)$/, 'thread artifact')
    );
  }
  if (greatestThreadArtifactNumber > state.counters.threadArtifact) {
    throw new Error('Persisted Workshop thread-artifact counter trails an existing id');
  }

  const todoIds = new Set<string>();
  let greatestTodoNumber = 0;
  for (const todo of state.todos) {
    if (todoIds.has(todo.id)) {
      throw new Error(`Duplicate persisted Workshop task ${todo.id}`);
    }
    todoIds.add(todo.id);
    greatestTodoNumber = Math.max(
      greatestTodoNumber,
      numericIdSuffix(todo.id, /^todo-(\d+)-\d+$/, 'task')
    );
    if (!turnIds.has(todo.source.turnId)) {
      throw new Error(`Persisted Workshop task ${todo.id} references an unknown turn`);
    }
  }
  if (greatestTodoNumber > state.counters.todo) {
    throw new Error('Persisted Workshop task counter trails an existing id');
  }

  if (!isWorkshopPersonaId(state.participants.host.personaId)) {
    throw new Error('Persisted Workshop host persona is invalid');
  }
  if (
    state.participants.host.conversationKey !== undefined
    && state.participants.host.conversationKey !== 'host'
  ) {
    throw new Error('Persisted Workshop host conversation key is invalid');
  }
  if (
    state.participants.host.lastSeenRoomTurnId !== undefined
    && !turnIds.has(state.participants.host.lastSeenRoomTurnId)
  ) {
    throw new Error('Persisted Workshop host has an invalid room offset');
  }

  const toolIds = new Set<WorkshopToolId>();
  for (const sidecar of state.participants.toolSidecars) {
    if (!isWorkshopToolId(sidecar.toolId) || toolIds.has(sidecar.toolId)) {
      throw new Error(`Duplicate or invalid persisted Workshop tool sidecar ${String(sidecar.toolId)}`);
    }
    toolIds.add(sidecar.toolId);
    if (sidecar.conversationKey !== `tool:${sidecar.toolId}`) {
      throw new Error(`Persisted Workshop tool ${sidecar.toolId} has the wrong conversation key`);
    }
    const report = state.turns.find((turn) => turn.id === sidecar.latestReportTurnId);
    if (
      !report
      || report.artifact !== 'tool_report'
      || report.toolId !== sidecar.toolId
    ) {
      throw new Error(`Persisted Workshop tool ${sidecar.toolId} has an invalid latest report`);
    }
    // The legacy delivery cursor is intentionally ignored. Hydration strips
    // it, and sidecars are no longer readers in the shared room protocol.
  }

  const guestIds = new Set<WorkshopPersonaId>();
  for (const guest of state.participants.personaGuests) {
    if (!isWorkshopPersonaId(guest.personaId) || guestIds.has(guest.personaId)) {
      throw new Error(`Duplicate or invalid persisted Workshop guest ${String(guest.personaId)}`);
    }
    guestIds.add(guest.personaId);
    const expectedKey = `guest:${guest.personaId}`;
    if (guest.conversationKey !== undefined && guest.conversationKey !== expectedKey) {
      throw new Error(`Persisted Workshop guest ${guest.personaId} has the wrong conversation key`);
    }
    if (guest.liveness === 'live' && guest.conversationKey === undefined) {
      throw new Error(`Persisted live Workshop guest ${guest.personaId} has no conversation key`);
    }
    if (
      guest.lastSeenRoomTurnId !== undefined
      && !turnIds.has(guest.lastSeenRoomTurnId)
    ) {
      throw new Error(`Persisted Workshop guest ${guest.personaId} has an invalid room offset`);
    }
    // Both legacy guest cursors are known-but-ignored compatibility fields.
  }

  const writerSourceGuests = new Set<WorkshopPersonaId>();
  for (const guest of state.writerSources.guests) {
    if (!isWorkshopPersonaId(guest.personaId) || writerSourceGuests.has(guest.personaId)) {
      throw new Error(`Duplicate or invalid persisted Workshop guest manifest ${String(guest.personaId)}`);
    }
    writerSourceGuests.add(guest.personaId);
  }
  for (const rawToolId of Object.keys(state.writerSources.tools)) {
    if (!isWorkshopToolId(rawToolId)) {
      throw new Error(`Invalid persisted Workshop tool manifest ${rawToolId}`);
    }
  }

  const target = state.participants.chatTarget;
  if (target.kind === 'tool' && !toolIds.has(target.toolId)) {
    throw new Error('Persisted Workshop chat target references an unknown tool sidecar');
  }
  if (
    target.kind === 'personaGuest'
    && !state.participants.personaGuests.some(
      (guest) => guest.personaId === target.personaId && guest.liveness === 'live'
    )
  ) {
    throw new Error('Persisted Workshop chat target references a non-live guest');
  }
}

function numericIdSuffix(id: string, pattern: RegExp, label: string): number {
  const match = pattern.exec(id);
  const value = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Persisted Workshop ${label} id is invalid: ${id}`);
  }
  return value;
}
