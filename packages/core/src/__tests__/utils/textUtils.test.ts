import { countWords, trimToCharacterLimit, trimToWordLimit } from '@/utils/textUtils';

describe('textUtils', () => {
  describe('countWords', () => {
    it('returns 0 for empty or whitespace-only text', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('   \n\t  ')).toBe(0);
    });

    it('counts words across irregular whitespace', () => {
      expect(countWords('  one   two\nthree\tfour  ')).toBe(4);
    });
  });

  describe('trimToWordLimit', () => {
    it('returns unchanged text when it is already within the limit', () => {
      expect(trimToWordLimit('one two three', 3)).toEqual({
        trimmed: 'one two three',
        originalWords: 3,
        trimmedWords: 3,
        wasTrimmed: false
      });
    });

    it('trims to the exact word limit when no sentence boundary is available', () => {
      expect(trimToWordLimit('one two three four five', 3)).toEqual({
        trimmed: 'one two three',
        originalWords: 5,
        trimmedWords: 3,
        wasTrimmed: true
      });
    });

    it('prefers a nearby sentence boundary when trimming', () => {
      expect(trimToWordLimit('one two three. four five six seven', 6)).toEqual({
        trimmed: 'one two three.',
        originalWords: 7,
        trimmedWords: 3,
        wasTrimmed: true
      });
    });
  });

  describe('trimToCharacterLimit', () => {
    it('returns unchanged text with character provenance when within the limit', () => {
      expect(trimToCharacterLimit('abc', 3)).toEqual({
        trimmed: 'abc',
        originalCharacters: 3,
        trimmedCharacters: 3,
        wasTrimmed: false
      });
    });

    it('head-slices text and reports the omitted character count inputs', () => {
      expect(trimToCharacterLimit('abcdef', 4)).toEqual({
        trimmed: 'abcd',
        originalCharacters: 6,
        trimmedCharacters: 4,
        wasTrimmed: true
      });
    });
  });
});
