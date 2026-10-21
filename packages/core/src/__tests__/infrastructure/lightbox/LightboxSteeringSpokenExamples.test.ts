/**
 * A steering example never rewrites a character's words (PR #162 F-02).
 * A note whose quote holds an instance in narration is a narration note,
 * even when the quote also holds speech, and keeps its nudge. Its example
 * is held to more: its first part must take in no speech at all, so an
 * example crossing from a spoken line into narration, or from narration
 * into a spoken line, is withheld alone with the host's reason, fresh, on
 * carry and at Bring. The reading's typography is straight; the chapter's
 * is curly, so every match here is the verifier's folded one. Every
 * expected value is literal, and the file reaches the rule only through
 * modules the board had before it, so it runs, and fails, on the tree
 * before the fix. Every line is a synthetic sentence written for these
 * tests.
 */
import type { LightboxBoard, LightboxReadingGroup, LightboxReadingTile, LightboxSteeringNoteTile } from '@messages';
import { LIGHTBOX_READING_GROUPS, emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { carryLightboxReadings } from '@/infrastructure/lightbox/LightboxStaleReadings';
import { prepareLightboxTileHandoff } from '@/infrastructure/lightbox/LightboxTileHandoff';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';
import { frame } from './lightboxReadingFixtures';

/** ¶1 crosses from a spoken line into narration; ¶2 from narration into a spoken line. */
const LINES = [
  '“I’m cold,” she was crying.',
  'She was shaking, “I’m so cold.”'
];
/** The same words with no line spoken: ¶1's closing mark opens nothing, and ¶2 has no marks. */
const UNSPOKEN = [
  'I’m cold,” she was crying.',
  'She was shaking, I’m so cold.'
];

/** The host's words, literal. */
const SPEECH = 'Its example\'s first part takes in words a character speaks, the character\'s voice, so it is not shown.';
const VOICE = 'Its example\'s first part holds an instance only in dialogue, the character\'s voice, so it is not shown.';
const SPEECH_BRING = 'Not brought: its first part takes in words a character speaks, the character\'s voice.';

const NUDGE = 'An action for the cold may be worth a look.';
/** The reading quotes in straight typography. */
const INTO_NARRATION = { quote: 'I\'m cold," she was crying', example: { before: 'I\'m cold," she was crying', after: 'Warmth filled her as tears fell' } };
const INTO_SPEECH = { quote: 'She was shaking, "I\'m so cold', example: { before: 'She was shaking, "I\'m so cold', after: 'She shook with cold' } };

type Body = Record<string, unknown>;
const note = (para: number, quote: string, example: Body | null) =>
  ({ para, quote, stance: 'leans', why: 'A state carries the cold here.', nudge: NUDGE, example });

function readG(paragraphs: readonly string[], notes: readonly Body[]): LightboxReadingGroup {
  const response = frame('G', {
    version: 1,
    steering: {
      figures: [{ stat: 'being-verbs', claim: 'States carry the cold.', evidence: [{ para: notes[0].para, quote: notes[0].quote }], notes }],
      friction: 'Two lines are thin ground.'
    }
  });
  const decoded = decodeLightboxGroup(response, { group: 'G', lenses: ['steering'], columnCount: paragraphs.length });
  let id = 0;
  const assembled = assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `g${++id}`
  });
  return {
    group: 'G', status: 'ok', lenses: ['steering'], tiles: assembled.tiles, withheldBlocks: assembled.withheldBlocks,
    withheldClaims: assembled.withheldClaims, frictions: assembled.frictions, quoteChecks: assembled.quoteChecks
  };
}

const notesOf = (group: LightboxReadingGroup) =>
  group.tiles.filter((tile): tile is LightboxSteeringNoteTile => tile.kind === 'steering-note');
/** Each note as drawn: where its quote stands, its stance, nudge, example, why the example is not shown, and any voice line. */
const shown = (group: LightboxReadingGroup) => notesOf(group).map((tile) => [
  tile.evidence[0]?.paragraph, tile.evidence[0]?.text, tile.stance, tile.nudge ?? null, tile.example ?? null,
  tile.exampleWithheld ?? null, (tile as LightboxSteeringNoteTile & { voice?: string }).voice ?? null
]);
/** The group with each note's example as a read before the fix held it: shown, with no reason. */
const asHeldBefore = (group: LightboxReadingGroup, examples: ReadonlyArray<{ before: string; after: string }>): LightboxReadingGroup => ({
  ...group,
  tiles: group.tiles.map((tile) => {
    if (tile.kind !== 'steering-note') {
      return tile;
    }
    const { exampleWithheld: _withheld, ...rest } = tile;
    return { ...rest, example: examples[notesOf(group).indexOf(tile)] };
  })
});

