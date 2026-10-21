/**
 * The prose-stats sentence rule keeps a sentence's closing marks (ADR
 * 2026-10-21, sentence closing marks). A closing quotation mark or bracket
 * written directly after `.`, `!` or `?` belongs to the sentence it closes,
 * and a stretch of nothing but space and closing marks is no sentence.
 *
 * Every expectation is literal. The comment beside each says what the
 * former rule (a sentence ends at its `.`, `!` or `?` run, and nothing
 * after it) gave, so each case shows what moved. A sentence that goes on
 * after its marks starts with a capital here, so these cases hold the
 * closing marks alone; a lower-case speech tag joins its speech
 * (`sentenceSpeechTags.test.ts`). Fixture prose is public domain (Lewis
 * Carroll, "Alice's Adventures in Wonderland", 1865) or written for these
 * tests.
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

/** Words in each sentence, the Lightbox rhythm lens's figures (`lightboxSentenceWords`). */
const wordsPerSentence = (text: string): number[] => sentencesOf(text).map(countWords);

const stats = (text: string) => {
  const { wordCount, sentenceCount, averageWordsPerSentence, readabilityScore } = new PassageProseStats().analyze({ text });
  return { wordCount, sentenceCount, averageWordsPerSentence, readabilityScore };
};

describe('a closing mark directly after the ender stays with its sentence', () => {
  it('counts “Oh dear!” alone as 2 words in 1 sentence', () => {
    expect(sentencesOf('“Oh dear!”')).toEqual(['“Oh dear!”']); // was ['“Oh dear!', '”']
    // Was 2 sentences, 1 word per sentence and a readability of 98.
    expect(stats('“Oh dear!”')).toEqual({ wordCount: 2, sentenceCount: 1, averageWordsPerSentence: 2, readabilityScore: 96 });
  });

  it('ends “Oh dear!” at its mark, so the next sentence starts with a word', () => {
    const text = '“Oh dear!” She ran.';
    expect(sentencesOf(text)).toEqual(['“Oh dear!”', ' She ran.']); // was ['“Oh dear!', '” She ran.']
    expect(wordsPerSentence(text)).toEqual([2, 2]); // was [2, 3]: the lone ” counted as a word
  });

  it('keeps “Wait.” She turned. as two sentences, the mark with the first', () => {
    expect(sentencesOf('“Wait.” She turned.')).toEqual(['“Wait.”', ' She turned.']); // was ['“Wait.', '” She turned.']
  });

  it('keeps straight double quotes as it keeps curly ones', () => {
    expect(sentencesOf('"Oh dear!" She ran. "Wait."')).toEqual(['"Oh dear!"', ' She ran.', ' "Wait."']);
    // was ['"Oh dear!', '" She ran.', ' "Wait.', '"']
  });
});

describe('single-quoted dialogue', () => {
  it('closes curly single quotes after the ender', () => {
    expect(sentencesOf('‘Stop.’ He turned. ‘Now!’')).toEqual(['‘Stop.’', ' He turned.', ' ‘Now!’']);
    // was ['‘Stop.', '’ He turned.', ' ‘Now!', '’']
  });

  it('closes straight single quotes after the ender, as Gutenberg sets them', () => {
    expect(sentencesOf('\'Stop.\' He turned. \'Now!\'')).toEqual(['\'Stop.\'', ' He turned.', ' \'Now!\'']);
    // was ["'Stop.", "' He turned.", " 'Now!", "'"]
    expect(sentencesOf(TEA_PARTY_PARAGRAPHS[7])).toEqual([TEA_PARTY_PARAGRAPHS[7]]); // was 2: the final ' alone
  });
});

describe('apostrophes of elision never move', () => {
  it('keeps an elision before a space, before the ender and opening a word, in curly marks', () => {
    const text = '‘We’re goin’ home,’ said Bill. ‘Nothin’ doin’!’ ’Twas late.';
    expect(sentencesOf(text)).toEqual(['‘We’re goin’ home,’ said Bill.', ' ‘Nothin’ doin’!’', ' ’Twas late.']);
    // was [..., ' ‘Nothin’ doin’!', '’ ’Twas late.']
  });

  it('does the same in straight marks', () => {
    const text = '\'We\'re goin\' home,\' said Bill. \'Nothin\' doin\'!\' \'Twas late.';
    expect(sentencesOf(text)).toEqual(['\'We\'re goin\' home,\' said Bill.', ' \'Nothin\' doin\'!\'', ' \'Twas late.']);
    // was [..., " 'Nothin' doin'!", "' 'Twas late."]
  });

  it('leaves an elision before a space where it is, with no ender beside it (unchanged)', () => {
    expect(sentencesOf('He kept runnin’ till dark. We followed.')).toEqual(['He kept runnin’ till dark.', ' We followed.']);
  });
});

