/**
 * Where a memory set to load in full lands when it doesn't fit (PR #199
 * F-02), against the real frame renderer. Such a memory is only a list
 * candidate, subject to the list's own count and token limits, so the
 * views say what the renderer actually did: in full, listed, by title
 * only (ADR 2026-11-17 D8), or searchable only. Made-up Alice notes. The
 * PR #199 cases run with no room for titles, so they still reach
 * "searchable only"; the cases after them run at Standard's budgets.
 */

import { renderProjectMemoryFrame } from '@/application/services/workshop/memory/ProjectMemoryCatalogFrame';
import { listProjectMemories } from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';
import type { ProjectMemory } from '@shared/types/projectMemory';
import { workshopMemoryTabView } from '@hooks/domain/workshop/memory/workshopMemoryTabView';
import { workshopMemoryManagerView } from '@hooks/domain/workshop/memory/workshopMemoryManagerView';
import type {
  WorkshopMemoryEntry,
  WorkshopMemoryFrameEstimate,
  WorkshopMemoryLibrary
} from '@hooks/domain/workshop/memory/workshopMemoryViewInputs';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_PROJECT_MEMORY_LIST_SIZES, type ProjectMemoryFrameBudgets } from '@shared/constants/workshopProjectMemoryListSizes';

/** Standard's list with no titles tier: a note past the list is searchable only. */
const NO_TITLES: ProjectMemoryFrameBudgets = { ...WORKSHOP_PROJECT_MEMORY_LIST_SIZES.standard, titleTokens: 0 };

function note(index: number, pinned: boolean, summary: string): ProjectMemory {
  const id = `mem-${index.toString(16).padStart(6, '0')}`;
  return {
    id,
    title: `Alice note ${index}`,
    kind: 'canon',
    summary,
    status: 'active',
    pinned,
    created: '2026-11-01T10:00:00Z',
    updated: '2026-11-01T10:00:00Z',
    origin: 'writer',
    sourceTurns: [],
    supersedes: [],
    body: `\n${'a'.repeat(8_000)}\n`
  };
}

/** What 4b-wire will hand the views, from the renderer's own result. */
function fromRenderer(memories: ProjectMemory[], budgets: ProjectMemoryFrameBudgets = NO_TITLES): { estimate: WorkshopMemoryFrameEstimate; library: WorkshopMemoryLibrary } {
  const set = { memories: listProjectMemories(memories.map((memory) => ({ memory }))), unreadable: 0, conflicts: 0 };
  const frame = renderProjectMemoryFrame(set, { builtOn: '2026-11-04', budgets });
  if (!frame) {
    throw new Error('no frame');
  }
  const loaded = new Set(frame.pinnedLoaded);
  const listed = new Set(frame.entries);
  const titled = new Set(frame.titles);
  const entries: WorkshopMemoryEntry[] = memories.map((memory) => ({
    entryKey: `key-${memory.id}`,
    id: memory.id,
    title: memory.title,
    kind: memory.kind,
    summary: memory.summary,
    status: memory.status,
    pinned: memory.pinned,
    created: memory.created,
    updated: memory.updated,
    origin: memory.origin,
    source: { kind: 'none' },
    superseded: false,
    supersededBy: [],
    busy: false,
    fullLoad: memory.pinned ? (loaded.has(memory.id) ? 'loaded' : 'doesnt-fit') : null,
    residency: loaded.has(memory.id) ? 'full' : listed.has(memory.id) ? 'listed' : titled.has(memory.id) ? 'titled' : 'searchable'
  }));
  return {
    estimate: {
      ...frame.estimate,
      catalogEntries: frame.entries.length,
      // Not what these tests read: the loaded bodies' tokens, within the budget.
      pinnedLoadedTokens: Math.min(frame.estimate.pinnedTokens, PROMPT_BUDGETS.workshopProjectMemory.pinnedTokens)
    },
    library: { memories: entries, unreadable: [], conflicts: [] }
  };
}

