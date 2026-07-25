/**
 * Exact structural grammar for WorkshopSessionStateV1.
 *
 * This module answers only "does this raw value have the frozen V1 shape?".
 * Cross-reference and counter invariants live in the sibling integrity module.
 */

import {
  isWorkshopInteractionMode,
  isWorkshopPersonaExpressionLevel,
  isWorkshopRelationalDepth,
  isWorkshopSessionScope
} from '@messages';
import { isContextPathGroup } from '@shared/types';
import {
  isWorkshopPersonaId,
  WORKSHOP_GUEST_CAPACITY
} from '@shared/constants/workshopPersonas';
import { isWorkshopToolId } from '@shared/constants/workshopTools';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  WORKSHOP_TODO_BOUNDS
} from '@/application/services/workshop/WorkshopSessionLimits';
import type {
  WorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';

export function assertWorkshopSessionStateShape(
  value: unknown
): asserts value is WorkshopSessionStateV1 {
  const state = exactObject(
    value,
    'Workshop session state',
    [
      'contextAttachments',
      'pendingMessageAttachments',
      'revisions',
      'counters',
      'writerSources',
      'turns',
      'participants',
      'todos'
    ],
    [
      'excerpt',
      'scope',
      'shelvedExcerpt',
      'selectedToolId',
      'lastCommittedPersonaBehavior'
    ]
  );
  if (state.excerpt !== undefined) {
    assertExcerpt(state.excerpt, 'Workshop session state.excerpt');
  }
  if (state.scope !== undefined && !isWorkshopSessionScope(state.scope)) {
    shapeError('Workshop session state.scope', 'excerpt, open, or null');
  }
  if (state.shelvedExcerpt !== undefined) {
    assertExcerpt(state.shelvedExcerpt, 'Workshop session state.shelvedExcerpt');
  }
  arrayOf(state.contextAttachments, 'Workshop session state.contextAttachments', assertContextAttachment);
  arrayOf(
    state.pendingMessageAttachments,
    'Workshop session state.pendingMessageAttachments',
    assertMessageAttachment
  );
  assertRevisions(state.revisions);
  assertCounters(state.counters);
  assertWriterSources(state.writerSources);
  arrayOf(state.turns, 'Workshop session state.turns', assertTurn);
  assertParticipants(state.participants);
  if (state.selectedToolId !== undefined && !isWorkshopToolId(state.selectedToolId)) {
    shapeError('Workshop session state.selectedToolId', 'known Workshop tool id');
  }
  arrayOf(state.todos, 'Workshop session state.todos', assertStoredTodo);
  if (state.lastCommittedPersonaBehavior !== undefined) {
    assertLastCommittedBehavior(
      state.lastCommittedPersonaBehavior,
      'Workshop session state.lastCommittedPersonaBehavior'
    );
  }
}

function assertExcerpt(value: unknown, path: string): void {
  const excerpt = exactObject(
    value,
    path,
    ['text', 'version', 'source', 'pinnedAt'],
    ['truncation', 'sourceFingerprint']
  );
  stringAt(excerpt.text, `${path}.text`);
  numberAt(excerpt.version, `${path}.version`);
  assertExcerptSource(excerpt.source, `${path}.source`);
  numberAt(excerpt.pinnedAt, `${path}.pinnedAt`);
  if (excerpt.truncation !== undefined) {
    const truncation = exactObject(
      excerpt.truncation,
      `${path}.truncation`,
      ['pinnedWords', 'totalWords']
    );
    numberAt(truncation.pinnedWords, `${path}.truncation.pinnedWords`);
    numberAt(truncation.totalWords, `${path}.truncation.totalWords`);
  }
  optionalStringAt(excerpt.sourceFingerprint, `${path}.sourceFingerprint`);
}

function assertExcerptSource(value: unknown, path: string): void {
  const source = objectAt(value, path);
  if (source.kind === 'manual') {
    exactKeys(source, path, ['kind']);
    return;
  }
  if (source.kind === 'file') {
    exactKeys(source, path, ['kind', 'sourceUri', 'relativePath'], ['configuredResource']);
    stringAt(source.sourceUri, `${path}.sourceUri`);
    stringAt(source.relativePath, `${path}.relativePath`);
    assertOptionalConfiguredResource(source.configuredResource, `${path}.configuredResource`);
    return;
  }
  if (source.kind === 'editor-selection') {
    exactKeys(
      source,
      path,
      ['kind', 'sourceUri', 'relativePath'],
      ['startLine', 'endLine', 'configuredResource']
    );
    stringAt(source.sourceUri, `${path}.sourceUri`);
    stringAt(source.relativePath, `${path}.relativePath`);
    optionalNumberAt(source.startLine, `${path}.startLine`);
    optionalNumberAt(source.endLine, `${path}.endLine`);
    assertOptionalConfiguredResource(source.configuredResource, `${path}.configuredResource`);
    return;
  }
  shapeError(`${path}.kind`, 'manual, file, or editor-selection');
}

function assertContextAttachment(value: unknown, path: string): void {
  const attachment = exactObject(
    value,
    path,
    ['id', 'kind', 'origin', 'label', 'words', 'content', 'addedAt'],
    ['relativePath', 'configuredResource', 'truncation', 'sourceUri']
  );
  stringAt(attachment.id, `${path}.id`);
  enumAt(attachment.kind, `${path}.kind`, ['text', 'file']);
  enumAt(attachment.origin, `${path}.origin`, ['writer', 'wizard']);
  stringAt(attachment.label, `${path}.label`);
  numberAt(attachment.words, `${path}.words`);
  stringAt(attachment.content, `${path}.content`);
  numberAt(attachment.addedAt, `${path}.addedAt`);
  optionalStringAt(attachment.relativePath, `${path}.relativePath`);
  optionalStringAt(attachment.sourceUri, `${path}.sourceUri`);
  assertOptionalConfiguredResource(attachment.configuredResource, `${path}.configuredResource`);
  if (attachment.truncation !== undefined) {
    assertKeptWordTruncation(attachment.truncation, `${path}.truncation`);
  }
}

function assertMessageAttachment(value: unknown, path: string): void {
  const attachment = exactObject(
    value,
    path,
    ['id', 'label', 'words', 'content'],
    ['relativePath', 'configuredResource', 'truncation', 'sourceUri']
  );
  stringAt(attachment.id, `${path}.id`);
  stringAt(attachment.label, `${path}.label`);
  numberAt(attachment.words, `${path}.words`);
  stringAt(attachment.content, `${path}.content`);
  optionalStringAt(attachment.relativePath, `${path}.relativePath`);
  optionalStringAt(attachment.sourceUri, `${path}.sourceUri`);
  assertOptionalConfiguredResource(attachment.configuredResource, `${path}.configuredResource`);
  if (attachment.truncation !== undefined) {
    assertKeptWordTruncation(attachment.truncation, `${path}.truncation`);
  }
}

function assertKeptWordTruncation(value: unknown, path: string): void {
  const truncation = exactObject(value, path, ['keptWords', 'totalWords']);
  numberAt(truncation.keptWords, `${path}.keptWords`);
  numberAt(truncation.totalWords, `${path}.totalWords`);
}

function assertOptionalConfiguredResource(value: unknown, path: string): void {
  if (value === undefined) {
    return;
  }
  const resource = exactObject(value, path, ['group', 'path']);
  if (typeof resource.group !== 'string' || !isContextPathGroup(resource.group)) {
    shapeError(`${path}.group`, 'known context resource group');
  }
  stringAt(resource.path, `${path}.path`);
}

function assertRevisions(value: unknown): void {
  const revisions = exactObject(
    value,
    'Workshop session state.revisions',
    ['excerpt', 'replacementCount', 'context'],
    [
      'pendingExcerpt',
      'pendingExcerptChange',
      'pendingExcerptWithdrawal',
      'pendingContext'
    ]
  );
  numberAt(revisions.excerpt, 'Workshop session state.revisions.excerpt');
  numberAt(revisions.replacementCount, 'Workshop session state.revisions.replacementCount');
  numberAt(revisions.context, 'Workshop session state.revisions.context');
  optionalNumberAt(revisions.pendingExcerpt, 'Workshop session state.revisions.pendingExcerpt');
  if (revisions.pendingExcerptChange !== undefined) {
    enumAt(
      revisions.pendingExcerptChange,
      'Workshop session state.revisions.pendingExcerptChange',
      ['revised', 'added', 'repinned']
    );
  }
  if (
    revisions.pendingExcerptWithdrawal !== undefined &&
    revisions.pendingExcerptWithdrawal !== true
  ) {
    shapeError('Workshop session state.revisions.pendingExcerptWithdrawal', 'true when present');
  }
  optionalNumberAt(revisions.pendingContext, 'Workshop session state.revisions.pendingContext');
}

function assertCounters(value: unknown): void {
  const counters = exactObject(
    value,
    'Workshop session state.counters',
    ['attachment', 'threadArtifact', 'turn', 'todo']
  );
  numberAt(counters.attachment, 'Workshop session state.counters.attachment');
  numberAt(counters.threadArtifact, 'Workshop session state.counters.threadArtifact');
  numberAt(counters.turn, 'Workshop session state.counters.turn');
  numberAt(counters.todo, 'Workshop session state.counters.todo');
}

function assertWriterSources(value: unknown): void {
  const sources = exactObject(
    value,
    'Workshop session state.writerSources',
    ['host', 'tools', 'guests']
  );
  arrayOf(sources.host, 'Workshop session state.writerSources.host', assertContextSource);
  const tools = objectAt(sources.tools, 'Workshop session state.writerSources.tools');
  for (const [toolId, entries] of Object.entries(tools)) {
    if (!isWorkshopToolId(toolId)) {
      shapeError(`Workshop session state.writerSources.tools.${toolId}`, 'known Workshop tool id');
    }
    arrayOf(
      entries,
      `Workshop session state.writerSources.tools.${toolId}`,
      assertContextSource
    );
  }
  arrayOf(
    sources.guests,
    'Workshop session state.writerSources.guests',
    (guestValue, guestPath) => {
      const guest = exactObject(guestValue, guestPath, ['personaId', 'sources']);
      if (!isWorkshopPersonaId(guest.personaId)) {
        shapeError(`${guestPath}.personaId`, 'known Workshop persona id');
      }
      arrayOf(guest.sources, `${guestPath}.sources`, assertContextSource);
    }
  );
}

function assertContextSource(value: unknown, path: string): void {
  const source = exactObject(
    value,
    path,
    ['kind', 'origin', 'label', 'sizeChars', 'isEstimate', 'deliveredAt'],
    [
      'configuredResource',
      'promptTokensDelta',
      'excerptVersion',
      'stale',
      'artifactId'
    ]
  );
  enumAt(
    source.kind,
    `${path}.kind`,
    ['pin', 'attachment', 'message-attachment', 'resource', 'tool-evidence', 'dictionary']
  );
  enumAt(source.origin, `${path}.origin`, ['writer', 'host', 'tool']);
  stringAt(source.label, `${path}.label`);
  numberAt(source.sizeChars, `${path}.sizeChars`);
  booleanAt(source.isEstimate, `${path}.isEstimate`);
  numberAt(source.deliveredAt, `${path}.deliveredAt`);
  assertOptionalConfiguredResource(source.configuredResource, `${path}.configuredResource`);
  optionalNumberAt(source.promptTokensDelta, `${path}.promptTokensDelta`);
  optionalNumberAt(source.excerptVersion, `${path}.excerptVersion`);
  optionalBooleanAt(source.stale, `${path}.stale`);
  optionalStringAt(source.artifactId, `${path}.artifactId`);
}

function assertTurn(value: unknown, path: string): void {
  const turn = exactObject(
    value,
    path,
    ['id', 'role', 'kind', 'participant', 'artifact', 'excerptVersion', 'content', 'timestamp'],
    [
      'toolId',
      'toolLabel',
      'personaId',
      'personaLabel',
      'reportTurnId',
      'capability',
      'actionableFindings',
      'messageAttachments',
      'usage',
      'truncated',
      'behavior',
      'behaviorTransition'
    ]
  );
  stringAt(turn.id, `${path}.id`);
  enumAt(turn.role, `${path}.role`, ['user', 'assistant', 'system']);
  enumAt(turn.kind, `${path}.kind`, ['tool_run', 'message', 'divider']);
  enumAt(turn.participant, `${path}.participant`, ['writer', 'host', 'guest', 'tool', 'session']);
  enumAt(
    turn.artifact,
    `${path}.artifact`,
    [
      'tool_request',
      'persona_message',
      'tool_report',
      'persona_synthesis',
      'direct_tool_message',
      'direct_tool_response',
      'dictionary_lookup',
      'dictionary_full_entry',
      'resource_catalog',
      'resource_search',
      'resource_read',
      'excerpt_revision',
      'context_change',
      'session_start',
      'session_resume',
      'scope_change'
    ]
  );
  numberAt(turn.excerptVersion, `${path}.excerptVersion`);
  stringAt(turn.content, `${path}.content`);
  numberAt(turn.timestamp, `${path}.timestamp`);
  if (turn.toolId !== undefined && !isWorkshopToolId(turn.toolId)) {
    shapeError(`${path}.toolId`, 'known Workshop tool id');
  }
  optionalStringAt(turn.toolLabel, `${path}.toolLabel`);
  if (turn.personaId !== undefined && !isWorkshopPersonaId(turn.personaId)) {
    shapeError(`${path}.personaId`, 'known Workshop persona id');
  }
  optionalStringAt(turn.personaLabel, `${path}.personaLabel`);
  optionalStringAt(turn.reportTurnId, `${path}.reportTurnId`);
  if (turn.capability !== undefined) {
    assertCapability(turn.capability, `${path}.capability`);
  }
  if (turn.actionableFindings !== undefined) {
    arrayOf(turn.actionableFindings, `${path}.actionableFindings`, assertFinding);
  }
  if (turn.messageAttachments !== undefined) {
    arrayOf(
      turn.messageAttachments,
      `${path}.messageAttachments`,
      assertMessageAttachmentSnapshot
    );
  }
  if (turn.usage !== undefined) {
    assertTokenUsage(turn.usage, `${path}.usage`);
  }
  optionalBooleanAt(turn.truncated, `${path}.truncated`);
  if (turn.behavior !== undefined) {
    assertBehavior(turn.behavior, `${path}.behavior`);
  }
  if (turn.behaviorTransition !== undefined) {
    assertBehaviorTransition(turn.behaviorTransition, `${path}.behaviorTransition`);
  }
}

function assertCapability(value: unknown, path: string): void {
  const capability = exactObject(
    value,
    path,
    ['operation', 'status', 'requestSummary', 'requestedByPersonaId'],
    ['metadata']
  );
  enumAt(
    capability.operation,
    `${path}.operation`,
    [
      'dictionary.lookup',
      'dictionary.full-entry',
      'analysis.run',
      'resource.catalog',
      'resource.search',
      'resource.read'
    ]
  );
  enumAt(
    capability.status,
    `${path}.status`,
    ['success', 'partial', 'failed', 'cancelled', 'rejected']
  );
  stringAt(capability.requestSummary, `${path}.requestSummary`);
  if (!isWorkshopPersonaId(capability.requestedByPersonaId)) {
    shapeError(`${path}.requestedByPersonaId`, 'known Workshop persona id');
  }
  if (capability.metadata !== undefined) {
    jsonObjectAt(capability.metadata, `${path}.metadata`);
  }
}

function assertFinding(value: unknown, path: string): void {
  const finding = exactObject(value, path, ['key', 'text', 'ordinal'], ['priority']);
  stringAt(finding.key, `${path}.key`);
  stringAt(finding.text, `${path}.text`);
  numberAt(finding.ordinal, `${path}.ordinal`);
  if (finding.priority !== undefined) {
    enumAt(finding.priority, `${path}.priority`, ['high', 'medium', 'low']);
  }
}

function assertMessageAttachmentSnapshot(value: unknown, path: string): void {
  const attachment = exactObject(
    value,
    path,
    ['id', 'label', 'words'],
    ['relativePath', 'configuredResource', 'truncation']
  );
  stringAt(attachment.id, `${path}.id`);
  stringAt(attachment.label, `${path}.label`);
  numberAt(attachment.words, `${path}.words`);
  optionalStringAt(attachment.relativePath, `${path}.relativePath`);
  assertOptionalConfiguredResource(attachment.configuredResource, `${path}.configuredResource`);
  if (attachment.truncation !== undefined) {
    assertKeptWordTruncation(attachment.truncation, `${path}.truncation`);
  }
}

function assertTokenUsage(value: unknown, path: string): void {
  const usage = exactObject(
    value,
    path,
    ['promptTokens', 'completionTokens', 'totalTokens'],
    ['requestCount', 'costUsd', 'isEstimate']
  );
  numberAt(usage.promptTokens, `${path}.promptTokens`);
  numberAt(usage.completionTokens, `${path}.completionTokens`);
  numberAt(usage.totalTokens, `${path}.totalTokens`);
  optionalNumberAt(usage.requestCount, `${path}.requestCount`);
  optionalNumberAt(usage.costUsd, `${path}.costUsd`);
  optionalBooleanAt(usage.isEstimate, `${path}.isEstimate`);
}

function assertBehavior(value: unknown, path: string): void {
  const behavior = exactObject(
    value,
    path,
    ['interactionMode', 'expressionLevel', 'relationalDepth', 'carryCuesThroughSession']
  );
  if (!isWorkshopInteractionMode(behavior.interactionMode)) {
    shapeError(`${path}.interactionMode`, 'valid Workshop interaction mode');
  }
  if (!isWorkshopPersonaExpressionLevel(behavior.expressionLevel)) {
    shapeError(`${path}.expressionLevel`, 'valid Workshop expression level');
  }
  if (!isWorkshopRelationalDepth(behavior.relationalDepth)) {
    shapeError(`${path}.relationalDepth`, 'valid Workshop relational depth');
  }
  booleanAt(behavior.carryCuesThroughSession, `${path}.carryCuesThroughSession`);
}

function assertLastCommittedBehavior(value: unknown, path: string): void {
  const behavior = exactObject(
    value,
    path,
    ['interactionMode', 'expressionLevel', 'relationalDepth']
  );
  if (!isWorkshopInteractionMode(behavior.interactionMode)) {
    shapeError(`${path}.interactionMode`, 'valid Workshop interaction mode');
  }
  if (!isWorkshopPersonaExpressionLevel(behavior.expressionLevel)) {
    shapeError(`${path}.expressionLevel`, 'valid Workshop expression level');
  }
  if (!isWorkshopRelationalDepth(behavior.relationalDepth)) {
    shapeError(`${path}.relationalDepth`, 'valid Workshop relational depth');
  }
}

function assertBehaviorTransition(value: unknown, path: string): void {
  const transition = exactObject(value, path, ['from', 'to', 'reason']);
  assertLastCommittedBehavior(transition.from, `${path}.from`);
  assertLastCommittedBehavior(transition.to, `${path}.to`);
  if (transition.reason !== 'writer-selected') {
    shapeError(`${path}.reason`, 'writer-selected');
  }
}

function assertParticipants(value: unknown): void {
  const participants = exactObject(
    value,
    'Workshop session state.participants',
    ['host', 'toolSidecars', 'personaGuests', 'chatTarget']
  );
  const host = exactObject(
    participants.host,
    'Workshop session state.participants.host',
    ['personaId'],
    ['conversationKey']
  );
  if (!isWorkshopPersonaId(host.personaId)) {
    shapeError('Workshop session state.participants.host.personaId', 'known Workshop persona id');
  }
  if (host.conversationKey !== undefined && host.conversationKey !== 'host') {
    shapeError('Workshop session state.participants.host.conversationKey', 'host');
  }
  arrayOf(
    participants.toolSidecars,
    'Workshop session state.participants.toolSidecars',
    (sidecarValue, sidecarPath) => {
      const sidecar = exactObject(
        sidecarValue,
        sidecarPath,
        ['toolId', 'conversationKey', 'latestReportTurnId', 'deliveredToHostThroughTurnId']
      );
      if (!isWorkshopToolId(sidecar.toolId)) {
        shapeError(`${sidecarPath}.toolId`, 'known Workshop tool id');
      }
      stringAt(sidecar.conversationKey, `${sidecarPath}.conversationKey`);
      stringAt(sidecar.latestReportTurnId, `${sidecarPath}.latestReportTurnId`);
      stringAt(sidecar.deliveredToHostThroughTurnId, `${sidecarPath}.deliveredToHostThroughTurnId`);
    }
  );
  arrayOf(
    participants.personaGuests,
    'Workshop session state.participants.personaGuests',
    (guestValue, guestPath) => {
      const guest = exactObject(
        guestValue,
        guestPath,
        ['personaId', 'liveness'],
        ['conversationKey', 'lastSeenHostTurnId', 'deliveredToHostThroughTurnId']
      );
      if (!isWorkshopPersonaId(guest.personaId)) {
        shapeError(`${guestPath}.personaId`, 'known Workshop persona id');
      }
      enumAt(guest.liveness, `${guestPath}.liveness`, ['live', 'disposed']);
      optionalStringAt(guest.conversationKey, `${guestPath}.conversationKey`);
      optionalStringAt(guest.lastSeenHostTurnId, `${guestPath}.lastSeenHostTurnId`);
      optionalStringAt(
        guest.deliveredToHostThroughTurnId,
        `${guestPath}.deliveredToHostThroughTurnId`
      );
    }
  );
  assertChatTarget(participants.chatTarget, 'Workshop session state.participants.chatTarget');
}

function assertChatTarget(value: unknown, path: string): void {
  const target = objectAt(value, path);
  if (target.kind === 'host') {
    exactKeys(target, path, ['kind']);
    return;
  }
  if (target.kind === 'tool') {
    exactKeys(target, path, ['kind', 'toolId']);
    if (!isWorkshopToolId(target.toolId)) {
      shapeError(`${path}.toolId`, 'known Workshop tool id');
    }
    return;
  }
  if (target.kind === 'personaGuest') {
    exactKeys(target, path, ['kind', 'personaId']);
    if (!isWorkshopPersonaId(target.personaId)) {
      shapeError(`${path}.personaId`, 'known Workshop persona id');
    }
    return;
  }
  shapeError(`${path}.kind`, 'host, tool, or personaGuest');
}

function assertStoredTodo(value: unknown, path: string): void {
  const todo = exactObject(
    value,
    path,
    ['id', 'text', 'status', 'source', 'createdAt'],
    ['priority', 'writerEdit']
  );
  stringAt(todo.id, `${path}.id`);
  stringAt(todo.text, `${path}.text`);
  enumAt(todo.status, `${path}.status`, ['open', 'completed', 'dismissed']);
  if (todo.priority !== undefined) {
    enumAt(todo.priority, `${path}.priority`, ['high', 'medium', 'low']);
  }
  assertTodoSource(todo.source, `${path}.source`);
  numberAt(todo.createdAt, `${path}.createdAt`);
  if (todo.writerEdit !== undefined) {
    const writerEdit = exactObject(
      todo.writerEdit,
      `${path}.writerEdit`,
      ['originalText', 'editedAt']
    );
    stringAt(writerEdit.originalText, `${path}.writerEdit.originalText`);
    numberAt(writerEdit.editedAt, `${path}.writerEdit.editedAt`);
  }
}

function assertTodoSource(value: unknown, path: string): void {
  const source = objectAt(value, path);
  const baseRequired = [
    'kind',
    'turnId',
    'participantLabel',
    'findingKey',
    'findingText',
    'excerptVersion'
  ];
  if (source.kind === 'tool_report') {
    exactKeys(source, path, [...baseRequired, 'toolId']);
    if (!isWorkshopToolId(source.toolId)) {
      shapeError(`${path}.toolId`, 'known Workshop tool id');
    }
  } else if (source.kind === 'host_turn') {
    exactKeys(source, path, [...baseRequired, 'personaId'], ['upstreamReportTurnId']);
    if (!isWorkshopPersonaId(source.personaId)) {
      shapeError(`${path}.personaId`, 'known Workshop persona id');
    }
    optionalStringAt(source.upstreamReportTurnId, `${path}.upstreamReportTurnId`);
  } else {
    shapeError(`${path}.kind`, 'tool_report or host_turn');
  }
  stringAt(source.turnId, `${path}.turnId`);
  stringAt(source.participantLabel, `${path}.participantLabel`);
  stringAt(source.findingKey, `${path}.findingKey`);
  stringAt(source.findingText, `${path}.findingText`);
  numberAt(source.excerptVersion, `${path}.excerptVersion`);
}

function exactObject(
  value: unknown,
  path: string,
  required: readonly string[],
  optional: readonly string[] = []
): Record<string, unknown> {
  const object = objectAt(value, path);
  exactKeys(object, path, required, optional);
  return object;
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    shapeError(path, 'plain object');
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  object: Record<string, unknown>,
  path: string,
  required: readonly string[],
  optional: readonly string[] = []
): void {
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(object).find((key) => !allowed.has(key));
  if (unknown) {
    throw new Error(`${path} contains unknown field ${unknown}`);
  }
  const missing = required.find(
    (key) => !Object.prototype.hasOwnProperty.call(object, key) || object[key] === undefined
  );
  if (missing) {
    throw new Error(`${path} is missing required field ${missing}`);
  }
}

function arrayOf(
  value: unknown,
  path: string,
  assertItem: (item: unknown, itemPath: string) => void
): void {
  if (!Array.isArray(value)) {
    shapeError(path, 'array');
  }
  value.forEach((item, index) => assertItem(item, `${path}[${index}]`));
}

function stringAt(value: unknown, path: string): void {
  if (typeof value !== 'string') {
    shapeError(path, 'string');
  }
}

function optionalStringAt(value: unknown, path: string): void {
  if (value !== undefined) {
    stringAt(value, path);
  }
}

function numberAt(value: unknown, path: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    shapeError(path, 'finite number');
  }
}

