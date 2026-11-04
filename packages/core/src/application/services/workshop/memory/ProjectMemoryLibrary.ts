/**
 * The project-memory library (ADR 2026-11-04 D1, D3, D5, D8, D10, D13):
 * what the frame builder, the persona capability and the handlers read
 * memory through. It answers data, never prose. Its writes (Slice 3) are the
 * writer's alone, in `ProjectMemoryWrites`.
 *
 * - **Access is read live, on every call.** The global mode
 *   (`proseMinion.workshop.projectMemory`, through `SettingsStore`), the
 *   coordinator's accepted-workspace rule (`recallScope()`), and the store's
 *   own availability. A changed root never shows another project's memory.
 *   The scope is checked again after each await, so a call whose workspace
 *   changed returns only the refusal.
 * - **Derived standing.** Superseded comes from the readable memories (D4);
 *   unreadable files and ids several files hold are counted and never
 *   shown. A memory another window holds is listed as it was (PR #194 N-02);
 *   only a read of it answers busy.
 * - **Provenance** asks session recall where a memory's source turns stand
 *   now (`positionsOf`, D3); positions are computed per read, never stored.
 * - **Logs** carry ids, counts and reasons, never a title, summary or body (D9).
 *
 * Built once, in `extension.ts`. It reaches the store and the coordinator
 * only through the read-only ports below, which they satisfy as types.
 */

import type { LogSink, SettingsStore } from '@/platform';
import {
  coerceWorkshopProjectMemoryMode,
  WORKSHOP_PROJECT_MEMORY_SETTING,
  type WorkshopProjectMemoryMode
} from '@messages';
import { PROJECT_MEMORY_KINDS } from '@shared/types/projectMemory';
import type { ProjectMemoryKind } from '@shared/types/projectMemory';
import type { WorkshopMemorySearchStatus } from '@shared/types/workshopCapabilities';
import type { ProjectMemoryStore } from '@/infrastructure/storage/ProjectMemoryStore';
import type { WorkshopRecallScopePort } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import type { WorkshopRecallPositions } from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import {
  estimateProjectMemoryFrameOf,
  renderProjectMemoryFrame,
  type ProjectMemoryRenderedFrame
} from '@/application/services/workshop/memory/ProjectMemoryCatalogFrame';
import {
  listProjectMemories,
  type ProjectMemoryAccess,
  type ProjectMemoryClosedReason,
  type ProjectMemoryFrameEstimateResult,
  type ProjectMemoryProvenance,
  type ProjectMemoryReadItem,
  type ProjectMemoryReadResult,
  type ProjectMemoryRefusal,
  type ProjectMemorySetResult
} from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';
import {
  searchProjectMemories,
  type ProjectMemorySearchOutcome
} from '@/application/services/workshop/memory/WorkshopProjectMemorySearch';
import {
  ProjectMemoryWrites,
  type ProjectMemoryEditDataResult,
  type ProjectMemoryEstimateResult,
  type ProjectMemorySaveProvenance,
  type ProjectMemoryWriteResult,
  type ProjectMemoryWriteStorePort
} from '@/application/services/workshop/memory/ProjectMemoryWrites';
import type { WorkshopMemoryDraft } from '@messages';
import type {
  WorkshopReplyMemoryContext,
  WorkshopReplyMemoryPort
} from '@/application/services/workshop/memory/WorkshopReplyMemory';
import { hasWorkshopMemoryProposalText } from '@/utils/workshopReplyControls';

/** The store's read-only methods; satisfied by ProjectMemoryStore. */
export type ProjectMemoryReadPort = Pick<ProjectMemoryStore, 'availability' | 'list' | 'read'>;

/** The store's methods the library uses, writes included (Slice 3); satisfied by ProjectMemoryStore. */
export type ProjectMemoryStorePort = ProjectMemoryReadPort & ProjectMemoryWriteStorePort;

/** Session recall's one question for memory (D3); satisfied by WorkshopTranscriptRecallService. */
export interface ProjectMemoryPositionsPort {
  positionsOf(sessionId: string, turnIds: readonly string[], signal?: AbortSignal): Promise<WorkshopRecallPositions>;
}

