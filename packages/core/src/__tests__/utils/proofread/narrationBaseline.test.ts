/**
 * The narration baseline (Draft Edit Slice 3b; ADR 2026-10-21, Amendment
 * 2026-10-26): the whole document's tense and person, from the sentences no
 * one speaks. Passages are public-domain *Alice* and adaptations of it.
 */
import * as wordFrequency from '@/tools/measure/wordFrequency';
import { NARRATION_BASELINE, measureNarrationBaseline } from '@/utils/proofread/narrationBaseline';
import { findProtectedRegions } from '@/utils/draftEdit/protectedRegions';
import {
  ALICE_CATERPILLAR_SINGLE_QUOTED,
  ALICE_FIRST_PAST,
  ALICE_THIRD_PAST,
  ALICE_THIRD_PRESENT
} from '@/__tests__/utils/proofread/narrationFixtures';

afterEach(() => jest.restoreAllMocks());

describe('measureNarrationBaseline', () => {
  it.each([
    ['third person, past tense', ALICE_THIRD_PAST, { tense: 'past', person: 'third' }],
    ['first person, past tense', ALICE_FIRST_PAST, { tense: 'past', person: 'first' }],
    ['third person, present tense', ALICE_THIRD_PRESENT, { tense: 'present', person: 'third' }]
  ])('names the narration of the opening told in the %s', (_voice, text, expected) => {
    expect(measureNarrationBaseline(text, [])).toEqual(expected);
  });

  it('never reads single-quoted speech as narration: the Caterpillar\'s "I" and present tense name nothing', () => {
    expect(measureNarrationBaseline(ALICE_CATERPILLAR_SINGLE_QUOTED, [])).toEqual({});
  });

  it('keeps the book\'s narration when single-quoted speech is added to it', () => {
    const chapter = `${ALICE_THIRD_PAST}\n\n${ALICE_CATERPILLAR_SINGLE_QUOTED}`;
    expect(measureNarrationBaseline(chapter, [])).toEqual({ tense: 'past', person: 'third' });
  });

  it('leaves out protected regions: present tense and "I" in a fenced block change nothing', () => {
    const fence = ['```text', ...Array.from({ length: 30 }, () => 'I am here and I see that it is now and I know it.'), '```'].join('\n');
    const chapter = `${ALICE_THIRD_PAST}\n\n${fence}`;
    expect(measureNarrationBaseline(chapter, findProtectedRegions(chapter, 'markdown'))).toEqual({ tense: 'past', person: 'third' });
  });

  it('names nothing from too little narration', () => {
    const sentence = 'Alice was beginning to get very tired of sitting by her sister on the bank.';
    expect(measureNarrationBaseline(sentence, [])).toEqual({});
    expect(NARRATION_BASELINE.minimumWords).toBeGreaterThan(sentence.split(' ').length);
  });

  it('names no tense when neither holds its share', () => {
    const paragraphs = ALICE_THIRD_PAST.split('\n\n');
    const mixed = [...paragraphs.slice(0, 3), ...ALICE_THIRD_PRESENT.split('\n\n').slice(3)].join('\n\n');
    expect(measureNarrationBaseline(mixed, []).tense).toBeUndefined();
  });

  it('samples a long book evenly: a present-tense prologue does not speak for a past-tense book, and the tagger reads within the budget', () => {
    // A present-tense prologue as long as most of the sample, before a past-tense book four times its length.
    const prologue = Array.from({ length: 40 }, () => ALICE_THIRD_PRESENT);
    const book = [...prologue, ...Array.from({ length: 200 }, () => ALICE_THIRD_PAST)].join('\n\n');
    const tagged: number[] = [];
    const tagTextTokens = wordFrequency.tagTextTokens;
    jest.spyOn(wordFrequency, 'tagTextTokens').mockImplementation((text: string) => {
      tagged.push(text.split(/\s+/).length);
      return tagTextTokens(text);
    });

    expect(measureNarrationBaseline(book, [])).toEqual({ tense: 'past', person: 'third' });
    expect(book.split(/\s+/).length).toBeGreaterThan(3 * NARRATION_BASELINE.sampleWords);
    expect(tagged).toHaveLength(1);
    expect(tagged[0]).toBeLessThanOrEqual(NARRATION_BASELINE.sampleWords);
  });

  it('counts an apostrophe between letters as part of a word, not a quotation mark', () => {
    const contracted = ALICE_THIRD_PAST.replace('she had never before seen', 'she hadn’t ever seen').replace('she was to get out again', 'she’d get out again');
    expect(measureNarrationBaseline(contracted, [])).toEqual({ tense: 'past', person: 'third' });
  });
});

