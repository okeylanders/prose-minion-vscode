/**
 * The helper's draft of a memory (ADR 2026-11-05 D5; Helper Agent Slice 2):
 * `WORKSHOP_MEMORY_DRAFT_REQUEST`, answered by `WORKSHOP_MEMORY_DRAFT_RESULT`
 * with the request's id. A sibling of Project Memory's routes; it writes
 * nothing, so it is direct, not behind the room's gate.
 *
 * - **The host reads the turn itself,** by its ids, never from the webview:
 *   a turn of the open room from its ledger (a bookmark outside the window
 *   names the room it was asked in, and another room is refused), a saved
 *   session's turn only through recall's read-only `savedTurn`. Either way
 *   the text is the transcript projection's (`workshopTurnPreview` /
 *   `workshopTurnPreviewOfEntry`), cut as the sheet's note is
 *   (`workshopMemoryNoteFromTurn`). A turn a bookmark may not mark is
 *   refused, by the bubbles' rule.
 * - **The setting** (`proseMinion.workshop.memory.helperDrafts`) is read
 *   when the request arrives; off, nothing is read or sent.
 * - **One draft at a time.** A newer request stops the one before it: the
 *   sheet only ever waits for its newest. Disposal stops the one in flight.
 * - **Logs** carry ids and outcomes, never the turn's text or the draft.
 */

