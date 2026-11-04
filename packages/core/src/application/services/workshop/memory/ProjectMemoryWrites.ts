/**
 * The project-memory library's writes (ADR 2026-11-04 D4, D5, D8, D10; epic
 * Slice 3): the writer's actions only. Nothing here runs on a model's word:
 * a proposal is saved when the writer presses Save.
 *
 * - **Writer access, not model access** (D8). Writes are refused only where
 *   this workspace holds no memory (no folder, several, a changed root, a
 *   room being replaced). Memory Off doesn't stop them: a card pending from
 *   before the switch keeps its Save.
 * - **`save`** writes one new file through the store's queue, which mints
 *   the id. Superseding is that one new file naming the old ones; the old
 *   files are never touched (D4). `supersedes` keeps only ids the listing
 *   holds now.
 * - **`update`, `forget`, `restore`** are the store's claimed rewrites in
 *   place. `updated` is stamped only for a change to what the memory says
 *   (title, kind, summary, body, supersedes), never for a load-in-full
 *   toggle, a Forget or a Restore, so those never reorder the catalog.
 * - **The pinned budget** (D5, PR #192 F-04). A save or edit that leaves the
 *   memory loaded in full is checked against `pinnedTokens` with the frame's
 *   own renderer and estimator. It is refused, with the numbers, when the
 *   memories loaded in full would pass the budget and the change is what
 *   grows them. Nothing is turned off for the writer. Stated limit: the check
 *   is per window (no cross-window lock), as D5 says.
 * - **Owed.** Every write is owed until it settles, and `shutDown` waits for
 *   each, and for any started while it waits, then for the store's own.
 * - **Logs** carry ids, counts and reasons, never a title, summary or body.
 */

import type { LogSink } from '@/platform';
import type { WorkshopMemoryDraft, WorkshopMemoryPinnedEstimate } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { projectMemoryBody, type ProjectMemory, type ProjectMemoryOrigin } from '@shared/types/projectMemory';
import type { ProjectMemoryStore } from '@/infrastructure/storage/ProjectMemoryStore';
import {
  isProjectMemoryInEffect,
  listProjectMemories,
  type ProjectMemoryClosedReason,
  type ProjectMemoryListed
} from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';
import { projectMemoryPinnedTokens } from '@/application/services/workshop/memory/ProjectMemoryCatalogFrame';
import { projectMemoryVersion } from '@/application/services/workshop/memory/ProjectMemoryVersion';

/** The store's methods the writes use; satisfied by ProjectMemoryStore. */
export type ProjectMemoryWriteStorePort = Pick<ProjectMemoryStore, 'list' | 'read' | 'create' | 'replace' | 'delete' | 'shutDown'>;

/** Who a new memory came from; the host fills it, never a model (D6). */
export interface ProjectMemorySaveProvenance {
  /** `auto` only for Save and tell me's own save (Slice 5). */
  readonly origin: ProjectMemoryOrigin;
  readonly proposedBy?: string;
  readonly sourceSession?: string;
  readonly sourceTurns: readonly string[];
}

/** Why a write did nothing. Every reason is a fact about the folder or the draft, never its text. */
export type ProjectMemoryWriteRefusalReason =
  | ProjectMemoryClosedReason
  | 'unknown'
  | 'missing'
  | 'busy'
  | 'conflict'
  | 'invalid'
  | 'failed'
  | 'pinned-budget'
  /** A save's permission was withdrawn before it committed (Save and tell me: PR #201 F-01). */
  | 'withdrawn';

/**
 * Why a delete did nothing: a write's reasons, or `changed`, when the file
 * once claimed held something else (another id, or unreadable bytes) and was
 * put back (PR #194 F-02).
 */
export type ProjectMemoryDeleteRefusalReason = ProjectMemoryWriteRefusalReason | 'changed';

export type ProjectMemoryDeleteResult =
  | { readonly kind: 'deleted' }
  | { readonly kind: 'refused'; readonly reason: ProjectMemoryDeleteRefusalReason };

export type ProjectMemoryWriteResult =
  | {
    readonly kind: 'written';
    readonly memory: ProjectMemory;
    /** The memory's version after the write (D7, D14). */
    readonly version: string;
    /** Whether what the memory says changed (a receipt says "updated" only then). */
    readonly changedMeaning: boolean;
    /** Nothing changed, so nothing was written. */
    readonly unchanged?: true;
  }
  | {
    readonly kind: 'refused';
    readonly reason: ProjectMemoryWriteRefusalReason;
    /** The pinned budget's numbers, for the sheet's refusal. */
    readonly budget?: WorkshopMemoryPinnedEstimate;
  };

