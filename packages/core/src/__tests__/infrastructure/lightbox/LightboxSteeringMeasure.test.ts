/**
 * Craft steering, measured (Slice 4F; epic decision 21): each figure's
 * total and rate by the numbers' own detectors, so they equal the numbers
 * rows; narration and dialogue; runs of short sentences; and the
 * constructions from the word-frequency tool's tagger, with each rule's
 * named false positives pinned. Literal expected values throughout. The
 * board reads ¶1–¶8 of "Alice's Adventures in Wonderland" (1865, public
 * domain); the short lines are synthetic sentences written for these tests.
 */
import type { LightboxSteeringFigure, LightboxSteeringStatId } from '@messages';
import { measureLightboxSteering, shortRunSpans } from '@/infrastructure/lightbox/LightboxSteeringMeasure';
import { readWorkedExample } from './lightboxReadingFixtures';
import { boardWithNumbers } from './lightboxCraftFixtures';

const ALICE = readWorkedExample('G').paragraphs;

const measure = (paragraphs: readonly string[]) => measureLightboxSteering({ text: paragraphs.join('\n\n'), paragraphs });
const figureOf = (paragraphs: readonly string[], stat: LightboxSteeringStatId): LightboxSteeringFigure =>
  measure(paragraphs).figures.find((figure) => figure.stat === stat) as LightboxSteeringFigure;
/** The construction each instance of a one-instance line falls in. */
const constructionOf = (line: string, stat: LightboxSteeringStatId) =>
  figureOf([line], stat).constructions.filter((row) => row.count > 0).map((row) => row.construction);

describe('craft steering\'s counts equal the numbers tile\'s (Slice 4F)', () => {
  it('counts each figure by the numbers\' own detector: the same instances and the same rate', async () => {
    const board = await boardWithNumbers(ALICE);
    const row = (stat: string) => board.measured.numbers.rows.find((candidate) => candidate.stat === stat);
    expect(board.measured.steering.figures.map((figure) => [figure.stat, figure.total, figure.rate])).toEqual([
      ['being-verbs', 17, 17_000 / 508],
      ['adverbs', 7, 7_000 / 508],
      ['intensifiers', 11, 11_000 / 508]
    ]);
    for (const figure of board.measured.steering.figures) {
      expect([figure.total, figure.rate, figure.paragraphs]).toEqual([row(figure.stat)?.instances, row(figure.stat)?.value, row(figure.stat)?.paragraphs]);
    }
  });

  it('measures the Alice opening into these splits, constructions and runs', () => {
    const measured = measure(ALICE);
    expect(measured.tagged).toBe(true);
    expect(measured.shortRun).toEqual({ sentences: 3, maxWords: 8 });
    const rows = (stat: LightboxSteeringStatId) => figureOf(ALICE, stat).constructions.map((row) => [row.construction, row.count]);
    expect(figureOf(ALICE, 'being-verbs')).toMatchObject({ narration: 15, dialogue: 2, inShortRuns: 0 });
    expect(rows('being-verbs')).toEqual([['adjective', 4], ['progressive', 5], ['passive', 1], ['expletive', 4], ['other', 3]]);
    expect(figureOf(ALICE, 'adverbs')).toMatchObject({ narration: 7, dialogue: 0, inShortRuns: 0, weakVerbs: 1 });
    expect(rows('adverbs')).toEqual([['with-verb', 4], ['dialogue-tag', 0], ['before-adjective', 1], ['before-adverb', 0], ['other', 2]]);
    expect(figureOf(ALICE, 'intensifiers')).toMatchObject({ narration: 11, dialogue: 0, inShortRuns: 0 });
    expect(rows('intensifiers')).toEqual([['generic', 4], ['before-modifier', 4], ['other', 3]]);
    // Each breakdown is a partition: it sums to its figure's total.
    for (const figure of measured.figures) {
      expect(figure.constructions.reduce((sum, row) => sum + row.count, 0)).toBe(figure.total);
      expect(figure.narration + figure.dialogue).toBe(figure.total);
    }
  });
});

describe('narration and dialogue', () => {
  it('counts an instance inside double quotation marks as dialogue, and one outside as narration', () => {
    expect(figureOf(['“She was here,” he said. It was late.'], 'being-verbs')).toMatchObject({ total: 2, narration: 1, dialogue: 1 });
    // The dialogue matcher's limit: single-quoted speech reads as narration.
    expect(figureOf(['‘She was here,’ he said.'], 'being-verbs')).toMatchObject({ total: 1, narration: 1, dialogue: 0 });
  });
});

