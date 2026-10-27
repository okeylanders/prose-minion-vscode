/**
 * What a Craft Flags note may say (ADR 2026-10-21, Amendment 2026-10-26:
 * Slice 3c): an option, never an order. Each rule has a witness and a
 * control; notes are about public-domain *Alice*.
 */
import {
  CRAFT_FLAG_FORBIDDEN_FORMS,
  CRAFT_FLAG_FORBIDDEN_PHRASES,
  CRAFT_FLAG_IMPERATIVE_OPENERS,
  craftFlagPhrasingFault
} from '@/utils/craftFlags/craftFlagPhrasing';

describe('craftFlagPhrasingFault', () => {
  it('lets a note that describes a possibility through', () => {
    expect(craftFlagPhrasingFault('A borrowed shiver stands in for what the watch means to her.')).toBeUndefined();
    expect(craftFlagPhrasingFault('her skirts lifting around her while the well goes on and on')).toBeUndefined();
    expect(craftFlagPhrasingFault('You could end the sentence on the pink eyes.')).toBeUndefined();
  });

  it.each([
    ['should', 'The sentence should end on the pink eyes.'],
    ['must', 'This must go.'],
    ['a contraction', 'It shouldn’t lean on a stock shiver.'],
    ['fix', 'A small fix: the pink eyes.'],
    ['cut', 'Cutting it lets the eyes land.'],
    ['replace', 'It could be replaced by her own fear.'],
    ['rewrite', 'A rewritten line might name the watch.'],
    ['wrong', 'The wrong kind of fear for a curious fall.'],
    ['bad', 'A bad fit for the afternoon.']
  ])('withholds an order or correction word (%s), in any case and form', (_word, note) => {
    expect(craftFlagPhrasingFault(note)).toBe('forbidden');
  });

  it.each(['need to', 'needs to', 'have to', 'has to', 'ought to'])('withholds the two-word order "%s", and not its words apart', (phrase) => {
    expect(craftFlagPhrasingFault(`The scene ${phrase} name the cold.`)).toBe('forbidden');
    expect(CRAFT_FLAG_FORBIDDEN_PHRASES).toContain(phrase);
  });

  it('reads a word whole: a listed form inside a longer word is not one', () => {
    expect(craftFlagPhrasingFault('A cutting wind off the bank.')).toBe('forbidden');
    expect(craftFlagPhrasingFault('A shortcut through the field.')).toBeUndefined();
    expect(craftFlagPhrasingFault('The need for a watch.')).toBeUndefined();
  });

  it('withholds a clause or comma segment that opens with an order, softening words set aside', () => {
    expect(craftFlagPhrasingFault('Try the pink eyes instead.')).toBe('instruction');
    expect(craftFlagPhrasingFault('Perhaps consider the watch.')).toBe('instruction');
    expect(craftFlagPhrasingFault('The fall is slow; let it be funny.')).toBe('instruction');
    expect(craftFlagPhrasingFault('A stock fear, so show her curiosity.')).toBe('instruction');
    expect(craftFlagPhrasingFault('The fall is slow, and the joke is in that.')).toBeUndefined();
    expect(craftFlagPhrasingFault('A slow fall that shows her curiosity.')).toBeUndefined();
  });

  it('withholds double quotation marks of every kind, and leaves apostrophes alone', () => {
    for (const note of ['the “pink eyes”', 'the "pink eyes"', 'the „pink eyes“', 'the «pink eyes»']) {
      expect(craftFlagPhrasingFault(note)).toBe('quoted');
    }
    expect(craftFlagPhrasingFault('the Rabbit’s pink eyes')).toBeUndefined();
  });

  it('withholds a digit: counts are the host\'s', () => {
    expect(craftFlagPhrasingFault('It appears 4 times.')).toBe('figure');
    expect(craftFlagPhrasingFault('It appears more than once.')).toBeUndefined();
  });

  it('withholds, as its stated limit, a listed word used to describe, and passes an order with no listed word', () => {
    expect(craftFlagPhrasingFault('A bad dream on a hot afternoon.')).toBe('forbidden');
    expect(craftFlagPhrasingFault('A plainer phrase would carry it.')).toBeUndefined();
  });

  it('keeps its lists lower case and free of repeats', () => {
    for (const list of [CRAFT_FLAG_FORBIDDEN_FORMS, CRAFT_FLAG_FORBIDDEN_PHRASES, CRAFT_FLAG_IMPERATIVE_OPENERS]) {
      expect(list.every((entry) => entry === entry.toLowerCase())).toBe(true);
      expect(new Set(list).size).toBe(list.length);
    }
  });
});