const views = (memories: ProjectMemory[], budgets: ProjectMemoryFrameBudgets = NO_TITLES) => {
  const { estimate, library } = fromRenderer(memories, budgets);
  // The views are handed the budgets the frame was held to, as the host's listing hands them.
  const stated = { ...budgets, contextWords: PROMPT_BUDGETS.contextAttachments.words };
  return {
    estimate,
    library,
    tab: workshopMemoryTabView({ mode: 'ask', workspace: { kind: 'available' }, estimate, saved: memories.length, unreadable: [], conflicts: [], budgets: stated }),
    manager: workshopMemoryManagerView({ mode: 'ask', library, estimate, budgets: stated })
  };
};

const rowNotes = (manager: ReturnType<typeof workshopMemoryManagerView>, residency: string, library: WorkshopMemoryLibrary) =>
  manager.active.filter((row) => library.memories.find((entry) => entry.entryKey === row.entry.entryKey)?.residency === residency)
    .map((row) => row.notes.join(' '));

describe('set to load in full past both budgets (PR #199 F-02)', () => {
  it('count-bound: 45 set, 2 in full, 40 listed, 3 searchable only, and every line says so', () => {
    const { estimate, library, tab, manager } = views(Array.from({ length: 45 }, (_, index) => note(index + 1, true, 'A short line.')));
    expect([estimate.pinnedLoaded, estimate.catalogEntries]).toEqual([2, 40]);

    expect(tab.load.more).toEqual([
      '43 memories set to load in full don’t fit: 40 load as list entries, and 3 are searchable only. Turn off Always load in full on one in Manage memories… to make room.'
    ]);
    expect(tab.load.more.join(' ')).not.toMatch(/more are searchable/);
    expect(manager.overNote).toContain('43 of them don’t fit: 40 load as list entries, and 3 are searchable only');

    const searchable = rowNotes(manager, 'searchable', library);
    expect(searchable).toHaveLength(3);
    for (const line of searchable) {
      expect(line).toBe('Doesn’t fit at the start: not in full, and the list is full too. Personas can still find it with memory search. Turn off Always load in full on another to make room.');
    }
    const listed = rowNotes(manager, 'listed', library);
    expect(listed).toHaveLength(40);
    expect(listed.every((line) => line.includes('so it loads as a list entry'))).toBe(true);
  });

  it('token-bound: long summaries fill the list before its count does', () => {
    const summary = 'S'.repeat(PROMPT_BUDGETS.workshopProjectMemory.summaryCharacters);
    const { estimate, library, tab, manager } = views(Array.from({ length: 32 }, (_, index) => note(index + 1, true, summary)));
    const listedCount = estimate.catalogEntries;
    expect(estimate.pinnedLoaded).toBe(2);
    expect(listedCount).toBeLessThan(30);
    const searchableCount = 30 - listedCount;
    expect(rowNotes(manager, 'searchable', library)).toHaveLength(searchableCount);
    expect(tab.load.more[0]).toBe(
      `30 memories set to load in full don’t fit: ${listedCount} load as list entries, and ${searchableCount} are searchable only. Turn off Always load in full on one in Manage memories… to make room.`
    );
  });

  it('unpinned memories past the list still read as “more are searchable”, apart from the ones set to load in full', () => {
    const memories = [
      ...Array.from({ length: 3 }, (_, index) => note(index + 1, true, 'A short line.')),
      ...Array.from({ length: 45 }, (_, index) => note(index + 100, false, 'A short line.'))
    ];
    const { tab } = views(memories);
    expect(tab.load.more).toEqual([
      '1 memory set to load in full doesn’t fit, so it loads as a list entry. Turn off Always load in full on one in Manage memories… to make room.',
      '6 more are searchable. Personas find them with memory search when the conversation needs them.'
    ]);
  });

  it('with no residency, a row promises nothing about the list', () => {
    const { library, estimate } = fromRenderer(Array.from({ length: 4 }, (_, index) => note(index + 1, true, 'A short line.')));
    const unknown = { ...library, memories: library.memories.map(({ residency: _residency, ...entry }) => entry) };
    const manager = workshopMemoryManagerView({ mode: 'ask', library: unknown, estimate });
    const notes = manager.active.filter((row) => row.entry.fullLoad === 'doesnt-fit').map((row) => row.notes.join(' '));
    expect(notes.length).toBeGreaterThan(0);
    for (const line of notes) {
      expect(line).toBe('Doesn’t fit in the 5,000 tokens loaded in full, so it doesn’t load whole. Turn off Always load in full on it or another to make room.');
    }
    expect(manager.overNote).not.toMatch(/list entr/);
  });
});

