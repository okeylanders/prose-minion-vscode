/**
 * Project memory for one persona turn (ADR 2026-11-04 D1, D2, D3, D8):
 * turns one validated `memory.*` request into a capability result. The
 * library returns data and the renderer writes the text; this adapter owns
 * the turn's limits, the refusals, and what a result records.
 *
 * - **Closed means rejected.** With memory off, every call is rejected
 *   `memory-off`; in a workspace with no folder, or several, or a changed
 *   root, `memory-unavailable`. Nothing is read either way.
 * - **Reads per turn:** at most `readsPerTurn`, under the shared call
 *   ceiling. A read that reached the library counts.
 * - **Manifest rows:** each memory a read showed whole is one "Project
 *   note" row, labeled with its title. A catalog and a search add none.
 * - Logs carry ids, counts and reasons, never a title, summary or body (D9).
 *   Memory is deterministic, so a result carries no usage.
 */

import type { LogSink } from '@/platform';
import type { WorkshopPersonaId } from '@messages';
import type { CapabilityDeliveredSource } from '@orchestration/AgentRunContracts';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type {
  WorkshopCapabilityPrincipal,
  WorkshopCapabilityResult,
  WorkshopProjectMemoryRequest
} from '@shared/types/workshopCapabilities';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { projectMemoryDeliveredView } from '@/application/services/workshop/memory/ProjectMemoryDeliveredView';
import { workshopProjectMemoryDeliveryOf } from '@/application/services/workshop/session/WorkshopProjectMemoryDeliveryRecords';
import type { ProjectMemoryLibrary, ProjectMemorySnapshot } from '@/application/services/workshop/memory/ProjectMemoryLibrary';
import type { ProjectMemoryRefusal } from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';
import {
  memoryBody,
  projectMemoryClosedLine,
  projectMemoryClosedRejection
} from '@/application/services/workshop/memory/WorkshopProjectMemoryCopy';
import {
  renderWorkshopProjectMemoryCatalog,
  renderWorkshopProjectMemoryRead,
  renderWorkshopProjectMemorySearch
} from '@/application/services/workshop/memory/WorkshopProjectMemoryRenderer';
import { workshopProjectMemoryRequestSummary } from '@/application/services/workshop/memory/WorkshopProjectMemoryRequestCopy';
import { recallLabel, recallLabelList } from '@/application/services/workshop/recall/WorkshopRecallText';

/** The library's questions a persona may ask; satisfied by ProjectMemoryLibrary. */
export type WorkshopProjectMemoryPort = Pick<ProjectMemoryLibrary, 'catalog' | 'search' | 'read' | 'frame' | 'update' | 'replyMemoryContext'>;

/** The session's part in delivery records (D14); satisfied by WorkshopSessionService. */
export type WorkshopProjectMemorySessionPort = Pick<WorkshopSessionService, 'stageProjectMemoryDelivery' | 'readRoomLedger'>;

export interface WorkshopProjectMemoryTurnContext {
  readonly requestId: string;
  readonly personaId: WorkshopPersonaId;
  /** The conversation this turn belongs to, whose record a delivery joins. */
  readonly owner: WorkshopCapabilityPrincipal;
  readonly signal: AbortSignal;
}

type Request<C extends WorkshopProjectMemoryRequest['capability']> = Extract<WorkshopProjectMemoryRequest, { capability: C }>;

/** Titles a read's manifest label and summary name before counting the rest. */
const LABEL_CHARACTERS = 200;

export class WorkshopProjectMemoryCapability {
  private reads = 0;
  private readonly sources = new WeakMap<WorkshopCapabilityResult, CapabilityDeliveredSource[]>();

  constructor(
    private readonly library: WorkshopProjectMemoryPort,
    private readonly session: WorkshopProjectMemorySessionPort,
    private readonly outputChannel: LogSink,
    private readonly turn: WorkshopProjectMemoryTurnContext
  ) {}

  async fulfill(request: WorkshopProjectMemoryRequest): Promise<WorkshopCapabilityResult> {
    this.throwIfAborted();
    switch (request.capability) {
      case 'memory.catalog':
        return this.catalog(request);
      case 'memory.search':
        return this.search(request);
      case 'memory.read':
        return this.read(request);
      default:
        return assertNever(request);
    }
  }

