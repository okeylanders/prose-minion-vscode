/**
 * The Lightbox quote verifier (ADR 2026-10-19 D7). Pure: no host, no I/O.
 *
 * A reading's quote is checked against the one chapter paragraph it names,
 * never against context files or any other text. The check is exact first.
 * Failing that, both sides are folded and compared again:
 * - Unicode NFKC (so "…" is "...", and compatibility forms match);
 * - curly and straight double quotes are one mark, as are single quotes
 *   and apostrophes;
 * - every dash and hyphen is one mark, a run of them is one, and spaces
 *   beside a dash are dropped ("word — word" matches "word--word");
 * - runs of whitespace (line breaks included) are one space.
 * Case is preserved: a quote in the wrong case is not the chapter's.
 *
 * A match returns the span as it stands in the chapter (mapped back through
 * the fold), so the writer always sees their own text. A paragraph number the
 * host never declared fails: a model may cite only what the host declared
 * (the widgets' referential-integrity rule). When a quote fails, the verifier
 * says whether its words stand in another paragraph, which helps the writer
 * read the reason; it never moves the quote there.
 *
 * **The span map (PR #149 F-01).** The fold is addressed in UTF-16 code
 * units, as `indexOf` and `length` are, so every emitted code unit (both
 * halves of a supplementary character included) maps to the source span of
 * the normalization unit it came from. A unit is a base character with its
 * combining marks, widened while NFKC joins it to what follows (Hangul jamo
 * into a syllable, a halfwidth sound mark into its kana), and checked
 * against its run's own NFKC (`normalizationUnits`): the units' normalized
 * forms concatenate to the whole string's NFKC, so equivalence is the whole
 * string's, not a guess about bases and marks (PR #149 F-09). A match, exact or
 * folded, counts only when it starts and ends on unit boundaries (never half a
 * ligature, a syllable or an accented letter), and a folded one only when the
 * source span it maps to folds back to exactly the matched form, so what the
 * writer is shown is always the text that matched.
 */

import type { LightboxQuoteFailure, LightboxQuoteMatch } from '@messages';

/** Fewer letters than this anchor nothing ("the", "Oh"). */
export const LIGHTBOX_QUOTE_MINIMUM_LETTERS = 4;

export type LightboxQuoteVerdict =
  | { found: true; paragraph: number; text: string; match: LightboxQuoteMatch }
  | { found: false; paragraph: number; reason: LightboxQuoteFailure; foundIn?: number[] };

export interface LightboxQuoteVerifier {
  /** `paragraph` is 1-based. */
  verify(paragraph: number, quote: string): LightboxQuoteVerdict;
  readonly paragraphCount: number;
}

interface FoldedText {
  folded: string;
  /**
   * For each UTF-16 code unit of `folded`, the start and end offsets (in the
   * original's code units) of the normalization unit it came from.
   */
  starts: number[];
  ends: number[];
  /** Offsets in the original where a normalization unit starts, and its length: where a match may start or end. */
  boundaries: ReadonlySet<number>;
}

/** A run of the original that NFKC normalizes on its own. */
interface NormalizationUnit {
  start: number;
  end: number;
  normalized: string;
}

