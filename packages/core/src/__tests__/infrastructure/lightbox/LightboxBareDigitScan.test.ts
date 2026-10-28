/**
 * The text rules read whole fields in time that grows with the text (PR #165
 * F-05). A digit outside a ¶ address is a figure the board's counts own;
 * the rule was the lookbehind `/(?<!¶\s?\d*)\d/u`, which re-read a long
 * run of digits for every digit in it. `lightboxHasBareDigit` reads the
 * text once and keeps the rule exactly: it is pinned to the old pattern on
 * every edge case and on seeded random text, its work is counted, and the
 * reviewer's group G shape decodes through the real codec. A spark's
 * closing marks are read back from the end the same way, and so are a
 * chapter line's trailing spaces. Every text here is synthetic.
 */
import { lightboxHasBareDigit } from '@/infrastructure/lightbox/LightboxReadingFields';
import { LIGHTBOX_SPARK_PHRASING_REASONS, lightboxSparkPhrasingFault } from '@/infrastructure/lightbox/LightboxSparkPhrasing';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { frame } from './lightboxReadingFixtures';

/** The rule as it stood, kept here only as the reference the scan must agree with. */
const OLD_BARE_DIGIT = /(?<!¶\s?\d*)\d/u;
const OLD_CLOSING_MARKS = /[\s"'“”‘’)\]}*_]+$/u;

/** A small seeded generator, so the random cases are the same on every run. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}
const randomText = (next: () => number, alphabet: readonly string[], maximum: number): string =>
  Array.from({ length: Math.floor(next() * (maximum + 1)) }, () => alphabet[Math.floor(next() * alphabet.length)]).join('');

describe('a bare digit, read in one pass with the old rule kept exactly', () => {
  it.each([
    ['no digit', 'A state holds the scene.', false],
    ['a bare digit', 'A state holds 3 scenes.', true],
    ['a digit opening the text', '3 scenes hold.', true],
    ['an address', 'It holds at ¶12.', false],
    ['an address with one space', 'It holds at ¶ 12.', false],
    ['an address with a no-break space', 'It holds at ¶ 12.', false],
    ['an address with an em space', 'It holds at ¶ 12.', false],
    ['an address with a line break', 'It holds at ¶\n12.', false],
    ['two spaces after the mark', 'It holds at ¶  12.', true],
    ['a letter between', 'It holds at ¶a12.', true],
    ['a second run after a space', 'It holds at ¶12 34.', true],
    ['a second address', 'From ¶3 to ¶ 4.', false],
    ['a range after an address', 'From ¶3–4.', true],
    ['a comma inside an address', 'At ¶1,200.', true],
    ['a non-ASCII digit, not a digit to the rule', 'It holds at ٣ places.', false],
    ['a mark at the very end', 'It holds at ¶', false],
    ['an empty text', '', false],
    ['an address run of 50,000 digits', `At ¶${'1'.repeat(50_000)}.`, false],
    ['a bare digit after a long address', `At ¶${'1'.repeat(50_000)} and 2.`, true]
  ])('%s', (_case, text, bare) => {
    expect(lightboxHasBareDigit(text)).toBe(bare);
    if (text.length < 1_000) {
      expect(OLD_BARE_DIGIT.test(text)).toBe(bare);
    }
  });

  it('agrees with the old rule on 20,000 seeded random texts of marks, spaces and digits', () => {
    const next = seeded(165_05);
    const alphabet = ['¶', '¶', ' ', ' ', '\t', '\n', ' ', '1', '9', '0', 'a', '.', ',', '٣', '😀'];
    for (let index = 0; index < 20_000; index++) {
      const text = randomText(next, alphabet, 14);
      expect([text, lightboxHasBareDigit(text)]).toEqual([text, OLD_BARE_DIGIT.test(text)]);
    }
  });

  it('reads each character once at most: eight times the text is eight times the work', () => {
    const steps = (digits: number) => {
      const work = { steps: 0 };
      const text = `A state holds at ¶${'1'.repeat(digits)}.`;
      expect(lightboxHasBareDigit(text, work)).toBe(false);
      expect(work.steps).toBeLessThanOrEqual(text.length);
      return work.steps;
    };
    const once = steps(24_000);
    const eight = steps(192_000);
    expect(eight / once).toBeLessThan(8.1);
  });

  it('stops at the first bare digit it reads', () => {
    const work = { steps: 0 };
    expect(lightboxHasBareDigit(`It holds 3 ${'scenes '.repeat(10_000)}`, work)).toBe(true);
    expect(work.steps).toBe('It holds 3'.length);
  });
});

describe('the reviewer\'s group G shape, through the real decoder', () => {
  const steering = (claim: string) => frame('G', {
    version: 1,
    steering: {
      figures: [{ stat: 'being-verbs', claim, evidence: [{ para: 1, quote: 'She was waiting.' }], notes: [] }],
      friction: 'One line is thin ground.'
    }
  });
  const decode = (claim: string) => decodeLightboxGroup(steering(claim), { group: 'G', lenses: ['steering'], columnCount: 1, end: 'stop' });
  /** Each figure's reading as decoded: its claim, or why it was withheld. */
  const readings = (decoded: ReturnType<typeof decode>) => {
    const block = decoded.blocks.find((candidate) => candidate.lens === 'steering');
    return block && 'figures' in block
      ? block.figures.map((figure) => ('claim' in figure.reading ? { claim: figure.reading.claim } : { withheld: figure.reading.withheld }))
      : [];
  };

  it('keeps a claim holding a paragraph address of 200,000 digits, whole, in a response under the hard bound', () => {
    const claim = `A state holds at ¶${'1'.repeat(200_000)}.`;
    const content = steering(claim);
    expect(content.length).toBeLessThan(384_000);
    const decoded = decode(claim);
    expect(decoded.withheld).toEqual([]);
    expect(decoded.report?.repairs).toEqual([]);
    expect(readings(decoded)).toEqual([{ claim }]);
    const block = decoded.blocks.find((candidate) => candidate.lens === 'steering');
    expect(block && 'malformed' in block ? block.malformed : undefined).toEqual([]);
  });

  it('still withholds a figure whose claim states a bare number, and keeps an addressed one (controls)', () => {
    expect(readings(decode('A state holds at 3 places.'))).toEqual([{ withheld: expect.stringContaining('figure') }]);
    expect(readings(decode('A state holds at ¶ 1.'))).toEqual([{ claim: 'A state holds at ¶ 1.' }]);
  });
});

