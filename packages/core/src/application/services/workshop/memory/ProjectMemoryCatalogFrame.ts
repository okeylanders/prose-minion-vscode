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
 * - Then one `<more count>` for every memory not shown, superseded and
 *   archived ones included.
 * - Every element's tokens are the engine's estimate (`estimateTextTokens`),
 *   so the tab's meter, which reads this renderer, is what loads.
 * - Titles, summaries and bodies are escaped: a memory cannot forge a frame.
 */

import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
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

export interface ProjectMemoryFrameBudgets {
  readonly pinnedTokens: number;
  readonly catalogTokens: number;
  readonly catalogEntries: number;
}

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
  /** Readable memories the frame does not show. */
  readonly more: number;
  readonly estimate: ProjectMemoryFrameEstimate;
}

export const PROJECT_MEMORY_FRAME_BUDGETS: ProjectMemoryFrameBudgets = Object.freeze({
  pinnedTokens: PROMPT_BUDGETS.workshopProjectMemory.pinnedTokens,
  catalogTokens: PROMPT_BUDGETS.workshopProjectMemory.catalogTokens,
  catalogEntries: PROMPT_BUDGETS.workshopProjectMemory.catalogEntries
});

/** The frame, or undefined when the folder holds nothing a frame could show. */
export function renderProjectMemoryFrame(
  set: ProjectMemorySet,
  options: ProjectMemoryFrameOptions
): ProjectMemoryRenderedFrame | undefined {
  const budgets = options.budgets ?? PROJECT_MEMORY_FRAME_BUDGETS;
  const inEffect = set.memories.filter(isProjectMemoryInEffect);
  const pinned = inEffect.filter(({ memory }) => memory.pinned).sort(compareOldestCreated);
  const loaded: Array<{ listed: ProjectMemoryListed; line: string }> = [];
  const notLoaded: ProjectMemoryListed[] = [];
  let pinnedSpent = 0;
  let pinnedTotal = 0;
  for (const listed of pinned) {
    const line = pinnedLine(listed);
    const tokens = estimateTextTokens(line);
    pinnedTotal += tokens;
    if (notLoaded.length === 0 && pinnedSpent + tokens <= budgets.pinnedTokens) {
      loaded.push({ listed, line });
      pinnedSpent += tokens;
    } else {
      notLoaded.push(listed);
    }
  }

  const candidates = [
    ...notLoaded.map((listed) => ({ listed, line: entryLine(listed, true) })),
    ...inEffect
      .filter(({ memory }) => !memory.pinned)
      .sort(compareProjectMemoryNewestFirst)
      .map((listed) => ({ listed, line: entryLine(listed, false) }))
  ];
  const entries: typeof candidates = [];
  let catalogSpent = 0;
  for (const candidate of candidates) {
    const tokens = estimateTextTokens(candidate.line);
    if (entries.length >= budgets.catalogEntries || catalogSpent + tokens > budgets.catalogTokens) {
      break;
    }
    entries.push(candidate);
    catalogSpent += tokens;
  }

  const more = set.memories.length - loaded.length - entries.length;
  if (loaded.length === 0 && entries.length === 0 && more === 0) {
    return undefined;
  }
  const lines = [
    `<project-memory note="${escapeProjectMemoryXml(WORKSHOP_PROJECT_MEMORY_FRAMING)}" built="${escapeProjectMemoryXml(options.builtOn)}">`,
    ...loaded.map(({ line }) => `  ${line}`),
    ...entries.map(({ line }) => `  ${line}`),
    ...(more > 0 ? [`  <more count="${more}">More notes, older, superseded or archived: memory.catalog, memory.search.</more>`] : []),
    '</project-memory>'
  ];
  const text = lines.join('\n');
  return {
    text,
    pinnedLoaded: loaded.map(({ listed }) => listed.memory.id),
    entries: entries.map(({ listed }) => listed.memory.id),
    more,
    estimate: {
      memories: inEffect.length,
      pinned: pinned.length,
      pinnedLoaded: loaded.length,
      pinnedTokens: pinnedTotal,
      pinnedOver: pinnedTotal > budgets.pinnedTokens,
      catalogTokens: catalogSpent,
      frameTokens: estimateTextTokens(text)
    }
  };
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
    frameTokens: 0
  };
}

function pinnedLine({ memory }: ProjectMemoryListed): string {
  return `<pinned id="${memory.id}" kind="${memory.kind}" updated="${projectMemoryDay(memory.updated)}" ` +
    `title="${escapeProjectMemoryXml(memory.title)}">${escapeProjectMemoryXml(memory.body.trim())}</pinned>`;
}

function entryLine({ memory }: ProjectMemoryListed, pinnedNotLoaded: boolean): string {
  const text = `${memory.title}: ${memory.summary}${pinnedNotLoaded ? ` (${WORKSHOP_PROJECT_MEMORY_PINNED_NOT_LOADED})` : ''}`;
  return `<entry id="${memory.id}" kind="${memory.kind}" updated="${projectMemoryDay(memory.updated)}"` +
    `${pinnedNotLoaded ? ' pinned="not-loaded"' : ''}>${escapeProjectMemoryXml(text)}</entry>`;
}

/** Oldest `created` first, ties by id: the pinned order (D5; format 1 records no pin time). */
function compareOldestCreated(left: ProjectMemoryListed, right: ProjectMemoryListed): number {
  const created = Date.parse(left.memory.created) - Date.parse(right.memory.created);
  if (created !== 0 && Number.isFinite(created)) {
    return created;
  }
  return left.memory.id < right.memory.id ? -1 : left.memory.id > right.memory.id ? 1 : 0;
}
