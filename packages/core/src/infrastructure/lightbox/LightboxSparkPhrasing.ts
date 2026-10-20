/**
 * What a spark may say (ADR 2026-10-19 D7; Slice 4). Pure: no host, no I/O.
 *
 * A spark is an offer phrased as a question. It never tells the writer what
 * to write, and, like every reading, it never supplies a count. The prompt
 * asks for that; this module enforces the parts code can check, so a spark
 * that breaks them is withheld by its title (`LightboxStoryCodec`):
 * - it ends as a question: its last mark is "?";
 * - no clause opens with an instruction. Each clause (split at sentence
 *   marks, colons, semicolons and dashes) is checked by its first word, or
 *   first two, against `LIGHTBOX_SPARK_IMPERATIVE_OPENERS`, after any
 *   softening words (`LIGHTBOX_SPARK_SOFTENERS`: "Please", "Now", "So",
 *   "Then", "Maybe"…). A clause that does not open as a question (an
 *   interrogative or an auxiliary, `LIGHTBOX_SPARK_QUESTION_OPENERS`) is
 *   checked again after each of its commas, so a set-up clause cannot carry a
 *   command past the check ("Before she falls, show…", "…late, so add…")
 *   (PR #151 F-03);
 * - it holds none of the directive phrases ("you should", "make sure");
 * - it states no number: no digit appears outside a ¶ address. Counts are
 *   the host's, shown beside the spark.
 *
 * The opener list was tuned on fixtures (`LightboxSparkPhrasing.test.ts`):
 * every instruction there is caught, and every question there passes.
 * Auxiliaries that open questions ("Do", "Does", "Have", "Is", "Could",
 * "Would", "Should") are deliberately absent, since a spark must be a
 * question anyway. Verbs that direct the writer's attention as a command
 * ("Imagine", "Notice", "Consider", "Look") are present: a spark asks, it
 * does not direct. Over-withholding a valid spark is the safe failure; the
 * board says why.
 *
 * **The limit, stated plainly.** This is a word-list heuristic, not a parse,
 * and no finite list proves intent. A command whose verb is not listed
 * passes ("Sprinkle in a storm. What changes?"), as does one buried mid-clause
 * without a comma ("What if you add a storm?"). A clause that opens as a
 * question is not split at its commas, so "Does she, like the Rabbit, keep
 * time?" stays a question, but so would a command after a comma there. And a
 * declarative set-up whose comma segment opens with a listed word used
 * otherwise ("She could stop, look and listen: …") is withheld: the safe
 * failure.
 *
 * Every reason is host-owned: none quotes the spark.
 */

import { LIGHTBOX_BARE_DIGIT } from '@/infrastructure/lightbox/LightboxReadingFields';

/** First words (or two-word starts) that make a clause an instruction. Lower case. */
export const LIGHTBOX_SPARK_IMPERATIVE_OPENERS: readonly string[] = [
  'add', 'avoid', 'begin', 'bring', 'build', 'change', 'check', 'choose', 'clarify', 'consider', 'continue',
  'cut', 'delete', 'describe', 'develop', 'drop', 'emphasize', 'end', 'ensure', 'establish', 'expand',
  'explore', 'flesh', 'focus', 'give', 'heighten', 'highlight', 'imagine', 'include', 'introduce', 'keep',
  'lean', 'let', "let's", 'look', 'make', 'move', 'note', 'notice', 'picture', 'push', 'put', 'raise',
  'reconsider', 'reduce', 'remember', 'remove', 'reorder', 'replace', 'rethink', 'reveal', 'revise',
  'rewrite', 'rework', 'sharpen', 'shift', 'show', 'simplify', 'slow', 'soften', 'speed', 'split', 'start',
  'stop', 'strengthen', 'swap', 'take', 'tell', 'think', 'tighten', 'trim', 'try', 'turn', 'use', 'weave',
  'write', "don't", 'do not', 'why not', 'how about'
];

/** Words that soften or link a command without changing it ("Please add…", "…, so add…", "Now cut…"). Lower case. */
export const LIGHTBOX_SPARK_SOFTENERS: readonly string[] = [
  'please', 'kindly', 'now', 'so', 'then', 'and', 'but', 'or', 'yet', 'just', 'simply', 'also', 'first',
  'next', 'finally', 'instead', 'perhaps', 'maybe', 'again', 'possibly'
];

/**
 * Words that open a clause as a question. "When" and "where" open one only
 * before an auxiliary ("When does she…?"); otherwise they set a clause up
 * ("When the Rabbit says…, who…?"). Lower case.
 */