  /**
   * The `<project-memory>` frame for this conversation's first user message
   * (D5), or none: memory off, an unaccepted or unavailable workspace, a
   * folder that could not be listed, or nothing in it. Only the run that
   * starts a conversation asks, so a retained conversation keeps the frame
   * it was given. What it delivered (the whole set in effect) is staged for
   * the reply's record (D14). A conversation that starts with nothing (memory
   * off, the workspace unavailable, the folder unlisted, or a failure)
   * records an empty frame: it begins a new conversation's view, so a
   * re-invited guest never inherits an earlier membership's (PR #198 F-02),
   * and turning memory on later sends it the whole catalog. A cancellation
   * propagates.
   */
  async frame(): Promise<string | undefined> {
    return this.deliver('frame', async () => {
      const result = await this.library.frame(this.turn.signal);
      if (result.kind === 'frame' || result.kind === 'empty') {
        return { snapshot: result.snapshot, text: result.kind === 'frame' ? result.frame.text : undefined };
      }
      return { snapshot: [], refused: result.kind === 'closed' ? result.reason : result.kind };
    });
  }

  /**
   * The update note for a follow-up turn (D14): what changed since this
   * conversation's last frame or note, from the room's ledger. Nothing
   * changed, memory off, or a folder that cannot be listed: no note, and the
   * record stands, so the next message tries again.
   */
  async updateNote(): Promise<string | undefined> {
    return this.deliver('note', async () => {
      const view = projectMemoryDeliveredView(this.session.readRoomLedger(), this.turn.owner);
      const result = await this.library.update(view, this.turn.signal);
      if (result.kind === 'note') {
        return { snapshot: result.snapshot, text: result.text };
      }
      return result.kind === 'current' ? {} : { refused: result.kind === 'closed' ? result.reason : result.kind };
    });
  }

  private async deliver(
    kind: 'frame' | 'note',
    read: () => Promise<{ snapshot?: ProjectMemorySnapshot; text?: string; refused?: string }>
  ): Promise<string | undefined> {
    try {
      const { snapshot, text, refused } = await read();
      if (refused) {
        this.log(`${kind} none reason=${refused}`);
      }
      if (snapshot && !this.session.stageProjectMemoryDelivery(
        this.turn.requestId,
        workshopProjectMemoryDeliveryOf(this.turn.owner, kind, snapshot)
      )) {
        this.log(`${kind} none reason=run-not-active`);
        return undefined;
      }
      return text;
    } catch (error) {
      if (this.turn.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw error;
      }
      this.log(`${kind} none reason=failed (${error instanceof Error ? error.name : 'unknown'})`);
      if (kind === 'frame') {
        // A conversation that starts with nothing is told nothing (PR #198 F-02).
        this.session.stageProjectMemoryDelivery(this.turn.requestId, { participant: { ...this.turn.owner }, kind, memories: [] });
      }
      return undefined;
    }
  }

  /** Manifest rows for what a result put in context: one per memory a read showed whole. */
  deliveredSources(result: WorkshopCapabilityResult): readonly CapabilityDeliveredSource[] {
    return this.sources.get(result) ?? [];
  }

  private async catalog(request: Request<'memory.catalog'>): Promise<WorkshopCapabilityResult> {
    const result = await this.library.catalog(request.kind, this.turn.signal);
    this.throwIfAborted();
    if (result.kind !== 'catalog') {
      return this.refused(request, result);
    }
    const rendered = renderWorkshopProjectMemoryCatalog(result.set.memories, result.filter);
    return this.success(request, rendered.content, {
      outcome: 'catalog',
      memoryCount: rendered.shown,
      ...(request.kind ? { kind: request.kind } : {}),
      notShown: rendered.notShown,
      truncated: rendered.notShown > 0
    });
  }

  private async search(request: Request<'memory.search'>): Promise<WorkshopCapabilityResult> {
    const status = request.status ?? 'active';
    const result = await this.library.search(request.query, status, this.turn.signal);
    this.throwIfAborted();
    if (result.kind !== 'searched') {
      return this.refused(request, result);
    }
    const { outcome } = result;
    return this.success(request, renderWorkshopProjectMemorySearch(outcome, status), {
      outcome: 'searched',
      status,
      memoryCount: outcome.hits.length,
      matched: outcome.matched,
      searched: outcome.searched,
      matchMode: outcome.mode ?? 'none',
      truncated: outcome.matched > outcome.hits.length
    });
  }

