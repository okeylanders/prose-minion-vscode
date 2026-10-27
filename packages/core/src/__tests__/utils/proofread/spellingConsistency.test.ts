/**
 * Consistency (Draft Edit Slice 3b, part 3): a word one document spells two
 * ways, found by host code from a closed table, the less used spelling
 * flagged unless a convention decides. Text adapts public-domain *Alice*.
 */
import { findInconsistentSpellings } from '@/utils/proofread/spellingConsistency';
import { VARIANT_SPELLINGS } from '@/utils/proofread/variantSpellings';
import { PROOFREAD_SPELLING_CONVENTIONS } from '@/domain/models/DraftEdit';
import { proofreadWordKey, proofreadWordListKeys } from '@/utils/proofread/proofreadWordList';

const NONE = new Set<string>();
const flagged = (text: string, options: { accepted?: ReadonlySet<string>; skipped?: { start: number; end: number }[]; convention?: 'american' | 'british' | 'canadian' | 'australian' } = {}) =>
  findInconsistentSpellings(text, options.skipped ?? [], options.accepted ?? NONE, options.convention)
    .map((use) => ({ text: text.slice(use.start, use.end), original: use.original, replacement: use.replacement }));

describe('findInconsistentSpellings', () => {
  it('flags every use of the less used spelling, with the same inflection of the other, and says the counts', () => {
    const text = 'The grey cat sat on the grey wall. A gray dawn came, and the sky was greying.';
    const found = findInconsistentSpellings(text, [], NONE);

    expect(found).toEqual([{
      start: text.indexOf('gray'),
      end: text.indexOf('gray') + 4,
      original: 'gray',
      replacement: 'grey',
      spelling: 'gray',
      otherSpelling: 'grey',
      uses: 1,
      otherUses: 3
    }]);
  });

  it('counts every inflection of a spelling together, and replaces each with its own inflection', () => {
    const text = 'Her neighbours were kind. One neighbour waved. The neighboring house was dark.';
    expect(flagged(text)).toEqual([{ text: 'neighboring', original: 'neighboring', replacement: 'neighbouring' }]);
  });

  it('flags nothing for a tie, or a word spelled one way', () => {
    expect(flagged('She walked toward the door, then towards the window.')).toEqual([]);
    expect(flagged('She walked toward the door, then toward the window.')).toEqual([]);
  });

  it('lets a named convention decide whatever the counts, and falls back to them where it takes either', () => {
    const text = 'The color of the roses, the color of the paint, the colour of the sky.';
    expect(flagged(text, { convention: 'british' }).map((use) => use.original)).toEqual(['color', 'color']);
    expect(flagged(text, { convention: 'american' }).map((use) => use.original)).toEqual(['colour']);
    expect(flagged(text).map((use) => use.original)).toEqual(['colour']);

    const realise = 'Alice began to realise it, and realised more, then realized all.';
    // British takes -ize or -ise: the counts decide, and the finding names no convention.
    const british = findInconsistentSpellings(realise, [], NONE, 'british');
    expect(british.map((use) => use.original)).toEqual(['realized']);
    expect(british[0]).not.toHaveProperty('convention');
    expect(findInconsistentSpellings(realise, [], NONE, 'american').map((use) => [use.original, use.convention]))
      .toEqual([['realise', 'american'], ['realised', 'american']]);
  });

  it('never reads a capitalized word mid-sentence, which is a name, and reads one at a sentence\'s start', () => {
    expect(flagged('Mr Gray walked into the grey room, past the grey dog.')).toEqual([]);
    expect(flagged('The Labour vote was counted. Her labor was long, and her labor was hard.')).toEqual([]);
    const start = 'Gray light came in. The grey sky, the grey sea.';
    expect(flagged(start)).toEqual([{ text: 'Gray', original: 'Gray', replacement: 'Grey' }]);
  });

  it('keeps the case each use is written in', () => {
    const ok = 'It was okay. It was okay. Ok, she thought. It was OK, and it was OKAY.';
    expect(flagged(ok)).toEqual([
      { text: 'Ok', original: 'Ok', replacement: 'Okay' },
      { text: 'OK', original: 'OK', replacement: 'okay' }
    ]);
    const okay = 'It was OK. It was OK. It was OK. Okay, she thought, and it was OKAY.';
    expect(flagged(okay)).toEqual([
      { text: 'Okay', original: 'Okay', replacement: 'OK' },
      { text: 'OKAY', original: 'OKAY', replacement: 'OK' }
    ]);
    expect(flagged('GREY skies. The gray sky, the gray sea.')).toEqual([{ text: 'GREY', original: 'GREY', replacement: 'GRAY' }]);
  });

  it('does not read a word capitalized only after its first letter: the stated limit', () => {
    expect(flagged('The grey sky, the grey sea, and a gRAY dawn.')).toEqual([]);
  });

  it('reads "all right" as two words with only spaces between them, never across a line', () => {
    expect(flagged('It was all right. It was all right, she said. It was alright.'))
      .toEqual([{ text: 'alright', original: 'alright', replacement: 'all right' }]);
    expect(flagged('All right, she said. It was alright. It was alright.'))
      .toEqual([{ text: 'All right', original: 'All right', replacement: 'Alright' }]);
    // Read across the line, "all right" would be the less used spelling, and flagged.
    expect(flagged('It was all\nright. It was alright. It was alright.')).toEqual([]);
    expect(flagged('They were all right-handed. It was alright.')).toEqual([]);
  });

  it('reads a hyphenated word whole, then part by part, and a possessive as its word', () => {
    const text = 'A grey-green light. The grey sea. A gray sky.';
    expect(flagged(text)).toEqual([{ text: 'gray', original: 'gray', replacement: 'grey' }]);
    const compound = 'A gray-green light. The grey sea. The grey sky.';
    expect(flagged(compound)).toEqual([{ text: 'gray', original: 'gray', replacement: 'grey' }]);
    expect(findInconsistentSpellings(compound, [], NONE)[0].start).toBe(compound.indexOf('gray'));
    expect(flagged('She sent an e-mail. She sent an email, then two emails.'))
      .toEqual([{ text: 'e-mail', original: 'e-mail', replacement: 'email' }]);
    expect(flagged('Her neighbour\'s cat. Her neighbour\'s dog. Her neighbor\'s bird.'))
      .toEqual([{ text: 'neighbor', original: 'neighbor', replacement: 'neighbour' }]);
  });

  it('never reads a word in a skipped region', () => {
    const text = 'The grey sea, and `color = gray` in the code, and the grey sky.';
    const code = { start: text.indexOf('`'), end: text.lastIndexOf('`') + 1 };
    expect(flagged(text, { skipped: [code] })).toEqual([]);
    expect(flagged(text)).toEqual([{ text: 'gray', original: 'gray', replacement: 'grey' }]);
  });

  it('counts a word the writer accepts, but never flags it', () => {
    const accepted = proofreadWordListKeys(['alright']);
    expect(flagged('It was all right. It was all right. It was alright.', { accepted })).toEqual([]);
    expect(flagged('It was alright. It was alright. It was all right.', { accepted }))
      .toEqual([{ text: 'all right', original: 'all right', replacement: 'alright' }]);
  });

  it('never pairs "analyzes" with "analyses", the plural of "analysis" in every convention', () => {
    expect(flagged('She analyzes the evidence, and the analyses agree.', { convention: 'american' })).toEqual([]);
  });
});

