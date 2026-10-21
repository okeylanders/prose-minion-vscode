/**
 * Dialogue is voice (epic decision 26): a steering note whose instance
 * stands in dialogue may be drawn with its stance, but never with a nudge or
 * an example, for all three figures. A host rule, held fresh (assembly), on
 * carry (stale readings) and at Bring (the tile handoff), through the
 * production codec, verifier, gates, carry, handoff and the Opinion's
 * digest. Every expected value is literal, and the file reaches the rule
 * only through modules the board had before it, so it runs, and fails, on
 * the tree before the rule. Dialogue is the steering measure's own: double
 * quotation marks (`findDialogueSpans`), so single-quoted speech reads as
 * narration. Every line is a synthetic sentence written for these tests.
 */
import type { LightboxBoard, LightboxReadingGroup, LightboxReadingTile, LightboxSteeringNoteTile } from '@messages';
import { LIGHTBOX_READING_GROUPS, emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import { lightboxOpinionItems } from '@shared/constants/lightboxOpinionItems';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { carryLightboxReadings } from '@/infrastructure/lightbox/LightboxStaleReadings';
import { prepareLightboxTileHandoff } from '@/infrastructure/lightbox/LightboxTileHandoff';
import { validateWorkshopLightboxTile } from '@/application/services/workshop/WorkshopLightboxTileAttachment';
import { boardWithNumbers } from './lightboxCraftFixtures';
import { frame } from './lightboxReadingFixtures';
import { STEERING_VOICE_LINES as LINES } from './lightboxSteeringVoiceFixtures';

/* eslint-disable @typescript-eslint/no-explicit-any -- reading bodies are written as plain JSON. */
type Body = Record<string, any>;
/** A note as drawn; `voice` is read as an optional field, so this file compiles on the tree before the rule. */
type Note = LightboxSteeringNoteTile & { voice?: string };

/** The host's words, literal. */
const VOICE_NONE = 'Its instance is in dialogue, the character\'s voice: the board reads it there but offers no nudge or example.';
const VOICE_FRESH = 'Its instance is in dialogue, the character\'s voice, so no nudge or example the reading gave is shown.';
const VOICE_CARRIED = 'Its instance now stands in dialogue, the character\'s voice, so its nudge, and any example, are no longer shown.';
const NO_NUDGE_FRESH = 'It leans or compensates in narration, so it names the craft move worth a look, and this one names none.';
const NO_NUDGE_CARRIED = 'Its instance no longer stands in dialogue, and in narration a note that leans or compensates names a nudge; this one has none.';
const EXAMPLE_VOICE = 'Its example\'s first part holds an instance only in dialogue, the character\'s voice, so it is not shown.';
const DIGEST_VOICE = 'in dialogue: the character\'s voice, read but not steered';

const NUDGE = 'A verb that lets the dark act may be worth a look.';
const note = (para: number, quote: string, stance: string, nudge: string | null = null, example: unknown = null) =>
  ({ para, quote, stance, why: 'The figure carries the line here.', nudge, example });
const figure = (stat: string, notes: Body[], evidence: Body[]) => ({ stat, claim: 'How the figure works in these lines.', evidence, notes });
const response = (figures: Body[]) => frame('G', { version: 1, steering: { figures, friction: 'Four lines are thin ground.' } });

/** Group G read on `paragraphs`, as the board holds it. */
function readG(paragraphs: readonly string[], body: string): LightboxReadingGroup {
  const decoded = decodeLightboxGroup(body, { group: 'G', lenses: ['steering'], columnCount: paragraphs.length });
  let id = 0;
  const assembled = assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `g${++id}`
  });
  return {
    group: 'G', status: 'ok', lenses: ['steering'], model: 'provider/model-v1', tiles: assembled.tiles,
    withheldBlocks: assembled.withheldBlocks, withheldClaims: assembled.withheldClaims, frictions: assembled.frictions,
    quoteChecks: assembled.quoteChecks
  };
}
const notesOf = (group: LightboxReadingGroup): Note[] => group.tiles.filter((tile): tile is Note => tile.kind === 'steering-note');
const shown = (group: LightboxReadingGroup) => notesOf(group).map((tile) =>
  [tile.title, tile.stance, tile.nudge ?? null, tile.example ?? null, tile.exampleWithheld ?? null, tile.voice ?? null]);
const withheld = (group: LightboxReadingGroup) => group.withheldClaims.map((claim) => [claim.title, claim.reason]);

