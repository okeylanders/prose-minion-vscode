/**
 * The saved board's format 1 (ADR 2026-10-19 D12 addendum; Slice 5A; epic
 * decision 32): every tile kind and every measured layer round-trips; the
 * file's keys are exact and its faults host-worded; a tile or group note
 * that fails is dropped and counted; the measured layers, the paragraph
 * model, a group's own fields and its stale marks decode whole or not at
 * all; the text must be the text the board was measured from.
 *
 * The board is the production service's measure of ¶1–¶8 of "Alice's
 * Adventures in Wonderland" (1865, public domain), read from the worked
 * examples with every lens on (`lightboxSavedBoardFixtures`).
 */
import type { LightboxBoard, LightboxReadingTile, LightboxReadingTileKind, LightboxVerifiedQuote } from '@messages';
import { LIGHTBOX_TILE_REGISTER } from '@shared/constants/lightbox';
import { lightboxContentHash } from '@/infrastructure/lightbox/LightboxParagraphs';
import {
  LIGHTBOX_BOARD_INVALID_REASONS,
  decodeLightboxBoardFile,
  encodeLightboxBoardFile,
  lightboxBoardOfFile,
  type LightboxBoardDecoded
} from '@/infrastructure/storage/LightboxBoardCodec';
import { LIGHTBOX_BOARD_TILE_DECODERS } from '@/infrastructure/storage/LightboxBoardTileCodec';
import { Decoder, object, oneOf, optional, ordinal, text } from '@/infrastructure/storage/LightboxBoardSchema';
import { everyKindBoard } from '@/__tests__/infrastructure/lightbox/lightboxSavedBoardFixtures';

const SAVED_AT = new Date('2026-10-22T14:05:09.123Z');
const READING_KINDS = (Object.keys(LIGHTBOX_TILE_REGISTER) as Array<keyof typeof LIGHTBOX_TILE_REGISTER>)
  .filter((kind) => !['stats', 'top-words', 'parts-of-speech'].includes(kind))
  .sort() as LightboxReadingTileKind[];

let BOARD: LightboxBoard;
let TEXT: string;
let JSON_TEXT: string;

beforeAll(async () => {
  ({ board: BOARD, text: TEXT } = await everyKindBoard());
  JSON_TEXT = encodeLightboxBoardFile({ board: BOARD, text: TEXT, savedAt: SAVED_AT });
});

