/**
 * What stands out in the numbers (ADR 2026-10-19 D5, D7 addendum; Slice 4B):
 * every figure is measured by one detector, stands out against the preset's
 * range or the writer's own average only with enough material on both sides,
 * and places its instances with that same detector. No model is involved.
 * The board-level case reads ¶1–¶8 of "Alice's Adventures in Wonderland"
 * (1865, public domain); the road paragraphs are synthetic sentences written
 * for these tests, and the writer's averages are synthetic counts.
 */
import type { LightboxNumberRow, LightboxNumberStatId, LightboxStandardsItem } from '@messages';
import {
  countLightboxFigures,
  lightboxSentenceSummary,
  measureLightboxNumbers,
  type LightboxFigureCounts,
  type LightboxWriterAverages
} from '@/infrastructure/lightbox/LightboxNumbers';
import { findFillerWords } from '@/tools/measure/styleFlags';
import { readWorkedExample } from './lightboxReadingFixtures';
import { boardWithNumbers, WRITER_AVERAGES } from './lightboxCraftFixtures';

/** 17 words, one sentence, one -ly word, no dialogue. */
const ROAD = 'The road ran on past the farm and the mill, and the cart went slowly after it.';
const PLAIN = 'The road ran on past the farm and the mill, and the cart went on after it.';

function writer(
  counts: Partial<Omit<LightboxFigureCounts, 'patterns'>> & { patterns?: Partial<LightboxFigureCounts['patterns']> }
): LightboxWriterAverages {
  const full: LightboxFigureCounts = {
    words: 20_000,
    sentences: 2_000,
    dialogueWords: 6_000,
    ...counts,
    // eslint-disable-next-line @typescript-eslint/naming-convention -- keyed by the figures' kebab-case protocol ids.
    patterns: { 'passive-voice': 30, 'being-verbs': 500, adverbs: 20, intensifiers: 60, ...counts.patterns }
  };
  return { summary: { kind: 'measured', group: 'chapters', files: 8, words: full.words, capped: false }, counts: full };
}

function measure(paragraphs: string[], writerAverages: LightboxWriterAverages, standards?: LightboxStandardsItem[]) {
  return measureLightboxNumbers({
    text: paragraphs.join('\n\n'),
    paragraphs,
    averageWordsPerSentence: 17,
    writer: writerAverages,
    ...(standards ? { standards } : {})
  });
}

const rowOf = (rows: LightboxNumberRow[], stat: LightboxNumberStatId) => rows.find((row) => row.stat === stat) as LightboxNumberRow;

