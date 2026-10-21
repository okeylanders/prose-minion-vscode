/**
 * Every Lightbox reader of the prose-stats sentence rule sees a closing mark
 * stay with the sentence it closes (ADR 2026-10-21, sentence closing marks):
 * the paragraph metrics and the rhythm lane, the sentence summary, the
 * writer-baseline counts, the sentence-length standout's instance check,
 * handoff adjacency, the borrowed-field collision witness, the synopsis
 * bound, and the inspector's sentences well over the passage index.
 *
 * Expectations are literal; each comment says what the former rule gave.
 * Fixture prose is public domain (Lewis Carroll, "Alice's Adventures in
 * Wonderland", 1865) or written for these tests.
 */

import type { LightboxNumberRow, LightboxPassageRow } from '@messages';
import { measureLightboxParagraph, splitLightboxParagraphs } from '@/infrastructure/lightbox/LightboxParagraphs';
import { countLightboxFigures, lightboxSentenceSummary } from '@/infrastructure/lightbox/LightboxNumbers';
import { lightboxInstanceFilter } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { findLightboxSentencePair } from '@/infrastructure/lightbox/LightboxSentencePairs';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { lightboxCollisionWitness } from '@/infrastructure/lightbox/LightboxTileGates';
import { buildLightboxPassage } from '@/infrastructure/lightbox/LightboxPassages';
import { boardWithPassages, type LightboxBoardWithPassages } from '@/__tests__/infrastructure/lightbox/lightboxPassageFixtures';
import { readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';
import { TEA_PARTY_CURLY } from '@/__tests__/tools/measure/passageProseStats/teaPartyFixtures';

const metricOf = (text: string) => measureLightboxParagraph(splitLightboxParagraphs(text)[0]);

/** A row's sentences as the well shows them. */
const rowTexts = (rows: readonly LightboxPassageRow[]): string[] =>
  rows.flatMap((row) => row.sentences.map((sentence) => sentence.segments.map((segment) => segment.text).join('')));

describe('the paragraph metrics: the rhythm lane and the inspector\'s paragraph line', () => {
  it('reads “Oh dear!” as 2 words in 1 sentence', () => {
    // Was 2 sentences, 1 word per sentence, sentence words [2, 1]: the lone ” counted as a word.
    expect(metricOf('“Oh dear!”')).toEqual(expect.objectContaining({ words: 2, sentences: 1, avgWordsPerSentence: 2, sentenceWords: [2] }));
  });

  it('measures a speech tag without the mark before it', () => {
    expect(metricOf('“Oh dear!” she said.').sentenceWords).toEqual([2, 2]); // was [2, 3]
  });

  describe('on the Tea-Party, in curly double quotes', () => {
    let built: LightboxBoardWithPassages;
    beforeAll(async () => {
      built = await boardWithPassages(TEA_PARTY_CURLY);
    });

    it('counts each paragraph\'s sentences with its closing marks', () => {
      // Was [3,5,1,2,1,1,1,2,2,2,2,4,2,1,1,2,4,2,2], 40 in all.
      expect(built.board.paragraphs.map((paragraph) => paragraph.sentences)).toEqual([2, 5, 1, 2, 1, 1, 1, 1, 2, 1, 1, 4, 2, 1, 1, 1, 3, 1, 1]);
      // ¶8, one sentence of speech: was "18 words in 2 sentences · 9 words per sentence".
      expect(built.board.paragraphs[7]).toEqual(expect.objectContaining({ words: 18, sentences: 1, avgWordsPerSentence: 18, sentenceWords: [18] }));
      // ¶17: “Not the same thing a bit!” · said the Hatter. · “You might … ‘I eat what I see’!” (was [6, 4, 22, 1]).
      expect(built.board.paragraphs[16].sentenceWords).toEqual([6, 3, 22]);
      expect(built.board.ribbon[7].avgWordsPerSentence).toBe(18); // was 9
    });

    it('holds the same sentences in the passage index, paragraph by paragraph', () => {
      const perParagraph = built.board.paragraphs.map((paragraph) =>
        built.passages.sentences().filter((sentence) => sentence.paragraph === paragraph.index).length);
      expect(perParagraph).toEqual(built.board.paragraphs.map((paragraph) => paragraph.sentences));
      expect(built.passages.sentences()).toHaveLength(32); // was 40
    });

    it('never begins a row of the sentences well with a closing mark', () => {
      const passage = buildLightboxPassage(built.board, built.passages, { kind: 'instances', term: { kind: 'word', word: 'said' } });
      if (passage.kind !== 'instances') {
        throw new Error(`Expected instances, got ${passage.kind}`);
      }
      // "N instances in M sentences": unchanged, 12 in 12.
      expect([passage.instances, passage.sentences]).toEqual([12, 12]);
      const texts = rowTexts(passage.rows);
      expect(texts.filter((text) => /^[”’)\]]/.test(text))).toEqual([]); // was 3 rows, each "” said …"
      expect(texts).toContain('said Alice indignantly, and she sat down in a large arm-chair at one end of the table.');
      expect(texts).toContain('said the March Hare.');
    });
  });

  it('shows ¶8 of the worked examples\' Alice as its sentence, in the "alice" well', async () => {
    const built = await boardWithPassages(readWorkedExample('A').paragraphs.join('\n\n'));
    const passage = buildLightboxPassage(built.board, built.passages, { kind: 'instances', term: { kind: 'word', word: 'alice' } });
    if (passage.kind !== 'instances') {
      throw new Error(`Expected instances, got ${passage.kind}`);
    }
    expect([passage.instances, passage.sentences]).toEqual([7, 6]); // unchanged
    const row = passage.rows.find((candidate) => candidate.sentences[0].paragraph === 8);
    // Was "” thought Alice to herself, …".
    expect(rowTexts(row ? [row] : [])).toEqual([
      'thought Alice to herself, “after such a fall as this, I shall think nothing of tumbling down stairs!'
    ]);
  });
});