export type ProjectMemoryEditDataResult =
  | { readonly kind: 'memory'; readonly memory: ProjectMemory; readonly replaces: ReadonlyArray<{ id: string; title: string }> }
  | { readonly kind: 'refused'; readonly reason: ProjectMemoryWriteRefusalReason };

export type ProjectMemoryEstimateResult =
  | { readonly kind: 'estimate'; readonly estimate: WorkshopMemoryPinnedEstimate }
  | { readonly kind: 'refused'; readonly reason: ProjectMemoryWriteRefusalReason };

type Listed = { readonly kind: 'listed'; readonly memories: ProjectMemoryListed[] } | { readonly kind: 'refused'; readonly reason: ProjectMemoryWriteRefusalReason };

/** Which accepted workspace a write was asked for: its live room and its memory folder. */
export interface ProjectMemoryWorkspaceIdentity {
  readonly room: string;
  readonly directory: string;
}

function sameWorkspace(now: ProjectMemoryWorkspaceIdentity | undefined, asked: ProjectMemoryWorkspaceIdentity): boolean {
  return now !== undefined && now.room === asked.room && now.directory === asked.directory;
}

const PINNED_BUDGET = PROMPT_BUDGETS.workshopProjectMemory.pinnedTokens;

export class ProjectMemoryWrites {
  private readonly owed = new Set<Promise<unknown>>();
  /** The last write's settlement: each write's list, check and commit wait for it (PR #200 F-04). */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: ProjectMemoryWriteStorePort,
    /** This workspace's reason to hold no memory now, read live (D8, D10). */
    private readonly workspaceReason: () => ProjectMemoryClosedReason | undefined,
    /** The accepted workspace's identity (its room and memory folder), read live; undefined when it holds no memory. */
    private readonly workspaceIdentity: () => ProjectMemoryWorkspaceIdentity | undefined,
    private readonly now: () => Date,
    private readonly outputChannel: LogSink
  ) {}

  /**
   * A new memory from the writer's draft (Save, Save to memory…, New), or
   * Save and tell me's. `permit`, when given, is asked once the save's turn
   * in the queue comes and again at the store's commit point, with nothing
   * awaited before the rename: a save whose permission was withdrawn
   * meanwhile writes nothing (PR #201 F-01). A writer's save passes none.
   */
  save(
    draft: WorkshopMemoryDraft,
    provenance: ProjectMemorySaveProvenance,
    options: { readonly permit?: () => boolean } = {}
  ): Promise<ProjectMemoryWriteResult> {
    const permitted = () => options.permit?.() ?? true;
    return this.owe('save', async () => {
      if (!permitted()) {
        return this.refused('save', 'withdrawn');
      }
      const listed = await this.listed();
      if (listed.kind === 'refused') {
        return listed;
      }
      const known = new Set(listed.memories.map(({ memory }) => memory.id));
      const supersedes = draft.supersedes.filter((id) => known.has(id));
      if (supersedes.length < draft.supersedes.length) {
        this.log(`save dropped supersedes=${draft.supersedes.length - supersedes.length} (not listed)`);
      }
      const stamp = this.stamp();
      const candidate: ProjectMemory = {
        id: 'mem-000000',
        title: draft.title.trim(),
        kind: draft.kind,
        summary: draft.summary.trim(),
        status: 'active',
        pinned: draft.pinned,
        created: stamp,
        updated: stamp,
        origin: provenance.origin,
        ...(provenance.proposedBy ? { proposedBy: provenance.proposedBy } : {}),
        ...(provenance.sourceSession ? { sourceSession: provenance.sourceSession } : {}),
        sourceTurns: provenance.sourceTurns.slice(),
        supersedes,
        body: projectMemoryBody(draft.body)
      };
      const budget = pinnedBudget(listed.memories, candidate, undefined);
      if (budget.refused) {
        this.log(`save refused reason=pinned-budget total=${budget.totalTokens}`);
        return { kind: 'refused', reason: 'pinned-budget', budget };
      }
      const { id: _id, created: _created, updated: _updated, ...fields } = candidate;
      const created = await this.store.create(fields, { beforeCommit: () => this.workspaceReason() === undefined && permitted() });
      if (created.kind === 'invalid') {
        this.log(`save invalid fault=${created.reason}${created.key ? ` key=${created.key}` : ''}`);
      }
      if (created.kind !== 'created') {
        return this.refused('save', created.kind === 'withdrawn'
          ? (permitted() ? 'failed' : 'withdrawn')
          : created.kind === 'unavailable' ? created.reason : created.kind);
      }
      const memory = created.entry.memory;
      this.log(`saved id=${memory.id} origin=${memory.origin} supersedes=${memory.supersedes.length} pinned=${memory.pinned}`);
      return { kind: 'written', memory, version: await this.versionOf(memory), changedMeaning: true };
    });
  }

  /** Edit a saved memory: the sheet's whole draft replaces what it says, and whether it loads in full. */
  update(id: string, patch: WorkshopMemoryDraft): Promise<ProjectMemoryWriteResult> {
    return this.owe('update', async () => {
      const listed = await this.listed();
      if (listed.kind === 'refused') {
        return listed;
      }
      const current = listed.memories.find(({ memory }) => memory.id === id);
      if (!current) {
        return this.refused('update', 'missing', id);
      }
      const known = new Set(listed.memories.map(({ memory }) => memory.id).filter((other) => other !== id));
      const revise = (memory: ProjectMemory): ProjectMemory => {
        const next = {
          ...memory,
          title: patch.title.trim(),
          kind: patch.kind,
          summary: patch.summary.trim(),
          // A body the writer didn't change keeps its bytes (D4).
          body: memory.body.trim() === patch.body.trim() ? memory.body : projectMemoryBody(patch.body),
          supersedes: patch.supersedes.filter((other) => known.has(other) || memory.supersedes.includes(other)),
          pinned: patch.pinned
        };
        return saysSomethingElse(memory, next) ? { ...next, updated: this.stamp() } : next;
      };
      const budget = pinnedBudget(listed.memories, revise(current.memory), id);
      if (budget.refused) {
        this.log(`update refused id=${id} reason=pinned-budget total=${budget.totalTokens}`);
        return { kind: 'refused', reason: 'pinned-budget', budget };
      }
      let changedMeaning = false;
      const replaced = await this.store.replace(id, (memory) => {
        const next = revise(memory);
        changedMeaning = saysSomethingElse(memory, next);
        return changedMeaning || next.pinned !== memory.pinned ? next : undefined;
      }, { beforeCommit: () => this.workspaceReason() === undefined });
      return this.settled('update', id, replaced, changedMeaning);
    });
  }

  /**
   * The manager's Always load in full (Slice 4b): only `pinned` changes,
   * read under the store's claim, so no other field is overwritten. Turning
   * it on is checked against the pinned budget as an edit is; turning it
   * off is always allowed. `updated` doesn't move (D10).
   */
  setPinned(id: string, pinned: boolean): Promise<ProjectMemoryWriteResult> {
    return this.owe('load-in-full', async () => {
      const listed = await this.listed();
      if (listed.kind === 'refused') {
        return listed;
      }
      const current = listed.memories.find(({ memory }) => memory.id === id);
      if (!current) {
        return this.refused('load-in-full', 'missing', id);
      }
      const budget = pinnedBudget(listed.memories, { ...current.memory, pinned }, id);
      if (budget.refused) {
        this.log(`load-in-full refused id=${id} reason=pinned-budget total=${budget.totalTokens}`);
        return { kind: 'refused', reason: 'pinned-budget', budget };
      }
      const replaced = await this.store.replace(id, (memory) => memory.pinned === pinned ? undefined : { ...memory, pinned },
        { beforeCommit: () => this.workspaceReason() === undefined });
      return this.settled('load-in-full', id, replaced, false);
    });
  }

  /**
   * Delete a memory's file (D8: only Delete removes one). The store claims
   * it and checks the claimed bytes still read as this memory, else puts
   * them back (`changed`). A memory it superseded is in effect again (D4).
   */
  remove(id: string): Promise<ProjectMemoryDeleteResult> {
    // The workspace the writer asked about, captured before this queue or the store's can wait (PR #202 F01).
    const asked = this.workspaceIdentity();
    const still = () => asked !== undefined && sameWorkspace(this.workspaceIdentity(), asked);
    return this.owe('delete', async () => {
      const closed = this.workspaceReason() ?? (still() ? undefined : 'workspace-changed');
      if (closed || !asked) {
        this.refused('delete', closed ?? 'workspace-changed', id);
        return { kind: 'refused' as const, reason: closed ?? 'workspace-changed' };
      }
      const deleted = await this.store.delete(id, { directory: asked.directory, beforeCommit: still });
      if (deleted.kind === 'deleted') {
        this.log(`delete deleted id=${id}`);
        return { kind: 'deleted' as const };
      }
      const reason: ProjectMemoryDeleteRefusalReason = deleted.kind === 'unavailable' ? deleted.reason
        : deleted.kind === 'withdrawn' ? this.workspaceReason() ?? 'workspace-changed' : deleted.kind;
      this.log(`delete refused id=${id} reason=${reason}`);
      return { kind: 'refused' as const, reason };
    });
  }

  /** Forget: archive, never delete (D8). */
  forget(id: string): Promise<ProjectMemoryWriteResult> {
    return this.setStatus('forget', id, 'archived');
  }

  /** Restore a forgotten memory: active again. */
  restore(id: string): Promise<ProjectMemoryWriteResult> {
    return this.setStatus('restore', id, 'active');
  }

  /** A saved memory's fields for the sheet, and the titles of what it replaces. */
  async editData(id: string): Promise<ProjectMemoryEditDataResult> {
    const listed = await this.listed();
    if (listed.kind === 'refused') {
      return listed;
    }
    const found = listed.memories.find(({ memory }) => memory.id === id);
    if (!found) {
      return { kind: 'refused', reason: 'missing' };
    }
    const titles = new Map(listed.memories.map(({ memory }) => [memory.id, memory.title]));
    return {
      kind: 'memory',
      memory: found.memory,
      replaces: found.memory.supersedes.flatMap((other) => titles.has(other) ? [{ id: other, title: titles.get(other) as string }] : [])
    };
  }

  /** What memories loaded in full would come to with this draft: the host's numbers for the sheet (D5). */
  async estimate(id: string | undefined, draft: WorkshopMemoryDraft): Promise<ProjectMemoryEstimateResult> {
    const listed = await this.listed();
    if (listed.kind === 'refused') {
      return listed;
    }
    const current = id ? listed.memories.find(({ memory }) => memory.id === id)?.memory : undefined;
    const base: ProjectMemory = current ?? {
      id: 'mem-000000', title: '', kind: draft.kind, summary: '', status: 'active', pinned: false,
      created: this.stamp(), updated: this.stamp(), origin: 'writer', sourceTurns: [], supersedes: [], body: ''
    };
    const candidate: ProjectMemory = {
      ...base,
      title: draft.title.trim(),
      kind: draft.kind,
      summary: draft.summary.trim(),
      body: projectMemoryBody(draft.body),
      supersedes: draft.supersedes.slice(),
      pinned: draft.pinned
    };
    return { kind: 'estimate', estimate: pinnedBudget(listed.memories, candidate, current ? id : undefined) };
  }

  /** Settle every owed write, and any started while it waits, then the store's own (deactivation, D10). */
  async shutDown(): Promise<void> {
    while (this.owed.size > 0) {
      await Promise.allSettled([...this.owed]);
    }
    await this.store.shutDown();
  }

  private setStatus(action: 'forget' | 'restore', id: string, status: ProjectMemory['status']): Promise<ProjectMemoryWriteResult> {
    return this.owe(action, async () => {
      const closed = this.workspaceReason();
      if (closed) {
        return this.refused(action, closed, id);
      }
      const replaced = await this.store.replace(
        id,
        (memory) => memory.status === status ? undefined : { ...memory, status },
        { beforeCommit: () => this.workspaceReason() === undefined }
      );
      return this.settled(action, id, replaced, false);
    });
  }

  private async settled(
    action: string,
    id: string,
    replaced: Awaited<ReturnType<ProjectMemoryWriteStorePort['replace']>>,
    changedMeaning: boolean
  ): Promise<ProjectMemoryWriteResult> {
    switch (replaced.kind) {
      case 'replaced':
      case 'unchanged': {
        const memory = replaced.entry.memory;
        this.log(`${action} ${replaced.kind} id=${id}`);
        return {
          kind: 'written',
          memory,
          version: await this.versionOf(memory),
          changedMeaning: replaced.kind === 'replaced' && changedMeaning,
          ...(replaced.kind === 'unchanged' ? { unchanged: true as const } : {})
        };
      }
      case 'unavailable':
        return this.refused(action, replaced.reason, id);
      case 'withdrawn':
        return this.refused(action, this.workspaceReason() ?? 'failed', id);
      default:
        return this.refused(action, replaced.kind, id);
    }
  }

  /** The folder's memories with their standing, or why the writer can't write here now. */
  private async listed(): Promise<Listed> {
    const before = this.workspaceReason();
    if (before) {
      return { kind: 'refused', reason: before };
    }
    const listing = await this.store.list();
    const after = this.workspaceReason();
    if (after) {
      return { kind: 'refused', reason: after };
    }
    if (listing.kind === 'unavailable') {
      return { kind: 'refused', reason: listing.reason };
    }
    if (listing.kind === 'unknown') {
      return { kind: 'refused', reason: 'unknown' };
    }
    return { kind: 'listed', memories: listProjectMemories(listing.memories) };
  }

  /** The written memory's version, with its standing as the folder now has it. */
  private async versionOf(memory: ProjectMemory): Promise<string> {
    const listing = await this.store.list();
    const listed = listing.kind === 'listed'
      ? listProjectMemories(listing.memories).find((entry) => entry.memory.id === memory.id)
      : undefined;
    // The receipt carries exactly D14's version (Slice 2b's), with the memory's standing as listed.
    return listed?.version ?? projectMemoryVersion(memory, false);
  }

  /**
   * One write at a time in this window: a write lists, checks (the pinned
   * budget, a superseded id) and commits before the next one lists, so two
   * writes never both pass a check that only one of them can keep
   * (PR #200 F-04). Another window's writes are the store's to order.
   */
  private owe<T>(action: string, write: () => Promise<T>): Promise<T> {
    const running = this.queue.then(write).catch((error: unknown) => {
      this.log(`${action} failed (${error instanceof Error ? error.name : 'error'})`);
      return { kind: 'refused', reason: 'failed' } as unknown as T;
    });
    this.queue = running;
    this.owed.add(running);
    void running.finally(() => this.owed.delete(running));
    return running;
  }

  private refused(action: string, reason: ProjectMemoryWriteRefusalReason, id?: string): ProjectMemoryWriteResult {
    this.log(`${action} refused${id ? ` id=${id}` : ''} reason=${reason}`);
    return { kind: 'refused', reason };
  }

  /** ISO 8601 UTC, second precision, as the store stamps a new memory. */
  private stamp(): string {
    return this.now().toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  private log(line: string): void {
    this.outputChannel.appendLine(`[ProjectMemoryLibrary] ${line}`);
  }
}

