/**
 * Hand-built Lightbox boards for the webview tests. The counts are arbitrary
 * but consistent; terms are words from Lewis Carroll's "Alice's Adventures in
 * Wonderland" (1865, public domain). No writer's text is committed.
 */
import type { LightboxBoard, LightboxCountedTerm, LightboxParagraphMetric } from '@messages';
import { buildLightboxRibbon } from '@/infrastructure/lightbox/LightboxParagraphs';
import { emptyLightboxReadingGroup, LIGHTBOX_READING_GROUPS } from '@shared/constants/lightbox';

const term = (name: string, paragraphs: number[], count = paragraphs.length): LightboxCountedTerm => ({
  term: name,
  count,
  percentage: 0.5,
  paragraphs
});

/** A board of `paragraphCount` paragraphs; paragraph 3 runs long and even paragraphs carry dialogue. */
export function makeBoard(paragraphCount = 6): LightboxBoard {
  const paragraphs: LightboxParagraphMetric[] = Array.from({ length: paragraphCount }, (_, offset) => {
    const index = offset + 1;
    const sentences = index === 3 ? 1 : 4;
    const words = index === 3 ? 40 : 32;
    const dialogueWords = index % 2 === 0 ? 8 : 0;
    return {
      index,
      start: offset * 200,
      end: offset * 200 + 180,
      words,
      sentences,
      avgWordsPerSentence: words / sentences,
      sentenceWords: Array.from({ length: sentences }, () => words / sentences),
      dialogueWords,
      dialogueShare: dialogueWords / words
    };
  });
  const totalWords = paragraphs.reduce((sum, paragraph) => sum + paragraph.words, 0);
  return {
    boardVersion: 0,
    boardId: `board-${paragraphCount}`,
    source: {
      kind: 'file',
      displayPath: 'Drafts/alice-1.md',
      sourceUri: 'file:///workspace/Drafts/alice-1.md',
      contentHash: 'a'.repeat(64),
      wordCount: totalWords,
      paragraphCount,
      capturedAt: 1_700_000_000_000,
      preview: 'Alice was beginning to get very tired of sitting by her sister on the bank…'
    },
    paragraphs,
    ribbon: buildLightboxRibbon(paragraphs, 96),
    measured: {
      headline: {
        wordCount: totalWords,
        sentenceCount: paragraphCount * 4,
        paragraphCount,
        averageWordsPerSentence: 8.4,
        averageSentencesPerParagraph: 3.8,
        dialoguePercentage: 12.5,
        lexicalDensity: 54.1,
        readabilityScore: 83.2,
        readabilityGrade: 4.1,
        pacing: 'Fast (short sentences)',
        readingTimeMinutes: 1.2,
        uniqueWordCount: 140,
        hapaxCount: 90,
        hapaxPercent: 40.1,
        vocabularyDiversity: 58
      },
      standards: {
        items: [
          { key: 'dialogue_percentage', label: 'Dialogue %', value: 12.5, standard: { min: 40, max: 55 }, status: 'below' }
        ]
      },
      topWords: [
        term('alice', [2, 4, 5, 6], 5),
        term('rabbit', [1, Math.min(3, paragraphCount), paragraphCount]),
        term('down', [1, paragraphCount], 7)
      ],
      partsOfSpeech: {
        available: true,
        nouns: [term('rabbit', [1, 3])],
        verbs: [term('thought', [2])],
        adjectives: [term('white', [3])],
        adverbs: [term('suddenly', [3, 5])]
      },
      phrases: {
        bigrams: [term('thought alice', [2, 6], 2)],
        trigrams: []
      },
      styleFlags: [{ type: 'Adverbs (-ly words)', count: 4, examples: ['suddenly'] }],
      sentences: { longest: { words: 40, paragraph: 3 }, veryShort: 0, underWords: 6 },
      numbers: {
        rows: [
          {
            stat: 'dialogue',
            label: 'Dialogue',
            unit: '% of words',
            value: 12.5,
            instances: 3,
            instanceLabel: 'paragraphs of narration',
            paragraphs: [1, 3, 5],
            range: { min: 40, max: 55, status: 'below' },
            standout: { direction: 'below', against: ['standards'] }
          },
          {
            stat: 'adverbs',
            label: 'Adverbs (-ly)',
            unit: 'per 1,000 words',
            value: 20,
            instances: 4,
            instanceLabel: 'words ending in -ly',
            paragraphs: [3, 5],
            top: [{ term: 'suddenly', count: 2 }]
          }
        ],
        baseline: { kind: 'absent', note: 'No chapters or manuscript files are configured, so there is no average of your own.' }
      },
      // Slice 4C: the ¶1 heading fires, but one heading divides nothing.
      // eslint-disable-next-line @typescript-eslint/naming-convention -- keyed by the signals' kebab-case protocol ids.
      sections: { signal: 'none', sections: [], fired: { headings: [1], 'scene-breaks': [], 'chapter-lines': [] } }
    },
    readings: LIGHTBOX_READING_GROUPS.map(emptyLightboxReadingGroup)
  };
}
