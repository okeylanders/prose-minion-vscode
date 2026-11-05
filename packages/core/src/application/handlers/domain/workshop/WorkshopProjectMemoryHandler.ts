/**
 * Owns project memory's write routes (ADR 2026-11-04 D6, D7, D8, D13; epic
 * Slice 3; PR #192 F-03): a card's Save, Edit-then-Save, Dismiss and Show it
 * again; "Save to memory…" on an eligible bubble; New memory; Edit; and
 * Forget or Restore from a receipt. Slice 4b's manager reuses them and adds
 * only pin, archive and delete.
 *
 * - **The writer acts,** or the writer's setting does. Nothing is saved
 *   without one of these routes, or, under Save and tell me (Slice 5),
 *   `autoSaveProposal`: the room hands it a reply whose card completion
 *   marked for saving, and it saves it with `origin: auto` and a receipt
 *   `by: 'auto'`, through the same in-flight hold a writer's Save joins.
 *   Memory Off doesn't stop a writer's write: a card pending from before the
 *   switch keeps its Save (D8).
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
  type WorkshopMemoryEditProposal,
  type WorkshopMemoryEditDataMessage,
  type WorkshopMemoryEditDataPayload,
  type WorkshopMemoryEstimateMessage,
  type WorkshopMemoryEstimateResultMessage,
  type WorkshopMemoryEstimateResultPayload,
  type WorkshopMemoryForgetMessage,
  type WorkshopMemoryCreateMessage,
  type WorkshopMemoryProposal,
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
  WORKSHOP_MEMORY_EDIT_CHANGED,
  workshopMemoryCardKey,
  workshopMemoryDraftsEqual,
  workshopMemoryProposalAt,
  workshopMemoryProposalDraft,
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
import { WorkshopMemoryAutoSaves } from '@handlers/domain/workshop/WorkshopMemoryAutoSaves';
import {
  WORKSHOP_MEMORY_NO_CARD,
  WORKSHOP_MEMORY_NOT_ELIGIBLE,
  WORKSHOP_MEMORY_ROOM_CHANGED,
  WORKSHOP_MEMORY_RUN_ACTIVE,
  WORKSHOP_PROJECT_MEMORY_REFUSALS,
  workshopMemoryRequestIdOf as requestIdOf
} from '@handlers/domain/workshop/WorkshopProjectMemoryRefusals';
import {
  workshopProposalProvenance,
  workshopWriterProvenance
} from '@handlers/domain/workshop/WorkshopProjectMemoryProvenance';

/** The library's write half, as the handler reaches it; satisfied by ProjectMemoryLibrary. */
export type WorkshopProjectMemoryWritePort = Pick<
  ProjectMemoryLibrary,
  'save' | 'edit' | 'forget' | 'restore' | 'editData' | 'estimatePinned' | 'mode'
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