function optionalNumberAt(value: unknown, path: string): void {
  if (value !== undefined) {
    numberAt(value, path);
  }
}

function booleanAt(value: unknown, path: string): void {
  if (typeof value !== 'boolean') {
    shapeError(path, 'boolean');
  }
}

function optionalBooleanAt(value: unknown, path: string): void {
  if (value !== undefined) {
    booleanAt(value, path);
  }
}

function enumAt(value: unknown, path: string, allowed: readonly string[]): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    shapeError(path, allowed.join(' | '));
  }
}

function jsonObjectAt(value: unknown, path: string): void {
  objectAt(value, path);
  assertJsonValue(value, path);
}

/**
 * Free-form JSON validation for capability metadata.
 *
 * This runs on BOTH sides of the durable boundary: on read against a
 * `JSON.parse` result (where `undefined` cannot occur) and on write against the
 * live in-memory object (where it routinely does — any optional metadata field
 * the persona omitted is an `undefined` member).
 *
 * So it must honor the same policy `clonePersistedJson` documents: an
 * `undefined` OBJECT MEMBER is an absent member, exactly as `JSON.stringify`
 * omits it. Rejecting one used to fail every save of a session containing a
 * `resource.read` without an explicit `endLine` — the validator refusing a value
 * that would never have reached disk.
 *
 * An `undefined` ARRAY ITEM is a different matter and stays refused: JSON has no
 * hole, so `JSON.stringify` writes `null` there, silently changing the data.
 */
function assertJsonValue(value: unknown, path: string): void {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return;
  }
  if (typeof value === 'number') {
    numberAt(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`));
    return;
  }
  if (value === undefined) {
    // Only reachable as an array item: object members are skipped below.
    shapeError(path, 'a JSON value (an undefined array item would be written as null)');
  }
  const object = objectAt(value, path);
  for (const [key, nested] of Object.entries(object)) {
    if (nested === undefined) {
      continue;
    }
    assertJsonValue(nested, `${path}.${key}`);
  }
}

function shapeError(path: string, expected: string): never {
  throw new Error(`${path} must be ${expected}`);
}
