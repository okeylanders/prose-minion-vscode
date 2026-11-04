/**
 * Save and tell me's saves (ADR 2026-11-04 D7, D8; epic Slice 5), owned by
 * `WorkshopProjectMemoryHandler` beside the writer's routes.
 *
 * - **Only what completion marked.** Completion routes a reply's proposal
 *   (`WorkshopMemoryAutoSave`): held cards and Ask first's never reach here.
 *   The mode is read again before saving, since it was read before the
 *   reply's listing was awaited; a card no longer under Save and tell me
 *   waits for the writer.
 * - **One save per card.** It holds the card's save in the handler's
 *   in-flight map, so a writer's Save of the same card joins it (one file,
 *   one receipt) and a Dismiss waits it out.
 * - **Never silently.** A save leaves a receipt `by: 'auto'` naming the
 *   persona, with the file's full provenance (`origin: auto`). The room
 *   waits for every save in flight before its next run, so the receipt
 *   lands right after the reply it came from. A refused save writes
 *   nothing, and the card waits for the writer.
 * - **Logs** carry turn and memory ids and reasons, never memory text.
 */

import type {
  WorkshopMemoryDraft,
  WorkshopMemoryWriteResultPayload,
  WorkshopTurn
} from '@messages';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { ProjectMemoryLibrary } from '@/application/services/workshop/memory/ProjectMemoryLibrary';
import type { ProjectMemorySaveProvenance } from '@/application/services/workshop/memory/ProjectMemoryWrites';

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
  /** Saves in flight, settled or not, for the room to wait out. */
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly session: WorkshopSessionService,
    private readonly library: WorkshopMemoryAutoSaveLibrary,
    private readonly room: WorkshopMemoryAutoSaveRoom,
    /** The handler's card saves by turn id (PR #200 F-05), shared with the writer's Save. */
    private readonly proposalSaves: Map<string, Promise<WorkshopMemoryWriteResultPayload>>,
    private readonly hooks: WorkshopMemoryAutoSaveHooks
  ) {}

  /** Save the card on `turnId`; resolves once it is saved, or waits, and never rejects. */
  save(turnId: string): Promise<void> {
    const saving = this.proposalSaves.get(turnId) ?? this.saveCard(turnId);
    this.proposalSaves.set(turnId, saving);
    const settled: Promise<void> = saving.then(() => undefined, (error: unknown) => {
      this.hooks.log(`auto save failed turnId=${turnId} reason=${error instanceof Error ? error.name : 'unknown'}`);
    }).finally(() => {
      if (this.proposalSaves.get(turnId) === saving) {
        this.proposalSaves.delete(turnId);
      }
      this.inFlight.delete(settled);
    });
    this.inFlight.add(settled);
    return settled;
  }

  /** Every save in flight, settled; undefined when there are none, so the room needn't await. */
  settled(): Promise<void> | undefined {
    return this.inFlight.size === 0 ? undefined : Promise.all([...this.inFlight]).then(() => undefined);
  }

  private async saveCard(turnId: string): Promise<WorkshopMemoryWriteResultPayload> {
    const target = `auto save turnId=${turnId}`;
    const waits = (reason: string): WorkshopMemoryWriteResultPayload => {
      this.hooks.log(`${target} card waits reason=${reason}`);
      return { requestId: '', ok: false };
    };
    const turn = this.session.readRoomLedger().find((candidate) => candidate.id === turnId);
    const proposal = turn?.memoryProposal;
    if (!turn || proposal?.state !== 'pending' || proposal.held) {
      return waits('no-pending-card');
    }
    if (this.library.mode() !== 'auto') {
      return waits('mode');
    }
    const draft: WorkshopMemoryDraft = {
      title: proposal.title,
      kind: proposal.kind,
      summary: proposal.summary,
      body: proposal.body,
      supersedes: (proposal.supersedes ?? []).map((item) => item.id),
      pinned: false
    };
    const revision = this.session.readRoomRevision();
    const result = await this.library.save(draft, this.hooks.provenance(turn));
    if (result.kind === 'refused') {
      return waits(result.reason);
    }
    while (this.room.isSessionOperationPending()) {
      await this.room.waitForSessionOperations();
    }
    const current = this.session.readRoomLedger().find((candidate) => candidate.id === turn.id);
    if (this.session.readRoomRevision() !== revision || current?.memoryProposal?.state !== 'pending') {
      // The room was replaced (New, Open, Rewind, Branch) while the file was written: the
      // memory stands, and the manager lists it as saved by its persona.
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
}