/** The file as plain JSON, to edit. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the file is edited as plain JSON.
function fileJson(): Record<string, any> {
  return JSON.parse(JSON_TEXT);
}

function decodeEdited(edit: (file: ReturnType<typeof fileJson>) => void): LightboxBoardDecoded {
  const file = fileJson();
  edit(file);
  return decodeLightboxBoardFile(JSON.stringify(file));
}

function boardOf(decoded: LightboxBoardDecoded): LightboxBoard {
  if (decoded.kind !== 'board') {
    throw new Error(`expected a board, got ${JSON.stringify(decoded)}`);
  }
  const held = lightboxBoardOfFile(decoded.file);
  if (held.kind !== 'board') {
    throw new Error('expected one source');
  }
  return held.board;
}

function tilesOf(board: LightboxBoard): LightboxReadingTile[] {
  return board.readings.flatMap((group) => group.tiles);
}

describe('LightboxBoardCodec: the round trip', () => {
  it('holds every reading kind on the fixture board, with the Opinion standing', () => {
    expect([...new Set(tilesOf(BOARD).map((tile) => tile.kind))].sort()).toEqual(READING_KINDS);
    expect(READING_KINDS).toHaveLength(32);
  });

  it('writes the file\'s envelope: format 1, its kind, when it was saved, and the board with one source and its text', () => {
    const file = fileJson();
    expect(Object.keys(file)).toEqual(['formatVersion', 'kind', 'savedAt', 'board']);
    expect(file.formatVersion).toBe(1);
    expect(file.kind).toBe('lightbox-board');
    expect(file.savedAt).toBe('2026-10-22T14:05:09.123Z');
    expect(Object.keys(file.board)).toEqual(['boardId', 'rules', 'sources', 'paragraphs', 'ribbon', 'measured', 'readings']);
    expect(file.board.sources).toHaveLength(1);
    expect(file.board.sources[0].text).toBe(TEXT);
    expect(file.board.sources[0].displayPath).toBe('Drafts/alice-1.md');
    expect(file.board.paragraphs.map((paragraph: { source: number; index: number }) => [paragraph.source, paragraph.index]))
      .toEqual([[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8]]);
    expect(file.board.rules).toEqual({
      paragraphs: 'blank-line-2026-10-19',
      sentences: 'closing-marks-speech-tags-2026-10-21',
      dialogue: 'double-quotes-2026-10-19',
      beingVerbs: 'contractions-next-word-2026-10-21',
      opinionBasis: 'item-data-2026-10-22'
    });
    // The board carries no webview preference: nothing names a view, a filter, a pin or a lens toggle.
    expect(JSON_TEXT).not.toMatch(/"(?:lightboxOpinionViews|lightboxFilter|lightboxSelectedItem|lightboxLensesOff|chosen)"/);
  });

  it('reads back the board it wrote, whole, with nothing dropped', () => {
    const decoded = decodeLightboxBoardFile(JSON_TEXT);
    expect(decoded.kind === 'board' && { dropped: decoded.dropped, droppedAt: decoded.droppedAt }).toEqual({ dropped: 0, droppedAt: [] });
    expect(boardOf(decoded)).toEqual(BOARD);
    const held = decoded.kind === 'board' ? lightboxBoardOfFile(decoded.file) : undefined;
    expect(held?.kind === 'board' && held.text).toBe(TEXT);
  });

  it('writes the same text again from what it read, byte for byte', () => {
    expect(encodeLightboxBoardFile({ board: boardOf(decodeLightboxBoardFile(JSON_TEXT)), text: TEXT, savedAt: SAVED_AT })).toBe(JSON_TEXT);
  });

  it.each(READING_KINDS)('round-trips every %s tile, field for field', (kind) => {
    const before = tilesOf(BOARD).filter((tile) => tile.kind === kind);
    const after = tilesOf(boardOf(decodeLightboxBoardFile(JSON_TEXT))).filter((tile) => tile.kind === kind);
    expect(before.length).toBeGreaterThan(0);
    expect(after).toEqual(before);
  });

  it.each([
    'headline', 'standards', 'topWords', 'partsOfSpeech', 'phrases', 'styleFlags', 'hapax', 'sentences', 'numbers', 'sections', 'steering'
  ] as const)('round-trips the measured set\'s %s', (layer) => {
    expect(boardOf(decodeLightboxBoardFile(JSON_TEXT)).measured[layer]).toEqual(BOARD.measured[layer]);
  });

  it('round-trips a preset\'s comparison and a figure\'s range, which the fixture board measures without', () => {
    expect(BOARD.measured.standards).toBeUndefined();
    const varied = structuredClone(BOARD);
    varied.measured.standards = {
      items: [
        { key: 'wordsPerSentence', label: 'Words per sentence', value: 33.9, standard: { min: 12, max: 20 }, status: 'above' },
        { key: 'pacing', label: 'Pacing', value: 'Very slow', status: 'n/a' }
      ],
      publishingFormat: { trimLabel: '6 × 9 in', wordsPerPage: 300, estimatedPageCount: 2, pageCountRange: { min: 1 }, status: 'within' }
    };
    varied.measured.numbers.rows[0] = { ...varied.measured.numbers.rows[0], range: { min: 12, max: 20, status: 'above' } };
    expect(boardOf(decodeLightboxBoardFile(encodeLightboxBoardFile({ board: varied, text: TEXT, savedAt: SAVED_AT })))).toEqual(varied);
  });

  it('round-trips the paragraph model (with each paragraph\'s sentence lengths), the ribbon and the source', () => {
    const back = boardOf(decodeLightboxBoardFile(JSON_TEXT));
    expect(back.paragraphs).toEqual(BOARD.paragraphs);
    expect(back.paragraphs.map((paragraph) => paragraph.sentenceWords.length)).toEqual(BOARD.paragraphs.map((paragraph) => paragraph.sentences));
    expect(back.ribbon).toEqual(BOARD.ribbon);
    expect(back.source).toEqual(BOARD.source);
    expect(back.measured.hapax).toHaveLength(BOARD.measured.headline.hapaxCount);
  });

  it('round-trips what a board gathers later: stale marks, a failed group, withheld claims and blocks, set-asides, a spark set aside, a note in dialogue and a withheld example', () => {
    const varied = structuredClone(BOARD);
    const [groupA, groupB, groupC] = varied.readings;
    groupA.staleLenses = [{ lens: 'motif', readAgainst: 'f'.repeat(64) }];
    groupB.status = 'failed';
    groupB.error = 'The call timed out.';
    groupB.withheldClaims.push({ kind: 'character', lens: 'characters', title: 'The sister', reason: 'No quote was found.', quotes: [{ paragraph: 9, reason: 'undeclared-paragraph', foundIn: [2] }] });
    groupB.withheldBlocks.push({ kind: 'voice', lens: 'voice', reason: 'The block broke its rules.' });
    groupC.frictions = groupC.frictions.map((friction) => (friction.lens === 'lineage' ? { ...friction, setAside: [{ title: 'Orpheus', reason: 'No descent is looked back on.' }] } : friction));
    const spark = groupC.tiles.find((tile) => tile.kind === 'spark');
    if (spark?.kind === 'spark') {
      spark.dismissedOrder = 1;
    }
    const notes = varied.readings.flatMap((group) => group.tiles).filter((tile) => tile.kind === 'steering-note');
    const [earns, leans] = [notes.find((tile) => tile.kind === 'steering-note' && tile.stance === 'earns'), notes.find((tile) => tile.kind === 'steering-note' && tile.nudge !== undefined)];
    if (earns?.kind === 'steering-note' && leans?.kind === 'steering-note') {
      earns.voice = 'Its instance is in dialogue, the character\'s voice.';
      delete leans.example;
      leans.exampleWithheld = 'Its example was withheld.';
    }
    const json = encodeLightboxBoardFile({ board: varied, text: TEXT, savedAt: SAVED_AT });
    expect(boardOf(decodeLightboxBoardFile(json))).toEqual(varied);
    expect(json).toContain('"readAgainst"');
    expect(json).toContain('"dismissedOrder": 1');
    expect(json).toContain('"exampleWithheld"');
  });
});

describe('LightboxBoardCodec: what it refuses, in host words', () => {
  const refused = (decoded: LightboxBoardDecoded) => (decoded.kind === 'invalid' ? { reason: decoded.reason, at: decoded.at, formatVersion: decoded.formatVersion } : 'read');

  it('refuses text that is not JSON, JSON that is not a board, and a board in another format, by its number', () => {
    expect(refused(decodeLightboxBoardFile('{ "formatVersion": 1, '))).toEqual({ reason: 'not-json', at: undefined, formatVersion: undefined });
    expect(refused(decodeLightboxBoardFile('[1, 2]'))).toEqual({ reason: 'not-a-board', at: undefined, formatVersion: undefined });
    expect(refused(decodeEdited((file) => { delete file.kind; }))).toEqual({ reason: 'not-a-board', at: undefined, formatVersion: undefined });
    expect(refused(decodeEdited((file) => { file.formatVersion = 2; }))).toEqual({ reason: 'format', at: undefined, formatVersion: 2 });
    expect(refused(decodeEdited((file) => { file.formatVersion = '1'; }))).toEqual({ reason: 'format', at: undefined, formatVersion: undefined });
    expect(refused(decodeEdited((file) => { delete file.formatVersion; }))).toEqual({ reason: 'format', at: undefined, formatVersion: undefined });
  });

  it('refuses a key it does not read wherever the board must be whole, and never names the key', () => {
    const cases: Array<[(file: ReturnType<typeof fileJson>) => void, string]> = [
      [(file) => { file.zebraStripes = 1; }, 'file'],
      [(file) => { file.board.zebraStripes = 1; }, 'file.board'],
      [(file) => { file.board.sources[0].zebraStripes = 1; }, 'file.board.sources[0]'],
      [(file) => { file.board.paragraphs[3].zebraStripes = 1; }, 'file.board.paragraphs[3]'],
      [(file) => { file.board.measured.headline.zebraStripes = 1; }, 'file.board.measured.headline'],
      [(file) => { file.board.measured.sections.fired.zebraStripes = []; }, 'file.board.measured.sections.fired'],
      [(file) => { file.board.readings[2].zebraStripes = 1; }, 'file.board.readings[2]']
    ];
    for (const [edit, at] of cases) {
      const decoded = decodeEdited(edit);
      expect(refused(decoded)).toEqual({ reason: 'unknown-field', at, formatVersion: undefined });
      expect(JSON.stringify(decoded)).not.toContain('zebraStripes');
    }
  });

  it('drops a tile with a key it does not read, counts it, and keeps its siblings; the key is never named', () => {
    const decoded = decodeEdited((file) => { file.board.readings[0].tiles[1].zebraStripes = true; });
    expect(decoded.kind === 'board' && { dropped: decoded.dropped, droppedAt: decoded.droppedAt }).toEqual({
      dropped: 1, droppedAt: ['file.board.readings[0].tiles[1]']
    });
    expect(boardOf(decoded).readings[0].tiles.map((tile) => tile.id)).toEqual(BOARD.readings[0].tiles.filter((_tile, index) => index !== 1).map((tile) => tile.id));
    expect(JSON.stringify(decoded)).not.toContain('zebraStripes');
  });

  it('drops and counts invalid tiles and group notes, each alone', () => {
    const decoded = decodeEdited((file) => {
      file.board.readings[0].tiles[0].kind = 'mood-ring'; // a kind this build does not know
      file.board.readings[1].tiles[0].evidence[0].match = 'roughly'; // a word outside its vocabulary
      file.board.readings[3].tiles[0].support = 'many'; // not a list
      file.board.readings[4].frictions[0].friction = 7;
      file.board.readings[5].quoteChecks[0].checked = -1;
      file.board.readings[2].withheldClaims = [{ kind: 'lineage', lens: 'lineage', title: 'x', reason: 'y' }]; // no quotes
      file.board.readings[2].withheldBlocks = [{ kind: 'lineage', lens: 'lineage', reason: 'y', extra: 1 }];
    });
    expect(decoded.kind === 'board' && { dropped: decoded.dropped, droppedAt: decoded.droppedAt }).toEqual({
      dropped: 7,
      droppedAt: [
        'file.board.readings[0].tiles[0]',
        'file.board.readings[1].tiles[0]',
        'file.board.readings[2].withheldBlocks[0]',
        'file.board.readings[2].withheldClaims[0]',
        'file.board.readings[3].tiles[0]',
        'file.board.readings[4].frictions[0]',
        'file.board.readings[5].quoteChecks[0]'
      ]
    });
    const back = boardOf(decoded);
    expect(back.readings[0].tiles).toHaveLength(BOARD.readings[0].tiles.length - 1);
    expect(back.readings[2].withheldClaims).toEqual([]);
    expect(back.readings[4].frictions).toHaveLength(BOARD.readings[4].frictions.length - 1);
  });

  it('refuses the whole board for a fault in a stale mark, a group\'s own field, a measured layer or the paragraph model', () => {
    const cases: Array<[string, (file: ReturnType<typeof fileJson>) => void, ReturnType<typeof refused>]> = [
      ['a stale mark without its hash', (file) => { file.board.readings[0].staleLenses = [{ lens: 'motif' }]; },
        { reason: 'shape', at: 'file.board.readings[0].staleLenses[0].readAgainst', formatVersion: undefined }],
      ['a group still running', (file) => { file.board.readings[0].status = 'running'; },
        { reason: 'shape', at: 'file.board.readings[0].status', formatVersion: undefined }],
      ['a group with lenses in flight', (file) => { file.board.readings[0].pending = ['motif']; },
        { reason: 'shape', at: 'file.board.readings[0].pending', formatVersion: undefined }],
      ['groups out of order', (file) => { file.board.readings.reverse(); },
        { reason: 'shape', at: 'file.board.readings', formatVersion: undefined }],
      ['a measured paragraph outside the board', (file) => { file.board.measured.hapax[0].paragraph = 9; },
        { reason: 'shape', at: 'file.board.measured.hapax[0].paragraph', formatVersion: undefined }],
      ['a style flag outside its vocabulary', (file) => { file.board.measured.styleFlags[0].id = 'run-ons'; },
        { reason: 'shape', at: 'file.board.measured.styleFlags[0].id', formatVersion: undefined }],
      ['a paragraph out of its place', (file) => { file.board.paragraphs[2].index = 4; },
        { reason: 'shape', at: 'file.board.paragraphs[2]', formatVersion: undefined }],
      ['a paragraph past its source\'s text', (file) => { file.board.paragraphs[7].end = 1_000_000; },
        { reason: 'shape', at: 'file.board.paragraphs[7]', formatVersion: undefined }],
      ['a paragraph naming no source', (file) => { file.board.paragraphs[0].source = 1; },
        { reason: 'shape', at: 'file.board.paragraphs[0]', formatVersion: undefined }],
      ['a source that counts other paragraphs', (file) => { file.board.sources[0].paragraphCount = 9; },
        { reason: 'shape', at: 'file.board.sources[0].paragraphCount', formatVersion: undefined }],
      ['a rule id that is not one', (file) => { file.board.rules.sentences = 'Closing Marks!'; },
        { reason: 'shape', at: 'file.board.rules.sentences', formatVersion: undefined }]
    ];
    for (const [name, edit, expected] of cases) {
      expect({ name, refused: refused(decodeEdited(edit)) }).toEqual({ name, refused: expected });
    }
  });

  it('refuses text that is not the text the board was measured from', () => {
    expect(refused(decodeEdited((file) => { file.board.sources[0].text = `${file.board.sources[0].text} More.`; })))
      .toEqual({ reason: 'text', at: 'file.board.sources[0].text', formatVersion: undefined });
  });

  it('reads a newer build\'s sentence rule id, keeping it, but refuses an Opinion basis it cannot judge', () => {
    expect(boardOf(decodeEdited((file) => { file.board.rules.sentences = 'some-later-rule-2027-01-01'; })).rules.sentences)
      .toBe('some-later-rule-2027-01-01');
    expect(refused(decodeEdited((file) => { file.board.rules.opinionBasis = 'rendered-text-2026-10-21'; })))
      .toEqual({ reason: 'basis', at: 'file.board.rules.opinionBasis', formatVersion: undefined });
  });

  it('words every reason as the host\'s', () => {
    /* eslint-disable @typescript-eslint/naming-convention -- the reasons' kebab-case words. */
    expect(LIGHTBOX_BOARD_INVALID_REASONS).toEqual({
      'not-json': 'It is not readable JSON.',
      'not-a-board': 'It is not a saved Lightbox board.',
      format: 'It was saved in a board format this version does not read.',
      'unknown-field': 'It holds fields this version does not read.',
      shape: 'Its contents do not have a saved board\'s shape.',
      text: 'Its saved text does not match the text its board was measured from.',
      basis: 'Its Opinion was read under a citation basis this version cannot judge.'
    });
    /* eslint-enable @typescript-eslint/naming-convention */
  });
});

