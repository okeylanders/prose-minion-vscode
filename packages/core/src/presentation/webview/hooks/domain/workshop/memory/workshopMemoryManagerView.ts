/**
 * The memory manager as drawn (Slice 0d's "The memory manager"). Pure: the
 * host's listing and estimate in; the status line, the three sections and
 * every row's words out.
 *
 * - Needs attention: conflicting and unreadable files, each its own row,
 *   opened by its own `entryKey`; nothing else reaches them (D10, F-02).
 * - Active: memories in effect, grouped by kind or by date.
 * - Superseded and archived: never loaded; superseded is derived (D4).
 * - "Loaded in full" and "Doesn't fit in full" come from the builder's
 *   result on each row (`fullLoad`), never from dates (PR #196 F-03).
 */

import type { ProjectMemoryKind } from '@shared/types/projectMemory';
import { groupSavedItems, groupSavedItemsByDate, type SavedItemGroup } from '@utils/savedItemGroups';
import type {
  WorkshopMemoryBudgets,
  WorkshopMemoryEntry,
  WorkshopMemoryFrameEstimate,
  WorkshopMemoryLibrary,
  WorkshopMemoryLoadInFullRefusal,
  WorkshopProjectMemoryMode
} from './workshopMemoryViewInputs';
import { WORKSHOP_MEMORY_BUDGETS } from './workshopMemoryViewInputs';
import {
  MEMORY_KIND_GROUPS,
  MEMORY_KIND_WORDS,
  aboutTokens,
  filesWord,
  memoryCount,
  memoryDay,
  memoryInEffect,
  memoryOriginWords,
  memorySourceWords,
  plainList,
  quotedList,
  unreadableReasonSentence,
  WORKSHOP_MEMORY_SET_ASIDE
} from './workshopMemoryWords';

export interface WorkshopMemoryManagerInput {
  readonly mode: WorkshopProjectMemoryMode;
  readonly library: WorkshopMemoryLibrary;
  readonly estimate?: WorkshopMemoryFrameEstimate;
  readonly refusal?: WorkshopMemoryLoadInFullRefusal;
  readonly budgets?: WorkshopMemoryBudgets;
}

export interface WorkshopMemoryChip {
  readonly text: string;
  readonly warn: boolean;
}

export interface WorkshopMemoryAttentionRow {
  readonly entryKey: string;
  readonly fileName: string;
  readonly badge: 'Same id' | 'Can’t read' | 'Set aside';
  readonly meta: string;
  readonly reason: string;
  /** Open file is offered: false for a set-aside copy, whose row names the standing file beside it. */
  readonly canOpen: boolean;
}

export interface WorkshopMemoryBadge {
  readonly text: string;
  readonly tone: 'accent' | 'amber' | 'muted';
}

export interface WorkshopMemoryRowView {
  readonly entry: WorkshopMemoryEntry;
  readonly kindWords: string;
  readonly origin: string;
  readonly day: string;
  readonly source: string;
  readonly badges: readonly WorkshopMemoryBadge[];
  /** Under the meta line: the summary, or a past row's standing. */
  readonly line: string;
  /** Amber notes under the row: a refused Always load in full, or a body that didn't fit. */
  readonly notes: readonly string[];
  readonly primary: 'edit' | 'restore';
  /** Whether Always load in full and Archive are offered (active rows only). */
  readonly activeActions: boolean;
}

export interface WorkshopMemoryManagerView {
  readonly offNote?: string;
  readonly overNote?: string;
  readonly chips: readonly WorkshopMemoryChip[];
  readonly attention: readonly WorkshopMemoryAttentionRow[];
  readonly active: readonly WorkshopMemoryRowView[];
  readonly past: readonly WorkshopMemoryRowView[];
}

export const WORKSHOP_MEMORY_OFF_NOTE =
  'Memory is off, so personas don’t read these. You can still edit, archive and delete them, and change which load in full. Turn memory on in Conversation settings.';

export function workshopMemoryManagerView(input: WorkshopMemoryManagerInput): WorkshopMemoryManagerView {
  const budgets = input.budgets ?? WORKSHOP_MEMORY_BUDGETS;
  const memories = input.library.memories;
  const titles = new Map(memories.map((entry) => [entry.id, entry.title]));
  const ordered = [...memories].sort(newestFirst);
  const activeEntries = ordered.filter(memoryInEffect);
  const pastEntries = ordered.filter((entry) => !memoryInEffect(entry));
  const attention = attentionRows(input.library);
  const doesntFit = activeEntries.filter((entry) => entry.fullLoad === 'doesnt-fit');
  const over = input.estimate?.pinnedOver === true;

  return {
    ...(input.mode === 'off' ? { offNote: WORKSHOP_MEMORY_OFF_NOTE } : {}),
    ...(over && doesntFit.length > 0 ? { overNote: overNote(doesntFit, budgets) } : {}),
    chips: chips(activeEntries.length, attention.length, input.estimate, budgets),
    attention,
    active: activeEntries.map((entry) => rowView(entry, titles, input.refusal, budgets)),
    past: pastEntries.map((entry) => rowView(entry, titles, input.refusal, budgets))
  };
}

