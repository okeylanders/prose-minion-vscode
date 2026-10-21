/**
 * The Lightbox paragraph model (ADR 2026-10-19 D4): one splitter that agrees
 * with PassageProseStats, per-paragraph counts on the shared rules, a stable
 * content hash, and the ribbon's buckets.
 */

import {
  bucketParagraphs,
  buildLightboxRibbon,
  lightboxContentHash,
  measureLightboxParagraph,
  splitLightboxParagraphs
} from '@/infrastructure/lightbox/LightboxParagraphs';
import { PassageProseStats } from '@/tools/measure/passageProseStats';
import { countDialogueWords } from '@/utils/dialogueSpans';
import { countWords } from '@/utils/textUtils';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  ALICE_HEADING,
  ALICE_OPENING_CURLY,
  ALICE_OPENING_MIXED,
  ALICE_OPENING_STRAIGHT,
  ALICE_OPENING_WRAPPED,
  ALICE_PARAGRAPHS
} from '@/__tests__/infrastructure/lightbox/lightboxProseFixtures';

const proseStats = new PassageProseStats();

describe('splitLightboxParagraphs', () => {
  const fixtures: Array<[string, string]> = [
    ['curly quotes', ALICE_OPENING_CURLY],
    ['straight quotes', ALICE_OPENING_STRAIGHT],
    ['hard-wrapped lines', ALICE_OPENING_WRAPPED],
    ['CRLF line endings', ALICE_OPENING_CURLY.replace(/\n/g, '\r\n')],
    ['blank lines around the text', `\n\n  \n${ALICE_OPENING_CURLY}\n\n\n`],
    ['whitespace-only separator lines', ALICE_OPENING_CURLY.replace(/\n\n/g, '\n   \t\n')],
    ['runs of blank lines', ALICE_OPENING_CURLY.replace(/\n\n/g, '\n\n\n\n')],
    ['three copies', [ALICE_OPENING_CURLY, ALICE_OPENING_STRAIGHT, ALICE_OPENING_MIXED].join('\n\n')],
    ['one paragraph', ALICE_PARAGRAPHS[2]],
    ['empty text', ''],
    ['whitespace only', ' \n\n \t\n ']
  ];

  it.each(fixtures)('agrees with PassageProseStats on the paragraph count (%s)', (_label, text) => {
    expect(splitLightboxParagraphs(text)).toHaveLength(proseStats.analyze({ text }).paragraphCount);
  });

  it('numbers paragraphs from 1, trims them, and bounds each with offsets into the text', () => {
    const text = `\n  ${ALICE_OPENING_CURLY.replace(/\n\n/g, '\n  \n')}  \n`;
    const paragraphs = splitLightboxParagraphs(text);

    expect(paragraphs.map((paragraph) => paragraph.index)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(paragraphs[0].text).toBe(ALICE_HEADING);
    paragraphs.forEach((paragraph, offset) => {
      expect(text.slice(paragraph.start, paragraph.end)).toBe(paragraph.text);
      expect(paragraph.text).toBe(paragraph.text.trim());
      expect(paragraph.words).toBe(countWords(paragraph.text));
      expect(paragraph.text).toBe([ALICE_HEADING, ...ALICE_PARAGRAPHS][offset]);
    });
  });

  it('counts a heading line between blank lines as a paragraph', () => {
    const [heading] = splitLightboxParagraphs(ALICE_OPENING_CURLY);
    expect(heading).toEqual(expect.objectContaining({ index: 1, text: ALICE_HEADING, words: 5 }));
  });
});

describe('measureLightboxParagraph', () => {
  const measure = (text: string) => splitLightboxParagraphs(text).map(measureLightboxParagraph);

  it.each([
    ['straight', ALICE_OPENING_STRAIGHT],
    ['curly', ALICE_OPENING_CURLY],
    ['mixed', ALICE_OPENING_MIXED]
  ])('finds the same dialogue in %s quotes, and the paragraphs sum to the whole-text count', (_label, text) => {
    const metrics = measure(text);
    const reference = measure(ALICE_OPENING_CURLY);

    expect(metrics.map((metric) => metric.dialogueWords)).toEqual(reference.map((metric) => metric.dialogueWords));
    expect(metrics.reduce((sum, metric) => sum + metric.dialogueWords, 0)).toBe(countDialogueWords(text));
    // Paragraph 2 opens with speech woven into narration; 3 to 5 have none; 6 is mostly speech.
    expect(metrics[1].dialogueShare).toBeGreaterThan(0);
    expect(metrics.slice(2, 5).map((metric) => metric.dialogueShare)).toEqual([0, 0, 0]);
    expect(metrics[5].dialogueShare).toBeGreaterThan(0.8);
    expect(metrics[5].dialogueShare).toBeLessThan(1);
  });

  it('agrees with PassageProseStats on dialogue words for the whole text', () => {
    const metrics = measure(ALICE_OPENING_MIXED);
    const stats = proseStats.analyze({ text: ALICE_OPENING_MIXED });
    const words = metrics.reduce((sum, metric) => sum + metric.words, 0);
    const dialogue = metrics.reduce((sum, metric) => sum + metric.dialogueWords, 0);

    expect(words).toBe(stats.wordCount);
    expect(Math.round((dialogue / words) * 1000) / 10).toBe(stats.dialoguePercentage);
  });

  it('counts sentences with the prose-stats rule and derives the rhythm', () => {
    const [, first, , third] = measure(ALICE_OPENING_CURLY);

    // One sentence, ending “…conversation?” with its closing mark. The former rule
    // counted 2: the ” after the "?" stood alone as a sentence (ADR 2026-10-21).
    expect(first.sentences).toBe(1);
    expect(third).toEqual(expect.objectContaining({ words: 21, sentences: 1, avgWordsPerSentence: 21 }));
    expect(first.avgWordsPerSentence).toBe(Math.round((first.words / first.sentences) * 10) / 10);
  });

  it('reports no rhythm for a paragraph with no sentence', () => {
    const [metric] = measure('...');
    expect(metric).toEqual(expect.objectContaining({ sentences: 0, avgWordsPerSentence: 0 }));
  });
});

describe('lightboxContentHash', () => {
  it('is a stable SHA-256 hex digest', () => {
    const hash = lightboxContentHash(ALICE_OPENING_CURLY);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(lightboxContentHash(ALICE_OPENING_CURLY)).toBe(hash);
  });

  it('ignores line endings, Unicode composition and outer whitespace', () => {
    const hash = lightboxContentHash(ALICE_OPENING_CURLY);
    expect(lightboxContentHash(ALICE_OPENING_CURLY.replace(/\n/g, '\r\n'))).toBe(hash);
    expect(lightboxContentHash(`\n${ALICE_OPENING_CURLY}  \n`)).toBe(hash);
    expect(lightboxContentHash('café')).toBe(lightboxContentHash('café'));
  });

  it('changes when the text changes', () => {
    expect(lightboxContentHash(ALICE_OPENING_STRAIGHT)).not.toBe(lightboxContentHash(ALICE_OPENING_CURLY));
    expect(lightboxContentHash(ALICE_OPENING_CURLY.replace('tired', 'weary')))
      .not.toBe(lightboxContentHash(ALICE_OPENING_CURLY));
  });
});

describe('bucketParagraphs', () => {
  const columns = PROMPT_BUDGETS.lightbox.ribbonColumns;

  /** Every paragraph exactly once, in order, in contiguous non-empty ranges. */
  const expectContiguous = (count: number) => {
    const ranges = bucketParagraphs(count, columns);
    let next = 1;
    for (const range of ranges) {
      expect(range.from).toBe(next);
      expect(range.to).toBeGreaterThanOrEqual(range.from);
      next = range.to + 1;
    }
    expect(next).toBe(count + 1);
    return ranges;
  };

  it('draws one column for one paragraph', () => {
    expect(expectContiguous(1)).toEqual([{ from: 1, to: 1 }]);
  });

  it('draws one column per paragraph up to the ribbon width', () => {
    const ranges = expectContiguous(96);
    expect(ranges).toHaveLength(96);
    expect(ranges.every((range) => range.from === range.to)).toBe(true);
  });

  it('switches to ranges one paragraph past the width', () => {
    const ranges = expectContiguous(97);
    expect(ranges).toHaveLength(96);
    expect(ranges.filter((range) => range.to > range.from)).toEqual([{ from: 96, to: 97 }]);
  });

  it('spreads 1,500 paragraphs over 96 columns of near-equal size', () => {
    const ranges = expectContiguous(1_500);
    const sizes = ranges.map((range) => range.to - range.from + 1);
    expect(ranges).toHaveLength(96);
    expect(Math.min(...sizes)).toBe(15);
    expect(Math.max(...sizes)).toBe(16);
  });

  it('draws nothing for no paragraphs', () => {
    expect(bucketParagraphs(0, columns)).toEqual([]);
  });
});

describe('buildLightboxRibbon', () => {
  it('pools rhythm and dialogue over each column', () => {
    const metrics = splitLightboxParagraphs(ALICE_OPENING_CURLY).map(measureLightboxParagraph);
    const [single] = buildLightboxRibbon(metrics, 96);
    const [pooled] = buildLightboxRibbon(metrics, 1);
    const words = metrics.reduce((sum, metric) => sum + metric.words, 0);
    const sentences = metrics.reduce((sum, metric) => sum + metric.sentences, 0);
    const dialogue = metrics.reduce((sum, metric) => sum + metric.dialogueWords, 0);

    expect(single).toEqual({ from: 1, to: 1, avgWordsPerSentence: 5, dialogueShare: 0 });
    expect(pooled).toEqual({
      from: 1,
      to: 6,
      avgWordsPerSentence: Math.round((words / sentences) * 10) / 10,
      dialogueShare: Math.round((dialogue / words) * 1000) / 1000
    });
  });
});
