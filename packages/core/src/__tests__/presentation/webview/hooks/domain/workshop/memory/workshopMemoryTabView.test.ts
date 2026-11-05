/**
 * The Memory tab as drawn (Slice 4b-ui): every state on the design canvas
 * (Main, Off, Empty, OverBudget, OverFull, Unreadable, NoFolder, MultiRoot),
 * plus the states the canvas doesn't draw (reading, unreadable folder,
 * nothing in effect). Words are Slice 0d's.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { workshopMemoryTabView, type WorkshopMemoryTabInput } from '@hooks/domain/workshop/memory/workshopMemoryTabView';
import { WORKSHOP_MEMORY_BUDGETS } from '@hooks/domain/workshop/memory/workshopMemoryViewInputs';
import { FULL_OVER, IN_BUDGET, LIST_OVER } from './workshopMemoryFixtures';

const AVAILABLE = { kind: 'available' } as const;

function tab(overrides: Partial<WorkshopMemoryTabInput> = {}) {
  return workshopMemoryTabView({
    mode: 'ask',
    workspace: AVAILABLE,
    estimate: IN_BUDGET,
    saved: 12,
    unreadable: [],
    conflicts: [],
    ...overrides
  });
}

describe('workshopMemoryTabView', () => {
  it('draws the three mode cards, Ask first recommended, the draft selected', () => {
    const view = tab({ mode: 'auto' });
    expect(view.cards.map((card) => [card.name, card.recommended, card.selected])).toEqual([
      ['Off', false, false],
      ['Ask first', true, false],
      ['Save and tell me', false, true]
    ]);
    expect(view.cards[0].description).toBe('Personas start each conversation without project memory, and they don’t suggest new ones.');
  });

  it('reads the well’s sizes from the budgets, never literals', () => {
    expect(WORKSHOP_MEMORY_BUDGETS).toEqual({
      pinnedTokens: PROMPT_BUDGETS.workshopProjectMemory.pinnedTokens,
      catalogTokens: PROMPT_BUDGETS.workshopProjectMemory.catalogTokens,
      contextWords: PROMPT_BUDGETS.contextAttachments.words
    });
    expect(tab().well).toEqual({
      memorySize: 'Kept small: about 7,000 tokens in all',
      contextSize: 'Much larger: up to 100,000 words'
    });
    expect(tab({ budgets: { pinnedTokens: 3_000, catalogTokens: 1_000, contextWords: 50_000 } }).well).toEqual({
      memorySize: 'Kept small: about 4,000 tokens in all',
      contextSize: 'Much larger: up to 50,000 words'
    });
  });

  it('on, with memories: the title and summary row, two meters and the labels', () => {
    const { load, notice, folder } = tab();
    expect(notice).toBeUndefined();
    expect(load.name).toBe('Every memory’s title and summary');
    expect(load.description).toBe('Each persona also sees the 2 memories set to load in full, and opens the rest when the conversation needs them.');
    expect(load.chips.map((chip) => chip.text)).toEqual(['12 memories', '2 in full', '≈ 1,800 tokens']);
    expect(load.meters.map((meter) => [meter.left, meter.right, meter.full])).toEqual([
      ['Loaded in full · 2', 'about 1,100 of 5,000 tokens', false],
      ['Titles and summaries · all 10 fit', 'about 700 of 2,000 tokens', false]
    ]);
    expect(load.meters[0]).toMatchObject({ percent: 22, value: 1_104, max: 5_000, valueText: 'Loaded in full: 2, about 1,100 of 5,000 tokens' });
    expect(load.more).toEqual([]);
    expect(folder).toEqual({ description: 'One Markdown file per memory. You can read and edit them in VS Code.', locked: false });
  });

  it('off: nothing loads, the saved count, no meters; the manager still works', () => {
    const { load, folder, cards } = tab({ mode: 'off' });
    expect(load).toEqual({
      name: 'Nothing loads while memory is off',
      description: 'Memory is off in every project. This project’s memories stay in its folder, and you can still manage them.',
      chips: [{ text: '12 saved', quiet: true }],
      meters: [],
      more: []
    });
    expect(folder.locked).toBe(false);
    expect(cards.find((card) => card.selected)?.mode).toBe('off');
    expect(tab({ mode: 'off', saved: 0 }).load).toMatchObject({ description: 'There are no saved memories yet.', chips: [{ text: 'no memories', quiet: true }] });
  });

  it('on, no memories yet: the help line follows the mode, and the folder is made on first save', () => {
    const ask = tab({ saved: 0, estimate: undefined });
    expect(ask.load.name).toBe('No memories yet');
    expect(ask.load.description).toBe('When a persona suggests a memory, it appears under its reply for you to save. You can also say “remember that…”, or choose Save to memory… on any message.');
    expect(ask.load.chips).toEqual([{ text: '0 memories', quiet: true }]);
    expect(ask.folder.description).toBe('One Markdown file per memory. The folder is made when the first memory is saved, or when you open it.');
    expect(tab({ mode: 'auto', saved: 0 }).load.description).toBe('Personas save what’s worth keeping as you work. You can also say “remember that…”, or choose Save to memory… on any message.');
  });

  it('the list over its budget: amber and full, and how many more are searchable', () => {
    const { load } = tab({ estimate: LIST_OVER, saved: 40 });
    expect(load.name).toBe('Memories loaded in full first, then the most recent');
    expect(load.description).toBe('Each persona sees the title and summary of the memories that fit, and the 3 set to load in full. Choose Always load in full for the ones every conversation needs.');
    expect(load.chips.map((chip) => chip.text)).toEqual(['40 memories', '3 in full', '≈ 4,400 tokens']);
    expect(load.meters.map((meter) => [meter.left, meter.right, meter.full, meter.percent])).toEqual([
      ['Loaded in full · 3', 'about 2,400 of 5,000 tokens', false, 48],
      ['Titles and summaries · 25 of 37 fit', 'about 2,000 of 2,000 tokens', true, 100]
    ]);
    expect(load.more).toEqual(['12 more are searchable. Personas find them with memory search when the conversation needs them.']);
  });

  it('set to load in full, over its budget: set apart from loaded, loaded within the budget, the start total the whole frame', () => {
    const { load } = tab({ estimate: FULL_OVER });
    expect(load.name).toBe('Memories set to load in full first, then the rest');
    expect(load.description).toBe('Each persona sees the 3 of them that fit in full, and the title and summary of every other memory.');
    expect(load.chips.map((chip) => chip.text)).toEqual(['12 memories', '3 of 4 in full', '≈ 5,200 tokens at the start']);
    expect(load.meters[0]).toMatchObject({
      left: 'Set to load in full · 4 · 1 doesn’t fit',
      right: 'about 5,600 requested · 4,400 of 5,000 loaded',
      full: true,
      percent: 100,
      value: 4_410,
      max: 5_000
    });
    expect(load.meters[1]).toMatchObject({ left: 'Titles and summaries · all 9 fit', right: 'about 800 of 2,000 tokens', full: false });
    expect(load.more).toEqual(['1 memory set to load in full doesn’t fit, so it loads as a list entry. Turn off Always load in full on one in Manage memories… to make room.']);
  });

  it('never shows a loaded figure above the budget, and rounds a requested total past it up', () => {
    const { load } = tab({ estimate: { ...FULL_OVER, pinnedTokens: 5_001, pinnedLoadedTokens: 5_400, pinned: 5, pinnedLoaded: 3 } });
    expect(load.meters[0].right).toBe('about 5,100 requested · 5,000 of 5,000 loaded');
    expect(load.meters[0].value).toBe(5_000);
    expect(load.meters[0].left).toBe('Set to load in full · 5 · 2 don’t fit');
    expect(load.more[0]).toBe('2 memories set to load in full don’t fit, so they load as list entries. Turn off Always load in full on one in Manage memories… to make room.');
  });

  it('both budgets past: both amber lines, and the description doesn’t claim every memory', () => {
    const { load } = tab({ estimate: { ...FULL_OVER, catalogEntries: 5 } });
    expect(load.description).toBe('Each persona sees the 3 of them that fit in full, and the title and summary of the others that fit.');
    expect(load.more).toHaveLength(2);
    expect(load.more[1]).toBe('4 more are searchable. Personas find them with memory search when the conversation needs them.');
  });

  it('unreadable files: an attention row listing each with its reason', () => {
    const { attention } = tab({
      unreadable: [
        { entryKey: 'k1', fileName: 'rabbit-watch-runs-backward-7f3c2a.md', reason: 'unclosed-frontmatter' },
        { entryKey: 'k2', fileName: 'tea-party-seating-1a9e04.md', reason: 'invalid-value', key: 'kind' }
      ]
    });
    expect(attention).toEqual({
      title: '2 files can’t be read',
      description: 'They aren’t loaded, and personas can’t find them. Fix the frontmatter in the editor, or move the file out of the folder. Nothing else is affected.',
      files: [
        { entryKey: 'k1', fileName: 'rabbit-watch-runs-backward-7f3c2a.md', reason: 'no closing --- line' },
        { entryKey: 'k2', fileName: 'tea-party-seating-1a9e04.md', reason: '“kind” isn’t one Memory knows' }
      ]
    });
  });

  it('conflicting files join the attention row, as needing attention', () => {
    const { attention } = tab({
      conflicts: [{ id: 'mem-7f3c2a', files: [{ entryKey: 'a', fileName: 'a.md' }, { entryKey: 'b', fileName: 'b.md' }] }]
    });
    expect(attention?.title).toBe('2 files need attention');
    expect(attention?.files.map((file) => file.reason)).toEqual(['same id as another file', 'same id as another file']);
  });

  it('a set-aside copy joins the attention row as needing attention, in its short words', () => {
    const { attention } = tab({ unreadable: [{ entryKey: 'k3', fileName: 'cheshire-cat-1a0005.md', reason: 'set-aside' }] });
    expect(attention?.title).toBe('1 file needs attention');
    expect(attention?.files[0].reason).toBe('a copy set aside, not yet put back');
  });

  it.each([
    ['no-workspace', 'No folder is open, so there’s no project to keep memories in.'],
    ['multi-root', 'This workspace has several folders, so memory can’t tell which project it belongs to.']
  ] as const)('unavailable (%s): the reason, nothing loads, the buttons locked, the mode cards still choosable', (reason, why) => {
    const view = tab({ workspace: { kind: 'unavailable', reason }, estimate: undefined });
    expect(view.notice).toEqual({
      title: 'Project memory isn’t available here.',
      text: `${why} Open a single folder to use project memory. The mode above still applies to your other projects.`
    });
    expect(view.load).toMatchObject({
      name: 'Nothing loads',
      description: 'Personas in this workspace get no project memory, whatever the mode above says.',
      chips: [{ text: 'unavailable', quiet: true }],
      meters: []
    });
    expect(view.folder).toEqual({ description: 'Available once memory belongs to one project folder.', locked: true });
    expect(view.cards.map((card) => card.mode)).toEqual(['off', 'ask', 'auto']);
    expect(view.attention).toBeUndefined();
  });

  it('while the host reads, when the folder can’t be listed, and when nothing is in effect', () => {
    expect(tab({ workspace: { kind: 'loading' } }).load.name).toBe('Reading this project’s memories…');
    expect(tab({ estimate: undefined }).load.name).toBe('Reading this project’s memories…');
    expect(tab({ workspace: { kind: 'unknown' } }).load).toMatchObject({
      name: 'This project’s memory folder couldn’t be listed',
      description: 'The folder couldn’t be listed just now, so nothing from it is shown. Your memory files weren’t touched.'
    });
    expect(tab({ estimate: { ...IN_BUDGET, memories: 0, pinned: 0, pinnedLoaded: 0, catalogEntries: 0 }, saved: 3 }).load).toMatchObject({
      name: 'No memories are active',
      description: 'Every memory in this project is archived or replaced by a newer one, so none loads. Restore an archived one in Manage memories… to make it active again.',
      chips: [{ text: '0 active', quiet: true }]
    });
  });

  it('no memory set to load in full: the plain help line, and an empty full meter', () => {
    const { load } = tab({ estimate: { ...IN_BUDGET, pinned: 0, pinnedLoaded: 0, pinnedTokens: 0, pinnedLoadedTokens: 0, catalogEntries: 12 } });
    expect(load.description).toBe('Each persona opens a full note when the conversation needs it.');
    expect(load.meters[0]).toMatchObject({ left: 'Loaded in full · 0', right: 'about 0 of 5,000 tokens', percent: 0 });
    expect(load.meters[1].left).toBe('Titles and summaries · all 12 fit');
  });

  it('never says pin', () => {
    const states = [tab(), tab({ estimate: FULL_OVER }), tab({ estimate: LIST_OVER }), tab({ mode: 'off' })];
    expect(JSON.stringify(states)).not.toMatch(/\bpin/i);
  });
});
