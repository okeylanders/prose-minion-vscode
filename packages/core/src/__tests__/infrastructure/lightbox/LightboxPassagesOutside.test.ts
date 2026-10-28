/**
 * An instance no sentence holds (PR #161 N-01). The sentence rule counts no
 * sentence in a stretch of only space, closing marks and end marks (ADR
 * 2026-10-21), but a straight `'` standing alone is a word to the
 * vocabulary figures, so it can be a listed hapax. Its well row is that
 * stretch of its own paragraph, lit, and the passage counts it apart: never
 * a sentence nearby, never a sentence invented.
 *
 * Astra's three cases run through the production board and index. Each
 * expectation names the lit instance ids and the row text, not only the
 * counts. Text written for these tests.
 */

import type { LightboxInstancesPassage, LightboxPassage, LightboxPassageRow, LightboxPassageSegment } from '@messages';
import { buildLightboxPassage } from '@/infrastructure/lightbox/LightboxPassages';
import type { LightboxPassageIndex } from '@/infrastructure/lightbox/LightboxPassageIndex';
import type { LightboxSpan } from '@/infrastructure/lightbox/LightboxInstances';
import { LIGHTBOX_PASSAGE_BOUNDS } from '@shared/constants/lightboxPassages';
import { boardWithPassages } from '@/__tests__/infrastructure/lightbox/lightboxPassageFixtures';

const APOSTROPHE = { kind: 'hapax', word: '\'' } as const;

function instancesOf(passage: LightboxPassage): LightboxInstancesPassage {
  if (passage.kind !== 'instances') {
    throw new Error(`Expected instances, got ${passage.kind}`);
  }
  return passage;
}

const segments = (list: readonly LightboxPassageSegment[]) => list.map((segment) => (segment.instances ? [segment.text, segment.instances] : [segment.text]));

/** Each row as [kind, paragraphs, segments]: what the well shows, lit ids included. */
const rowsOf = (rows: readonly LightboxPassageRow[]) => rows.map((row) => ('outside' in row
  ? ['outside', [row.outside.paragraph], segments(row.outside.segments)]
  : ['sentences', row.sentences.map((sentence) => sentence.paragraph), row.sentences.map((sentence) => segments(sentence.segments))]));

const counts = ({ instances, sentences, outside, more }: LightboxInstancesPassage) => ({ instances, sentences, outside, more });

const NONE_MORE = { rows: 0, sentences: 0, instances: 0, outside: 0 };

describe('a hapax standing outside every sentence', () => {
  it('lights the trailing quote after a space in its own stretch, not in the sentence before it', async () => {
    const { board, passages } = await boardWithPassages('\'Oh dear! \'');
    expect(board.measured.hapax.map((entry) => entry.term)).toContain('\'');
    expect(passages.sentences().map((sentence) => passages.text.slice(sentence.start, sentence.end))).toEqual(['\'Oh dear!']);
    const passage = instancesOf(buildLightboxPassage(board, passages, { kind: 'instances', term: APOSTROPHE }));
    // At 6cbd27b: "1 instance in 1 sentence", the row "'Oh dear!" and nothing lit.
    expect(rowsOf(passage.rows)).toEqual([['outside', [1], [['\'', [0]]]]]);
    expect(counts(passage)).toEqual({ instances: 1, sentences: 0, outside: 1, more: NONE_MORE });
  });

  it('lights a quote alone in ¶1 there, not the sentence in ¶2', async () => {
    const { board, passages } = await boardWithPassages('\'\n\nAlice ran.');
    expect(board.paragraphs.map((paragraph) => paragraph.sentences)).toEqual([0, 1]);
    const passage = instancesOf(buildLightboxPassage(board, passages, { kind: 'instances', term: APOSTROPHE }));
    // At 6cbd27b: "1 instance in 1 sentence", the row "¶2 Alice ran." and nothing lit.
    expect(rowsOf(passage.rows)).toEqual([['outside', [1], [['\'', [0]]]]]);
    expect(counts(passage)).toEqual({ instances: 1, sentences: 0, outside: 1, more: NONE_MORE });
  });

  it('lights a quote that is the whole text, though the index holds no sentence at all', async () => {
    const { board, passages } = await boardWithPassages('\'');
    expect(passages.sentences()).toEqual([]);
    const passage = instancesOf(buildLightboxPassage(board, passages, { kind: 'instances', term: APOSTROPHE }));
    // At 6cbd27b: "1 instance in 1 sentence" and a row with an empty sentences list.
    expect(rowsOf(passage.rows)).toEqual([['outside', [1], [['\'', [0]]]]]);
    expect(counts(passage)).toEqual({ instances: 1, sentences: 0, outside: 1, more: NONE_MORE });
  });

  it('lights it in the paragraph its row\'s address pins', async () => {
    const { board, passages } = await boardWithPassages('\'\n\nAlice ran.');
    const paragraph = buildLightboxPassage(board, passages, { kind: 'paragraphs', from: 1, to: 1, via: APOSTROPHE });
    expect(paragraph).toEqual({ kind: 'paragraphs', paragraphs: [{ index: 1, segments: [{ text: '\'', instances: [0] }] }], moreParagraphs: 0, lit: 1 });
  });
});

