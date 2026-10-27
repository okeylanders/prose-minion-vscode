/**
 * Consistency (Draft Edit Slice 3b, part 3; ADR 2026-10-21, Amendment
 * 2026-10-26): a word one document spells two ways, grey and gray, toward
 * and towards, found by host code over the whole document from a closed
 * table (`VARIANT_SPELLINGS`), never by a model. Pure, and linear in the
 * text: one walk over its words, each looked up once.
 *
 * - **Read as words** (`proofreadWords`), with case, apostrophe shape and a
 *   possessive set aside. A hyphenated word is read whole, then part by part
 *   ("grey-green"). "all right" is two words with only spaces or tabs
 *   between them; across a line break it is not read, since its
 *   *Replace with* would join two lines.
 * - **Never read:** words in the skipped regions (protected text), and a
 *   capitalized word mid-sentence (`followsMidSentence`), which is a name:
 *   "Mr Gray", "Pearl Harbor", "the Labour vote".
 * - **Where a document spells a word both ways,** every use of the spelling
 *   it uses less is flagged, with a *Replace with* the same inflection of
 *   the other, its case kept. A tie flags nothing.
 * - **With a spelling convention named,** the spelling that convention uses
 *   wins whatever the counts. A word the convention spells either way falls
 *   back to the counts.
 * - **A word the writer's list accepts** counts, but is never flagged.
 *
 * "all right" in the sense "all correct" is read as the spelling of
 * "alright", so where "alright" is the more used it is flagged: the stated
 * limit.
 */

import type { ProofreadSpellingConvention, TextRange } from '@/domain/models/DraftEdit';
import { followsMidSentence } from '@/utils/proofread/nameConsistency';
import { isAcceptedWord, proofreadWordKey, proofreadWords, type ProofreadWord } from '@/utils/proofread/proofreadWordList';
import { VARIANT_SPELLINGS, type VariantSpelling } from '@/utils/proofread/variantSpellings';

/** One use of the spelling a document should not keep, and what to write instead. */
export interface InconsistentSpelling {
  readonly start: number;
  readonly end: number;
  /** As written. */
  readonly original: string;
  /** The same inflection of the other spelling, in the case `original` is written. */
  readonly replacement: string;
  /** The flagged spelling's first form, as the table writes it. */
  readonly spelling: string;
  /** The other spelling's first form. */
  readonly otherSpelling: string;
  /** How often the document writes each, every inflection counted. */
  readonly uses: number;
  readonly otherUses: number;
  /** The convention that decided, when one did; absent when the counts did. */
  readonly convention?: ProofreadSpellingConvention;
}

/** Where a form stands in the table. */
interface FormRef {
  readonly entry: number;
  readonly side: 0 | 1;
  readonly inflection: number;
}

/**
 * Each entry's uses, by side: flat runs of start, end and inflection, so a
 * long document's thousands of uses make no object each.
 */
type Uses = readonly [number[], number[]][];

const { words: ONE_WORD, phrases: TWO_WORDS } = indexForms(VARIANT_SPELLINGS);
const SPACES = /^[ \t]+$/u;
const UPPER = /^\p{Lu}/u;
/** Three numbers a use. */
const STRIDE = 3;

/** Each use of a spelling `text` should not keep, in order. */
export function findInconsistentSpellings(
  text: string,
  skippedRegions: readonly TextRange[],
  accepted: ReadonlySet<string>,
  convention?: ProofreadSpellingConvention
): InconsistentSpelling[] {
  const found: InconsistentSpelling[] = [];
  usesOf(text, skippedRegions).forEach(([first, second], entry) => {
    const counts = [first.length / STRIDE, second.length / STRIDE] as const;
    if (counts[0] === 0 || counts[1] === 0) {
      return;
    }
    const variant = VARIANT_SPELLINGS[entry];
    const preferred = convention ? variant.preferred?.[convention] : undefined;
    const flagged = preferred !== undefined ? 1 - preferred : counts[0] < counts[1] ? 0 : counts[1] < counts[0] ? 1 : undefined;
    if (flagged === undefined) {
      return;
    }
    const other = 1 - flagged;
    const runs = [first, second][flagged];
    for (let at = 0; at < runs.length; at += STRIDE) {
      const [start, end, inflection] = [runs[at], runs[at + 1], runs[at + 2]];
      const original = text.slice(start, end);
      if (isAcceptedWord(accepted, original)) {
        continue;
      }
      found.push({
        start,
        end,
        original,
        replacement: inCaseOf(original, variant.forms[inflection][flagged], variant.forms[inflection][other]),
        spelling: variant.forms[0][flagged],
        otherSpelling: variant.forms[0][other],
        uses: counts[flagged],
        otherUses: counts[other],
        ...(preferred !== undefined && convention ? { convention } : {})
      });
    }
  });
  return found.sort((a, b) => a.start - b.start);
}

