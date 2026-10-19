/**
 * LightboxQuoteVerifier and the assembly's withholding (ADR 2026-10-19 D7):
 * a quote is checked against the one paragraph it names, exactly and then
 * folded; a claim with no found quote is withheld by title; counted support
 * is the host's.
 */
import { createLightboxQuoteVerifier, foldWithMap } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { buildLightboxUserMessage } from '@/infrastructure/lightbox/LightboxReadingPrompts';
import { frame, framedJson, readWorkedExample } from './lightboxReadingFixtures';
import type { LightboxLensId } from '@messages';
import { emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import { lightboxQuoteTally } from '@hooks/domain/lightbox/lightboxReadings';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';

const example = readWorkedExample('A');
const paragraphs = example.paragraphs;
const verifier = createLightboxQuoteVerifier(paragraphs);

/** A context file a writer might attach: it may inform readings, never anchor them. */
const CONTEXT_NOTE = 'Alice is seven. The White Rabbit is a royal herald who fears the Queen.';

describe('LightboxQuoteVerifier', () => {
  it('finds an exact quote and returns the chapter span', () => {
    expect(verifier.verify(5, 'down went Alice after it')).toEqual({
      found: true,
      paragraph: 5,
      text: 'down went Alice after it',
      match: 'exact'
    });
  });

  it('matches straight quotes and apostrophes against curly ones, returning the curly span', () => {
    expect(verifier.verify(4, '"Oh dear! Oh dear! I shall be late!"')).toEqual({
      found: true,
      paragraph: 4,
      text: '“Oh dear! Oh dear! I shall be late!”',
      match: 'normalized'
    });
    expect(verifier.verify(8, "How brave they'll all think me at home!")).toMatchObject({
      found: true,
      text: 'How brave they’ll all think me at home!',
      match: 'normalized'
    });
  });

  it('folds dashes, the spaces beside them, and runs of whitespace', () => {
    const chapter = createLightboxQuoteVerifier([
      'Let me see: that would be four thousand miles down, I think--',
      'The well was\n   very deep, and dark — darker than the cellar.'
    ]);
    expect(chapter.verify(1, 'four thousand miles down, I think—')).toMatchObject({
      found: true,
      text: 'four thousand miles down, I think--',
      match: 'normalized'
    });
    expect(chapter.verify(2, 'The well was very deep, and dark--darker than the cellar.')).toMatchObject({
      found: true,
      text: 'The well was\n   very deep, and dark — darker than the cellar.',
      match: 'normalized'
    });
  });

  it('applies NFKC, so an ellipsis character matches three dots', () => {
    const chapter = createLightboxQuoteVerifier(['She waited... and nothing came.']);
    expect(chapter.verify(1, 'She waited… and nothing came.')).toMatchObject({ found: true, match: 'normalized' });
  });

  it('preserves case', () => {
    expect(verifier.verify(4, 'took a watch out of its waistcoat-pocket')).toEqual({
      found: false,
      paragraph: 4,
      reason: 'not-in-chapter'
    });
  });

  it('fails a quote from the wrong paragraph and says where it stands', () => {
    expect(verifier.verify(6, 'In another moment down went Alice after it')).toEqual({
      found: false,
      paragraph: 6,
      reason: 'not-in-paragraph',
      foundIn: [5]
    });
  });

  it('fails an undeclared paragraph number, even when the words are in the chapter', () => {
    expect(verifier.verify(9, 'In another moment down went Alice after it')).toEqual({
      found: false,
      paragraph: 9,
      reason: 'undeclared-paragraph',
      foundIn: [5]
    });
    expect(verifier.verify(0, 'down went Alice')).toMatchObject({ found: false, reason: 'undeclared-paragraph' });
  });

  it('fails a quote taken from a context file: only the chapter is searched', () => {
    expect(buildLightboxUserMessage(
      { paragraphs, columns: [], context: [{ displayPath: 'Notes/cast.md', text: CONTEXT_NOTE }] },
      { group: 'A', lenses: ['headline'] }
    ).message).toContain(CONTEXT_NOTE);
    expect(verifier.verify(3, 'The White Rabbit is a royal herald')).toEqual({
      found: false,
      paragraph: 3,
      reason: 'not-in-chapter'
    });
  });

  it('fails a paraphrase', () => {
    expect(verifier.verify(6, 'she found herself tumbling down a deep well')).toMatchObject({
      found: false,
      reason: 'not-in-chapter'
    });
  });

  it('fails a quote too short to anchor anything', () => {
    expect(verifier.verify(5, 'it')).toEqual({ found: false, paragraph: 5, reason: 'too-short' });
    expect(verifier.verify(5, ' — ')).toMatchObject({ reason: 'too-short' });
  });

  it('keeps the chapter\'s own quotation marks, and tolerates marks the chapter lacks', () => {
    expect(verifier.verify(6, '"she found herself falling down a very deep well"')).toMatchObject({
      found: true,
      text: 'she found herself falling down a very deep well',
      match: 'normalized'
    });
  });

  it('maps every folded character back into the original text', () => {
    const text = 'a  “quote” —  end…';
    const folded = foldWithMap(text);
    expect(folded.folded).toBe('a "quote"-end...');
    expect(folded.starts).toHaveLength(folded.folded.length);
    expect(text.slice(folded.starts[2], folded.ends[8])).toBe('“quote”');
  });
});

describe('the fold\'s span map (PR #149 F-01)', () => {
  /** The forms a quote can match under: folded, and folded without its own wrapping marks. */
  const formsOf = (quote: string): string[] => {
    const folded = foldWithMap(quote.trim()).folded;
    const wrapped = folded.length > 2 && folded.startsWith('"') && folded.endsWith('"');
    return wrapped ? [folded, folded.slice(1, -1).trim()] : [folded];
  };

  /** Found as `expected`, and the span the writer is shown folds back to a form the quote matched under. */
  const expectSpan = (paragraph: string, quote: string, expected: string): void => {
    const verdict = createLightboxQuoteVerifier([paragraph]).verify(1, quote);
    expect(verdict).toEqual({ found: true, paragraph: 1, text: expected, match: 'normalized' });
    expect(paragraph).toContain(expected);
    expect(formsOf(quote)).toContain(foldWithMap(expected).folded);
  };

  it('keeps a span right after supplementary characters (the review\'s witness)', () => {
    expectSpan('😀😀😀😀 “Alice waited” today.', '"Alice waited"', '“Alice waited”');
    expectSpan('𝒜 𝒜 𝒜 “Alice waited” today.', '"Alice waited" today', '“Alice waited” today');
  });

  it('keeps a span with supplementary characters inside the match', () => {
    expectSpan('“Look 😀 here,” said Alice, and waited.', '"Look 😀 here," said Alice', '“Look 😀 here,” said Alice');
    // NFKC folds the mathematical script capital to A, inside a surrogate pair.
    expectSpan('Then 𝒜lice waited by the door.', 'Alice waited by the door', '𝒜lice waited by the door');
    expectSpan('😀 Then 𝒜lice — at last — waited.', 'Alice--at last--waited', '𝒜lice — at last — waited');
  });

  it('matches Hangul by whole-string NFKC equivalence, jamo and syllables either way', () => {
    const jamo = 'The 가 house waited.';
    const syllable = 'The 가 house waited.';
    expectSpan(jamo, syllable, jamo);
    expectSpan(syllable, jamo, syllable);
    // Compatibility jamo compose too, once NFKC maps them to conjoining ones.
    expectSpan('The ㄱㅏ house waited.', syllable, 'The ㄱㅏ house waited.');
    // Half a syllable is not a quote of the syllable.
    expect(createLightboxQuoteVerifier([jamo]).verify(1, 'The ᄀ house')).toMatchObject({
      found: false,
      reason: 'not-in-chapter'
    });
  });

  it('expands ligatures, and never returns half of one', () => {
    expectSpan('The ﬁnal ﬂight left at dawn.', 'The final flight', 'The ﬁnal ﬂight');
    expectSpan('Lost in the ﬁnal ﬂight.', 'final flight.', 'ﬁnal ﬂight.');
    expect(createLightboxQuoteVerifier(['The ﬁnal ﬂight left.']).verify(1, 'inal flight')).toMatchObject({
      found: false,
      reason: 'not-in-chapter'
    });
  });

  it('composes combining marks, and never cuts a letter from its accent', () => {
    const decomposed = 'A café au lait, at last.';
    expectSpan(decomposed, 'café au lait', 'café au lait');
    expectSpan('A café au lait, at last.', 'café au lait', 'café au lait');
    // "cafe" stands in the code units, but the chapter says "café": neither an exact nor a folded match.
    expect(createLightboxQuoteVerifier([decomposed]).verify(1, 'A cafe')).toMatchObject({ found: false, reason: 'not-in-chapter' });
    expect(createLightboxQuoteVerifier([decomposed]).verify(1, 'A café')).toMatchObject({ found: true, match: 'exact' });
  });

  it('folds repeated dashes and the spaces around them into one, spanning the whole run', () => {
    expectSpan('“No——never,” she said.', '"No—never," she said', '“No——never,” she said');
    expectSpan('wait - - - and then', 'wait—and then', 'wait - - - and then');
    expectSpan('😀 so -- and so —— on', 'so - and so - on', 'so -- and so —— on');
  });

  it('maps every folded code unit, so a supplementary character takes two entries', () => {
    const folded = foldWithMap('😀 “Alice”');
    expect(folded.folded).toBe('😀 "Alice"');
    expect(folded.starts).toHaveLength(folded.folded.length);
    expect(folded.starts.slice(0, 2)).toEqual([0, 0]);
    expect(folded.ends.slice(0, 2)).toEqual([2, 2]);
    expect(folded.starts[3]).toBe(3);
  });
});

describe('whole-string NFKC equivalence across several segments (PR #149 F-09)', () => {
  // A letter, two halfwidth sound marks and a dot below: NFKC composes the A with the dot past both marks.
  const SOURCE = 'Alice A\uFF9E\uFF9F\u0323 waited.';

  it('finds the whole paragraph quoted in its NFKC form (the review\'s case)', () => {
    expect(SOURCE.normalize('NFKC')).toBe('Alice \u1EA0\u3099\u309A waited.');
    expect(createLightboxQuoteVerifier([SOURCE]).verify(1, SOURCE.normalize('NFKC'))).toEqual({
      found: true, paragraph: 1, text: SOURCE, match: 'normalized'
    });
  });

  it('keeps such a run whole: a quote may span it, never cut into it', () => {
    const verifier = createLightboxQuoteVerifier([SOURCE]);
    expect(verifier.verify(1, '\u1EA0\u3099\u309A waited')).toEqual({
      found: true, paragraph: 1, text: 'A\uFF9E\uFF9F\u0323 waited', match: 'normalized'
    });
    expect(verifier.verify(1, '\u3099\u309A waited.')).toMatchObject({ found: false, reason: 'not-in-chapter' });
  });

  it('folds every text exactly as its NFKC form folds, and finds that form in it', () => {
    // A deterministic sample over characters that compose, decompose, reorder or expand under NFKC.
    const alphabet = [
      'A', 'e', 'a', ' ', '\u0301', '\u0323', '\u0308', '\u0327', '\uFF76', '\uFF9E', '\uFF9F', '\u3099', '\u30AB',
      '\u1100', '\u1161', '\u11A8', '\u3131', '\u314F', '\uAC00', '\uFB01', '\u2014', '-', '\u{1F600}', '\u{1D49C}',
      '\u00A8', '\u0F73', '\u0B47', '\u0B3E', '\u09C7', '\u09BE', '\u2026', '\u201C', '\u2019',
      // Weighted toward letters, halfwidth sound marks and marks that compose past them.
      'A', 'A', 'o', 'u', '\uFF9E', '\uFF9E', '\uFF9F', '\u0323', '\u0323', '\u0301'
    ];
    let seed = 149;
    const next = (): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed;
    };
    for (let sample = 0; sample < 3_000; sample++) {
      const length = 1 + (next() % 12);
      const body = Array.from({ length }, () => alphabet[next() % alphabet.length]).join('');
      const text = `Alice ${body} waited.`;
      const normalized = text.normalize('NFKC');
      expect(foldWithMap(text).folded).toBe(foldWithMap(normalized).folded);
      const verdict = createLightboxQuoteVerifier([text]).verify(1, normalized);
      expect(verdict).toMatchObject({ found: true, text });
    }
  });
});

