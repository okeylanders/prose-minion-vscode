/**
 * The prose-aware diff (ADR 2026-11-19 D13): paragraphs first, then words.
 * Made-up *Alice* text.
 */
import { diffWorkshopHistoryTexts } from '@/application/services/workshop/history/WorkshopHistoryDiff';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { prose } from './historyFixtures';

/** The change list of an outcome that must be a diff. */
const changesOf = (outcome: ReturnType<typeof diffWorkshopHistoryTexts>) => {
  if (outcome.kind !== 'diff') {
    throw new Error(`refused: ${outcome.reason}`);
  }
  return outcome;
};

const A = 'Alice sat by the river bank.';
const B = 'The White Rabbit ran past, late again.';
const C = 'She followed it down the hole.';
const D = 'The hall was long and low.';

describe('paragraphs first', () => {
  it('finds nothing in equal texts, and nothing when only the space between paragraphs differs', () => {
    expect(changesOf(diffWorkshopHistoryTexts(prose(A, B), prose(A, B))).changes).toEqual([]);
    expect(changesOf(diffWorkshopHistoryTexts(prose(A, B), `${A}\n\n\n\n${B}\n`)).changes).toEqual([]);
  });

  it('shows an added paragraph whole, numbered in the newer text, with its unchanged neighbours', () => {
    const { changes } = changesOf(diffWorkshopHistoryTexts(prose(A, C), prose(A, B, C)));
    expect(changes).toEqual([{
      kind: 'added',
      newNumber: 2,
      text: B,
      before: [{ number: 1, text: A }],
      after: [{ number: 3, text: C }]
    }]);
  });

  it('shows a removed paragraph whole, by its number in the older text', () => {
    const { changes } = changesOf(diffWorkshopHistoryTexts(prose(A, B, C), prose(A, C)));
    expect(changes).toEqual([{
      kind: 'removed',
      oldNumber: 2,
      text: B,
      before: [{ number: 1, text: A }],
      after: [{ number: 2, text: C }]
    }]);
  });

  it('reads a moved paragraph as one removal and one addition', () => {
    const { changes } = changesOf(diffWorkshopHistoryTexts(prose(A, B, C, D), prose(A, C, D, B)));
    expect(changes.map((change) => change.kind)).toEqual(['removed', 'added']);
    expect(changes[0]).toMatchObject({ kind: 'removed', oldNumber: 2, text: B });
    expect(changes[1]).toMatchObject({ kind: 'added', newNumber: 4, text: B, before: [{ number: 3, text: D }] });
  });

  it('pairs a run of removed and added paragraphs by position; the rest are whole', () => {
    const { changes } = changesOf(diffWorkshopHistoryTexts(prose(A, B, D), prose(A, 'The White Rabbit walked past.', 'A new line.', D)));
    expect(changes.map((change) => change.kind)).toEqual(['changed', 'added']);
    expect(changes[0]).toMatchObject({ kind: 'changed', oldNumber: 2, newNumber: 2, before: [{ number: 1, text: A }] });
    expect(changes[1]).toMatchObject({ kind: 'added', newNumber: 3, text: 'A new line.', after: [{ number: 4, text: D }] });
    expect(changes[1]).not.toHaveProperty('before');
  });
});

describe('then words, inside a changed paragraph', () => {
  it('marks the words that changed, keeping the spaces', () => {
    const { changes } = changesOf(diffWorkshopHistoryTexts('she ran to the door', 'she walked to the door'));
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
    const { changes } = changesOf(diffWorkshopHistoryTexts(prose(A, long), prose(A, `${long} again`)));
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

  it('shows a paragraph whose word diff passes maxEditLength whole', () => {
    const { changes } = changesOf(withBudgets({ maxEditLength: 2 })('one two three four five', 'six seven eight nine ten'));
    expect(changes).toEqual([expect.objectContaining({ kind: 'changed-whole', why: 'edit-length' })]);
  });

  // D13a (PR #286 F-03): the outer alignment has its own ceilings, apart from the word diff's.
  it('refuses when the alignment passes paragraphEditLength, whatever the word limit', () => {
    const diff = withBudgets({ paragraphEditLength: 1, maxEditLength: 1_000_000, alignParagraphs: 1_000_000 });
    expect(diff(prose(A, B, C), prose(D, 'one', 'two', 'three'))).toEqual({ kind: 'refused', reason: 'paragraph-edit-length' });
    // One paragraph changed is an edit length of two: within a ceiling of two, it aligns.
    expect(withBudgets({ paragraphEditLength: 2, maxEditLength: 1_000_000 })(prose(A, B), prose(A, C)).kind).toBe('diff');
  });

  it('refuses a side past alignParagraphs before aligning, whatever the edit limits', () => {
    const diff = withBudgets({ alignParagraphs: 3, paragraphEditLength: 1_000_000, maxEditLength: 1_000_000 });
    expect(diff(prose(A, B, C), prose(A, B, C, D))).toEqual({ kind: 'refused', reason: 'too-many-paragraphs' });
    expect(diff(prose(A, B, C), prose(A, B, D)).kind).toBe('diff');
  });

  it('aligns as before within both ceilings', () => {
    expect(diffWorkshopHistoryTexts(prose(A, B), prose(A, C))).toMatchObject({ kind: 'diff', changes: [{ kind: 'changed' }] });
  });
});