/**
 * No listed term but a lone `'` reaches a stretch outside every sentence, so
 * these cases place instances by hand on a real index, to hold the rows'
 * order, their merging and the row bound.
 */
describe('instances inside and outside sentences, together', () => {
  /** The real index of `text`, answering `spans` for any term. */
  async function placed(text: string, spans: readonly LightboxSpan[]) {
    const { board, passages } = await boardWithPassages(text);
    const index = {
      text: passages.text,
      paragraphs: passages.paragraphs,
      sentences: () => passages.sentences(),
      instancesOf: () => [...spans]
    } as unknown as LightboxPassageIndex;
    return instancesOf(buildLightboxPassage(board, index, { kind: 'instances', term: { kind: 'word', word: 'alice' } }));
  }
  const at = (text: string, part: string, from = 0): LightboxSpan => {
    const start = text.indexOf(part, from);
    return { start, end: start + part.length };
  };

  it('keeps text order, a stretch between two sentences its own row, and counts each apart', async () => {
    const text = 'Alice ran. \' . Alice sat.';
    const passage = await placed(text, [at(text, 'Alice'), at(text, '\''), at(text, 'Alice', 5)]);
    expect(counts(passage)).toEqual({ instances: 3, sentences: 2, outside: 1, more: NONE_MORE });
    expect(rowsOf(passage.rows)).toEqual([
      ['sentences', [1], [[['Alice', [0]], [' ran.']]]],
      ['outside', [1], [['\'', [1]], [' .']]],
      ['sentences', [1], [[['Alice', [2]], [' sat.']]]]
    ]);
  });

  it('puts two instances in one stretch in one row', async () => {
    const text = 'Alice ran. \' \' . Alice sat.';
    const first = at(text, '\'');
    const passage = await placed(text, [first, at(text, '\'', first.end)]);
    expect(counts(passage)).toEqual({ instances: 2, sentences: 0, outside: 2, more: NONE_MORE });
    expect(rowsOf(passage.rows)).toEqual([['outside', [1], [['\'', [0]], [' '], ['\'', [1]], [' .']]]]);
  });

  it('counts a stretch past the row bound among what is not listed', async () => {
    const sentences = Array.from({ length: LIGHTBOX_PASSAGE_BOUNDS.rows + 2 }, () => 'Alice ran.');
    const text = `${sentences.join(' ')} ' .`;
    const spans: LightboxSpan[] = [];
    for (let from = 0, found = text.indexOf('Alice'); found >= 0; from = found + 1, found = text.indexOf('Alice', from)) {
      spans.push({ start: found, end: found + 5 });
    }
    spans.push(at(text, '\''));
    const passage = await placed(text, spans);
    expect(counts(passage)).toEqual({
      instances: 53,
      sentences: 52,
      outside: 1,
      more: { rows: 3, sentences: 2, instances: 3, outside: 1 }
    });
    expect(passage.rows).toHaveLength(LIGHTBOX_PASSAGE_BOUNDS.rows);
  });
});