export class WorkshopProjectMemoryHandler {
  constructor(
    private readonly session: WorkshopSessionService,
    private readonly library: WorkshopProjectMemoryWritePort,
    private readonly room: WorkshopProjectMemoryRoomGate,
    private readonly effects: Effects,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {}

  /**
   * A proposal's save in flight, by card (`workshopMemoryCardKey`: its turn
   * and index), taken before the first await (PR #200 F-05): a second Save
   * of the same card joins it (one file, one receipt, the same answer), and
   * Dismiss or Reopen waits it out. Each card on a reply has its own.
   */
  private readonly proposalSaves = new Map<string, Promise<WorkshopMemoryWriteResultPayload>>();
  private readonly autoSaves = new WorkshopMemoryAutoSaves(
    this.session,
    this.library,
    this.room,
    this.proposalSaves,
    {
      provenance: (turn, proposal) => this.proposalProvenance(turn, 'auto', proposal),
      settleRoom: () => this.settleRoom('project memory receipt'),
      log: (line) => this.log(line)
    }
  );

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
    if (!requestId || typeof payload.turnId !== 'string' || !Number.isSafeInteger(payload.index) || payload.index < 0
      || !['save', 'dismiss', 'reopen'].includes(payload.action)) {
      this.effects.reportError('A memory suggestion action must name its request, a turn, a card and an action');
      return;
    }
    const { turnId, index } = payload;
    const card = `turnId=${turnId} index=${index}`;
    const key = workshopMemoryCardKey(turnId, index);
    const proposalOf = (candidate: WorkshopTurn | undefined) => workshopMemoryProposalAt(candidate, index);
    // An edited Save that says something other than the card (PR #201 F-02) never joins a save of
    // the card's own draft: once that one lands, the edit applies to the saved memory below.
    const edits = (candidate: WorkshopTurn | undefined): boolean => {
      const proposal = proposalOf(candidate);
      return payload.edited !== undefined && proposal !== undefined
        && !workshopMemoryDraftsEqual(payload.edited, workshopMemoryProposalDraft(proposal));
    };
    const inFlight = this.proposalSaves.get(key);
    if (inFlight) {
      const first = await inFlight;
      const current = this.session.readRoomLedger().find((candidate) => candidate.id === turnId);
      if (payload.action === 'save' && first.ok && !edits(current)) {
        this.answer({ ...first, requestId }, `proposal save joined ${card}`);
        return;
      }
    }
    const turn = this.session.readRoomLedger().find((candidate) => candidate.id === turnId);
    const proposal = proposalOf(turn);
    if (!turn || !proposal) {
      this.answer({ requestId, ok: false, error: WORKSHOP_MEMORY_NO_CARD }, `proposal ${payload.action} refused ${card} reason=no-proposal`);
      return;
    }
    if (payload.action !== 'save') {
      if (proposal.state === 'saved') {
        this.answer({ requestId, ok: false, error: WORKSHOP_MEMORY_NO_CARD }, `proposal ${payload.action} refused ${card} reason=saved`);
        return;
      }
      this.session.setMemoryProposalState(turn.id, index, payload.action === 'dismiss' ? 'dismissed' : 'pending');
      this.settleRoom('memory suggestion settled');
      this.answer({ requestId, ok: true }, `proposal ${payload.action} ${card}`);
      return;
    }
    const savedId = proposal.state === 'saved' ? proposal.memoryId : undefined;
    if (savedId && payload.edited && edits(turn)) {
      const edited = payload.edited;
      await this.write(requestId, `proposal edit of saved memoryId=${savedId} ${card}`, edited, true, async () => ({
        result: await this.library.edit(savedId, edited),
        action: 'updated'
      }));
      return;
    }
    if (savedId) {
      this.answer({ requestId, ok: true, memoryId: savedId }, `proposal save unchanged ${card}`);
      return;
    }
    const draft: WorkshopMemoryDraft = payload.edited ?? workshopMemoryProposalDraft(proposal);
    const recorded = (memoryId: string) => this.session.setMemoryProposalState(turn.id, index, 'saved', memoryId);
    const stillApplies = () => this.session.readRoomLedger().some((candidate) => candidate.id === turn.id && proposalOf(candidate)?.state !== 'saved');
    const saving = proposal.proposes === 'edit'
      ? this.saveEdit(requestId, card, turn, index, proposal, draft, recorded, stillApplies)
      : this.write(requestId, `proposal save ${card}`, draft, false, async () => {
        const result = await this.library.save(draft, this.proposalProvenance(turn, 'proposed', proposal));
        return { result, onRecorded: recorded, action: 'saved', proposedBy: turn.personaId };
      }, stillApplies);
    this.proposalSaves.set(key, saving);
    try {
      await saving;
    } finally {
      if (this.proposalSaves.get(key) === saving) {
        this.proposalSaves.delete(key);
      }
    }
  }

