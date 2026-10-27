/**
 * Stock beats (ADR 2026-10-21, Amendment 2026-10-26: Slice 3c, part 3): the
 * nods, shrugs and smiles a gesture flag may name, and how often each stands
 * in the document's narration. Pure.
 *
 * The model judges every gesture flag, a thin beat's included; host code only
 * counts (the writer's decision, 2026-10-27), since one model call may not
 * count a chapter's nods reliably:
 * - A closed list, each beat's forms written out, matched at word boundaries
 *   with case folded. Not the tagger's lemmas: a closed list's forms are
 *   exact, and the tagger costs about 0.3 s per 25,000 words on the extension
 *   host.
 * - Counted in narration: an occurrence touching a skipped range (speech,
 *   protected regions) is not counted, by the walk phrase counts use
 *   (`matchesOutside`).
 * - Bounded: a beat is counted only when asked about, by one scan of the
 *   text, so at most `STOCK_BEATS.length` scans per document.
 * - The limits, stated plainly: a form used for something else ("the land of
 *   Nod") counts too, and a beat written without a listed form ("dipped her
 *   chin") is not counted.
 */

import type { TextRange } from '@/domain/models/DraftEdit';
import { joinedRanges, matchesOutside } from '@/utils/craftFlags/phraseRepeats';

export interface StockBeat {
  readonly id: string;
  /** The beat in the plural, as a note names it. */
  readonly plural: string;
  /** Its forms, whole words, case folded. */
  readonly pattern: RegExp;
}

const POSSESSIVE = "(?:his|her|their|my|your|its|our|one['’]s)";
const DETERMINER = `(?:the|${POSSESSIVE})`;

function beat(id: string, plural: string, forms: string): StockBeat {
  return { id, plural, pattern: new RegExp(`(?<![\\p{L}\\p{N}])(?:${forms})(?![\\p{L}\\p{N}])`, 'giu') };
}

/** The closed list, in no order a note depends on. */
export const STOCK_BEATS: readonly StockBeat[] = Object.freeze([
  beat('nod', 'nods', 'nod(?:s|ded|ding)?'),
  beat('shrug', 'shrugs', 'shrug(?:s|ged|ging)?'),
  beat('sigh', 'sighs', 'sigh(?:s|ed|ing)?'),
  beat('smile', 'smiles', 'smil(?:e|es|ed|ing)'),
  beat('grin', 'grins', 'grin(?:s|ned|ning)?'),
  beat('frown', 'frowns', 'frown(?:s|ed|ing)?'),
  beat('wink', 'winks', 'wink(?:s|ed|ing)?'),
  beat('smirk', 'smirks', 'smirk(?:s|ed|ing)?'),
  beat(
    'head-shake',
    'head shakes',
    `(?:shak(?:e|es|ing|en)|shook)\\s+${POSSESSIVE}\\s+heads?|shakes?\\s+of\\s+${DETERMINER}\\s+heads?`
  ),
  beat(
    'eye-roll',
    'eye rolls',
    `roll(?:s|ed|ing)?\\s+${POSSESSIVE}\\s+eyes|rolls?\\s+of\\s+${DETERMINER}\\s+eyes|eye[\\s-]?roll(?:s|ing)?`
  )
]);

/** The listed beats `words` name, in the order they first stand there, each once. */
export function stockBeatsIn(words: string): StockBeat[] {
  return STOCK_BEATS
    .map((each) => ({ beat: each, at: words.search(each.pattern) }))
    .filter((found) => found.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((found) => found.beat);
}

export interface StockBeatCounts {
  /** How many times `beat` stands outside the skipped ranges, every form together. */
  count(beat: StockBeat): number;
}

/** Counts each beat asked about once, in `text`, `skipped` (speech, protected regions) left out. */
export function stockBeatCounts(text: string, skipped: readonly TextRange[]): StockBeatCounts {
  const ranges = joinedRanges(skipped);
  const counted = new Map<string, number>();
  return {
    count(beat: StockBeat): number {
      const known = counted.get(beat.id);
      if (known !== undefined) {
        return known;
      }
      const count = matchesOutside(text, beat.pattern, ranges);
      counted.set(beat.id, count);
      return count;
    }
  };
}
