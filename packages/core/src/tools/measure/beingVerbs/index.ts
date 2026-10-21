/**
 * Being Verbs Tool (Lightbox Slice 4B; contractions since the writer's
 * decision of 2026-10-21, epic decision 26)
 *
 * Finds the forms of "be" in any case, whole words and contractions alike.
 * The Lightbox's "What stands out in the numbers" counts them per 1,000
 * words, the writer's own average counts their other chapters with them,
 * craft steering totals and sorts them, and a reading's quote is checked to
 * hold one, all through this one detector, so every figure agrees.
 *
 * Style Flags' "Weak Verbs" mixes the whole-word forms with
 * has/have/do/make/get, so it is not this figure; Style Flags is unchanged.
 *
 * **What counts.** Each match spans the form of "be" as written, so a quote
 * holds an instance exactly when it holds that span:
 * - the whole words `BEING_VERB_FORMS` (am, is, are, was, were, be, been,
 *   being). A word is letters joined by apostrophes, so "am" inside "ma'am"
 *   and "being" inside "being's" are not forms;
 * - `'m` after the word I ("I'm"), the only word "am" contracts with, so
 *   "ma'm" and "M'm" are not forms (the match is `'m`);
 * - `'re` after any word ("you're", "we're", "they're", "who're"; the
 *   match is `'re`): it only ever stands for "are";
 * - the negated forms `BEING_VERB_NEGATED_FORMS` (isn't, aren't, wasn't,
 *   weren't, ain't; the match is the whole word). A whole-word pattern
 *   never matched them: "was" is followed by "n" in "wasn't";
 * - the elided forms 'tis, 'twas and 'twere (`BEING_VERB_ELIDED_FORMS`; the
 *   match is the word after its opening apostrophe, "tis"), one being verb
 *   each. The apostrophe opens the word, so it may stand after a space or a
 *   quotation mark, and a word processor's ‘ counts as well as ' and ’;
 * - `'s` after a word (the match is `'s`), decided by the word-frequency
 *   tool's part-of-speech tagger (wink, `tagTextTokens`), in this order:
 *   1. *has*, never counted: `BEING_VERB_HAS_WORDS` (been, got, gotten,
 *      had) comes next, looking past adverbs (`RB*`: not, never, always)
 *      and emphasis marks ("he's been", "she's got", "it's had");
 *   2. *is* where the tagger reads `'s` as a verb (`VB*`): "it's", "she's",
 *      "that's", "there's";
 *   3. where it reads a possessive (`POS`), the next word decides (the
 *      next-word rule, for names and nouns: "Nate's late", "everyone's
 *      here"). *Is* before an adjective or a participle the tagger tags
 *      `VBN` ("tired", "shut"), an -ing word, an adverb or not, a
 *      preposition or "to", or a determiner (a, an, the, no; my, our). It
 *      stays a possessive before a noun, a name or a pronoun ("the Rabbit's
 *      watch", "Alice's sister", "how's she"), before "own", before
 *      adjectives that a noun follows ("the Rabbit's white gloves"), and
 *      before anything else (a number, a mark, the end).
 *   "let's" (let us) never counts.
 * - "ain't" can mean *has not* too, so the same has rule holds it: before
 *   been, got, gotten or had it is not counted ("I ain't got none").
 * Straight and curly apostrophes (' ’) are the same here. The tagger reads
 * the text with curly apostrophes straightened (the same length, so every
 * offset stands): it splits "it’s" only when the mark is straight.
 *
 * **Never counted:** 'd (had, would), 'll (will) and 've (have), a linking
 * verb (seem, become), and a form joined to an underscore (`_was_`).
 *
 * **Limits, stated.** A word list and a tagger, not a parser:
 * - every counted form counts, whatever it does in its sentence (a linking
 *   verb, an auxiliary, a passive), so the figure is a frequency;
 * - `'s` before a participle other than been, got, gotten or had reads as
 *   *is*: "he's gone" and "Nate's gone" count, though either may mean *has
 *   gone*;
 * - before an -ing word `'s` reads as *is*: "the dog's barking" counts as
 *   *the dog is barking*, though it may be *the barking of the dog*, and so
 *   does "Nate's sewing basket" (a possessive);
 * - before an adverb it reads as *is*, so "the Rabbit's very white gloves"
 *   counts; before a pronoun it stays a possessive, so "how's she?" and
 *   "where's he?" are not counted;
 * - the next-word rule stands only where the tagger reads a possessive;
 *   where it reads a verb, it is trusted ("Nate's every word" counts);
 * - when the tagger cannot load, no `'s` is counted, and "ain't" is read as
 *   *has not* only when the next word is been, got, gotten or had.
 */

import { tagTextTokens, type TaggedToken } from '@/tools/measure/wordFrequency';

/** The whole-word forms counted. */
export const BEING_VERB_FORMS = ['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being'] as const;