  /**
   * An edit card's Save (Slice 6c): its result, or the sheet's version of
   * it, applied as an ordinary update only while the note's edit token is
   * the one it was anchored against (PR #212 F-02, F-03): at the write's
   * turn, on the bytes the rewrite claims, and on the folder read afresh
   * just before it. A changed note writes nothing, and the card keeps only Dismiss.
   */
  private saveEdit(
    requestId: string,
    card: string,
    turn: WorkshopTurn,
    index: number,
    proposal: WorkshopMemoryEditProposal,
    draft: WorkshopMemoryDraft,
    recorded: (memoryId: string) => WorkshopTurn,
    stillApplies: () => boolean
  ): Promise<WorkshopMemoryWriteResultPayload> {
    if (proposal.stale) {
      return Promise.resolve(this.answer({ requestId, ok: false, error: WORKSHOP_MEMORY_EDIT_CHANGED }, `proposal save refused ${card} reason=changed`));
    }
    const target = proposal.target.id;
    return this.write(requestId, `proposal edit ${card} memoryId=${target}`, draft, true, async () => ({
      result: await this.library.edit(target, draft, { expectedToken: proposal.target.token }),
      action: 'updated',
      onRecorded: recorded,
      onRefused: (reason) => {
        if (reason === 'changed') {
          this.session.markMemoryEditStale(turn.id, index);
          this.settleRoom('memory edit refused');
        }
      },
      proposedBy: turn.personaId
    }), stillApplies);
  }

  async handleSaveTurn(message: WorkshopSaveTurnToMemoryMessage): Promise<void> {
    const payload = message.payload;
    const requestId = requestIdOf(payload);
    if (!requestId || typeof payload.turnId !== 'string') {
      this.effects.reportError('Save to memory must name its request and a turn');
      return;
    }
    if (payload.roomRevision !== undefined /* a bookmark outside the window names its room: D9, PR #214 F-03 */ && payload.roomRevision !== this.session.readRoomRevision()) {
      this.answer({ requestId, ok: false, error: WORKSHOP_MEMORY_ROOM_CHANGED }, `save turn refused turnId=${payload.turnId} reason=room-changed`);
      return;
    }
    const turn = this.session.readRoomLedger().find((candidate) => candidate.id === payload.turnId);
    if (!turn || !isWorkshopBookmarkableTurn(turn)) {
      this.answer({ requestId, ok: false, error: WORKSHOP_MEMORY_NOT_ELIGIBLE }, `save turn refused turnId=${payload.turnId} reason=not-eligible`);
      return;
    }
    await this.write(requestId, `save turn turnId=${turn.id}`, payload.draft, false, async () => ({
      result: await this.library.save(payload.draft, workshopWriterProvenance([turn.id], this.room.liveSessionId())),
      action: 'saved'
    }));
  }

  /** A writer's save from a source another route checked, for the room it was asked in (`WorkshopSavedTurnMemoryHandler`; PR #219 F-02). */
  saveWriterMemory(requestId: string, target: string, draft: WorkshopMemoryDraft, provenance: ProjectMemorySaveProvenance, roomRevision: number): Promise<WorkshopMemoryWriteResultPayload> {
    return this.write(requestId, target, draft, false, async () => ({ result: await this.library.save(draft, provenance), action: 'saved' }), undefined, roomRevision);
  }

