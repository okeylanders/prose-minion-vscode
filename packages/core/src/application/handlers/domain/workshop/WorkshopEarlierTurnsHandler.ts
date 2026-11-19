import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  workshopEditOfferRoomViewOnce,
  workshopTurnForWebview,
  type WorkshopEditOfferRoomView
} from '@/application/services/workshop/fileEdits/WorkshopFileEditWebviewView';
import { workshopTurnBytes } from '@/application/services/workshop/session/WorkshopThreadTurnParts';
import { MessageRouter } from '@handlers/MessageRouter';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { LogSink } from '@/platform';
import {
  MessageType,
  WorkshopEarlierTurnsMessage,
  WorkshopEarlierTurnsPayload,
  WorkshopRequestEarlierTurnsMessage
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

/**
 * The one persistence fact a page needs: whether a room replacement is in
 * flight, and a way to wait it out without joining it.
 */
export interface WorkshopEarlierTurnsGate {
  isSessionOperationPending(): boolean;
  waitForSessionOperations(): Promise<void>;
}

/** The longest request id an answer echoes; a webview mints short ones. */
const REQUEST_ID_CHARACTERS = 128;
/** The longest turn id an answer echoes; the ledger mints short ones. */
const TURN_ID_CHARACTERS = 256;
/** The most turns one jump may load: `jumpPages` full pages (D6, amended 2026-11-18). */
export const WORKSHOP_JUMP_TURNS = PROMPT_BUDGETS.workshopThread.jumpPages * PROMPT_BUDGETS.workshopThread.pageTurns;

export const WORKSHOP_EARLIER_TURNS_REFUSALS = {
  malformed: 'Earlier turns could not be asked for.',
  roomChanged: 'The room changed before its earlier turns could be shown.',
  unknownTurn: 'This room no longer holds the turn the earlier ones were asked from.',
  unknownTarget: 'This room no longer holds the turn to show.',
  targetNotEarlier: 'The turn to show is not among the earlier turns.',
  targetTooFar: 'The turn is too far back to load into the thread, so the reader shows it instead.'
} as const;

type Refusal = 'malformed' | 'room-changed' | 'unknown-turn' | 'unknown-target' | 'target-not-earlier' | 'target-too-far';

const REFUSAL_WORDS: Record<Refusal, string> = {
  'malformed': WORKSHOP_EARLIER_TURNS_REFUSALS.malformed,
  'room-changed': WORKSHOP_EARLIER_TURNS_REFUSALS.roomChanged,
  'unknown-turn': WORKSHOP_EARLIER_TURNS_REFUSALS.unknownTurn,
  'unknown-target': WORKSHOP_EARLIER_TURNS_REFUSALS.unknownTarget,
  'target-not-earlier': WORKSHOP_EARLIER_TURNS_REFUSALS.targetNotEarlier,
  'target-too-far': WORKSHOP_EARLIER_TURNS_REFUSALS.targetTooFar
};

type Asked = Pick<WorkshopEarlierTurnsPayload, 'requestId' | 'roomRevision' | 'beforeTurnId' | 'targetTurnId'>;

/**
 * Owns a long room's earlier turns (ADR 2026-11-17 D1–D4): the page of turns
 * directly before a turn, outside the snapshot's window.
 *
 * - **A read.** It registers directly, never behind the mutation gate. It
 *   writes no session state, never dirties the session and never saves it.
 * - **Room-bound.** It waits out every room replacement queued while it
 *   waits (as the turn preview does), then answers only from the room the
 *   request named: `roomRevision` is compared with `readRoomRevision()`
 *   before the ledger is read.
 * - **One projection** (D2). The page's parts are the session's
 *   `readEarlierTurns`, built by the function the snapshot window uses, and
 *   its turns pass through `workshopTurnForWebview` with the edit-offer room
 *   view `postSessionState` uses.
 * - **Bounded** by `PROMPT_BUDGETS.workshopThread`, the bytes measured on
 *   each turn as sent.
 * - **A jump's pages** (D6, amended 2026-11-18). A request naming
 *   `targetTurnId` is answered with the same page, after the host checks the
 *   room still holds the target, that it lies before `beforeTurnId`, and that
 *   at most `jumpPages * pageTurns` turns lie between. The distance only shrinks as the
 *   webview's walk moves back, so checking every request is checking the
 *   first.
 *
 * Logs carry ids, outcomes and counts: never a turn's text.
 */
export class WorkshopEarlierTurnsHandler {
  constructor(
    private readonly session: WorkshopSessionService,
    private readonly outputChannel: LogSink,
    private readonly postMessage: MessageTransport,
    private readonly gate: WorkshopEarlierTurnsGate,
    /** The room view an edit offer's status is derived from, as `postSessionState` reads it. */
    private readonly editOfferRoomView: () => WorkshopEditOfferRoomView
  ) {}

  registerRoutes(router: MessageRouter): void {
    router.register(
      MessageType.WORKSHOP_REQUEST_EARLIER_TURNS,
      this.handleRequestEarlierTurns.bind(this)
    );
  }

  async handleRequestEarlierTurns(message: WorkshopRequestEarlierTurnsMessage): Promise<void> {
    const payload = message.payload;
    const requestId = boundedId(payload?.requestId, REQUEST_ID_CHARACTERS);
    if (requestId === undefined) {
      // With no id to echo, no hook could take the answer.
      this.outputChannel.appendLine('[WorkshopEarlierTurnsHandler] Earlier turns refused (reason=malformed, requestId=none)');
      return;
    }
    const roomRevision = Number.isSafeInteger(payload.roomRevision) ? payload.roomRevision : -1;
    const beforeTurnId = boundedId(payload.beforeTurnId, TURN_ID_CHARACTERS);
    const targetTurnId = payload.targetTurnId === undefined
      ? undefined
      : boundedId(payload.targetTurnId, TURN_ID_CHARACTERS);
    const targetMalformed = payload.targetTurnId !== undefined && targetTurnId === undefined;
    if (beforeTurnId === undefined || roomRevision < 0 || targetMalformed) {
      this.refuse({ requestId, roomRevision, beforeTurnId: beforeTurnId ?? '' }, 'malformed');
      return;
    }
    const asked: Asked = { requestId, roomRevision, beforeTurnId, ...(targetTurnId !== undefined ? { targetTurnId } : {}) };
    // A room mid-swap is neither the old room nor the new one. Wait out every
    // replacement, including one queued while an earlier one ran.
    while (this.gate.isSessionOperationPending()) {
      await this.gate.waitForSessionOperations();
    }
    // The request's own room is the only one it may be answered from.
    if (this.session.readRoomRevision() !== roomRevision) {
      this.refuse(asked, 'room-changed');
      return;
    }
    if (targetTurnId !== undefined) {
      const refusal = this.targetRefusal(beforeTurnId, targetTurnId);
      if (refusal) {
        this.refuse(asked, refusal);
        return;
      }
    }
    // One room view for the whole page, as one session state reads it once.
    const room = workshopEditOfferRoomViewOnce(this.editOfferRoomView());
    const read = this.session.readEarlierTurns(beforeTurnId, {
      ...PROMPT_BUDGETS.workshopThread,
      bytesOf: (turn) => workshopTurnBytes(workshopTurnForWebview(turn, room))
    });
    if (!read) {
      this.refuse(asked, 'unknown-turn');
      return;
    }
    const turns = read.turns.map((turn) => workshopTurnForWebview(turn, room));
    const bytes = turns.reduce((total, turn) => total + workshopTurnBytes(turn), 0);
    this.outputChannel.appendLine(
      `[WorkshopEarlierTurnsHandler] Earlier turns sent (requestId=${requestId}, beforeTurnId=${beforeTurnId}, ` +
      `${targetTurnId !== undefined ? `targetTurnId=${targetTurnId}, ` : ''}turns=${turns.length}, bytes=${bytes}, remainingBefore=${read.remainingBefore})`
    );
    this.post({ ...asked, page: { ...read, turns } });
  }

  /** Why a jump's page is refused, before the page is read; undefined when it may be read. */
  private targetRefusal(beforeTurnId: string, targetTurnId: string): Refusal | undefined {
    const distance = this.session.readTurnsBackTo(beforeTurnId, targetTurnId);
    if (distance.kind !== 'turns') {
      return distance.kind;
    }
    if (distance.turns <= 0) {
      return 'target-not-earlier';
    }
    return distance.turns > WORKSHOP_JUMP_TURNS ? 'target-too-far' : undefined;
  }

  private refuse(asked: Asked, reason: Refusal): void {
    this.outputChannel.appendLine(
      `[WorkshopEarlierTurnsHandler] Earlier turns refused (requestId=${asked.requestId}, ` +
      `beforeTurnId=${asked.beforeTurnId || 'none'}, ` +
      `${asked.targetTurnId !== undefined ? `targetTurnId=${asked.targetTurnId}, ` : ''}reason=${reason})`
    );
    this.post({ ...asked, error: REFUSAL_WORDS[reason] });
  }

  private post(payload: WorkshopEarlierTurnsPayload): void {
    const reply: WorkshopEarlierTurnsMessage = {
      type: MessageType.WORKSHOP_EARLIER_TURNS,
      source: 'extension.workshop',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(reply);
  }
}

/** An id an answer can echo: a non-empty string of bounded length. */
function boundedId(value: unknown, limit: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= limit ? value : undefined;
}