/** The Active section grouped by kind, in the design's order. */
export function groupMemoriesByKind(rows: readonly WorkshopMemoryRowView[]): Array<SavedItemGroup<WorkshopMemoryRowView>> {
  const order = new Map<ProjectMemoryKind, number>(MEMORY_KIND_GROUPS.map((group, index) => [group.kind, index]));
  return groupSavedItems(rows, (row) => {
    const index = order.get(row.entry.kind) ?? MEMORY_KIND_GROUPS.length;
    return { key: row.entry.kind, label: MEMORY_KIND_GROUPS[index]?.label ?? row.kindWords, order: index };
  });
}

/** The Active section grouped by when each memory last changed: Today, This week, Earlier. */
export function groupMemoriesByDate(rows: readonly WorkshopMemoryRowView[], now: Date = new Date()): Array<SavedItemGroup<WorkshopMemoryRowView>> {
  return groupSavedItemsByDate(rows, (row) => Date.parse(row.entry.updated), now);
}

/** The refusal of a rename the codec would refuse: a title is one non-empty line of at most `limit` characters. */
export function workshopMemoryTitleRule(limit: number): (draft: string) => string | undefined {
  return (draft) => {
    const title = draft.trim();
    if (title.length === 0) {
      return 'A memory needs a title.';
    }
    if (/[\r\n]/.test(title)) {
      return 'A title is one line.';
    }
    if (title.length > limit) {
      return `A title is at most ${memoryCount(limit)} characters.`;
    }
    return undefined;
  };
}

function chips(
  active: number,
  attention: number,
  estimate: WorkshopMemoryFrameEstimate | undefined,
  budgets: WorkshopMemoryBudgets
): WorkshopMemoryChip[] {
  const budget = memoryCount(budgets.pinnedTokens);
  const result: WorkshopMemoryChip[] = [{ text: `${memoryCount(active)} active`, warn: false }];
  if (estimate) {
    result.push(estimate.pinnedOver
      ? {
        text: `${memoryCount(estimate.pinned)} set to load in full · ${memoryCount(estimate.pinnedLoaded)} loaded · ≈ ${aboutTokens(estimate.pinnedTokens, true)} requested of ${budget} tokens`,
        warn: true
      }
      : {
        text: `${memoryCount(estimate.pinnedLoaded)} in full · ≈ ${aboutTokens(Math.min(estimate.pinnedLoadedTokens, budgets.pinnedTokens))} of ${budget} tokens`,
        warn: false
      });
    result.push({
      text: `list · ≈ ${aboutTokens(Math.min(estimate.catalogTokens, budgets.catalogTokens))} of ${memoryCount(budgets.catalogTokens)} tokens`,
      warn: false
    });
  }
  if (attention > 0) {
    result.push({ text: `${filesWord(attention)} ${attention === 1 ? 'needs' : 'need'} attention`, warn: true });
  }
  return result;
}

function overNote(doesntFit: readonly WorkshopMemoryEntry[], budgets: WorkshopMemoryBudgets): string {
  const one = doesntFit.length === 1;
  const subject = doesntFit.length <= 2 ? quotedList(doesntFit.map((entry) => entry.title)) : `${memoryCount(doesntFit.length)} of them`;
  const fit = one ? 'doesn’t fit' : 'don’t fit';
  // What became of them is the renderer's per row; a row the host says nothing of promises nothing (PR #199 F-02).
  const known = doesntFit.every((entry) => entry.residency === 'listed' || entry.residency === 'searchable');
  const listed = doesntFit.filter((entry) => entry.residency === 'listed').length;
  const searchable = doesntFit.length - listed;
  const which = !known
    ? `${subject} ${fit}, so ${one ? 'it doesn’t' : 'they don’t'} load whole`
    : searchable === 0
      ? `${subject} ${fit}, so ${one ? 'it loads as a list entry' : 'they load as list entries'} instead`
      : listed === 0
        ? `${subject} ${fit}, and the list is full too, so ${one ? 'it’s' : 'they’re'} searchable only`
        : `${memoryCount(doesntFit.length)} of them don’t fit: ${listed === 1 ? '1 loads as a list entry' : `${memoryCount(listed)} load as list entries`}, ` +
          `and ${searchable === 1 ? '1 is' : `${memoryCount(searchable)} are`} searchable only`;
  return `Memories set to load in full are over their ${memoryCount(budgets.pinnedTokens)}-token budget, probably from an edit outside the manager. ` +
    `They’re considered oldest-created first, and ${which}. Turn off Always load in full on one to make room. Nothing is changed for you.`;
}

