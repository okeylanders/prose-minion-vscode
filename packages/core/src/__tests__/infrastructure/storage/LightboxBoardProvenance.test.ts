/**
 * Per-lens provenance and earlier marks in format 1 (Slice 4J, epic decision
 * 49). Format 1 has not shipped, so the two optional fields join it: files
 * saved before them read unchanged, and byte for byte; a board that carries
 * them reads back whole; a provenance entry that does not read is left out
 * and counted, and the board opens; an earlier mark that does not read
 * leaves the file unread, as a stale mark does, since dropping it would show
 * an earlier reading as the latest. The board is the every-kind fixture over
 * ¶1–¶8 of "Alice's Adventures in Wonderland" (1865, public domain).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LightboxBoard } from '@messages';
import {
  decodeLightboxBoardFile,
  encodeLightboxBoardFile,
  lightboxBoardOfFile,
  writeLightboxBoardFile
} from '@/infrastructure/storage/LightboxBoardCodec';
import { lightboxBoardModels, lightboxLensModel, lightboxLensWasRead } from '@shared/constants/lightboxProvenance';
import { everyKindBoard } from '@/__tests__/infrastructure/lightbox/lightboxSavedBoardFixtures';

const FIXTURES = path.resolve(__dirname, '../../fixtures');
const SAVED_AT = new Date('2026-10-24T09:08:00.000Z');

/** The every-kind board with group A's motif kept from an earlier run, and its headline read by a later one. */
async function keptBoard(): Promise<{ board: LightboxBoard; text: string }> {
  const { board, text } = await everyKindBoard();
  return {
    text,
    board: {
      ...board,
      readings: board.readings.map((group) => (group.group !== 'A' ? group : {
        ...group,
        provenance: [
          { lens: 'headline', run: 'run-2-token', model: 'provider/model-b', at: '2026-10-24T09:08:00.000Z' },
          { lens: 'motif', run: 'run-1-token', model: 'provider/model-a', at: '2026-10-24T09:00:00.000Z' }
        ],
        earlierLenses: [{ lens: 'motif', reason: 'The call failed before a reading came back. Press Finish or Analyze to try again.' }]
      }))
    }
  };
}

