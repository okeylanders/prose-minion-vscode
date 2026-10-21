/**
 * The inspector's passages as the host cuts them (Slice 4E): a paragraph
 * whole, lit by the term the writer came from; a range up to its bound; the
 * sentences a term stands in, one row per sentence or per run an instance
 * crosses; and the refusals. Text from Lewis Carroll's "Alice's Adventures
 * in Wonderland" (1865, public domain) and lines written for these tests.
 */

import type { LightboxPassage, LightboxPassageSegment } from '@messages';
import { buildLightboxPassage, lightboxBoardCountOf } from '@/infrastructure/lightbox/LightboxPassages';
import { ALICE_OPENING_CURLY, ALICE_PARAGRAPHS } from '@/__tests__/infrastructure/lightbox/lightboxProseFixtures';
import { boardWithPassages } from '@/__tests__/infrastructure/lightbox/lightboxPassageFixtures';

const segments = (list: readonly LightboxPassageSegment[]) => list.map((segment) => (segment.instances ? [segment.text, segment.instances] : [segment.text]));

function paragraphsOf(passage: LightboxPassage) {
  if (passage.kind !== 'paragraphs') {
    throw new Error(`Expected paragraphs, got ${passage.kind}`);
  }
  return passage;
}

function instancesOf(passage: LightboxPassage) {
  if (passage.kind !== 'instances') {
    throw new Error(`Expected instances, got ${passage.kind}`);
  }
  return passage;
}