describe('VARIANT_SPELLINGS', () => {
  const forms = VARIANT_SPELLINGS.flatMap((variant) => variant.forms.flat());

  it('lists each form once, by key, so a word belongs to one spelling of one word', () => {
    const keys = forms.map(proofreadWordKey);
    expect(keys.filter((key, index) => keys.indexOf(key) !== index)).toEqual([]);
  });

  it('pairs two different spellings in each inflection, each of one or two words', () => {
    for (const variant of VARIANT_SPELLINGS) {
      expect(variant.forms.length).toBeGreaterThan(0);
      for (const [first, second] of variant.forms) {
        expect(proofreadWordKey(first)).not.toBe(proofreadWordKey(second));
        expect([first, second].every((form) => form.trim() === form && form.split(' ').length <= 2)).toBe(true);
      }
    }
  });

  it('writes every form in ASCII letters and hyphens, two words at most, so a word\'s lower case is its key', () => {
    for (const form of forms) {
      expect(form).toMatch(/^[A-Za-z]+(?:-[A-Za-z]+)*(?: [A-Za-z]+)?$/);
      expect(proofreadWordKey(form)).toBe(form.toLowerCase());
    }
  });

  it('names only known conventions, each preferring one side', () => {
    for (const variant of VARIANT_SPELLINGS) {
      for (const [convention, side] of Object.entries(variant.preferred ?? {})) {
        expect(PROOFREAD_SPELLING_CONVENTIONS).toContain(convention);
        expect([0, 1]).toContain(side);
      }
    }
  });
});