describe('runs of short sentences', () => {
  it('lights three or more sentences in a row of eight words or fewer, in one paragraph', () => {
    const run = 'He sat. It was cold. The door was shut.';
    expect(figureOf([run], 'being-verbs').inShortRuns).toBe(2);
    // Two short sentences are no run.
    expect(figureOf(['He sat. It was cold.'], 'being-verbs').inShortRuns).toBe(0);
    // Eight words is short; nine is not, and breaks the run.
    expect(figureOf(['He sat. It was cold. The door was shut against the night wind.'], 'being-verbs').inShortRuns).toBe(2);
    expect(figureOf(['He sat. It was cold. The door was shut against the cold night wind.'], 'being-verbs').inShortRuns).toBe(0);
    // A run never crosses a paragraph break.
    expect(figureOf(['He sat.', 'It was cold.', 'The door was shut.'], 'being-verbs').inShortRuns).toBe(0);
    // A closing quotation mark at a paragraph's end is no sentence of its own: it neither extends nor breaks a run.
    // Three spans whether the shared sentence rule leaves the mark alone or keeps it with its sentence.
    expect(shortRunSpans('He sat. It was cold. “The door was shut.”')).toHaveLength(3);
  });
});

describe('constructions, with the false positives each rule is stated with', () => {
  it('sorts being verbs: there or it + be first, then the next word past any adverb', () => {
    expect(constructionOf('There was a door.', 'being-verbs')).toEqual(['expletive']);
    expect(constructionOf('It was cold.', 'being-verbs')).toEqual(['expletive']);
    // Stated false positive: a referential "it" counts too.
    expect(constructionOf('The key? It was gold.', 'being-verbs')).toEqual(['expletive']);
    expect(constructionOf('She was running.', 'being-verbs')).toEqual(['progressive']);
    expect(constructionOf('The cake was eaten.', 'being-verbs')).toEqual(['passive']);
    // Stated false positive: an adjectival participle is tagged as a participle.
    expect(constructionOf('She was tired.', 'being-verbs')).toEqual(['passive']);
    expect(constructionOf('She was very happy.', 'being-verbs')).toEqual(['adjective']);
    expect(constructionOf('She was a girl.', 'being-verbs')).toEqual(['other']);
    // "was being" is two instances: was + -ing, then being + participle.
    expect(figureOf(['The cake was being eaten.'], 'being-verbs').constructions
      .filter((row) => row.count > 0).map((row) => [row.construction, row.count])).toEqual([['progressive', 1], ['passive', 1]]);
  });

  it('sorts adverbs: a dialogue tag, before an adjective, with a verb (weak or not), before an adverb, other', () => {
    expect(constructionOf('Alice said softly that it was so.', 'adverbs')).toEqual(['dialogue-tag']);
    // Stated miss: the speaker between the tag and the adverb.
    expect(constructionOf('Come in, said Alice softly.', 'adverbs')).toEqual(['other']);
    expect(constructionOf('The hall was strangely quiet.', 'adverbs')).toEqual(['before-adjective']);
    expect(figureOf(['He walked slowly home.'], 'adverbs')).toMatchObject({ weakVerbs: 0 });
    expect(constructionOf('He walked slowly home.', 'adverbs')).toEqual(['with-verb']);
    // A verb before the adverbs wins: both of these read as with a verb.
    expect(figureOf(['She ran really quickly.'], 'adverbs').constructions
      .filter((row) => row.count > 0).map((row) => [row.construction, row.count])).toEqual([['with-verb', 2]]);
    expect(constructionOf('Really quickly, she ran.', 'adverbs')).toEqual(['before-adverb', 'other']);
    // A weak verb (Style Flags' list) beside the adverb is counted among the verbs.
    expect(figureOf(['She fortunately was in time.'], 'adverbs')).toMatchObject({ weakVerbs: 1 });
    // Stated: the detector counts any -ly word, an adjective included.
    expect(constructionOf('A lovely day.', 'adverbs')).toEqual(['other']);
  });

  it('sorts intensifiers: before a generic word, before an adjective or adverb, other', () => {
    expect(constructionOf('It was very big.', 'intensifiers')).toEqual(['generic']);
    // Looking past another filler.
    expect(figureOf(['It was really very good.'], 'intensifiers').constructions
      .map((row) => [row.construction, row.count])).toEqual([['generic', 2], ['before-modifier', 0], ['other', 0]]);
    expect(constructionOf('It was quite remarkable.', 'intensifiers')).toEqual(['before-modifier']);
    expect(constructionOf('She just left.', 'intensifiers')).toEqual(['other']);
  });

  it('sorts a form beside emphasis marks by the words, skipping the marks', () => {
    expect(constructionOf('She was *very* happy.', 'being-verbs')).toEqual(['adjective']);
    // A form joined to an underscore is not an instance at all: the detector does not count it.
    expect(figureOf(['She _was_ happy.'], 'being-verbs').total).toBe(0);
  });
});

describe('without the tagger', () => {
  it('keeps the totals, splits and runs, and measures no constructions', () => {
    const measured = measureLightboxSteering({
      text: ALICE.join('\n\n'),
      paragraphs: ALICE,
      tag: () => {
        throw new Error('the tagger did not load');
      }
    });
    expect(measured.tagged).toBe(false);
    expect(measured.figures.map((figure) => [figure.stat, figure.total, figure.narration, figure.constructions])).toEqual([
      ['being-verbs', 17, 15, []],
      ['adverbs', 7, 7, []],
      ['intensifiers', 11, 11, []]
    ]);
    expect(measured.figures.find((figure) => figure.stat === 'adverbs')?.weakVerbs).toBeUndefined();
  });
});