const DOUBLE_QUOTES = /["“”„‟″〝〞＂«»]/u;
const SINGLE_QUOTES = /['‘’‚‛′`´]/u;
const DASHES = /[-‐‑‒–—―−⁃﹘﹣－]/u;
const LETTER = /\p{L}/u;
/** A base character with its combining marks: the smallest unit a match may start or end on. */
const SEGMENT = /\P{M}\p{M}*|\p{M}+/gu;
/**
 * Below U+0300 (Latin, IPA, spacing modifiers) every code point is a starter
 * that combines with nothing before it and decomposes to a starter, so NFKC
 * never reaches back across one: a segment starting there starts a new run.
 */
const FIRST_COMBINING_CODE_POINT = 0x300;

/** Build a verifier over the chapter's paragraphs (index 0 is ¶1). */
export function createLightboxQuoteVerifier(paragraphs: readonly string[]): LightboxQuoteVerifier {
  const folded = paragraphs.map((paragraph) => foldWithMap(paragraph));

  /** Exact first; then folded, with the quote's own wrapping marks, then without them. */
  const locate = (index: number, quote: string, foldedForms: readonly string[]): LightboxQuoteVerdict | undefined => {
    const paragraph = paragraphs[index];
    const target = folded[index];
    // Exact, but never half of a unit: "cafe" does not quote "cafe\u0301".
    for (let at = paragraph.indexOf(quote); at >= 0; at = paragraph.indexOf(quote, at + 1)) {
      if (target.boundaries.has(at) && target.boundaries.has(at + quote.length)) {
        return { found: true, paragraph: index + 1, text: paragraph.slice(at, at + quote.length), match: 'exact' };
      }
    }
    for (const form of foldedForms) {
      for (let at = target.folded.indexOf(form); at >= 0; at = target.folded.indexOf(form, at + 1)) {
        const span = sourceSpan(target, at, form.length);
        // The span must fold back to the form that matched: the writer sees exactly what matched.
        if (span && foldWithMap(paragraph.slice(span.start, span.end)).folded === form) {
          return { found: true, paragraph: index + 1, text: paragraph.slice(span.start, span.end), match: 'normalized' };
        }
      }
    }
    return undefined;
  };

  return {
    paragraphCount: paragraphs.length,
    verify(paragraph: number, rawQuote: string): LightboxQuoteVerdict {
      const quote = rawQuote.trim();
      const foldedQuote = foldWithMap(quote).folded;
      const inner = unwrapQuoted(foldedQuote);
      if (letterCount(inner) < LIGHTBOX_QUOTE_MINIMUM_LETTERS) {
        return { found: false, paragraph, reason: 'too-short' };
      }
      const foldedForms = inner === foldedQuote ? [foldedQuote] : [foldedQuote, inner];
      const declared = Number.isSafeInteger(paragraph) && paragraph >= 1 && paragraph <= paragraphs.length;
      if (declared) {
        const hit = locate(paragraph - 1, quote, foldedForms);
        if (hit) {
          return hit;
        }
      }
      const foundIn: number[] = [];
      paragraphs.forEach((_, index) => {
        if (index !== paragraph - 1 && locate(index, quote, foldedForms)) {
          foundIn.push(index + 1);
        }
      });
      if (!declared) {
        return { found: false, paragraph, reason: 'undeclared-paragraph', ...(foundIn.length > 0 ? { foundIn } : {}) };
      }
      return foundIn.length > 0
        ? { found: false, paragraph, reason: 'not-in-paragraph', foundIn }
        : { found: false, paragraph, reason: 'not-in-chapter' };
    }
  };
}

/**
 * The source span of `length` folded code units at `at`, when the match starts
 * and ends on normalization-unit boundaries; undefined when it would cut a
 * unit (half a ligature, half a syllable, half a surrogate pair).
 */
function sourceSpan(target: FoldedText, at: number, length: number): { start: number; end: number } | undefined {
  const end = at + length;
  // Consecutive code units from one unit share its start; units never share one.
  const cutsStart = at > 0 && target.starts[at - 1] === target.starts[at];
  const cutsEnd = end < target.starts.length && target.starts[end] === target.starts[end - 1];
  return cutsStart || cutsEnd ? undefined : { start: target.starts[at], end: target.ends[end - 1] };
}

/** One base-and-marks segment of the original, with its own NFKC form. */
interface Segment extends NormalizationUnit {
  raw: string;
}

/**
 * The original cut into units whose NFKC forms concatenate to the whole
 * text's NFKC (PR #149 F-09):
 *
 * - **Runs.** The text is first cut before every code point below U+0300.
 *   Those are starters that combine with nothing before them and decompose to
 *   a starter, so NFKC never reaches back across that cut: the runs'
 *   normalized forms concatenate to the whole text's, exactly.
 * - **Units within a run.** Each base-and-marks segment joins the unit before
 *   it whenever normalizing the two together differs from normalizing them
 *   apart (Hangul jamo, halfwidth sound marks).
 * - **The check.** A run whose units still do not concatenate to the run's
 *   own NFKC (a composition reaching across several segments, such as a
 *   letter composing with a mark past two halfwidth sound marks) is kept
 *   whole, as one unit. A quote can then match all of that run but never
 *   part of it: a conservative miss, never a wrong span.
 */
function normalizationUnits(text: string): NormalizationUnit[] {
  const units: NormalizationUnit[] = [];
  let run: Segment[] = [];
  for (const match of text.matchAll(SEGMENT)) {
    const raw = match[0];
    const start = match.index ?? 0;
    if (run.length > 0 && (raw.codePointAt(0) ?? 0) < FIRST_COMBINING_CODE_POINT) {
      units.push(...runUnits(run));
      run = [];
    }
    run.push({ start, end: start + raw.length, raw, normalized: raw.normalize('NFKC') });
  }
  if (run.length > 0) {
    units.push(...runUnits(run));
  }
  return units;
}

/** One run's units: its segments merged pairwise, or the whole run when they disagree with its NFKC. */
function runUnits(run: readonly Segment[]): NormalizationUnit[] {
  if (run.length === 1) {
    return [unitOf(run[0])];
  }
  const units: Segment[] = [];
  let current = run[0];
  for (const segment of run.slice(1)) {
    const joined = (current.raw + segment.raw).normalize('NFKC');
    if (joined !== current.normalized + segment.normalized) {
      current = { start: current.start, end: segment.end, raw: current.raw + segment.raw, normalized: joined };
      continue;
    }
    units.push(current);
    current = segment;
  }
  units.push(current);
  const whole = run.map((segment) => segment.raw).join('').normalize('NFKC');
  if (units.map((unit) => unit.normalized).join('') === whole) {
    return units.map(unitOf);
  }
  return [{ start: run[0].start, end: run[run.length - 1].end, normalized: whole }];
}

function unitOf({ start, end, normalized }: NormalizationUnit): NormalizationUnit {
  return { start, end, normalized };
}

/**
 * The fold both sides are compared under, with a map from each folded UTF-16
 * code unit back to the original.
 */
export function foldWithMap(text: string): FoldedText {
  // One entry per emitted character (one or two code units); `starts` and `ends` hold one per code unit.
  const out: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  const push = (character: string, start: number, end: number): void => {
    out.push(character);
    for (let unit = 0; unit < character.length; unit++) {
      starts.push(start);
      ends.push(end);
    }
  };
  /** Drop the last emitted character, which is always a space (one code unit). */
  const popSpace = (): void => {
    out.pop();
    starts.pop();
    ends.pop();
  };

  const units = normalizationUnits(text);
  const boundaries = new Set<number>([0, text.length, ...units.map((unit) => unit.start)]);
  for (const unit of units) {
    for (const character of unit.normalized) {
      const mark = foldCharacter(character);
      const previous = out[out.length - 1];
      if (mark === ' ') {
        // Collapse runs of space, and drop a space after a dash or at the start.
        if (previous === undefined || previous === ' ' || previous === '-') {
          continue;
        }
        push(' ', unit.start, unit.end);
      } else if (mark === '-') {
        if (previous === ' ') {
          popSpace();
        }
        if (out[out.length - 1] === '-') {
          // A run of dashes is one dash; widen it to cover the whole run.
          ends[ends.length - 1] = unit.end;
          continue;
        }
        push('-', unit.start, unit.end);
      } else {
        push(mark, unit.start, unit.end);
      }
    }
  }
  if (out[out.length - 1] === ' ') {
    popSpace();
  }
  return { folded: out.join(''), starts, ends, boundaries };
}

function foldCharacter(character: string): string {
  if (/\s/u.test(character)) {
    return ' ';
  }
  if (DOUBLE_QUOTES.test(character)) {
    return '"';
  }
  if (SINGLE_QUOTES.test(character)) {
    return "'";
  }
  if (DASHES.test(character)) {
    return '-';
  }
  return character;
}

/** A model sometimes wraps a quote in quotation marks the chapter does not have around it. */
function unwrapQuoted(folded: string): string {
  return folded.length > 2 && folded.startsWith('"') && folded.endsWith('"') && !folded.slice(1, -1).includes('"')
    ? folded.slice(1, -1).trim()
    : folded;
}

function letterCount(text: string): number {
  let count = 0;
  for (const character of text) {
    if (LETTER.test(character)) {
      count += 1;
    }
  }
  return count;
}
