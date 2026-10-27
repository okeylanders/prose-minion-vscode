/**
 * Placing Craft Flags' findings, and showing them (ADR 2026-10-21,
 * Amendment 2026-10-26: Slice 3c). Pure.
 *
 * Each finding is anchored by its quote in the passage its call read, and
 * mapped back to the document. It is dropped, and counted, when it does not
 * anchor once, touches a protected placeholder, touches speech in a category
 * that leaves speech alone (every category does), or overlaps an earlier flag
 * of its category. A selection run that read the whole chapter keeps only the
 * flags inside its selection. A register shift keeps its reply's register
 * line, shown in its message.
 *
 * A continuity pair (Slice 3c part 4) is placed on both sides, each by its
 * own quote, and dropped when either side is: when either fails to anchor,
 * touches a protected placeholder or touches speech. It is dropped, too, when
 * its earlier side does not end before its later side starts (counted as
 * unanchored), or when a section of the chapter starts anywhere inside it,
 * from its earlier side's start to its later side's end (`acrossBreak`;
 * `spansSectionStart`, PR #180 F-03). The flag sits on the later side, which
 * decides whether it is inside a selection; the earlier side is its related
 * place.
 *
 * Speech is read with protected syntax set aside
 * (`findSpeechSpansOutsideProtected`), in the gesture's text before overlaps
 * are weighed, and again in the settled live text before anything is shown
 * (`outsideSpeech`), so words the writer put in quotation marks during the
 * run are left alone too (PR #177 F-03). Each shown flag's phrase is counted
 * last, in the live text (`withRepeats`, N-01), and only when there is a flag
 * to count for (N-02). A gesture flag that names a stock beat counts the
 * beat instead, every form together (Slice 3c part 3).
 *
 * A flag becomes an annotation with no quick fix: Craft Flags never offers
 * an edit.
 */

import type { DocumentAnnotation } from '@/platform';
import type { TextRange } from '@/domain/models/DraftEdit';
import {
  CRAFT_FLAG_LEAVES_SPEECH,
  type CraftFlagBeatCount,
  type CraftFlagFinding,
  type CraftFlagIssue,
  type CraftFlagsDropCounts
} from '@/domain/models/CraftFlag';
import { anchorQuote } from '@/utils/draftEdit/anchorEdits';
import type { MaskedText } from '@/utils/draftEdit/protectedRegions';
import { phraseRepeats } from '@/utils/craftFlags/phraseRepeats';
import { stockBeatCounts, stockBeatsIn } from '@/utils/craftFlags/stockBeats';
import type { CraftFlagsRunResult } from '@services/craftFlags/CraftFlagsService';
import { byPlace, placesOf } from '@/application/services/draftEdit/draftEditIssues';
import { spansSectionStart } from '@/application/services/draftEdit/craftFlagsSections';

export type CraftFlagsDrops = { -readonly [K in keyof CraftFlagsDropCounts]: number };

export function noCraftFlagDrops(): CraftFlagsDrops {
  return { unanchored: 0, protected: 0, dialogue: 0, acrossBreak: 0, overlapping: 0, stale: 0, malformed: 0 };
}

/** The passage a run sends: its region of the document, masked. */
export interface CraftFlagsPrepared {
  readonly region: TextRange;
  readonly masked: MaskedText;
  readonly words: number;
  /** The whole document, or (over the word ceiling) the selection alone. */
  readonly reads: 'document' | 'selection';
}

/** What placing reads in the gesture's snapshot besides the passage. */
export interface CraftFlagsPlacementScope {
  /** The snapshot's speech (`findSpeechSpansOutsideProtected`). */
  readonly speech: readonly TextRange[];
  /** The region whose flags a run shows. */
  readonly shown: TextRange;
  /** Where each section after the first begins (`chapterSectionStarts`), ascending; none when continuity does not run. */
  readonly sectionStarts: readonly number[];
}

