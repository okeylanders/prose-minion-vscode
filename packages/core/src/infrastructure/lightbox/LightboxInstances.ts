/**
 * Where a counted item's instances stand in the text (Slice 4E). Pure: no
 * host, no I/O.
 *
 * The inspector lights a counted item's instances, and the number lit must be
 * the number the board shows. So each finder is the rule that made its
 * figure, run over the same text, never a matcher of its own:
 * - **Top words and repeated phrases.** The word-frequency tool's tokenizer
 *   (`extractFrequencyWords`) over the whole text, lower-cased: en and em
 *   dashes split words, letters, hyphens and apostrophes are kept, edge
 *   apostrophes are trimmed. A phrase is consecutive tokens of that one
 *   stream, so an occurrence across a paragraph break counts, as the tool
 *   counts it.
 * - **Hapax.** The prose-stats tokenizer the stats row counts with
 *   (`proseStatsWords`): whitespace-split, lower-cased, letters and
 *   apostrophes kept, nothing trimmed.
 * - **Style flags.** Style Flags' own detectors, for the four flags whose
 *   count is a count of instances (`LIGHTBOX_STYLE_FLAG_IDS`).
 * - **Parts of speech** are not found here: they are the tagger's occurrence
 *   stream as the board placed it (`placeLightboxPosOccurrences`).
 *
 * Each tokenizer reads one run of characters between its separators as one
 * word, and that word's token is the tool's own function applied to the run.
 * A token's span runs from the first to the last character it keeps, so
 * "window." spans "window" and "“Oh," spans "Oh". Offsets are UTF-16
 * indexes into the text as it was measured. Lower-casing is applied per
 * character, as the tools' whole-text lower-casing does, so "İ" keeps its
 * "i" in both.
 */

import type { LightboxHapaxWord, LightboxStyleFlagId } from '@messages';
import { extractFrequencyWords } from '@/tools/measure/wordFrequency';
import { proseStatsWords } from '@/tools/measure/passageProseStats';
import {
  findAdverbs,
  findFillerWords,
  findPassiveVoice,
  findWeakVerbs,
  type StyleFlagMatch
} from '@/tools/measure/styleFlags';
import type { LightboxParagraph } from '@/infrastructure/lightbox/LightboxParagraphs';

/** A stretch of the text: UTF-16 offsets, end exclusive. */
export interface LightboxSpan {
  start: number;
  end: number;
}

/** One token and the span of the text it was read from. */
export interface LightboxTokenSpan extends LightboxSpan {
  token: string;
}

/**
 * The style flags whose count is a count of instances, by the type Style
 * Flags reports, with the detector that counted it. Repetitive Words counts
 * the words that repeat and Clichés the phrases found, so neither is here.
 */
export const LIGHTBOX_STYLE_FLAG_IDS: Readonly<Record<string, LightboxStyleFlagId>> = {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the tool's own type labels.
  'Adverbs (-ly words)': 'adverbs',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the tool's own type labels.
  'Passive Voice': 'passive-voice',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the tool's own type labels.
  'Weak Verbs': 'weak-verbs',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the tool's own type labels.
  'Filler Words': 'filler-words'
};

const STYLE_FLAG_DETECTORS: Readonly<Record<LightboxStyleFlagId, (text: string) => StyleFlagMatch[]>> = {
  adverbs: findAdverbs,
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the flag ids are kebab-case protocol literals.
  'passive-voice': findPassiveVoice,
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the flag ids are kebab-case protocol literals.
  'weak-verbs': findWeakVerbs,
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the flag ids are kebab-case protocol literals.
  'filler-words': findFillerWords
};

/**
 * The tokens of `runs` in `text`, each with its span: `tokenOf` is the tool's
 * tokenizer applied to one run (it yields at most one token), `keeps` whether
 * a lower-cased character counts toward the token's span.
 */
function tokenSpans(
  text: string,
  runs: RegExp,
  tokenOf: (run: string) => string | undefined,
  keeps: (lowered: string) => boolean
): LightboxTokenSpan[] {
  const spans: LightboxTokenSpan[] = [];
  for (const match of text.matchAll(runs)) {
    const run = match[0];
    const token = tokenOf(run);
    if (!token) {
      continue;
    }
    let first = -1;
    let last = -1;
    for (let index = 0; index < run.length; index++) {
      if (keeps(run[index].toLowerCase())) {
        first = first < 0 ? index : first;
        last = index;
      }
    }
    const at = match.index ?? 0;
    spans.push({ token, start: at + first, end: at + last + 1 });
  }
  return spans;
}

/**
 * The word-frequency tool's tokens, in order, with spans: exactly
 * `extractFrequencyWords(text.toLowerCase())`. A token's span is its first to
 * last letter or hyphen; its trimmed edge apostrophes are not lit.
 */
export function lightboxFrequencyTokenSpans(text: string): LightboxTokenSpan[] {
  return tokenSpans(
    text,
    /[^\s—–]+/g,
    (run) => extractFrequencyWords(run.toLowerCase())[0],
    (lowered) => /[a-z-]/.test(lowered)
  );
}

