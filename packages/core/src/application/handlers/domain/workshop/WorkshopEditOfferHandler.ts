/**
 * Owns the press on a reply's edit offer (ADR 2026-11-10 D3–D5, D7; epic
 * Reply Edit Actions Slice 2): `WORKSHOP_EDIT_OFFER_ACTION` in, and
 * `WORKSHOP_EDIT_OFFER_RESULT` out.
 *
 * - **A press carries ids only:** `{ requestId, roomRevision, turnId, kind, option? }`.
 *   `option` is an index into the stored offer's options (second addendum):
 *   required when the offer has them, refused otherwise (`no-offer`).
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
 *   and the offer reads open again. It leaves nothing in the persona's
 *   retained history: the engine holds the run's exchange, and completion
 *   commits it only when it adopts the answer (PR #252 R1).
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
  workshopEditOfferOptionFits,
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
import { AGENT_FINAL_REPLY_REFUSED, type AgentFinalReplyCheck, type AgentFinalReplyFacts } from '@orchestration/AgentRunContracts';
import { workshopEditOfferAnswerVerdict } from '@/utils/workshopEditOfferAnswer';
import { buildWorkshopEditRequestFrame, WORKSHOP_EDIT_REQUEST_CORRECTION, WORKSHOP_EDIT_REQUEST_MESSAGE } from '@/utils/workshopEditRequestFrame';
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

type Ids = Pick<WorkshopEditOfferResultPayload, 'roomRevision' | 'turnId' | 'kind' | 'option'>;

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
    // The engine holds the run's exchange until the answer is adopted (PR #252 R1): a press that fails after the
    // reply ended (stopped, or file edits turned off, while its edits are staged) never retained anything.
    let commitRetained: (() => boolean) | undefined;
    const request = { sourceTurnId: turn.id, kind: ids.kind, ...(ids.option !== undefined ? { option: ids.option } : {}) };
    // The chosen version's label is the host's stored copy, read from the ledger's offer by the press's index.
    const optionLabel = ids.option !== undefined ? offer.options?.[ids.option] : undefined;
    const sourceAt = this.room.formatTurnTime(turn.timestamp);
    this.log(`press taken turn=${turn.id} kind=${ids.kind} option=${ids.option ?? 'none'} author=${target.kind} count=${offer.count ?? 'none'}`);
    const ran = await this.room.runDirected(target, {
      editOfferRequest: request,
      displayText: workshopEditOfferRequestLine(label, ids.kind, optionLabel),
      message: WORKSHOP_EDIT_REQUEST_MESSAGE,
      // Built from the ledger's turn, never from anything the press carried (D4).
      frame: buildWorkshopEditRequestFrame({ turn, at: sourceAt, offer, ...(optionLabel !== undefined ? { option: optionLabel } : {}) }),
      finalReply: {
        check: (reply, facts) => this.checkAnswer(reply, facts),
        retained: (reply) => workshopEditOfferRetainedReply(ids.kind, reply),
        deferRetention: (commit) => {
          commitRetained = commit;
        }
      },
      // An excerpt offer keeps the document it was bound to (D2; PR #252 F-03), whatever the room's excerpt is now.
      ...(offer.target.kind === 'excerpt' && offer.target.documentUri
        ? { boundExcerpt: { kind: 'excerpt' as const, documentUri: offer.target.documentUri, relativePath: offer.target.relativePath } }
        : {}),
      complete: (input) => completeWorkshopEditOfferRun(input, {
        request,
        offer,
        ...(optionLabel !== undefined ? { optionLabel } : {}),
        sourceAt,
        fileEditsOpen: () => this.room.fileEditsMode() === 'ask',
        commitRetained: () => commitRetained?.() ?? true,
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
        : { outcome: 'none' }, optionLabel));
      this.log(`press answered turn=${turn.id} kind=${ids.kind} option=${ids.option ?? 'none'} answer=${outcome.turn.id} outcome=${proposed ? 'proposed' : 'none'} ` +
        `cards=${outcome.cards} changes=${outcome.changes}`);
      return;
    }
    // The run left no turns: completion said why, or the room's message path did.
    const reason: WorkshopEditOfferRefusal = outcome?.reason ?? (ran.cancelled ? 'stopped' : ran.refusalReason !== undefined ? 'not-sent' : 'failed');
    this.post(requestId, { ...ids, answer: 'failed', reason }, workshopEditOfferRefusalWords(reason));
    this.log(`press failed turn=${turn.id} kind=${ids.kind} option=${ids.option ?? 'none'} reason=${reason}`);
  }

  /**
   * The engine's check of a press's final reply (D5; PR #252 F-01): what
   * completion would fail is refused or corrected here, before the engine
   * retains anything. File edits turned off during the run refuse it too.
   */
  private checkAnswer(reply: string, facts: AgentFinalReplyFacts): ReturnType<AgentFinalReplyCheck> {
    const verdict = this.room.fileEditsMode() === 'ask' ? workshopEditOfferAnswerVerdict(reply, facts) : 'refuse';
    return verdict === 'refuse' ? AGENT_FINAL_REPLY_REFUSED : verdict === 'correct' ? WORKSHOP_EDIT_REQUEST_CORRECTION : undefined;
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
    // An offer with options is pressed one version at a time; one without takes no option.
    if (!offer || !workshopEditOfferOptionFits(offer, ids.option)) {
      return 'no-offer';
    }
    if (!workshopEditOfferMayBeAsked(workshopEditOfferStatus(ledger, turn.id, ids.kind, { runActive: false }, ids.option))) {
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
    this.log(`press refused turn=${ids.turnId} kind=${ids.kind} option=${ids.option ?? 'none'} reason=${reason}`);
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

function pressOf(payload: { requestId?: unknown; roomRevision?: unknown; turnId?: unknown; kind?: unknown; option?: unknown } | undefined):
  { requestId: string; ids: Ids } | undefined {
  const requestId = requestIdOf(payload);
  if (!requestId || typeof payload?.turnId !== 'string' || !Number.isSafeInteger(payload.roomRevision) || !isWorkshopEditOfferKind(payload.kind)) {
    return undefined;
  }
  const option = payload.option;
  if (option !== undefined && (typeof option !== 'number' || !Number.isSafeInteger(option) || option < 0)) {
    return undefined;
  }
  return {
    requestId,
    ids: {
      roomRevision: payload.roomRevision as number,
      turnId: payload.turnId,
      kind: payload.kind as WorkshopEditOfferKind,
      ...(option !== undefined ? { option } : {})
    }
  };
}