describe('fresh: an example that takes in speech is withheld; its note and nudge stand', () => {
  it('withholds an example crossing either way, with the host\'s reason, and keeps each narration note\'s nudge', () => {
    const group = readG(LINES, [note(1, INTO_NARRATION.quote, INTO_NARRATION.example), note(2, INTO_SPEECH.quote, INTO_SPEECH.example)]);
    expect(shown(group)).toEqual([
      [1, 'I’m cold,” she was crying', 'leans', NUDGE, null, SPEECH, null],
      [2, 'She was shaking, “I’m so cold', 'leans', NUDGE, null, SPEECH, null]
    ]);
    expect(group.withheldClaims).toEqual([]);
  });

  it('still shows an example confined to the narration of a mixed quote, and withholds one confined to speech as voice', () => {
    const group = readG(LINES, [
      note(1, INTO_NARRATION.quote, { before: 'she was crying', after: 'she wept' }),
      note(2, INTO_SPEECH.quote, { before: 'She was shaking', after: 'She shook' }),
      note(2, INTO_SPEECH.quote, { before: 'I\'m so cold', after: 'So cold' })
    ]);
    expect(shown(group)).toEqual([
      [1, 'I’m cold,” she was crying', 'leans', NUDGE, { before: 'she was crying', after: 'she wept' }, null, null],
      [2, 'She was shaking, “I’m so cold', 'leans', NUDGE, { before: 'She was shaking', after: 'She shook' }, null, null],
      [2, 'She was shaking, “I’m so cold', 'leans', NUDGE, null, VOICE, null]
    ]);
  });

  it('shows the same example where none of its words is spoken', () => {
    const group = readG(UNSPOKEN, [note(1, INTO_NARRATION.quote, INTO_NARRATION.example)]);
    expect(shown(group)).toEqual([
      [1, 'I’m cold,” she was crying', 'leans', NUDGE, { before: 'I’m cold,” she was crying', after: 'Warmth filled her as tears fell' }, null, null]
    ]);
  });
});

describe('carried: an example that now takes in speech is withheld on the changed text', () => {
  const carry = (group: LightboxReadingGroup, after: readonly string[]) =>
    carryLightboxReadings([group], { readAgainst: 'old', paragraphs: after, averageWordsPerSentence: 5 })[0];

  it('withholds an example once its words open a spoken line, keeping the note and its nudge', () => {
    const read = readG(UNSPOKEN, [note(1, INTO_NARRATION.quote, INTO_NARRATION.example)]);
    expect(shown(carry(read, LINES))).toEqual([[1, 'I’m cold,” she was crying', 'leans', NUDGE, null, SPEECH, null]]);
  });

  it('withholds a crossing example held before the fix, either way, when its note moves to a new paragraph', () => {
    const read = asHeldBefore(
      readG(LINES, [note(1, INTO_NARRATION.quote, INTO_NARRATION.example), note(2, INTO_SPEECH.quote, INTO_SPEECH.example)]),
      [{ before: 'I’m cold,” she was crying', after: 'Warmth filled her as tears fell' }, { before: 'She was shaking, “I’m so cold', after: 'She shook with cold' }]
    );
    expect(shown(carry(read, ['The fire had gone out.', ...LINES]))).toEqual([
      [2, 'I’m cold,” she was crying', 'leans', NUDGE, null, SPEECH, null],
      [3, 'She was shaking, “I’m so cold', 'leans', NUDGE, null, SPEECH, null]
    ]);
  });
});

describe('at Bring: an example that takes in speech does not travel', () => {
  const boardOf = (group: LightboxReadingGroup): LightboxBoard => ({
    ...makeBoard(2),
    readings: LIGHTBOX_READING_GROUPS.map((id) => (id === 'G' ? group : emptyLightboxReadingGroup(id)))
  });
  const bring = (group: LightboxReadingGroup, index: number, paragraphs: readonly string[]) => {
    const tile = notesOf(group)[index] as LightboxReadingTile;
    const board = boardOf(group);
    const prepared = prepareLightboxTileHandoff({ kind: 'tile', boardId: board.boardId, tileId: tile.id }, board, paragraphs);
    if (!prepared.ok) {
      throw new Error(prepared.reason);
    }
    return prepared.handoff.tile.points;
  };
  const withheldPoints = [
    { label: 'Stance', text: 'Leans · Being verbs' },
    { label: 'Nudge', text: NUDGE },
    { label: 'Example withheld', text: SPEECH_BRING }
  ];

  it('says the example was withheld once its words open a spoken line, and brings the note and nudge', () => {
    const read = readG(UNSPOKEN, [note(1, INTO_NARRATION.quote, INTO_NARRATION.example)]);
    expect(bring(read, 0, UNSPOKEN)[2]).toEqual({ label: 'One way it could go', text: 'I’m cold,” she was crying → Warmth filled her as tears fell' });
    expect(bring(read, 0, LINES)).toEqual(withheldPoints);
  });

  it('says so for a crossing example held before the fix, either way', () => {
    const read = asHeldBefore(
      readG(LINES, [note(1, INTO_NARRATION.quote, INTO_NARRATION.example), note(2, INTO_SPEECH.quote, INTO_SPEECH.example)]),
      [{ before: 'I’m cold,” she was crying', after: 'Warmth filled her as tears fell' }, { before: 'She was shaking, “I’m so cold', after: 'She shook with cold' }]
    );
    expect(bring(read, 0, LINES)).toEqual(withheldPoints);
    expect(bring(read, 1, LINES)).toEqual(withheldPoints);
  });
});