describe('brackets', () => {
  it('closes a bracketed sentence inside a paragraph', () => {
    expect(sentencesOf('She left. (He did not follow.) The door shut.')).toEqual(['She left.', ' (He did not follow.)', ' The door shut.']);
    // was ['She left.', ' (He did not follow.', ') The door shut.']
  });

  it('counts a bracketed aside that ends a paragraph once', () => {
    expect(sentencesOf('(Which was very likely true.)')).toEqual(['(Which was very likely true.)']); // was 2: ')' alone
  });

  it('closes square brackets after a closing quotation mark', () => {
    expect(sentencesOf('The note said “Back soon.” [It was not.]')).toEqual(['The note said “Back soon.”', ' [It was not.]']);
    // was ['The note said “Back soon.', '” [It was not.', ']']
  });
});

describe('nested quotations', () => {
  it('keeps ’” together after the ender', () => {
    expect(sentencesOf('“He said ‘Stop!’” She ran.')).toEqual(['“He said ‘Stop!’”', ' She ran.']); // was ['“He said ‘Stop!', '’” She ran.']
  });

  it('keeps ”’ together too: the apostrophe follows a closing mark of the run, not a letter', () => {
    expect(sentencesOf('‘He said “Stop!”’ She ran.')).toEqual(['‘He said “Stop!”’', ' She ran.']); // was ['‘He said “Stop!', '”’ She ran.']
  });
});

describe('closing marks after a space', () => {
  it('counts no sentence for a closing-only remainder', () => {
    expect(sentencesOf('“Oh dear! ”')).toEqual(['“Oh dear!']); // was ['“Oh dear!', ' ”']
  });

  it('does not take a mark across a space: it opens the next sentence, as it always did', () => {
    expect(sentencesOf('“Oh dear! ” she said.')).toEqual(['“Oh dear!', ' ” she said.']);
  });
});

describe('what the rule leaves alone', () => {
  it('ends a sentence at an ellipsis of full stops, now with its closing mark', () => {
    expect(sentencesOf('“Well...” She sighed.')).toEqual(['“Well...”', ' She sighed.']); // was ['“Well...', '” She sighed.']
  });

  it('does not end a sentence at …', () => {
    expect(sentencesOf('“Well…” she said. It rained.')).toEqual(['“Well…” she said.', ' It rained.']);
  });

  it('has no abbreviations: Mr. ends a sentence', () => {
    expect(sentencesOf('Mr. Hale said no.')).toEqual(['Mr.', ' Hale said no.']);
  });

  it('keeps runs of enders and text with no ender', () => {
    expect(sentencesOf('What?! Really?! Yes!!')).toEqual(['What?!', ' Really?!', ' Yes!!']);
    expect(sentencesOf('no punctuation here')).toEqual(['no punctuation here']);
    expect(sentencesOf('...')).toEqual([]);
    expect(sentencesOf('”')).toEqual([]); // was ['”']
  });
});

describe('no sentence begins with the closing mark of the one before it', () => {
  it.each([
    ['the opening, curly quotes', ALICE_OPENING_CURLY],
    ['the opening, straight quotes', ALICE_OPENING_STRAIGHT],
    ['the opening, mixed quotes', ALICE_OPENING_MIXED],
    ['the opening, wrapped lines', ALICE_OPENING_WRAPPED],
    ['the Tea-Party, single quotes', TEA_PARTY_SINGLE],
    ['the Tea-Party, curly double quotes', TEA_PARTY_CURLY]
  ])('%s', (_label, text) => {
    const spans = proseSentenceSpans(text);
    for (const span of spans) {
      expect(text.slice(span.start, span.end)).toMatch(/[^\s”’"')\]]/);
    }
    const glued = spans.filter((span, index) => index > 0 && spans[index - 1].end === span.start && /^[”’"')\]]/.test(text.slice(span.start)));
    expect(glued.map((span) => text.slice(span.start, span.end))).toEqual([]);
  });
});
