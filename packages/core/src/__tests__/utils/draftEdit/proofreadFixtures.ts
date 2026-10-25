/**
 * Proofread fixtures: passages from Lewis Carroll's "Alice's Adventures in
 * Wonderland" (1865, public domain), with seeded mechanical errors. Never
 * manuscript text.
 */

/** The opening paragraph, with a homophone, a misspelling, and a tense slip seeded in. */
export const ALICE_OPENING_SEEDED =
  'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: '
  + 'once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations '
  + 'in it, “and what is the use of a book,” thought Alice “without pictures or conversations?” '
  + 'So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy '
  + 'and stupid), weather the pleasure of making a daisy-chain would be worth the trouble of getting up and '
  + 'picking the daisies, when suddenly a White Rabbit with pink eyes runs close by her.';

/** The second paragraph, with a doubled word and a dropped comma seeded in. */
export const ALICE_RABBIT_SEEDED =
  'There was nothing so very remarkable in that; nor did Alice think it so very much out of the the way to hear '
  + 'the Rabbit say to itself “Oh dear! Oh dear! I shall be late!” (when she thought it over afterwards, it '
  + 'occurred to her that she ought to have wondered at this but at the time it all seemed quite natural).';

/** A Markdown chapter: front matter, a heading, prose, a fenced block, a link, and a comment. */
export const ALICE_MARKDOWN_CHAPTER = [
  '---',
  'title: Down the Rabbit-Hole',
  '---',
  '',
  '# Chapter I',
  '',
  ALICE_OPENING_SEEDED,
  '',
  '```text',
  'teh rabbit-hole went straight on like a tunnel',
  '```',
  '',
  'See [the original text](https://www.gutenberg.org/ebooks/11) for teh rest.',
  '',
  '<!-- note: teh draft continues -->',
  '',
  ALICE_RABBIT_SEEDED
].join('\n');
