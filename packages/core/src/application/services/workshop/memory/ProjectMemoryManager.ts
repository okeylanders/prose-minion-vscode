/**
 * The folder as the Memory tab and the manager draw it (ADR 2026-11-04 D5,
 * D8, D10; epic Slice 4b): the writer's view, read with memory Off too, and
 * refused only where this workspace holds no memory.
 *
 * - **One listing, the frame's renderer.** Standing comes from
 *   `listProjectMemories` (accepted supersession links, PR #197 N-02), the
 *   estimate and each memory's residency from `renderProjectMemoryFrame`
 *   over the same set: what loaded whole, what was listed, what is
 *   searchable only. Nothing is inferred (PR #196 F-03, PR #199 F-02).
 * - **Every row the host can name** carries an `entryKey`: memories,
 *   unreadable and set-aside files, and each file of a conflict. Open file
 *   resolves a key against a fresh listing; a set-aside copy has none to
 *   open (its row names the standing file beside it).
 * - **Search** is the host's (titles, summaries and notes, by recall's term
 *   rules); files needing attention are always shown.
 * - **Logs** carry counts and reasons, never a title, summary, body or path.
 */

import * as path from 'path';
import type { LogSink } from '@/platform';
import type {
  WorkshopMemoryListingPayload,
  WorkshopMemoryManagerEntry,
  WorkshopMemoryManagerSource,
  WorkshopMemoryResidency
} from '@messages';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import type { WorkshopPersonaId } from '@messages';
import type { ProjectMemoryStore } from '@/infrastructure/storage/ProjectMemoryStore';
import { projectMemoryEntryKey, PROJECT_MEMORY_ENTRY_KEY } from '@/infrastructure/storage/ProjectMemoryEntryKey';
import {
  isProjectMemoryInEffect,
  listProjectMemories,
  type ProjectMemoryClosedReason,
  type ProjectMemoryListed
} from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';
import { estimateProjectMemoryFrameOf, renderProjectMemoryFrame } from '@/application/services/workshop/memory/ProjectMemoryCatalogFrame';
import { searchProjectMemories } from '@/application/services/workshop/memory/WorkshopProjectMemorySearch';
import type { ProjectMemoryPositionsPort } from '@/application/services/workshop/memory/ProjectMemoryLibrary';

/** The store's methods the manager reads; satisfied by ProjectMemoryStore. */
export type ProjectMemoryManagerStorePort = Pick<ProjectMemoryStore, 'availability' | 'list' | 'ensureFolder'>;

/** The listing without its request id: the handler adds it. */
export type ProjectMemoryManagerListing = Omit<WorkshopMemoryListingPayload, 'requestId'>;

/** A file to open, or why there is none. */
export type ProjectMemoryManagerFile =
  | { readonly kind: 'file'; readonly path: string }
  | { readonly kind: 'refused'; readonly reason: 'stale' | 'set-aside' | 'unavailable' | 'unknown' };

export type ProjectMemoryManagerFolder =
  | { readonly kind: 'folder'; readonly path: string }
  | { readonly kind: 'refused'; readonly reason: 'unavailable' | 'failed' };

const LOG = '[ProjectMemoryManager]';

export class ProjectMemoryManager {
  constructor(
    private readonly store: ProjectMemoryManagerStorePort,
    /** This workspace's reason to hold no memory now, read live (D8, D10). */
    private readonly workspaceReason: () => ProjectMemoryClosedReason | undefined,
    private readonly recall: ProjectMemoryPositionsPort,
    private readonly now: () => Date,
    private readonly outputChannel: LogSink
  ) {}

