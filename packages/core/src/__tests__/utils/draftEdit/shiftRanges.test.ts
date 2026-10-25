/**
 * Shown flags follow their text while the writer types (ADR 2026-10-21 D3),
 * and a flag whose text is edited is dropped.
 */
import { shiftRanges } from '@/utils/draftEdit/shiftRanges';

const flag = (id: string, start: number, end: number) => ({ id, start, end });

describe('shiftRanges', () => {
  const ranges = [flag('a', 10, 14), flag('b', 30, 37)];

  it('keeps a range wholly before a change, and moves one wholly after it', () => {
    expect(shiftRanges(ranges, [{ offset: 20, length: 0, text: 'Oh dear! ' }]))
      .toEqual([flag('a', 10, 14), flag('b', 39, 46)]);
  });

  it('moves a range when text is typed right before it, and keeps it when typed right after it', () => {
    expect(shiftRanges(ranges, [{ offset: 10, length: 0, text: 'xx' }])).toEqual([flag('a', 12, 16), flag('b', 32, 39)]);
    expect(shiftRanges(ranges, [{ offset: 14, length: 0, text: 'x' }])).toEqual([flag('a', 10, 14), flag('b', 31, 38)]);
  });

  it('drops a range whose text the change touches', () => {
    expect(shiftRanges(ranges, [{ offset: 11, length: 2, text: 'ed' }])).toEqual([flag('b', 30, 37)]);
    expect(shiftRanges(ranges, [{ offset: 12, length: 0, text: 'x' }])).toEqual([flag('b', 31, 38)]);
    expect(shiftRanges(ranges, [{ offset: 5, length: 30, text: '' }])).toEqual([]);
  });

  it('applies a multi-cursor event from the last change to the first, all in pre-event offsets', () => {
    const changes = [
      { offset: 0, length: 0, text: '>>' },
      { offset: 20, length: 5, text: '' }
    ];
    expect(shiftRanges(ranges, changes)).toEqual([flag('a', 12, 16), flag('b', 27, 34)]);
  });

  it('keeps extra fields on the ranges it moves', () => {
    const [moved] = shiftRanges([{ id: 'x', start: 4, end: 6, severity: 'warning' }], [{ offset: 0, length: 1, text: '' }]);
    expect(moved).toEqual({ id: 'x', start: 3, end: 5, severity: 'warning' });
  });
});
