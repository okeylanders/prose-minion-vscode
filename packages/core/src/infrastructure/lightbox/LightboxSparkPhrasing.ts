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
 *   first two, against `LIGHTBOX_SPARK_IMPERATIVE_OPENERS`;
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
 * Every reason is host-owned: none quotes the spark.
 */

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
/** A digit outside a ¶ address. */
const BARE_DIGIT = /(?<!¶\s?\d*)\d/u;

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
  if (BARE_DIGIT.test(text)) {
    return LIGHTBOX_SPARK_PHRASING_REASONS.number;
  }
  return undefined;
}

function opensWithInstruction(clause: string): boolean {
  const words = fold(clause.replace(LEADING_MARKS, '')).split(/\s+/u).filter(Boolean);
  if (words.length === 0) {
    return false;
  }
  const first = words[0].replace(/[^\p{L}']/gu, '');
  const two = words.length > 1 ? `${first} ${words[1].replace(/[^\p{L}']/gu, '')}` : first;
  return LIGHTBOX_SPARK_IMPERATIVE_OPENERS.includes(first) || LIGHTBOX_SPARK_IMPERATIVE_OPENERS.includes(two);
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
