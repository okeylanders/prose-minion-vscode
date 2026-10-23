/**
 * Every rule reads what the model wrote, whole (PR #165 F-01). The safety
 * ceiling clips only free prose no rule reads, after decoding, so it can
 * neither reject real evidence nor let an altered quote pass: a quote is
 * verified whole against the paragraph it names, a steering example is
 * anchored whole in its note's checked quote, and a spark's question is held
 * to its phrasing whole. The reviewer's four reproductions and their
 * controls, on synthetic paragraphs written for these tests and on the
 * worked examples (the opening of "Alice's Adventures in Wonderland", Lewis
 * Carroll, 1865, public domain).
 */
import type { LightboxLensId, LightboxReadingGroupId, LightboxSteeringNoteTile } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { LIGHTBOX_ELLIPSIS, clipLightboxText } from '@shared/constants/lightboxClip';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { frame, framedJson, readWorkedExample } from './lightboxReadingFixtures';

const B = PROMPT_BUDGETS.lightbox;
/** The ceiling a quote would have been clipped at: eight times its ask. */
const QUOTE_CEILING = B.quoteCharacters * B.safetyMultiple;
const NOT_FOUND = 'No quote it gave was found in the paragraph it named.';

function read(group: LightboxReadingGroupId, body: unknown, lenses: LightboxLensId[], paragraphs: readonly string[]) {
  const decoded = decodeLightboxGroup(frame(group, body), { group, lenses, columnCount: paragraphs.length });
  let id = 0;
  const assembled = assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `t${++id}`
  });
  return { decoded, assembled };
}

/** A headline whose one quote is `quote`, on a chapter of `paragraphs`. */
function headline(paragraphs: readonly string[], quote: string) {
  const body = {
    version: 1,
    headline: {
      sentence: 'A girl waits while the wind crosses the garden.',
      terms: ['garden'],
      evidence: [{ para: 1, quote }],
      friction: 'One paragraph is thin ground for a headline.'
    }
  };
  const { decoded, assembled } = read('A', body, ['headline'], paragraphs);
  return {
    drawn: assembled.tiles.filter((tile) => tile.kind === 'headline'),
    withheld: assembled.withheldClaims.map((claim) => claim.reason),
    clipped: decoded.report?.clipped
  };
}

describe('a quote is verified whole, never a clipped stand-in', () => {
  const opening = 'A girl was waiting by the window. ';
  const middle = 'The wind moved across the silent garden. ';

  it('draws a headline whose one real quote runs past eight times its ask (reproduction 1)', () => {
    const paragraph = `${opening}${middle.repeat(65)}A last line closes the paragraph.`;
    expect(paragraph.length).toBeGreaterThan(QUOTE_CEILING);
    const shown = headline([paragraph], paragraph);
    expect(shown.withheld).toEqual([]);
    expect(shown.drawn).toHaveLength(1);
    expect(shown.drawn[0].evidence.map((quote) => quote.text)).toEqual([paragraph]);
    expect(shown.clipped).toBe(0);
  });

  it('withholds a quote whose invented tail is not in the chapter, even when its clipped start is (reproduction 2)', () => {
    // The reviewer's generator: the chapter holds the quote's clipped start, ellipsis and all, and never its tail.
    const rawQuote = `${opening}${middle.repeat(65)}Invented ending not in the chapter.`;
    const paragraph = clipLightboxText(rawQuote, QUOTE_CEILING);
    expect(paragraph.endsWith(LIGHTBOX_ELLIPSIS)).toBe(true);
    expect(createLightboxQuoteVerifier([paragraph]).verify(1, rawQuote).found).toBe(false);
    const shown = headline([paragraph], rawQuote);
    expect(shown.drawn).toEqual([]);
    expect(shown.withheld).toEqual([NOT_FOUND]);
  });

  it.each([QUOTE_CEILING - 1, QUOTE_CEILING, QUOTE_CEILING + 1])('draws a real quote of %i characters whole (threshold control)', (length) => {
    const paragraph = `${opening}${middle.repeat(70)}`.slice(0, length).trimEnd();
    const shown = headline([`${paragraph} The rest of the paragraph.`], paragraph);
    expect(shown.withheld).toEqual([]);
    expect(shown.drawn[0].evidence.map((quote) => quote.text)).toEqual([paragraph]);
  });

  it.each([
    ['short', 'The moon rose over the orchard.'],
    ['long', `The moon rose over the orchard. ${'Its light fell on every branch. '.repeat(90)}`.trim()]
  ])('still withholds a %s quote the chapter does not hold (control)', (_length, quote) => {
    const shown = headline([`${opening}${middle.repeat(3)}`.trim()], quote);
    expect(shown.drawn).toEqual([]);
    expect(shown.withheld).toEqual([NOT_FOUND]);
  });
});

