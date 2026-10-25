/**
 * Paragraph chunking (ADR 2026-10-21 D6): chunks follow paragraph breaks,
 * stay under the word budget, and skip text with no prose. Fixtures are
 * public domain.
 */
import { chunkParagraphs, countProseWords } from '@/utils/draftEdit/chunkParagraphs';
import { PROTECTED_PLACEHOLDER } from '@/utils/draftEdit/protectedRegions';
import { ALICE_OPENING_SEEDED, ALICE_RABBIT_SEEDED } from '@/__tests__/utils/draftEdit/proofreadFixtures';

describe('countProseWords', () => {
  it('counts whitespace-separated words and ignores protected placeholders', () => {
    expect(countProseWords('Alice  was\nbeginning')).toBe(3);
    expect(countProseWords(`Call ${PROTECTED_PLACEHOLDER} now`)).toBe(2);
    expect(countProseWords(`${PROTECTED_PLACEHOLDER}\n${PROTECTED_PLACEHOLDER}`)).toBe(0);
  });
});

describe('chunkParagraphs', () => {
  const chapter = `${ALICE_OPENING_SEEDED}\n\n${ALICE_RABBIT_SEEDED}`;

  it('keeps paragraphs together while they fit, and each chunk is a slice of the source', () => {
    const chunks = chunkParagraphs(chapter, 10_000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ start: 0, end: chapter.length, text: chapter });
    expect(chunks[0].words).toBe(countProseWords(chapter));
  });

  it('splits at a paragraph break when the next paragraph would exceed the budget', () => {
    const chunks = chunkParagraphs(chapter, countProseWords(ALICE_OPENING_SEEDED) + 1);
    expect(chunks.map((chunk) => chunk.text)).toEqual([ALICE_OPENING_SEEDED, ALICE_RABBIT_SEEDED]);
    for (const chunk of chunks) {
      expect(chapter.slice(chunk.start, chunk.end)).toBe(chunk.text);
    }
  });

  it('never splits a paragraph, even one longer than the budget', () => {
    const chunks = chunkParagraphs(chapter, 5);
    expect(chunks.map((chunk) => chunk.text)).toEqual([ALICE_OPENING_SEEDED, ALICE_RABBIT_SEEDED]);
  });

  it('treats runs of blank lines, and CRLF breaks, as one break', () => {
    expect(chunkParagraphs('One.\n\n\n\nTwo.', 1).map((chunk) => chunk.text)).toEqual(['One.', 'Two.']);
    expect(chunkParagraphs('One.\r\n\r\nTwo.', 1).map((chunk) => chunk.text)).toEqual(['One.\r', 'Two.']);
  });

  it('leaves out chunks with no prose, such as a lone protected block', () => {
    const text = `Alice fell.\n\n${PROTECTED_PLACEHOLDER}\n\nShe landed.`;
    expect(chunkParagraphs(text, 2).map((chunk) => chunk.text)).toEqual(['Alice fell.', 'She landed.']);
    expect(chunkParagraphs('   \n\n  ', 100)).toEqual([]);
  });
});
