/**
 * The prose-stats sentence rule joins a lower-case speech tag to its speech
 * (ADR 2026-10-21, sentence closing marks: speech tags). A sentence goes on
 * across an ender, a closing quotation mark directly after it, space with
 * no paragraph break, and a lower-case letter, as standard punctuation
 * reads it.
 *
 * Every expectation is literal. Comments give what the closing-marks rule
 * alone gave ("marks:"), and, where it differs, the original rule ("base:"),
 * which ended a sentence at its `.`, `!` or `?` and nothing after it.
 * Fixture prose is public domain (Lewis Carroll, "Alice's Adventures in
 * Wonderland", 1865) or written for these tests.
 */

import { PassageProseStats, proseSentenceSpans } from '@/tools/measure/passageProseStats';
import { countWords } from '@/utils/textUtils';
import {
  ALICE_OPENING_CURLY,
  ALICE_OPENING_MIXED,
  ALICE_OPENING_STRAIGHT,
  ALICE_OPENING_WRAPPED
} from '@/__tests__/infrastructure/lightbox/lightboxProseFixtures';
import { TEA_PARTY_CURLY, TEA_PARTY_PARAGRAPHS, TEA_PARTY_SINGLE } from '@/__tests__/tools/measure/passageProseStats/teaPartyFixtures';

/** Each sentence's text, exactly as its span cuts it (leading space included). */
const sentencesOf = (text: string): string[] => proseSentenceSpans(text).map(({ start, end }) => text.slice(start, end));

const stats = (text: string) => {
  const { wordCount, sentenceCount, averageWordsPerSentence, readabilityScore } = new PassageProseStats().analyze({ text });
  return { wordCount, sentenceCount, averageWordsPerSentence, readabilityScore };
};

describe('a lower-case speech tag continues the sentence of its speech', () => {
  it('reads “Wait!” she cried. as one sentence', () => {
    expect(sentencesOf('“Wait!” she cried.')).toEqual(['“Wait!” she cried.']);
    // marks: ['“Wait!”', ' she cried.']; base: ['“Wait!', '” she cried.']
    expect(stats('“Wait!” she cried.').sentenceCount).toBe(1); // marks and base: 2
  });

  it('reads “Who are you?” said the Caterpillar. as one sentence', () => {
    expect(sentencesOf('“Who are you?” said the Caterpillar.')).toEqual(['“Who are you?” said the Caterpillar.']);
    // marks: ['“Who are you?”', ' said the Caterpillar.']
  });

  it('reads “I was thinking...” she trailed off. as one sentence', () => {
    expect(sentencesOf('“I was thinking...” she trailed off.')).toEqual(['“I was thinking...” she trailed off.']);
    // marks: ['“I was thinking...”', ' she trailed off.']
  });

  it('counts “Oh dear!” she said. as 4 words in 1 sentence', () => {
    expect(sentencesOf('“Oh dear!” she said.').map(countWords)).toEqual([4]); // marks: [2, 2]; base: [2, 3]
    // marks and base: 2 sentences, 2 words per sentence, readability 96.
    expect(stats('“Oh dear!” she said.')).toEqual({ wordCount: 4, sentenceCount: 1, averageWordsPerSentence: 4, readabilityScore: 92 });
  });

  it('joins a lower-case tag after “.”” too', () => {
    expect(sentencesOf('“I’m going.” she said, and went.')).toEqual(['“I’m going.” she said, and went.']);
    // marks: ['“I’m going.”', ' she said, and went.']
  });

  it('joins across a line break inside a paragraph', () => {
    expect(sentencesOf('“Wait!”\nshe cried.')).toEqual(['“Wait!”\nshe cried.']); // marks: ['“Wait!”', '\nshe cried.']
  });
});

