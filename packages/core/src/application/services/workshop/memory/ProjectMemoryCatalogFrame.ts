/**
 * The `<project-memory>` catalog frame (ADR 2026-11-04 D5): rendered once
 * into a conversation's first user message, bounded, and deterministic, so
 * the same folder always gives the same bytes. Pure.
 *
 * - Built from memories in effect only: active, readable, unconflicted and
 *   not superseded. A memory another window rewrites now stays in effect
 *   (D10, PR #194 N-02).
 * - Pinned bodies first, oldest `created` first (ties by id), whole, as many
 *   as fit in `pinnedTokens`. Loading stops at the first that does not fit:
 *   the order decides what loads, and no body is ever cut. The rest are
 *   entries marked `pinned="not-loaded"` (PR #192 F-04).
 * - Then entries by `updated`, newest first (ties by id), up to
 *   `catalogEntries` and `catalogTokens`; a not-loaded pinned entry leads.
 * - Then every other memory in effect as a `<title-only>` line (id, kind and
 *   title), in the same order, within `titleTokens`; the tier stops at the
 *   first line that does not fit, and has no entry cap (ADR 2026-11-17 D8).
 * - Then `<unlisted count>` for the memories in effect no tier shows, and
 *   `<more count>` for the superseded and archived ones. Each is written
 *   only when its count is above zero, so a folder whose list does not
 *   overflow and that holds no retired note renders as it always has.
 * - Every element's tokens are the engine's estimate (`estimateTextTokens`),
 *   so the tab's meter, which reads this renderer, is what loads.
 * - Titles, summaries and bodies are escaped: a memory cannot forge a frame.
 */

import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import {
  WORKSHOP_PROJECT_MEMORY_LIST_SIZES,
  type ProjectMemoryFrameBudgets
} from '@shared/constants/workshopProjectMemoryListSizes';
import {
  compareProjectMemoryNewestFirst,
  isProjectMemoryInEffect,
  type ProjectMemoryFrameEstimate,
  type ProjectMemoryListed,
  type ProjectMemorySet
} from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';
import {
  escapeProjectMemoryXml,
  projectMemoryDay,
  WORKSHOP_PROJECT_MEMORY_FRAMING,
  WORKSHOP_PROJECT_MEMORY_PINNED_NOT_LOADED
} from '@/application/services/workshop/memory/WorkshopProjectMemoryCopy';

export type { ProjectMemoryFrameBudgets };

export interface ProjectMemoryFrameOptions {
  /** The frame's `built` date, `YYYY-MM-DD`. */
  readonly builtOn: string;
  readonly budgets?: ProjectMemoryFrameBudgets;
}

export interface ProjectMemoryRenderedFrame {
  readonly text: string;
  /** The ids whose bodies loaded, and the ids shown as entries, in order. */
  readonly pinnedLoaded: readonly string[];
  readonly entries: readonly string[];
  /** The ids shown by title only, in order (ADR 2026-11-17 D8). */
  readonly titles: readonly string[];
  /** Memories in effect that no tier shows. */
  readonly unlisted: number;
  /** Superseded and archived memories: what `<more>` counts. */
  readonly more: number;
  readonly estimate: ProjectMemoryFrameEstimate;
}

/** Standard's row: the frame's default, and the update note's bound at every size (ADR 2026-11-17 D9). */
export const PROJECT_MEMORY_FRAME_BUDGETS: ProjectMemoryFrameBudgets = WORKSHOP_PROJECT_MEMORY_LIST_SIZES.standard;

const UNLISTED_LINE = 'More notes in effect, older: memory.catalog pages through them.';
const MORE_LINE = 'Superseded or archived notes, not in effect: memory.search with status all.';

