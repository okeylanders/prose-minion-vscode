/**
 * Save and tell me's saves (ADR 2026-11-04 D7, D8; epic Slice 5), owned by
 * `WorkshopProjectMemoryHandler` beside the writer's routes.
 *
 * - **Only what completion marked.** Completion routes a reply's proposal
 *   (`WorkshopMemoryAutoSave`): held cards and Ask first's never reach here.
 * - **The tail of the run that produced it** (PR #201 F-03). The run awaits
 *   the save under its own controller before it settles, so no later
 *   request waits on it, and New, Open, a preempting run and disposal treat
 *   it as they treat any running run: they abort it, or replace its room.
 * - **A live permission** (PR #201 F-01). Save and tell me still on, the
 *   run not aborted, the same room, and the card still pending: asked
 *   before the save, when its turn in the write queue comes, and at the
 *   store's commit point with nothing awaited before the rename. Withdrawn,
 *   nothing is written and the card waits for the writer.
 * - **One save per card.** It holds the card's save in the handler's
 *   in-flight map, so an unedited Save of the same card joins it (one file,
 *   one receipt) and a Dismiss waits it out. An edited Save never joins: it
 *   applies to the saved memory once this lands (PR #201 F-02).
 * - **Never silently.** A committed save leaves a receipt `by: 'auto'`
 *   naming the persona, with the file's full provenance (`origin: auto`),
 *   unless its room was replaced meanwhile (logged; the memory stands).
 * - **Logs** carry turn and memory ids and reasons, never memory text.
 */

import type { WorkshopMemoryWriteResultPayload, WorkshopTurn } from '@messages';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { ProjectMemoryLibrary } from '@/application/services/workshop/memory/ProjectMemoryLibrary';
import type { ProjectMemorySaveProvenance } from '@/application/services/workshop/memory/ProjectMemoryWrites';
import { workshopMemoryProposalDraft } from '@shared/constants/workshopProjectMemoryWrites';

export type WorkshopMemoryAutoSaveLibrary = Pick<ProjectMemoryLibrary, 'save' | 'mode'>;

export interface WorkshopMemoryAutoSaveRoom {
  isSessionOperationPending(): boolean;
  waitForSessionOperations(): Promise<void>;
}

export interface WorkshopMemoryAutoSaveHooks {
  provenance(turn: WorkshopTurn): ProjectMemorySaveProvenance;
  settleRoom(): void;
  log(line: string): void;
}

export class WorkshopMemoryAutoSaves {
  constructor(
    private readonly session: WorkshopSessionService,
    private readonly library: WorkshopMemoryAutoSaveLibrary,
    private readonly room: WorkshopMemoryAutoSaveRoom,
    /** The handler's card saves by turn id (PR #200 F-05), shared with the writer's Save. */
    private readonly proposalSaves: Map<string, Promise<WorkshopMemoryWriteResultPayload>>,
    private readonly hooks: WorkshopMemoryAutoSaveHooks
  ) {}

  /** Save the card on `turnId` for the run `signal` belongs to; resolves once saved or withdrawn, and never rejects. */
  save(turnId: string, signal: AbortSignal): Promise<void> {
    const existing = this.proposalSaves.get(turnId);
    if (existing) {
      return existing.then(() => undefined, () => undefined);
    }
    const saving = this.saveCard(turnId, signal);
    this.proposalSaves.set(turnId, saving);
    return saving.then(() => undefined, (error: unknown) => {
      this.hooks.log(`auto save failed turnId=${turnId} reason=${error instanceof Error ? error.name : 'unknown'}`);
    }).finally(() => {
      if (this.proposalSaves.get(turnId) === saving) {
        this.proposalSaves.delete(turnId);
      }
    });
  }

  private async saveCard(turnId: string, signal: AbortSignal): Promise<WorkshopMemoryWriteResultPayload> {
    const target = `auto save turnId=${turnId}`;
    const waits = (reason: string): WorkshopMemoryWriteResultPayload => {
      this.hooks.log(`${target} card waits reason=${reason}`);
      return { requestId: '', ok: false };
    };
    const pendingCard = () => {
      const proposal = this.session.readRoomLedger().find((candidate) => candidate.id === turnId)?.memoryProposal;
      return proposal?.state === 'pending' && !proposal.held ? proposal : undefined;
    };
    const turn = this.session.readRoomLedger().find((candidate) => candidate.id === turnId);
    const proposal = pendingCard();
    if (!turn || !proposal) {
      return waits('no-pending-card');
    }
    const revision = this.session.readRoomRevision();
    const permitted = (): boolean => this.library.mode() === 'auto'
      && !signal.aborted
      && this.session.readRoomRevision() === revision
      && pendingCard() !== undefined;
    if (!permitted()) {
      return waits(this.withdrawnReason(signal, revision));
    }
    const result = await this.library.save(workshopMemoryProposalDraft(proposal), this.hooks.provenance(turn), { permit: permitted });
    if (result.kind === 'refused') {
      return waits(result.reason === 'withdrawn' ? this.withdrawnReason(signal, revision) : result.reason);
    }
    while (this.room.isSessionOperationPending()) {
      await this.room.waitForSessionOperations();
    }
    const current = this.session.readRoomLedger().find((candidate) => candidate.id === turn.id);
    if (this.session.readRoomRevision() !== revision || current?.memoryProposal?.state !== 'pending') {
      // The room was replaced (New, Open, Rewind, Branch) after the file committed: the memory
      // stands, and the manager lists it as saved by its persona.
      this.hooks.log(`${target} written memoryId=${result.memory.id}; receipt not recorded reason=room-changed`);
      return { requestId: '', ok: true, memoryId: result.memory.id };
    }
    this.session.setMemoryProposalState(turn.id, 'saved', result.memory.id);
    this.session.appendMemoryReceipt({
      action: 'saved',
      memoryId: result.memory.id,
      title: result.memory.title,
      version: result.version,
      by: 'auto',
      ...(turn.personaId ? { proposedBy: turn.personaId } : {})
    });
    this.hooks.settleRoom();
    this.hooks.log(`${target} saved memoryId=${result.memory.id} receipt`);
    return { requestId: '', ok: true, memoryId: result.memory.id };
  }

  /** Why a save's permission was withdrawn, for the log: a fact, never text. */
  private withdrawnReason(signal: AbortSignal, revision: number): string {
    if (this.library.mode() !== 'auto') {
      return 'withdrawn:mode';
    }
    if (signal.aborted) {
      return 'withdrawn:run-stopped';
    }
    return this.session.readRoomRevision() !== revision ? 'withdrawn:room-changed' : 'withdrawn:card-settled';
  }
}
