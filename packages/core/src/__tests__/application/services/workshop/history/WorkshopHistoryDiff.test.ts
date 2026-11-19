/**
 * The prose-aware diff (ADR 2026-11-19 D13): paragraphs first, then words.
 * Made-up *Alice* text.
 */
import { diffWorkshopHistoryTexts } from '@/application/services/workshop/history/WorkshopHistoryDiff';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { prose } from './historyFixtures';

const A = 'Alice sat by the river bank.';
const B = 'The White Rabbit ran past, late again.';
const C = 'She followed it down the hole.';
const D = 'The hall was long and low.';

describe('paragraphs first', () => {
  it('finds nothing in equal texts, and nothing when only the space between paragraphs differs', () => {
    expect(diffWorkshopHistoryTexts(prose(A, B), prose(A, B)).changes).toEqual([]);
    expect(diffWorkshopHistoryTexts(prose(A, B), `${A}\n\n\n\n${B}\n`).changes).toEqual([]);
  });

  it('shows an added paragraph whole, numbered in the newer text, with its unchanged neighbours', () => {
    const { changes } = diffWorkshopHistoryTexts(prose(A, C), prose(A, B, C));
    expect(changes).toEqual([{
      kind: 'added',
      newNumber: 2,
      text: B,
      before: [{ number: 1, text: A }],
      after: [{ number: 3, text: C }]
    }]);
  });

  it('shows a removed paragraph whole, by its number in the older text', () => {
    const { changes } = diffWorkshopHistoryTexts(prose(A, B, C), prose(A, C));
    expect(changes).toEqual([{
      kind: 'removed',
      oldNumber: 2,
      text: B,
      before: [{ number: 1, text: A }],
      after: [{ number: 2, text: C }]
    }]);
  });

  it('reads a moved paragraph as one removal and one addition', () => {
    const { changes } = diffWorkshopHistoryTexts(prose(A, B, C, D), prose(A, C, D, B));
    expect(changes.map((change) => change.kind)).toEqual(['removed', 'added']);
    expect(changes[0]).toMatchObject({ kind: 'removed', oldNumber: 2, text: B });
    expect(changes[1]).toMatchObject({ kind: 'added', newNumber: 4, text: B, before: [{ number: 3, text: D }] });
  });

  it('pairs a run of removed and added paragraphs by position; the rest are whole', () => {
    const { changes } = diffWorkshopHistoryTexts(prose(A, B, D), prose(A, 'The White Rabbit walked past.', 'A new line.', D));
    expect(changes.map((change) => change.kind)).toEqual(['changed', 'added']);
    expect(changes[0]).toMatchObject({ kind: 'changed', oldNumber: 2, newNumber: 2, before: [{ number: 1, text: A }] });
    expect(changes[1]).toMatchObject({ kind: 'added', newNumber: 3, text: 'A new line.', after: [{ number: 4, text: D }] });
    expect(changes[1]).not.toHaveProperty('before');
  });
});

describe('then words, inside a changed paragraph', () => {
  it('marks the words that changed, keeping the spaces', () => {
    const { changes } = diffWorkshopHistoryTexts('she ran to the door', 'she walked to the door');
    expect(changes).toHaveLength(1);
    const change = changes[0];
    expect(change.kind).toBe('changed');
    if (change.kind !== 'changed') {
      return;
    }
    expect(change.words.filter((part) => part.kind !== 'same')).toEqual([
      { kind: 'removed', text: 'ran' },
      { kind: 'added', text: 'walked' }
    ]);
    expect(change.words.filter((part) => part.kind !== 'added').map((part) => part.text).join('')).toBe('she ran to the door');
    expect(change.words.filter((part) => part.kind !== 'removed').map((part) => part.text).join('')).toBe('she walked to the door');
  });

  it('shows a paragraph past wordDiffParagraphCharacters whole, before and after', () => {
    const long = 'Alice '.repeat(Math.ceil(PROMPT_BUDGETS.workshopHistory.wordDiffParagraphCharacters / 6) + 1).trim();
    const { changes } = diffWorkshopHistoryTexts(prose(A, long), prose(A, `${long} again`));
    expect(changes).toEqual([expect.objectContaining({ kind: 'changed-whole', why: 'long-paragraph', oldText: long, newText: `${long} again` })]);
  });
});

describe('bounded work, never bounded correctness', () => {
  const withBudgets = (overrides: Record<string, number>): typeof diffWorkshopHistoryTexts => {
    let loaded!: typeof diffWorkshopHistoryTexts;
    jest.isolateModules(() => {
      jest.doMock('@shared/constants/promptBudgets', () => {
        const actual = jest.requireActual('@shared/constants/promptBudgets');
        // eslint-disable-next-line @typescript-eslint/naming-convention -- the module's own export name.
        return { PROMPT_BUDGETS: { ...actual.PROMPT_BUDGETS, workshopHistory: { ...actual.PROMPT_BUDGETS.workshopHistory, ...overrides } } };
      });
      loaded = require('@/application/services/workshop/history/WorkshopHistoryDiff').diffWorkshopHistoryTexts;
    });
    return loaded;
  };
  const byPosition = (result: ReturnType<typeof diffWorkshopHistoryTexts>): string[] =>
    result.changes.map((change) => change.kind === 'changed' || change.kind === 'changed-whole' ? 'changed' : change.kind);

  it('shows a paragraph whose word diff passes maxEditLength whole', () => {
    const { changes } = withBudgets({ maxEditLength: 2 })('one two three four five', 'six seven eight nine ten');
    expect(changes).toEqual([expect.objectContaining({ kind: 'changed-whole', why: 'edit-length' })]);
  });

  // PR #286 F-03: the outer alignment has its own ceiling, apart from the word diff's.
  it('pairs paragraphs by position when the alignment passes alignEditLength, whatever the word limit', () => {
    const diff = withBudgets({ alignEditLength: 1, maxEditLength: 1_000_000 });
    const result = diff(prose(A, B, C), prose(D, 'one', 'two', 'three'));
    expect(result.alignedByPosition).toBe('edit-length');
    expect(byPosition(result)).toEqual(['changed', 'changed', 'changed', 'added']);
    expect(result.changes.at(-1)).toMatchObject({ kind: 'added', newNumber: 4, text: 'three' });
    // Each pair was still compared word by word: the word limit was not what stopped the alignment.
    expect(result.changes[0].kind).toBe('changed');
  });

  it('never aligns a side past alignParagraphs: many short paragraphs are paired by position', () => {
    const diff = withBudgets({ alignParagraphs: 3, alignEditLength: 1_000_000 });
    const result = diff(prose(A, B, C, D), prose(A, B, C, D, 'one'));
    expect(result.alignedByPosition).toBe('too-many-paragraphs');
    // By position, the four kept paragraphs pair with themselves and the last is added: still a true account.
    expect(byPosition(result)).toEqual(['changed', 'changed', 'changed', 'changed', 'added']);
  });

  it('aligns as before within both ceilings', () => {
    expect(diffWorkshopHistoryTexts(prose(A, B), prose(A, C)).alignedByPosition).toBeUndefined();
  });
});