/** Each finding placed in the gesture's snapshot. */
export function placeCraftFlags(
  text: string,
  prepared: CraftFlagsPrepared,
  result: Extract<CraftFlagsRunResult, { kind: 'completed' }>,
  scope: CraftFlagsPlacementScope,
  dropped: CraftFlagsDrops,
  nextId: () => string
): { readonly issues: CraftFlagIssue[]; readonly outside: number } {
  const placed: CraftFlagIssue[] = [];
  let outside = 0;
  for (const call of result.calls) {
    if (call.kind !== 'read') {
      continue;
    }
    dropped.malformed += call.malformed;
    for (const finding of call.findings) {
      const later = placeQuote(prepared, finding.anchor);
      const earlier = finding.earlier ? placeQuote(prepared, finding.earlier) : undefined;
      const fault = [later, earlier].find((side): side is Unplaced => typeof side === 'string');
      if (fault) {
        dropped[fault] += 1;
        continue;
      }
      const flagged = later as TextRange;
      const pair = earlier as TextRange | undefined;
      if (CRAFT_FLAG_LEAVES_SPEECH[finding.category] && [flagged, pair].some((side) => side && touchesAny(scope.speech, side.start, side.end))) {
        dropped.dialogue += 1;
        continue;
      }
      if (pair && pair.end > flagged.start) {
        dropped.unanchored += 1;
        continue;
      }
      if (pair && spansSectionStart(scope.sectionStarts, { start: pair.start, end: flagged.end })) {
        dropped.acrossBreak += 1;
        continue;
      }
      if (flagged.start < scope.shown.start || flagged.end > scope.shown.end) {
        outside += 1;
        continue;
      }
      placed.push(issueOf(finding, text, flagged, pair, nextId()));
    }
  }

  placed.sort(byPlace);
  const kept: CraftFlagIssue[] = [];
  for (const issue of placed) {
    if (kept.some((each) => each.category === issue.category && each.start < issue.end && issue.start < each.end)) {
      dropped.overlapping += 1;
    } else {
      kept.push(issue);
    }
  }
  return { issues: kept, outside };
}

type Unplaced = 'unanchored' | 'protected';

/** A quote placed in the document, through the masked passage it was found in. */
function placeQuote(prepared: CraftFlagsPrepared, anchor: CraftFlagFinding['anchor']): TextRange | Unplaced {
  const anchored = anchorQuote(prepared.masked.text, anchor);
  if (anchored.kind !== 'anchored') {
    return 'unanchored';
  }
  const sourceStart = prepared.masked.toSource(anchored.start);
  const sourceEnd = prepared.masked.toSource(anchored.end);
  if (prepared.masked.touchesPlaceholder(anchored) || sourceStart === undefined || sourceEnd === undefined) {
    return 'protected';
  }
  return { start: prepared.region.start + sourceStart, end: prepared.region.start + sourceEnd };
}

function issueOf(finding: CraftFlagFinding, text: string, flagged: TextRange, pair: TextRange | undefined, id: string): CraftFlagIssue {
  return {
    id,
    category: finding.category,
    kind: finding.kind,
    start: flagged.start,
    end: flagged.end,
    original: text.slice(flagged.start, flagged.end),
    why: finding.why,
    ...(finding.suggestion !== undefined ? { suggestion: finding.suggestion } : {}),
    ...(finding.register !== undefined ? { register: finding.register } : {}),
    ...(pair ? { related: [{ start: pair.start, end: pair.end, original: text.slice(pair.start, pair.end) }] } : {}),
    ...(finding.holds !== undefined ? { holds: finding.holds } : {})
  };
}

/** Flags kept only where a category that leaves speech alone touches none of `speech`, on any side; the rest counted as dialogue. */
export function outsideSpeech(issues: readonly CraftFlagIssue[], speech: readonly TextRange[], dropped: CraftFlagsDrops): CraftFlagIssue[] {
  const kept = issues.filter((issue) =>
    !(CRAFT_FLAG_LEAVES_SPEECH[issue.category] && placesOf(issue).some((place) => touchesAny(speech, place.start, place.end))));
  dropped.dialogue += issues.length - kept.length;
  return kept;
}

