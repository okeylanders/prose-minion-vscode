/**
 * Name consistency (Draft Edit Slice 3b, part 2; ADR 2026-10-21, Amendment
 * 2026-10-26): a rare spelling of a common name, found over the whole
 * document by host code. Names are public-domain *Alice*'s, with seeded
 * misspellings.
 */
import { NAME_CONSISTENCY, findNameVariants, type NameVariantsResult } from '@/utils/proofread/nameConsistency';
import { proofreadWordListKeys } from '@/utils/proofread/proofreadWordList';

/** `count` sentences, each naming `name` mid-sentence. */
const mentions = (name: string, count: number) =>
  Array.from({ length: count }, () => `Then, after a while, ${name} looked about her.`).join(' ');
const NONE: ReadonlySet<string> = new Set();
const checked = (result: NameVariantsResult) => {
  expect(result.kind).toBe('checked');
  return result.kind === 'checked' ? result.variants : [];
};
const variants = (text: string, accepted = NONE) =>
  checked(findNameVariants(text, [], accepted)).map(({ start, end, ...rest }) => ({ text: text.slice(start, end), ...rest }));

describe('findNameVariants', () => {
  it('flags each use of a name used once beside one used three times as often, with the common name', () => {
    const text = `${mentions('Alice', 3)} So the Rabbit hurried on, and Alcie went after it.`;
    expect(variants(text)).toEqual([{ text: 'Alcie', variant: 'Alcie', name: 'Alice', variantUses: 1, nameUses: 3 }]);
  });

  it('needs the common name three times as often: a variant used once beside two uses is left alone', () => {
    expect(variants(`${mentions('Alice', 2)} So the Rabbit hurried on, and Alcie went after it.`)).toEqual([]);
  });

  it('flags a variant used twice only beside six uses, and never one used three times', () => {
    const twice = 'So the Rabbit hurried on, and Alcie went after it. It was late, and Alcie ran.';
    expect(variants(`${mentions('Alice', 5)} ${twice}`)).toEqual([]);
    expect(variants(`${mentions('Alice', 6)} ${twice}`).map((variant) => variant.text)).toEqual(['Alcie', 'Alcie']);
    expect(NAME_CONSISTENCY.rareUses).toBe(2);
    expect(variants(`${mentions('Alice', 20)} ${twice} Again, Alcie ran.`)).toEqual([]);
  });

  it('gives every use of every variant in the document\'s order', () => {
    const text = `${mentions('Alice', 6)} ${mentions('Dinah', 3)} So, at last, Alcie ran; then, by and by, Dinha woke, and Alcie sat.`;
    expect(variants(text).map((variant) => variant.text)).toEqual(['Alcie', 'Dinha', 'Alcie']);
  });

  it('sets a possessive aside: the flag covers the name, not its "\'s"', () => {
    expect(variants(`${mentions('Alice', 3)} It was not, after all, Alcie’s fault.`)).toEqual([
      { text: 'Alcie', variant: 'Alcie', name: 'Alice', variantUses: 1, nameUses: 3 }
    ]);
  });

  it('counts a swap of neighbouring letters as one edit, and allows one edit up to six letters', () => {
    expect(variants(`${mentions('Dinah', 3)} She thought of Dinha at tea-time.`).map((variant) => variant.name)).toEqual(['Dinah']);
    expect(variants(`${mentions('Dinah', 3)} She thought of Donha at tea-time.`)).toEqual([]);
  });

  it('allows two edits from seven letters, never three', () => {
    expect(variants(`${mentions('Caterpillar', 3)} At last the Catterpilar spoke.`).map((variant) => variant.name)).toEqual(['Caterpillar']);
    expect(variants(`${mentions('Caterpillar', 3)} At last the Cetarpiller spoke.`)).toEqual([]);
  });

  it('needs the same first letter', () => {
    expect(variants(`${mentions('Alice', 3)} So the Rabbit hurried on, and Elice went after it.`)).toEqual([]);
  });

  it('never reads a month, a day or an honorific as a name', () => {
    expect(variants(`${mentions('Mary', 3)} It was cold in May that year.`)).toEqual([]);
    expect(variants(`${mentions('Mrs', 3)} She called on Mr Brown.`)).toEqual([]);
  });

  it('leaves a variant the document also writes in lower case: a word, not a misspelled name', () => {
    const variant = 'He paid with a Dinar at the gate.';
    expect(variants(`${mentions('Dinah', 3)} ${variant}`).map((each) => each.text)).toEqual(['Dinar']);
    expect(variants(`${mentions('Dinah', 3)} ${variant} A dinar was a coin.`)).toEqual([]);
  });

  it('leaves a plural of the common name', () => {
    expect(variants(`${mentions('Rabbit', 3)} She thought of all the Rabbits she knew.`)).toEqual([]);
  });

  it.each([
    ['an opening quotation mark', ' “Alcie,” said the Rabbit.'],
    ['a sentence\'s end', ' Alcie was not there.'],
    ['a colon', ' There was one thing: Alcie.'],
    ['a line break', '\nAlcie ran.']
  ])('reads no name from a use after %s, and does once the same word is also used mid-sentence', (_where, use) => {
    expect(variants(`${mentions('Alice', 6)}${use}`)).toEqual([]);
    expect(variants(`${mentions('Alice', 6)}${use} It was, of course, Alcie.`).map((variant) => variant.text)).toEqual(['Alcie', 'Alcie']);
  });

  it('never flags a word the writer\'s list accepts, in any case', () => {
    const text = `${mentions('Alice', 3)} So the Rabbit hurried on, and Alcie went after it.`;
    expect(variants(text, proofreadWordListKeys(['alcie']))).toEqual([]);
  });

  it('accepts a hyphenated name by the word list\'s own rule: every part listed (PR #176 N-01)', () => {
    const text = 'I saw Glimmer-fix and Glimmer-fix and Glimmer-fix. Then, at last, I saw Glimmer-fox.';
    expect(variants(text).map((variant) => [variant.variant, variant.name])).toEqual([['Glimmer-fox', 'Glimmer-fix']]);
    expect(variants(text, proofreadWordListKeys(['Glimmer', 'fox']))).toEqual([]);
    expect(variants(text, proofreadWordListKeys(['Glimmer']))).toHaveLength(1);
  });

  it('reads nothing inside a region the caller skips (its protected regions and headings)', () => {
    const fenced = `${mentions('Alice', 3)} So she ran, and Alcie followed.`;
    const start = fenced.indexOf('and Alcie');
    expect(checked(findNameVariants(fenced, [{ start, end: start + 'and Alcie'.length }], NONE))).toEqual([]);
    expect(variants(fenced).map((variant) => variant.text)).toEqual(['Alcie']);
  });

  it('offers none when two names tie as the most used, and the more used one otherwise', () => {
    const variant = 'She thought of Dinab at tea-time.';
    expect(variants(`${mentions('Dinah', 3)} ${mentions('Dinan', 3)} ${variant}`)).toEqual([]);
    expect(variants(`${mentions('Dinah', 4)} ${mentions('Dinan', 3)} ${variant}`).map((each) => each.name)).toEqual(['Dinah']);
  });

  it('stops at its budget, finding nothing, in a document of thousands of near-alike names', () => {
    let seed = 7;
    const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const name = () => `B${Array.from({ length: 4 + Math.floor(next() * 4) }, () => 'aeioulnrst'[Math.floor(next() * 10)]).join('')}`;
    const common = Array.from({ length: 2000 }, name).map((each) => mentions(each, 3));
    const rare = Array.from({ length: 8000 }, name).map((each) => `So, at last, ${each} said nothing.`);

    const result = findNameVariants([...common, ...rare].join(' '), [], NONE);

    expect(result).toEqual({ kind: 'stopped', names: expect.any(Number), work: expect.any(Number) });
    expect(result.work).toBeLessThanOrEqual(NAME_CONSISTENCY.workBudget);
    expect(NAME_CONSISTENCY.workBudget).toBe(250_000);
  });

  describe('its work is bounded where deletions are made and indexed (PR #176 F-01)', () => {
    /** The review's witness: a deterministic 501-letter capitalized word. */
    const oversized = (() => {
      let seed = 9381;
      const alphabet = 'abcdefghijklmnopqrstuvwxyz';
      return `A${Array.from({ length: 500 }, () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return alphabet[seed % 26];
      }).join('')}`;
    })();

    it('reads an oversized word, rare or common, as no name, spending nothing', () => {
      expect(findNameVariants(`Then ${oversized}.`, [], NONE)).toEqual({ kind: 'checked', variants: [], work: 0 });
      expect(findNameVariants(Array.from({ length: 3 }, () => `Then ${oversized}.`).join(' '), [], NONE))
        .toEqual({ kind: 'checked', variants: [], work: 0 });
    });

    it('reads a name up to maximumLength letters, and none longer', () => {
      const name = `C${'aterpillarsnatchkin'.slice(0, NAME_CONSISTENCY.maximumLength - 1)}`;
      const longer = `${name}s`;
      expect(name).toHaveLength(NAME_CONSISTENCY.maximumLength);
      expect(findNameVariants(mentions(name, 3), [], NONE).work).toBeGreaterThan(0);
      expect(findNameVariants(mentions(longer, 3), [], NONE)).toEqual({ kind: 'checked', variants: [], work: 0 });
    });

    it('stops while indexing many long common names, within its budget', () => {
      let seed = 3;
      const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const name = () => `L${Array.from({ length: NAME_CONSISTENCY.maximumLength - 1 }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(next() * 26)]).join('')}`;
      const common = Array.from({ length: 2000 }, name).map((each) => mentions(each, 3));

      const result = findNameVariants(common.join(' '), [], NONE);

      expect(result).toEqual({ kind: 'stopped', names: 2000, work: expect.any(Number) });
      expect(result.work).toBeLessThanOrEqual(NAME_CONSISTENCY.workBudget);
    });

    it('charges each deletion made, each index entry visited and each name compared', () => {
      // Alice (indexed) and Alcie (looked up) each make 16 deletions: itself, 5 of one letter, 10 of two.
      // 9 of Alcie's are in the index (Alce, Alie, Ali, Alc, Ale, Aie, Ace, lie, lce), and one name is compared.
      const result = findNameVariants(`${mentions('Alice', 3)} And then, at last, Alcie slept.`, [], NONE);
      expect(result).toEqual({ kind: 'checked', variants: [expect.objectContaining({ variant: 'Alcie', name: 'Alice' })], work: 16 + 16 + 9 + 1 });
    });
  });

  it('reads no word in capitals, no short word and no form of "I" as a name', () => {
    expect(variants(`${mentions('Alice', 3)} So she ran, and ALCIE followed.`)).toEqual([]);
    expect(variants(`${mentions('Ada', 3)} So she ran, and Ad followed.`)).toEqual([]);
    expect(variants(`${mentions("I'll", 3)} Then, and Ill said.`)).toEqual([]);
  });
});
