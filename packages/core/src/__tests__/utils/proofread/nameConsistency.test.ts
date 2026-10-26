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

  it('reads nothing inside a protected region or on a heading line', () => {
    const fenced = `${mentions('Alice', 3)} So she ran, and Alcie followed.`;
    const start = fenced.indexOf('and Alcie');
    expect(findNameVariants(fenced, [{ start, end: start + 'and Alcie'.length }], NONE)).toEqual({ kind: 'checked', variants: [] });
    expect(variants(`# The Pool of Tears, and Alcie\n\n${mentions('Alice', 3)}`)).toEqual([]);
  });

  it('reads no title-case heading word as a name', () => {
    expect(variants(`## Down, the Rabit-Hole\n\n${mentions('Rabbit', 3)}`)).toEqual([]);
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

    expect(result).toEqual({ kind: 'stopped', names: expect.any(Number) });
    expect(NAME_CONSISTENCY.candidateBudget).toBe(100_000);
  });

  it('reads no word in capitals, no short word and no form of "I" as a name', () => {
    expect(variants(`${mentions('Alice', 3)} So she ran, and ALCIE followed.`)).toEqual([]);
    expect(variants(`${mentions('Ada', 3)} So she ran, and Ad followed.`)).toEqual([]);
    expect(variants(`${mentions("I'll", 3)} Then, and Ill said.`)).toEqual([]);
  });
});
