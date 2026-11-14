import {
  findFoldedMatches,
  foldSearchQuery,
  foldSearchText,
  foldedTextIncludes
} from '@shared/utils/foldedTextSearch';

const marked = (text: string, query: string, limit?: number): string[] =>
  findFoldedMatches(text, foldSearchText(query), limit).map(({ start, end }) => text.slice(start, end));

describe('foldedTextSearch', () => {
  describe('foldSearchText', () => {
    it('ignores case', () => {
      expect(foldSearchText('The White RABBIT')).toBe('the white rabbit');
    });

    it('ignores accents, written whole or as separate marks', () => {
      expect(foldSearchText('Café')).toBe('cafe');
      expect(foldSearchText('Café')).toBe('cafe');
      expect(foldSearchText('ÉCLAIR naïve Ångström')).toBe('eclair naive angstrom');
    });

    it('turns each whitespace character into one space without collapsing runs', () => {
      expect(foldSearchText('down\tthe\nrabbit hole')).toBe('down the rabbit hole');
      expect(foldSearchText('a  b')).toBe('a  b');
    });

    it('leaves punctuation and digits as written', () => {
      expect(foldSearchText('alice-ch3.md (v2)')).toBe('alice-ch3.md (v2)');
    });

    it('folds one code point at a time, so parts fold as the whole does', () => {
      const parts = ['Alice ', 'fell\n', 'DOWN ', 'the ', 'terrieŕ', ' — 𝒜', ' ΟΔΟΣ'];
      expect(foldSearchText(parts.join(''))).toBe(parts.map(foldSearchText).join(''));
    });

    it('is its own fixed point', () => {
      const once = foldSearchText('Ünïcödé  Tea-Party\nÉ');
      expect(foldSearchText(once)).toBe(once);
    });
  });

  describe('foldSearchQuery', () => {
    it('collapses and trims whitespace before folding', () => {
      expect(foldSearchQuery('  White \n  Rabbit ', 100)).toBe('white rabbit');
    });

    it('is empty for nothing but whitespace', () => {
      expect(foldSearchQuery('  \n\t ', 100)).toBe('');
    });

    it('clips an over-long query to its bound, by whole characters', () => {
      expect(foldSearchQuery('x'.repeat(250), 100)).toBe('x'.repeat(100));
      expect(foldSearchQuery('𝒜𝒜𝒜', 2)).toBe('𝒜𝒜');
      expect(foldSearchQuery('tea party', 4)).toBe('tea');
    });
  });

  describe('foldedTextIncludes', () => {
    it('finds a folded query anywhere in the text', () => {
      expect(foldedTextIncludes('The Mad Hatter’s Café', 'cafe')).toBe(true);
      expect(foldedTextIncludes('The Mad Hatter', 'dormouse')).toBe(false);
    });

    it('never matches an empty query', () => {
      expect(foldedTextIncludes('anything', '')).toBe(false);
    });
  });

  describe('findFoldedMatches', () => {
    it('returns every occurrence as the text writes it', () => {
      expect(marked('Rabbit, rabbit, RABBIT!', 'rabbit')).toEqual(['Rabbit', 'rabbit', 'RABBIT']);
    });

    it('keeps a letter with the accent written after it', () => {
      expect(marked('a café at dusk', 'cafe')).toEqual(['café']);
      expect(marked('a café at dusk', 'cafe')).toEqual(['café']);
      expect(marked('a café at dusk', 'afe')).toEqual(['afé']);
    });

    it('places a hit after text whose fold is shorter or longer than it is written', () => {
      expect(marked('ééé rabbit', 'rabbit')).toEqual(['rabbit']);
      // A Hangul syllable decomposes into three letters under NFD.
      expect(marked('한 rabbit 한', 'rabbit')).toEqual(['rabbit']);
      expect(marked('𝒜 rabbit', 'rabbit')).toEqual(['rabbit']);
    });

    it('matches across a line break as it would a space', () => {
      expect(marked('the white\nrabbit ran', 'white rabbit')).toEqual(['white\nrabbit']);
    });

    it('does not let occurrences overlap', () => {
      expect(marked('aaaa', 'aa')).toEqual(['aa', 'aa']);
    });

    it('stops at the limit', () => {
      expect(marked('tea tea tea', 'tea', 1)).toEqual(['tea']);
      expect(findFoldedMatches('tea tea tea', 'tea', 1)).toEqual([{ start: 0, end: 3 }]);
    });

    it('finds nothing for an empty query or a query that is not there', () => {
      expect(findFoldedMatches('tea', '')).toEqual([]);
      expect(findFoldedMatches('tea', 'coffee')).toEqual([]);
    });

    it('treats pattern characters as plain text', () => {
      expect(marked('is it (a+b)* or .*?', '(a+b)*')).toEqual(['(a+b)*']);
      expect(marked('alice', '.*')).toEqual([]);
    });

    it('reads a long text in one pass', () => {
      const text = `${'a'.repeat(200_000)}é rabbit`;
      const [hit] = findFoldedMatches(text, 'rabbit', 1);
      expect(text.slice(hit.start, hit.end)).toBe('rabbit');
    });
  });
});
