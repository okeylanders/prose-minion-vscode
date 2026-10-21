/**
 * What the Opinion's words may say (ADR 2026-10-19 D7 addendum; epic
 * decisions 15 and 16; Slice 4D). Pure: no host, no I/O.
 *
 * The Opinion may evaluate: that is the fenced exception. It may not do the
 * rest of what grading tends to do, and code checks what it can of that, in
 * every observation and every view's headline, body and Why points:
 * - **It cites, it never quotes.** No double quotation mark of any kind:
 *   chapter words reach the writer only as the quotes the cited tiles hold,
 *   shown under the observations.
 * - **About the work, never the writer.** No second person ("you", "your",
 *   "yourself") and no naming of the writer or the author.
 * - **Diagnosis, never a rewrite** (decision 15 says it of Blunt; every
 *   view is held to it, since a rewrite in Neutral is still a rewrite). No
 *   word of `LIGHTBOX_OPINION_REWRITE_WORDS`, and no clause that opens with
 *   an instruction, by the opener rule a spark is held to
 *   (`lightboxOpensWithInstruction`).
 * - **No percentages, no invented figures.** No `%` or "percent", and every
 *   number it writes is one the board items it cites show: an
 *   observation's, the items it cites; a view's, the items its observations
 *   cite. The digest writes every share "per 100 words", so no figure needs
 *   a percent sign.
 *
 * **The limits, stated plainly.** These are word lists and a token match,
 * not a parse, and no finite list proves intent:
 * - a rewrite in words the list does not hold passes ("A shorter fall would
 *   read lighter."), as does advice buried mid-clause without a comma;
 * - a listed word used to describe is withheld ("the cut between scenes",
 *   "the reader must wait"): the safe failure, and the board says why;
 * - a figure is matched as a number, not a meaning: a 3 the cited items
 *   show as a count passes even where the text calls it something else,
 *   and figures in words ("twice", "three threads") are not checked;
 * - single quotation marks are not checked, since they are apostrophes too.
 * Every reason is host-owned: none repeats the Opinion's words.
 */

import { lightboxOpinionFigures } from '@shared/constants/lightboxOpinionItems';
import { lightboxOpensWithInstruction } from '@/infrastructure/lightbox/LightboxSparkPhrasing';

/** Words and phrases that direct a change or a rewrite, wherever they stand. Lower case, matched as whole words. */
export const LIGHTBOX_OPINION_REWRITE_WORDS: readonly string[] = [
  'rewrite', 'rework', 'revise', 'replace', 'change it to', 'change this to', 'cut', 'trim', 'tighten', 'shorten',
  'delete', 'remove', 'fix', 'try', 'consider', 'should', "shouldn't", 'ought', 'must', 'needs to', 'need to',
  'would be better', 'would read better', 'make sure'
];

/** Words that address or name the writer. Lower case, matched as whole words. */
export const LIGHTBOX_OPINION_WRITER_WORDS: readonly string[] = [
  'you', 'your', 'yours', 'yourself', "you're", "you've", "you'd", "you'll", 'the writer', "the writer's", 'the author', "the author's"
];

/** Writer-facing reasons, one per rule; `part` names the Opinion's part ("This observation", "This view"). */
export const LIGHTBOX_OPINION_PHRASING_REASONS = {
  quotes: (part: string) => `${part} puts words in quotation marks. The Opinion cites; it never quotes: the quotes it cites are shown under its observations.`,
  writer: (part: string) => `${part} addresses or names the writer. The Opinion is about the work, never the writer.`,
  rewrite: (part: string) => `${part} directs a change. The Opinion diagnoses; it never gives a rewrite or says what to do.`,
  percent: (part: string) => `${part} states a percentage. The Opinion states only figures the board shows, and never as a percentage.`,
  figure: (part: string) => `${part} states a figure the board items it cites do not show.`
} as const;

const QUOTATION_MARKS = /["“”„‟«»]/u;
const PERCENT = /%|\bper\s?cent\b/iu;
/** Observation ids are keys, not figures: "O3" holds no number. */
const OBSERVATION_IDS = /\bO[1-6]\b/gu;

/**
 * Why `texts` cannot be shown as the Opinion's (`part` names it), or
 * undefined when they can. `figures` are the numbers the cited items show.
 */
export function lightboxOpinionPhrasingFault(
  texts: readonly string[],
  figures: ReadonlySet<string>,
  part: string
): string | undefined {
  const reasons = LIGHTBOX_OPINION_PHRASING_REASONS;
  if (texts.some((value) => QUOTATION_MARKS.test(value))) {
    return reasons.quotes(part);
  }
  const folded = texts.map(fold);
  if (folded.some((value) => LIGHTBOX_OPINION_WRITER_WORDS.some((word) => holdsWord(value, word)))) {
    return reasons.writer(part);
  }
  if (folded.some((value) => LIGHTBOX_OPINION_REWRITE_WORDS.some((word) => holdsWord(value, word))) ||
    texts.some(lightboxOpensWithInstruction)) {
    return reasons.rewrite(part);
  }
  if (texts.some((value) => PERCENT.test(value))) {
    return reasons.percent(part);
  }
  const stated = texts.flatMap((value) => lightboxOpinionFigures(value.replace(OBSERVATION_IDS, '')));
  if (stated.some((figure) => !figures.has(figure))) {
    return reasons.figure(part);
  }
  return undefined;
}

/** Lower case, curly apostrophes straight. */
function fold(value: string): string {
  return value.toLocaleLowerCase('en-US').replace(/[’‘]/gu, "'");
}

/** Whether `word` stands in `folded` as a whole word or phrase. */
function holdsWord(folded: string, word: string): boolean {
  let at = folded.indexOf(word);
  while (at >= 0) {
    const before = at === 0 ? '' : folded[at - 1];
    const after = folded[at + word.length] ?? '';
    if (!/[\p{L}\p{N}-]/u.test(before) && !/[\p{L}\p{N}-]/u.test(after) && !(after === "'" && /^'[a-z]/u.test(folded.slice(at + word.length)))) {
      return true;
    }
    at = folded.indexOf(word, at + 1);
  }
  return false;
}
