/**
 * Dialogue-heavy public-domain fixture prose for the sentence rule: the
 * opening of Chapter VII, "A Mad Tea-Party", of Lewis Carroll's "Alice's
 * Adventures in Wonderland" (1865), from the Project Gutenberg text (EBook
 * #11, SHA-256 `f00b287e…0752`, the text the Lightbox evidence cuts its
 * chapters from), lines 1573–1631, with Gutenberg's line wrapping joined
 * back into paragraphs. Nothing else is changed: Gutenberg's `--` dashes and
 * capitals stand.
 *
 * Gutenberg sets the dialogue in single quotes, with double quotes nested
 * inside, so nearly every speech ends `.'`, `!'` or `?'` and the apostrophes
 * of `it's` and `don't` share the mark. `TEA_PARTY_CURLY` sets the same
 * words as a modern edition would: dialogue in curly double quotes, nested
 * quotations in curly single quotes, apostrophes as `’`.
 *
 * No writer's text is committed (ADR 2026-10-19 D13).
 */

/** Nineteen paragraphs, 435 words, as Gutenberg sets them. */
export const TEA_PARTY_PARAGRAPHS = [
  'There was a table set out under a tree in front of the house, and the March Hare and the Hatter were ' +
    'having tea at it: a Dormouse was sitting between them, fast asleep, and the other two were using it as ' +
    'a cushion, resting their elbows on it, and talking over its head. \'Very uncomfortable for the ' +
    'Dormouse,\' thought Alice; \'only, as it\'s asleep, I suppose it doesn\'t mind.\'',
  'The table was a large one, but the three were all crowded together at one corner of it: \'No room! No ' +
    'room!\' they cried out when they saw Alice coming. \'There\'s PLENTY of room!\' said Alice indignantly, ' +
    'and she sat down in a large arm-chair at one end of the table.',
  '\'Have some wine,\' the March Hare said in an encouraging tone.',
  'Alice looked all round the table, but there was nothing on it but tea. \'I don\'t see any wine,\' she remarked.',
  '\'There isn\'t any,\' said the March Hare.',
  '\'Then it wasn\'t very civil of you to offer it,\' said Alice angrily.',
  '\'It wasn\'t very civil of you to sit down without being invited,\' said the March Hare.',
  '\'I didn\'t know it was YOUR table,\' said Alice; \'it\'s laid for a great many more than three.\'',
  '\'Your hair wants cutting,\' said the Hatter. He had been looking at Alice for some time with great ' +
    'curiosity, and this was his first speech.',
  '\'You should learn not to make personal remarks,\' Alice said with some severity; \'it\'s very rude.\'',
  'The Hatter opened his eyes very wide on hearing this; but all he SAID was, \'Why is a raven like a writing-desk?\'',
  '\'Come, we shall have some fun now!\' thought Alice. \'I\'m glad they\'ve begun asking riddles.--I believe ' +
    'I can guess that,\' she added aloud.',
  '\'Do you mean that you think you can find out the answer to it?\' said the March Hare.',
  '\'Exactly so,\' said Alice.',
  '\'Then you should say what you mean,\' the March Hare went on.',
  '\'I do,\' Alice hastily replied; \'at least--at least I mean what I say--that\'s the same thing, you know.\'',
  '\'Not the same thing a bit!\' said the Hatter. \'You might just as well say that "I see what I eat" is ' +
    'the same thing as "I eat what I see"!\'',
  '\'You might just as well say,\' added the March Hare, \'that "I like what I get" is the same thing as ' +
    '"I get what I like"!\'',
  '\'You might just as well say,\' added the Dormouse, who seemed to be talking in his sleep, \'that "I ' +
    'breathe when I sleep" is the same thing as "I sleep when I breathe"!\''
] as const;

/** The excerpt as Gutenberg sets it: single-quoted dialogue, paragraphs separated by blank lines. */
export const TEA_PARTY_SINGLE = TEA_PARTY_PARAGRAPHS.join('\n\n');

/**
 * One paragraph in curly quotes: an apostrophe between two letters becomes
 * `’`; the other single quotes alternate `“` and `”`, and the double quotes
 * nested inside them alternate `‘` and `’`. The excerpt has no apostrophe
 * at a word's edge, so this is exact for it (a test pins the round trip).
 */
function setInCurlyDoubleQuotes(paragraph: string): string {
  let single = 0;
  let double = 0;
  return paragraph.replace(/['"]/g, (mark, offset: number) => {
    if (mark === '\'' && /\p{L}/u.test(paragraph[offset - 1] ?? '') && /\p{L}/u.test(paragraph[offset + 1] ?? '')) {
      return '’';
    }
    if (mark === '\'') {
      return single++ % 2 === 0 ? '“' : '”';
    }
    return double++ % 2 === 0 ? '‘' : '’';
  });
}

/** The same excerpt with its dialogue in curly double quotes, as the Lightbox's Alice fixtures set theirs. */
export const TEA_PARTY_CURLY = TEA_PARTY_PARAGRAPHS.map(setInCurlyDoubleQuotes).join('\n\n');
