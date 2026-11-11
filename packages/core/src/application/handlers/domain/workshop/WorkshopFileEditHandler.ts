/**
 * Owns a persona file-edit card's routes (ADR 2026-11-05 D8, D9, D10; epic
 * Slice 4a): Apply, Review in editor…, Decline, and a rewrite's Preview.
 *
 * - **The claim** (D8). When an Apply or Review arrives, before anything is
 *   awaited, the handler captures the room generation (`readRoomRevision()`)
 *   and takes a claim keyed by `(generation, turnId, index)`. A second Apply
 *   or Review of the card while it is held, with the same or another request
 *   id, joins it: each request gets the one outcome. Decline while claimed
 *   is answered `held` (`applying`), and nothing changes.
 * - **Operations come from the stored card,** never the request; a request
 *   names only its card. A card that has settled replays its state and
 *   writes nothing.
 * - **`applying` is durable before the write.** The card is set `applying`,
 *   then `checkpointFileEdit` must answer `{ ok: true }` (every recoverable
 *   checkpoint read back holding it). Anything else returns the card to
 *   `pending` and writes nothing.
 * - **A transient refusal returns the card to `pending`** (D8, amended
 *   2026-11-06): `catalog-unreadable` at Apply and `host-failed`, which the
 *   gateway gives only when nothing was written. The answer carries the
 *   reason, so the writer reads why beside an Apply offered again.
 * - **The boundary.** The gateway calls `stillCurrent()` at its last
 *   dispatch boundary and before every attempt: this claim is still held,
 *   the generation is unchanged, and the setting is still `ask`.
 * - **Outcomes belong to their generation.** An outcome that lands after the
 *   room was replaced is logged (counts) and dropped; the durable `applying`
 *   reads as `unknown` when that session is reopened.
 * - **Shutdown.** Claims are never awaited: a review may wait on the writer
 *   indefinitely.
 * - **Answers** echo each request id and name the generation they belong to,
 *   with the writer's words (`workshopFileEditCardWords`); never a path,
 *   URI or the file's text, except a rewrite's preview, which is the card's
 *   own before and after.
 * - **Logs** carry turn ids, indexes, states and reason kinds only.
 */

import type { MessageRouter } from '@handlers/MessageRouter';
import type { MessageTransport } from '@handlers/MessageHandlerContracts';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { LogSink } from '@/platform';
import type { FileEditApplyPort } from '@/domain/models/FileEdit';
import {
  MessageType,
  type WorkshopFileEditActionMessage,
  type WorkshopFileEditPreview,
  type WorkshopFileEditPreviewRequestMessage,
  type WorkshopFileEditPreviewResultMessage,
  type WorkshopFileEditProposal,
  type WorkshopFileEditResultMessage,
  type WorkshopFileEditResultPayload,
  type WorkshopFileEditsMode,
  type WorkshopFileEditState
} from '@messages';
import { workshopFileEditCardWords, workshopFileEditReasonWords } from '@shared/constants/workshopFileEditWords';
import type { WorkshopFileEditCheckpointPort } from '@/application/services/workshop/fileEdits/WorkshopFileEditCheckpoint';
import {
  WORKSHOP_FILE_EDIT_UNKNOWN_REASON,
  workshopFileEditRetryReasonOf,
  workshopFileEditSettlementOf,
  workshopStagedFileEditOf
} from '@/application/services/workshop/fileEdits/WorkshopFileEditSettlements';
import {
  workshopFileEditProposalAt,
  type WorkshopFileEditSettlement
} from '@/application/services/workshop/session/WorkshopFileEditProposalRecords';
import type { WorkshopMutationRouteRegistrar, WorkshopRoomEffects } from '@handlers/domain/workshop/WorkshopRouteContracts';
import { workshopMemoryRequestIdOf as requestIdOf } from '@handlers/domain/workshop/WorkshopProjectMemoryRefusals';

/** The room facts an action reads: is a reply running, and the setting as it stands now. */
export interface WorkshopFileEditRoomGate {
  isRoomRunActive(): boolean;
  fileEditsMode(): WorkshopFileEditsMode;
}

type Effects = Pick<WorkshopRoomEffects, 'postSessionState' | 'markDirty' | 'reportError'>;
type Answer = Omit<WorkshopFileEditResultPayload, 'requestId' | 'message'>;

/** One card's claim: the requests that share its outcome. */
interface Claim {
  readonly requestIds: string[];
}

