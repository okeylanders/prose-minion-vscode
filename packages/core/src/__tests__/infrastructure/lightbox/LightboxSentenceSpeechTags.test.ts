/**
 * Every Lightbox reader of the prose-stats sentence rule reads a lower-case
 * speech tag as part of its speech's sentence (ADR 2026-10-21, sentence
 * closing marks: speech tags):
 * - the paragraph metrics and the rhythm lane;
 * - the passage index and the inspector's sentences well;
 * - the sentence summary;
 * - the writer-baseline counts;
 * - the sentence-length standout's instance check;
 * - handoff adjacency;
 * - the borrowed-field collision witness.
 * A synopsis's sentences are an ask since Slice 4H, so no gate counts them.
 *
 * Expectations are literal. Comments give what the closing-marks rule alone
 * gave ("marks:") and, where it differs, the original rule ("base:").
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
import { boardWithPassages, lightboxSentenceRows, type LightboxBoardWithPassages } from '@/__tests__/infrastructure/lightbox/lightboxPassageFixtures';
import { readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';
import { TEA_PARTY_CURLY } from '@/__tests__/tools/measure/passageProseStats/teaPartyFixtures';

const metricOf = (text: string) => measureLightboxParagraph(splitLightboxParagraphs(text)[0]);

/** A row's sentences as the well shows them. */
const rowTexts = (rows: readonly LightboxPassageRow[]): string[] =>
  lightboxSentenceRows(rows).flatMap((row) => row.sentences.map((sentence) => sentence.segments.map((segment) => segment.text).join('')));

function instancesOf(built: LightboxBoardWithPassages, word: string) {
  const passage = buildLightboxPassage(built.board, built.passages, { kind: 'instances', term: { kind: 'word', word } });
  if (passage.kind !== 'instances') {
    throw new Error(`Expected instances, got ${passage.kind}`);
  }
  return passage;
}

describe('the paragraph metrics: the rhythm lane and the inspector\'s paragraph line', () => {
  it('reads “Oh dear!” she said. as 4 words in 1 sentence', () => {
    // marks: 2 sentences, [2, 2], 2 words per sentence; base: [2, 3].
    expect(metricOf('“Oh dear!” she said.')).toEqual(expect.objectContaining({ words: 4, sentences: 1, avgWordsPerSentence: 4, sentenceWords: [4] }));
  });

  describe('on the Tea-Party, in curly double quotes', () => {
    let built: LightboxBoardWithPassages;
    beforeAll(async () => {
      built = await boardWithPassages(TEA_PARTY_CURLY);
    });

    it('counts each paragraph\'s sentences with its speech tags', () => {
      // marks: [2,5,1,2,1,1,1,1,2,1,1,4,2,1,1,1,3,1,1], 32 in all; base: [3,5,1,2,1,1,1,2,2,2,2,4,2,1,1,2,4,2,2], 40.
      expect(built.board.paragraphs.map((paragraph) => paragraph.sentences)).toEqual([2, 3, 1, 2, 1, 1, 1, 1, 2, 1, 1, 3, 1, 1, 1, 1, 2, 1, 1]);
      // ¶17: “Not the same thing a bit!” said the Hatter. · “You might … ‘I eat what I see’!”
      // marks: [6, 3, 22], 10.3 words per sentence; base: [6, 4, 22, 1], 7.8.
      expect(built.board.paragraphs[16]).toEqual(expect.objectContaining({ words: 31, sentences: 2, avgWordsPerSentence: 15.5, sentenceWords: [9, 22] }));
      expect(built.board.ribbon[16].avgWordsPerSentence).toBe(15.5);
    });

    it('holds the same sentences in the passage index', () => {
      const perParagraph = built.board.paragraphs.map((paragraph) =>
        built.passages.sentences().filter((sentence) => sentence.paragraph === paragraph.index).length);
      expect(perParagraph).toEqual(built.board.paragraphs.map((paragraph) => paragraph.sentences));
      expect(built.passages.sentences()).toHaveLength(27); // marks: 32; base: 40
    });

    it('shows each tag with its speech in the sentences well', () => {
      const passage = instancesOf(built, 'said');
      // "N instances in M sentences": 12 in 12 under every rule here.
      expect([passage.instances, passage.sentences]).toEqual([12, 12]);
      const texts = rowTexts(passage.rows);
      // marks: 3 rows began "said …"; base: 3 began "” said …".
      expect(texts.filter((text) => /^[\p{Ll}”’)\]]/u.test(text))).toEqual([]);
      expect(texts).toContain('“There’s PLENTY of room!” said Alice indignantly, and she sat down in a large arm-chair at one end of the table.');
      expect(texts).toContain('“Do you mean that you think you can find out the answer to it?” said the March Hare.');
    });
  });

  it('shows ¶8 of the worked examples\' Alice with its speech, in the "alice" well', async () => {
    const passage = instancesOf(await boardWithPassages(readWorkedExample('A').paragraphs.join('\n\n')), 'alice');
    expect([passage.instances, passage.sentences]).toEqual([7, 6]); // unchanged
    const row = lightboxSentenceRows(passage.rows).find((candidate) => candidate.sentences[0].paragraph === 8);
    // marks: "thought Alice to herself, …"; base: "” thought Alice to herself, …".
    expect(rowTexts(row ? [row] : [])).toEqual([
      '“Well!” thought Alice to herself, “after such a fall as this, I shall think nothing of tumbling down stairs!'
    ]);
  });
});

