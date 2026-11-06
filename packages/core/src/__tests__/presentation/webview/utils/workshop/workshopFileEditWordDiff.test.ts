/**
 * The file-edit card's word-level diff (ADR 2026-11-05 D9; epic Slice 4b):
 * exact (every segment joined gives back each side), word-sized, readable
 * (a lone space between changes joins them), and bounded. *Alice*.
 */

import {
  WORD_DIFF_CELL_LIMIT,
  workshopFileEditWordDiff,
  type WorkshopFileEditDiffSegment
} from '@utils/workshop/workshopFileEditWordDiff';

const side = (segments: readonly WorkshopFileEditDiffSegment[], kind: 'removed' | 'added') =>
  segments.filter((segment) => segment.kind === 'same' || segment.kind === kind).map((segment) => segment.text).join('');

const expectExact = (before: string, after: string) => {
  const segments = workshopFileEditWordDiff(before, after);
  expect(side(segments, 'removed')).toBe(before);
  expect(side(segments, 'added')).toBe(after);
  return segments;
};

describe('workshopFileEditWordDiff', () => {
  it('shows one changed word between what stays', () => {
    expect(expectExact('Alice ran down the hall.', 'Alice walked down the hall.')).toEqual([
      { kind: 'same', text: 'Alice ' },
      { kind: 'removed', text: 'ran' },
      { kind: 'added', text: 'walked' },
      { kind: 'same', text: ' down the hall.' }
    ]);
  });

  it('shows an insertion and a deletion as words, never letters', () => {
    expect(expectExact('The Rabbit was late.', 'The White Rabbit was very late.')).toEqual([
      { kind: 'same', text: 'The ' },
      { kind: 'added', text: 'White ' },
      { kind: 'same', text: 'Rabbit was' },
      { kind: 'added', text: ' very' },
      { kind: 'same', text: ' late.' }
    ]);
    expect(expectExact('She fell down, down, down.', 'She fell down.')).toEqual([
      { kind: 'same', text: 'She fell ' },
      { kind: 'removed', text: 'down, down, ' },
      { kind: 'same', text: 'down.' }
    ]);
  });

  it('joins a lone space between two changes into one change', () => {
    expect(expectExact('a curious child', 'the strange girl')).toEqual([
      { kind: 'removed', text: 'a curious child' },
      { kind: 'added', text: 'the strange girl' }
    ]);
  });

  it('keeps line breaks and whitespace exactly', () => {
    expectExact('Down the rabbit-hole.\n\nAlice was beginning', 'Down the rabbit-hole.\n\nAlice  was  tiring');
  });

  it('handles empty sides and identical text', () => {
    expect(workshopFileEditWordDiff('', 'Off with her head!')).toEqual([{ kind: 'added', text: 'Off with her head!' }]);
    expect(workshopFileEditWordDiff('Off with her head!', '')).toEqual([{ kind: 'removed', text: 'Off with her head!' }]);
    expect(workshopFileEditWordDiff('Curiouser and curiouser!', 'Curiouser and curiouser!')).toEqual([
      { kind: 'same', text: 'Curiouser and curiouser!' }
    ]);
    expect(workshopFileEditWordDiff('', '')).toEqual([]);
  });

  it('past its bound shows the changed middle as one removal and one addition, still exact', () => {
    const words = (prefix: string, count: number) => Array.from({ length: count }, (_, at) => `${prefix}${at}`).join(' ');
    const before = `Alice said ${words('a', 800)} then`;
    const after = `Alice said ${words('b', 800)} then`;
    // Each side is about 1,600 tokens: well past the table's bound.
    expect(1600 * 1600).toBeGreaterThan(WORD_DIFF_CELL_LIMIT);
    const segments = expectExact(before, after);
    expect(segments.map((segment) => segment.kind)).toEqual(['same', 'removed', 'added', 'same']);
  });
});
