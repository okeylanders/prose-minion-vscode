/**
 * The memory manager as drawn (Slice 4b-ui): the canvas's Manager and
 * ManagerOverPinned states, plus memory off, conflicts, unreadable files,
 * the refused Always load in full, superseded and archived rows, grouping
 * and the title rule. Badges come from the builder's result on each row,
 * never from dates (PR #196 F-03).
 */

import {
  groupMemoriesByDate,
  groupMemoriesByKind,
  WORKSHOP_MEMORY_OFF_NOTE,
  workshopMemoryManagerView,
  workshopMemoryTitleRule,
  type WorkshopMemoryManagerInput
} from '@hooks/domain/workshop/memory/workshopMemoryManagerView';
import { FULL_OVER, managerLibrary, memoryEntry } from './workshopMemoryFixtures';

const IN_BUDGET_MANAGER = {
  memories: 6,
  pinned: 4,
  pinnedLoaded: 4,
  pinnedTokens: 4_290,
  pinnedOver: false,
  catalogTokens: 702,
  frameTokens: 5_050,
  pinnedLoadedTokens: 4_290,
  catalogEntries: 2
};

function manager(overrides: Partial<WorkshopMemoryManagerInput> = {}) {
  return workshopMemoryManagerView({ mode: 'ask', library: managerLibrary(), estimate: IN_BUDGET_MANAGER, ...overrides });
}