const ACTIONS: readonly string[] = ['apply', 'review', 'decline'];
const LOG = '[WorkshopFileEditHandler]';

export class WorkshopFileEditHandler {
  private readonly claims = new Map<string, Claim>();

  constructor(
    private readonly session: WorkshopSessionService,
    private readonly gateway: FileEditApplyPort,
    private readonly checkpoint: WorkshopFileEditCheckpointPort,
    private readonly room: WorkshopFileEditRoomGate,
    private readonly effects: Effects,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {}

  registerRoutes(router: MessageRouter, registerMutation: WorkshopMutationRouteRegistrar): void {
    registerMutation(MessageType.WORKSHOP_FILE_EDIT_ACTION, this.handleAction.bind(this), undefined, (_reason, message: WorkshopFileEditActionMessage) => {
      const card = this.cardOf(message.payload);
      if (card) {
        this.answer(card.requestId, { ...card.ids, answer: 'refused', reason: 'session-operation' }, 'action refused reason=session-operation');
      }
    });
    // A read: its only change is a stale mark, made only while its room stands.
    router.register(MessageType.WORKSHOP_FILE_EDIT_PREVIEW, this.handlePreview.bind(this));
  }

  /** Whether a card's claim is held now (for tests and the room's diagnostics). */
  isClaimed(generation: number, turnId: string, index: number): boolean {
    return this.claims.has(claimKey(generation, turnId, index));
  }

  async handleAction(message: WorkshopFileEditActionMessage): Promise<void> {
    const card = this.cardOf(message.payload);
    const action = message.payload?.action;
    if (!card || !ACTIONS.includes(action)) {
      this.effects.reportError('A file edit action must name its request, its room, a turn, a card and an action');
      return;
    }
    // Nothing is awaited until the claim is taken.
    const { requestId, ids } = card;
    const generation = this.session.readRoomRevision();
    const where = `turn=${ids.turnId} index=${ids.index}`;
    if (ids.roomRevision !== generation) {
      this.answer(requestId, { ...ids, answer: 'room-changed', reason: 'room-changed' }, `${action} refused ${where} reason=room-changed`);
      return;
    }
    const key = claimKey(generation, ids.turnId, ids.index);
    const claim = this.claims.get(key);
    if (claim && action === 'decline') {
      this.answer(requestId, { ...ids, answer: 'held', state: 'applying', reason: 'applying' }, `decline held ${where}`);
      return;
    }
    if (claim) {
      claim.requestIds.push(requestId);
      this.log(`${action} joined ${where} requests=${claim.requestIds.length}`);
      return;
    }
    const proposal = this.proposalAt(ids.turnId, ids.index);
    if (!proposal) {
      this.answer(requestId, { ...ids, answer: 'no-card', reason: 'no-card' }, `${action} refused ${where} reason=no-card`);
      return;
    }
    if (proposal.state !== 'pending') {
      this.answer(requestId, { ...ids, answer: 'replayed', state: proposal.state, ...(proposal.reason ? { reason: proposal.reason } : {}) },
        `${action} replayed ${where} state=${proposal.state}`, proposal.outcomes);
      return;
    }
    if (action === 'decline') {
      this.settle(ids.turnId, ids.index, { state: 'declined' }, 'file edit declined');
      this.answer(requestId, { ...ids, answer: 'settled', state: 'declined' }, `decline ${where}`);
      return;
    }
    const refusal = this.room.fileEditsMode() !== 'ask' ? 'file-edits-off' : this.room.isRoomRunActive() ? 'run-active' : undefined;
    const staged = workshopStagedFileEditOf(ids.turnId, ids.index, proposal);
    if (refusal || !staged) {
      const reason = refusal ?? 'no-card';
      this.answer(requestId, { ...ids, answer: 'refused', state: 'pending', reason }, `${action} refused ${where} reason=${reason}`);
      return;
    }
    const held: Claim = { requestIds: [requestId] };
    this.claims.set(key, held);
    try {
      await this.apply(held, generation, ids, action === 'review' ? 'preview' : 'direct', staged);
    } finally {
      if (this.claims.get(key) === held) {
        this.claims.delete(key);
      }
    }
  }

  private async apply(
    held: Claim,
    generation: number,
    ids: Pick<Answer, 'roomRevision' | 'turnId' | 'index'>,
    review: 'direct' | 'preview',
    staged: NonNullable<ReturnType<typeof workshopStagedFileEditOf>>
  ): Promise<void> {
    const { turnId, index } = ids;
    const where = `turn=${turnId} index=${index}`;
    const key = claimKey(generation, turnId, index);
    const sameRoom = () => this.session.readRoomRevision() === generation;
    this.session.setFileEditProposalState(turnId, index, { state: 'applying' });
    this.effects.postSessionState();

    const checkpoint = await this.checkpoint.checkpointFileEdit(generation, turnId, index);
    if (!checkpoint.ok) {
      // Best effort: a card left `applying` on disk reads as unknown when reopened, which is safe.
      const restored = sameRoom() && this.proposalAt(turnId, index)?.state === 'applying';
      if (restored) {
        this.settle(turnId, index, { state: 'pending' }, 'file edit checkpoint refused');
      }
      this.answerAll(held, restored || sameRoom()
        ? { ...ids, answer: 'refused', state: 'pending', reason: checkpoint.reason }
        : { ...ids, answer: 'room-changed', reason: 'room-changed' },
      `${review} refused ${where} reason=${checkpoint.reason}`);
      return;
    }

    const stillCurrent = () => this.claims.get(key) === held && sameRoom() && this.room.fileEditsMode() === 'ask';
    let settlement: WorkshopFileEditSettlement;
    let retryReason: string | undefined;
    try {
      const outcome = await this.gateway.apply(staged, { review, stillCurrent });
      settlement = workshopFileEditSettlementOf(outcome);
      retryReason = workshopFileEditRetryReasonOf(outcome);
    } catch {
      // The gateway never rejects; if it did, nothing says whether it wrote.
      settlement = { state: 'unknown', reason: WORKSHOP_FILE_EDIT_UNKNOWN_REASON, outcomes: staged.operations.map(() => 'unknown' as const) };
    }
    if (!sameRoom()) {
      this.log(`${review} outcome dropped ${where} state=${settlement.state} reason=room-changed`);
      this.answerAll(held, { ...ids, answer: 'room-changed', reason: 'room-changed' }, `${review} answered ${where} room-changed`);
      return;
    }
    const recorded = this.record(turnId, index, settlement, staged.operations.length);
    if (!recorded) {
      this.answerAll(held, { ...ids, answer: 'no-card', reason: 'no-card' }, `${review} outcome dropped ${where} reason=no-card`);
      return;
    }
    // A pending card stores no reason; a transient refusal's rides on the answer alone.
    const reason = recorded.reason ?? (recorded.state === 'pending' ? retryReason : undefined);
    this.answerAll(held, { ...ids, answer: 'settled', state: recorded.state, ...(reason ? { reason } : {}) },
      `${review} settled ${where} state=${recorded.state}${reason ? ` reason=${reason}` : ''} ` +
      `landed=${recorded.outcomes?.filter((each) => each === 'landed').length ?? 0}`, recorded.outcomes);
  }

  /** The outcome on the card; one the codec refuses is held as unknown, never lost. */
  private record(turnId: string, index: number, settlement: WorkshopFileEditSettlement, operations: number): WorkshopFileEditSettlement | undefined {
    try {
      this.settle(turnId, index, settlement, 'file edit settled');
      return settlement;
    } catch (error) {
      if ((error as { reason?: string }).reason === 'no-card') {
        return undefined;
      }
      this.log(`outcome refused by the session codec turn=${turnId} index=${index} state=${settlement.state}; held as unknown`);
      const unknown: WorkshopFileEditSettlement = {
        state: 'unknown',
        reason: WORKSHOP_FILE_EDIT_UNKNOWN_REASON,
        outcomes: Array.from({ length: operations }, () => 'unknown' as const)
      };
      this.settle(turnId, index, unknown, 'file edit settled');
      return unknown;
    }
  }

  async handlePreview(message: WorkshopFileEditPreviewRequestMessage): Promise<void> {
    const card = this.cardOf(message.payload);
    if (!card) {
      this.effects.reportError('A file edit preview must name its request, its room, a turn and a card');
      return;
    }
    const { requestId, ids } = card;
    const where = `turn=${ids.turnId} index=${ids.index}`;
    const generation = this.session.readRoomRevision();
    const refused = (reason: string): WorkshopFileEditPreview => ({ kind: 'refused', reason, message: workshopFileEditReasonWords(reason) });
    if (ids.roomRevision !== generation) {
      this.answerPreview(requestId, ids, refused('room-changed'), `preview refused ${where} reason=room-changed`);
      return;
    }
    const proposal = this.proposalAt(ids.turnId, ids.index);
    const staged = proposal ? workshopStagedFileEditOf(ids.turnId, ids.index, proposal) : undefined;
    if (!staged) {
      this.answerPreview(requestId, ids, refused('no-card'), `preview refused ${where} reason=no-card`);
      return;
    }
    const preview = await this.gateway.preview(staged);
    if (this.session.readRoomRevision() !== generation) {
      this.answerPreview(requestId, ids, refused('room-changed'), `preview refused ${where} reason=room-changed`);
      return;
    }
    if (preview.kind === 'rewrite') {
      this.answerPreview(requestId, ids, preview, `preview sent ${where}`);
      return;
    }
    if (preview.kind === 'stale' && this.proposalAt(ids.turnId, ids.index)?.state === 'pending'
      && !this.claims.has(claimKey(generation, ids.turnId, ids.index))) {
      this.settle(ids.turnId, ids.index, { state: 'stale', reason: preview.reason }, 'file edit stale');
    }
    this.answerPreview(requestId, ids, { kind: preview.kind, reason: preview.reason, message: workshopFileEditReasonWords(preview.reason) } as WorkshopFileEditPreview,
      `preview ${preview.kind} ${where} reason=${preview.reason}`);
  }

  private cardOf(payload: { requestId?: unknown; roomRevision?: unknown; turnId?: unknown; index?: unknown } | undefined):
    { requestId: string; ids: Pick<Answer, 'roomRevision' | 'turnId' | 'index'> } | undefined {
    const requestId = requestIdOf(payload);
    if (!requestId || typeof payload?.turnId !== 'string' || !Number.isSafeInteger(payload.index) || (payload.index as number) < 0
      || !Number.isSafeInteger(payload.roomRevision)) {
      return undefined;
    }
    return { requestId, ids: { roomRevision: payload.roomRevision as number, turnId: payload.turnId, index: payload.index as number } };
  }

  private proposalAt(turnId: string, index: number): WorkshopFileEditProposal | undefined {
    return workshopFileEditProposalAt(this.session.readRoomLedger().find((turn) => turn.id === turnId), index);
  }

  private settle(turnId: string, index: number, settlement: WorkshopFileEditSettlement, reason: string): void {
    this.session.setFileEditProposalState(turnId, index, settlement);
    this.effects.markDirty(reason);
    this.effects.postSessionState();
  }

  /** `outcomes` only words the answer (a partial card's line reads them); they are not posted. */
  private answerAll(held: Claim, answer: Answer, line: string, outcomes?: readonly string[]): void {
    this.log(`${line} requests=${held.requestIds.length}`);
    held.requestIds.forEach((requestId, at) =>
      this.post(requestId, at === 0 || answer.answer !== 'settled' ? answer : { ...answer, answer: 'joined' }, outcomes));
  }

  private answer(requestId: string, answer: Answer, line: string, outcomes?: readonly string[]): void {
    this.log(line);
    this.post(requestId, answer, outcomes);
  }

  private post(requestId: string, answer: Answer, outcomes?: readonly string[]): void {
    const reply: WorkshopFileEditResultMessage = {
      type: MessageType.WORKSHOP_FILE_EDIT_RESULT,
      source: 'extension.workshop',
      payload: { requestId, ...answer, message: wordsOf(answer, outcomes) },
      timestamp: Date.now()
    };
    void this.postMessage(reply);
  }

  private answerPreview(requestId: string, ids: Pick<Answer, 'roomRevision' | 'turnId' | 'index'>, preview: WorkshopFileEditPreview, line: string): void {
    this.log(line);
    const reply: WorkshopFileEditPreviewResultMessage = {
      type: MessageType.WORKSHOP_FILE_EDIT_PREVIEW_RESULT,
      source: 'extension.workshop',
      payload: { requestId, ...ids, preview },
      timestamp: Date.now()
    };
    void this.postMessage(reply);
  }

  private log(line: string): void {
    this.outputChannel.appendLine(`${LOG} ${line}`);
  }
}

function claimKey(generation: number, turnId: string, index: number): string {
  return JSON.stringify([generation, turnId, index]);
}

/** An answer in the writer's words: the card's line when it names a state, else its reason's. */
function wordsOf(answer: Answer, outcomes?: readonly string[]): string {
  const state: WorkshopFileEditState | undefined = answer.state;
  if (answer.answer === 'refused' || answer.answer === 'held' || state === undefined) {
    return workshopFileEditReasonWords(answer.reason);
  }
  return workshopFileEditCardWords(state, answer.reason, outcomes);
}