function attentionRows(library: WorkshopMemoryLibrary): WorkshopMemoryAttentionRow[] {
  const conflicts = library.conflicts.flatMap((conflict) => conflict.files.map((file) => {
    const others = conflict.files.filter((other) => other.entryKey !== file.entryKey).map((other) => other.fileName);
    return {
      entryKey: file.entryKey,
      fileName: file.fileName,
      badge: 'Same id' as const,
      meta: conflict.id,
      reason: `Same id as ${plainList(others)}. Change one file’s id, or delete one copy.`,
      canOpen: true
    };
  }));
  const unreadable = library.unreadable.map((file) => {
    const setAside = file.reason === WORKSHOP_MEMORY_SET_ASIDE;
    return {
      entryKey: file.entryKey,
      fileName: file.fileName,
      badge: setAside ? 'Set aside' as const : 'Can’t read' as const,
      meta: setAside ? 'set aside' : 'unreadable',
      reason: unreadableReasonSentence(file.reason, file.key),
      canOpen: !setAside
    };
  });
  return [...conflicts, ...unreadable];
}

function rowView(
  entry: WorkshopMemoryEntry,
  titles: ReadonlyMap<string, string>,
  refusal: WorkshopMemoryLoadInFullRefusal | undefined,
  budgets: WorkshopMemoryBudgets
): WorkshopMemoryRowView {
  const inEffect = memoryInEffect(entry);
  const archived = entry.status === 'archived';
  const budget = memoryCount(budgets.pinnedTokens);
  const badges: WorkshopMemoryBadge[] = [];
  if (inEffect && entry.fullLoad === 'loaded') {
    badges.push({ text: 'Loaded in full', tone: 'accent' });
  } else if (inEffect && entry.fullLoad === 'doesnt-fit') {
    badges.push({ text: 'Doesn’t fit in full', tone: 'amber' });
  }
  if (!inEffect) {
    badges.push({ text: archived ? 'Archived' : 'Superseded', tone: 'muted' });
  }
  if (entry.busy) {
    badges.push({ text: 'Being edited', tone: 'muted' });
  }
  const notes: string[] = [];
  if (inEffect && refusal?.entryKey === entry.entryKey) {
    notes.push(`Can’t load this one in full: memories loaded in full would come to about ${aboutTokens(refusal.wouldBeTokens, true)} of ${budget} tokens. Turn it off on another, or shorten this note.`);
  }
  if (inEffect && entry.fullLoad === 'doesnt-fit') {
    notes.push(entry.residency === 'listed'
      ? `Doesn’t fit in the ${budget} tokens loaded in full, so it loads as a list entry. Turn off Always load in full on it or another to make room.`
      : entry.residency === 'searchable'
        ? 'Doesn’t fit at the start: not in full, and the list is full too. Personas can still find it with memory search. Turn off Always load in full on another to make room.'
        : `Doesn’t fit in the ${budget} tokens loaded in full, so it doesn’t load whole. Turn off Always load in full on it or another to make room.`);
  }
  if (entry.busy) {
    notes.push('Another VS Code window is changing this memory. Edit, archive and delete come back when it’s done.');
  }
  return {
    entry,
    kindWords: MEMORY_KIND_WORDS[entry.kind],
    origin: memoryOriginWords(entry.origin, entry.proposedByLabel),
    day: memoryDay(entry.updated),
    source: memorySourceWords(entry.source),
    badges,
    line: inEffect
      ? entry.summary
      : archived
        ? 'Archived. Restore to make this memory active again.'
        : `Superseded by ${quotedList(entry.supersededBy.map((id) => titles.get(id) ?? 'another memory'))}.`,
    notes,
    primary: archived ? 'restore' : 'edit',
    activeActions: inEffect
  };
}

/** By `updated`, newest first, ties by id: the catalog's order (D1). */
function newestFirst(left: WorkshopMemoryEntry, right: WorkshopMemoryEntry): number {
  const updated = Date.parse(right.updated) - Date.parse(left.updated);
  if (updated !== 0 && Number.isFinite(updated)) {
    return updated;
  }
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}