describe('workshopMemoryManagerView', () => {
  it('the status labels: active, in full, the list, and the files that need attention', () => {
    const view = manager();
    expect(view.chips).toEqual([
      { text: '6 active', warn: false },
      { text: '4 in full · ≈ 4,300 of 5,000 tokens', warn: false },
      { text: 'list · ≈ 700 of 2,000 tokens', warn: false },
      { text: '3 files need attention', warn: true }
    ]);
    expect(view.offNote).toBeUndefined();
    expect(view.overNote).toBeUndefined();
  });

  it('memory off: the info line first; every row keeps its actions', () => {
    const view = manager({ mode: 'off' });
    expect(view.offNote).toBe(WORKSHOP_MEMORY_OFF_NOTE);
    expect(view.offNote).toBe('Memory is off, so personas don’t read these. You can still edit, archive and delete them, and change which load in full. Turn memory on in Conversation settings.');
    expect(view.active.every((row) => row.activeActions)).toBe(true);
  });

  it('needs attention: each conflicting file its own row, then unreadable files, with the reason in words', () => {
    expect(manager().attention).toEqual([
      {
        entryKey: 'key-copy-a',
        fileName: 'rabbit-watch-runs-backward-7f3c2a.md',
        badge: 'Same id',
        meta: 'mem-7f3c2a',
        reason: 'Same id as rabbit-watch-copy-7f3c2a.md. Change one file’s id, or delete one copy.',
        canOpen: true
      },
      {
        entryKey: 'key-copy-b',
        fileName: 'rabbit-watch-copy-7f3c2a.md',
        badge: 'Same id',
        meta: 'mem-7f3c2a',
        reason: 'Same id as rabbit-watch-runs-backward-7f3c2a.md. Change one file’s id, or delete one copy.',
        canOpen: true
      },
      {
        entryKey: 'key-seating',
        fileName: 'tea-party-seating-1a9e04.md',
        badge: 'Can’t read',
        meta: 'unreadable',
        reason: '“kind” isn’t one Memory knows: decision, canon, preference or open-thread.',
        canOpen: true
      }
    ]);
  });

  it('a set-aside copy: its own badge and words, and no Open file, since its row names the standing file beside it', () => {
    const library = { ...managerLibrary(), unreadable: [{ entryKey: 'key-aside', fileName: 'cheshire-cat-1a0005.md', reason: 'set-aside' }], conflicts: [] };
    expect(workshopMemoryManagerView({ mode: 'ask', library }).attention).toEqual([{
      entryKey: 'key-aside',
      fileName: 'cheshire-cat-1a0005.md',
      badge: 'Set aside',
      meta: 'set aside',
      reason: 'A copy kept beside this file couldn’t be put back yet. Memory moves it to a file of its own as soon as it can, and never removes it.',
      canOpen: false
    }]);
    expect(manager().attention.every((row) => row.canOpen)).toBe(true);
  });

  it('active rows: in effect only, newest first, origin and source in words, the Loaded in full badge', () => {
    const view = manager();
    expect(view.active.map((row) => row.entry.title)).toEqual([
      'The Rabbit’s watch runs backward',
      'The Cheshire Cat is never seen arriving',
      'Keep the Duchess’s kitchen offstage',
      'We cut the Mock Turtle’s second song',
      'Does the Queen know the tarts were moved?',
      'Critique structure before line edits'
    ]);
    const kitchen = view.active[2];
    expect([kitchen.kindWords, kitchen.origin, kitchen.day, kitchen.source]).toEqual([
      'decision', 'suggested by Cliff · saved by you', 'Nov 2', 'from “Chapter 6 pass”'
    ]);
    expect(kitchen.badges).toEqual([{ text: 'Loaded in full', tone: 'accent' }]);
    expect(kitchen.line).toBe('A line of summary.');
    expect(kitchen.primary).toBe('edit');
    expect(view.active[1]).toMatchObject({ origin: 'saved by Jill', source: 'source conversation not available' });
    expect(view.active[5]).toMatchObject({ origin: 'written by you', source: 'no source conversation', kindWords: 'preference' });
    expect(view.active[4]).toMatchObject({ kindWords: 'open thread', badges: [] });
  });

  it('superseded and archived: never loaded, superseded by the newer memory’s title, archived restorable', () => {
    const [stops, tense] = manager().past;
    expect(stops).toMatchObject({
      badges: [{ text: 'Superseded', tone: 'muted' }],
      line: 'Superseded by “The Rabbit’s watch runs backward”.',
      primary: 'edit',
      activeActions: false
    });
    expect(tense).toMatchObject({
      badges: [{ text: 'Archived', tone: 'muted' }],
      line: 'Archived. Restore to make this memory active again.',
      primary: 'restore',
      activeActions: false,
      origin: 'saved by Cliff'
    });
  });

  it('archived and superseded: keeps why it’s replaced, and Restore promises no more than un-archiving (PR #199 N-01)', () => {
    const library = {
      memories: [
        memoryEntry({ id: 'mem-0000aa', title: 'The Rabbit’s watch runs backward' }),
        memoryEntry({ title: 'The Rabbit’s watch stops at six', status: 'archived', superseded: true, supersededBy: ['mem-0000aa'] })
      ],
      unreadable: [],
      conflicts: []
    };
    const [row] = workshopMemoryManagerView({ mode: 'ask', library }).past;
    expect(row).toMatchObject({
      badges: [{ text: 'Archived', tone: 'muted' }, { text: 'Superseded', tone: 'muted' }],
      line: 'Superseded by “The Rabbit’s watch runs backward”. Restore un-archives it, but the newer memory still replaces it.',
      primary: 'restore'
    });
  });

  it('a superseding memory the manager can’t list is “another memory”; several are joined', () => {
    const library = {
      memories: [memoryEntry({ title: 'Old', superseded: true, supersededBy: ['mem-ffffff', 'mem-eeeeee'] })],
      unreadable: [],
      conflicts: []
    };
    expect(workshopMemoryManagerView({ mode: 'ask', library }).past[0].line).toBe('Superseded by “another memory” and “another memory”.');
  });

  it('over its budget: set apart from loaded in the label, the status line names what doesn’t fit, that row says why', () => {
    const view = manager({ library: managerLibrary(true), estimate: { ...FULL_OVER, memories: 6 } });
    expect(view.chips[1]).toEqual({ text: '4 set to load in full · 3 loaded · ≈ 5,600 requested of 5,000 tokens', warn: true });
    expect(view.overNote).toBe(
      'Memories set to load in full are over their 5,000-token budget, probably from an edit outside the manager. ' +
      'They’re considered oldest-created first, and “The Cheshire Cat is never seen arriving” doesn’t fit, so it loads as a list entry instead. ' +
      'Turn off Always load in full on one to make room. Nothing is changed for you.'
    );
    const cat = view.active.find((row) => row.entry.entryKey === 'key-cat');
    expect(cat?.badges).toEqual([{ text: 'Doesn’t fit in full', tone: 'amber' }]);
    expect(cat?.notes).toEqual(['Doesn’t fit in the 5,000 tokens loaded in full, so it loads as a list entry. Turn off Always load in full on it or another to make room.']);
    expect(view.active.filter((row) => row.badges.some((badge) => badge.text === 'Loaded in full'))).toHaveLength(3);
  });

  it('reads the builder’s result, never the dates: the newest-created memory can be the one loaded', () => {
    const library = {
      memories: [
        memoryEntry({ title: 'Older', pinned: true, created: '2026-01-01T00:00:00Z', fullLoad: 'doesnt-fit' }),
        memoryEntry({ title: 'Newer', pinned: true, created: '2026-11-01T00:00:00Z', fullLoad: 'loaded' })
      ],
      unreadable: [],
      conflicts: []
    };
    const view = workshopMemoryManagerView({ mode: 'ask', library, estimate: { ...FULL_OVER, pinned: 2, pinnedLoaded: 1 } });
    expect(view.active.map((row) => [row.entry.title, row.badges[0]?.text])).toEqual([
      ['Older', 'Doesn’t fit in full'],
      ['Newer', 'Loaded in full']
    ]);
    expect(view.overNote).toContain('“Older” doesn’t fit');
  });

  it('two or more that don’t fit: named, then counted', () => {
    const two = [
      memoryEntry({ title: 'A', pinned: true, fullLoad: 'doesnt-fit', residency: 'listed' }),
      memoryEntry({ title: 'B', pinned: true, fullLoad: 'doesnt-fit', residency: 'listed' })
    ];
    const over = { ...FULL_OVER };
    const named = workshopMemoryManagerView({ mode: 'ask', library: { memories: two, unreadable: [], conflicts: [] }, estimate: over });
    expect(named.overNote).toContain('“A” and “B” don’t fit, so they load as list entries instead.');
    const three = [...two, memoryEntry({ title: 'C', pinned: true, fullLoad: 'doesnt-fit', residency: 'listed' })];
    const counted = workshopMemoryManagerView({ mode: 'ask', library: { memories: three, unreadable: [], conflicts: [] }, estimate: over });
    expect(counted.overNote).toContain('3 of them don’t fit, so they load as list entries instead.');
  });

  it('one that doesn’t fit and isn’t listed either: searchable only, named in the status line and on its row', () => {
    const library = { memories: [memoryEntry({ title: 'The Duchess sneezes', pinned: true, fullLoad: 'doesnt-fit', residency: 'searchable' })], unreadable: [], conflicts: [] };
    const view = workshopMemoryManagerView({ mode: 'ask', library, estimate: FULL_OVER });
    expect(view.overNote).toContain('“The Duchess sneezes” doesn’t fit, and the list is full too, so it’s searchable only.');
    expect(view.active[0].notes).toEqual(['Doesn’t fit at the start: not in full, and the list is full too. Personas can still find it with memory search. Turn off Always load in full on another to make room.']);
  });

  it('a refused Always load in full: the note under that row, with the total it would have made', () => {
    const view = manager({ refusal: { entryKey: 'key-watch', wouldBeTokens: 5_080 } });
    const watch = view.active.find((row) => row.entry.entryKey === 'key-watch');
    expect(watch?.notes).toEqual(['Can’t load this one in full: memories loaded in full would come to about 5,100 of 5,000 tokens. Turn it off on another, or shorten this note.']);
    expect(view.active.filter((row) => row.notes.length > 0)).toHaveLength(1);
  });

  it('a memory another window is changing: listed, marked, and says so', () => {
    const library = { memories: [memoryEntry({ title: 'Held', busy: true })], unreadable: [], conflicts: [] };
    const [row] = workshopMemoryManagerView({ mode: 'ask', library }).active;
    expect(row.badges).toEqual([{ text: 'Being edited', tone: 'muted' }]);
    expect(row.notes).toEqual(['Another VS Code window is changing this memory. Edit, archive and delete come back when it’s done.']);
  });

  it('without an estimate: the active count alone, and the attention label', () => {
    expect(manager({ estimate: undefined }).chips.map((chip) => chip.text)).toEqual(['6 active', '3 files need attention']);
  });

  it('groups by kind in the design’s order, and by date', () => {
    const view = manager();
    expect(groupMemoriesByKind(view.active).map((group) => [group.label, group.items.length])).toEqual([
      ['Decisions', 2], ['Canon', 2], ['Preferences', 1], ['Open threads', 1]
    ]);
    // The shared buckets: this week is within seven days.
    const now = new Date(2026, 10, 3, 18, 0, 0);
    expect(groupMemoriesByDate(view.active, now).map((group) => [group.label, group.items.length])).toEqual([
      ['Today', 2], ['This week', 4]
    ]);
    expect(groupMemoriesByDate(view.active, new Date(2026, 10, 8, 18, 0, 0)).map((group) => [group.label, group.items.length])).toEqual([
      ['This week', 4], ['Earlier', 2]
    ]);
  });

  it('the title rule: one non-empty line within the codec’s bound', () => {
    const rule = workshopMemoryTitleRule(120);
    expect(rule('  The Rabbit’s watch  ')).toBeUndefined();
    expect(rule('   ')).toBe('A memory needs a title.');
    expect(rule('two\nlines')).toBe('A title is one line.');
    expect(rule('x'.repeat(121))).toBe('A title is at most 120 characters.');
  });

  it('never says pin', () => {
    const views = [manager(), manager({ library: managerLibrary(true), estimate: FULL_OVER, refusal: { entryKey: 'key-watch', wouldBeTokens: 5_100 } })];
    const words = JSON.stringify(views.map((view) => ({ ...view, active: view.active.map(({ entry: _entry, ...rest }) => rest), past: view.past.map(({ entry: _entry, ...rest }) => rest) })));
    expect(words).not.toMatch(/\bpin/i);
  });
});