/** In dialogue, for all three figures: a nudge and example given, none given, and narration beside them. */
const MIXED = response([
  figure('being-verbs', [
    note(1, 'I’m late, I’m really very late', 'leans', 'A word for his hurry may be worth a look, so the lateness is felt.',
      { before: 'I’m really very late', after: 'Late, so late' }),
    note(1, 'I’m really very late', 'compensates'),
    note(2, 'The hall was dark', 'leans', NUDGE, { before: 'The hall was dark', after: 'Dark filled the hall' }),
    note(2, 'the door was shut against the cold', 'leans')
  ], [{ para: 2, quote: 'The hall was dark' }]),
  figure('adverbs', [
    note(1, 'I’m really very late', 'leans', 'A plainer word for his hurry may be worth a look.')
  ], [{ para: 1, quote: 'I’m really very late' }]),
  figure('intensifiers', [
    note(1, 'really very late', 'compensates', 'A word for lateness that needs no lift may be worth a look.', { before: 'really very late', after: 'behind' }),
    note(1, 'I’m late, I’m really very', 'earns')
  ], [{ para: 1, quote: 'really very late' }])
]);

describe('fresh: a note in dialogue keeps its stance, and shows no nudge or example', () => {
  const group = readG(LINES, MIXED);

  it('withholds the reading\'s nudge and example with the host\'s reason, for all three figures, and keeps narration\'s', () => {
    expect(shown(group)).toEqual([
      ['Being verbs · note I', 'leans', null, null, null, VOICE_FRESH],
      ['Being verbs · note II', 'compensates', null, null, null, VOICE_NONE],
      ['Being verbs · note III', 'leans', NUDGE, { before: 'The hall was dark', after: 'Dark filled the hall' }, null, null],
      ['Adverbs (-ly) · note I', 'leans', null, null, null, VOICE_FRESH],
      ['Intensifiers and fillers · note I', 'compensates', null, null, null, VOICE_FRESH],
      // A note that earns has nothing to withhold, in dialogue too.
      ['Intensifiers and fillers · note II', 'earns', null, null, null, null]
    ]);
    // No field is left undefined on a note in dialogue.
    expect(Object.keys(notesOf(group)[0]).filter((key) => ['nudge', 'example', 'exampleWithheld'].includes(key))).toEqual([]);
  });

  it('withholds a note that leans with no nudge in narration, by the gate', () => {
    expect(withheld(group)).toEqual([['Being verbs · note IV', NO_NUDGE_FRESH]]);
  });

  it('reads single-quoted speech as narration: the shared matcher\'s limit', () => {
    const single = readG(LINES, response([figure('being-verbs', [note(4, 'It’s cold in here', 'leans')], [{ para: 4, quote: 'It’s cold in here' }])]));
    expect(withheld(single)).toEqual([['Being verbs · note I', NO_NUDGE_FRESH]]);
  });

  it('keeps a narration note\'s nudge when its quote also holds speech, but anchors its example only in narration', () => {
    const quote = 'It’s cold in here,” she said, and the hall was dark';
    const mixed = readG(LINES, response([figure('being-verbs', [
      note(3, quote, 'leans', NUDGE, { before: 'It’s cold in here', after: 'The cold bites' }),
      note(3, quote, 'leans', NUDGE, { before: 'the hall was dark', after: 'dark filled the hall' })
    ], [{ para: 3, quote }])]));
    expect(shown(mixed)).toEqual([
      ['Being verbs · note I', 'leans', NUDGE, null, EXAMPLE_VOICE, null],
      ['Being verbs · note II', 'leans', NUDGE, { before: 'the hall was dark', after: 'dark filled the hall' }, null, null]
    ]);
  });
});

