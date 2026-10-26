/**
 * The narration baseline (Draft Edit Slice 3b; ADR 2026-10-21, Amendment
 * 2026-10-26): the whole document's tense and person, from the sentences no
 * one speaks. Passages are public-domain *Alice* and adaptations of it.
 */
import { NARRATION_BASELINE, measureNarrationBaseline } from '@/utils/proofread/narrationBaseline';
import { findProtectedRegions } from '@/utils/draftEdit/protectedRegions';
import {
  ALICE_CATERPILLAR_SINGLE_QUOTED,
  ALICE_FIRST_PAST,
  ALICE_THIRD_PAST,
  ALICE_THIRD_PRESENT
} from '@/__tests__/utils/proofread/narrationFixtures';

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

  it('counts an apostrophe between letters as part of a word, not a quotation mark', () => {
    const contracted = ALICE_THIRD_PAST.replace('she had never before seen', 'she hadn’t ever seen').replace('she was to get out again', 'she’d get out again');
    expect(measureNarrationBaseline(contracted, [])).toEqual({ tense: 'past', person: 'third' });
  });
});
