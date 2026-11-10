/**
 * Owns the press on a reply's edit offer (ADR 2026-11-10 D3–D5, D7; epic
 * Reply Edit Actions Slice 2): `WORKSHOP_EDIT_OFFER_ACTION` in, and
 * `WORKSHOP_EDIT_OFFER_RESULT` out.
 *
 * - **A press carries ids only:** `{ requestId, roomRevision, turnId, kind }`.
 *   Everything else is read from the host's own ledger.
 * - **Before anything is awaited** (D4), in this order:
 *   1. the room's lock: the route is behind the session-operation gate, the
 *      press belongs to the room generation it was shown in, and a press
 *      during a run is refused with the reason, never queued;
 *   2. the turn is in the full ledger, and holds an offer of that kind;
 *   3. its derived status is open, or D7's rule lets it be asked again;
 *   4. file edits are still `ask`;
 *   5. the reply's author is still in the room, as host or guest.
 * - **The run is addressed to that author's own conversation,** whoever the
 *   composer points at. It rides the room's one message path
 *   (`runDirected`), so the to-do evidence, host updates, catch-up and time
 *   notice are delivered as on any message; the press adds its directive
 *   frame and takes nothing away.
 * - **The directive quotes the ledger's reply** (`buildWorkshopEditRequestFrame`),
 *   and the answer is read and completed by
 *   `completeWorkshopEditOfferRun`: cards or a host line, never the
 *   persona's prose.
 * - **A refusal adds no turn.** A stopped or failed run leaves none either,
 *   and the offer reads open again.
 * - **Answers** echo the request id and name the generation, with the
 *   writer's words (`WORKSHOP_EDIT_OFFER_REFUSAL_WORDS`).
 * - **Logs** carry turn ids, kinds, counts and reason kinds only.
 */

import type { MessageTransport } from '@handlers/MessageHandlerContracts';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { LogSink } from '@/platform';
import {
  isWorkshopEditOfferKind,
  MessageType,
  type WorkshopChatTarget,
  type WorkshopEditOfferActionMessage,
  type WorkshopEditOfferKind,
  type WorkshopEditOfferRefusal,
  type WorkshopEditOfferResultMessage,
  type WorkshopEditOfferResultPayload,
  type WorkshopFileEditsMode,
  type WorkshopTurn
} from '@messages';
import {
  workshopEditOfferAnsweredWords,
  workshopEditOfferRefusalWords,
  workshopEditOfferRequestLine
} from '@shared/constants/workshopEditOfferWords';
import {
  completeWorkshopEditOfferRun,
  workshopEditOfferRetainedReply,
  type WorkshopEditOfferRunOutcome
} from '@/application/services/workshop/fileEdits/WorkshopEditOfferAnswerCompletion';
import { workshopEditOfferMayBeAsked, workshopEditOfferStatus } from '@/application/services/workshop/fileEdits/WorkshopEditOfferStatus';
import { workshopEditOfferAnswerCheck } from '@/utils/workshopEditOfferAnswer';
import { buildWorkshopEditRequestFrame, WORKSHOP_EDIT_REQUEST_MESSAGE } from '@/utils/workshopEditRequestFrame';
import type {
  WorkshopDirectedRun,
  WorkshopDirectedRunResult,
  WorkshopMutationRouteRegistrar,
  WorkshopRoomEffects
} from '@handlers/domain/workshop/WorkshopRouteContracts';
import { workshopMemoryRequestIdOf as requestIdOf } from '@handlers/domain/workshop/WorkshopProjectMemoryRefusals';

/** The room facts a press reads, and the one message path it runs on. */
export interface WorkshopEditOfferRoomGate {
  /** Any run going in the room: a reply, or the context wizard. */
  activeRunLabel(): string | undefined;
  fileEditsMode(): WorkshopFileEditsMode;
  /** A turn's time as the room shows it ("2:02 pm"), in the session's timezone. */
  formatTurnTime(timestamp: number): string;
  /** Run a host-directed message to `target`'s own conversation, through the room's message path. */
  runDirected(target: WorkshopChatTarget, run: WorkshopDirectedRun): Promise<WorkshopDirectedRunResult>;
}