import type { MessageRouter } from '@handlers/MessageRouter';
import type { MessageTransport } from '@handlers/MessageHandlerContracts';
import type { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import {
  workshopTurnPreview,
  workshopTurnPreviewOfEntry
} from '@/application/services/workshop/transcript/WorkshopTurnPreview';
import type { HelperRunResult } from '@services/helper/HelperAgentService';
import type { MemoryDraft, MemoryDraftInput } from '@services/helper/tasks/MemoryDraftTask';
import type { LogSink, SettingsStore } from '@/platform';
import {
  MessageType,
  WORKSHOP_MEMORY_HELPER_DRAFTS_SETTING,
  coerceWorkshopMemoryHelperDrafts,
  type WorkshopMemoryDraftOutcome,
  type WorkshopMemoryDraftRequestMessage,
  type WorkshopMemoryDraftResultMessage,
  type WorkshopMemoryDraftResultPayload,
  type WorkshopTurn,
  type WorkshopTurnPreview
} from '@messages';
import { isWorkshopBookmarkableTurn } from '@shared/constants/workshopBookmarks';
import { workshopMemoryNoteFromTurn } from '@shared/constants/workshopProjectMemoryWrites';

/** The helper's one task this route asks for. */
export interface WorkshopMemoryDraftHelper {
  run(task: 'memory-draft', input: MemoryDraftInput, options?: { signal?: AbortSignal }): Promise<HelperRunResult<MemoryDraft>>;
}

/** What the composition root hands the route: the helper and the settings it reads its switch from. */
export interface WorkshopMemoryDraftPorts {
  readonly helper: WorkshopMemoryDraftHelper;
  readonly settings: Pick<SettingsStore, 'get'>;
}

/** The open room's facts this route reads. */
export interface WorkshopMemoryDraftRoom {
  readRoomLedger(): readonly WorkshopTurn[];
  readRoomRevision(): number;
}

export type WorkshopMemoryDraftRecall = Pick<WorkshopTranscriptRecallService, 'savedTurn'>;

const LOG = '[WorkshopMemoryDraftHandler]';
const ID_CHARACTERS = 256;

export class WorkshopMemoryDraftHandler {
  private inFlight?: AbortController;

  constructor(
    private readonly ports: WorkshopMemoryDraftPorts,
    private readonly room: WorkshopMemoryDraftRoom,
    private readonly recall: WorkshopMemoryDraftRecall,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {}

  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.WORKSHOP_MEMORY_DRAFT_REQUEST, this.handleDraftRequest.bind(this));
  }

  dispose(): void {
    this.inFlight?.abort();
    this.inFlight = undefined;
  }

  async handleDraftRequest(message: WorkshopMemoryDraftRequestMessage): Promise<void> {
    // Before anything is awaited: the room this request belongs to.
    const roomRevision = this.room.readRoomRevision();
    const payload = message.payload;
    const requestId = idOf(payload?.requestId);
    if (!requestId) {
      this.log('request refused reason=malformed');
      return;
    }
    const turnId = idOf(payload.turnId);
    const sessionId = payload.sessionId === undefined ? undefined : idOf(payload.sessionId);
    if (!turnId || (payload.sessionId !== undefined && !sessionId)
      || (payload.roomRevision !== undefined && typeof payload.roomRevision !== 'number')) {
      this.answer(requestId, 'refused', 'malformed');
      return;
    }
    const enabled = coerceWorkshopMemoryHelperDrafts(
      this.ports.settings.get<unknown>(WORKSHOP_MEMORY_HELPER_DRAFTS_SETTING.section, WORKSHOP_MEMORY_HELPER_DRAFTS_SETTING.key)
    );
    if (!enabled) {
      this.answer(requestId, 'off');
      return;
    }
    this.inFlight?.abort();
    const controller = new AbortController();
    this.inFlight = controller;
    try {
      const turn = sessionId === undefined
        ? this.liveTurn(turnId, payload.roomRevision, roomRevision)
        : await this.savedTurn(sessionId, turnId);
      if (typeof turn === 'string') {
        this.answer(requestId, 'refused', turn);
        return;
      }
      const result = await this.ports.helper.run('memory-draft', {
        text: workshopMemoryNoteFromTurn(turn.content),
        source: turn.kind === 'writer' ? 'writer' : 'persona'
      }, { signal: controller.signal });
      this.answerResult(requestId, result);
    } catch (error) {
      this.log(`request ${requestId} failed: ${error instanceof Error ? error.name : 'error'}`);
      this.answer(requestId, 'failed');
    } finally {
      if (this.inFlight === controller) {
        this.inFlight = undefined;
      }
    }
  }

  /** A turn of the open room, by the room it was asked in; a reason when it can't be read. */
  private liveTurn(turnId: string, askedIn: number | undefined, current: number): WorkshopTurnPreview | string {
    if (askedIn !== undefined && askedIn !== current) {
      return 'room-changed';
    }
    const turn = this.room.readRoomLedger().find((candidate) => candidate.id === turnId);
    if (!turn || !isWorkshopBookmarkableTurn(turn)) {
      return 'not-eligible';
    }
    return workshopTurnPreview(turn) ?? 'not-eligible';
  }

  /** A saved session's turn, through recall alone; a reason when it can't be read. */
  private async savedTurn(sessionId: string, turnId: string): Promise<WorkshopTurnPreview | string> {
    const found = await this.recall.savedTurn(sessionId, turnId);
    if ('available' in found) {
      return found.reason;
    }
    if (found.kind !== 'turn') {
      return found.kind;
    }
    return found.bookmarkable ? workshopTurnPreviewOfEntry(found.entry) : 'not-eligible';
  }

  private answerResult(requestId: string, result: HelperRunResult<MemoryDraft>): void {
    switch (result.kind) {
      case 'drafted':
        this.post({ requestId, outcome: 'drafted', draft: { ...result.value } }, 'drafted');
        return;
      case 'unconfigured':
        this.answer(requestId, 'unconfigured');
        return;
      case 'rejected':
        this.answer(requestId, 'malformed', result.fault);
        return;
      case 'failed':
        this.answer(requestId, 'failed', result.reason);
        return;
      default: {
        const unreachable: never = result;
        return unreachable;
      }
    }
  }

  private answer(requestId: string, outcome: Exclude<WorkshopMemoryDraftOutcome, 'drafted'>, reason?: string): void {
    this.post({ requestId, outcome }, reason ? `${outcome} reason=${reason}` : outcome);
  }

  private post(payload: WorkshopMemoryDraftResultPayload, logged: string): void {
    this.log(`request ${payload.requestId} ${logged}`);
    const reply: WorkshopMemoryDraftResultMessage = {
      type: MessageType.WORKSHOP_MEMORY_DRAFT_RESULT,
      source: 'extension.workshop',
      payload,
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