export interface ProjectMemoryLibraryOptions {
  /** The frame's `built` date; today, in UTC, by default. */
  now?: () => Date;
}

export type ProjectMemoryCatalogResult =
  | { readonly kind: 'catalog'; readonly set: Extract<ProjectMemorySetResult, { kind: 'set' }>; readonly filter?: ProjectMemoryKind }
  | ProjectMemoryRefusal;

export type ProjectMemorySearchResult =
  | { readonly kind: 'searched'; readonly status: WorkshopMemorySearchStatus; readonly outcome: ProjectMemorySearchOutcome }
  | ProjectMemoryRefusal;

export type ProjectMemoryFrameResult =
  | { readonly kind: 'frame'; readonly frame: ProjectMemoryRenderedFrame }
  /** Nothing to show: the folder holds no readable memory. */
  | { readonly kind: 'empty' }
  | ProjectMemoryRefusal;

/** The port the first-turn and join frame builders read (D13): a rendered frame, or none. */
export interface ProjectMemoryFramePort {
  frame(signal?: AbortSignal): Promise<ProjectMemoryFrameResult>;
}

/** Whether a rebuilt system prompt teaches the `memory.*` grammar (D8): the mode is on and the workspace holds. */
export interface ProjectMemoryGrammarPort {
  teachesGrammar(): boolean;
}

export class ProjectMemoryLibrary implements ProjectMemoryFramePort, ProjectMemoryGrammarPort, WorkshopReplyMemoryPort {
  private readonly now: () => Date;
  private readonly writes: ProjectMemoryWrites;

  constructor(
    private readonly store: ProjectMemoryStorePort,
    private readonly scope: WorkshopRecallScopePort,
    private readonly recall: ProjectMemoryPositionsPort,
    private readonly settings: SettingsStore,
    private readonly outputChannel: LogSink,
    options: ProjectMemoryLibraryOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
    this.writes = new ProjectMemoryWrites(store, () => this.workspaceReason(), this.now, outputChannel);
  }

  /**
   * The writer's writes (Slice 3; `ProjectMemoryWrites`): never a model's.
   * Each is owed until it settles; `shutDown` drains them at deactivation.
   */
  save(draft: WorkshopMemoryDraft, provenance: ProjectMemorySaveProvenance): Promise<ProjectMemoryWriteResult> {
    return this.writes.save(draft, provenance);
  }

  update(id: string, patch: WorkshopMemoryDraft): Promise<ProjectMemoryWriteResult> {
    return this.writes.update(id, patch);
  }

  forget(id: string): Promise<ProjectMemoryWriteResult> {
    return this.writes.forget(id);
  }

  restore(id: string): Promise<ProjectMemoryWriteResult> {
    return this.writes.restore(id);
  }

  editData(id: string): Promise<ProjectMemoryEditDataResult> {
    return this.writes.editData(id);
  }

  estimatePinned(id: string | undefined, draft: WorkshopMemoryDraft): Promise<ProjectMemoryEstimateResult> {
    return this.writes.estimate(id, draft);
  }

  /** Wait for every owed write (D10; joined to `shutDownExtension`). */
  shutDown(): Promise<void> {
    return this.writes.shutDown();
  }

  /** The global mode, read now; anything unknown reads as off. */
  mode(): WorkshopProjectMemoryMode {
    return coerceWorkshopProjectMemoryMode(
      this.settings.get<unknown>(WORKSHOP_PROJECT_MEMORY_SETTING.section, WORKSHOP_PROJECT_MEMORY_SETTING.key)
    );
  }

  /** Whether personas may read memory in this workspace now. */
  access(): ProjectMemoryAccess {
    const mode = this.mode();
    if (mode === 'off') {
      return { open: false, reason: 'off' };
    }
    const workspace = this.workspaceReason();
    return workspace ? { open: false, reason: workspace } : { open: true, mode };
  }

  /**
   * The grammar follows the mode and this workspace (D8). A room still
   * hydrating (`not-ready`) is taught it: archive import rebuilds the prompts
   * before the coordinator settles, and a reopened room must not lose the
   * grammar for that. Calls made while not ready are refused all the same.
   */
  teachesGrammar(): boolean {
    const access = this.access();
    return access.open || access.reason === 'not-ready';
  }

