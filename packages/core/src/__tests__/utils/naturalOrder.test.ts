/**
 * Natural order for paths (ADR 2026-11-20 D4): segment by segment, the
 * extension set aside, digit runs as numbers.
 */
import { compareNaturalPaths } from '@/utils/naturalOrder';

const sorted = (paths: string[]): string[] => [...paths].sort(compareNaturalPaths);

describe('compareNaturalPaths', () => {
  it('orders 6.9 before 6.9.2 before 6.10', () => {
    expect(sorted(['6.10', '6.9.2', '6.9'])).toEqual(['6.9', '6.9.2', '6.10']);
  });

  it('sets the extension aside, so 6.9.2.md sorts after 6.9.md', () => {
    expect(sorted(['6.10.md', '6.9.2.md', '6.9.md'])).toEqual(['6.9.md', '6.9.2.md', '6.10.md']);
    expect(compareNaturalPaths('6.9.2.md', '6.9.md')).toBeGreaterThan(0);
  });

  it('compares directories segment by segment, digit runs as numbers', () => {
    expect(sorted([
      'chapters/part-10/6.9.md',
      'chapters/part-2/6.10.md',
      'chapters/part-2/6.9.2.md',
      'chapters/part-2/6.9.md',
      'chapters/part-2.md'
    ])).toEqual([
      'chapters/part-2.md',
      'chapters/part-2/6.9.md',
      'chapters/part-2/6.9.2.md',
      'chapters/part-2/6.10.md',
      'chapters/part-10/6.9.md'
    ]);
  });

  it('reads a number however it is padded, and one too long for a number', () => {
    expect(sorted(['chapter-010.md', 'chapter-9.md', 'chapter-2.md'])).toEqual(['chapter-2.md', 'chapter-9.md', 'chapter-010.md']);
    expect(compareNaturalPaths('n-99999999999999999999998', 'n-99999999999999999999999')).toBeLessThan(0);
  });

  it('folds case to compare, and is total: only identical paths compare equal', () => {
    expect(sorted(['b.md', 'A.md', 'a.md'])).toEqual(['A.md', 'a.md', 'b.md']);
    expect(compareNaturalPaths('a.md', 'a.md')).toBe(0);
    expect(compareNaturalPaths('a.md', 'a.txt')).not.toBe(0);
    expect(compareNaturalPaths('a.md', 'a.txt')).toBe(-compareNaturalPaths('a.txt', 'a.md'));
  });

  it('keeps a hidden file\'s name, and takes either separator', () => {
    expect(compareNaturalPaths('.notes', '.other')).toBeLessThan(0);
    expect(sorted(['notes\\10.md', 'notes\\9.md'])).toEqual(['notes\\9.md', 'notes\\10.md']);
  });
});
