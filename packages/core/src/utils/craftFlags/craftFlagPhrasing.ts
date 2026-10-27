/**
 * What a Craft Flags note may say (ADR 2026-10-21, Amendment 2026-10-26:
 * Slice 3c). Pure: no host, no I/O.
 *
 * A flag's note is a recommendation, phrased as an option, never an order
 * (the writer's decision). Its `why` and its `suggestion` are each held to
 * the same rules:
 * - no listed order or correction word (`CRAFT_FLAG_FORBIDDEN_FORMS`, and the
 *   two-word orders in `CRAFT_FLAG_FORBIDDEN_PHRASES`): a note offers a way
 *   the scene could go, and never says fix, cut, should or wrong;
 * - no clause or comma segment opening with a listed imperative
 *   (`CRAFT_FLAG_IMPERATIVE_OPENERS`), after softening words ("perhaps",
 *   "instead") are set aside, so "perhaps try …" is an order too;
 * - no double quotation mark: the flag already sits on the chapter's words;
 * - no digit: a count is the host's, said beside the note.
 *
 * **The limits, stated plainly.** These are English word lists, not a
 * parse. A listed word used to describe, not to direct, is withheld too
 * ("the cut of her coat", "a bad dream"): the safe failure. An order phrased
 * without a listed word passes ("a plainer phrase would carry it"). Single
 * quotation marks are not checked, since apostrophes are part of words.
 *
 * Unlike the Lightbox's steering fence, a suggestion may offer words: one
 * way this scene could say it is what the writer asked a flag to carry.
 */

/** Order and correction words, in every form withheld. Lower case; curly apostrophes fold to straight. */
export const CRAFT_FLAG_FORBIDDEN_FORMS: readonly string[] = [
  'should', "shouldn't", 'must', "mustn't",
  'fix', 'fixes', 'fixed', 'fixing',
  'cut', 'cuts', 'cutting',
  'delete', 'deletes', 'deleted', 'deleting',
  'remove', 'removes', 'removed', 'removing',
  'replace', 'replaces', 'replaced', 'replacing',
  'rewrite', 'rewrites', 'rewrote', 'rewritten', 'rewriting',
  'wrong', 'wrongly', 'bad', 'badly'
];

/** Orders of two words. */
export const CRAFT_FLAG_FORBIDDEN_PHRASES: readonly string[] = ['need to', 'needs to', 'have to', 'has to', 'ought to'];

/** Verbs that open a clause as an order. */
export const CRAFT_FLAG_IMPERATIVE_OPENERS: readonly string[] = [
  'add', 'avoid', 'change', 'choose', 'consider', 'drop', 'find', 'give', 'go', 'keep', 'let', 'lose',
  'make', 'name', 'pick', 'show', 'swap', 'tighten', 'trim', 'try', 'use', 'write'
];

/** Words set aside before a clause's opening verb is read. */
const SOFTENERS: ReadonlySet<string> = new Set(['perhaps', 'maybe', 'just', 'simply', 'instead', 'rather', 'possibly', 'so', 'and', 'or', 'but', 'then']);

export type CraftFlagPhrasingFault = 'forbidden' | 'instruction' | 'quoted' | 'figure';

const FORMS: ReadonlySet<string> = new Set(CRAFT_FLAG_FORBIDDEN_FORMS);
const OPENERS: ReadonlySet<string> = new Set(CRAFT_FLAG_IMPERATIVE_OPENERS);
const DOUBLE_QUOTES = /["“”„«»]/u;
const DIGIT = /\p{Nd}/u;
/** Words, apostrophes inside them kept. */
const WORD = /\p{L}+(?:'\p{L}+)*/gu;
const CLAUSE_BREAK = /[.;:!?—–\n]+/u;

/** Why a note cannot be shown as written, or undefined when it can. */
export function craftFlagPhrasingFault(text: string): CraftFlagPhrasingFault | undefined {
  const folded = text.toLocaleLowerCase('en-US').replace(/[’‘]/gu, "'");
  const words = folded.match(WORD) ?? [];
  if (words.some((word) => FORMS.has(word))) {
    return 'forbidden';
  }
  const spaced = ` ${words.join(' ')} `;
  if (CRAFT_FLAG_FORBIDDEN_PHRASES.some((phrase) => spaced.includes(` ${phrase} `))) {
    return 'forbidden';
  }
  if (folded.split(CLAUSE_BREAK).some((clause) => clause.split(',').some(opensWithOrder))) {
    return 'instruction';
  }
  if (DOUBLE_QUOTES.test(text)) {
    return 'quoted';
  }
  if (DIGIT.test(text)) {
    return 'figure';
  }
  return undefined;
}

function opensWithOrder(segment: string): boolean {
  const words = segment.match(WORD) ?? [];
  const first = words.find((word) => !SOFTENERS.has(word));
  return first !== undefined && OPENERS.has(first);
}