  /** Every readable memory with its standing, for `memory.catalog` (D1); `kind` narrows it. */
  async catalog(kind?: ProjectMemoryKind, signal?: AbortSignal): Promise<ProjectMemoryCatalogResult> {
    const set = await this.personaSet(signal);
    if (set.kind !== 'set') {
      return set;
    }
    this.log(`catalog memories=${set.memories.length} unreadable=${set.unreadable} conflicts=${set.conflicts}`);
    return { kind: 'catalog', set, ...(kind && PROJECT_MEMORY_KINDS.includes(kind) ? { filter: kind } : {}) };
  }

  /** Lexical search over title, summary and body, by recall's term rules (D1). */
  async search(query: string, status: WorkshopMemorySearchStatus = 'active', signal?: AbortSignal): Promise<ProjectMemorySearchResult> {
    const set = await this.personaSet(signal);
    if (set.kind !== 'set') {
      return set;
    }
    const outcome = searchProjectMemories(set.memories, query, status);
    this.log(`search status=${status} terms=${outcome.query.terms.length} matched=${outcome.matched} shown=${outcome.hits.length}`);
    return { kind: 'searched', status, outcome };
  }

  /**
   * Each named memory whole, in the order asked (D1). Ids are checked
   * against the listing, never resolved as paths: an id no readable memory
   * holds is unknown, a conflicting one included, so neither file reaches
   * a model. A memory another window holds is "being edited".
   */
  async read(ids: readonly string[], signal?: AbortSignal): Promise<ProjectMemoryReadResult> {
    const set = await this.personaSet(signal);
    if (set.kind !== 'set') {
      return set;
    }
    const byId = new Map(set.memories.map((listed) => [listed.memory.id, listed]));
    const items: ProjectMemoryReadItem[] = [];
    for (const id of ids) {
      const listed = byId.get(id);
      if (!listed) {
        items.push({ kind: 'unknown', id });
        continue;
      }
      const read = listed.busy ? { kind: 'busy' as const } : await this.store.read(id);
      throwIfAborted(signal);
      if (read.kind === 'busy') {
        items.push({ kind: 'busy', id });
      } else if (read.kind === 'memory') {
        const fresh = { ...listed, memory: read.entry.memory };
        items.push({ kind: 'memory', listed: fresh, provenance: await this.provenance(fresh.memory, signal) });
      } else if (read.kind === 'missing' || read.kind === 'conflict') {
        items.push({ kind: 'unknown', id });
      } else {
        items.push({ kind: 'unreadable', id });
      }
    }
    const closed = this.personaReason();
    if (closed) {
      return { kind: 'closed', reason: closed };
    }
    this.log(`read named=${ids.length} read=${items.filter((item) => item.kind === 'memory').length} ` +
      `unknown=${items.filter((item) => item.kind === 'unknown').length} busy=${items.filter((item) => item.kind === 'busy').length}`);
    return { kind: 'read', items };
  }

  /**
   * What run completion needs to settle a reply's proposal (D6): whether
   * personas may propose now, and, only when the reply holds a frame, the
   * listed memories' titles, for `supersedes`. A listing that fails or is
   * cancelled leaves `listed` out, so every `supersedes` is dropped and
   * counted; it never fails the reply.
   */
  async replyMemoryContext(reply: string, signal?: AbortSignal): Promise<WorkshopReplyMemoryContext> {
    if (!this.access().open) {
      return { open: false };
    }
    if (!hasWorkshopMemoryProposalText(reply)) {
      return { open: true };
    }
    try {
      const set = await this.personaSet(signal);
      if (set.kind !== 'set') {
        return { open: set.kind !== 'closed' };
      }
      return { open: true, listed: new Map(set.memories.map(({ memory }) => [memory.id, memory.title])) };
    } catch {
      this.log('reply context listing cancelled');
      return { open: true };
    }
  }

