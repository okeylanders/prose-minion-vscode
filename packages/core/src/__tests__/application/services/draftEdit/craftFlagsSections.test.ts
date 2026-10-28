/**
 * Continuity's sections (ADR 2026-10-21, Amendment 2026-10-26: Slice 3c
 * part 4; PR #180 F-01 to F-03, N-02): a pair lies in one section from its
 * earlier side's start to its later side's end; sections are read only when
 * continuity runs, and in the live text only when a pair is left; and every
 * reading walks the protected regions once. Text adapts public-domain *Alice*.
 */
import type { TextRange } from '@/domain/models/DraftEdit';
import type { CraftFlagIssue } from '@/domain/models/CraftFlag';
import { CRAFT_FLAG_CATEGORIES } from '@/domain/models/CraftFlag';
import { findProtectedRegions } from '@/utils/draftEdit/protectedRegions';
import {
  continuitySections,
  pairSpan,
  spansSectionStart,
  withinOneSection
} from '@/application/services/draftEdit/craftFlagsSections';

const PINK = 'Alice had pink eyes.';
const BLUE = 'Alice had blue eyes.';

/** `ranges`, each start and end read counted. */
function counted(ranges: readonly TextRange[]): { ranges: TextRange[]; reads: () => number } {
  let count = 0;
  return {
    ranges: ranges.map((range): TextRange => ({
      get start() { count += 1; return range.start; },
      get end() { count += 1; return range.end; }
    })),
    reads: () => count
  };
}

const issue = (text: string, later: string, earlier?: string): CraftFlagIssue => {
  const at = (part: string, from = 0) => ({ start: text.indexOf(part, from), end: text.indexOf(part, from) + part.length });
  const flagged = at(later, earlier ? text.indexOf(earlier) + earlier.length : 0);
  return {
    id: 'craft-1',
    category: earlier ? 'continuity' : 'cliche',
    kind: earlier ? 'body' : 'cliche',
    ...flagged,
    original: later,
    why: 'The eyes change with nothing to change them.',
    ...(earlier ? { related: [{ ...at(earlier), original: earlier }] } : {})
  };
};

describe('spansSectionStart', () => {
  it('finds a start after the span\'s first character and before its end, and none at either edge', () => {
    const starts = [10, 20, 30];
    expect(spansSectionStart(starts, { start: 11, end: 21 })).toBe(true);
    expect(spansSectionStart(starts, { start: 0, end: 11 })).toBe(true);
    expect(spansSectionStart(starts, { start: 10, end: 20 })).toBe(false);
    expect(spansSectionStart(starts, { start: 21, end: 30 })).toBe(false);
    expect(spansSectionStart(starts, { start: 31, end: 90 })).toBe(false);
    expect(spansSectionStart([], { start: 0, end: 90 })).toBe(false);
  });
});

describe('pairSpan', () => {
  it('runs from a pair\'s earlier side\'s start to its later side\'s end, and is a flag\'s own place without one', () => {
    const text = `${PINK}\n\n${BLUE}`;
    expect(pairSpan(issue(text, 'blue eyes', 'pink eyes'))).toEqual({ start: text.indexOf('pink'), end: text.indexOf('blue eyes') + 9 });
    expect(pairSpan(issue(text, 'blue eyes'))).toEqual({ start: text.indexOf('blue'), end: text.indexOf('blue eyes') + 9 });
  });
});

describe('withinOneSection (F-02)', () => {
  it('drops, as across a break, a pair a section now divides, and keeps a pair in one section and every other flag', () => {
    const text = `${PINK}\n\n* * *\n\n${BLUE}\n\n${PINK}`;
    const dropped = { acrossBreak: 0 };
    const across = issue(text, 'blue eyes', 'pink eyes');
    const within = { ...issue(text, 'pink eyes', 'blue eyes'), id: 'craft-2' };
    const single = { ...issue(text, 'pink eyes'), id: 'craft-3' };
    expect(withinOneSection([across, within, single], text, [], dropped)).toEqual([within, single]);
    expect(dropped.acrossBreak).toBe(1);
  });

  it('reads no sections when no pair is left to check', () => {
    const text = `${PINK}\n\n## The \`hidden\` hall\n\n${BLUE}`;
    const regions = counted(findProtectedRegions(text, 'markdown'));
    const single = issue(text, 'blue eyes');
    expect(withinOneSection([single], text, regions.ranges, { acrossBreak: 0 })).toEqual([single]);
    expect(regions.reads()).toBe(0);
  });
});

describe('continuitySections', () => {
  it('finds nothing, and reads nothing, when continuity does not run (N-02)', () => {
    const text = `${PINK}\n\n## The \`hidden\` hall\n\n${BLUE}`;
    const regions = counted(findProtectedRegions(text, 'markdown'));
    const others = CRAFT_FLAG_CATEGORIES.filter((category) => category !== 'continuity');
    expect(continuitySections(text, regions.ranges, { start: 0, end: text.length }, others)).toEqual({ starts: [], breaks: [] });
    expect(regions.reads()).toBe(0);
  });

  it('gives the starts over the whole text, and the masked lines of those inside the region read', () => {
    const text = `${PINK}\n\n## The \`hidden\` hall\n\n${BLUE}\n\n* * *\n\n${PINK}`;
    const regions = findProtectedRegions(text, 'markdown');
    const sections = continuitySections(text, regions, { start: 0, end: text.indexOf('* * *') }, ['continuity']);
    expect(sections.starts).toEqual([text.indexOf('## The')]);
    expect(sections.breaks).toHaveLength(1);
    expect(sections.breaks[0]).toMatch(/^## The .+ hall$/);
    expect(sections.breaks[0]).not.toContain('hidden');
  });

  it('walks the protected regions once over, however many section lines hold code (N-02)', () => {
    const reads = (headings: number): number => {
      const text = Array.from({ length: headings }, (_, index) => `## The \`hall ${index}\`\n\n${PINK}`).join('\n\n');
      const regions = counted(findProtectedRegions(text, 'markdown'));
      const sections = continuitySections(text, regions.ranges, { start: 0, end: text.length }, ['continuity']);
      expect(sections.breaks).toHaveLength(headings - 1);
      return regions.reads();
    };
    // Four times the headings, about four times the reads: a read per region per section line would be sixteen.
    const [small, large] = [reads(500), reads(2000)];
    expect(large).toBeLessThanOrEqual(4 * small + 100);
    expect(large).toBeLessThanOrEqual(10 * 2000);
  });
});