describe('measureLightboxNumbers', () => {
  const twenty = Array.from({ length: 20 }, () => ROAD);

  it('measures every figure, and marks one far from the writer\'s average as standing out against it', () => {
    const { rows, baseline } = measure(twenty, writer({}));
    expect(rows.map((row) => row.stat)).toEqual(['sentence-length', 'dialogue', 'passive-voice', 'being-verbs', 'adverbs', 'intensifiers']);
    expect(baseline).toEqual({ kind: 'measured', group: 'chapters', files: 8, words: 20_000, capped: false });
    // 17 words a sentence against the writer's 10: above, measured in whole words.
    expect(rowOf(rows, 'sentence-length')).toMatchObject({
      value: 17,
      writer: { average: 10, ratio: 1.7 },
      standout: { direction: 'above', against: ['writer'], reference: 10 },
      instances: 20,
      instanceLabel: 'sentences over 10 words'
    });
    // No dialogue against the writer's 30%: below, every paragraph narration.
    expect(rowOf(rows, 'dialogue')).toMatchObject({
      value: 0,
      standout: { direction: 'below', against: ['writer'] },
      instances: 20,
      instanceLabel: 'paragraphs of narration only'
    });
    // 20 -ly words in 340 against 1 a thousand: above, with its words counted.
    expect(rowOf(rows, 'adverbs')).toMatchObject({
      value: 58.8,
      writer: { average: 1, ratio: 58.8 },
      standout: { direction: 'above', against: ['writer'] },
      instances: 20,
      top: [{ term: 'slowly', count: 20 }]
    });
    expect(rowOf(rows, 'adverbs').paragraphs).toHaveLength(20);
    expect(rowOf(rows, 'intensifiers')).toMatchObject({ value: 0, instances: 0, paragraphs: [] });
    expect(rowOf(rows, 'intensifiers').standout).toBeUndefined();
  });

  it('never marks a word pattern rarer than usual: it has no instance to read', () => {
    const { rows } = measure(twenty, writer({ patterns: { adverbs: 4_000 } }));
    expect(rowOf(rows, 'adverbs')).toMatchObject({ writer: { average: 200 } });
    expect(rowOf(rows, 'adverbs').standout).toBeUndefined();
  });

  it('compares with the writer only with enough material: 300 words of chapter, three instances, 2,000 words of average', () => {
    const short = measure(twenty.slice(0, 10), writer({}));
    expect(short.rows.filter((row) => row.standout)).toEqual([]);
    expect(rowOf(short.rows, 'adverbs').writer).toEqual({ average: 1, ratio: 58.8 });

    const twoInstances = measure([ROAD, ROAD, ...Array.from({ length: 18 }, () => PLAIN)], writer({ patterns: { adverbs: 1 } }));
    expect(rowOf(twoInstances.rows, 'adverbs')).toMatchObject({ instances: 2 });
    expect(rowOf(twoInstances.rows, 'adverbs').standout).toBeUndefined();

    const thinAverage = measure(twenty, writer({ words: 1_500, sentences: 150 }));
    expect(thinAverage.rows.some((row) => row.writer !== undefined || row.standout !== undefined)).toBe(false);
    expect(thinAverage.baseline).toEqual({
      kind: 'absent',
      note: 'Your other chapters hold fewer than 2,000 words, too few for an average of your own.'
    });
  });

  it('marks a figure outside the preset\'s range, and measures a long sentence against the bound it broke', () => {
    const standards: LightboxStandardsItem[] = [
      { key: 'avg_words_per_sentence', label: 'Words per sentence', value: 17, standard: { min: 10, max: 15 }, status: 'above' },
      { key: 'dialogue_percentage', label: 'Dialogue %', value: 0, standard: { min: 20, max: 40 }, status: 'below' }
    ];
    const absent: LightboxWriterAverages = { summary: { kind: 'absent', note: 'No average.' } };
    const { rows } = measure(twenty, absent, standards);
    expect(rowOf(rows, 'sentence-length')).toMatchObject({
      range: { min: 10, max: 15, status: 'above' },
      standout: { direction: 'above', against: ['standards'], reference: 15 },
      instanceLabel: 'sentences over 15 words'
    });
    expect(rowOf(rows, 'dialogue').standout).toEqual({ direction: 'below', against: ['standards'] });
    // Both bases, when both agree.
    const both = measure(twenty, writer({}), standards);
    expect(rowOf(both.rows, 'sentence-length').standout).toEqual({ direction: 'above', against: ['standards', 'writer'], reference: 15 });
  });

  it('measures the worked example\'s chapter on the production board against the fixture writer', async () => {
    const paragraphs = readWorkedExample('D').paragraphs;
    const board = await boardWithNumbers(paragraphs);
    const { rows, baseline } = board.measured.numbers;
    expect(baseline).toEqual(WRITER_AVERAGES.summary);
    expect(rows.filter((row) => row.standout).map((row) => [row.stat, row.standout?.direction])).toEqual([
      ['sentence-length', 'above'], ['dialogue', 'below'], ['intensifiers', 'above']
    ]);
    // An intensifier's paragraphs are the ones its detector finds one in.
    expect(rowOf(rows, 'intensifiers').paragraphs).toEqual(paragraphs.flatMap((text, index) => (findFillerWords(text).length > 0 ? [index + 1] : [])));
    expect(rowOf(rows, 'intensifiers').top?.[0]).toEqual({ term: 'very', count: expect.any(Number) });
  });
});

describe('the counts behind the figures', () => {
  it('counts word patterns paragraph by paragraph, so none spans a paragraph break', () => {
    const paragraphs = ['The cake was', 'baked by noon.'];
    expect(countLightboxFigures(paragraphs.join('\n\n'), paragraphs).patterns['passive-voice']).toBe(0);
    expect(countLightboxFigures('The cake was baked by noon.', ['The cake was baked by noon.']).patterns['passive-voice']).toBe(1);
  });

  it('summarizes the longest and the very short sentences, a closing mark counting as no sentence', () => {
    const summary = lightboxSentenceSummary([
      '“Oh dear!” She ran.',
      'The well was deep, and she fell for a long time past cupboards and shelves.'
    ]);
    expect(summary).toEqual({ longest: { words: 15, paragraph: 2 }, veryShort: 2, underWords: 6 });
    expect(lightboxSentenceSummary([])).toEqual({ longest: null, veryShort: 0, underWords: 6 });
  });
});
