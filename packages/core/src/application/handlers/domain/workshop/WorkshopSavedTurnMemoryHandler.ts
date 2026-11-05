/**
 * "Remember this" on a saved session's bookmark (ADR 2026-11-05 D9; Bookmark
 * Recall Slice 3): `WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY`, a sibling of
 * Project Memory's write routes so `WorkshopProjectMemoryHandler` grows only
 * by its seam.
 *
 * - **The turn is the host's to check,** through the recall service's
 *   read-only `savedTurn`: the session must be saved, readable and claimed
 *   by one file (an `ambiguous-session` is refused, never resolved: PR #216
 *   F-01), the turn must be in it, and it must be a message or a reply, as
 *   a bookmark is. The open room is refused: its turns save through
 *   `WORKSHOP_SAVE_TURN_TO_MEMORY`.
 * - **What it writes:** `{ origin: 'writer', sourceSession, sourceTurns:
 *   [turnId] }`, through Project Memory's write seam (`saveWriterMemory`):
 *   its draft check, single-writer queue, receipt and answer, the same as
 *   every other save.
 * - **Behind the gate,** as every write route is: a room replacement in
 *   flight refuses it.
 * - **Answers** are `WORKSHOP_MEMORY_WRITE_RESULT`, echoing the request's id.
 *   Logs name ids, outcomes and reasons, never a title or a message.
 */

import type { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import type { WorkshopRecallUnavailableReason } from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import type { ProjectMemorySaveProvenance } from '@/application/services/workshop/memory/ProjectMemoryWrites';
import type { WorkshopMutationRouteRegistrar } from '@handlers/domain/workshop/WorkshopRouteContracts';
import { workshopSavedTurnProvenance } from '@handlers/domain/workshop/WorkshopProjectMemoryProvenance';
import {
  WORKSHOP_MEMORY_NOT_ELIGIBLE,
  workshopMemoryRequestIdOf
} from '@handlers/domain/workshop/WorkshopProjectMemoryRefusals';
import type { MessageTransport } from '@handlers/MessageHandlerContracts';
import type { LogSink } from '@/platform';
import {
  MessageType,
  type WorkshopMemoryDraft,
  type WorkshopMemoryWriteResultMessage,
  type WorkshopMemoryWriteResultPayload,
  type WorkshopSaveSavedTurnToMemoryMessage
} from '@messages';
import { PROJECT_MEMORY_SOURCE_TURN } from '@shared/types/projectMemory';

/** The one recall seam this route reads. */
export type WorkshopSavedTurnMemoryRecall = Pick<WorkshopTranscriptRecallService, 'savedTurn'>;

/** Project Memory's write seam; satisfied by WorkshopProjectMemoryHandler. */
export interface WorkshopSavedTurnMemoryWriter {
  saveWriterMemory(
    requestId: string,
    target: string,
    draft: WorkshopMemoryDraft,
    provenance: ProjectMemorySaveProvenance
  ): Promise<WorkshopMemoryWriteResultPayload>;
}

const LOG = '[WorkshopSavedTurnMemoryHandler]';
const ID_CHARACTERS = 256;
/** A session id as Project Memory's codec writes `source-session`. */
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9-]{0,127}$/;

export const WORKSHOP_SAVED_TURN_MEMORY_REFUSALS = Object.freeze({
  malformed: 'That request could not be read.',
  unknownSession: 'That saved session is no longer there.',
  unreadable: 'That saved session couldn’t be read.',
  unknownTurn: 'That message is no longer in its saved session.',
  liveSession: 'That session is the one open now: save its message from the thread.',
  ambiguousSession: 'More than one saved session file uses this session’s id, so it can’t be saved from here. Keep one of the files in prose-minion/sessions.',
  notEligible: WORKSHOP_MEMORY_NOT_ELIGIBLE
});

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the reasons' kebab-case words. */
const UNAVAILABLE: Readonly<Record<WorkshopRecallUnavailableReason, string>> = {
  'no-workspace': 'Saved sessions need an open folder.',
  'multi-root': 'Saved sessions need a single-folder workspace.',
  'workspace-changed': 'The workspace changed while the saved session was read. Try again.',
  'not-ready': 'The room changed while the saved session was read. Try again.'
};
/* eslint-enable @typescript-eslint/naming-convention */

