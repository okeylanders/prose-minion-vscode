/**
 * Name consistency (Draft Edit Slice 3b, part 2; ADR 2026-10-21, Amendment
 * 2026-10-26): a rare spelling of a common name, found by host code over
 * the whole document, never by a model, since one chunk may hold one use of
 * a name or none. Pure and deterministic.
 *
 * - **Names.** A capitalized word, three letters or more and not all
 *   capitals, is a name when at least once it follows a letter, digit, comma
 *   or semicolon on its own line: mid-sentence, where only a name is
 *   capitalized. A word after an opening quotation mark, a colon or a dash
 *   is never that evidence. Words in protected regions and on Markdown
 *   heading lines (title case) are not read. Month and day names, honorifics
 *   and the forms of "I" are never names.
 * - **Variants.** A name used at most twice is a variant of a name with the
 *   same first letter used at least three times as often, within one edit up
 *   to six letters or two from seven. Edits are counted by optimal string
 *   alignment, so swapping two neighbouring letters is one edit. A
 *   possessive "'s" is set aside. When two names tie as the most used
 *   candidate, neither is offered.
 * - **Never flagged:**
 *   - a word the writer's list accepts;
 *   - a variant the document also uses in lower case, which makes it a word,
 *     not a misspelled name ("Rise" beside "rise");
 *   - a plural of the common name ("Tobins" beside "Tobin").
 *
 * Each use of a variant is flagged, with the common name as its suggestion.
 * A misspelling only ever written at a sentence's start is never evidence of
 * a name, so it is not found: the stated limit.
 *
 * It runs on the extension host, over the whole document, so it compares
 * only names that could be close: each common name is indexed by what is
 * left with up to two letters deleted, and a variant looks up its own. Past
 * `candidateBudget` it stops and finds nothing, rather than show a part.
 */

import type { TextRange } from '@/domain/models/DraftEdit';
import { proofreadWordKey, proofreadWords } from '@/utils/proofread/proofreadWordList';

export const NAME_CONSISTENCY = Object.freeze({
  /** A form used at most this often may be a variant. */
  rareUses: 2,
  /** The common name is used at least this many times as often. */
  ratio: 3,
  minimumLength: 3,
  /** Up to this many letters, one edit; longer, two. */
  shortLength: 6,
  /**
   * The candidate names a check may look at in all. Past it the check stops
   * and finds nothing, so a document of thousands of near-alike capitalized
   * words (a glossary, an index) never holds up the extension host. Measured:
   * 13,000 distinct names in 285,000 words looked at 31,234 (412 ms).
   */
  candidateBudget: 100_000
});

/** What a check found: every variant, or nothing when it stopped at its budget. */
export type NameVariantsResult =
  | { readonly kind: 'checked'; readonly variants: readonly NameVariant[] }
  | { readonly kind: 'stopped'; readonly names: number };

/** One use of a variant, and the name it is a variant of. */
export interface NameVariant {
  readonly start: number;
  readonly end: number;
  readonly variant: string;
  readonly name: string;
  readonly variantUses: number;
  readonly nameUses: number;
}

const NEVER_NAMES: ReadonlySet<string> = new Set([
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'mr', 'mrs', 'ms', 'mx', 'miss', 'dr', 'sir', 'dame', 'lord', 'lady', 'madam', 'madame', 'master', 'mistress',
  'professor', 'prof', 'rev', 'reverend', 'captain', 'capt', 'saint', 'uncle', 'aunt'
]);
const UPPER = /^\p{Lu}/u;
const LOWER = /^\p{Ll}/u;
const EVIDENCE = /[\p{L}\p{N},;]/u;
const HEADING_LINE = /^ {0,3}#{1,6}(?:[ \t].*)?$/gmu;

/** The variants of `text`'s names, each use in order; `accepted` holds the writer's word-list keys. */
export function findNameVariants(text: string, protectedRegions: readonly TextRange[], accepted: ReadonlySet<string>): NameVariantsResult {
  const skipped = [...protectedRegions, ...headingLines(text)].sort((a, b) => a.start - b.start);
  const uses = new Map<string, TextRange[]>();
  const named = new Set<string>();
  const lowerCase = new Set<string>();
  let next = 0;
  for (const word of proofreadWords(text)) {
    while (next < skipped.length && skipped[next].end <= word.start) {
      next += 1;
    }
    if (insideAny(skipped, next, word)) {
      continue;
    }
    if (LOWER.test(word.text)) {
      lowerCase.add(proofreadWordKey(word.text));
    } else if (isNameShaped(word.text)) {
      const ranges = uses.get(word.text) ?? [];
      ranges.push({ start: word.start, end: word.end });
      uses.set(word.text, ranges);
      if (followsMidSentence(text, word.start)) {
        named.add(word.text);
      }
    }
  }

  // A variant's candidates: names used at least `ratio` times, indexed by what is left with up to two letters deleted.
  const nearby = new Map<string, string[]>();
  for (const name of named) {
    if (uses.get(name)!.length >= NAME_CONSISTENCY.ratio) {
      for (const key of deletionsOf(name)) {
        const bucket = nearby.get(key) ?? [];
        bucket.push(name);
        nearby.set(key, bucket);
      }
    }
  }
  const variants: NameVariant[] = [];
  const budget = { left: NAME_CONSISTENCY.candidateBudget };
  for (const variant of named) {
    const variantUses = uses.get(variant)!.length;
    if (variantUses > NAME_CONSISTENCY.rareUses || accepted.has(proofreadWordKey(variant)) || lowerCase.has(proofreadWordKey(variant))) {
      continue;
    }
    const candidates = candidatesOf(variant, nearby, budget);
    if (!candidates) {
      return { kind: 'stopped', names: named.size };
    }
    const name = commonNameOf(variant, variantUses, candidates, uses);
    if (name) {
      const nameUses = uses.get(name)!.length;
      uses.get(variant)!.forEach((range) => variants.push({ ...range, variant, name, variantUses, nameUses }));
    }
  }
  return { kind: 'checked', variants: variants.sort((a, b) => a.start - b.start) };
}

