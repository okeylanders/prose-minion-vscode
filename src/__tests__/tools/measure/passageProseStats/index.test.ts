/**
 * PassageProseStats Business Logic Tests
 * Tests prose statistics calculations
 */

import { PassageProseStats } from '@/tools/measure/passageProseStats/index';

describe('PassageProseStats - Business Logic', () => {
  let stats: PassageProseStats;

  beforeEach(() => {
    stats = new PassageProseStats();
  });

  describe('Word Count', () => {
    it('should count words correctly', () => {
      const result = stats.analyze({ text: 'The quick brown fox jumps over the lazy dog' });
      expect(result.wordCount).toBe(9);
    });

    it('should handle multiple spaces', () => {
      const result = stats.analyze({ text: 'word    word    word' });
      expect(result.wordCount).toBe(3);
    });

    it('should handle empty text', () => {
      const result = stats.analyze({ text: '' });
      expect(result.wordCount).toBe(0);
    });

    it('should handle text with only whitespace', () => {
      const result = stats.analyze({ text: '   \n   \t   ' });
      expect(result.wordCount).toBe(0);
    });
  });

  describe('Sentence Count', () => {
    it('should count sentences with periods', () => {
      const result = stats.analyze({ text: 'First sentence. Second sentence. Third sentence.' });
      expect(result.sentenceCount).toBe(3);
    });

    it('should count sentences with mixed punctuation', () => {
      const result = stats.analyze({ text: 'Question? Statement. Exclamation!' });
      expect(result.sentenceCount).toBe(3);
    });

    it('should handle multiple punctuation marks', () => {
      const result = stats.analyze({ text: 'What?! Really?! Yes!!' });
      expect(result.sentenceCount).toBe(3);
    });

    it('should handle text without punctuation', () => {
      const result = stats.analyze({ text: 'no punctuation here' });
      expect(result.sentenceCount).toBe(1);
    });
  });

  describe('Paragraph Count', () => {
    it('should count paragraphs separated by double newlines', () => {
      const result = stats.analyze({ text: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.' });
      expect(result.paragraphCount).toBe(3);
    });

    it('should handle single newlines as same paragraph', () => {
      const result = stats.analyze({ text: 'Line one.\nLine two.\nLine three.' });
      expect(result.paragraphCount).toBe(1);
    });

    it('should handle paragraphs with multiple blank lines', () => {
      const result = stats.analyze({ text: 'Paragraph one.\n\n\n\nParagraph two.' });
      expect(result.paragraphCount).toBe(2);
    });
  });

  describe('Dialogue Percentage', () => {
    it('should calculate dialogue percentage', () => {
      const result = stats.analyze({ text: '"Hello world" said John' });
      expect(result.dialoguePercentage).toBeGreaterThan(0);
      expect(result.dialoguePercentage).toBeLessThan(100);
    });

    it('should return 0 for text without dialogue', () => {
      const result = stats.analyze({ text: 'This is just prose without any dialogue' });
      expect(result.dialoguePercentage).toBe(0);
    });

    it('should handle text with only dialogue', () => {
      const result = stats.analyze({ text: '"All dialogue" "More dialogue"' });
      expect(result.dialoguePercentage).toBe(100);
    });

    it('should handle nested quotes', () => {
      const result = stats.analyze({ text: '"He said, \\"hello\\"" said John' });
      expect(result.dialoguePercentage).toBeGreaterThan(0);
    });
  });

  describe('Lexical Density', () => {
    it('should calculate lexical density (content word ratio)', () => {
      const result = stats.analyze({ text: 'The cat sat on the mat' });
      // "cat", "sat", "mat" are content words (3 out of 6 = 50%)
      expect(result.lexicalDensity).toBeGreaterThan(0);
      expect(result.lexicalDensity).toBeLessThanOrEqual(100);
    });

    it('should return 0 for empty text', () => {
      const result = stats.analyze({ text: '' });
      expect(result.lexicalDensity).toBe(0);
    });

    it('should handle text with only stopwords', () => {
      const result = stats.analyze({ text: 'the and or but if' });
      expect(result.lexicalDensity).toBe(0);
    });

    it('should handle text with only content words', () => {
      const result = stats.analyze({ text: 'elephant giraffe rhinoceros hippopotamus' });
      expect(result.lexicalDensity).toBe(100);
    });
  });

  describe('Averages', () => {
    it('should calculate average words per sentence', () => {
      const result = stats.analyze({ text: 'Short. Medium sentence here. This is a longer sentence with more words.' });
      expect(result.averageWordsPerSentence).toBeGreaterThan(0);
      expect(Number.isFinite(result.averageWordsPerSentence)).toBe(true);
    });

    it('should calculate average sentences per paragraph', () => {
      const result = stats.analyze({ text: 'First. Second.\n\nThird. Fourth. Fifth.' });
      expect(result.averageSentencesPerParagraph).toBeGreaterThan(0);
      expect(Number.isFinite(result.averageSentencesPerParagraph)).toBe(true);
    });

    it('should handle division by zero (no sentences)', () => {
      const result = stats.analyze({ text: 'no punctuation' });
      expect(result.averageWordsPerSentence).toBeGreaterThan(0);
    });

    it('should handle division by zero (no paragraphs)', () => {
      const result = stats.analyze({ text: '' });
      expect(result.averageSentencesPerParagraph).toBe(0);
    });
  });

  describe('Pacing', () => {
    it('should determine fast pacing for short sentences', () => {
      const result = stats.analyze({ text: 'Short. Very short. Quick.' });
      expect(result.pacing).toContain('Fast');
    });

    it('should determine moderate pacing for medium sentences', () => {
      const result = stats.analyze({ text: 'This is a medium sentence with about twelve to fifteen words in it.' });
      expect(result.pacing).toBe('Moderate');
    });

    it('should determine slow pacing for long sentences', () => {
      const text = 'This is a very long sentence with many words that goes on and on to demonstrate a slow pacing with longer sentence structure and complexity.';
      const result = stats.analyze({ text });
      expect(result.pacing).toContain('Slow');
    });
  });

  describe('Unique Word Count', () => {
    it('should count unique words', () => {
      const result = stats.analyze({ text: 'word word word unique' });
      expect(result.uniqueWordCount).toBe(2);
    });

    it('should be case-insensitive for unique words', () => {
      const result = stats.analyze({ text: 'Word word WORD unique' });
      expect(result.uniqueWordCount).toBe(2);
    });

    it('should handle all unique words', () => {
      const result = stats.analyze({ text: 'one two three four five' });
      expect(result.uniqueWordCount).toBe(5);
    });
  });

  describe('Word Length Distribution', () => {
    it('should calculate word length distribution', () => {
      const result = stats.analyze({ text: 'I am going somewhere interesting' });
      const dist = result.wordLengthDistribution!;

      expect(dist['1_to_3_letters']).toBeGreaterThan(0);
      expect(dist['4_to_6_letters']).toBeGreaterThan(0);
      expect(dist['7_plus_letters']).toBeGreaterThan(0);

      // Total should be 100%
      const total = dist['1_to_3_letters'] + dist['4_to_6_letters'] + dist['7_plus_letters'];
      expect(Math.round(total)).toBe(100);
    });

    it('should handle text with only short words', () => {
      const result = stats.analyze({ text: 'I am to be or do it' });
      const dist = result.wordLengthDistribution!;

      expect(dist['1_to_3_letters']).toBe(100);
      expect(dist['4_to_6_letters']).toBe(0);
      expect(dist['7_plus_letters']).toBe(0);
    });

    it('should handle text with only long words', () => {
      const result = stats.analyze({ text: 'extraordinary magnificent phenomenal' });
      const dist = result.wordLengthDistribution!;

      expect(dist['1_to_3_letters']).toBe(0);
      expect(dist['4_to_6_letters']).toBe(0);
      expect(dist['7_plus_letters']).toBe(100);
    });
  });

  describe('Type-Token Ratio (Vocabulary Diversity)', () => {
    it('should calculate type-token ratio', () => {
      const result = stats.analyze({ text: 'word word word unique another different' });
      // 4 unique words out of 6 total = ~66.7%
      expect(result.typeTokenRatio).toBeGreaterThan(60);
      expect(result.typeTokenRatio).toBeLessThan(70);
    });

    it('should equal vocabularyDiversity', () => {
      const result = stats.analyze({ text: 'some sample text here' });
      expect(result.vocabularyDiversity).toBe(result.typeTokenRatio);
    });

    it('should return 100 for all unique words', () => {
      const result = stats.analyze({ text: 'one two three four five' });
      expect(result.typeTokenRatio).toBe(100);
    });

    it('should handle repeated words', () => {
      const result = stats.analyze({ text: 'word word word word' });
      expect(result.typeTokenRatio).toBe(25); // 1 unique out of 4 total
    });
  });

  describe('Hapax (Words Appearing Once)', () => {
    it('should count hapax words', () => {
      const result = stats.analyze({ text: 'word word unique another different' });
      // "unique", "another", "different" appear once = 3 hapax
      expect(result.hapaxCount).toBe(3);
    });

    it('should calculate hapax percentage', () => {
      const result = stats.analyze({ text: 'word word unique another different' });
      // 3 hapax out of 5 total = 60%
      expect(result.hapaxPercent).toBe(60);
    });

    it('should return 0 for text with all repeated words', () => {
      const result = stats.analyze({ text: 'word word word word' });
      expect(result.hapaxCount).toBe(0);
      expect(result.hapaxPercent).toBe(0);
    });

    it('should return 100% for text with all unique words', () => {
      const result = stats.analyze({ text: 'one two three four five' });
      expect(result.hapaxPercent).toBe(100);
    });
  });

  describe('Reading Time', () => {
    it('should estimate reading time', () => {
      const text = Array(240).fill('word').join(' '); // 240 words = ~1 minute
      const result = stats.analyze({ text });

      expect(result.readingTimeMinutes).toBeCloseTo(1, 0);
      expect(result.readingTime).toBe('1m');
    });

    it('should calculate hours for long text', () => {
      const text = Array(14400).fill('word').join(' '); // 14400 words = 60 minutes = 1 hour
      const result = stats.analyze({ text });

      expect(result.readingTimeHours).toBeCloseTo(1, 0);
    });

    it('should return 0 for empty text', () => {
      const result = stats.analyze({ text: '' });

      expect(result.readingTimeMinutes).toBe(0);
      expect(result.readingTime).toBeUndefined();
    });
  });

  describe('Readability Score', () => {
    it('should calculate readability score', () => {
      const result = stats.analyze({ text: 'This is a simple sentence.' });

      expect(result.readabilityScore).toBeGreaterThan(0);
      expect(result.readabilityScore).toBeLessThanOrEqual(100);
    });

    it('should give higher score for shorter sentences', () => {
      const short = stats.analyze({ text: 'Short. Very short. Quick.' });
      const long = stats.analyze({ text: 'This is a much longer sentence with many words that makes it more difficult to read and understand.' });

      expect(short.readabilityScore).toBeGreaterThan(long.readabilityScore);
    });

    it('should calculate readability grade', () => {
      const result = stats.analyze({ text: 'This is a simple test sentence.' });

      expect(result.readabilityGrade).toBeDefined();
      expect(result.readabilityGrade!).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle text with special characters', () => {
      const result = stats.analyze({ text: '@#$ word1 word2 @#$' });
      expect(result.wordCount).toBeGreaterThan(0);
    });

    it('should handle text with contractions', () => {
      const result = stats.analyze({ text: "don't can't won't shouldn't" });
      expect(result.wordCount).toBe(4);
    });

    it('should handle text with numbers', () => {
      const result = stats.analyze({ text: 'There are 123 apples and 456 oranges.' });
      expect(result.wordCount).toBeGreaterThan(0);
    });

    it('should round all percentages to 1 decimal place', () => {
      const result = stats.analyze({ text: 'The cat sat on the mat' });

      // Check that values match when rounded to 1 decimal place
      expect(result.dialoguePercentage).toBe(Math.round(result.dialoguePercentage * 10) / 10);
      expect(result.lexicalDensity).toBe(Math.round(result.lexicalDensity * 10) / 10);
    });
  });
});