/** The negated forms counted, as whole words (curly apostrophes too). */
export const BEING_VERB_NEGATED_FORMS = ['isn\'t', 'aren\'t', 'wasn\'t', 'weren\'t', 'ain\'t'] as const;

/** The elided forms counted, each one being verb ('tis is *it is*). */
export const BEING_VERB_ELIDED_FORMS = ['\'tis', '\'twas', '\'twere'] as const;

/** After `'s` or "ain't", these make it *has*, so it is not counted. */
export const BEING_VERB_HAS_WORDS = ['been', 'got', 'gotten', 'had'] as const;

/** One form found: its offsets in the text and the text matched. */
export interface BeingVerbMatch {
  start: number;
  end: number;
  text: string;
}

/** How a text is tagged: the word-frequency tool's tagger, unless a caller gives another. A throw means it could not load. */
export type BeingVerbTagger = (text: string) => TaggedToken[];

/** An apostrophe, straight or curly. */
const APOSTROPHE = '[\'’]';
/** Not inside a word that an apostrophe joins: no letter and apostrophe before, no apostrophe and letter after. */
const WHOLE_BEFORE = `(?<!\\p{L}${APOSTROPHE})\\b`;
const WHOLE_AFTER = `\\b(?!${APOSTROPHE}\\p{L})`;
/** A contraction's end: no letter or apostrophe follows. */
const CONTRACTION_END = '(?![\\p{L}\'’])';

const WHOLE_FORMS = new RegExp(`${WHOLE_BEFORE}(?:${BEING_VERB_FORMS.join('|')})${WHOLE_AFTER}`, 'giu');
const NEGATED_FORMS = new RegExp(`${WHOLE_BEFORE}(?:is|are|was|were|ai)n${APOSTROPHE}t${WHOLE_AFTER}`, 'giu');
/** 'tis, 'twas, 'twere: an opening mark (a word processor may turn it ‘) after no letter; the span starts after it. */
const ELIDED_FORMS = new RegExp(`(?<!\\p{L})['’‘]t(?:is|was|were)${WHOLE_AFTER}`, 'giu');
/** A word's start: no letter, and no letter and apostrophe, before it (a quotation mark may open it: 'I'm). */
const WORD_START = `(?<!\\p{L}|\\p{L}${APOSTROPHE})`;
/** `'m` after the word I: the I is part of the match here, and dropped from the span below. */
const I_AM = new RegExp(`${WORD_START}i${APOSTROPHE}m${CONTRACTION_END}`, 'giu');
const ARE = new RegExp(`(?<=\\p{L})${APOSTROPHE}re${CONTRACTION_END}`, 'giu');
const IS_OR_HAS = new RegExp(`(?<=\\p{L})${APOSTROPHE}s${CONTRACTION_END}`, 'giu');
/** "let" as a whole word, just before a `'s`. */
const LET = new RegExp(`${WORD_START}let$`, 'iu');
const AIN_T = /^ai/i;

const ADVERB = /^RB[RS]?$/;
const VERB = /^VB[DGNPZ]?$/;
const MARKUP = /^[_*]+$/;
const HAS_WORDS: ReadonlySet<string> = new Set(BEING_VERB_HAS_WORDS);
/** After a possessive `'s`, a modifier: an adjective, or a participle the tagger tags `VBN` ("tired"). */
const MODIFIER = /^(?:JJ[RS]?|VBN)$/;
/** After a possessive `'s`, these make it *is*: an -ing word, an adverb or not, a preposition or "to", a determiner. */
const IS_AFTER = /^(?:VBG|RB[RS]?|IN|TO|DT|PRP\$)$/;
const NOUN = /^NNP?S?$/;

/** Every counted form in `text`, in order, by the word-frequency tool's tagger. */
export function findBeingVerbs(text: string): BeingVerbMatch[] {
  return findBeingVerbsWith(text, tagTextTokens);
}