  private async read(request: Request<'memory.read'>): Promise<WorkshopCapabilityResult> {
    const budgets = PROMPT_BUDGETS.workshopProjectMemory;
    if (this.reads >= budgets.readsPerTurn) {
      return this.rejected(request, 'memory-read-limit',
        `Only ${budgets.readsPerTurn} memory reads are allowed per user turn. ` +
          'Answer from the notes you have read, and name any you still want to read on your next turn.');
    }
    this.reads += 1;
    const result = await this.library.read(request.memories, this.turn.signal);
    this.throwIfAborted();
    if (result.kind !== 'read') {
      return this.refused(request, result);
    }
    const rendered = renderWorkshopProjectMemoryRead(result.items);
    const titles = rendered.read.map(({ memory }) => `“${recallLabel(memory.title)}”`);
    const outcome: WorkshopCapabilityResult = {
      capability: request.capability,
      status: rendered.read.length === 0 ? 'failed' : rendered.read.length < request.memories.length ? 'partial' : 'success',
      requestSummary: titles.length > 0 ? recallLabelList(titles, LABEL_CHARACTERS) : workshopProjectMemoryRequestSummary(request),
      content: rendered.content,
      metadata: {
        outcome: 'read',
        memoryCount: rendered.read.length,
        memoriesNamed: request.memories.length,
        memories: result.items.map((item) => ({
          id: item.kind === 'memory' ? item.listed.memory.id : item.id,
          outcome: item.kind === 'memory' && rendered.notReadForSpace.includes(item.listed.memory.id) ? 'not-read-for-space' : item.kind
        })),
        truncated: rendered.notReadForSpace.length > 0,
        characters: rendered.content.length
      },
      ...(rendered.read.length === 0 ? { error: 'None of the named notes could be read.' } : {})
    };
    // One "Project note" row per memory the read showed whole (D12).
    this.sources.set(outcome, rendered.read.map(({ memory }) => ({
      kind: 'memory' as const,
      label: recallLabel(memory.title),
      sizeChars: memory.body.length + memory.title.length + memory.summary.length
    })));
    this.log(`read named=${request.memories.length} read=${rendered.read.length} characters=${rendered.content.length}`);
    return outcome;
  }

  private success(
    request: WorkshopProjectMemoryRequest,
    content: string,
    metadata: Readonly<Record<string, unknown>>
  ): WorkshopCapabilityResult {
    return {
      capability: request.capability,
      status: 'success',
      requestSummary: workshopProjectMemoryRequestSummary(request),
      content,
      metadata: { ...metadata, characters: content.length }
    };
  }

  /** Off or unavailable is a rejection (D1, D8); a folder that could not be read is a failure. */
  private refused(request: WorkshopProjectMemoryRequest, refusal: ProjectMemoryRefusal): WorkshopCapabilityResult {
    if (refusal.kind === 'closed') {
      return this.rejected(request, projectMemoryClosedRejection(refusal.reason), projectMemoryClosedLine(refusal.reason),
        { closedReason: refusal.reason });
    }
    const content = memoryBody([projectMemoryClosedLine('unknown')]);
    this.log(`failed ${request.capability} reason=folder-unreadable`);
    return {
      capability: request.capability,
      status: 'failed',
      requestSummary: workshopProjectMemoryRequestSummary(request),
      content,
      metadata: { outcome: 'unknown', characters: content.length },
      error: 'The project-memory folder could not be read.'
    };
  }

  private rejected(
    request: WorkshopProjectMemoryRequest,
    rejectionReason: string,
    error: string,
    metadata: Readonly<Record<string, unknown>> = {}
  ): WorkshopCapabilityResult {
    this.log(`refused ${request.capability} reason=${rejectionReason}`);
    return {
      capability: request.capability,
      status: 'rejected',
      requestSummary: workshopProjectMemoryRequestSummary(request),
      error,
      metadata: { rejectionReason, ...metadata }
    };
  }

  private throwIfAborted(): void {
    if (this.turn.signal.aborted) {
      const error = new Error('Project memory was cancelled.');
      error.name = 'AbortError';
      throw error;
    }
  }

  private log(line: string): void {
    this.outputChannel.appendLine(
      `[WorkshopProjectMemoryCapability] request=${this.turn.requestId} persona=${this.turn.personaId} ${line}`
    );
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled project-memory request: ${JSON.stringify(value)}`);
}