describe('the sentence summary, the rhythm lens\'s longest and very short sentences', () => {
  it('measures a speech tag without the mark before it', () => {
    // Was longest 6 and 1 very short: "” she said, and turned away." held 6 words.
    expect(lightboxSentenceSummary(['“Stop!” she said, and turned away.'])).toEqual({ longest: { words: 5, paragraph: 1 }, veryShort: 2, underWords: 6 });
  });
});

describe('the writer-baseline counts', () => {
  it('counts a file of speech by its sentences, not its closing marks', () => {
    const text = '“Oh dear!”\n\n“I shall be late!”';
    expect(countLightboxFigures(text, text.split('\n\n'))).toEqual(expect.objectContaining({ words: 6, sentences: 2 })); // was 3
  });
});

describe('the sentence-length standout\'s instance check', () => {
  const row = (direction: 'above' | 'below', reference: number): LightboxNumberRow => ({
    stat: 'sentence-length',
    label: 'Sentence length',
    unit: 'words per sentence',
    value: 2,
    instances: 1,
    instanceLabel: `sentences ${direction === 'above' ? 'over' : 'under'} ${reference} words`,
    paragraphs: [1],
    standout: { direction, against: ['writer'], reference }
  });
  const paragraphs = ['“Oh dear!” she said.'];

  it('finds a quote with its closing mark inside one sentence', () => {
    // “Oh dear!” is 0–10. Was false: the sentence ended at 9, so the quote crossed a break.
    expect(lightboxInstanceFilter(row('below', 3), paragraphs)(1, 0, 10)).toBe(true);
  });

  it('measures the speech tag without the mark', () => {
    // "she said." is 11–20, in a sentence of 2 words. Was true: "” she said." held 3.
    expect(lightboxInstanceFilter(row('above', 2), paragraphs)(1, 11, 20)).toBe(false);
  });
});

describe('a handoff\'s adjacency', () => {
  it('finds a quote with its closing marks exactly, in the sentence before the next', () => {
    const verifier = createLightboxQuoteVerifier(['“I shall be late!” The Rabbit ran on. Alice followed.']);
    const verdict = findLightboxSentencePair(verifier, { paragraph: 1, text: '“I shall be late!”' }, { paragraph: 1, text: 'The Rabbit ran on' });
    // Was found only unwrapped: { text: 'I shall be late!', match: 'normalized' }.
    expect(verdict).toEqual({
      ok: true,
      pair: {
        from: { paragraph: 1, text: '“I shall be late!”', match: 'exact' },
        to: { paragraph: 1, text: 'The Rabbit ran on', match: 'exact' }
      }
    });
  });
});

describe('the collision witness', () => {
  it('quotes the sentence that holds both fields with its closing mark', () => {
    const witness = lightboxCollisionWitness(
      [{ paragraph: 1, text: '“The ledger burned!” she said.', match: 'exact' }],
      [['ledger'], ['burned']]
    );
    expect(witness).toEqual({ paragraph: 1, text: '“The ledger burned!”', match: 'exact' }); // was '“The ledger burned!'
  });
});
