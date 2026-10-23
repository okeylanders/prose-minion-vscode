/**
 * A saved board's name in format 1 (Slice 5A.1; epic decision 33; ADR
 * 2026-10-19 D12 addendum).
 *
 * - **The rule** (`lightboxBoardName`): trimmed, one line, no control
 *   character, at most 120 characters; empty means unnamed.
 * - **The codec.** A named board round-trips with its name right after its
 *   id, and an unnamed one is written exactly as before: `board-v1.json`
 *   still reads, and writes back, byte for byte. `board-v1-named.json`, a
 *   named board this build wrote, reads with its name.
 * - **A name that does not read** (a hand-edited file) is left out and
 *   counted, as a dropped tile is: the board opens whole, unnamed (the
 *   writer-data rule, decision 32: a board is never lost over its name).
 * - **No rule id moves** with a name: a name is not a measurement.
 *
 * The boards are the production service's measure of ¶1–¶8 of "Alice's
 * Adventures in Wonderland" (Lewis Carroll, 1865, public domain). Names are
 * made up for these tests.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LightboxBoard } from '@messages';
import {
  LIGHTBOX_BOARD_NAME_CHARACTERS,
  checkLightboxBoardName,
  isSavedLightboxBoardName
} from '@shared/constants/lightboxBoardName';
import { emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import {
  decodeLightboxBoardFile,
  encodeLightboxBoardFile,
  lightboxBoardOfFile,
  namedLightboxBoardFile,
  writeLightboxBoardFile,
  type LightboxBoardDecoded
} from '@/infrastructure/storage/LightboxBoardCodec';
import { everyKindBoard } from '@/__tests__/infrastructure/lightbox/lightboxSavedBoardFixtures';

const FIXTURES = path.resolve(__dirname, '../../fixtures');
const SAVED_AT = new Date('2026-10-22T14:05:09.123Z');
/** The writer's kind of name: a chapter version, a note and a model's nickname. Made up. */
const NAME = '3.2.1 - after the cut - model B';

let BOARD: LightboxBoard;
let TEXT: string;

beforeAll(async () => {
  ({ board: BOARD, text: TEXT } = await everyKindBoard());
});

const measuredOnly = (board: LightboxBoard): LightboxBoard =>
  ({ ...board, readings: board.readings.map((group) => emptyLightboxReadingGroup(group.group)) });