type Ids = Pick<WorkshopEditOfferResultPayload, 'roomRevision' | 'turnId' | 'kind'>;

const LOG = '[WorkshopEditOfferHandler]';

export class WorkshopEditOfferHandler {
  constructor(
    private readonly session: WorkshopSessionService,
    private readonly room: WorkshopEditOfferRoomGate,
    private readonly effects: Pick<WorkshopRoomEffects, 'reportError'>,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {}

  registerRoutes(registerMutation: WorkshopMutationRouteRegistrar): void {
    registerMutation(MessageType.WORKSHOP_EDIT_OFFER_ACTION, this.handleAction.bind(this), undefined, (_reason, message: WorkshopEditOfferActionMessage) => {
      const press = pressOf(message.payload);
      if (press) {
        this.refuse(press.requestId, press.ids, 'session-operation');
      }
    });
  }

  async handleAction(message: WorkshopEditOfferActionMessage): Promise<void> {
    const press = pressOf(message.payload);
    if (!press) {
      this.effects.reportError(workshopEditOfferRefusalWords('invalid-request'));
      return;
    }
    // Nothing is awaited until the run is handed to the room.
    const { requestId, ids } = press;
    const prepared = this.prepare(ids);
    if (typeof prepared === 'string') {
      this.refuse(requestId, ids, prepared);
      return;
    }
    const { turn, offer, target, label } = prepared;
    let outcome: WorkshopEditOfferRunOutcome | undefined;
    const request = { sourceTurnId: turn.id, kind: ids.kind };
    const sourceAt = this.room.formatTurnTime(turn.timestamp);
    this.log(`press taken turn=${turn.id} kind=${ids.kind} author=${target.kind} count=${offer.count ?? 'none'}`);
    const ran = await this.room.runDirected(target, {
      editOfferRequest: request,
      displayText: workshopEditOfferRequestLine(label, ids.kind),
      message: WORKSHOP_EDIT_REQUEST_MESSAGE,
      // Built from the ledger's turn, never from anything the press carried (D4).
      frame: buildWorkshopEditRequestFrame({ turn, at: sourceAt, offer }),
      finalReply: {
        check: workshopEditOfferAnswerCheck,
        retained: (reply) => workshopEditOfferRetainedReply(ids.kind, reply)
      },
      complete: (input) => completeWorkshopEditOfferRun(input, {
        request,
        offer,
        sourceAt,
        fileEditsOpen: () => this.room.fileEditsMode() === 'ask',
        settled: (settled) => {
          outcome = settled;
        }
      })
    });
    if (outcome?.kind === 'answered') {
      const answer = outcome.turn.editOfferAnswer;
      const proposed = answer?.outcome === 'proposed';
      this.post(requestId, {
        ...ids,
        answer: 'answered',
        answerTurnId: outcome.turn.id,
        outcome: proposed ? 'proposed' : 'none',
        ...(proposed ? { cards: outcome.cards, changes: outcome.changes } : {})
      }, workshopEditOfferAnsweredWords(label, ids.kind, proposed
        ? { outcome: 'proposed', changes: outcome.changes, relativePath: offer.target.relativePath }
        : { outcome: 'none' }));
      this.log(`press answered turn=${turn.id} kind=${ids.kind} answer=${outcome.turn.id} outcome=${proposed ? 'proposed' : 'none'} ` +
        `cards=${outcome.cards} changes=${outcome.changes}`);
      return;
    }
    // The run left no turns: completion said why, or the room's message path did.
    const reason: WorkshopEditOfferRefusal = outcome?.reason ?? (ran.cancelled ? 'stopped' : ran.refusalReason !== undefined ? 'not-sent' : 'failed');
    this.post(requestId, { ...ids, answer: 'failed', reason }, workshopEditOfferRefusalWords(reason));
    this.log(`press failed turn=${turn.id} kind=${ids.kind} reason=${reason}`);
  }

  /** D4's checks, in order, with nothing awaited: the press as the ledger holds it, or why it is refused. */
  private prepare(ids: Ids): WorkshopEditOfferRefusal | {
    turn: WorkshopTurn;
    offer: NonNullable<WorkshopTurn['editOffers']>[number];
    target: WorkshopChatTarget;
    label: string;
  } {
    if (ids.roomRevision !== this.session.readRoomRevision()) {
      return 'room-changed';
    }
    if (this.room.activeRunLabel() !== undefined) {
      return 'run-active';
    }
    const ledger = this.session.readRoomLedger();
    const turn = ledger.find((candidate) => candidate.id === ids.turnId);
    if (!turn) {
      return 'no-turn';
    }
    const offer = turn.editOffers?.find((candidate) => candidate.kind === ids.kind);
    if (!offer) {
      return 'no-offer';
    }
    if (!workshopEditOfferMayBeAsked(workshopEditOfferStatus(ledger, turn.id, ids.kind, { runActive: false }))) {
      return 'already-answered';
    }
    if (this.room.fileEditsMode() !== 'ask') {
      return 'file-edits-off';
    }
    const target = workshopEditOfferAuthorTarget(this.session, turn);
    return target && turn.personaLabel ? { turn, offer, target, label: turn.personaLabel } : 'author-left';
  }

  private refuse(requestId: string, ids: Ids, reason: WorkshopEditOfferRefusal): void {
    this.post(requestId, { ...ids, answer: 'refused', reason }, workshopEditOfferRefusalWords(reason));
    this.log(`press refused turn=${ids.turnId} kind=${ids.kind} reason=${reason}`);
  }

  private post(requestId: string, answer: Omit<WorkshopEditOfferResultPayload, 'requestId' | 'message'>, message: string): void {
    const reply: WorkshopEditOfferResultMessage = {
      type: MessageType.WORKSHOP_EDIT_OFFER_RESULT,
      source: 'extension.workshop',
      payload: { requestId, ...answer, message },
      timestamp: Date.now()
    };
    void this.postMessage(reply);
  }

  private log(line: string): void {
    this.outputChannel.appendLine(`${LOG} ${line}`);
  }
}

/**
 * The conversation of the persona who wrote a reply, while they are still in
 * the room: the host's when the reply is the selected host's, a guest's when
 * that guest is live. Undefined when its author left.
 */
export function workshopEditOfferAuthorTarget(
  session: Pick<WorkshopSessionService, 'getSelectedPersonaId' | 'isLivePersonaGuest'>,
  turn: Pick<WorkshopTurn, 'participant' | 'personaId'>
): WorkshopChatTarget | undefined {
  if (!turn.personaId) {
    return undefined;
  }
  if (turn.participant === 'host') {
    return session.getSelectedPersonaId() === turn.personaId ? { kind: 'host' } : undefined;
  }
  return turn.participant === 'guest' && session.isLivePersonaGuest(turn.personaId)
    ? { kind: 'personaGuest', personaId: turn.personaId }
    : undefined;
}

function pressOf(payload: { requestId?: unknown; roomRevision?: unknown; turnId?: unknown; kind?: unknown } | undefined):
  { requestId: string; ids: Ids } | undefined {
  const requestId = requestIdOf(payload);
  if (!requestId || typeof payload?.turnId !== 'string' || !Number.isSafeInteger(payload.roomRevision) || !isWorkshopEditOfferKind(payload.kind)) {
    return undefined;
  }
  return { requestId, ids: { roomRevision: payload.roomRevision as number, turnId: payload.turnId, kind: payload.kind as WorkshopEditOfferKind } };
}