describe('the sentence summary, the rhythm lens\'s longest and very short sentences', () => {
  it('measures speech and its tag as one sentence', () => {
    // marks: longest 5, 2 very short ("“Stop!”", "she said, and turned away."); base: longest 6, 1 very short.
    expect(lightboxSentenceSummary(['“Stop!” she said, and turned away.'])).toEqual({ longest: { words: 6, paragraph: 1 }, veryShort: 0, underWords: 6 });
  });
});

describe('the writer-baseline counts', () => {
  it('counts a line of speech and its tag once', () => {
    const text = '“Oh dear!” said the Rabbit.\n\n“I shall be late!” he cried.';
    expect(countLightboxFigures(text, text.split('\n\n'))).toEqual(expect.objectContaining({ words: 11, sentences: 2 })); // marks and base: 4
  });
});

describe('the sentence-length standout\'s instance check', () => {
  const row = (direction: 'above' | 'below', reference: number): LightboxNumberRow => ({
    stat: 'sentence-length',
    label: 'Sentence length',
    unit: 'words per sentence',
    value: 4,
    instances: 1,
    instanceLabel: `sentences ${direction === 'above' ? 'over' : 'under'} ${reference} words`,
    paragraphs: [1],
    standout: { direction, against: ['writer'], reference }
  });
  const paragraphs = ['“Oh dear!” she said.'];

  it('measures the quote by its whole sentence, speech and tag', () => {
    // “Oh dear!” is 0–10, in one sentence of 4 words. marks: a sentence of 2, so under 3 and not over 3.
    expect(lightboxInstanceFilter(row('below', 3), paragraphs)(1, 0, 10)).toBe(false);
    expect(lightboxInstanceFilter(row('above', 3), paragraphs)(1, 0, 10)).toBe(true);
  });
});

describe('a handoff\'s adjacency', () => {
  const verifier = createLightboxQuoteVerifier(['“I shall be late!” cried the Rabbit. Alice followed.']);

  it('finds the sentence after a speech and its tag', () => {
    const verdict = findLightboxSentencePair(verifier, { paragraph: 1, text: '“I shall be late!”' }, { paragraph: 1, text: 'Alice followed' });
    // marks: not adjacent, with "cried the Rabbit." a sentence between them.
    expect(verdict).toEqual({
      ok: true,
      pair: {
        from: { paragraph: 1, text: '“I shall be late!”', match: 'exact' },
        to: { paragraph: 1, text: 'Alice followed', match: 'exact' }
      }
    });
  });

  it('does not hand off from speech to its own tag: they are one sentence', () => {
    const verdict = findLightboxSentencePair(verifier, { paragraph: 1, text: 'I shall be late' }, { paragraph: 1, text: 'cried the Rabbit' });
    // marks: adjacent sentences.
    expect(verdict).toEqual({
      ok: false,
      why: 'not-adjacent',
      found: [
        { paragraph: 1, text: 'I shall be late', match: 'exact' },
        { paragraph: 1, text: 'cried the Rabbit', match: 'exact' }
      ],
      withheld: []
    });
  });
});

describe('the collision witness', () => {
  it('finds two fields in a speech and its tag', () => {
    const witness = lightboxCollisionWitness(
      [{ paragraph: 1, text: '“The ledger burned!” she said, counting the cost.', match: 'exact' }],
      [['ledger'], ['counting']]
    );
    // marks: undefined, the fields in two sentences.
    expect(witness).toEqual({ paragraph: 1, text: '“The ledger burned!” she said, counting the cost.', match: 'exact' });
  });
});