export class WorkshopSavedTurnMemoryHandler {
  constructor(
    private readonly recall: WorkshopSavedTurnMemoryRecall,
    private readonly writer: WorkshopSavedTurnMemoryWriter,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink,
    private readonly reportError: (message: string) => void
  ) {}

  registerRoutes(registerMutation: WorkshopMutationRouteRegistrar): void {
    registerMutation(
      MessageType.WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY,
      this.handleSaveSavedTurn.bind(this),
      undefined,
      (reason, message: WorkshopSaveSavedTurnToMemoryMessage) => {
        const requestId = workshopMemoryRequestIdOf(message.payload);
        if (requestId) {
          this.refuse(requestId, reason, 'session-operation');
        } else {
          this.reportError(reason);
        }
      }
    );
  }

  async handleSaveSavedTurn(message: WorkshopSaveSavedTurnToMemoryMessage): Promise<void> {
    const payload = message.payload;
    const requestId = workshopMemoryRequestIdOf(payload);
    if (!requestId) {
      this.reportError('Remember this must name its request');
      return;
    }
    const sessionId = idOf(payload?.sessionId);
    const turnId = idOf(payload?.turnId);
    if (sessionId === undefined || turnId === undefined) {
      this.refuse(requestId, WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.malformed, 'malformed');
      return;
    }
    const target = `saved turn sessionId=${sessionId} turnId=${turnId}`;
    // Only an id the memory format can hold names a source: anything else is no message to save.
    if (!SESSION_ID.test(sessionId) || !PROJECT_MEMORY_SOURCE_TURN.test(turnId)) {
      this.refuse(requestId, WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.notEligible, 'not-eligible', target);
      return;
    }
    let found: Awaited<ReturnType<WorkshopSavedTurnMemoryRecall['savedTurn']>>;
    try {
      found = await this.recall.savedTurn(sessionId, turnId);
    } catch (error) {
      this.log(`${target} read failed: ${error instanceof Error ? error.name : 'error'}`);
      this.refuse(requestId, WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.unreadable, 'error', target);
      return;
    }
    if ('available' in found) {
      this.refuse(requestId, UNAVAILABLE[found.reason], found.reason, target);
      return;
    }
    switch (found.kind) {
      case 'turn':
        // A bookmark marks a message or a reply; an event line is neither (isWorkshopBookmarkableTurn).
        if (found.entry.kind === 'event') {
          this.refuse(requestId, WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.notEligible, 'not-eligible', target);
          return;
        }
        await this.writer.saveWriterMemory(requestId, target, payload.draft, workshopSavedTurnProvenance(sessionId, turnId));
        return;
      case 'live-session':
        this.refuse(requestId, WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.liveSession, found.kind, target);
        return;
      case 'unknown-session':
        this.refuse(requestId, WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.unknownSession, found.kind, target);
        return;
      case 'unreadable':
        this.refuse(requestId, WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.unreadable, found.kind, target);
        return;
      case 'ambiguous-session':
        this.refuse(requestId, WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.ambiguousSession, found.kind, target);
        return;
      case 'unknown-turn':
        this.refuse(requestId, WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.unknownTurn, found.kind, target);
        return;
      default: {
        const unreachable: never = found;
        return unreachable;
      }
    }
  }

  private refuse(requestId: string, error: string, reason: string, target = 'saved turn'): void {
    this.log(`${target} refused reason=${reason}`);
    const reply: WorkshopMemoryWriteResultMessage = {
      type: MessageType.WORKSHOP_MEMORY_WRITE_RESULT,
      source: 'extension.workshop',
      payload: { requestId, ok: false, error },
      timestamp: Date.now()
    };
    void this.postMessage(reply);
  }

  private log(line: string): void {
    this.outputChannel.appendLine(`${LOG} ${line}`);
  }
}

function idOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= ID_CHARACTERS ? value : undefined;
}