describe('a steering example is anchored whole in its note\'s checked quote', () => {
  const AFTER = 'Daylight brightened motionless drapes beside floorboards';
  const NUDGE = 'An action for her may be worth a look, so the waiting moves.';
  /** A narration sentence holding one being verb, its words long enough to run past any length asked. */
  const SENTENCE = `She was waiting beside the window${' while the grey light crossed the boards'.repeat(16)}`;

  function exampleShown(before: string) {
    const quote = SENTENCE;
    const body = {
      version: 1,
      steering: {
        figures: [{
          stat: 'being-verbs', claim: 'A state holds the scene still.', evidence: [{ para: 1, quote }],
          notes: [{ para: 1, quote, stance: 'leans', why: 'A state stands where she could act.', nudge: NUDGE, example: { before, after: AFTER } }]
        }],
        friction: 'One line is thin ground.'
      }
    };
    const { assembled } = read('G', body, ['steering'], [`${SENTENCE}.`]);
    const note = assembled.tiles.find((tile): tile is LightboxSteeringNoteTile => tile.kind === 'steering-note');
    return { example: note?.example, withheld: note?.exampleWithheld, nudge: note?.nudge };
  }

  /** The sentence's start, cut back to whole words at or under `length` characters. */
  const startOf = (length: number) => SENTENCE.slice(0, SENTENCE.lastIndexOf(' ', length + 1)).trimEnd();
  const exampleCeiling = B.steeringExampleCharacters * B.safetyMultiple;

  it('keeps a real first part past eight times its ask, and its note (reproduction 3)', () => {
    const before = startOf(SENTENCE.length);
    expect(before.length).toBeGreaterThan(exampleCeiling);
    expect(exampleShown(before)).toEqual({ example: { before, after: AFTER }, withheld: undefined, nudge: NUDGE });
  });

  it.each([exampleCeiling - 1, exampleCeiling, exampleCeiling + 1])('keeps a real first part of about %i characters whole (threshold control)', (length) => {
    const before = startOf(length);
    expect(exampleShown(before).example).toEqual({ before, after: AFTER });
  });

  it('still withholds a first part that is not in its quote, alone, keeping the note (control)', () => {
    const shown = exampleShown(`${startOf(exampleCeiling + 40)} and then she sang`);
    expect(shown.example).toBeUndefined();
    expect(shown.withheld).toEqual(expect.any(String));
    expect(shown.nudge).toBe(NUDGE);
  });
});

describe('a spark\'s question is held to its phrasing whole', () => {
  const C = readWorkedExample('C');
  /** Sentences written for these tests: no digit, no order, no question until the spark's own. */
  const LEAD = 'The jar comes down from one of the cupboards and book-shelves that line the well, among maps and pictures hung upon pegs. ';

  function sparks(question: string) {
    const body = framedJson(C.response) as { spark: { items: Array<{ question: string }> } };
    body.spark.items[0].question = question;
    const { decoded, assembled } = read('C', { version: 1, spark: body.spark }, ['spark'], C.paragraphs);
    const block = decoded.blocks.find((candidate) => candidate.lens === 'spark');
    return {
      malformed: block && 'malformed' in block ? block.malformed : undefined,
      drawn: assembled.tiles.filter((tile) => tile.kind === 'spark').map((tile) => tile.claim)
    };
  }

  it('draws a question past eight times its ask, whole, still a question (reproduction 4)', () => {
    const original = (framedJson(C.response) as { spark: { items: Array<{ question: string }> } }).spark.items[0].question;
    const question = `${LEAD.repeat(22)}${original}`;
    expect(question.length).toBeGreaterThan(B.sparkCharacters * B.safetyMultiple);
    const shown = sparks(question);
    expect(shown.malformed).toEqual([]);
    expect(shown.drawn).toContain(question);
  });

  it('still withholds a question that is not one, however long (control)', () => {
    const shown = sparks(`${LEAD.repeat(22)}The jar is empty.`);
    expect(shown.malformed).toEqual([expect.objectContaining({ title: 'The empty jar' })]);
  });
});

describe('free prose is still clipped at the safety ceiling, after decoding, and counted', () => {
  it('clips a runaway motif gist with an ellipsis, and draws the motif', () => {
    const A = readWorkedExample('A');
    const body = framedJson(A.response) as { motifs: { items: Array<{ gist: string }> } };
    body.motifs.items[0].gist = 'Down, and down again. '.repeat(80);
    const { decoded, assembled } = read('A', { version: 1, motifs: body.motifs }, ['motif'], A.paragraphs);
    expect(decoded.report?.clipped).toBe(1);
    const motif = assembled.tiles.find((tile) => tile.kind === 'motif' && tile.gist.endsWith(LIGHTBOX_ELLIPSIS));
    expect(motif?.kind === 'motif' && motif.gist.length).toBeLessThanOrEqual(B.noteCharacters * B.safetyMultiple);
  });
});
