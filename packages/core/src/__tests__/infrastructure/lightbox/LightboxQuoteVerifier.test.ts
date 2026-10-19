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
