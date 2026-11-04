/**
 * Owns project memory's write routes (ADR 2026-11-04 D6, D7, D8, D13; epic
 * Slice 3; PR #192 F-03): a card's Save, Edit-then-Save, Dismiss and Show it
 * again; "Save to memory…" on an eligible bubble; New memory; Edit; and
 * Forget or Restore from a receipt. Slice 4b's manager reuses them and adds
 * only pin, archive and delete.
 *
 * - **The writer acts.** Nothing is saved without one of these routes. Under
 *   `auto` a proposal waits as under `ask` until Slice 5. Memory Off doesn't
 *   stop a write: a card pending from before the switch keeps its Save (D8).
 * - **Behind the gate.** Every route that changes the room is registered
 *   behind the shared session-operation gate. A write the library awaits
 *   then waits out any room replacement queued meanwhile, and records its
 *   receipt only in the room it was asked in: a room replaced mid-write
 *   keeps the memory and gets no receipt, logged.
 * - **Not mid-reply.** A save is refused while a reply is running, so a
 *   receipt never lands between a writer's message and its reply.
 * - **Receipts** (D7): a save, an edit of what a memory says, a Forget and a
 *   Restore each append a session divider every participant receives. A
 *   load-in-full toggle alone, or an edit that changed nothing, leaves none.
 * - **Answers.** Each request carries a webview-minted id the host echoes, so
 *   the sheet keeps the writer's draft until it knows (as the bookmark
 *   rename does). A refusal names no memory text.
 * - **Logs** carry turn and memory ids, actions and reasons; never a title,
 *   summary or body.
 */

import { MessageRouter } from '@handlers/MessageRouter';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { LogSink } from '@/platform';
import {
  MessageType,
  type WorkshopMemoryDraft,
  type WorkshopMemoryEditDataMessage,
  type WorkshopMemoryEditDataPayload,
  type WorkshopMemoryEstimateMessage,
  type WorkshopMemoryEstimateResultMessage,
  type WorkshopMemoryEstimateResultPayload,
  type WorkshopMemoryForgetMessage,
  type WorkshopMemoryCreateMessage,
  type WorkshopMemoryProposalActionMessage,
  type WorkshopMemoryRequestEditMessage,
  type WorkshopMemoryUpdateMessage,
  type WorkshopMemoryWriteResultMessage,
  type WorkshopMemoryWriteResultPayload,
  type WorkshopSaveTurnToMemoryMessage,
  type WorkshopTurn
} from '@messages';
import { isWorkshopBookmarkableTurn } from '@shared/constants/workshopBookmarks';
import {
  checkWorkshopMemoryDraft,
  WORKSHOP_MEMORY_DRAFT_FAULTS,
  workshopMemoryPinnedRefusal
} from '@shared/constants/workshopProjectMemoryWrites';
import type { ProjectMemoryLibrary } from '@/application/services/workshop/memory/ProjectMemoryLibrary';
import type {
  ProjectMemorySaveProvenance,
  ProjectMemoryWriteRefusalReason,
  ProjectMemoryWriteResult
} from '@/application/services/workshop/memory/ProjectMemoryWrites';
import type {
  WorkshopMutationRouteRegistrar,
  WorkshopRoomEffects
} from '@handlers/domain/workshop/WorkshopRouteContracts';
import { PROJECT_MEMORY_SOURCE_TURN } from '@shared/types/projectMemory';

/** The library's write half, as the handler reaches it; satisfied by ProjectMemoryLibrary. */
export type WorkshopProjectMemoryWritePort = Pick<
  ProjectMemoryLibrary,
  'save' | 'update' | 'forget' | 'restore' | 'editData' | 'estimatePinned'
>;

/** The room facts a write needs: is a reply running, and which room is this. */
export interface WorkshopProjectMemoryRoomGate {
  isRoomRunActive(): boolean;
  isSessionOperationPending(): boolean;
  waitForSessionOperations(): Promise<void>;
  /** The live session's id, for a memory's `source-session` (D6), when the room has one. */
  liveSessionId(): string | undefined;
}

type Effects = Pick<WorkshopRoomEffects, 'postSessionState' | 'markDirty' | 'reportError'>;

const LOG = '[WorkshopProjectMemoryHandler]';
const REQUEST_ID_CHARACTERS = 128;

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the library's kebab-case reasons. */
const REFUSALS: Readonly<Record<Exclude<ProjectMemoryWriteRefusalReason, 'pinned-budget'>, string>> = {
  off: 'Project memory is off.',
  'no-workspace': 'Project memory isn\'t available here: no folder is open.',
  'multi-root': 'Project memory isn\'t available here: this workspace has several folders.',
  'workspace-changed': 'The workspace changed since this room opened, so its memory can\'t be saved here.',
  'not-ready': 'Wait for the room to finish loading, then try again.',
  unknown: 'The memory folder couldn\'t be read. Try again.',
  missing: 'That memory is no longer in the folder.',
  busy: 'Another window is editing that memory. Try again in a moment.',
  conflict: 'Two files hold that memory\'s id. Fix one in the editor first.',
  invalid: 'That memory can\'t be saved as written. Check its title, summary and note.',
  failed: 'The memory couldn\'t be saved. Try again.'
};
/* eslint-enable @typescript-eslint/naming-convention */

