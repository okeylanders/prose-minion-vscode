/**
 * Public-domain fixture prose for the Lightbox tests: the opening of Lewis
 * Carroll's "Alice's Adventures in Wonderland" (1865), Chapter I, from the
 * Project Gutenberg text, with Gutenberg's line wrapping joined back into
 * paragraphs. Gutenberg sets the dialogue in single quotes, which the shared
 * dialogue matcher deliberately ignores; these passages set it in double
 * quotes (curly, straight or mixed) so there is speech to find.
 *
 * No writer's text is committed (ADR 2026-10-19 D13).
 */

export const ALICE_HEADING = 'Chapter I: Down the Rabbit-Hole';

/** Five paragraphs after the heading; the first and the last carry dialogue. */
export const ALICE_PARAGRAPHS = [
  'Alice was beginning to get very tired of sitting by her sister on the bank, and of having ' +
    'nothing to do: once or twice she had peeped into the book her sister was reading, but it had ' +
    'no pictures or conversations in it, “and what is the use of a book,” thought Alice “without ' +
    'pictures or conversation?”',
  'So she was considering in her own mind (as well as she could, for the hot day made her feel ' +
    'very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the ' +
    'trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ' +
    'ran close by her.',
  'In another moment down went Alice after it, never once considering how in the world she was ' +
    'to get out again.',
  'The rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so ' +
    'suddenly that Alice had not a moment to think about stopping herself before she found herself ' +
    'falling down a very deep well.',
  '“Well!” thought Alice to herself, “after such a fall as this, I shall think nothing of tumbling ' +
    'down stairs! How brave they’ll all think me at home! Why, I wouldn’t say anything about it, ' +
    'even if I fell off the top of the house!” (Which was very likely true.)'
] as const;

/** Heading plus paragraphs, separated by blank lines, dialogue in curly quotes. */
export const ALICE_OPENING_CURLY = [ALICE_HEADING, ...ALICE_PARAGRAPHS].join('\n\n');

/** The same passage with straight double quotes. */
export const ALICE_OPENING_STRAIGHT = ALICE_OPENING_CURLY.replace(/[“”]/g, '"');

/** The same passage with every other closing mark straight: “Well!" … */
export const ALICE_OPENING_MIXED = (() => {
  let closer = 0;
  return ALICE_OPENING_CURLY.replace(/”/g, () => (closer++ % 2 === 0 ? '"' : '”'));
})();

/** The passage as Gutenberg wraps it: hard line breaks inside each paragraph. */
export const ALICE_OPENING_WRAPPED = ALICE_OPENING_CURLY
  .split('\n\n')
  .map((paragraph) => paragraph.replace(/(.{1,68})(?:\s+|$)/g, '$1\n').trimEnd())
  .join('\n\n');

/** A source of exactly `words` whitespace-separated words, built from the passage. */
export function aliceWords(words: number): string {
  const vocabulary = ALICE_PARAGRAPHS.join(' ').split(/\s+/);
  const out: string[] = [];
  for (let index = 0; index < words; index++) {
    out.push(vocabulary[index % vocabulary.length]);
    // A blank line every 120 words keeps the text paragraph-shaped.
    if ((index + 1) % 120 === 0 && index + 1 < words) {
      out.push('\n\n');
    }
  }
  return out.join(' ').replace(/ \n\n /g, '\n\n');
}