/**
 * Each flag with its phrase counted in `text`, `skipped` (speech, protected
 * regions) left out, or, for a gesture flag that names stock beats, each
 * beat counted; nothing is built for no flags.
 */
export function withRepeats(issues: readonly CraftFlagIssue[], text: string, skipped: readonly TextRange[]): CraftFlagIssue[] {
  if (issues.length === 0) {
    return [];
  }
  const repeats = phraseRepeats(text, skipped);
  const beatCounts = stockBeatCounts(text, skipped);
  return issues.map((issue) => {
    if (issue.category === 'continuity') {
      // A phrase counted across the chapter says nothing about a contradiction.
      return issue;
    }
    const named = issue.category === 'gesture' ? stockBeatsIn(issue.original) : [];
    if (named.length > 0) {
      return { ...issue, beats: named.map((beat) => ({ beat: beat.plural, count: Math.max(1, beatCounts.count(beat)) })) };
    }
    const count = repeats.count(issue.original);
    return count === undefined ? issue : { ...issue, repeats: Math.max(1, count) };
  });
}

export function craftFlagAnnotation(issue: CraftFlagIssue): DocumentAnnotation {
  return {
    id: issue.id,
    start: issue.start,
    end: issue.end,
    severity: 'info',
    code: `craft.${issue.category}`,
    message: craftFlagMessage(issue),
    ...(issue.related ? { related: issue.related.map((place) => ({ start: place.start, end: place.end, message: pairLine(place.original) })) } : {})
  };
}

/** A continuity pair's other side, in host words: "The other side of this pair: “…”". */
function pairLine(original: string): string {
  const text = original.replace(/\s+/gu, ' ').trim();
  return `The other side of this pair: “${text.length > 60 ? `${text.slice(0, 59)}…` : text}”`;
}

/**
 * The why, then "One way it could go: …", then a register shift's ground
 * ("The chapter's narration: …"), then which side of a continuity pair the
 * rest of the chapter keeps, then the host's count when the phrase recurs,
 * or each named stock beat's that recurs.
 */
export function craftFlagMessage(issue: Pick<CraftFlagIssue, 'why' | 'suggestion' | 'register' | 'holds' | 'repeats' | 'beats'>): string {
  return [
    withStop(issue.why),
    issue.suggestion !== undefined ? `One way it could go: ${withStop(issue.suggestion)}` : '',
    issue.register !== undefined ? `The chapter's narration: ${withStop(issue.register)}` : '',
    issue.holds === 'earlier' ? 'The rest of the chapter keeps the earlier version.' : '',
    issue.holds === 'later' ? 'The rest of the chapter keeps this version.' : '',
    issue.repeats !== undefined && issue.repeats > 1 ? `This phrase appears ${issue.repeats} times in this document.` : '',
    beatLine(issue.beats ?? [])
  ].filter(Boolean).join(' ');
}

/** "Nods appear 7 times in this document, and smiles 4 times.", for the beats that recur; empty when none does. */
function beatLine(beats: readonly CraftFlagBeatCount[]): string {
  const recurring = beats.filter((each) => each.count > 1);
  if (recurring.length === 0) {
    return '';
  }
  const [first, ...rest] = recurring;
  const parts = [
    `${first.beat[0].toUpperCase()}${first.beat.slice(1)} appear ${first.count} times in this document`,
    ...rest.map((each) => `${each.beat} ${each.count} times`)
  ];
  return parts.length === 1 ? `${parts[0]}.` : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}.`;
}

function withStop(text: string): string {
  return /[.!?…]["”’)]*$/u.test(text) ? text : `${text}.`;
}

/** Whether `start..end` overlaps any of `ranges`, which are in order and never overlap. */
function touchesAny(ranges: readonly TextRange[], start: number, end: number): boolean {
  // The last range starting before `end` is the only one that can reach back past `start`.
  let low = 0;
  let high = ranges.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (ranges[middle].start < end) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low > 0 && ranges[low - 1].end > start;
}
