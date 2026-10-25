/**
 * What craft steering may say (ADR 2026-10-19 D7 second addendum; Slice 4F,
 * epic decision 23). Pure: no host, no I/O.
 *
 * A steering note may say an instance leans on its figure or compensates for
 * something thin, and may name the craft move as worth a look. That is close
 * to advice, so the text is fenced, and the codec withholds what breaks a
 * rule (`LightboxSteeringCodec`). Every figure's claim, every note's why and
 * nudge, and an example's `after`:
 * - holds no word of `LIGHTBOX_STEERING_FORBIDDEN_WORDS`, in any of the
 *   forms `LIGHTBOX_STEERING_FORBIDDEN_FORMS` lists ("cut", "cutting",
 *   "shouldn't"): a nudge names a move, never a correction, and nothing on
 *   the board says fix or cut (decision 13);
 * - holds no double quotation mark of any kind (the verifier's set,
 *   `LIGHTBOX_DOUBLE_QUOTATION_MARKS`): the chapter is quoted only in a
 *   note's checked quote, and the reading never offers words as the
 *   writer's;
 * - states no figure: no digit outside a ¶ address, no `%`, no "percent".
 *   Counts are the host's, shown beside the reading;
 * - and a why or a nudge opens no clause with an instruction, by Spark's
 *   opener check (`lightboxOpensWithInstruction`), so a nudge reads as a
 *   move worth a look, never an order. An example's `after` is a phrase, not
 *   a clause, so it is not held to this one.
 *
 * **The limits, stated plainly.** These are English word lists, not a
 * parse. A nudge that supplies the writer's words without quotation marks
 * passes; so does a prescription without a listed word ("a sharper verb
 * would carry it"). A listed word used to describe, not to direct, is
 * withheld: "the cut of her coat", "a bad dream", "the knot was fixed". That
 * is the safe failure, and the board says why. Single quotation marks and
 * apostrophes are not checked, since apostrophes are part of words.
 *
 * Every reason is host-owned: none quotes the reading.
 */

import { LIGHTBOX_DOUBLE_QUOTATION_MARKS } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { lightboxHasBareDigit } from '@/infrastructure/lightbox/LightboxReadingFields';
import { lightboxOpensWithInstruction } from '@/infrastructure/lightbox/LightboxSparkPhrasing';

/** The words craft steering never uses (epic decision 23), each with its forms below. */
export const LIGHTBOX_STEERING_FORBIDDEN_WORDS = ['cut', 'delete', 'remove', 'fix', 'wrong', 'bad', 'should', 'must'] as const;

/** Every form of each forbidden word that is withheld. Lower case; curly apostrophes fold to straight. */
export const LIGHTBOX_STEERING_FORBIDDEN_FORMS: Readonly<Record<(typeof LIGHTBOX_STEERING_FORBIDDEN_WORDS)[number], readonly string[]>> = {
  cut: ['cut', 'cuts', 'cutting'],
  delete: ['delete', 'deletes', 'deleted', 'deleting'],
  remove: ['remove', 'removes', 'removed', 'removing'],
  fix: ['fix', 'fixes', 'fixed', 'fixing'],
  wrong: ['wrong', 'wrongly'],
  bad: ['bad', 'badly'],
  should: ['should', "shouldn't"],
  must: ['must', "mustn't"]
};

/** Writer-facing reasons, one per rule. */
export const LIGHTBOX_STEERING_PHRASING_REASONS = {
  forbidden: 'It uses a word craft steering never uses (cut, fix and the like): a nudge names a craft move, never a correction.',
  quoted: 'It holds quotation marks: craft steering quotes the chapter only in a note\'s checked quote, and never offers words as yours.',
  figure: 'It states a figure: the counts are the board\'s, shown beside the reading.',
  instruction: 'It gives an order: craft steering names a move worth a look, and the call is yours.'
} as const;

const FORMS: ReadonlySet<string> = new Set(Object.values(LIGHTBOX_STEERING_FORBIDDEN_FORMS).flat());
const DOUBLE_QUOTES = new RegExp(`[${LIGHTBOX_DOUBLE_QUOTATION_MARKS}]`, 'u');
const LIKELIHOOD = /%|\bper\s?cent\b/i;
/** Words, apostrophes inside them kept. */
const WORD = /[\p{L}]+(?:'[\p{L}]+)*/gu;

export interface LightboxSteeringTextRules {
  /** Hold the text to Spark's instruction-opener check (a why and a nudge; not a claim or an example). */
  instruction: boolean;
}

/** Why the text cannot be shown, or undefined when it can. */
export function lightboxSteeringTextFault(text: string, rules: LightboxSteeringTextRules): string | undefined {
  const folded = text.toLocaleLowerCase('en-US').replace(/[’‘]/gu, "'");
  if ((folded.match(WORD) ?? []).some((word) => FORMS.has(word))) {
    return LIGHTBOX_STEERING_PHRASING_REASONS.forbidden;
  }
  if (DOUBLE_QUOTES.test(text)) {
    return LIGHTBOX_STEERING_PHRASING_REASONS.quoted;
  }
  if (lightboxHasBareDigit(text) || LIKELIHOOD.test(text)) {
    return LIGHTBOX_STEERING_PHRASING_REASONS.figure;
  }
  if (rules.instruction && lightboxOpensWithInstruction(text)) {
    return LIGHTBOX_STEERING_PHRASING_REASONS.instruction;
  }
  return undefined;
}