/** The frame, or undefined when the folder holds nothing a frame could show. */
export function renderProjectMemoryFrame(
  set: ProjectMemorySet,
  options: ProjectMemoryFrameOptions
): ProjectMemoryRenderedFrame | undefined {
  const budgets = options.budgets ?? PROJECT_MEMORY_FRAME_BUDGETS;
  const inEffect = set.memories.filter(isProjectMemoryInEffect);
  const pinned = inEffect.filter(({ memory }) => memory.pinned).sort(compareProjectMemoryOldestCreated);
  const loaded: Array<{ listed: ProjectMemoryListed; line: string }> = [];
  const notLoaded: ProjectMemoryListed[] = [];
  let pinnedSpent = 0;
  let pinnedTotal = 0;
  for (const listed of pinned) {
    const line = projectMemoryPinnedLine(listed);
    const tokens = estimateTextTokens(line);
    pinnedTotal += tokens;
    if (notLoaded.length === 0 && pinnedSpent + tokens <= budgets.pinnedTokens) {
      loaded.push({ listed, line });
      pinnedSpent += tokens;
    } else {
      notLoaded.push(listed);
    }
  }

  // Not-loaded pinned notes lead, then the rest newest first: the entries take this order's head, the titles its tail.
  const candidates = [
    ...notLoaded.map((listed) => ({ listed, pinnedNotLoaded: true })),
    ...inEffect
      .filter(({ memory }) => !memory.pinned)
      .sort(compareProjectMemoryNewestFirst)
      .map((listed) => ({ listed, pinnedNotLoaded: false }))
  ];
  const entries: Array<{ listed: ProjectMemoryListed; line: string }> = [];
  let catalogSpent = 0;
  for (const { listed, pinnedNotLoaded } of candidates) {
    const line = projectMemoryEntryLine(listed, pinnedNotLoaded);
    const tokens = estimateTextTokens(line);
    if (entries.length >= budgets.catalogEntries || catalogSpent + tokens > budgets.catalogTokens) {
      break;
    }
    entries.push({ listed, line });
    catalogSpent += tokens;
  }
  const titles: typeof entries = [];
  let titleSpent = 0;
  for (const { listed, pinnedNotLoaded } of candidates.slice(entries.length)) {
    const line = projectMemoryTitleLine(listed, pinnedNotLoaded);
    const tokens = estimateTextTokens(line);
    if (titleSpent + tokens > budgets.titleTokens) {
      break;
    }
    titles.push({ listed, line });
    titleSpent += tokens;
  }

  const unlisted = candidates.length - entries.length - titles.length;
  const retired = set.memories.length - inEffect.length;
  if (inEffect.length === 0 && retired === 0) {
    return undefined;
  }
  const lines = [
    `<project-memory note="${escapeProjectMemoryXml(WORKSHOP_PROJECT_MEMORY_FRAMING)}" built="${escapeProjectMemoryXml(options.builtOn)}">`,
    ...loaded.map(({ line }) => `  ${line}`),
    ...entries.map(({ line }) => `  ${line}`),
    ...titles.map(({ line }) => `  ${line}`),
    ...(unlisted > 0 ? [`  <unlisted count="${unlisted}">${UNLISTED_LINE}</unlisted>`] : []),
    ...(retired > 0 ? [`  <more count="${retired}">${MORE_LINE}</more>`] : []),
    '</project-memory>'
  ];
  const text = lines.join('\n');
  return {
    text,
    pinnedLoaded: loaded.map(({ listed }) => listed.memory.id),
    entries: entries.map(({ listed }) => listed.memory.id),
    titles: titles.map(({ listed }) => listed.memory.id),
    unlisted,
    more: retired,
    estimate: {
      memories: inEffect.length,
      pinned: pinned.length,
      pinnedLoaded: loaded.length,
      pinnedTokens: pinnedTotal,
      pinnedOver: pinnedTotal > budgets.pinnedTokens,
      catalogTokens: catalogSpent,
      frameTokens: estimateTextTokens(text),
      pinnedLoadedTokens: pinnedSpent,
      catalogEntries: entries.length,
      titleTokens: titleSpent,
      titleEntries: titles.length,
      unlisted,
      retired
    }
  };
}

/** The memories in effect, with their versions, by id: what a frame or a note records as delivered (D14). */
export function projectMemorySnapshot(set: ProjectMemorySet): Array<{ id: string; version: string }> {
  return set.memories
    .filter(isProjectMemoryInEffect)
    .map(({ memory, version }) => ({ id: memory.id, version }))
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

/** What a folder's frame would cost, from this renderer; an empty frame costs nothing. */
export function estimateProjectMemoryFrameOf(set: ProjectMemorySet, options: ProjectMemoryFrameOptions): ProjectMemoryFrameEstimate {
  return renderProjectMemoryFrame(set, options)?.estimate ?? {
    memories: 0,
    pinned: 0,
    pinnedLoaded: 0,
    pinnedTokens: 0,
    pinnedOver: false,
    catalogTokens: 0,
    frameTokens: 0,
    pinnedLoadedTokens: 0,
    catalogEntries: 0,
    titleTokens: 0,
    titleEntries: 0,
    unlisted: 0,
    retired: 0
  };
}

/**
 * What one memory's body costs loaded in full: its `<pinned>` line, by the
 * frame's own renderer and estimator, so the sheet's refusal and the frame
 * agree (D5, PR #192 F-04).
 */
export function projectMemoryPinnedTokens(listed: ProjectMemoryListed): number {
  return estimateTextTokens(projectMemoryPinnedLine(listed));
}

/** A pinned memory's element, its whole body escaped: the frame's and the update note's. */
export function projectMemoryPinnedLine({ memory }: ProjectMemoryListed): string {
  return `<pinned id="${memory.id}" kind="${memory.kind}" updated="${projectMemoryDay(memory.updated)}" ` +
    `title="${escapeProjectMemoryXml(memory.title)}">${escapeProjectMemoryXml(memory.body.trim())}</pinned>`;
}

/** A memory's entry element: the frame's and the update note's. */
export function projectMemoryEntryLine({ memory }: ProjectMemoryListed, pinnedNotLoaded: boolean): string {
  const text = `${memory.title}: ${memory.summary}${pinnedNotLoaded ? ` (${WORKSHOP_PROJECT_MEMORY_PINNED_NOT_LOADED})` : ''}`;
  return `<entry id="${memory.id}" kind="${memory.kind}" updated="${projectMemoryDay(memory.updated)}"` +
    `${pinnedNotLoaded ? ' pinned="not-loaded"' : ''}>${escapeProjectMemoryXml(text)}</entry>`;
}

/** A memory's titles-tier element: id, kind and title, with no date and no summary (ADR 2026-11-17 D8). */
export function projectMemoryTitleLine({ memory }: ProjectMemoryListed, pinnedNotLoaded: boolean): string {
  return `<title-only id="${memory.id}" kind="${memory.kind}"${pinnedNotLoaded ? ' pinned="not-loaded"' : ''}>` +
    `${escapeProjectMemoryXml(memory.title)}</title-only>`;
}

/** Oldest `created` first, ties by id: the pinned order (D5; format 1 records no pin time). */
export function compareProjectMemoryOldestCreated(left: ProjectMemoryListed, right: ProjectMemoryListed): number {
  const created = Date.parse(left.memory.created) - Date.parse(right.memory.created);
  if (created !== 0 && Number.isFinite(created)) {
    return created;
  }
  return left.memory.id < right.memory.id ? -1 : left.memory.id > right.memory.id ? 1 : 0;
}
