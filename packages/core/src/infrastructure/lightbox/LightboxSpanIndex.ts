/**
 * Each paragraph's instances of a word pattern, and its dialogue spans,
 * found once per text and indexed (PR #162 F-01). Pure: no host, no I/O,
 * no model.
 *
 * A reading's quote check, a steering note's voice (epic decision 26) and
 * its example's anchor all ask one paragraph the same questions: does this
 * span hold an instance of the figure, one in narration, does it take in
 * speech? Each used to run the figure's detector again (being verbs tag
 * the paragraph), and to scan every dialogue span for every instance. Here:
 * - **Once per text.** A paragraph is run through each figure's detector
 *   (`LIGHTBOX_NUMBER_PATTERNS`) and the dialogue matcher
 *   (`findDialogueSpans`) at most once for as long as the paragraphs array
 *   a verifier checks against lives: the index is keyed by that array, and
 *   by each paragraph's own string, so a changed paragraph is indexed
 *   afresh. Fresh assembly, carry and Bring each build their verifier over
 *   their own text, so each reuses its own work, never another text's.
 * - **Each question is a binary search.** "Some instance lies inside
 *   [a, b]": instances sorted by start, with the least end from each one on.
 *   "Some dialogue span holds [a, b]", "some dialogue span shares a
 *   character with [a, b)": spans sorted by start, with the furthest end up
 *   to each (`lightboxIntervalReach`, the steering measure's own index). An
 *   instance is in narration when no dialogue span holds it, as the measure
 *   splits them.
 * Offsets are the source's own UTF-16 offsets, as every detector and the
 * verifier give them; nothing is matched here.
 */

import { findDialogueSpans } from '@/utils/dialogueSpans';
import { LIGHTBOX_NUMBER_PATTERNS, type LightboxNumberPatternId } from '@/infrastructure/lightbox/LightboxNumbers';

type Span = { readonly start: number; readonly end: number };

/** One paragraph's instances of one figure, by its own detector. */
export interface LightboxParagraphPattern {
  /** Whether some instance lies inside `start`–`end`. */
  holds(start: number, end: number): boolean;
  /** Whether some instance lies inside `start`–`end` and inside no dialogue span: one in narration. */
  holdsInNarration(start: number, end: number): boolean;
}

/** One paragraph's dialogue spans (`findDialogueSpans`). */
export interface LightboxParagraphDialogue {
  /** Whether one dialogue span holds all of `start`–`end`. */
  holds(start: number, end: number): boolean;
  /** Whether `start`–`end` shares a character with a dialogue span: takes in any speech, its marks included. */
  overlaps(start: number, end: number): boolean;
}

interface Indexed<T> {
  source: string;
  index: T;
}

interface TextIndex {
  dialogue: Map<number, Indexed<LightboxParagraphDialogue>>;
  patterns: Map<string, Indexed<LightboxParagraphPattern>>;
}

const INDEXES = new WeakMap<readonly string[], TextIndex>();

/** Paragraph `paragraph` (1-based) of `paragraphs`, by `stat`'s detector; undefined when there is no such paragraph. */
export function lightboxParagraphPattern(
  paragraphs: readonly string[],
  stat: LightboxNumberPatternId,
  paragraph: number
): LightboxParagraphPattern | undefined {
  const source = paragraphs[paragraph - 1];
  if (source === undefined) {
    return undefined;
  }
  return cached(textIndex(paragraphs).patterns, `${stat}:${paragraph}`, source, () => {
    const instances = LIGHTBOX_NUMBER_PATTERNS[stat](source);
    let narrated: ((start: number, end: number) => boolean) | undefined;
    return {
      holds: insideIndex(instances),
      holdsInNarration(start, end) {
        if (!narrated) {
          const dialogue = dialogueOf(paragraphs, paragraph, source);
          narrated = insideIndex(instances.filter((instance) => !dialogue.holds(instance.start, instance.end)));
        }
        return narrated(start, end);
      }
    };
  });
}

/** Paragraph `paragraph` (1-based) of `paragraphs`, by the dialogue matcher; undefined when there is no such paragraph. */
export function lightboxParagraphDialogue(paragraphs: readonly string[], paragraph: number): LightboxParagraphDialogue | undefined {
  const source = paragraphs[paragraph - 1];
  return source === undefined ? undefined : dialogueOf(paragraphs, paragraph, source);
}

/**
 * For intervals in any order: at a position, the furthest end of any
 * interval starting at or before it (-Infinity when none does), by binary
 * search over the sorted starts and a running maximum of the ends. "Some
 * interval holds [a, b]" is `reach(a) >= b`, exactly what a scan finds;
 * "some interval starting before b ends after a" is `reach(b - 1) > a`.
 */
export function lightboxIntervalReach(intervals: ReadonlyArray<Span>): (at: number) => number {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const starts = sorted.map((interval) => interval.start);
  const reach: number[] = [];
  sorted.forEach((interval, index) => {
    reach.push(Math.max(index > 0 ? reach[index - 1] : -Infinity, interval.end));
  });
  return (at) => {
    const index = lightboxLastAtOrBefore(starts, at);
    return index < 0 ? -Infinity : reach[index];
  };
}

/** The last index whose value is at most `at`, in ascending `values`; -1 when there is none. */
export function lightboxLastAtOrBefore(values: readonly number[], at: number): number {
  let low = 0;
  let high = values.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (values[middle] <= at) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

/** "Some span lies inside [start, end]": spans sorted by start, with the least end from each one on. */
function insideIndex(spans: ReadonlyArray<Span>): (start: number, end: number) => boolean {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const starts = sorted.map((span) => span.start);
  const leastEnd: number[] = new Array<number>(sorted.length);
  let least = Infinity;
  for (let index = sorted.length - 1; index >= 0; index--) {
    least = Math.min(least, sorted[index].end);
    leastEnd[index] = least;
  }
  return (start, end) => {
    // The first span starting at or after `start` (offsets are whole numbers).
    const first = lightboxLastAtOrBefore(starts, start - 1) + 1;
    return first < sorted.length && leastEnd[first] <= end;
  };
}

function dialogueOf(paragraphs: readonly string[], paragraph: number, source: string): LightboxParagraphDialogue {
  return cached(textIndex(paragraphs).dialogue, paragraph, source, () => {
    const reach = lightboxIntervalReach(findDialogueSpans(source));
    return {
      holds: (start, end) => reach(start) >= end,
      overlaps: (start, end) => end > start && reach(end - 1) > start
    };
  });
}

function textIndex(paragraphs: readonly string[]): TextIndex {
  let index = INDEXES.get(paragraphs);
  if (!index) {
    index = { dialogue: new Map(), patterns: new Map() };
    INDEXES.set(paragraphs, index);
  }
  return index;
}

/** The index for `key` while its paragraph is still `source`; built (once) otherwise. */
function cached<K, T>(entries: Map<K, Indexed<T>>, key: K, source: string, build: () => T): T {
  const entry = entries.get(key);
  if (entry && entry.source === source) {
    return entry.index;
  }
  const index = build();
  entries.set(key, { source, index });
  return index;
}