/**
 * The prose-stats tool's words, in order, with spans: exactly
 * `proseStatsWords(text)`. A word's span is its first to last letter or
 * apostrophe, since the tool trims neither.
 */
export function lightboxProseTokenSpans(text: string): LightboxTokenSpan[] {
  return tokenSpans(
    text,
    /\S+/g,
    (run) => proseStatsWords(run)[0],
    (lowered) => /[a-z']/.test(lowered)
  );
}

/** Where `word` stands among `tokens`: one span per token equal to it. */
export function lightboxTokenInstances(tokens: readonly LightboxTokenSpan[], word: string): LightboxSpan[] {
  return tokens.filter((token) => token.token === word).map(({ start, end }) => ({ start, end }));
}

/**
 * Where the space-joined `phrase` stands among `tokens`: every run of
 * consecutive tokens equal to its words, overlapping runs included, as the
 * tool's n-gram count counts them.
 */
export function lightboxPhraseInstances(tokens: readonly LightboxTokenSpan[], phrase: string): LightboxSpan[] {
  const parts = phrase.split(' ').filter(Boolean);
  const found: LightboxSpan[] = [];
  if (parts.length === 0) {
    return found;
  }
  for (let start = 0; start + parts.length <= tokens.length; start++) {
    if (parts.every((part, offset) => tokens[start + offset].token === part)) {
      found.push({ start: tokens[start].start, end: tokens[start + parts.length - 1].end });
    }
  }
  return found;
}

/**
 * The words used once, in order of first appearance: the prose-stats
 * tokenizer's words whose count is 1, which is exactly how the stats row's
 * `hapaxCount` is counted. Each with how the text writes it and its paragraph.
 */
export function lightboxHapaxWords(text: string, paragraphs: readonly LightboxParagraph[]): LightboxHapaxWord[] {
  const tokens = lightboxProseTokenSpans(text);
  const counts = new Map<string, number>();
  for (const { token } of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return tokens
    .filter(({ token }) => counts.get(token) === 1)
    .map(({ token, start, end }) => ({
      term: token,
      written: text.slice(start, end),
      paragraph: lightboxParagraphAt(paragraphs, start)?.index ?? 0
    }));
}

/** A style flag's instances, by the detector that counted it. */
export function lightboxStyleFlagInstances(text: string, flag: LightboxStyleFlagId): LightboxSpan[] {
  return STYLE_FLAG_DETECTORS[flag](text).map(({ start, end }) => ({ start, end }));
}

/** The paragraph whose trimmed span holds `offset`, by binary search; undefined between paragraphs. */
export function lightboxParagraphAt(paragraphs: readonly LightboxParagraph[], offset: number): LightboxParagraph | undefined {
  let low = 0;
  let high = paragraphs.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const paragraph = paragraphs[middle];
    if (offset < paragraph.start) {
      high = middle - 1;
    } else if (offset >= paragraph.end) {
      low = middle + 1;
    } else {
      return paragraph;
    }
  }
  return undefined;
}

/** Every paragraph a span touches, ascending (a phrase or passive can run across a paragraph break). */
export function lightboxParagraphsTouched(paragraphs: readonly LightboxParagraph[], span: LightboxSpan): number[] {
  const first = lightboxParagraphAt(paragraphs, span.start)?.index;
  const last = lightboxParagraphAt(paragraphs, span.end - 1)?.index;
  if (first === undefined || last === undefined) {
    return first !== undefined ? [first] : last !== undefined ? [last] : [];
  }
  return Array.from({ length: last - first + 1 }, (_unused, offset) => first + offset);
}

/** The paragraphs any of `spans` touches, ascending, each once. */
export function lightboxParagraphsOfSpans(paragraphs: readonly LightboxParagraph[], spans: readonly LightboxSpan[]): number[] {
  const touched = new Set<number>();
  for (const span of spans) {
    for (const index of lightboxParagraphsTouched(paragraphs, span)) {
      touched.add(index);
    }
  }
  return [...touched].sort((a, b) => a - b);
}

/**
 * Map spans of `text.toLowerCase()` back onto `text`. Lower-casing lengthens
 * only "İ" (to "i" and a combining dot); each lowered unit is mapped to the
 * character it came from, so a span ends after that whole character.
 */
export function lightboxLowercaseSpanMap(text: string): (span: LightboxSpan) => LightboxSpan {
  const lowered = text.toLowerCase();
  if (lowered.length === text.length) {
    return (span) => span;
  }
  const origins: number[] = [];
  const ends: number[] = [];
  for (let index = 0; index < text.length;) {
    const codePoint = text.codePointAt(index) ?? 0;
    const width = codePoint > 0xffff ? 2 : 1;
    const length = String.fromCodePoint(codePoint).toLowerCase().length;
    for (let unit = 0; unit < length; unit++) {
      origins.push(index);
      ends.push(index + width);
    }
    index += width;
  }
  return ({ start, end }) => ({
    start: origins[start] ?? text.length,
    end: end > start ? ends[end - 1] ?? text.length : origins[start] ?? text.length
  });
}