/**
 * `word` with up to two letters deleted, itself included. Two words within
 * two edits (a swap of neighbours counting as one) always share one of
 * these, so only names sharing one are ever compared.
 */
function deletionsOf(word: string): Set<string> {
  const all = new Set([word]);
  let frontier = [word];
  for (let depth = 0; depth < 2; depth += 1) {
    const next: string[] = [];
    for (const each of frontier) {
      for (let at = 0; at < each.length; at += 1) {
        const shorter = each.slice(0, at) + each.slice(at + 1);
        if (!all.has(shorter)) {
          all.add(shorter);
          next.push(shorter);
        }
      }
    }
    frontier = next;
  }
  return all;
}

/** The common names sharing a deletion with `variant`, and its first letter; undefined once `budget` runs out. */
function candidatesOf(variant: string, nearby: ReadonlyMap<string, readonly string[]>, budget: { left: number }): string[] | undefined {
  const candidates = new Set<string>();
  for (const key of deletionsOf(variant)) {
    const bucket = nearby.get(key) ?? [];
    budget.left -= bucket.length;
    if (budget.left < 0) {
      return undefined;
    }
    for (const name of bucket) {
      if (name[0] === variant[0]) {
        candidates.add(name);
      }
    }
  }
  return [...candidates];
}

/** The most used name `variant` may be a misspelling of; none when two tie. */
function commonNameOf(variant: string, variantUses: number, candidates: readonly string[], uses: ReadonlyMap<string, readonly TextRange[]>): string | undefined {
  let best: string | undefined;
  let bestUses = 0;
  let tied = false;
  for (const name of candidates) {
    const nameUses = uses.get(name)!.length;
    if (name === variant || nameUses < NAME_CONSISTENCY.ratio * variantUses || isPlural(variant, name) || !withinEdits(variant, name)) {
      continue;
    }
    if (nameUses > bestUses) {
      best = name;
      bestUses = nameUses;
      tied = false;
    } else if (nameUses === bestUses) {
      tied = true;
    }
  }
  return tied ? undefined : best;
}

/** Whether `range` overlaps a skipped range, scanning from `from` while they start before it ends. */
function insideAny(skipped: readonly TextRange[], from: number, range: TextRange): boolean {
  for (let index = from; index < skipped.length && skipped[index].start < range.end; index += 1) {
    if (skipped[index].end > range.start) {
      return true;
    }
  }
  return false;
}

function isNameShaped(word: string): boolean {
  return UPPER.test(word)
    && word.length >= NAME_CONSISTENCY.minimumLength
    && word !== word.toUpperCase()
    && !/^I['’]/u.test(word)
    && !NEVER_NAMES.has(proofreadWordKey(word));
}

/** Whether the nearest character before `start` on its line is a letter, digit, comma or semicolon. */
function followsMidSentence(text: string, start: number): boolean {
  let at = start - 1;
  while (at >= 0 && (text[at] === ' ' || text[at] === '\t' || text[at] === ' ')) {
    at -= 1;
  }
  return at >= 0 && EVIDENCE.test(text[at]);
}

function isPlural(a: string, b: string): boolean {
  return a === `${b}s` || a === `${b}es` || b === `${a}s` || b === `${a}es`;
}

/**
 * Within one edit up to `shortLength` letters, two beyond, by optimal string
 * alignment, row by row in three reused rows, stopping as soon as a row's
 * least value passes the allowance.
 */
function withinEdits(a: string, b: string): boolean {
  const allowed = Math.max(a.length, b.length) <= NAME_CONSISTENCY.shortLength ? 1 : 2;
  if (Math.abs(a.length - b.length) > allowed) {
    return false;
  }
  if (rows[0].length <= b.length) {
    rows = [new Int32Array(b.length * 2 + 1), new Int32Array(b.length * 2 + 1), new Int32Array(b.length * 2 + 1)];
  }
  let [beforeLast, last, current] = rows;
  for (let j = 0; j <= b.length; j += 1) {
    last[j] = j;
  }
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let least = i;
    for (let j = 1; j <= b.length; j += 1) {
      let value = Math.min(last[j] + 1, current[j - 1] + 1, last[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, beforeLast[j - 2] + 1);
      }
      current[j] = value;
      least = Math.min(least, value);
    }
    if (least > allowed) {
      return false;
    }
    [beforeLast, last, current] = [last, current, beforeLast];
  }
  return last[b.length] <= allowed;
}

/** The distance rows, grown to the longest name compared, kept between calls. */
let rows: [Int32Array, Int32Array, Int32Array] = [new Int32Array(32), new Int32Array(32), new Int32Array(32)];

/** Markdown heading lines, whose title case says nothing about names. */
function headingLines(text: string): TextRange[] {
  return [...text.matchAll(HEADING_LINE)].map((match) => ({ start: match.index ?? 0, end: (match.index ?? 0) + match[0].length }));
}
