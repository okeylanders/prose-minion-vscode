/**
 * Passage Search's chunks (ADR 2026-11-20 D5, D5a): the overlap inside the
 * budget, an oversized paragraph split at sentence ends, a sentence over the
 * budget unsplittable; and Draft Edit's own chunks unchanged. The text is
 * made-up filler.
 */
import { passageChunks, type PassageChunk } from '@services/search/passage/passageChunks';
import { chunkParagraphs } from '@/utils/draftEdit/chunkParagraphs';
import { countWords } from '@/utils/textUtils';

/** A sentence of `words` words, the first naming it. */
const sentence = (name: string, words: number): string => `${[name, ...Array.from({ length: words - 1 }, () => 'tea')].join(' ')}.`;
/** A paragraph of `count` sentences of `words` words each. */
const paragraph = (name: string, count: number, words: number): string =>
  Array.from({ length: count }, (_unused, index) => sentence(`${name}${index + 1}`, words)).join(' ');

function chunksOf(text: string, budget: number, overlapWords: number): readonly PassageChunk[] {
  const split = passageChunks(text, budget, overlapWords);
  if (split.kind !== 'chunks') {
    throw new Error('expected chunks');
  }
  return split.chunks;
}

const slices = (text: string, chunks: readonly PassageChunk[]): string[] => chunks.map((chunk) => text.slice(chunk.start, chunk.end));
const bodies = (text: string, chunks: readonly PassageChunk[]): string[] => chunks.map((chunk) => text.slice(chunk.bodyStart, chunk.end));

