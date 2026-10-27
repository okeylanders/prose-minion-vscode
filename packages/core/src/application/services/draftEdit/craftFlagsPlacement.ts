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
import { CRAFT_FLAG_LEAVES_SPEECH, type CraftFlagBeatCount, type CraftFlagIssue, type CraftFlagsDropCounts } from '@/domain/models/CraftFlag';
import { anchorQuote } from '@/utils/draftEdit/anchorEdits';
import type { MaskedText } from '@/utils/draftEdit/protectedRegions';
import { phraseRepeats } from '@/utils/craftFlags/phraseRepeats';
import { stockBeatCounts, stockBeatsIn } from '@/utils/craftFlags/stockBeats';
import type { CraftFlagsRunResult } from '@services/craftFlags/CraftFlagsService';
import { byPlace } from '@/application/services/draftEdit/draftEditIssues';

export type CraftFlagsDrops = { -readonly [K in keyof CraftFlagsDropCounts]: number };

export function noCraftFlagDrops(): CraftFlagsDrops {
  return { unanchored: 0, protected: 0, dialogue: 0, overlapping: 0, stale: 0, malformed: 0 };
}

/** The passage a run sends: its region of the document, masked. */
export interface CraftFlagsPrepared {
  readonly region: TextRange;
  readonly masked: MaskedText;
  readonly words: number;
  /** The whole document, or (over the word ceiling) the selection alone. */
  readonly reads: 'document' | 'selection';
}

/**
 * Each finding placed in the gesture's snapshot; `speech` is that text's
 * (`findSpeechSpansOutsideProtected`), and `shown` the region whose flags a
 * run shows.
 */
export function placeCraftFlags(
  text: string,
  prepared: CraftFlagsPrepared,
  result: Extract<CraftFlagsRunResult, { kind: 'completed' }>,
  speech: readonly TextRange[],
  shown: TextRange,
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
      const anchored = anchorQuote(prepared.masked.text, finding.anchor);
      if (anchored.kind !== 'anchored') {
        dropped.unanchored += 1;
        continue;
      }
      const sourceStart = prepared.masked.toSource(anchored.start);
      const sourceEnd = prepared.masked.toSource(anchored.end);
      if (prepared.masked.touchesPlaceholder(anchored) || sourceStart === undefined || sourceEnd === undefined) {
        dropped.protected += 1;
        continue;
      }
      const start = prepared.region.start + sourceStart;
      const end = prepared.region.start + sourceEnd;
      if (CRAFT_FLAG_LEAVES_SPEECH[finding.category] && touchesAny(speech, start, end)) {
        dropped.dialogue += 1;
        continue;
      }
      if (start < shown.start || end > shown.end) {
        outside += 1;
        continue;
      }
      const original = text.slice(start, end);
      placed.push({
        id: nextId(),
        category: finding.category,
        kind: finding.kind,
        start,
        end,
        original,
        why: finding.why,
        ...(finding.suggestion !== undefined ? { suggestion: finding.suggestion } : {}),
        ...(finding.register !== undefined ? { register: finding.register } : {})
      });
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

/** Flags kept only where a category that leaves speech alone touches none of `speech`; the rest counted as dialogue. */
export function outsideSpeech(issues: readonly CraftFlagIssue[], speech: readonly TextRange[], dropped: CraftFlagsDrops): CraftFlagIssue[] {
  const kept = issues.filter((issue) => !(CRAFT_FLAG_LEAVES_SPEECH[issue.category] && touchesAny(speech, issue.start, issue.end)));
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
    message: craftFlagMessage(issue)
  };
}

/**
 * The why, then "One way it could go: …", then a register shift's ground
 * ("The chapter's narration: …"), then the host's count when the phrase
 * recurs, or each named stock beat's that recurs.
 */
export function craftFlagMessage(issue: Pick<CraftFlagIssue, 'why' | 'suggestion' | 'register' | 'repeats' | 'beats'>): string {
  return [
    withStop(issue.why),
    issue.suggestion !== undefined ? `One way it could go: ${withStop(issue.suggestion)}` : '',
    issue.register !== undefined ? `The chapter's narration: ${withStop(issue.register)}` : '',
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
