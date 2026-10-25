/**
 * Where a counted term stands in a paragraph (PR #155 F-03): the term
 * counter's own tokens, each with the source span it was read from, so a
 * quote's span can be checked for a whole occurrence. The spans agree with
 * the counter, occurrence for occurrence. Synthetic sentences written for
 * these tests, and a line of "Alice's Adventures in Wonderland" (1865,
 * public domain).
 */
import { createLightboxTermCounter, lightboxTermSpans, lightboxTermTokens } from '@/infrastructure/lightbox/LightboxTermCounts';

const slices = (text: string, term: string) => lightboxTermSpans(text, term).map(({ start, end }) => text.slice(start, end));

describe('lightboxTermSpans', () => {
  it('finds whole occurrences only, spanning just the characters the tokenizer keeps', () => {
    expect(slices('We watched every bright window.', 'very')).toEqual([]);
    expect(slices('We watched every bright window.', 'every bright')).toEqual(['every bright']);
    expect(slices('We watched every bright window.', 'window')).toEqual(['window']);
    expect(slices('It was the Queen’s very own window.', 'queen\'s very')).toEqual(['Queen’s very']);
    expect(slices('Down the rabbit-hole, then—down again.', 'rabbit-hole')).toEqual(['rabbit-hole']);
    expect(slices('Down the rabbit-hole, then—down again.', 'then down')).toEqual(['then—down']);
    expect(slices('“Oh dear! Oh dear! I shall be late!”', 'oh dear')).toEqual(['Oh dear', 'Oh dear']);
    expect(slices('\'Tis late, she said.', 'tis')).toEqual(['Tis']);
  });

  it('agrees with the counter on every token of a paragraph', () => {
    const paragraphs = [
      'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do.',
      '“Oh dear! Oh dear! I shall be late!” — the Rabbit’s watch, the rabbit-hole, ’twas so.',
      'Every bright window; a very bright window... very, very!'
    ];
    for (const text of paragraphs) {
      const counter = createLightboxTermCounter([text]);
      for (const token of new Set(lightboxTermTokens(text))) {
        expect({ token, spans: lightboxTermSpans(text, token).length }).toEqual({ token, spans: counter.count(token).count });
      }
    }
  });
});