describe('set to load in full past the list, at Standard\'s budgets: shown by title (ADR 2026-11-17 D8)', () => {
  const STANDARD = WORKSHOP_PROJECT_MEMORY_LIST_SIZES.standard;

  it('count-bound: 45 set, 2 in full, 40 listed, 3 by title only, and every line says so', () => {
    const { estimate, library, tab, manager } = views(Array.from({ length: 45 }, (_, index) => note(index + 1, true, 'A short line.')), STANDARD);
    expect([estimate.pinnedLoaded, estimate.catalogEntries, estimate.titleEntries, estimate.unlisted]).toEqual([2, 40, 3, 0]);

    expect(tab.load.more).toEqual([
      '43 memories set to load in full don’t fit: 40 load as list entries, and 3 load by their titles only. Turn off Always load in full on one in Manage memories… to make room.'
    ]);
    expect(tab.load.meters.map((meter) => meter.key)).toEqual(['full', 'list', 'titles']);
    expect(tab.load.meters[2].left).toBe('Titles only · all 3 fit');
    expect(manager.overNote).toContain('43 of them don’t fit: 40 load as list entries, and 3 load by their titles only');

    const titled = rowNotes(manager, 'titled', library);
    expect(titled).toHaveLength(3);
    for (const line of titled) {
      expect(line).toBe('Doesn’t fit at the start: not in full, and the list is full too, so personas see its title only. Turn off Always load in full on another to make room.');
    }
    expect(rowNotes(manager, 'searchable', library)).toHaveLength(0);
    expect(rowNotes(manager, 'listed', library)).toHaveLength(40);
  });

  it('unpinned memories past the list are shown by title, so none is "searchable"', () => {
    const memories = [
      ...Array.from({ length: 3 }, (_, index) => note(index + 1, true, 'A short line.')),
      ...Array.from({ length: 45 }, (_, index) => note(index + 100, false, 'A short line.'))
    ];
    const { estimate, tab, library } = views(memories, STANDARD);
    expect([estimate.catalogEntries, estimate.titleEntries, estimate.unlisted]).toEqual([40, 6, 0]);
    expect(tab.load.more).toEqual([
      '1 memory set to load in full doesn’t fit, so it loads as a list entry. Turn off Always load in full on one in Manage memories… to make room.'
    ]);
    expect(library.memories.filter((entry) => entry.residency === 'titled')).toHaveLength(6);
    expect(tab.load.meters[2]).toMatchObject({ key: 'titles', left: 'Titles only · all 6 fit', full: false });
  });

  it('past the titles too: the rest are searchable only, and the three counts are the renderer\'s', () => {
    const title = 'T'.repeat(PROMPT_BUDGETS.workshopProjectMemory.titleCharacters - 6);
    const memories = Array.from({ length: 400 }, (_, index) => ({ ...note(index + 1, false, 'A short line.'), title: `${title}${index}` }));
    const { estimate, library, tab } = views(memories, STANDARD);
    const counts = (residency: string) => library.memories.filter((entry) => entry.residency === residency).length;
    expect(estimate.unlisted).toBeGreaterThan(0);
    expect([counts('listed'), counts('titled'), counts('searchable')]).toEqual([estimate.catalogEntries, estimate.titleEntries, estimate.unlisted]);
    expect(tab.load.meters[2]).toMatchObject({ key: 'titles', full: true, percent: 100 });
    expect(tab.load.meters[2].left).toBe(`Titles only · ${estimate.titleEntries} of ${400 - estimate.catalogEntries} fit`);
    expect(tab.load.more).toEqual([
      `${estimate.unlisted} more are searchable. Personas find them with memory search when the conversation needs them.`
    ]);
  });
});
