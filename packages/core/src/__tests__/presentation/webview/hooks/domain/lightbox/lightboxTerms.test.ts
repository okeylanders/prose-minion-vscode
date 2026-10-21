/**
 * The board's counted terms as items (Slice 4E): a hapax word and an
 * instance-counting style flag resolve to measured items with the host's
 * counts and places; a term is named, keyed and restored exactly as the host
 * names it; a paragraph pinned from a term keeps it, outside its identity.
 * Terms are words from Lewis Carroll's "Alice's Adventures in Wonderland"
 * (1865, public domain).
 */

import {
  isLightboxTermRef,
  lightboxTermKey,
  lightboxTermLabel,
  parseLightboxTermRef,
  resolveLightboxTerm
} from '@hooks/domain/lightbox/lightboxTerms';
import { lightboxItemKey, parseLightboxItemRef, resolveLightboxItem, sameLightboxItem } from '@hooks/domain/lightbox/lightboxItems';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';

describe('a hapax word as an item', () => {
  it('is used once, in its paragraph, written as the text writes it, with its counted form when that differs', () => {
    const board = makeBoard(6);
    expect(resolveLightboxTerm(board, { kind: 'hapax', word: 'daisychain' })).toEqual({
      ref: { kind: 'hapax', word: 'daisychain' },
      register: 'measured',
      where: 'Measure · Used once',
      title: 'daisy-chain',
      claim: 'Used once, in ¶3. Counted as “daisychain”: the stats row keeps letters and apostrophes only. Counted by code; nothing here is a reading.',
      paragraphs: [3],
      support: ['daisychain ×1', '4 words used once']
    });
    expect(resolveLightboxTerm(board, { kind: 'hapax', word: 'peeped' })?.claim)
      .toBe('Used once, in ¶2. Counted by code; nothing here is a reading.');
    expect(resolveLightboxTerm(board, { kind: 'hapax', word: 'alice' })).toBeUndefined();
  });
});

describe('a style flag as an item', () => {
  it('counts its instances across its paragraphs and states its detector\'s rule', () => {
    const item = resolveLightboxTerm(makeBoard(6), { kind: 'flag', flag: 'adverbs' });
    expect(item).toEqual({
      ref: { kind: 'flag', flag: 'adverbs' },
      register: 'measured',
      where: 'Measure · Style flag',
      title: 'Adverbs (-ly words)',
      claim: 'Appears 4 times across 2 paragraphs. Words ending in -ly, as whole words. A heuristic: “only” and “family” count too. ' +
        'Counted by code; nothing here is a reading.',
      paragraphs: [3, 5],
      support: ['Adverbs (-ly words) ×4', 'e.g. suddenly']
    });
    expect(resolveLightboxTerm(makeBoard(6), { kind: 'flag', flag: 'passive-voice' })).toBeUndefined();
  });
});

describe('naming terms', () => {
  it('labels each kind for a sentence', () => {
    const board = makeBoard(6);
    expect([
      lightboxTermLabel(board, { kind: 'word', word: 'alice' }),
      lightboxTermLabel(board, { kind: 'pos', pos: 'verbs', word: 'thought' }),
      lightboxTermLabel(board, { kind: 'phrase', phrase: 'thought alice' }),
      lightboxTermLabel(board, { kind: 'hapax', word: 'rabbithole' }),
      lightboxTermLabel(board, { kind: 'flag', flag: 'adverbs' })
    ]).toEqual(['“alice”', '“thought” (verb)', '“thought alice”', '“Rabbit-Hole”', 'Adverbs (-ly words)']);
  });

  it('keys and restores every kind, and nothing malformed', () => {
    const terms = [
      { kind: 'word', word: 'alice' },
      { kind: 'pos', pos: 'adverbs', word: 'n\'t' },
      { kind: 'phrase', phrase: 'i don\'t' },
      { kind: 'hapax', word: 'daisychain' },
      { kind: 'flag', flag: 'weak-verbs' }
    ] as const;
    expect(terms.map(lightboxTermKey)).toEqual(['word:alice', 'pos:adverbs:n\'t', 'phrase:i don\'t', 'hapax:daisychain', 'flag:weak-verbs']);
    for (const term of terms) {
      expect(isLightboxTermRef(term)).toBe(true);
      expect(parseLightboxTermRef(JSON.parse(JSON.stringify(term)))).toEqual(term);
    }
    for (const bad of [{ kind: 'hapax' }, { kind: 'flag', flag: 'clichés' }, { kind: 'pos', pos: 'pronouns', word: 'she' }, { kind: 'lane', lane: 'rhythm' }, null, 'word']) {
      expect(parseLightboxTermRef(bad)).toBeNull();
    }
  });
});

describe('a paragraph reached from a term', () => {
  it('keeps the term through a reload, and is the same paragraph whatever brought the writer there', () => {
    const viaWord = parseLightboxItemRef({ kind: 'paragraphs', from: 4, to: 4, via: { kind: 'word', word: 'alice' } });
    expect(viaWord).toEqual({ kind: 'paragraphs', from: 4, to: 4, via: { kind: 'word', word: 'alice' } });
    // A malformed term is dropped, not the paragraph.
    expect(parseLightboxItemRef({ kind: 'paragraphs', from: 4, to: 4, via: { kind: 'word' } })).toEqual({ kind: 'paragraphs', from: 4, to: 4 });
    expect(lightboxItemKey(viaWord!)).toBe('paragraphs:4-4');
    expect(sameLightboxItem(viaWord, { kind: 'paragraphs', from: 4, to: 4 })).toBe(true);
    expect(resolveLightboxItem(makeBoard(6), viaWord!)?.title).toBe('¶4');
  });

  it('restores hapax and flag pins', () => {
    expect(parseLightboxItemRef({ kind: 'hapax', word: 'tunnel' })).toEqual({ kind: 'hapax', word: 'tunnel' });
    expect(parseLightboxItemRef({ kind: 'flag', flag: 'filler-words' })).toEqual({ kind: 'flag', flag: 'filler-words' });
    expect(parseLightboxItemRef({ kind: 'flag', flag: 'repetitive-words' })).toBeNull();
  });
});