/* eslint-disable @typescript-eslint/no-explicit-any -- the file is edited as plain JSON, as a writer's editor would. */
function editedName(name: any): LightboxBoardDecoded {
  const file = JSON.parse(encodeLightboxBoardFile({ board: BOARD, text: TEXT, savedAt: SAVED_AT, name: NAME }));
  file.board.name = name;
  return decodeLightboxBoardFile(JSON.stringify(file));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function decoded(json: string) {
  const read = decodeLightboxBoardFile(json);
  if (read.kind !== 'board') {
    throw new Error(`expected a board, got ${JSON.stringify(read)}`);
  }
  return read;
}

describe('the name rule (lightboxBoardName)', () => {
  it('trims a name, and reads an empty or blank one as unnamed', () => {
    expect(checkLightboxBoardName(`  ${NAME}\u00a0`)).toEqual({ kind: 'named', name: NAME });
    expect(checkLightboxBoardName('')).toEqual({ kind: 'unnamed' });
    expect(checkLightboxBoardName('   ')).toEqual({ kind: 'unnamed' });
  });

  it('holds a name to one line: no tab, line break, other control character, or line separator', () => {
    for (const name of ['3.2.1\tafter', '3.2.1\nafter', '3.2.1\r\nafter', '3.2.1\u0007after', '3.2.1\u2028after', '3.2.1\u2029after', '3.2.1\u0085after']) {
      expect(checkLightboxBoardName(name)).toEqual({ kind: 'invalid', fault: 'not-one-line' });
    }
  });

  it('allows 120 characters and refuses 121, and keeps any other letter or sign', () => {
    expect(LIGHTBOX_BOARD_NAME_CHARACTERS).toBe(120);
    expect(checkLightboxBoardName('x'.repeat(120))).toEqual({ kind: 'named', name: 'x'.repeat(120) });
    expect(checkLightboxBoardName('x'.repeat(121))).toEqual({ kind: 'invalid', fault: 'too-long' });
    // Trimmed first: spaces around a 120-character name do not count.
    expect(checkLightboxBoardName(` ${'x'.repeat(120)} `).kind).toBe('named');
    expect(checkLightboxBoardName('Chapitre 3 — après la coupe · « B » ✂')).toEqual({ kind: 'named', name: 'Chapitre 3 — après la coupe · « B » ✂' });
  });

  it('says which names a file may hold: exactly as a board saves one', () => {
    expect(isSavedLightboxBoardName(NAME)).toBe(true);
    expect(isSavedLightboxBoardName(` ${NAME}`)).toBe(false);
    expect(isSavedLightboxBoardName('')).toBe(false);
  });
});

describe('format 1 with a name', () => {
  it('writes a named board\'s name right after its id, and reads it back, with nothing dropped and the same rule ids', () => {
    const json = encodeLightboxBoardFile({ board: BOARD, text: TEXT, savedAt: SAVED_AT, name: NAME });
    expect(Object.keys(JSON.parse(json).board)).toEqual(['boardId', 'name', 'rules', 'sources', 'paragraphs', 'ribbon', 'measured', 'readings']);

    const read = decoded(json);
    expect(read.dropped).toBe(0);
    expect(read.file.board.name).toBe(NAME);
    expect(read.file.board.rules).toEqual(BOARD.rules);
    const held = lightboxBoardOfFile(read.file);
    expect(held).toEqual({ kind: 'board', board: BOARD, text: TEXT, name: NAME });
    // Written again from what it read: byte for byte.
    expect(writeLightboxBoardFile(read.file)).toBe(json);
    expect(encodeLightboxBoardFile({ board: BOARD, text: TEXT, savedAt: SAVED_AT, name: NAME })).toBe(json);
  });

  it('writes an unnamed board exactly as before: no name key at all', () => {
    const json = encodeLightboxBoardFile({ board: BOARD, text: TEXT, savedAt: SAVED_AT });
    expect(json).not.toContain('"name"');
    const read = decoded(json);
    expect('name' in read.file.board).toBe(false);
    expect(lightboxBoardOfFile(read.file)).toEqual({ kind: 'board', board: BOARD, text: TEXT });
  });

  it('names and unnames a file in place, keeping everything else: its save time, its board and its text', () => {
    const unnamed = decoded(encodeLightboxBoardFile({ board: BOARD, text: TEXT, savedAt: SAVED_AT })).file;
    const named = namedLightboxBoardFile(unnamed, NAME);
    expect(writeLightboxBoardFile(named)).toBe(encodeLightboxBoardFile({ board: BOARD, text: TEXT, savedAt: SAVED_AT, name: NAME }));
    expect(writeLightboxBoardFile(namedLightboxBoardFile(named, undefined))).toBe(writeLightboxBoardFile(unnamed));
    expect(namedLightboxBoardFile(named, 'model C').board.name).toBe('model C');
  });

  it('still reads board-v1.json, written before names, unnamed and byte for byte', () => {
    const json = fs.readFileSync(path.join(FIXTURES, 'board-v1.json'), 'utf8');
    const read = decoded(json);
    expect(read.dropped).toBe(0);
    expect('name' in read.file.board).toBe(false);
    expect(writeLightboxBoardFile(read.file)).toBe(json);
  });

  it('reads board-v1-named.json, a named board this build wrote, with its name', () => {
    // The builder: the every-kind board measured only, named. Run with LIGHTBOX_WRITE_BOARD_FIXTURE=1 to write it.
    const built = encodeLightboxBoardFile({ board: measuredOnly(BOARD), text: TEXT, savedAt: SAVED_AT, name: NAME });
    const fixture = path.join(FIXTURES, 'board-v1-named.json');
    if (process.env.LIGHTBOX_WRITE_BOARD_FIXTURE === '1') {
      fs.writeFileSync(fixture, built);
    }
    const json = fs.readFileSync(fixture, 'utf8');
    const read = decoded(json);
    expect(read.dropped).toBe(0);
    expect(read.file.board.name).toBe(NAME);
    expect(read.file.board.boardId).toBe(BOARD.boardId);
    expect(lightboxBoardOfFile(read.file)).toMatchObject({ kind: 'board', text: TEXT, name: NAME });
    expect(writeLightboxBoardFile(read.file)).toBe(json);
  });
});

describe('a name that does not read (a hand-edited file): the board opens whole, unnamed', () => {
  it.each([
    ['not a string', 7],
    ['empty', ''],
    ['untrimmed', ` ${NAME} `],
    ['two lines', '3.2.1\nafter the cut'],
    ['a tab', '3.2.1\tafter the cut'],
    ['too long', 'x'.repeat(LIGHTBOX_BOARD_NAME_CHARACTERS + 1)],
    ['null', null]
  ])('%s: the name is left out and counted, and every other part is read', (_case, name) => {
    const read = editedName(name);
    expect(read.kind).toBe('board');
    if (read.kind !== 'board') {
      return;
    }
    expect(read.dropped).toBe(1);
    expect(read.droppedAt).toEqual(['file.board.name']);
    expect('name' in read.file.board).toBe(false);
    expect(lightboxBoardOfFile(read.file)).toEqual({ kind: 'board', board: BOARD, text: TEXT });
  });

  it('control: a name exactly as a board saves one reads with nothing dropped', () => {
    expect(editedName(NAME)).toMatchObject({ kind: 'board', dropped: 0, file: { board: { name: NAME } } });
  });
});