export const LIGHTBOX_SPARK_QUESTION_OPENERS: readonly string[] = [
  'what', 'who', 'whom', 'whose', 'which', 'why', 'how',
  'is', 'are', 'was', 'were', 'am', 'do', 'does', 'did', 'can', 'could', 'would', 'should', 'will', 'shall',
  'may', 'might', 'must', 'has', 'have', 'had', "isn't", "aren't", "wasn't", "weren't", "doesn't", "didn't",
  "can't", "couldn't", "wouldn't", "shouldn't", "won't", "hasn't", "haven't", "hadn't"
];
const SET_UP_OR_QUESTION = ['when', 'where'];

/** Phrases that instruct wherever they stand. Lower case, matched on word boundaries. */
export const LIGHTBOX_SPARK_DIRECTIVE_PHRASES: readonly string[] = [
  'you should', 'you must', 'you need to', 'you ought to', 'you could try', 'you might try',
  'make sure', 'be sure to', "don't forget", 'do not forget'
];

/** Writer-facing reasons, one per rule. */
export const LIGHTBOX_SPARK_PHRASING_REASONS = {
  notQuestion: 'A spark is offered as a question, and this one does not end as one.',
  instruction: 'A spark offers, never instructs, and this one opens a clause with an instruction.',
  directive: 'A spark offers, never instructs, and this one tells the writer what to do.',
  number: 'A spark never states a number: counts are the board\'s, shown beside it.'
} as const;

/** Clause boundaries: sentence marks, colons, semicolons, and dashes. */
const CLAUSE_BREAK = /[.!?;:]+|\s[-–—]+\s|[–—]+/u;
/** What may wrap a clause's first word: quotes, brackets, emphasis marks, spaces. */
const LEADING_MARKS = /^[\s"'“”‘’([{*_]+/u;
const CLOSING_MARKS = /[\s"'“”‘’)\]}*_]+$/u;

/** Why the spark cannot be shown as written, or undefined when it can. */
export function lightboxSparkPhrasingFault(question: string): string | undefined {
  const text = question.trim();
  if (!text.replace(CLOSING_MARKS, '').endsWith('?')) {
    return LIGHTBOX_SPARK_PHRASING_REASONS.notQuestion;
  }
  if (text.split(CLAUSE_BREAK).some(opensWithInstruction)) {
    return LIGHTBOX_SPARK_PHRASING_REASONS.instruction;
  }
  const folded = fold(text);
  if (LIGHTBOX_SPARK_DIRECTIVE_PHRASES.some((phrase) => holdsPhrase(folded, phrase))) {
    return LIGHTBOX_SPARK_PHRASING_REASONS.directive;
  }
  if (LIGHTBOX_BARE_DIGIT.test(text)) {
    return LIGHTBOX_SPARK_PHRASING_REASONS.number;
  }
  return undefined;
}

/** A clause instructs when it, or (unless it opens as a question) any of its comma segments, opens with an instruction. */
function opensWithInstruction(clause: string): boolean {
  const [head, ...rest] = clause.split(',');
  const words = openingWords(head);
  if (startsWithInstruction(words)) {
    return true;
  }
  if (opensAsQuestion(words)) {
    return false;
  }
  return rest.some((segment) => startsWithInstruction(openingWords(segment)));
}

/** A segment's words, folded and bare of marks, with leading marks and softening words dropped. */
function openingWords(segment: string): string[] {
  const words = fold(segment.replace(LEADING_MARKS, ''))
    .split(/\s+/u)
    .map((word) => word.replace(/[^\p{L}']/gu, ''));
  let start = 0;
  while (start < words.length && (words[start] === '' || LIGHTBOX_SPARK_SOFTENERS.includes(words[start]))) {
    start += 1;
  }
  return words.slice(start);
}

function startsWithInstruction(words: readonly string[]): boolean {
  if (words.length === 0) {
    return false;
  }
  const two = words.length > 1 ? `${words[0]} ${words[1]}` : words[0];
  return LIGHTBOX_SPARK_IMPERATIVE_OPENERS.includes(words[0]) || LIGHTBOX_SPARK_IMPERATIVE_OPENERS.includes(two);
}

function opensAsQuestion(words: readonly string[]): boolean {
  if (words.length === 0) {
    return false;
  }
  if (SET_UP_OR_QUESTION.includes(words[0])) {
    return words.length > 1 && LIGHTBOX_SPARK_QUESTION_OPENERS.includes(words[1]);
  }
  return LIGHTBOX_SPARK_QUESTION_OPENERS.includes(words[0]);
}

/** Lower case, curly apostrophes straight, so "Don’t" is "don't". */
function fold(text: string): string {
  return text.toLocaleLowerCase('en-US').replace(/[’‘]/gu, "'");
}

function holdsPhrase(folded: string, phrase: string): boolean {
  let at = folded.indexOf(phrase);
  while (at >= 0) {
    const before = at === 0 ? '' : folded[at - 1];
    const after = folded[at + phrase.length] ?? '';
    if (!/[\p{L}']/u.test(before) && !/[\p{L}']/u.test(after)) {
      return true;
    }
    at = folded.indexOf(phrase, at + 1);
  }
  return false;
}