describe('a spark\'s closing marks, read back from the end', () => {
  const notQuestion = (question: string) => lightboxSparkPhrasingFault(question) === LIGHTBOX_SPARK_PHRASING_REASONS.notQuestion;
  const oldNotQuestion = (question: string) => !question.trim().replace(OLD_CLOSING_MARKS, '').endsWith('?');

  it.each([
    ['Who waits at the end?', false],
    ['Who waits at the end?”', false],
    ['Who waits at the end?” )', false],
    ['Who waits at the end?_*', false],
    ['Who waits at the end.', true],
    ['Who waits at the end.”', true],
    ['?', false],
    ['”', true]
  ])('refuses %j as no question: %s', (question, refused) => {
    expect(notQuestion(question)).toBe(refused);
    expect(oldNotQuestion(question)).toBe(refused);
  });

  it('agrees with the old pattern on 20,000 seeded random endings', () => {
    const next = seeded(165_055);
    const alphabet = ['?', '.', 'a', ' ', ' ', '"', '”', '’', ')', ']', '}', '*', '_', '\n'];
    for (let index = 0; index < 20_000; index++) {
      const question = `Who${randomText(next, alphabet, 10)}`;
      expect([question, notQuestion(question)]).toEqual([question, oldNotQuestion(question)]);
    }
  });

  it('reads a question with 200,000 spaces inside it, as a question', () => {
    expect(lightboxSparkPhrasingFault(`Who waits${' '.repeat(200_000)}at the end?`)).toBeUndefined();
  });
});

describe('a chapter line\'s trailing spaces', () => {
  it('trimEnd removes exactly what /\\s+$/ removed, for every whitespace character', () => {
    const spaces = [' ', '\t', '\v', '\f', '\r', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', '　', '﻿'];
    for (const space of spaces) {
      const line = `Down the Rabbit-Hole${space}${space} `;
      expect(line.trimEnd()).toBe(line.replace(/\s+$/, ''));
      expect(`a${space}b`.trimEnd()).toBe(`a${space}b`.replace(/\s+$/, ''));
    }
  });
});
