/**
 * The writer's answer to a persona's context-paths card (ADR 2026-11-19
 * D24, D27): the 25th composed route owner.
 *
 * - **Ids in, an answer by `requestId` out.** The webview names the room
 *   revision, the reply's turn and the groups ticked, never a pattern. The
 *   host finds the card on its own ledger.
 * - **One room operation** (PR #290 P1): behind the room's mutation gate,
 *   and then the recheck, the settings writes and the card's receipt run
 *   inside the coordinator's serialized room operation, so no whole-room
 *   replacement interleaves; the room's revision must match inside it.
 * - **One write, C1's:** `applyContextPathProposal` checks each ticked group
 *   again (the workspace level, the value against the card's baseline, the
 *   kept patterns through the resolver) and writes at the user level (L1).
 * - **Every offered group is answered:** `applied`, `left` with its reason,
 *   or `declined` when it was not ticked. No group ticked declines the card.
 * - Logs carry ids, counts and reasons, never a pattern or a path (D28).
 */

import type { LogSink } from '@/platform';
import {
  MessageType,
  type WorkshopApplyLocationsProposalMessage,
  type WorkshopApplyLocationsProposalPayload,
  type WorkshopLocationsGroupAnswer,
  type WorkshopLocationsProposalResultMessage,
  type WorkshopLocationsProposalResultOutcome,
  type WorkshopTurn
} from '@messages';
import { CONTEXT_PATH_GROUPS, isContextPathGroup, type ContextPathGroup } from '@shared/types';
import type { ContextPathProposalChecker } from '@/application/services/contextPaths/ContextPathProposalChecker';
import type { ContextPathSettingsWriter } from '@/application/services/contextPaths/ContextPathSettingsWriter';
import { applyContextPathProposal } from '@/application/services/contextPaths/ContextPathApply';
import { workshopLocationsCardMismatch } from '@/application/services/workshop/locations/WorkshopLocationsProposalRecords';
import type { MessageTransport } from '@handlers/MessageHandlerContracts';
import type { WorkshopMutationRouteRegistrar } from '@handlers/domain/workshop/WorkshopRouteContracts';

/** C1's checker and settings, built in `extension.ts`: what a card's settlement and Apply need. */
export interface WorkshopLocationsProposalPorts {
  readonly checker: Pick<ContextPathProposalChecker, 'check' | 'recheck'>;
  readonly settings: Pick<ContextPathSettingsWriter, 'read' | 'write'>;
}

export interface WorkshopLocationsProposalSession {
  readRoomRevision(): number;
  readRoomLedger(): readonly WorkshopTurn[];
  answerLocationsProposal(turnId: string, answers: readonly WorkshopLocationsGroupAnswer[]): WorkshopTurn | undefined;
}

/** The coordinator's serialized room operation (`runContextRefresh`), the one New, Open, Rewind and Branch share. */
export interface WorkshopLocationsProposalRoom {
  runContextRefresh(operation: () => Promise<void>): Promise<void>;
}

export interface WorkshopLocationsProposalEffects {
  postSessionState(): void;
  markDirty(reason: string): void;
}

const LOG = '[WorkshopLocationsProposalHandler]';

export class WorkshopLocationsProposalHandler {
  private readonly applying = new Set<string>();

  constructor(
    private readonly session: WorkshopLocationsProposalSession,
    private readonly ports: WorkshopLocationsProposalPorts | undefined,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink,
    private readonly effects: WorkshopLocationsProposalEffects,
    /** The coordinator's room-operation path: Apply runs as one, so no room replacement interleaves (PR #290 P1). */
    private readonly room: WorkshopLocationsProposalRoom
  ) {}

  registerRoutes(registerMutation: WorkshopMutationRouteRegistrar): void {
    registerMutation(MessageType.WORKSHOP_APPLY_LOCATIONS_PROPOSAL, this.handleApply.bind(this), undefined,
      (_reason, message: WorkshopApplyLocationsProposalMessage) => {
        const payload = payloadOf(message.payload);
        if (payload) {
          this.answer(payload, 'busy', []);
        }
      });
  }