/** Every counted form in `text`, in order, with `tag` deciding each `'s` (and "ain't" before has). */
export function findBeingVerbsWith(text: string, tag: BeingVerbTagger): BeingVerbMatch[] {
  const matches: BeingVerbMatch[] = [];
  const add = (start: number, end: number) => matches.push({ start, end, text: text.slice(start, end) });
  for (const match of text.matchAll(WHOLE_FORMS)) {
    add(match.index ?? 0, (match.index ?? 0) + match[0].length);
  }
  for (const match of text.matchAll(ELIDED_FORMS)) {
    // The span is the word after its opening mark: "tis".
    add((match.index ?? 0) + 1, (match.index ?? 0) + match[0].length);
  }
  for (const match of text.matchAll(I_AM)) {
    // The span is the `'m`, not the I.
    add((match.index ?? 0) + 1, (match.index ?? 0) + match[0].length);
  }
  for (const match of text.matchAll(ARE)) {
    add(match.index ?? 0, (match.index ?? 0) + match[0].length);
  }
  const negated = [...text.matchAll(NEGATED_FORMS)].map((match) => {
    const start = match.index ?? 0;
    return { start, end: start + match[0].length, ain: AIN_T.test(match[0]) };
  });
  const possible = [...text.matchAll(IS_OR_HAS)]
    .map((match) => match.index ?? 0)
    .filter((at) => !LET.test(text.slice(Math.max(0, at - 5), at)));
  // The tagger runs only on a text that holds a `'s` or an "ain't" to decide.
  const tokens = possible.length > 0 || negated.some(({ ain }) => ain) ? taggedOrUndefined(text, tag) : undefined;
  const reader = tokens ? tokenReader(tokens) : undefined;
  for (const { start, end, ain } of negated) {
    if (!(ain && hasFollows(text, end, reader, reader?.at(start)))) {
      add(start, end);
    }
  }
  for (const at of possible) {
    const token = reader?.at(at);
    // The tagger alone tells *is* from a possessive: with no tagger, or no token of its own, no `'s` is counted.
    if (token !== undefined && reader && reader.value(token) === '\'s' && !reader.hasAfter(token) &&
      (VERB.test(reader.pos(token)) || reader.isAfterPossessive(token))) {
      add(at, at + 2);
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}

/**
 * `text` with each curly apostrophe (’) straight, at the same offsets: what
 * the tagger reads, since it splits "it's" and "isn't" only when the mark is
 * straight. Craft steering's constructions tag the same text.
 */
export function withStraightApostrophes(text: string): string {
  return text.replace(/’/g, '\'');
}

/** The text's tokens, tagged with curly apostrophes straightened (same offsets); undefined when the tagger cannot load. */
function taggedOrUndefined(text: string, tag: BeingVerbTagger): TaggedToken[] | undefined {
  try {
    return tag(withStraightApostrophes(text));
  } catch {
    return undefined;
  }
}

/** Whether been, got, gotten or had follows `end` as the next word: the rule without a tagger. */
function nextWordIsHas(text: string, end: number): boolean {
  const next = /^\s+([\p{L}]+)/u.exec(text.slice(end, end + 32));
  return next !== null && HAS_WORDS.has(next[1].toLowerCase());
}

/** For "ain't": *has not* when been, got, gotten or had follows, past adverbs by the tagger's tokens when it placed one here. */
function hasFollows(text: string, end: number, reader: TokenReader | undefined, token: number | undefined): boolean {
  return reader && token !== undefined ? reader.hasAfter(token) : nextWordIsHas(text, end);
}

interface TokenReader {
  /** The token starting at `offset`, if the tagger placed one there. */
  at(offset: number): number | undefined;
  value(index: number): string;
  pos(index: number): string;
  /** Whether been, got, gotten or had comes next, past adverbs and emphasis marks. */
  hasAfter(index: number): boolean;
  /** For a `'s` the tagger reads as a possessive: whether the next word makes it *is* (the next-word rule). */
  isAfterPossessive(index: number): boolean;
}

/**
 * The tokens, read once: where each placed one starts, and each token's
 * next word past markup, past adverbs and past modifiers, from one backward
 * sweep each, so a long run is walked once, not once per contraction.
 */
function tokenReader(tokens: readonly TaggedToken[]): TokenReader {
  const byStart = new Map<number, number>();
  tokens.forEach((token, index) => {
    if (token.offset !== undefined && !byStart.has(token.offset)) {
      byStart.set(token.offset, index);
    }
  });
  const markup = tokens.map((token) => MARKUP.test(token.value));
  // The nearest token after each one that is neither markup nor skipped.
  const sweep = (skip: (index: number) => boolean): Int32Array => {
    const next = new Int32Array(tokens.length);
    let nearest = tokens.length;
    for (let index = tokens.length - 1; index >= 0; index -= 1) {
      next[index] = nearest;
      if (!markup[index] && !skip(index)) {
        nearest = index;
      }
    }
    return next;
  };
  const nextWord = sweep(() => false);
  const nextPastAdverbs = sweep((index) => ADVERB.test(tokens[index].pos));
  const nextPastModifiers = sweep((index) => MODIFIER.test(tokens[index].pos));
  const lower = (index: number) => (tokens[index]?.value ?? '').toLowerCase();
  const pos = (index: number) => tokens[index]?.pos ?? '';
  return {
    at: (offset) => byStart.get(offset),
    value: (index) => tokens[index].value.toLowerCase(),
    pos: (index) => tokens[index].pos,
    hasAfter: (index) => HAS_WORDS.has(lower(nextPastAdverbs[index])),
    isAfterPossessive: (index) => {
      const next = nextWord[index];
      if (lower(next) === 'own') {
        return false;
      }
      if (MODIFIER.test(pos(next))) {
        // "Nate's late." is *is*; "the Rabbit's white gloves" is a possessive.
        return !NOUN.test(pos(nextPastModifiers[next]));
      }
      return IS_AFTER.test(pos(next));
    }
  };
}