const RUN_ACTIVE = 'Wait for the reply to finish, then save to memory.';
const NO_CARD = 'That message no longer holds a memory suggestion.';
const NOT_ELIGIBLE = 'That message can\'t be saved to memory.';
const ROOM_CHANGED = 'The room changed before this could be recorded here.';

export class WorkshopProjectMemoryHandler {
  constructor(
    private readonly session: WorkshopSessionService,
    private readonly library: WorkshopProjectMemoryWritePort,
    private readonly room: WorkshopProjectMemoryRoomGate,
    private readonly effects: Effects,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {}

  registerRoutes(router: MessageRouter, registerMutation: WorkshopMutationRouteRegistrar): void {
    const refuseUnderGate = (reason: string, message: { payload?: { requestId?: unknown } }) =>
      this.answerRefusal(message.payload, reason, 'session-operation');
    registerMutation(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, this.handleProposalAction.bind(this), undefined, refuseUnderGate);
    registerMutation(MessageType.WORKSHOP_SAVE_TURN_TO_MEMORY, this.handleSaveTurn.bind(this), undefined, refuseUnderGate);
    registerMutation(MessageType.WORKSHOP_MEMORY_CREATE, this.handleCreate.bind(this), undefined, refuseUnderGate);
    registerMutation(MessageType.WORKSHOP_MEMORY_UPDATE, this.handleUpdate.bind(this), undefined, refuseUnderGate);
    registerMutation(MessageType.WORKSHOP_MEMORY_FORGET, this.handleForget.bind(this), undefined, refuseUnderGate);
    // Reads: never behind the gate, never a room change.
    router.register(MessageType.WORKSHOP_MEMORY_REQUEST_EDIT, this.handleRequestEdit.bind(this));
    router.register(MessageType.WORKSHOP_MEMORY_ESTIMATE, this.handleEstimate.bind(this));
  }

  async handleProposalAction(message: WorkshopMemoryProposalActionMessage): Promise<void> {
    const payload = message.payload;
    const requestId = requestIdOf(payload);
    if (!requestId || typeof payload.turnId !== 'string' || !['save', 'dismiss', 'reopen'].includes(payload.action)) {
      this.effects.reportError('A memory suggestion action must name its request, a turn and an action');
      return;
    }
    const turn = this.session.readRoomLedger().find((candidate) => candidate.id === payload.turnId);
    if (!turn?.memoryProposal) {
      this.answer({ requestId, ok: false, error: NO_CARD }, `proposal ${payload.action} refused turnId=${payload.turnId} reason=no-proposal`);
      return;
    }
    if (payload.action !== 'save') {
      if (turn.memoryProposal.state === 'saved') {
        this.answer({ requestId, ok: false, error: NO_CARD }, `proposal ${payload.action} refused turnId=${turn.id} reason=saved`);
        return;
      }
      this.session.setMemoryProposalState(turn.id, payload.action === 'dismiss' ? 'dismissed' : 'pending');
      this.settleRoom('memory suggestion settled');
      this.answer({ requestId, ok: true }, `proposal ${payload.action} turnId=${turn.id}`);
      return;
    }
    if (turn.memoryProposal.state === 'saved') {
      this.answer({ requestId, ok: true, memoryId: turn.memoryProposal.memoryId }, `proposal save unchanged turnId=${turn.id}`);
      return;
    }
    const proposal = turn.memoryProposal;
    const draft: WorkshopMemoryDraft = payload.edited ?? {
      title: proposal.title,
      kind: proposal.kind,
      summary: proposal.summary,
      body: proposal.body,
      supersedes: (proposal.supersedes ?? []).map((item) => item.id),
      pinned: false
    };
    await this.write(requestId, `proposal save turnId=${turn.id}`, draft, false, async () => {
      const result = await this.library.save(draft, this.proposalProvenance(turn));
      return { result, onRecorded: (memoryId) => this.session.setMemoryProposalState(turn.id, 'saved', memoryId), action: 'saved', proposedBy: turn.personaId };
    }, () => this.session.readRoomLedger().some((candidate) => candidate.id === turn.id && candidate.memoryProposal?.state !== 'saved'));
  }

  async handleSaveTurn(message: WorkshopSaveTurnToMemoryMessage): Promise<void> {
    const payload = message.payload;
    const requestId = requestIdOf(payload);
    if (!requestId || typeof payload.turnId !== 'string') {
      this.effects.reportError('Save to memory must name its request and a turn');
      return;
    }
    const turn = this.session.readRoomLedger().find((candidate) => candidate.id === payload.turnId);
    if (!turn || !isWorkshopBookmarkableTurn(turn)) {
      this.answer({ requestId, ok: false, error: NOT_ELIGIBLE }, `save turn refused turnId=${payload.turnId} reason=not-eligible`);
      return;
    }
    await this.write(requestId, `save turn turnId=${turn.id}`, payload.draft, false, async () => ({
      result: await this.library.save(payload.draft, this.writerProvenance([turn.id])),
      action: 'saved'
    }));
  }

  async handleCreate(message: WorkshopMemoryCreateMessage): Promise<void> {
    const requestId = requestIdOf(message.payload);
    if (!requestId) {
      this.effects.reportError('New memory must name its request');
      return;
    }
    await this.write(requestId, 'create', message.payload.draft, false, async () => ({
      result: await this.library.save(message.payload.draft, this.writerProvenance([])),
      action: 'saved'
    }));
  }

  async handleUpdate(message: WorkshopMemoryUpdateMessage): Promise<void> {
    const payload = message.payload;
    const requestId = requestIdOf(payload);
    if (!requestId || typeof payload.memoryId !== 'string') {
      this.effects.reportError('A memory edit must name its request and a memory');
      return;
    }
    await this.write(requestId, `update memoryId=${payload.memoryId}`, payload.patch, true, async () => ({
      result: await this.library.update(payload.memoryId, payload.patch),
      action: 'updated'
    }));
  }

  async handleForget(message: WorkshopMemoryForgetMessage): Promise<void> {
    const payload = message.payload;
    const requestId = requestIdOf(payload);
    if (!requestId || typeof payload.memoryId !== 'string' || (payload.action !== 'forget' && payload.action !== 'restore')) {
      this.effects.reportError('Forget must name its request, a memory and forget or restore');
      return;
    }
    await this.write(requestId, `${payload.action} memoryId=${payload.memoryId}`, undefined, false, async () => ({
      result: payload.action === 'forget' ? await this.library.forget(payload.memoryId) : await this.library.restore(payload.memoryId),
      action: payload.action === 'forget' ? 'forgotten' : 'restored'
    }));
  }

  async handleRequestEdit(message: WorkshopMemoryRequestEditMessage): Promise<void> {
    const requestId = requestIdOf(message.payload);
    const memoryId = message.payload?.memoryId;
    if (!requestId || typeof memoryId !== 'string') {
      this.effects.reportError('A memory edit request must name its request and a memory');
      return;
    }
    const found = await this.library.editData(memoryId);
    const payload: WorkshopMemoryEditDataPayload = found.kind === 'memory'
      ? {
        requestId,
        memoryId,
        draft: {
          title: found.memory.title,
          kind: found.memory.kind,
          summary: found.memory.summary,
          body: found.memory.body.trim(),
          supersedes: [...found.memory.supersedes],
          pinned: found.memory.pinned
        },
        replaces: found.replaces.map((item) => ({ ...item }))
      }
      : { requestId, memoryId, error: REFUSALS[found.reason as keyof typeof REFUSALS] ?? REFUSALS.failed };
    this.log(`edit data ${found.kind === 'memory' ? 'sent' : `refused reason=${found.reason}`} memoryId=${memoryId}`);
    const reply: WorkshopMemoryEditDataMessage = {
      type: MessageType.WORKSHOP_MEMORY_EDIT_DATA,
      source: 'extension.workshop',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(reply);
  }

  async handleEstimate(message: WorkshopMemoryEstimateMessage): Promise<void> {
    const payload = message.payload;
    const requestId = requestIdOf(payload);
    if (!requestId || checkWorkshopMemoryDraft(payload.draft) === 'not-a-draft') {
      this.effects.reportError('A memory estimate must name its request and carry a draft');
      return;
    }
    const estimated = await this.library.estimatePinned(typeof payload.memoryId === 'string' ? payload.memoryId : undefined, payload.draft);
    const answer: WorkshopMemoryEstimateResultPayload = estimated.kind === 'estimate'
      ? { requestId, estimate: estimated.estimate }
      : { requestId, error: REFUSALS[estimated.reason as keyof typeof REFUSALS] ?? REFUSALS.failed };
    const reply: WorkshopMemoryEstimateResultMessage = {
      type: MessageType.WORKSHOP_MEMORY_ESTIMATE_RESULT,
      source: 'extension.workshop',
      payload: answer,
      timestamp: Date.now()
    };
    void this.postMessage(reply);
  }

  /**
   * One write: the draft checked, refused mid-reply, the library awaited,
   * then the receipt (and the card's state) recorded in the room it was
   * asked in, once any room replacement queued meanwhile has settled.
   */
  private async write(
    requestId: string,
    target: string,
    draft: WorkshopMemoryDraft | undefined,
    editing: boolean,
    run: () => Promise<{
      result: ProjectMemoryWriteResult;
      action: 'saved' | 'updated' | 'forgotten' | 'restored';
      onRecorded?: (memoryId: string) => void;
      proposedBy?: string;
    }>,
    stillApplies: () => boolean = () => true
  ): Promise<void> {
    if (draft !== undefined) {
      const fault = checkWorkshopMemoryDraft(draft);
      if (fault) {
        this.answer({ requestId, ok: false, error: WORKSHOP_MEMORY_DRAFT_FAULTS[fault] }, `${target} refused reason=${fault}`);
        return;
      }
    }
    if (this.room.isRoomRunActive()) {
      this.answer({ requestId, ok: false, error: RUN_ACTIVE }, `${target} refused reason=run-active`);
      return;
    }
    const revision = this.session.readRoomRevision();
    const { result, action, onRecorded, proposedBy } = await run();
    if (result.kind === 'refused') {
      const error = result.reason === 'pinned-budget' && result.budget
        ? workshopMemoryPinnedRefusal(result.budget, editing)
        : REFUSALS[result.reason as keyof typeof REFUSALS] ?? REFUSALS.failed;
      this.answer({ requestId, ok: false, error, ...(result.budget ? { budget: result.budget } : {}) }, `${target} refused reason=${result.reason}`);
      return;
    }
    while (this.room.isSessionOperationPending()) {
      await this.room.waitForSessionOperations();
    }
    if (this.session.readRoomRevision() !== revision || !stillApplies()) {
      this.answer({ requestId, ok: true, memoryId: result.memory.id, error: ROOM_CHANGED },
        `${target} written memoryId=${result.memory.id}; receipt not recorded reason=room-changed`);
      return;
    }
    onRecorded?.(result.memory.id);
    const leavesReceipt = !result.unchanged && (action !== 'updated' || result.changedMeaning);
    if (leavesReceipt) {
      this.session.appendMemoryReceipt({
        action,
        memoryId: result.memory.id,
        title: result.memory.title,
        version: result.version,
        by: 'writer',
        ...(proposedBy ? { proposedBy } : {})
      });
    }
    if (leavesReceipt || onRecorded) {
      this.settleRoom('project memory receipt');
    }
    this.answer({ requestId, ok: true, memoryId: result.memory.id },
      `${target} ${action} memoryId=${result.memory.id}${leavesReceipt ? ' receipt' : ''}`);
  }

  /** A persona's proposal: the host's provenance, never the trailer's (D6). */
  private proposalProvenance(turn: WorkshopTurn): ProjectMemorySaveProvenance {
    const ledger = this.session.readRoomLedger();
    const index = ledger.findIndex((candidate) => candidate.id === turn.id);
    const prompted = ledger.slice(0, Math.max(index, 0)).reverse()
      .find((candidate) => candidate.participant === 'writer' && candidate.kind === 'message');
    const session = this.room.liveSessionId();
    return {
      origin: 'proposed',
      ...(turn.personaId ? { proposedBy: turn.personaId } : {}),
      ...(session ? { sourceSession: session } : {}),
      sourceTurns: session ? [prompted?.id, turn.id].filter(isSourceTurn) : []
    };
  }

  private writerProvenance(turnIds: readonly string[]): ProjectMemorySaveProvenance {
    const session = this.room.liveSessionId();
    const sourceTurns = session ? turnIds.filter(isSourceTurn) : [];
    return {
      origin: 'writer',
      ...(session && sourceTurns.length > 0 ? { sourceSession: session } : {}),
      sourceTurns
    };
  }

  private settleRoom(reason: string): void {
    this.effects.markDirty(reason);
    this.effects.postSessionState();
  }

  private answerRefusal(payload: { requestId?: unknown } | undefined, reason: string, logged: string): void {
    const requestId = requestIdOf(payload);
    if (!requestId) {
      this.effects.reportError(reason);
      return;
    }
    this.answer({ requestId, ok: false, error: reason }, `write refused reason=${logged}`);
  }

  private answer(payload: WorkshopMemoryWriteResultPayload, line: string): void {
    this.log(line);
    const reply: WorkshopMemoryWriteResultMessage = {
      type: MessageType.WORKSHOP_MEMORY_WRITE_RESULT,
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

function isSourceTurn(id: string | undefined): id is string {
  return typeof id === 'string' && PROJECT_MEMORY_SOURCE_TURN.test(id);
}

function requestIdOf(payload: { requestId?: unknown } | undefined): string | undefined {
  const requestId = payload?.requestId;
  return typeof requestId === 'string' && requestId.length > 0 && requestId.length <= REQUEST_ID_CHARACTERS
    ? requestId
    : undefined;
}
