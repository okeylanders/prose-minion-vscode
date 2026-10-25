/**
 * Craft steering's measure at scale (PR #160 F-01). The measure runs with
 * every board, before any press and whether or not the steering lens is on,
 * so its work must grow with the text, not with the square of a paragraph:
 * one valid paragraph of 49,998 words (under the 50,000-word source cap)
 * once took seconds to minutes. Work is counted, not timed: the tagger seam
 * hands the measure a token array that counts every element it reads. One
 * coarse wall-clock bound covers the largest case end to end. The counts
 * are the same whatever the paragraph shape, with literal values. Every
 * line is a synthetic sentence written for these tests.
 */
/* eslint-disable @typescript-eslint/naming-convention -- constructions are keyed by their kebab-case protocol ids. */
import type { LightboxSteeringFigure, LightboxSteeringStatId } from '@messages';
import { measureLightboxSteering } from '@/infrastructure/lightbox/LightboxSteeringMeasure';
import { tagTextTokens, type TaggedToken } from '@/tools/measure/wordFrequency';

/** `count` copies of `sentence`, as one paragraph. */
const repeated = (sentence: string, count: number) => Array.from({ length: count }, () => sentence).join(' ');

/** The measure of `paragraphs`, with the reads of the tagger's tokens counted. */
function measured(paragraphs: readonly string[]) {
  let reads = 0;
  let tokens = 0;
  const tag = (text: string): TaggedToken[] => {
    const real = tagTextTokens(text);
    tokens += real.length;
    return new Proxy(real, {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^\d+$/.test(property)) {
          reads += 1;
        }
        return Reflect.get(target, property, receiver);
      }
    });
  };
  const measure = measureLightboxSteering({ text: paragraphs.join('\n\n'), paragraphs, tag });
  return { measure, reads, tokens };
}

const row = (figures: readonly LightboxSteeringFigure[], stat: LightboxSteeringStatId) => {
  const figure = figures.find((candidate) => candidate.stat === stat) as LightboxSteeringFigure;
  return {
    total: figure.total,
    narration: figure.narration,
    dialogue: figure.dialogue,
    inShortRuns: figure.inShortRuns,
    constructions: Object.fromEntries(figure.constructions.map((entry) => [entry.construction, entry.count]))
  };
};

describe('craft steering measures a large paragraph in work that grows with it (PR #160 F-01)', () => {
  it('reads each token a bounded number of times, however many instances one paragraph holds', () => {
    const { measure, reads, tokens } = measured([repeated('It was cold.', 1_000)]);
    expect(tokens).toBe(4_000);
    expect(row(measure.figures, 'being-verbs')).toMatchObject({ total: 1_000, inShortRuns: 1_000 });
    // Before the fix, each instance searched the tokens from the paragraph's start: about 2,000,000 reads here.
    expect(reads).toBeLessThanOrEqual(16 * tokens);
  });

  it('grows linearly: ten times the paragraph is about ten times the work, not a hundred', () => {
    const small = measured([repeated('It was cold.', 200)]);
    const large = measured([repeated('It was cold.', 2_000)]);
    expect(large.tokens).toBe(10 * small.tokens);
    expect(large.reads).toBeLessThanOrEqual(12 * small.reads);
  });

  it('looks past a long run of fillers or adverbs once, not once per word in it', () => {
    const fillers = measured([`${repeated('very', 1_500)} big.`]);
    expect(row(fillers.measure.figures, 'intensifiers')).toMatchObject({ total: 1_500, constructions: { generic: 1_500, 'before-modifier': 0, other: 0 } });
    expect(fillers.reads).toBeLessThanOrEqual(16 * fillers.tokens);
    const adverbs = measured([`He ran ${repeated('slowly', 1_500)}.`]);
    expect(row(adverbs.measure.figures, 'adverbs').total).toBe(1_500);
    expect(adverbs.reads).toBeLessThanOrEqual(16 * adverbs.tokens);
  });

  it('measures 49,998 words in one paragraph well inside a coarse bound, with every instance kept', () => {
    const source = repeated('It was cold.', 16_666);
    const tokens = tagTextTokens(source);
    const started = Date.now();
    const measure = measureLightboxSteering({ text: source, paragraphs: [source], tag: () => tokens });
    // Before the fix this took about 5 s in plain Node and about 100 s under Jest; now it takes well under one.
    expect(Date.now() - started).toBeLessThan(3_000);
    expect(row(measure.figures, 'being-verbs')).toEqual({
      total: 16_666, narration: 16_666, dialogue: 0, inShortRuns: 16_666,
      constructions: { adjective: 0, progressive: 0, passive: 0, expletive: 16_666, other: 0 }
    });
  }, 60_000);
});

describe('the counts do not depend on the paragraph shape (PR #160 F-01)', () => {
  // Six short sentences: being verbs in dialogue and narration, -ly words and intensifiers in each construction.
  const UNIT = '“She was here,” he said softly. It was very cold. The door was shut. ' +
    'She ran really quickly. Really quickly, she ran. It was quite remarkable.';

  it('counts one unit so', () => {
    const { measure } = measured([UNIT]);
    expect(row(measure.figures, 'being-verbs')).toEqual({
      total: 4, narration: 3, dialogue: 1, inShortRuns: 4,
      constructions: { adjective: 0, progressive: 0, passive: 1, expletive: 2, other: 1 }
    });
    expect(row(measure.figures, 'adverbs')).toEqual({
      total: 5, narration: 5, dialogue: 0, inShortRuns: 5,
      constructions: { 'with-verb': 2, 'dialogue-tag': 1, 'before-adjective': 0, 'before-adverb': 1, other: 1 }
    });
    expect(row(measure.figures, 'intensifiers')).toEqual({
      total: 4, narration: 4, dialogue: 0, inShortRuns: 4,
      constructions: { generic: 1, 'before-modifier': 3, other: 0 }
    });
  });

  it('counts 300 units the same whether they stand in one paragraph or in 300', () => {
    const single = measured([repeated(UNIT, 300)]).measure;
    const split = measured(Array.from({ length: 300 }, () => UNIT)).measure;
    for (const stat of ['being-verbs', 'adverbs', 'intensifiers'] as const) {
      expect(row(single.figures, stat)).toEqual(row(split.figures, stat));
    }
    expect(row(single.figures, 'being-verbs')).toEqual({
      total: 1_200, narration: 900, dialogue: 300, inShortRuns: 1_200,
      constructions: { adjective: 0, progressive: 0, passive: 300, expletive: 600, other: 300 }
    });
    expect(row(single.figures, 'adverbs').constructions).toEqual({ 'with-verb': 600, 'dialogue-tag': 300, 'before-adjective': 0, 'before-adverb': 300, other: 300 });
    expect(row(single.figures, 'intensifiers').constructions).toEqual({ generic: 300, 'before-modifier': 900, other: 0 });
  });
});
/* eslint-enable @typescript-eslint/naming-convention */
