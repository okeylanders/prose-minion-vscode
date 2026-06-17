import { WordFrequency } from '@/tools/measure/wordFrequency';

describe('WordFrequency', () => {
  it('extracts sorted unique words with length and stopword filters', () => {
    const tool = new WordFrequency();

    expect(tool.extractUniqueWords('The red-red fox and the blue fox.', {
      minCharacterLength: 4,
      excludeStopwords: true
    })).toEqual(['blue', 'red-red']);
  });

  it('handles empty input without optional POS work', () => {
    const tool = new WordFrequency();

    const result = tool.analyze({ text: '' }, {
      posEnabled: false,
      includeBigrams: false,
      includeTrigrams: false,
      includeStopwordsTable: false,
      includeHapaxList: false
    });

    expect(result.totalWords).toBe(0);
    expect(result.uniqueWords).toBe(0);
    expect(result.topWords).toEqual([]);
    expect(result.lexicalDensity).toBeUndefined();
    expect(result.hapaxPercent).toBe(0);
    expect(result.hapaxList).toBeUndefined();
    expect(result.pos).toBeUndefined();
    expect(result.bigrams).toBeUndefined();
    expect(result.trigrams).toBeUndefined();
    expect(result.charLengthHistogram).toEqual([]);
  });

  it('computes stopwords, lexical density, n-grams, and length histograms', () => {
    const tool = new WordFrequency();

    const result = tool.analyze({ text: 'The cat sat. The cat slept.' }, {
      posEnabled: false,
      topN: 3
    });

    expect(result.totalWords).toBe(6);
    expect(result.uniqueWords).toBe(4);
    expect(result.topWords[0]).toEqual({ word: 'cat', count: 2, percentage: 33.3 });
    expect(result.topStopwords).toEqual([{ word: 'the', count: 2, percentage: 33.3 }]);
    expect(result.totalStopwordCount).toBe(2);
    expect(result.lexicalDensity).toBe(66.7);
    expect(result.bigrams?.some(entry => entry.phrase === 'the cat' && entry.count === 2)).toBe(true);
    expect(result.trigrams?.some(entry => entry.phrase === 'the cat sat' && entry.count === 1)).toBe(true);
    expect(result.charLengthCounts[3]).toBe(5);
    expect(result.charLengthCounts[5]).toBe(1);
    expect(result.charLengthHistogram).toEqual([
      '3 chars: ██████████ 83.3%',
      '5 chars: ██ 16.7%'
    ]);
  });

  it('filters top words, hapax, n-grams, and lemmas by configured options', () => {
    const tool = new WordFrequency();

    const result = tool.analyze({ text: 'fox foxes boxes buses running jumped cats cat' }, {
      posEnabled: false,
      contentWordsOnly: false,
      enableLemmas: true,
      minCharacterLength: 4,
      includeBigrams: true,
      includeTrigrams: true,
      hapaxDisplayMax: 2
    });

    expect(result.topWords.map(entry => entry.word)).not.toContain('fox');
    expect(result.hapaxList).toContain('boxes');
    expect(result.bigrams?.every(entry => entry.phrase.split(' ').every(word => word.length >= 4))).toBe(true);
    expect(result.trigrams?.every(entry => entry.phrase.split(' ').every(word => word.length >= 4))).toBe(true);
    expect(result.lemmasEnabled).toBe(true);
    expect(result.topLemmaWords?.map(entry => entry.word)).toEqual(
      expect.arrayContaining(['buse', 'runn', 'jump'])
    );
  });
});