  /** The folder, its estimate and every row the query matches. */
  async listing(query: string): Promise<ProjectMemoryManagerListing> {
    const empty = { saved: 0, memories: [], unreadable: [], conflicts: [] };
    const read = await this.read();
    if (read.kind !== 'read') {
      return { ...empty, workspace: read.workspace };
    }
    const { listed, directory, listing } = read;
    const fileOf = new Map(listing.memories.map((entry) => [entry.memory.id, entry.fileName]));
    const builtOn = this.now().toISOString().slice(0, 10);
    const set = { memories: listed, unreadable: listing.unreadable.length, conflicts: listing.conflicts.length };
    const frame = renderProjectMemoryFrame(set, { builtOn });
    const loaded = new Set(frame?.pinnedLoaded ?? []);
    const entries = new Set(frame?.entries ?? []);
    const matched = query.trim().length === 0
      ? listed
      : searchProjectMemories(listed, query, 'all', { hits: listed.length, snippetCharacters: 1 }).hits.map((hit) => hit.listed);
    const titles = await this.sessionTitles(matched);
    const memories = matched.map((item): WorkshopMemoryManagerEntry => {
      const inEffect = isProjectMemoryInEffect(item);
      const residency: WorkshopMemoryResidency = loaded.has(item.memory.id) ? 'full' : entries.has(item.memory.id) ? 'listed' : 'searchable';
      const memory = item.memory;
      return {
        entryKey: projectMemoryEntryKey('memory', path.join(directory, fileOf.get(memory.id) ?? '')),
        id: memory.id,
        title: memory.title,
        kind: memory.kind,
        summary: memory.summary,
        status: memory.status,
        pinned: memory.pinned,
        created: memory.created,
        updated: memory.updated,
        origin: memory.origin,
        ...(memory.proposedBy ? { proposedByLabel: workshopPersonaLabel(memory.proposedBy as WorkshopPersonaId) } : {}),
        source: sourceOf(memory.sourceSession, titles),
        superseded: item.superseded,
        supersededBy: [...item.supersededBy],
        busy: item.busy,
        fullLoad: memory.pinned && inEffect ? (loaded.has(memory.id) ? 'loaded' : 'doesnt-fit') : null,
        ...(inEffect ? { residency } : {})
      };
    });
    this.log(`listed memories=${listed.length} shown=${memories.length} unreadable=${listing.unreadable.length} conflicts=${listing.conflicts.length}`);
    return {
      workspace: { kind: 'available' },
      saved: listed.length,
      estimate: frame?.estimate ?? estimateProjectMemoryFrameOf(set, { builtOn }),
      memories,
      unreadable: listing.unreadable.map((file) => ({
        entryKey: projectMemoryEntryKey(file.reason === 'set-aside' ? 'set-aside' : 'file', path.join(directory, file.fileName)),
        fileName: file.fileName,
        reason: file.reason,
        ...(file.key ? { key: file.key } : {})
      })),
      conflicts: listing.conflicts.map((conflict) => ({
        id: conflict.id,
        files: conflict.fileNames.map((fileName) => ({ entryKey: projectMemoryEntryKey('file', path.join(directory, fileName)), fileName }))
      }))
    };
  }

  /** The file a key names in the folder as it is listed now; never a path the webview sent. */
  async fileOf(entryKey: string): Promise<ProjectMemoryManagerFile> {
    if (!PROJECT_MEMORY_ENTRY_KEY.test(entryKey)) {
      return this.refuse('stale');
    }
    const read = await this.read();
    if (read.kind !== 'read') {
      return this.refuse(read.workspace.kind === 'unavailable' ? 'unavailable' : 'unknown');
    }
    const { directory, listing } = read;
    const candidates: Array<[string, string]> = [
      ...listing.memories.map((entry): [string, string] => [projectMemoryEntryKey('memory', path.join(directory, entry.fileName)), entry.fileName]),
      ...listing.unreadable.filter((file) => file.reason !== 'set-aside')
        .map((file): [string, string] => [projectMemoryEntryKey('file', path.join(directory, file.fileName)), file.fileName]),
      ...listing.conflicts.flatMap((conflict) => conflict.fileNames.map((fileName): [string, string] => [projectMemoryEntryKey('file', path.join(directory, fileName)), fileName]))
    ];
    const found = candidates.find(([key]) => key === entryKey);
    if (found) {
      return { kind: 'file', path: path.join(directory, found[1]) };
    }
    const setAside = listing.unreadable.some((file) => file.reason === 'set-aside' && projectMemoryEntryKey('set-aside', path.join(directory, file.fileName)) === entryKey);
    return this.refuse(setAside ? 'set-aside' : 'stale');
  }