describe('LightboxBoardCodec: sources as a list', () => {
  it('reads a board of two sources, each paragraph addressed by its source, and this build declines to open it', () => {
    const decoded = decodeEdited((file) => {
      const second = 'A second file.\n\nIts second paragraph.';
      file.board.sources.push({ ...file.board.sources[0], displayPath: 'Drafts/second.md', text: second,
        contentHash: lightboxContentHash(second), paragraphCount: 2 });
      file.board.paragraphs.push(
        { ...file.board.paragraphs[0], source: 1, index: 9, start: 0, end: 14 },
        { ...file.board.paragraphs[0], source: 1, index: 10, start: 16, end: 37 }
      );
    });
    expect(decoded.kind === 'board' && decoded.file.board.sources.map((source) => [source.displayPath, source.paragraphCount]))
      .toEqual([['Drafts/alice-1.md', 8], ['Drafts/second.md', 2]]);
    expect(decoded.kind === 'board' && lightboxBoardOfFile(decoded.file)).toEqual({ kind: 'several-sources', sources: 2 });
  });
});

describe('LightboxBoardCodec: exhaustive over the closed tile-kind union', () => {
  it('has one decoder per reading tile kind the register knows', () => {
    expect(Object.keys(LIGHTBOX_BOARD_TILE_DECODERS).sort()).toEqual(READING_KINDS);
  });

  it('holds a shape to its type: a missing, extra or mistyped field, a bare optional or a missing kind does not compile', () => {
    const match = oneOf({ exact: true, normalized: true });
    const probes: Array<Decoder<unknown> | object> = [
      // @ts-expect-error a missing required field (`match`)
      object<LightboxVerifiedQuote>({ paragraph: ordinal, text, note: optional(text) }),
      // @ts-expect-error a field the type does not have
      object<LightboxVerifiedQuote>({ paragraph: ordinal, text, match, note: optional(text), colour: text }),
      // @ts-expect-error a decoder of the wrong type (`paragraph` is a number)
      object<LightboxVerifiedQuote>({ paragraph: text, text, match }),
      // @ts-expect-error an optional field read as if required
      object<LightboxVerifiedQuote>({ paragraph: ordinal, text, match, note: text })
    ];
    // @ts-expect-error a map missing every kind but one
    const kinds: { readonly [K in LightboxReadingTileKind]: Decoder<unknown> } = { motif: text };
    expect(probes).toHaveLength(4);
    expect(Object.keys(kinds)).toEqual(['motif']);
  });
});