describe('passageChunks', () => {
  it('keeps a text that fits whole, as one chunk with no overlap', () => {
    const text = `${paragraph('Alice', 2, 5)}\n\n${paragraph('Rabbit', 2, 5)}`;
    const chunks = chunksOf(text, 100, 30);
    expect(chunks).toEqual([{ start: 0, bodyStart: 0, end: text.length, words: 20 }]);
  });

  it('gives no chunks for a text with no words', () => {
    expect(passageChunks('  \n\n \n', 100, 30)).toEqual({ kind: 'chunks', chunks: [] });
  });

  it('splits at paragraphs, each later chunk opening with the paragraph before it', () => {
    const paragraphs = ['Alice', 'Rabbit', 'Queen', 'Hatter'].map((name) => paragraph(name, 2, 5));
    const text = paragraphs.join('\n\n');
    // 10 words a paragraph, 25 a call: two paragraphs, then the second again with the next.
    const chunks = chunksOf(text, 25, 15);
    expect(bodies(text, chunks)).toEqual([`${paragraphs[0]}\n\n${paragraphs[1]}`, paragraphs[2], paragraphs[3]]);
    expect(slices(text, chunks)).toEqual([
      `${paragraphs[0]}\n\n${paragraphs[1]}`,
      `${paragraphs[1]}\n\n${paragraphs[2]}`,
      `${paragraphs[2]}\n\n${paragraphs[3]}`
    ]);
  });

  it('counts the overlap inside the budget: two adjacent chunks near the limit stay within it', () => {
    // Four paragraphs of 12 words at 25 a call: bodies alone would pair up at 24, but the overlap takes that room.
    const paragraphs = ['Alice', 'Rabbit', 'Queen', 'Hatter'].map((name) => paragraph(name, 2, 6));
    const text = paragraphs.join('\n\n');
    const chunks = chunksOf(text, 25, 20);
    for (const chunk of chunks) {
      expect(chunk.words).toBeLessThanOrEqual(25);
      expect(countWords(text.slice(chunk.start, chunk.end))).toBe(chunk.words);
    }
    expect(chunks.map((chunk) => chunk.words)).toEqual([24, 24, 24]);
    expect(slices(text, chunks)[1]).toBe(`${paragraphs[1]}\n\n${paragraphs[2]}`);
    // Every paragraph is some chunk's own text exactly once.
    expect(bodies(text, chunks).join('\n\n')).toBe(text);
  });

  it('repeats only the closing sentences of an overlap paragraph longer than overlapWords', () => {
    const long = paragraph('Alice', 5, 6);
    const next = paragraph('Rabbit', 1, 6);
    const text = `${long}\n\n${next}`;
    // 30 words, then 6; 32 a call, at most 13 of overlap: the last two sentences of the long paragraph.
    const chunks = chunksOf(text, 32, 13);
    expect(slices(text, chunks)).toEqual([long, `${sentence('Alice4', 6)} ${sentence('Alice5', 6)}\n\n${next}`]);
    expect(chunks[1].words).toBe(18);
  });

  it('drops the overlap when even one closing sentence leaves no room beside the first paragraph', () => {
    const first = paragraph('Alice', 2, 10);
    const second = paragraph('Rabbit', 2, 10);
    const text = `${first}\n\n${second}`;
    const chunks = chunksOf(text, 25, 50);
    expect(slices(text, chunks)).toEqual([first, second]);
  });

  it('splits a paragraph over the budget at sentence ends, each piece overlapping the one before by a sentence', () => {
    const text = paragraph('Alice', 6, 5);
    const sentences = Array.from({ length: 6 }, (_unused, index) => sentence(`Alice${index + 1}`, 5));
    // 30 words in one paragraph at 12 a call: two sentences, then one repeated with one new.
    const chunks = chunksOf(text, 12, 100);
    expect(slices(text, chunks)).toEqual([
      `${sentences[0]} ${sentences[1]}`,
      `${sentences[1]} ${sentences[2]}`,
      `${sentences[2]} ${sentences[3]}`,
      `${sentences[3]} ${sentences[4]}`,
      `${sentences[4]} ${sentences[5]}`
    ]);
    chunks.forEach((chunk) => expect(chunk.words).toBeLessThanOrEqual(12));
    expect(bodies(text, chunks).join(' ')).toBe(text);
  });

  it('keeps the paragraphs around an oversized one whole', () => {
    const before = paragraph('Queen', 1, 4);
    const big = paragraph('Alice', 4, 5);
    const after = paragraph('Hatter', 1, 4);
    const text = `${before}\n\n${big}\n\n${after}`;
    const chunks = chunksOf(text, 12, 100);
    expect(bodies(text, chunks)[0]).toBe(`${before}\n\n${sentence('Alice1', 5)}`);
    expect(bodies(text, chunks).at(-1)).toBe(after);
    chunks.forEach((chunk) => expect(chunk.words).toBeLessThanOrEqual(12));
  });

  it('says a text with a sentence over the budget cannot be split', () => {
    const text = `${paragraph('Alice', 2, 5)}\n\n${sentence('Rabbit', 40)}`;
    expect(passageChunks(text, 12, 6)).toEqual({ kind: 'unsplittable' });
    // A paragraph with no sentence end at all is one sentence.
    expect(passageChunks(Array.from({ length: 40 }, () => 'tea').join(' '), 12, 6)).toEqual({ kind: 'unsplittable' });
  });

  it('reads the text raw, and every chunk is one slice of it', () => {
    const text = `# Chapter One\n\n${paragraph('Alice', 2, 5)}\n\n\`\`\`\ncode stays\n\`\`\`\n\n${paragraph('Rabbit', 2, 5)}`;
    const chunks = chunksOf(text, 16, 16);
    expect(bodies(text, chunks).join('\n\n')).toBe(text);
  });
});

describe('Draft Edit\'s chunkParagraphs (unchanged by the shared paragraph rule)', () => {
  it('still cuts on blank lines with no overlap, and keeps a paragraph over the budget whole', () => {
    const paragraphs = [paragraph('Alice', 2, 5), paragraph('Rabbit', 4, 5), paragraph('Queen', 1, 5)];
    const text = paragraphs.join('\n\n');
    expect(chunkParagraphs(text, 12)).toEqual([
      { start: 0, end: paragraphs[0].length, words: 10, text: paragraphs[0] },
      { start: paragraphs[0].length + 2, end: paragraphs[0].length + 2 + paragraphs[1].length, words: 20, text: paragraphs[1] },
      { start: text.length - paragraphs[2].length, end: text.length, words: 5, text: paragraphs[2] }
    ]);
  });
});