  async handleCreate(message: WorkshopMemoryCreateMessage): Promise<void> {
    const requestId = requestIdOf(message.payload);
    if (!requestId) {
      this.effects.reportError('New memory must name its request');
      return;
    }
    await this.write(requestId, 'create', message.payload.draft, false, async () => ({
      result: await this.library.save(message.payload.draft, workshopWriterProvenance([], this.room.liveSessionId())),
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
      result: await this.library.edit(payload.memoryId, payload.patch),
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

  /**
   * Save and tell me (Slice 5; D8): the cards on `turnId` at `indexes`,
   * which completion marked for saving, saved now, one after another in
   * order (`WorkshopMemoryAutoSaves`; Slice 6b). Each holds its card's
   * in-flight save, so an unedited Save joins it and a Dismiss waits it
   * out. Not a route: the run that produced the reply awaits it as its
   * tail, under its own controller (`signal`), before it settles (PR #201 F-03).
   */
  autoSaveProposals(turnId: string, indexes: readonly number[], signal: AbortSignal): Promise<void> {
    return this.autoSaves.save(turnId, indexes, signal);
  }

  /** The room's automatic saves: its receipts, and the saves admitted but not yet recorded (PR #201 F-04). */
  autoSavesInRoom(): number {
    return this.autoSaves.inRoom();
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
      : { requestId, memoryId, error: WORKSHOP_PROJECT_MEMORY_REFUSALS[found.reason as keyof typeof WORKSHOP_PROJECT_MEMORY_REFUSALS] ?? WORKSHOP_PROJECT_MEMORY_REFUSALS.failed };
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
      : { requestId, error: WORKSHOP_PROJECT_MEMORY_REFUSALS[estimated.reason as keyof typeof WORKSHOP_PROJECT_MEMORY_REFUSALS] ?? WORKSHOP_PROJECT_MEMORY_REFUSALS.failed };
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
      onRefused?: (reason: ProjectMemoryWriteRefusalReason) => void;
      proposedBy?: string;
    }>,
    stillApplies: () => boolean = () => true,
    askedIn?: number
  ): Promise<WorkshopMemoryWriteResultPayload> {
    if (draft !== undefined) {
      const fault = checkWorkshopMemoryDraft(draft);
      if (fault) {
        return this.answer({ requestId, ok: false, error: WORKSHOP_MEMORY_DRAFT_FAULTS[fault] }, `${target} refused reason=${fault}`);
      }
    }
    if (this.room.isRoomRunActive()) {
      return this.answer({ requestId, ok: false, error: WORKSHOP_MEMORY_RUN_ACTIVE }, `${target} refused reason=run-active`);
    }
    const revision = this.session.readRoomRevision();
    if (askedIn !== undefined && askedIn !== revision) {
      return this.answer({ requestId, ok: false, error: WORKSHOP_MEMORY_ROOM_CHANGED }, `${target} refused reason=room-changed`);
    }
    const { result, action, onRecorded, onRefused, proposedBy } = await run();
    if (result.kind === 'refused') {
      onRefused?.(result.reason);
      const error = result.reason === 'pinned-budget' && result.budget
        ? workshopMemoryPinnedRefusal(result.budget, editing)
        : WORKSHOP_PROJECT_MEMORY_REFUSALS[result.reason as keyof typeof WORKSHOP_PROJECT_MEMORY_REFUSALS] ?? WORKSHOP_PROJECT_MEMORY_REFUSALS.failed;
      return this.answer({ requestId, ok: false, error, ...(result.budget ? { budget: result.budget } : {}) }, `${target} refused reason=${result.reason}`);
    }
    while (this.room.isSessionOperationPending()) {
      await this.room.waitForSessionOperations();
    }
    if (this.session.readRoomRevision() !== revision || !stillApplies()) {
      return this.answer({ requestId, ok: true, memoryId: result.memory.id, error: WORKSHOP_MEMORY_ROOM_CHANGED },
        `${target} written memoryId=${result.memory.id}; receipt not recorded reason=room-changed`);
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
    return this.answer({ requestId, ok: true, memoryId: result.memory.id },
      `${target} ${action} memoryId=${result.memory.id}${leavesReceipt ? ' receipt' : ''}`);
  }

  /** A persona's proposal: the host's provenance, never the trailer's (D6); cited turns it refused are logged by id (D10). */
  private proposalProvenance(turn: WorkshopTurn, origin: 'proposed' | 'auto', proposal: WorkshopMemoryProposal): ProjectMemorySaveProvenance {
    return workshopProposalProvenance(this.session.readRoomLedger(), turn, this.room.liveSessionId(), origin, proposal, (dropped) =>
      this.log(`cited turns dropped turnId=${turn.id} ${dropped.map((cite) => `${cite.id}:${cite.reason}`).join(',')}`));
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

  private answer(payload: WorkshopMemoryWriteResultPayload, line: string): WorkshopMemoryWriteResultPayload {
    this.log(line);
    const reply: WorkshopMemoryWriteResultMessage = {
      type: MessageType.WORKSHOP_MEMORY_WRITE_RESULT,
      source: 'extension.workshop',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(reply);
    return payload;
  }

  private log(line: string): void {
    this.outputChannel.appendLine(`${LOG} ${line}`);
  }
}
