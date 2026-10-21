import { rankPartsOfSpeech, tagPartsOfSpeech, WordFrequency } from '@/tools/measure/wordFrequency';

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

  it('counts parts of speech from one tagged-occurrence stream, and shares it only when asked', () => {
    const text = 'A light shines.\n\nI light the lamp.';
    const lower = text.toLowerCase();
    const occurrences = tagPartsOfSpeech(lower);

    // Every counted word, in text order, at its token's offset.
    expect(occurrences).toEqual([
      { word: 'light', list: 'nouns', offset: 2, length: 5 },
      { word: 'shines', list: 'verbs', offset: 8, length: 6 },
      { word: 'light', list: 'verbs', offset: 19, length: 5 },
      { word: 'lamp', list: 'nouns', offset: 29, length: 4 }
    ]);
    for (const { word, offset, length } of occurrences) {
      expect(lower.slice(offset, offset! + length)).toBe(word);
    }

    const plain = new WordFrequency().analyze({ text });
    const shared = new WordFrequency().analyze({ text }, { includePosOccurrences: true });
    expect(plain.pos?.occurrences).toBeUndefined();
    expect(shared.pos?.occurrences).toEqual(occurrences);
    const lists = rankPartsOfSpeech(occurrences, plain.totalWords, 1);
    expect(plain.pos?.topNouns).toEqual(lists.nouns);
    expect(plain.pos?.topVerbs).toEqual(lists.verbs);
    expect(plain.pos?.topNouns).toEqual([
      { word: 'light', count: 1, percentage: 14.3 },
      { word: 'lamp', count: 1, percentage: 14.3 }
    ]);
  });

  it('records each token\'s length, so a token inside a contraction is its own span (Slice 4E)', () => {
    const lower = 'she don\'t know; they\'ll go.';
    const occurrences = tagPartsOfSpeech(lower);
    const spans = occurrences.map(({ word, list, offset, length }) => [word, list, lower.slice(offset!, offset! + length)]);
    // The tagger reads "don't" as "do" + "n't" and "they'll" as "they" + "'ll": each token is lit alone.
    expect(spans).toEqual(expect.arrayContaining([
      ['do', 'verbs', 'do'],
      ['n\'t', 'adverbs', 'n\'t'],
      ['know', 'verbs', 'know'],
      ['go', 'verbs', 'go']
    ]));
    expect(occurrences.find((occurrence) => occurrence.word === 'n\'t')).toEqual({ word: 'n\'t', list: 'adverbs', offset: 6, length: 3 });
  });

  it('locates a possessive name the tagger splits from its apostrophe', () => {
    for (const text of ['alice\'s hat.', 'alice’s hat.']) {
      expect(tagPartsOfSpeech(text)).toEqual(expect.arrayContaining([
        { word: 'alice', list: 'nouns', offset: 0, length: 5 },
        expect.objectContaining({ word: 'hat', list: 'nouns' })
      ]));
    }
  });
});