/** Whether the change touches what the memory says (D10): the fields `updated` follows. */
function saysSomethingElse(before: ProjectMemory, after: ProjectMemory): boolean {
  return before.title !== after.title
    || before.kind !== after.kind
    || before.summary !== after.summary
    || before.body !== after.body
    || before.supersedes.join(',') !== after.supersedes.join(',');
}

/**
 * Memories loaded in full, with `candidate` in place of the memory `id`
 * names (or added, for a new one), by the frame's renderer and estimator.
 * Refused when the candidate loads in full, the total passes the budget,
 * and the change grows it: shortening an over-budget memory, or turning one
 * off, is always allowed.
 */
export function pinnedBudget(
  memories: readonly ProjectMemoryListed[],
  candidate: ProjectMemory,
  id: string | undefined
): WorkshopMemoryPinnedEstimate {
  const total = (set: readonly ProjectMemoryListed[]): number => set
    .filter((listed) => listed.memory.pinned && isProjectMemoryInEffect(listed))
    .reduce((sum, listed) => sum + projectMemoryPinnedTokens(listed), 0);
  const before = total(memories);
  const others = memories.filter(({ memory }) => memory.id !== id).map(({ memory, busy }) => ({ memory, ...(busy ? { busy: true as const } : {}) }));
  const after = listProjectMemories([...others, { memory: candidate }]);
  const totalTokens = total(after);
  const self = after.find(({ memory }) => memory === candidate)
    ?? { memory: candidate, superseded: false, supersededBy: [], busy: false, version: projectMemoryVersion(candidate, false) };
  return {
    thisTokens: projectMemoryPinnedTokens(self),
    totalTokens,
    budgetTokens: PINNED_BUDGET,
    refused: candidate.pinned && totalTokens > PINNED_BUDGET && totalTokens > before
  };
}