/** The words each call hands the tagger, as whitespace-separated words. */
function taggerInput(): string[] {
  const inputs: string[] = [];
  const tagTextTokens = wordFrequency.tagTextTokens;
  jest.spyOn(wordFrequency, 'tagTextTokens').mockImplementation((text: string) => {
    inputs.push(text);
    return tagTextTokens(text);
  });
  return inputs;
}

const wordsIn = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** A first-person, present-tense speech of many sentences: an adaptation of the opening. */
const MONOLOGUE = Array.from(
  { length: 20 },
  () => 'I am beginning to get very tired of sitting by my sister on the bank. I have nothing to do. I see no pictures in the book.'
).join(' ');

describe('Single-quoted speech is left out whole (PR #174 F-01)', () => {
  it.each([
    ['straight', "'", "'"],
    ['curly', '‘', '’']
  ])('leaves out %s single-quoted speech, its interior sentences too', (_marks, open, close) => {
    const speech = `${open}${MONOLOGUE}${close}`;
    expect(measureNarrationBaseline(speech, [])).toEqual({});
    expect(measureNarrationBaseline(`${ALICE_THIRD_PAST}\n\n${speech}`, [])).toEqual({ tense: 'past', person: 'third' });
  });

  it('leaves out speech running over several paragraphs, each opening a quotation mark and only the last closing it', () => {
    const speech = [`‘${MONOLOGUE}`, `‘${MONOLOGUE}`, `‘${MONOLOGUE}’`].join('\n\n');
    expect(measureNarrationBaseline(speech, [])).toEqual({});
    expect(measureNarrationBaseline(`${ALICE_THIRD_PAST}\n\n${speech}`, [])).toEqual({ tense: 'past', person: 'third' });
  });

  it('control: the same speech in double quotation marks is left out by the shared dialogue rule', () => {
    expect(measureNarrationBaseline(`${ALICE_THIRD_PAST}\n\n“${MONOLOGUE}”`, [])).toEqual({ tense: 'past', person: 'third' });
  });

  it('keeps narration around a plural possessive with nothing open', () => {
    const possessive = ALICE_THIRD_PAST.replace('ran close by her.', 'ran close by the sisters’ bank.');
    expect(possessive).not.toBe(ALICE_THIRD_PAST);
    expect(measureNarrationBaseline(possessive, [])).toEqual({ tense: 'past', person: 'third' });
  });
});

describe('The tagger reads at most sampleWords words, across the whole document (PR #174 F-02)', () => {
  it('holds the budget when long and short sentences alternate: the review\'s 600 pairs of 56 and 3 words', () => {
    const long = 'Either the well was very deep, or she fell very slowly, for she had plenty of time as she went down to look about her '
      + 'and to wonder what was going to happen next, and then she looked at the sides of the well and noticed that they were filled with cupboards and book-shelves almost everywhere.';
    const book = Array.from({ length: 600 }, () => `${long} She fell on.`).join(' ');
    const inputs = taggerInput();

    expect([wordsIn(long), wordsIn('She fell on.'), wordsIn(book)]).toEqual([56, 3, 35_400]);
    expect(measureNarrationBaseline(book, [])).toEqual({ tense: 'past', person: 'third' });
    expect(inputs).toHaveLength(1);
    expect(wordsIn(inputs[0])).toBeLessThanOrEqual(NARRATION_BASELINE.sampleWords);
  });

  it('reads one oversized sentence in pieces from all of it, within the budget', () => {
    const draft = [
      ...Array.from({ length: 8_250 }, () => 'alice walked down the lane and'),
      ...Array.from({ length: 917 }, () => 'rabbit hurried past the gate and')
    ].join(' ');
    const inputs = taggerInput();

    expect(wordsIn(draft)).toBeGreaterThan(55_000);
    measureNarrationBaseline(draft, []);
    expect(inputs).toHaveLength(1);
    expect(wordsIn(inputs[0])).toBeLessThanOrEqual(NARRATION_BASELINE.sampleWords);
    // The last tenth of the draft is read too: the sample covers the whole of it, not its start.
    expect(inputs[0]).toContain('rabbit');
  });
});