describe('each quotation convention', () => {
  it('joins after curly single quotes', () => {
    expect(sentencesOf('‘Stop!’ he said. ‘Now.’')).toEqual(['‘Stop!’ he said.', ' ‘Now.’']);
    // marks: ['‘Stop!’', ' he said.', ' ‘Now.’']
  });

  it('joins after straight single quotes, as Gutenberg sets them', () => {
    expect(sentencesOf('\'Stop!\' he said. \'Now.\'')).toEqual(['\'Stop!\' he said.', ' \'Now.\'']);
    // marks: ["'Stop!'", ' he said.', " 'Now.'"]
    // "'No room! No room!' they cried out …" and "'There's PLENTY of room!' said Alice …" each join.
    expect(sentencesOf(TEA_PARTY_PARAGRAPHS[1]).map(countWords)).toEqual([20, 10, 21]); // marks: [20, 2, 8, 4, 17]
  });

  it('joins after straight double quotes', () => {
    expect(sentencesOf('"Oh dear!" she said. "Wait."')).toEqual(['"Oh dear!" she said.', ' "Wait."']);
    // marks: ['"Oh dear!"', ' she said.', ' "Wait."']
  });

  it('joins after a question about an exclamation, as Gutenberg sets it (Chapter VIII)', () => {
    const text = '\'Did you say "What a pity!"?\' the Rabbit asked.';
    expect(sentencesOf(text)).toEqual([text]);
    // Before enders and marks were one run: ['\'Did you say "What a pity!"', '?\' the Rabbit asked.'],
    // the tag sentence beginning with the question's own "?'".
    // marks: ['\'Did you say "What a pity!"', ' the Rabbit asked.']
  });

  it('joins after nested quotations, ”’ and ’”', () => {
    expect(sentencesOf('‘He said “Stop!”’ she whispered.')).toEqual(['‘He said “Stop!”’ she whispered.']);
    // marks: ['‘He said “Stop!”’', ' she whispered.']
    expect(sentencesOf('“He said ‘Stop!’” she whispered.')).toEqual(['“He said ‘Stop!’” she whispered.']);
    // marks: ['“He said ‘Stop!’”', ' she whispered.']
  });
});

describe('what stays two sentences', () => {
  it('keeps “Wait.” She turned. as two', () => {
    expect(sentencesOf('“Wait.” She turned.')).toEqual(['“Wait.”', ' She turned.']);
  });

  it('keeps a capitalised tag as its own sentence: the known limit', () => {
    // "Alice said" cannot be told from "Alice turned" without a parser.
    expect(sentencesOf('“Wait!” Alice said.')).toEqual(['“Wait!”', ' Alice said.']);
  });

  it('never joins a bare ender to lower-case text', () => {
    expect(sentencesOf('Wait! she cried.')).toEqual(['Wait!', ' she cried.']);
    expect(sentencesOf('Who? she asked.')).toEqual(['Who?', ' she asked.']);
  });

  it('never joins after a bracket: only a quotation mark carries speech', () => {
    expect(sentencesOf('(See below.) then turn the page.')).toEqual(['(See below.)', ' then turn the page.']);
  });

  it('never joins a quotation mark written after a space', () => {
    expect(sentencesOf('“Oh dear! ” she said.')).toEqual(['“Oh dear!', ' ” she said.']);
  });

  it('never lets an elision\'s apostrophe stand for the closing quote', () => {
    // goin’ ends before the ender, so nothing closes after it.
    expect(sentencesOf('We were goin’! he said.')).toEqual(['We were goin’!', ' he said.']);
    expect(sentencesOf('We were goin\'! he said.')).toEqual(['We were goin\'!', ' he said.']);
    // ’twas opens a word: the space is followed by an apostrophe, not a lower-case letter.
    expect(sentencesOf('‘Nothin’ doin’!’ ’twas all he said.')).toEqual(['‘Nothin’ doin’!’', ' ’twas all he said.']);
    // base: ['‘Nothin’ doin’!', '’ ’twas all he said.']
  });

  it('never joins across a paragraph break', () => {
    expect(sentencesOf('“Wait!”\n\nshe cried.')).toEqual(['“Wait!”', '\n\nshe cried.']);
  });
});

describe('the Tea-Party, whole-text', () => {
  it.each([
    ['as Gutenberg sets it', TEA_PARTY_SINGLE],
    ['in curly double quotes', TEA_PARTY_CURLY]
  ])('reads 435 words in 27 sentences %s', (_label, text) => {
    // marks: 32 sentences, 13.6 words per sentence, readability 72.8; base: 33, 13.2, 73.6.
    expect(stats(text)).toEqual({ wordCount: 435, sentenceCount: 27, averageWordsPerSentence: 16.1, readabilityScore: 67.8 });
  });
});

describe('no sentence is a lower-case speech tag cut from its speech', () => {
  it.each([
    ['the opening, curly quotes', ALICE_OPENING_CURLY],
    ['the opening, straight quotes', ALICE_OPENING_STRAIGHT],
    ['the opening, mixed quotes', ALICE_OPENING_MIXED],
    ['the opening, wrapped lines', ALICE_OPENING_WRAPPED],
    ['the Tea-Party, single quotes', TEA_PARTY_SINGLE],
    ['the Tea-Party, curly double quotes', TEA_PARTY_CURLY]
  ])('%s', (_label, text) => {
    const spans = proseSentenceSpans(text);
    const cut = spans.filter((span, index) => {
      const before = spans[index - 1];
      return before !== undefined &&
        /[.!?][”’"'][”’"')\]]*$/.test(text.slice(before.start, before.end)) &&
        /^[^\S\n]*\n?[^\S\n]*\p{Ll}/u.test(text.slice(span.start, span.end));
    });
    expect(cut.map((span) => text.slice(span.start, span.end))).toEqual([]);
  });
});
