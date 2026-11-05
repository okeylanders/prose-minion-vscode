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
 * - **The room it was asked in.** Its revision is read when the request
 *   arrives, before anything is awaited, and read again after a saved
 *   turn's read: a room replaced meanwhile (a reopen with the same id, a
 *   Rewind) refuses the request before anything is sent (A-02).
 * - **The setting** (`proseMinion.workshop.memory.helperDrafts`) is read
 *   when the request arrives; off, it answers `off` and nothing is read or
 *   sent. The webview learns the setting from `WORKSHOP_MEMORY_DRAFTS_SETTING`
 *   (asked once mounted, pushed by the config watcher) and, off, asks for
 *   nothing at all (D5.7).
 * - **One draft at a time, stopped when not wanted** (A-05). A newer
 *   request, the sheet's cancel (`WORKSHOP_MEMORY_DRAFT_CANCEL`: Close,
 *   Save, another opening) and disposal abort the call in flight, so its
 *   paid request stops; a call the host stopped answers nothing.
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
  type WorkshopMemoryDraftCancelMessage,
  type WorkshopMemoryDraftOutcome,
  type WorkshopMemoryDraftRequestMessage,
  type WorkshopMemoryDraftsSettingMessage,
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
const REFUSED_ROOM_CHANGED = 'room-changed';

/** Whether drafting is on, as the webview hears it: the route's answer and the config watcher's push read this one rule. */
export function workshopMemoryDraftsSettingMessage(settings: Pick<SettingsStore, 'get'>): WorkshopMemoryDraftsSettingMessage {
  return {
    type: MessageType.WORKSHOP_MEMORY_DRAFTS_SETTING,
    source: 'extension.workshop',
    payload: { enabled: helperDraftsEnabled(settings) },
    timestamp: Date.now()
  };
}

function helperDraftsEnabled(settings: Pick<SettingsStore, 'get'>): boolean {
  return coerceWorkshopMemoryHelperDrafts(
    settings.get<unknown>(WORKSHOP_MEMORY_HELPER_DRAFTS_SETTING.section, WORKSHOP_MEMORY_HELPER_DRAFTS_SETTING.key)
  );
}
const ID_CHARACTERS = 256;

export class WorkshopMemoryDraftHandler {
  private inFlight?: { readonly requestId: string; readonly controller: AbortController };

  constructor(
    private readonly ports: WorkshopMemoryDraftPorts,
    private readonly room: WorkshopMemoryDraftRoom,
    private readonly recall: WorkshopMemoryDraftRecall,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {}

  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.WORKSHOP_MEMORY_DRAFT_REQUEST, this.handleDraftRequest.bind(this));
    router.register(MessageType.WORKSHOP_MEMORY_DRAFT_CANCEL, this.handleCancel.bind(this));
    router.register(MessageType.WORKSHOP_REQUEST_MEMORY_DRAFTS_SETTING, this.handleRequestSetting.bind(this));
  }

  /** The composition ends: stop the call in flight, so its request ends too. */
  dispose(): void {
    this.inFlight?.controller.abort();
    this.inFlight = undefined;
  }

  async handleCancel(message: WorkshopMemoryDraftCancelMessage): Promise<void> {
    const requestId = idOf(message.payload?.requestId);
    if (requestId !== undefined && this.inFlight?.requestId === requestId) {
      this.log(`request ${requestId} cancelled`);
      this.inFlight.controller.abort();
      this.inFlight = undefined;
    }
  }

  async handleRequestSetting(): Promise<void> {
    void this.postMessage(workshopMemoryDraftsSettingMessage(this.ports.settings));
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
    if (!helperDraftsEnabled(this.ports.settings)) {
      this.answer(requestId, 'off');
      return;
    }
    this.inFlight?.controller.abort();
    const controller = new AbortController();
    const owner = { requestId, controller };
    this.inFlight = owner;
    try {
      const turn = sessionId === undefined
        ? this.liveTurn(turnId, payload.roomRevision, roomRevision)
        : await this.savedTurn(sessionId, turnId, roomRevision);
      if (controller.signal.aborted) {
        this.log(`request ${requestId} stopped before it was sent`);
        return;
      }
      if (typeof turn === 'string') {
        this.answer(requestId, 'refused', turn);
        return;
      }
      const result = await this.ports.helper.run('memory-draft', {
        text: workshopMemoryNoteFromTurn(turn.content),
        source: turn.kind === 'writer' ? 'writer' : 'persona'
      }, { signal: controller.signal });
      // Stopped by the host (cancel, a newer request, disposal): the sheet no longer waits.
      if (controller.signal.aborted) {
        this.log(`request ${requestId} stopped`);
        return;
      }
      this.answerResult(requestId, result);
    } catch (error) {
      this.log(`request ${requestId} failed: ${error instanceof Error ? error.name : 'error'}`);
      if (!controller.signal.aborted) {
        this.answer(requestId, 'failed');
      }
    } finally {
      if (this.inFlight === owner) {
        this.inFlight = undefined;
      }
    }
  }

  /** A turn of the open room, by the room it was asked in; a reason when it can't be read. */
  private liveTurn(turnId: string, askedIn: number | undefined, current: number): WorkshopTurnPreview | string {
    if (askedIn !== undefined && askedIn !== current) {
      return REFUSED_ROOM_CHANGED;
    }
    const turn = this.room.readRoomLedger().find((candidate) => candidate.id === turnId);
    if (!turn || !isWorkshopBookmarkableTurn(turn)) {
      return 'not-eligible';
    }
    return workshopTurnPreview(turn) ?? 'not-eligible';
  }

  /**
   * A saved session's turn, through recall alone; a reason when it can't be
   * read, or when the room changed while it was read (the session may be
   * the open one now).
   */
  private async savedTurn(sessionId: string, turnId: string, askedIn: number): Promise<WorkshopTurnPreview | string> {
    const found = await this.recall.savedTurn(sessionId, turnId);
    if (this.room.readRoomRevision() !== askedIn) {
      return REFUSED_ROOM_CHANGED;
    }
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