/** Every use of a table form outside the skipped regions and names, by entry and side, each side in order. */
function usesOf(text: string, skippedRegions: readonly TextRange[]): Uses {
  const skipped = [...skippedRegions].sort((a, b) => a.start - b.start);
  let next = 0;
  const inSkipped = (start: number, end: number): boolean => {
    while (next < skipped.length && skipped[next].end <= start) {
      next += 1;
    }
    return next < skipped.length && skipped[next].start < end;
  };
  const uses: Uses = VARIANT_SPELLINGS.map((): [number[], number[]] => [[], []]);
  // Only a word that is a form is asked whether it is skipped or a name: most words are neither.
  const use = (ref: FormRef, word: ProofreadWord, start: number, end: number): void => {
    if (!inSkipped(start, end) && !isName(text, word)) {
      uses[ref.entry][ref.side].push(start, end, ref.inflection);
    }
  };
  const words = proofreadWords(text);
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const key = keyOf(word.text);
    const following = TWO_WORDS.has(key) ? words[index + 1] : undefined;
    const phrase = following && SPACES.test(text.slice(word.end, following.start))
      ? TWO_WORDS.get(key)?.get(keyOf(following.text))
      : undefined;
    if (phrase && following) {
      use(phrase, word, word.start, following.end);
      index += 1;
      continue;
    }
    const whole = ONE_WORD.get(key);
    if (whole) {
      use(whole, word, word.start, word.end);
    } else if (key.includes('-')) {
      let offset = word.start;
      for (const part of key.split('-')) {
        const ref = ONE_WORD.get(part);
        if (ref) {
          use(ref, word, offset, offset + part.length);
        }
        offset += part.length + 1;
      }
    }
  }
  return uses;
}

/**
 * How a word is looked up. The table's forms are ASCII letters, hyphens and
 * one space, keyed in lower case ("OK" too), so a word is lowered only when
 * its first letter is a capital: "Grey", "OKAY". A word capitalized only
 * after its first letter ("gREY") is not read: the stated limit, for one walk
 * that copies almost no word.
 */
function keyOf(word: string): string {
  const first = word.charCodeAt(0);
  return first >= 65 && first <= 90 ? word.toLowerCase() : word;
}

/** A capitalized word mid-sentence, not written all in capitals ("OK" is a word): a name. */
function isName(text: string, word: ProofreadWord): boolean {
  const first = word.text.charCodeAt(0);
  return first >= 65 && first <= 90 && word.text !== word.text.toUpperCase() && followsMidSentence(text, word.start);
}

/** `target` in the case `original` is written, `form` being how the table writes `original`. */
function inCaseOf(original: string, form: string, target: string): string {
  if (original === form) {
    return target;
  }
  if (original === original.toUpperCase() && original !== original.toLowerCase() && original.length > 1) {
    return target.toUpperCase();
  }
  return UPPER.test(original) && !UPPER.test(target) ? target.charAt(0).toUpperCase() + target.slice(1) : target;
}

/** The table's forms by key: one word, or two (the first word's key, then the second's). */
function indexForms(table: readonly VariantSpelling[]): {
  words: ReadonlyMap<string, FormRef>;
  phrases: ReadonlyMap<string, ReadonlyMap<string, FormRef>>;
} {
  const words = new Map<string, FormRef>();
  const phrases = new Map<string, Map<string, FormRef>>();
  table.forEach((variant, entry) => variant.forms.forEach((pair, inflection) => pair.forEach((form, side) => {
    const ref: FormRef = { entry, side: side as 0 | 1, inflection };
    const [first, second] = form.split(' ');
    if (second === undefined) {
      words.set(proofreadWordKey(first), ref);
    } else {
      const byFirst = phrases.get(proofreadWordKey(first)) ?? new Map<string, FormRef>();
      byFirst.set(proofreadWordKey(second), ref);
      phrases.set(proofreadWordKey(first), byFirst);
    }
  })));
  return { words, phrases };
}
