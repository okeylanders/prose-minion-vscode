import {
  RECALL_LABEL_CHARACTERS,
  recallBlock,
  recallLabel,
  recallLabelList
} from '@/application/services/workshop/recall/WorkshopRecallText';

describe('recallLabel', () => {
  it('keeps a short label on one line', () => {
    expect(recallLabel('  chapter-6.md\n  (draft) ')).toBe('chapter-6.md (draft)');
  });

  it('clips a long label and marks the cut', () => {
    const label = recallLabel('x'.repeat(100_000));

    expect(label).toHaveLength(RECALL_LABEL_CHARACTERS);
    expect(label.endsWith('…')).toBe(true);
  });
});

describe('recallLabelList', () => {
  it('lists every label that fits', () => {
    expect(recallLabelList(['Jill', 'Cliff'], 400)).toBe('Jill, Cliff');
  });

  it('counts the labels past its limit', () => {
    const list = recallLabelList(Array.from({ length: 10_000 }, (_, index) => `name-${index}`), 40);

    expect(list).toBe('name-0, name-1, name-2, name-3, name-4, … and 9,995 more');
  });

  it('always shows the first label, clipped, however small the limit', () => {
    expect(recallLabelList(['y'.repeat(5_000), 'z'], 10)).toBe(`${'y'.repeat(RECALL_LABEL_CHARACTERS - 1)}…, … and 1 more`);
  });
});

describe('recallBlock', () => {
  it('returns a block that fits unchanged', () => {
    expect(recallBlock('one\ntwo', 7, '[cut]')).toBe('one\ntwo');
  });

  it('keeps whole lines and the notice within the limit', () => {
    const block = recallBlock(['alpha', 'beta', 'gamma', 'delta'].join('\n'), 20, '[cut]');

    expect(block).toBe('alpha\nbeta\n[cut]');
    expect(block.length).toBeLessThanOrEqual(20);
  });

  it('cuts inside a first line longer than the limit', () => {
    const block = recallBlock('x'.repeat(100), 20, '[cut]');

    expect(block).toBe(`${'x'.repeat(14)}\n[cut]`);
  });

  it('holds every limit, line shape, and length', () => {
    const lines = Array.from({ length: 30 }, (_, index) => 'w'.repeat((index * 7) % 23));
    for (let limit = 6; limit < 400; limit += 1) {
      const block = recallBlock(lines.join('\n'), limit, '[cut]');

      expect([limit, block.length <= limit]).toEqual([limit, true]);
    }
  });

  it('refuses a limit too small for its notice', () => {
    expect(() => recallBlock('x'.repeat(10), 4, '[cut]')).toThrow(RangeError);
  });
});