describe('carried: the rule is applied to the changed text', () => {
  const carry = (group: LightboxReadingGroup, after: readonly string[]) =>
    carryLightboxReadings([group], { readAgainst: 'old', paragraphs: after, averageWordsPerSentence: 12 })[0];
  const edited = (index: number, line: string) => LINES.map((text, at) => (at === index ? line : text));

  it('keeps every note as it was where the text it quotes is unchanged', () => {
    const before = readG(LINES, MIXED);
    expect(shown(carry(before, edited(3, '‘It’s warm in here,’ she said again.')))).toEqual(shown(before));
  });

  it('withholds a narration note\'s nudge and example once its instance stands in dialogue, keeping its stance', () => {
    const carried = carry(readG(LINES, MIXED), edited(1, '“The hall was dark,” she said, and the door was shut against the cold.'));
    const third = notesOf(carried).find((tile) => tile.title === 'Being verbs · note III') as Note;
    expect([third.stance, third.nudge, third.example, third.voice]).toEqual(['leans', undefined, undefined, VOICE_CARRIED]);
    expect(Object.keys(third)).not.toContain('nudge');
    expect(Object.keys(third)).not.toContain('example');
  });

  it('withholds a note with no nudge once its instance leaves dialogue for narration', () => {
    const carried = carry(readG(LINES, MIXED), edited(0, 'I’m late, I’m really very late, said the Rabbit, and he hurried on.'));
    expect(carried.withheldClaims.filter((claim) => claim.kind === 'steering-note').map((claim) => [claim.title, claim.reason])).toEqual([
      // Withheld when it was read, and kept so.
      ['Being verbs · note IV', NO_NUDGE_FRESH],
      ['Being verbs · note I', NO_NUDGE_CARRIED],
      ['Being verbs · note II', NO_NUDGE_CARRIED],
      ['Adverbs (-ly) · note I', NO_NUDGE_CARRIED],
      ['Intensifiers and fillers · note I', NO_NUDGE_CARRIED]
    ]);
    // The note that earns stands wherever its instance is.
    expect(notesOf(carried).map((tile) => tile.title)).toEqual(['Being verbs · note III', 'Intensifiers and fillers · note II']);
  });
});

describe('at Bring: the rule is checked again on the quote as it travels', () => {
  let board: LightboxBoard;
  beforeAll(async () => {
    const measured = await boardWithNumbers(LINES);
    const g = readG(LINES, MIXED);
    board = { ...measured, readings: LIGHTBOX_READING_GROUPS.map((group) => (group === 'G' ? g : emptyLightboxReadingGroup(group))) };
  });
  const tileTitled = (title: string) =>
    board.readings.flatMap((group) => group.tiles).find((tile) => tile.title === title) as LightboxReadingTile;
  const points = (tile: LightboxReadingTile, paragraphs: readonly string[] = LINES) => {
    const prepared = prepareLightboxTileHandoff({ kind: 'tile', boardId: board.boardId, tileId: tile.id }, board, paragraphs);
    if (!prepared.ok) {
      throw new Error(prepared.reason);
    }
    expect(validateWorkshopLightboxTile(JSON.parse(JSON.stringify(prepared.handoff.tile)))).toEqual(prepared.handoff.tile);
    return prepared.handoff.tile.points;
  };

  it('brings a note in dialogue with its stance and the host\'s line, and no nudge or example', () => {
    expect(points(tileTitled('Being verbs · note I'))).toEqual([
      { label: 'Stance', text: 'Leans · Being verbs' },
      { label: 'In dialogue', text: VOICE_FRESH }
    ]);
    expect(points(tileTitled('Being verbs · note II'))).toEqual([
      { label: 'Stance', text: 'Compensates · Being verbs' },
      { label: 'In dialogue', text: VOICE_NONE }
    ]);
  });

  it('brings a narration note with its nudge and its one example', () => {
    expect(points(tileTitled('Being verbs · note III'))).toEqual([
      { label: 'Stance', text: 'Leans · Being verbs' },
      { label: 'Nudge', text: NUDGE },
      { label: 'One way it could go', text: 'The hall was dark → Dark filled the hall' }
    ]);
  });

  it('brings no nudge or example once the quote it travels with stands in dialogue', () => {
    const spoken = LINES.map((text, at) => (at === 1 ? '“The hall was dark,” she said, and the door was shut against the cold.' : text));
    expect(points(tileTitled('Being verbs · note III'), spoken)).toEqual([
      { label: 'Stance', text: 'Leans · Being verbs' },
      { label: 'In dialogue', text: VOICE_CARRIED }
    ]);
  });

  it('tells the Opinion\'s digest a note is in dialogue, and never a nudge or an example', () => {
    const items = lightboxOpinionItems(board);
    const lines = (title: string) => items.find((item) => item.label.endsWith(title))?.lines;
    expect(lines('Being verbs · note I')).toEqual(['claim: The figure carries the line here.', `stance: Leans · figure: Being verbs · ${DIGEST_VOICE}`]);
    expect(lines('Being verbs · note III')).toEqual(['claim: The figure carries the line here.', 'stance: Leans · figure: Being verbs']);
    const digest = items.map((item) => [item.label, ...item.lines].join('\n')).join('\n');
    expect([digest.includes(NUDGE), digest.includes('Dark filled the hall')]).toEqual([false, false]);
  });
});