  /** The memory folder, made when it isn't there yet. */
  async folder(): Promise<ProjectMemoryManagerFolder> {
    if (this.workspaceReason()) {
      return { kind: 'refused', reason: 'unavailable' };
    }
    try {
      const availability = await this.store.ensureFolder();
      return availability.available ? { kind: 'folder', path: availability.directory } : { kind: 'refused', reason: 'unavailable' };
    } catch (error) {
      this.log(`folder failed (${error instanceof Error ? error.name : 'error'})`);
      return { kind: 'refused', reason: 'failed' };
    }
  }

  private async read(): Promise<
    | { kind: 'read'; listed: ProjectMemoryListed[]; directory: string; listing: Extract<Awaited<ReturnType<ProjectMemoryManagerStorePort['list']>>, { kind: 'listed' }> }
    | { kind: 'closed'; workspace: ProjectMemoryManagerListing['workspace'] }
  > {
    const before = this.workspaceReason();
    const availability = this.store.availability();
    if (before || !availability.available) {
      return { kind: 'closed', workspace: workspaceOf(before, availability.available ? undefined : availability.reason) };
    }
    const listing = await this.store.list();
    const after = this.workspaceReason();
    if (after) {
      return { kind: 'closed', workspace: workspaceOf(after, undefined) };
    }
    if (listing.kind === 'unavailable') {
      return { kind: 'closed', workspace: { kind: 'unavailable', reason: listing.reason } };
    }
    if (listing.kind === 'unknown') {
      this.log('the memory folder could not be read');
      return { kind: 'closed', workspace: { kind: 'unknown' } };
    }
    return { kind: 'read', listed: listProjectMemories(listing.memories), directory: availability.directory, listing };
  }

  /** Each named source session's title, asked once per session; anything else can't be named now. */
  private async sessionTitles(listed: readonly ProjectMemoryListed[]): Promise<Map<string, string>> {
    const titles = new Map<string, string>();
    const sessions = [...new Set(listed.flatMap(({ memory }) => (memory.sourceSession ? [memory.sourceSession] : [])))];
    for (const sessionId of sessions) {
      try {
        const found = await this.recall.positionsOf(sessionId, []);
        if (found.kind === 'positions') {
          titles.set(sessionId, found.title);
        }
      } catch {
        this.log('a source session could not be named');
      }
    }
    return titles;
  }

  private refuse(reason: Extract<ProjectMemoryManagerFile, { kind: 'refused' }>['reason']): ProjectMemoryManagerFile {
    this.log(`open file refused reason=${reason}`);
    return { kind: 'refused', reason };
  }

  private log(line: string): void {
    this.outputChannel.appendLine(`${LOG} ${line}`);
  }
}

function sourceOf(sessionId: string | undefined, titles: ReadonlyMap<string, string>): WorkshopMemoryManagerSource {
  if (!sessionId) {
    return { kind: 'none' };
  }
  const title = titles.get(sessionId);
  return title ? { kind: 'session', title } : { kind: 'unnamed' };
}

/**
 * The tab's and manager's workspace states. No folder and several are the
 * writer's to fix; a changed root or a room still loading reads as "couldn't
 * be listed just now", which is true and passes.
 */
function workspaceOf(
  reason: ProjectMemoryClosedReason | undefined,
  storeReason: 'no-workspace' | 'multi-root' | undefined
): ProjectMemoryManagerListing['workspace'] {
  const unavailable = reason === 'no-workspace' || reason === 'multi-root' ? reason : storeReason;
  return unavailable ? { kind: 'unavailable', reason: unavailable } : { kind: 'unknown' };
}