describe('assembling tiles from a group (D7)', () => {
  const contextA = { group: 'A' as const, lenses: example.lenses, columnCount: 8 };

  function assemble(response: string) {
    let id = 0;
    return assembleLightboxGroup(decodeLightboxGroup(response, contextA), {
      verifier,
      counter: createLightboxTermCounter(paragraphs),
      mintId: () => `t${++id}`
    });
  }

  it('keeps a claim with one failed quote and shows the failure as withheld, without its text', () => {
    const broken = framedJson(example.response) as Record<string, any>;
    broken.motifs.items[0].evidence[1].quote = 'and then it dropped straight down';
    const assembled = assemble(frame('A', broken));
    const going = assembled.tiles.find((tile) => tile.title === 'Going down');
    expect(going?.evidence.map((quote) => quote.paragraph)).toEqual([5, 8]);
    expect(going?.withheldQuotes).toEqual([{ paragraph: 6, reason: 'not-in-chapter' }]);
    expect(JSON.stringify(going)).not.toContain('dropped straight down');
    expect(assembled.quotesWithheld).toBe(1);
  });

  it('withholds a claim with no found quote by its title', () => {
    const broken = framedJson(example.response) as Record<string, any>;
    broken.headline.evidence = [{ para: 2, quote: 'she ran across the field after it' }];
    const assembled = assemble(frame('A', broken));
    expect(assembled.tiles.some((tile) => tile.kind === 'headline')).toBe(false);
    expect(assembled.withheldClaims).toEqual([{
      kind: 'headline',
      lens: 'headline',
      title: 'A bored girl follows a hurried white rabbit down a hole and keeps on falling.',
      reason: 'No quote it gave was found in the paragraph it named.',
      quotes: [{ paragraph: 2, reason: 'not-in-paragraph', foundIn: [4] }]
    }]);
  });

  it('withholds a motif whose found quotes stand in only one paragraph', () => {
    const broken = framedJson(example.response) as Record<string, any>;
    broken.motifs.items[1].evidence[1] = { para: 2, quote: 'pictures or conversation?' };
    const assembled = assemble(frame('A', broken));
    expect(assembled.withheldClaims).toEqual([expect.objectContaining({
      title: 'Pictures and conversations',
      reason: 'A motif recurs, but its quotes were found in only one paragraph.'
    })]);
  });

  it('counts every quote it checked per lens, including a withheld motif\'s found ones (PR #149 F-07)', () => {
    const broken = framedJson(example.response) as Record<string, any>;
    // One found headline quote, and a motif whose two found quotes stand in one paragraph.
    broken.headline.evidence = [{ para: 5, quote: 'down went Alice after it' }];
    broken.motifs.items = [{ ...broken.motifs.items[0], evidence: [
      { para: 5, quote: 'down went Alice after it' },
      { para: 5, quote: 'never once considering how in the world she was to get out again' }
    ] }];
    const decoded = decodeLightboxGroup(frame('A', broken), { ...contextA, lenses: ['headline', 'motif'] });
    let id = 0;
    const assembled = assembleLightboxGroup(decoded, {
      verifier,
      counter: createLightboxTermCounter(paragraphs),
      mintId: () => `t${++id}`
    });
    expect(assembled.withheldClaims.map((claim) => claim.reason)).toEqual(['A motif recurs, but its quotes were found in only one paragraph.']);
    expect(assembled.quotesChecked).toBe(3);
    expect(assembled.quoteChecks).toEqual([
      { lens: 'headline', checked: 1, withheld: 0 },
      { lens: 'motif', checked: 2, withheld: 0 }
    ]);
    const board = {
      ...makeBoard(8),
      readings: [{ ...emptyLightboxReadingGroup('A'), status: 'ok' as const, lenses: ['headline', 'motif'] as LightboxLensId[], ...assembled }]
    };
    expect(lightboxQuoteTally(board)).toMatchObject({ checked: 3, withheld: 0, claimsWithheld: 1 });
  });

  it('counts named terms on the host, with the paragraphs they stand in, and mints ids in order', () => {
    const assembled = assemble(example.response);
    expect(assembled.tiles.map((tile) => tile.id)).toEqual(['t1', 't2', 't3', 't4', 't5']);
    const going = assembled.tiles.find((tile) => tile.title === 'Going down');
    // The heading's "Down" counts too: a heading is a paragraph (D4).
    expect(going?.support).toEqual([{ term: 'down', count: 9, paragraphs: [1, 4, 5, 6, 7, 8] }]);
    // A tile's paragraphs are its found quotes' and its counted terms' paragraphs.
    expect(going?.paragraphs).toEqual([1, 4, 5, 6, 7, 8]);
    const headline = assembled.tiles[0];
    expect(headline.support.map((term) => [term.term, term.count])).toEqual([
      ['rabbit', 4],
      ['rabbit-hole', 3],
      ['fall', 1]
    ]);
  });

  it('counts a multi-word name and skips a pronoun alias', () => {
    const counter = createLightboxTermCounter(paragraphs);
    expect(counter.count('White Rabbit')).toEqual({ term: 'white rabbit', count: 1, paragraphs: [3] });
    expect(counter.count('they’ll')).toEqual({ term: "they'll", count: 1, paragraphs: [8] });
    expect(counter.isStopword('She')).toBe(true);
    expect(counter.count('Cheshire Cat')).toEqual({ term: 'cheshire cat', count: 0, paragraphs: [] });
  });
});
