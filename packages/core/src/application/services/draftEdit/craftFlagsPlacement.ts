/**
 * Placing Craft Flags' findings, and showing them (ADR 2026-10-21,
 * Amendment 2026-10-26: Slice 3c). Pure.
 *
 * Each finding is anchored by its quote in the passage its call read, and
 * mapped back to the document. It is dropped, and counted, when it does not
 * anchor once, touches a protected placeholder, touches speech in a category
 * that leaves speech alone (cliché), or overlaps an earlier flag of its
 * category. A selection run that read the whole chapter keeps only the
 * flags inside its selection. Every flag carries the host's count of its
 * phrase in the document's narration.
 *
 * A flag becomes an annotation with no quick fix: Craft Flags never offers
 * an edit.
 */

import type { DocumentAnnotation } from '@/platform';
import type { TextRange } from '@/domain/models/DraftEdit';
import { CRAFT_FLAG_LEAVES_SPEECH, type CraftFlagIssue, type CraftFlagsDropCounts } from '@/domain/models/CraftFlag';
import { anchorQuote } from '@/utils/draftEdit/anchorEdits';
import type { MaskedText } from '@/utils/draftEdit/protectedRegions';
import type { PhraseRepeats } from '@/utils/craftFlags/phraseRepeats';
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

/** What host code read of the whole document. */
export interface CraftFlagsHostRead {
  /** Speech, in order and never overlapping (`findSpeechSpans`). */
  readonly speech: readonly TextRange[];
  readonly repeats: PhraseRepeats;
}

/** Each finding placed in the gesture's snapshot; `shown` is the region whose flags a run shows. */
export function placeCraftFlags(
  text: string,
  prepared: CraftFlagsPrepared,
  result: Extract<CraftFlagsRunResult, { kind: 'completed' }>,
  host: CraftFlagsHostRead,
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
      if (CRAFT_FLAG_LEAVES_SPEECH[finding.category] && touchesAny(host.speech, start, end)) {
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
        repeats: Math.max(1, host.repeats.count(original))
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

/** The why, then "One way it could go: …", then the host's count when the phrase recurs. */
export function craftFlagMessage(issue: Pick<CraftFlagIssue, 'why' | 'suggestion' | 'repeats'>): string {
  return [
    withStop(issue.why),
    issue.suggestion !== undefined ? `One way it could go: ${withStop(issue.suggestion)}` : '',
    issue.repeats > 1 ? `This phrase appears ${issue.repeats} times in this document.` : ''
  ].filter(Boolean).join(' ');
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