describe('format 1 with per-lens provenance and earlier marks (Slice 4J)', () => {
  it.each(['board-v1.json', 'board-v1-named.json'])('reads %s, saved before them, unchanged and byte for byte, its models the groups\'', (name) => {
    const json = fs.readFileSync(path.join(FIXTURES, name), 'utf8');
    const decoded = decodeLightboxBoardFile(json);
    if (decoded.kind !== 'board') {
      throw new Error(decoded.reason);
    }
    expect(decoded.dropped).toBe(0);
    expect(writeLightboxBoardFile(decoded.file)).toBe(json);
    const readings = decoded.file.board.readings;
    expect(readings.some((group) => group.provenance !== undefined || group.earlierLenses !== undefined)).toBe(false);
    // With no provenance, each reading's model is its group's, as the rail named it before.
    const groupModels = [...new Set(readings
      .filter((group) => group.lenses.some((lens) => lightboxLensWasRead(group, lens)))
      .flatMap((group) => (group.model ? [group.model] : [])))];
    expect(lightboxBoardModels(readings).sort()).toEqual(groupModels.sort());
  });

  it('reads a board with them back whole, and writes it again byte for byte', async () => {
    const { board, text } = await keptBoard();
    const json = encodeLightboxBoardFile({ board, text, savedAt: SAVED_AT });
    const decoded = decodeLightboxBoardFile(json);
    if (decoded.kind !== 'board') {
      throw new Error(decoded.reason);
    }
    expect(decoded.dropped).toBe(0);
    const held = lightboxBoardOfFile(decoded.file);
    expect(held.kind === 'board' && held.board).toEqual(board);
    expect(writeLightboxBoardFile(decoded.file)).toBe(json);
  });

  it('leaves out a provenance entry that does not read, counted, and opens the board', async () => {
    const { board, text } = await keptBoard();
    const raw = JSON.parse(encodeLightboxBoardFile({ board, text, savedAt: SAVED_AT }));
    raw.board.readings[0].provenance[1].at = 'not a time';
    const decoded = decodeLightboxBoardFile(JSON.stringify(raw));
    if (decoded.kind !== 'board') {
      throw new Error(decoded.reason);
    }
    expect(decoded.dropped).toBe(1);
    expect(decoded.droppedAt).toEqual(['file.board.readings[0].provenance[1]']);
    expect(decoded.file.board.readings[0].provenance?.map((entry) => entry.lens)).toEqual(['headline']);
  });

  it('reads a reading from before Slice 4J back whole: its model only, or nothing, never a run or time it never had (PR #170 F-02)', async () => {
    const { board, text } = await keptBoard();
    const carried: LightboxBoard = {
      ...board,
      readings: board.readings.map((group) => (group.group !== 'A' ? group : {
        ...group,
        provenance: [
          { lens: 'headline', run: 'run-2-token', model: 'provider/model-b', at: '2026-10-24T09:08:00.000Z' },
          { lens: 'motif', model: 'provider/model-a' },
          { lens: 'tension' }
        ]
      }))
    };
    const json = encodeLightboxBoardFile({ board: carried, text, savedAt: SAVED_AT });
    const decoded = decodeLightboxBoardFile(json);
    if (decoded.kind !== 'board') {
      throw new Error(decoded.reason);
    }
    expect(decoded.dropped).toBe(0);
    const held = lightboxBoardOfFile(decoded.file);
    expect(held.kind === 'board' && held.board).toEqual(carried);
    expect(writeLightboxBoardFile(decoded.file)).toBe(json);
    const a = decoded.file.board.readings[0];
    expect([lightboxLensModel(a, 'headline'), lightboxLensModel(a, 'motif'), lightboxLensModel(a, 'tension')])
      .toEqual(['provider/model-b', 'provider/model-a', undefined]);
  });

  it.each([
    ['a run without its time', { lens: 'motif', run: 'run-1-token', model: 'provider/model-a' }],
    ['a time without its run', { lens: 'motif', model: 'provider/model-a', at: '2026-10-24T09:00:00.000Z' }]
  ])('leaves out %s, counted, and names no model for that lens rather than its group\'s latest', async (_what, entry) => {
    const { board, text } = await keptBoard();
    const raw = JSON.parse(encodeLightboxBoardFile({ board, text, savedAt: SAVED_AT }));
    raw.board.readings[0].provenance[1] = entry;
    const decoded = decodeLightboxBoardFile(JSON.stringify(raw));
    if (decoded.kind !== 'board') {
      throw new Error(decoded.reason);
    }
    expect(decoded.droppedAt).toEqual(['file.board.readings[0].provenance[1]']);
    const a = decoded.file.board.readings[0];
    expect(lightboxLensModel(a, 'motif')).toBeUndefined();
    expect(lightboxLensModel(a, 'headline')).toBe('provider/model-b');
  });

  it('keeps an empty list present, written and read back, so it is never a board from before Slice 4J (PR #170 re-review)', async () => {
    const { board, text } = await keptBoard();
    const empty: LightboxBoard = { ...board, readings: board.readings.map((group) => (group.group !== 'A' ? group : { ...group, provenance: [] })) };
    const json = encodeLightboxBoardFile({ board: empty, text, savedAt: SAVED_AT });
    expect(JSON.parse(json).board.readings[0].provenance).toEqual([]);
    const decoded = decodeLightboxBoardFile(json);
    if (decoded.kind !== 'board') {
      throw new Error(decoded.reason);
    }
    expect(decoded.file.board.readings[0].provenance).toEqual([]);
    expect(writeLightboxBoardFile(decoded.file)).toBe(json);
    expect(lightboxLensModel(decoded.file.board.readings[0], 'motif')).toBeUndefined();
  });

  it('keeps the list present when every entry is dropped, and names no model for any of them rather than the group\'s', async () => {
    const { board, text } = await keptBoard();
    const raw = JSON.parse(encodeLightboxBoardFile({ board, text, savedAt: SAVED_AT }));
    raw.board.readings[0].provenance = raw.board.readings[0].provenance.map(({ at: _at, ...entry }: { at?: string }) => entry);
    const decoded = decodeLightboxBoardFile(JSON.stringify(raw));
    if (decoded.kind !== 'board') {
      throw new Error(decoded.reason);
    }
    expect(decoded.dropped).toBe(2);
    const a = decoded.file.board.readings[0];
    expect(a.provenance).toEqual([]);
    expect(a.model).toBeDefined();
    expect([lightboxLensModel(a, 'headline'), lightboxLensModel(a, 'motif')]).toEqual([undefined, undefined]);
  });

  it('does not read a file whose earlier mark does not read, as with a stale mark', async () => {
    const { board, text } = await keptBoard();
    const raw = JSON.parse(encodeLightboxBoardFile({ board, text, savedAt: SAVED_AT }));
    raw.board.readings[0].earlierLenses[0].lens = 'no-such-lens';
    expect(decodeLightboxBoardFile(JSON.stringify(raw))).toMatchObject({ kind: 'invalid', reason: 'shape' });
  });
});