  /** The `<project-memory>` frame for a conversation's first user message (D5), or why there is none. */
  async frame(signal?: AbortSignal): Promise<ProjectMemoryFrameResult> {
    const set = await this.personaSet(signal);
    if (set.kind !== 'set') {
      this.log(`frame not sent reason=${set.kind === 'closed' ? set.reason : 'unknown'}`);
      return set;
    }
    const frame = renderProjectMemoryFrame(set, { builtOn: this.now().toISOString().slice(0, 10) });
    if (!frame) {
      return { kind: 'empty' };
    }
    this.log(`frame pinned=${frame.pinnedLoaded.length} entries=${frame.entries.length} more=${frame.more} ` +
      `tokens=${frame.estimate.frameTokens} pinnedOver=${frame.estimate.pinnedOver}`);
    return { kind: 'frame', frame };
  }

  /**
   * What a frame would cost now, from the same renderer and estimator (D5),
   * for Slice 4b's tab. The writer's view: it reads with memory off too,
   * and is refused only where the workspace holds no memory.
   */
  async estimateProjectMemoryFrame(): Promise<ProjectMemoryFrameEstimateResult> {
    const set = await this.listedSet(() => this.workspaceReason());
    if (set.kind !== 'set') {
      return set;
    }
    return { kind: 'estimate', ...estimateProjectMemoryFrameOf(set, { builtOn: this.now().toISOString().slice(0, 10) }) };
  }

  private async provenance(memory: { sourceSession?: string; sourceTurns: readonly string[] }, signal?: AbortSignal): Promise<ProjectMemoryProvenance> {
    if (!memory.sourceSession) {
      return { kind: 'none' };
    }
    const found = await this.recall.positionsOf(memory.sourceSession, memory.sourceTurns, signal);
    throwIfAborted(signal);
    switch (found.kind) {
      case 'positions':
        return {
          kind: 'recallable',
          sessionId: memory.sourceSession,
          title: found.title,
          positions: found.positions,
          missingTurns: memory.sourceTurns.length - found.positions.length
        };
      case 'live-session':
        return { kind: 'live-room' };
      case 'unknown-session':
        return { kind: 'not-saved' };
      case 'unreadable':
        return { kind: 'unreadable' };
      case 'unavailable':
        return { kind: 'recall-unavailable' };
      default:
        return assertNever(found);
    }
  }

  /** The set a persona may see: the mode on and the workspace accepted, before and after the listing. */
  private personaSet(signal?: AbortSignal): Promise<ProjectMemorySetResult> {
    return this.listedSet(() => this.personaReason(), signal);
  }

  private async listedSet(reason: () => ProjectMemoryClosedReason | undefined, signal?: AbortSignal): Promise<ProjectMemorySetResult> {
    throwIfAborted(signal);
    const before = reason();
    if (before) {
      return { kind: 'closed', reason: before };
    }
    const listing = await this.store.list();
    throwIfAborted(signal);
    const after = reason();
    if (after) {
      return { kind: 'closed', reason: after };
    }
    switch (listing.kind) {
      case 'listed':
        return {
          kind: 'set',
          memories: listProjectMemories(listing.memories),
          unreadable: listing.unreadable.length,
          conflicts: listing.conflicts.length
        };
      case 'unavailable':
        return { kind: 'closed', reason: listing.reason };
      case 'unknown':
        this.log('the memory folder could not be read');
        return { kind: 'unknown' };
      default:
        return assertNever(listing);
    }
  }

  private personaReason(): ProjectMemoryClosedReason | undefined {
    const access = this.access();
    return access.open ? undefined : access.reason;
  }

  /** The accepted workspace (D5) and the store's own availability (D10). */
  private workspaceReason(): ProjectMemoryClosedReason | undefined {
    const scope = this.scope.recallScope();
    if (!scope.available) {
      return scope.reason;
    }
    const availability = this.store.availability();
    return availability.available ? undefined : availability.reason;
  }

  private log(line: string): void {
    this.outputChannel.appendLine(`[ProjectMemoryLibrary] ${line}`);
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const error = new Error('Project memory was cancelled.');
    error.name = 'AbortError';
    throw error;
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled project-memory value: ${JSON.stringify(value)}`);
}
