/**
 * Anchoring (ADR 2026-10-21 D2): the host finds a quoted span exactly, falls
 * back to a normalized match mapped to the exact source span, and refuses to
 * guess among repeats. Fixtures are public domain.
 */
import { anchorQuote, normalizeForMatching } from '@/utils/draftEdit/anchorEdits';
import { ALICE_OPENING_SEEDED, ALICE_RABBIT_SEEDED } from '@/__tests__/utils/draftEdit/proofreadFixtures';

const placed = (text: string, result: ReturnType<typeof anchorQuote>) =>
  result.kind === 'anchored' ? text.slice(result.start, result.end) : result.kind;

describe('anchorQuote', () => {
  it('places a unique quote exactly', () => {
    const result = anchorQuote(ALICE_OPENING_SEEDED, { quote: 'weather' });
    expect(placed(ALICE_OPENING_SEEDED, result)).toBe('weather');
    expect(result).toMatchObject({ start: ALICE_OPENING_SEEDED.indexOf('weather') });
  });

  it('uses context to choose among repeats', () => {
    const text = ALICE_RABBIT_SEEDED;
    expect(anchorQuote(text, { quote: 'the' })).toEqual({ kind: 'ambiguous' });
    const result = anchorQuote(text, { quote: 'the the', before: 'out of ', after: ' way' });
    expect(placed(text, result)).toBe('the the');
  });

  it('joins context to the quote with or without the separating space the model dropped', () => {
    const text = 'Oh dear! Oh dear! I shall be late!';
    // "dear" repeats, so only the context can place it, and the model left out the spaces.
    const result = anchorQuote(text, { quote: 'dear', before: 'Oh dear! Oh', after: '! I shall' });
    expect(result).toMatchObject({ kind: 'anchored', start: text.lastIndexOf('dear') });
    expect(placed(text, anchorQuote(text, { quote: 'dear', before: 'Oh dear! Oh ', after: '! I shall' }))).toBe('dear');
  });

  it('places the worked example\'s context exactly as the prompt asks for it', () => {
    const result = anchorQuote(ALICE_OPENING_SEEDED, {
      quote: 'weather', before: 'very sleepy and stupid),', after: 'the pleasure of making'
    });
    expect(result).toMatchObject({ kind: 'anchored', start: ALICE_OPENING_SEEDED.indexOf('weather') });
  });

  it('narrows to a shorter form when the model misquotes its context', () => {
    const result = anchorQuote(ALICE_OPENING_SEEDED, { quote: 'weather', before: 'NOT IN THE TEXT ' });
    expect(placed(ALICE_OPENING_SEEDED, result)).toBe('weather');
  });

  it('fails closed when even the full context matches more than once', () => {
    const text = 'Oh dear! Oh dear! Oh dear!';
    expect(anchorQuote(text, { quote: 'dear', before: 'Oh ', after: '!' })).toEqual({ kind: 'ambiguous' });
  });

  it('reports a quote that is not in the text, or is empty', () => {
    expect(anchorQuote(ALICE_OPENING_SEEDED, { quote: 'Cheshire' })).toEqual({ kind: 'unanchored' });
    expect(anchorQuote(ALICE_OPENING_SEEDED, { quote: '' })).toEqual({ kind: 'unanchored' });
  });

  it('matches straight quotes against curly ones, and maps back to the exact curly span', () => {
    const result = anchorQuote(ALICE_OPENING_SEEDED, { quote: 'thought Alice "without' });
    expect(placed(ALICE_OPENING_SEEDED, result)).toBe('thought Alice “without');
  });

  it('matches across NBSP, collapsed whitespace, and line breaks', () => {
    const text = 'the hot   day\nmade her feel';
    expect(placed(text, anchorQuote(text, { quote: 'the hot day made' }))).toBe('the hot   day\nmade');
  });

  it('matches three periods against an ellipsis character', () => {
    const text = 'She waited… and waited.';
    expect(placed(text, anchorQuote(text, { quote: 'waited... and' }))).toBe('waited… and');
  });

  it.each([
    ['ends inside the ellipsis', 'Wait.'],
    ['starts inside the ellipsis', '. Then'],
    ['takes in only part of it', 'Wait.. Then']
  ])('never anchors a match that %s, so an edit never replaces more than was quoted', (_name, quote) => {
    expect(anchorQuote('Wait… Then she ran.', { quote })).toEqual({ kind: 'unanchored' });
  });

  it('anchors a match that takes in the whole ellipsis, from either side', () => {
    const text = 'Wait… Then she ran.';
    expect(placed(text, anchorQuote(text, { quote: 'Wait...' }))).toBe('Wait…');
    expect(placed(text, anchorQuote(text, { quote: '... Then' }))).toBe('… Then');
  });

  it('never matches a quote that normalizes to whitespace', () => {
    expect(anchorQuote('a  b', { quote: ' ' })).toEqual({ kind: 'unanchored' });
  });
});

describe('normalizeForMatching', () => {
  it('folds quotes, spaces, and ellipses, keeping a map to source indices', () => {
    const normalized = normalizeForMatching('“A”  b…');
    expect(normalized.text).toBe('"A" b...');
    expect(normalized.sourceStart).toEqual([0, 1, 2, 3, 5, 6, 6, 6]);
    expect(normalized.sourceEnd).toEqual([1, 2, 3, 5, 6, 7, 7, 7]);
  });
});
