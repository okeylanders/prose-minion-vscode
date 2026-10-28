/**
 * The writer's word list (Draft Edit Slice 3b, part 2; ADR 2026-10-21,
 * Amendment 2026-10-26): normalized at the gesture, matched as words with
 * case and possessives set aside, sent per chunk only where it occurs, and
 * the backstop for a spelling or wrong-word finding. Words are from
 * public-domain *Alice* and made up.
 */
import {
  acceptedWordsIn,
  isAcceptedWord,
  proofreadWordList,
  proofreadWordListKeys,
  proofreadWords
} from '@/utils/proofread/proofreadWordList';

describe('proofreadWordList', () => {
  it('keeps strings\' words in order, each once by case, an entry of several words word by word', () => {
    expect(proofreadWordList(['Dinah', '  Mad Hatter ', 'dinah', 'O’Brien', 'Glimmer-fox', 'DINAH'])).toEqual(['Dinah', 'Mad', 'Hatter', 'O’Brien', 'Glimmer-fox']);
  });

  it('sets a possessive aside, so an entry written with one accepts the name', () => {
    expect(proofreadWordList(['Dinah’s', "Hatter's"])).toEqual(['Dinah', 'Hatter']);
  });

  it.each([[undefined], [null], ['Dinah'], [42], [{ word: 'Dinah' }]])('names nothing for %p', (value) => {
    expect(proofreadWordList(value)).toEqual([]);
  });

  it('skips what is not a string, or holds no word', () => {
    expect(proofreadWordList([42, null, ' ', '—', 'Dinah'])).toEqual(['Dinah']);
  });
});

describe('proofreadWords', () => {
  it('reads words with inner apostrophes and hyphens, and ends a possessive word before its "\'s"', () => {
    const text = 'Dinah’s cat, O\'Brien and the Glimmer-fox: “sisters’ bank”.';
    expect(proofreadWords(text).map((word) => [word.text, text.slice(word.start, word.end)])).toEqual([
      ['Dinah', 'Dinah'], ['cat', 'cat'], ["O'Brien", "O'Brien"], ['and', 'and'], ['the', 'the'],
      ['Glimmer-fox', 'Glimmer-fox'], ['sisters', 'sisters'], ['bank', 'bank']
    ]);
  });
});

describe('acceptedWordsIn', () => {
  const list = ['Dinah', 'Glimmer', 'Wonderlund', 'O’Brien'];

  it('sends only the listed words a chunk holds, as listed, in the list\'s order, whatever their case or possessive', () => {
    expect(acceptedWordsIn(list, 'O\'Brien saw that DINAH’S whiskers twitched.')).toEqual(['Dinah', 'O’Brien']);
  });

  it('finds a listed word that is part of a hyphenated one', () => {
    expect(acceptedWordsIn(list, 'The Glimmer-fox ran.')).toEqual(['Glimmer']);
  });

  it('never matches inside a longer word', () => {
    expect(acceptedWordsIn(list, 'Dinahs and Wonderlunds and glimmering.')).toEqual([]);
  });

  it('sends nothing for an empty list', () => {
    expect(acceptedWordsIn([], 'Dinah')).toEqual([]);
  });
});

describe('isAcceptedWord', () => {
  const accepted = proofreadWordListKeys(['Dinah', 'Glimmer', 'fox']);

  it.each(['Dinah', 'dinah', 'Dinah,', '“Dinah', 'Dinah’s', "Dinah's", 'Glimmer-fox'])('accepts %p', (quote) => {
    expect(isAcceptedWord(accepted, quote)).toBe(true);
  });

  it.each(['the Dinah', 'Dinah Dinah', 'Dinahs', 'Glimmer-cat', '', 'Alice'])('does not accept %p', (quote) => {
    expect(isAcceptedWord(accepted, quote)).toBe(false);
  });

  it('accepts nothing from an empty list', () => {
    expect(isAcceptedWord(new Set(), 'Dinah')).toBe(false);
  });
});