describe('a paragraph passage', () => {
  it('is the paragraph\'s whole text, as the chapter has it, with nothing lit', async () => {
    const { board, passages } = await boardWithPassages(ALICE_OPENING_CURLY);
    const passage = paragraphsOf(buildLightboxPassage(board, passages, { kind: 'paragraphs', from: 4, to: 4 }));
    expect(passage).toEqual({
      kind: 'paragraphs',
      paragraphs: [{ index: 4, segments: [{ text: ALICE_PARAGRAPHS[2] }] }],
      moreParagraphs: 0
    });
  });

  it('lights the instances of the term the writer came from, numbered as the term\'s well numbers them', async () => {
    const { board, passages } = await boardWithPassages(ALICE_OPENING_CURLY);
    // "alice" is a top word ×5, in ¶2 (twice), ¶4, ¶5 and ¶6.
    expect(lightboxBoardCountOf(board, { kind: 'word', word: 'alice' })).toBe(5);
    const second = paragraphsOf(buildLightboxPassage(board, passages, { kind: 'paragraphs', from: 2, to: 2, via: { kind: 'word', word: 'alice' } }));
    expect(second.lit).toBe(2);
    expect(segments(second.paragraphs[0].segments).filter((segment) => segment.length === 2)).toEqual([['Alice', [0]], ['Alice', [1]]]);
    const last = paragraphsOf(buildLightboxPassage(board, passages, { kind: 'paragraphs', from: 6, to: 6, via: { kind: 'word', word: 'alice' } }));
    expect(last.lit).toBe(1);
    expect(segments(last.paragraphs[0].segments).slice(0, 2)).toEqual([['“Well!” thought '], ['Alice', [4]]]);
  });

  it('lights a part-of-speech token inside a contraction, as the tagger counted it', async () => {
    const { board, passages } = await boardWithPassages('She said she didn\'t know.\n\nShe didn\'t care, and she didn\'t go.');
    const lists = board.measured.partsOfSpeech;
    expect(lists.adverbs.find((entry) => entry.term === 'n\'t')).toEqual(expect.objectContaining({ count: 3, paragraphs: [1, 2] }));
    const passage = paragraphsOf(buildLightboxPassage(board, passages, {
      kind: 'paragraphs', from: 2, to: 2, via: { kind: 'pos', pos: 'adverbs', word: 'n\'t' }
    }));
    expect(segments(passage.paragraphs[0].segments)).toEqual([
      ['She did'], ['n\'t', [1]], [' care, and she did'], ['n\'t', [2]], [' go.']
    ]);
  });

  it('lights nothing for a term the board no longer lists, and still shows the paragraph', async () => {
    const { board, passages } = await boardWithPassages(ALICE_OPENING_CURLY);
    const passage = paragraphsOf(buildLightboxPassage(board, passages, { kind: 'paragraphs', from: 2, to: 2, via: { kind: 'word', word: 'jabberwock' } }));
    expect(passage.lit).toBeUndefined();
    expect(passage.paragraphs[0].segments).toEqual([{ text: ALICE_PARAGRAPHS[0] }]);
  });

  it('sends a range\'s first ten paragraphs and says how many more there are', async () => {
    const text = Array.from({ length: 14 }, (_unused, index) => `Paragraph ${index + 1} went down.`).join('\n\n');
    const { board, passages } = await boardWithPassages(text);
    const passage = paragraphsOf(buildLightboxPassage(board, passages, { kind: 'paragraphs', from: 2, to: 14 }));
    expect(passage.paragraphs.map((paragraph) => paragraph.index)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(passage.moreParagraphs).toBe(3);
  });

  it('refuses paragraphs the board does not have', async () => {
    const { board, passages } = await boardWithPassages(ALICE_OPENING_CURLY);
    for (const [from, to] of [[0, 1], [6, 7], [4, 3]]) {
      expect(buildLightboxPassage(board, passages, { kind: 'paragraphs', from, to })).toEqual({ kind: 'refused', reason: 'not-on-board' });
    }
  });
});

describe('an instances passage', () => {
  it('lists one row per sentence, and one row for the sentences an instance runs across, even over a paragraph break', async () => {
    const { board, passages } = await boardWithPassages('It was the end\n\nNever mind. The end never came.');
    expect(lightboxBoardCountOf(board, { kind: 'phrase', phrase: 'end never' })).toBe(2);
    const passage = instancesOf(buildLightboxPassage(board, passages, { kind: 'instances', term: { kind: 'phrase', phrase: 'end never' } }));
    expect({ instances: passage.instances, sentences: passage.sentences, more: passage.more })
      .toEqual({ instances: 2, sentences: 3, more: { rows: 0, sentences: 0, instances: 0 } });
    expect(passage.rows.map((row) => row.sentences.map((sentence) => [sentence.paragraph, sentence.sentence, segments(sentence.segments)])))
      .toEqual([
        [[1, 1, [['It was the '], ['end', [0]]]], [2, 1, [['Never', [0]], [' mind.']]]],
        [[2, 2, [['The '], ['end never', [1]], [' came.']]]]
      ]);
  });

  it('lights an overlapping phrase\'s instances where they share words', async () => {
    const { board, passages } = await boardWithPassages('He had had had enough. It had had its day.');
    expect(lightboxBoardCountOf(board, { kind: 'phrase', phrase: 'had had' })).toBe(3);
    const passage = instancesOf(buildLightboxPassage(board, passages, { kind: 'instances', term: { kind: 'phrase', phrase: 'had had' } }));
    expect(passage.rows.map((row) => row.sentences.map((sentence) => segments(sentence.segments)))).toEqual([
      [[['He '], ['had ', [0]], ['had', [0, 1]], [' had', [1]], [' enough.']]],
      [[['It '], ['had had', [2]], [' its day.']]]
    ]);
  });

  it('opens a hapax word\'s one sentence and a style flag\'s sentences', async () => {
    const { board, passages } = await boardWithPassages(ALICE_OPENING_CURLY);
    const hapax = board.measured.hapax.find((entry) => entry.written === 'daisy-chain');
    expect(hapax).toEqual({ term: 'daisychain', written: 'daisy-chain', paragraph: 3 });
    const one = instancesOf(buildLightboxPassage(board, passages, { kind: 'instances', term: { kind: 'hapax', word: 'daisychain' } }));
    expect({ instances: one.instances, sentences: one.sentences }).toEqual({ instances: 1, sentences: 1 });
    expect(one.rows[0].sentences[0].segments.filter((segment) => segment.instances)).toEqual([{ text: 'daisy-chain', instances: [0] }]);

    const adverbs = board.measured.styleFlags.find((flag) => flag.id === 'adverbs');
    const flagged = instancesOf(buildLightboxPassage(board, passages, { kind: 'instances', term: { kind: 'flag', flag: 'adverbs' } }));
    expect(flagged.instances).toBe(adverbs?.count);
  });

  it('refuses a term the board does not list', async () => {
    const { board, passages } = await boardWithPassages(ALICE_OPENING_CURLY);
    for (const term of [
      { kind: 'word' as const, word: 'jabberwock' },
      { kind: 'pos' as const, pos: 'nouns' as const, word: 'jabberwock' },
      { kind: 'phrase' as const, phrase: 'vorpal blade' },
      { kind: 'hapax' as const, word: 'alice' },
      { kind: 'flag' as const, flag: 'passive-voice' as const }
    ]) {
      expect({ term, passage: buildLightboxPassage(board, passages, { kind: 'instances', term }) })
        .toEqual({ term, passage: { kind: 'refused', reason: 'not-on-board' } });
    }
  });
});

/**
 * The row bound limits rows, not what one row holds (PR #159 N-01). Before
 * the fix, each segment scanned every instance, so these passages took two
 * to four seconds each and grew with the square of the instances. One
 * second is a coarse ceiling: the linear cut takes about a tenth of it, and
 * the board is built before the clock starts. Nothing is dropped to keep it
 * fast: every count is literal.
 */
describe('one long row', () => {
  const INSTANCES = 25_000;
  const CEILING_MS = 1_000;

  function timed<T>(build: () => T): { passage: T; ms: number } {
    const started = performance.now();
    const passage = build();
    return { passage, ms: performance.now() - started };
  }

  const litIn = (rows: ReadonlyArray<{ sentences: ReadonlyArray<{ segments: readonly LightboxPassageSegment[] }> }>) =>
    new Set(rows.flatMap((row) => row.sentences.flatMap((sentence) => sentence.segments.flatMap((segment) => segment.instances ?? [])))).size;

  it('cuts one sentence holding 25,000 instances in linear time, and lights every one', async () => {
    // One sentence: "Alice Alice … Alice." The word and the phrase are both on the board.
    const { board, passages } = await boardWithPassages(`${Array.from({ length: INSTANCES }, () => 'Alice').join(' ')}.`);
    expect(lightboxBoardCountOf(board, { kind: 'word', word: 'alice' })).toBe(25_000);
    expect(lightboxBoardCountOf(board, { kind: 'phrase', phrase: 'alice alice' })).toBe(24_999);

    const word = timed(() => instancesOf(buildLightboxPassage(board, passages, { kind: 'instances', term: { kind: 'word', word: 'alice' } })));
    expect({ instances: word.passage.instances, sentences: word.passage.sentences, rows: word.passage.rows.length, more: word.passage.more })
      .toEqual({ instances: 25_000, sentences: 1, rows: 1, more: { rows: 0, sentences: 0, instances: 0 } });
    const wordSegments = word.passage.rows[0].sentences[0].segments;
    expect(wordSegments).toHaveLength(50_000);
    expect(segments(wordSegments.slice(0, 3))).toEqual([['Alice', [0]], [' '], ['Alice', [1]]]);
    expect(segments(wordSegments.slice(-2))).toEqual([['Alice', [24_999]], ['.']]);
    expect(litIn(word.passage.rows)).toBe(25_000);

    // Overlapping instances keep their own numbers: each inner word is in two,
    // and a stretch in one instance only is one segment ("Alice " at the start).
    const phrase = timed(() => instancesOf(buildLightboxPassage(board, passages, { kind: 'instances', term: { kind: 'phrase', phrase: 'alice alice' } })));
    expect({ instances: phrase.passage.instances, sentences: phrase.passage.sentences, rows: phrase.passage.rows.length })
      .toEqual({ instances: 24_999, sentences: 1, rows: 1 });
    const phraseSegments = phrase.passage.rows[0].sentences[0].segments;
    expect(phraseSegments).toHaveLength(49_998);
    expect(segments(phraseSegments.slice(0, 5))).toEqual([['Alice ', [0]], ['Alice', [0, 1]], [' ', [1]], ['Alice', [1, 2]], [' ', [2]]]);
    expect(segments(phraseSegments.slice(-3))).toEqual([['Alice', [24_997, 24_998]], [' Alice', [24_998]], ['.']]);
    expect(litIn(phrase.passage.rows)).toBe(24_999);

    const paragraph = timed(() => paragraphsOf(buildLightboxPassage(board, passages, { kind: 'paragraphs', from: 1, to: 1, via: { kind: 'word', word: 'alice' } })));
    expect(paragraph.passage.lit).toBe(25_000);
    expect(paragraph.passage.paragraphs[0].segments).toHaveLength(50_000);

    expect({ word: word.ms < CEILING_MS, phrase: phrase.ms < CEILING_MS, paragraph: paragraph.ms < CEILING_MS })
      .toEqual({ word: true, phrase: true, paragraph: true });
  }, 60_000);

  it('joins the 25,000 sentences one phrase runs across into one row in linear time', async () => {
    // "Alice. Alice. … Alice.": the phrase "alice alice" crosses every sentence break.
    const { board, passages } = await boardWithPassages(Array.from({ length: INSTANCES }, () => 'Alice.').join(' '));
    expect(lightboxBoardCountOf(board, { kind: 'phrase', phrase: 'alice alice' })).toBe(24_999);

    const phrase = timed(() => instancesOf(buildLightboxPassage(board, passages, { kind: 'instances', term: { kind: 'phrase', phrase: 'alice alice' } })));
    expect({ instances: phrase.passage.instances, sentences: phrase.passage.sentences, rows: phrase.passage.rows.length })
      .toEqual({ instances: 24_999, sentences: 25_000, rows: 1 });
    const row = phrase.passage.rows[0].sentences;
    expect(row).toHaveLength(25_000);
    expect(row.slice(0, 2).map((sentence) => [sentence.sentence, segments(sentence.segments)])).toEqual([
      [1, [['Alice.', [0]]]],
      [2, [['Alice', [0, 1]], ['.', [1]]]]
    ]);
    expect(segments(row[24_999].segments)).toEqual([['Alice', [24_998]], ['.']]);
    expect(litIn(phrase.passage.rows)).toBe(24_999);

    // The word stands in one sentence each, so the row bound holds and says what lies past it.
    const word = instancesOf(buildLightboxPassage(board, passages, { kind: 'instances', term: { kind: 'word', word: 'alice' } }));
    expect({ instances: word.instances, sentences: word.sentences, rows: word.rows.length, more: word.more })
      .toEqual({ instances: 25_000, sentences: 25_000, rows: 50, more: { rows: 24_950, sentences: 24_950, instances: 24_950 } });

    expect(phrase.ms < CEILING_MS).toBe(true);
  }, 60_000);
});
