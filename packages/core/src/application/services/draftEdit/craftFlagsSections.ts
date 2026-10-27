/**
 * Continuity's sections (ADR 2026-10-21, Amendment 2026-10-26: Slice 3c
 * part 4; PR #180 F-01 to F-03, N-02). Pure.
 *
 * A continuity pair is two places in one section of the chapter, or no pair:
 * no section may start anywhere after its first character, from its earlier
 * side's start to its later side's end (`spansSectionStart`), so a boundary
 * inside either quote divides it too (F-03). The rule is read twice, alike:
 * when the reply is placed in the gesture's text (`craftFlagsPlacement`), and
 * on the moved pairs in the settled live text (`withinOneSection`), where the
 * writer may have added a break, heading or chapter line while the calls ran
 * (F-02). Sections are `chapterSectionStarts`', with markers inside protected
 * text left out before the signal is chosen (F-01).
 *
 * Sections are read only when continuity runs, and in the live text only
 * when a pair is left to check; every reading is linear in the text and its
 * protected regions (N-02).
 */

import type { TextRange } from '@/domain/models/DraftEdit';
import type { CraftFlagCategory, CraftFlagIssue } from '@/domain/models/CraftFlag';
import { chapterSectionStarts } from '@/utils/chapterSections';
import { maskProtectedRegions } from '@/utils/draftEdit/protectedRegions';
import { placesOf } from '@/application/services/draftEdit/draftEditIssues';

/** The gesture's sections, as continuity reads them. */
export interface CraftFlagsSections {
  /** Where each section after the first begins in the gesture's text, ascending. */
  readonly starts: readonly number[];
  /** The lines that open the read passage's sections after the first, masked as the passage is: continuity's request lists them. */
  readonly breaks: readonly string[];
}

const NO_SECTIONS: CraftFlagsSections = { starts: [], breaks: [] };

/**
 * The sections of `text` and the lines opening those inside `region`; none
 * when continuity is not among `categories`, since no other category reads
 * them. `protectedRegions` are the whole text's, sorted and never overlapping.
 */
export function continuitySections(
  text: string,
  protectedRegions: readonly TextRange[],
  region: TextRange,
  categories: readonly CraftFlagCategory[]
): CraftFlagsSections {
  if (!categories.includes('continuity')) {
    return NO_SECTIONS;
  }
  const starts = chapterSectionStarts(text, protectedRegions);
  return { starts, breaks: breakLines(text, starts, region, protectedRegions) };
}

/** Whether a section starts after `span`'s first character and before its end; `starts` ascending. */
export function spansSectionStart(starts: readonly number[], span: TextRange): boolean {
  // The first start after `span.start` is the only one that can fall inside it.
  let low = 0;
  let high = starts.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (starts[middle] <= span.start) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low < starts.length && starts[low] < span.end;
}

/** The span a placed issue covers, every side of it included: a pair's, from its earlier side's start to its later side's end. */
export function pairSpan(issue: CraftFlagIssue): TextRange {
  const places = placesOf(issue);
  return {
    start: Math.min(...places.map((place) => place.start)),
    end: Math.max(...places.map((place) => place.end))
  };
}

/**
 * The flags whose places all lie in one section of the live `text`; a pair
 * a section now divides is counted as across a break. Sections are read only
 * when there is a pair to check. `protectedRegions` are the live text's.
 */
export function withinOneSection(
  issues: readonly CraftFlagIssue[],
  text: string,
  protectedRegions: readonly TextRange[],
  dropped: { acrossBreak: number }
): CraftFlagIssue[] {
  if (!issues.some((issue) => issue.related !== undefined)) {
    return [...issues];
  }
  const starts = chapterSectionStarts(text, protectedRegions);
  const kept = issues.filter((issue) => issue.related === undefined || !spansSectionStart(starts, pairSpan(issue)));
  dropped.acrossBreak += issues.length - kept.length;
  return kept;
}

/**
 * The line that opens each section starting inside `region`, as the passage
 * sends it: protected text in it masked, so a break line never carries what
 * the passage withholds. One walk over the protected regions, since both they
 * and `starts` are in order (N-02).
 */
function breakLines(text: string, starts: readonly number[], region: TextRange, protectedRegions: readonly TextRange[]): string[] {
  let next = 0;
  return starts.filter((start) => region.start <= start && start < region.end).map((start) => {
    const lineEnd = text.indexOf('\n', start);
    const end = Math.min(lineEnd === -1 ? text.length : lineEnd, region.end);
    while (next < protectedRegions.length && protectedRegions[next].end <= start) {
      next++;
    }
    const inLine: TextRange[] = [];
    for (let index = next; index < protectedRegions.length && protectedRegions[index].start < end; index++) {
      const range = protectedRegions[index];
      inLine.push({ start: Math.max(range.start, start) - start, end: Math.min(range.end, end) - start });
    }
    return maskProtectedRegions(text.slice(start, end), inLine).text.trim();
  });
}