  async handleApply(message: WorkshopApplyLocationsProposalMessage): Promise<void> {
    const payload = payloadOf(message.payload);
    if (!payload) {
      this.log('Apply refused (reason=invalid-request)');
      return;
    }
    if (!this.ports) {
      return this.answer(payload, 'unavailable', []);
    }
    if (this.applying.has(payload.turnId)) {
      return this.answer(payload, 'busy', []);
    }
    this.applying.add(payload.turnId);
    try {
      // The recheck, the writes and the receipt are one room operation (PR #290 P1): no New, Open, Rewind or
      // Branch can land between them, so a global write never outlives the card that records it.
      let settled: { outcome: WorkshopLocationsProposalResultOutcome; groups: WorkshopLocationsGroupAnswer[] } | undefined;
      await this.room.runContextRefresh(async () => {
        settled = await this.applyInRoom(payload, this.ports!);
      });
      this.answer(payload, settled?.outcome ?? 'room-changed', settled?.groups ?? []);
    } finally {
      this.applying.delete(payload.turnId);
    }
  }

  private async applyInRoom(
    payload: WorkshopApplyLocationsProposalPayload,
    ports: WorkshopLocationsProposalPorts
  ): Promise<{ outcome: WorkshopLocationsProposalResultOutcome; groups: WorkshopLocationsGroupAnswer[] }> {
    if (payload.roomRevision !== this.session.readRoomRevision()) {
      return { outcome: 'room-changed', groups: [] };
    }
    const card = this.cardOf(payload.turnId);
    // A card whose parts disagree draws one proposal and would write another (PR #290 P1): it is never applied.
    if (!card || workshopLocationsCardMismatch(card)) {
      return { outcome: 'unknown-card', groups: [] };
    }
    if (card.state !== 'pending') {
      return { outcome: 'answered', groups: [] };
    }
    const offered = CONTEXT_PATH_GROUPS.filter((group) =>
      card.view.groups.some((view) => view.group === group && view.offer.offered));
    const ticked = offered.filter((group) => payload.groups.includes(group));
    const outcomes = ticked.length > 0
      ? await applyContextPathProposal(card, ticked, {
        checker: ports.checker,
        settings: ports.settings,
        log: { appendLine: (line) => this.outputChannel.appendLine(`${LOG} ${line}`) }
      })
      : [];
    const answers: WorkshopLocationsGroupAnswer[] = offered.map((group) =>
      outcomes.find((outcome) => outcome.group === group) ?? { group, outcome: 'declined' });
    // Still this room: the operation holds it. The receipt is written before the operation ends.
    if (this.session.answerLocationsProposal(payload.turnId, answers)) {
      this.effects.markDirty('context paths proposal answered');
      this.effects.postSessionState();
    }
    return { outcome: 'done', groups: answers };
  }

  private cardOf(turnId: string) {
    return this.session.readRoomLedger().find((turn) => turn.id === turnId)?.locationsProposal;
  }

  private answer(
    payload: WorkshopApplyLocationsProposalPayload,
    outcome: WorkshopLocationsProposalResultOutcome,
    groups: WorkshopLocationsGroupAnswer[]
  ): void {
    const counts = (kind: WorkshopLocationsGroupAnswer['outcome']): number => groups.filter((group) => group.outcome === kind).length;
    this.log(`Apply ${outcome} (turnId=${payload.turnId}; applied=${counts('applied')}; left=${counts('left')}; declined=${counts('declined')})`);
    const message: WorkshopLocationsProposalResultMessage = {
      type: MessageType.WORKSHOP_LOCATIONS_PROPOSAL_RESULT,
      source: 'extension.workshop.locationsProposal',
      payload: { requestId: payload.requestId, turnId: payload.turnId, outcome, groups },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private log(line: string): void {
    this.outputChannel.appendLine(`${LOG} ${line}`);
  }
}

function payloadOf(value: unknown): WorkshopApplyLocationsProposalPayload | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const payload = value as Partial<WorkshopApplyLocationsProposalPayload>;
  if (typeof payload.requestId !== 'string' || payload.requestId.length === 0 || payload.requestId.length > 200
    || typeof payload.turnId !== 'string' || payload.turnId.length === 0 || payload.turnId.length > 200
    || typeof payload.roomRevision !== 'number' || !Number.isSafeInteger(payload.roomRevision)
    || !Array.isArray(payload.groups) || payload.groups.length > CONTEXT_PATH_GROUPS.length
    || !payload.groups.every((group) => typeof group === 'string' && isContextPathGroup(group))) {
    return undefined;
  }
  return {
    requestId: payload.requestId,
    roomRevision: payload.roomRevision,
    turnId: payload.turnId,
    groups: [...new Set(payload.groups as ContextPathGroup[])]
  };
}
