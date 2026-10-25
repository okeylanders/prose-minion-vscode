/**
 * Where each kept reading came from, said truly (PR #170's review of Slice
 * 4J), through the real handlers, service, runner, store and library
 * (`lightboxBoardsHarness`), across a save and a reload:
 * - **F-01: a note is one cut reply.** Two lens reruns of one call, each
 *   cut off at the output ceiling and saved for recovery in its own place,
 *   keep two readings with two reasons. Each lens points to its own reply's
 *   note, both places stay on the board, and one whole-call cut is still
 *   one note every lens it touched points to.
 * - **F-02: a reading from before Slice 4J keeps its model.** A format-1
 *   board saved before per-lens provenance is opened, and a rerun of its
 *   call under another model replaces only the headline: the kept readings
 *   still name the model that read them, in the inspector and the saved
 *   board's row, after a reload. A failed rerun names only the old model.
 * - **N-01: a failure is its own lenses'.** A lens rerun on its own fails;
 *   its message is its note's alone, and its siblings say nothing of it.
 *
 * Only the engine's replies are stand-ins: the worked examples', cut off
 * inside a block or stopping mid-object. The chapter is ¶1–¶8 of "Alice's
 * Adventures in Wonderland" (1865, public domain). No provider is called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as fs from 'node:fs';
import * as path from 'node:path';
import { MessageType, type LightboxBoard, type LightboxLensId, type LightboxReadingGroup, type LightboxReadingGroupId } from '@/shared/types/messages';
import type { ExecutionResult, InitialRunRequest } from '@orchestration/AgentRunContracts';
import { emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import { lightboxEarlierReason, lightboxLensModel } from '@shared/constants/lightboxProvenance';
import { lightboxCallNotes } from '@hooks/domain/lightbox/lightboxCallNotes';
import { lightboxLensView } from '@hooks/domain/lightbox/lightboxReadings';
import { buildLightboxInspectorView } from '@hooks/domain/lightbox/controllers/useLightboxInspector';
import { examples, groupOf, ok, opinionReplyFor } from './lightboxReadingHarness';
import { CHAPTER, CHAPTER_PATH, WORKSPACE, createLightboxBoardsHost, quiet, type LightboxBoardsHostOptions } from './lightboxBoardsHarness';

type Reply = 'ok' | 'unusable' | { cutInside: string };

const FIRST_AT = Date.parse('2026-10-24T09:00:00.000Z');
const SECOND_AT = Date.parse('2026-10-24T09:08:00.000Z');
const BOARDS = path.posix.join(WORKSPACE, 'prose-minion', 'boards');
const receipt = (call: number) => `/workspace/recovery/call-${call}.response.txt`;

/**
 * A host whose engine answers each group as `engine.replies` says, under
 * `engine.model`; each paid reply it could not use whole is saved in its
 * own place. Over the files and memento given, it restores as a reload does.
 */
function lightboxHost(over: Pick<LightboxBoardsHostOptions, 'fileSystem' | 'memory'> = {}) {
  const engine: { replies: Partial<Record<LightboxReadingGroupId, Reply>>; model: string; clock: number } = {
    replies: {},
    model: 'provider/model-v1',
    clock: FIRST_AT
  };
  let receipts = 0;
  const host = createLightboxBoardsHost({
    ...over,
    now: () => engine.clock,
    recovery: { capture: jest.fn(async () => ({ filePath: receipt(++receipts), toolName: 'lightbox-readings' as const, storageScope: 'project' as const })) },
    respond: async (request: InitialRunRequest): Promise<ExecutionResult> => {
      const group = groupOf(request);
      const reply = engine.replies[group] ?? 'ok';
      const raw = group === 'F' ? opinionReplyFor(request) : examples[group].response;
      if (reply === 'unusable') {
        return { ...ok(group, `===LIGHTBOX_GROUP_${group}_V1===\n{"version": 1, "headline": \n===END_LIGHTBOX_GROUP_${group}_V1===`), modelId: engine.model };
      }
      if (reply !== 'ok') {
        return { ...ok(group, raw.slice(0, raw.indexOf(reply.cutInside) + 200)), finishReason: 'length', modelId: engine.model };
      }
      return { ...ok(group, raw), modelId: engine.model };
    }
  });
  host.writeChapter(CHAPTER_PATH, CHAPTER);
  return { host, engine };
}

type Host = ReturnType<typeof lightboxHost>['host'];
const groupOn = (host: Host, group: LightboxReadingGroupId): LightboxReadingGroup =>
  host.service.currentBoard()?.readings.find((entry) => entry.group === group) as LightboxReadingGroup;

/** A fresh host over the same files and memento, restoring the board on screen as a reload does. */
async function reload(host: Host): Promise<LightboxBoard> {
  const reloaded = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
  const tab = reloaded.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null);
  await quiet();
  return reloaded.service.currentBoard() as LightboxBoard;
}

/** The chapter boarded and every call read by run 1 under model v1. */
async function readBoard() {
  const { host, engine } = lightboxHost();
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null);
  await tab.choose(CHAPTER_PATH);
  await quiet();
  await tab.read();
  await quiet();
  expect(host.service.currentBoard()?.readings.every((group) => group.status === 'ok')).toBe(true);
  engine.clock = SECOND_AT;
  return { host, tab, engine };
}

describe('F-01: each cut reply is its own note', () => {
  it('two cut lens reruns keep both places, each lens pointing to its own reply\'s note, through a save and a reload', async () => {
    const { host, tab, engine } = await readBoard();
    engine.replies.A = { cutInside: '"motifs"' };
    await tab.press('motif');
    await quiet();
    engine.replies.A = { cutInside: '"tension"' };
    await tab.press('tension');
    await quiet();
    const a = groupOn(host, 'A');
    expect(lightboxEarlierReason(a, 'motif')).toContain(receipt(1));
    expect(lightboxEarlierReason(a, 'tension')).toContain(receipt(2));

    const board = await reload(host);
    expect(board.readings.find((group) => group.group === 'A')).toEqual(a);
    const notes = lightboxCallNotes(board);
    expect(notes.map((note) => [note.id, note.label])).toEqual([
      ['pm-lb-call-note-A', 'Call A · cut off (Theme & motif)'],
      ['pm-lb-call-note-A-2', 'Call A · cut off (Tension arc)']
    ]);
    expect(notes[0].message).toContain(receipt(1));
    expect(notes[1].message).toContain(receipt(2));
    expect(lightboxLensView(board, 'motif').callNote?.id).toBe('pm-lb-call-note-A');
    expect(lightboxLensView(board, 'tension').callNote?.id).toBe('pm-lb-call-note-A-2');
  });

  it('control: one whole-call cut is one note, and every lens it touched points to it', async () => {
    const { host, tab, engine } = await readBoard();
    engine.replies.A = { cutInside: '"motifs"' };
    await tab.run({ mode: 'group', group: 'A' });
    await quiet();
    const board = host.service.currentBoard() as LightboxBoard;
    const notes = lightboxCallNotes(board);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ id: 'pm-lb-call-note-A', label: 'Call A · cut off' });
    expect(notes[0].message).toContain(receipt(1));
    for (const lens of ['motif', 'tension', 'gravity', 'palette'] as const) {
      expect(lightboxLensView(board, lens).callNote?.id).toBe('pm-lb-call-note-A');
    }
  });
});

describe('F-02: a reading from before Slice 4J keeps the model that read it', () => {
  const FILE = 'drafts-alice-1-md-9b099095/2026-10-20T08-00-00-000Z.board.json';

  /** The committed format-1 fixture, saved before per-lens provenance, with only group A read, opened from the store. */
  async function openLegacyBoard() {
    const { host, engine } = lightboxHost();
    const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../fixtures/board-v1.json'), 'utf8'));
    fixture.board.readings = fixture.board.readings.map((group: LightboxReadingGroup) => (group.group === 'A' ? group : emptyLightboxReadingGroup(group.group)));
    expect(fixture.board.readings[0]).toMatchObject({ group: 'A', model: 'provider/model-v1' });
    expect(fixture.board.readings[0].provenance).toBeUndefined();
    host.fileSystem.files.set(path.posix.join(BOARDS, FILE), new TextEncoder().encode(JSON.stringify(fixture, null, 2)));
    const tab = host.openTab();
    await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    await tab.shelf(null);
    await tab.route(MessageType.LIGHTBOX_OPEN_BOARD, { requestId: 'open-legacy', fileId: FILE });
    await quiet();
    const before = groupOn(host, 'A');
    expect(before.tiles.length).toBeGreaterThan(0);
    engine.clock = SECOND_AT;
    engine.model = 'provider/model-v2';
    return { host, tab, engine, before };
  }

  const tileOf = (board: LightboxBoard, lens: LightboxLensId) =>
    board.readings.flatMap((group) => group.tiles).find((tile) => tile.lens === lens) as { id: string };
  const inspectorLine = (board: LightboxBoard, lens: LightboxLensId) =>
    buildLightboxInspectorView(board, { kind: 'reading', tileId: tileOf(board, lens).id }, 'UTC')?.reading?.provenance;

  it('a whole-call rerun under another model replaces the headline; the kept readings name model v1 after a save and a reload', async () => {
    const { host, tab, engine, before } = await openLegacyBoard();
    engine.replies.A = { cutInside: '"motifs"' };
    await tab.run({ mode: 'group', group: 'A' });
    await quiet();
    const after = groupOn(host, 'A');
    expect(after.model).toBe('provider/model-v2');
    expect(after.tiles.filter((tile) => tile.lens === 'motif')).toEqual(before.tiles.filter((tile) => tile.lens === 'motif'));

    const board = await reload(host);
    const a = board.readings.find((group) => group.group === 'A') as LightboxReadingGroup;
    expect(a.tiles.filter((tile) => tile.lens === 'motif').map((tile) => tile.id)).toEqual(before.tiles.filter((tile) => tile.lens === 'motif').map((tile) => tile.id));
    expect(lightboxLensModel(a, 'headline')).toBe('provider/model-v2');
    for (const lens of ['motif', 'tension', 'gravity', 'palette'] as const) {
      expect(lightboxLensModel(a, lens)).toBe('provider/model-v1');
      // Only the model: the board never held when that reading landed, nor which run read it.
      expect(a.provenance?.find((entry) => entry.lens === lens)).toEqual({ lens, model: 'provider/model-v1' });
    }
    expect(inspectorLine(board, 'motif')).toBe('Read by model-v1');
    expect(inspectorLine(board, 'headline')).toMatch(/^Read by model-v2 · /);
    const row = (await host.openTab().shelf(board.boardId)).shelf.boards.find((entry) => entry.onScreen);
    expect(row?.models).toEqual(['provider/model-v2', 'provider/model-v1']);
  });

  it('control: a failed rerun that names model v2 replaces nothing, and the board names only model v1', async () => {
    const { host, tab, engine } = await openLegacyBoard();
    engine.replies.A = 'unusable';
    await tab.run({ mode: 'group', group: 'A' });
    await quiet();
    expect(groupOn(host, 'A')).toMatchObject({ status: 'failed', model: 'provider/model-v2' });
    const board = await reload(host);
    expect(inspectorLine(board, 'motif')).toBe('Read by model-v1');
    const row = (await host.openTab().shelf(board.boardId)).shelf.boards.find((entry) => entry.onScreen);
    expect(row?.models).toEqual(['provider/model-v1']);
  });

  describe('an origin lost from a group with provenance stays unknown (PR #170 re-review)', () => {
    type Entry = { lens: string; run?: string; model?: string; at?: string };
    const THIRD_AT = Date.parse('2026-10-24T09:16:00.000Z');

    /**
     * The legacy witness's board, saved (the headline read by model-v2, the
     * motif, tension, gravity and palette kept from model-v1), its file's
     * group A provenance then changed by `damage`, and restored by a fresh
     * host whose engine answers under model-v3.
     */
    async function damagedMixedBoard(damage: (entries: Entry[]) => Entry[]) {
      const { host, tab, engine } = await openLegacyBoard();
      engine.replies.A = { cutInside: '"motifs"' };
      await tab.run({ mode: 'group', group: 'A' });
      await quiet();
      const file = path.posix.join(BOARDS, FILE);
      const json = JSON.parse(new TextDecoder().decode(host.fileSystem.files.get(file)));
      const a = json.board.readings.find((group: { group: string }) => group.group === 'A');
      expect(a.provenance.map((entry: Entry) => entry.lens)).toEqual(['headline', 'motif', 'tension', 'gravity', 'palette']);
      a.provenance = damage(a.provenance);
      host.fileSystem.files.set(file, new TextEncoder().encode(JSON.stringify(json, null, 2)));
      const next = lightboxHost({ fileSystem: host.fileSystem, memory: host.memory });
      const nextTab = next.host.openTab();
      await nextTab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
      await nextTab.shelf(null);
      await quiet();
      next.engine.clock = THIRD_AT;
      next.engine.model = 'provider/model-v3';
      return { host: next.host, tab: nextTab, engine: next.engine };
    }

    /** The board after `act`, a save and a fresh host's restore: group A, the motif's inspector line, and the row's models. */
    async function afterReload(host: Host) {
      const board = await reload(host);
      const row = (await host.openTab().shelf(board.boardId)).shelf.boards.find((entry) => entry.onScreen);
      return { board, a: board.readings.find((group) => group.group === 'A') as LightboxReadingGroup, models: row?.models };
    }

    const halfMotif = (entries: Entry[]) => entries.map((entry) => (entry.lens === 'motif' ? { ...entry, run: 'run-1-token' } : entry));
    const noMotif = (entries: Entry[]) => entries.filter((entry) => entry.lens !== 'motif');
    const allHalf = (entries: Entry[]) => entries.map(({ at: _at, ...entry }) => ({ ...entry, run: entry.run ?? 'run-1-token' }));

    it.each([
      ['its entry made half (a run without its time), so the codec drops it', halfMotif, ['provider/model-v3', 'provider/model-v1']],
      ['its entry left out of a well-formed list, nothing dropped', noMotif, ['provider/model-v3', 'provider/model-v1']],
      ['every entry malformed, so the codec keeps an empty list', allHalf, ['provider/model-v3']]
    ])('the motif, %s, stays unknown through a headline-only rerun, a save and a reload', async (_what, damage, models) => {
      const { host, tab } = await damagedMixedBoard(damage);
      const opened = groupOn(host, 'A');
      expect(lightboxLensModel(opened, 'motif')).toBeUndefined();
      expect(inspectorLine(host.service.currentBoard() as LightboxBoard, 'motif')).toBeUndefined();
      const motif = opened.tiles.filter((tile) => tile.lens === 'motif');

      await tab.press('headline');
      await quiet();
      expect(groupOn(host, 'A').model).toBe('provider/model-v3');

      const { board, a, models: row } = await afterReload(host);
      expect(a.tiles.filter((tile) => tile.lens === 'motif')).toEqual(motif);
      expect(a.provenance?.find((entry) => entry.lens === 'motif')).toEqual({ lens: 'motif' });
      expect(lightboxLensModel(a, 'motif')).toBeUndefined();
      expect(inspectorLine(board, 'motif')).toBeUndefined();
      expect(inspectorLine(board, 'headline')).toMatch(/^Read by model-v3 · /);
      expect(row).toEqual(models);
      expect(row).not.toContain('provider/model-v2');
    });

    it('control: a failed whole-call rerun under model-v3 keeps the lost origin unknown and names no model-v3', async () => {
      const { host, tab, engine } = await damagedMixedBoard(halfMotif);
      engine.replies.A = 'unusable';
      await tab.run({ mode: 'group', group: 'A' });
      await quiet();
      expect(groupOn(host, 'A')).toMatchObject({ status: 'failed', model: 'provider/model-v3' });
      const { board, a, models } = await afterReload(host);
      expect(a.provenance?.find((entry) => entry.lens === 'motif')).toEqual({ lens: 'motif' });
      expect(inspectorLine(board, 'motif')).toBeUndefined();
      expect(inspectorLine(board, 'headline')).toMatch(/^Read by model-v2 · /);
      expect(models).toEqual(['provider/model-v2', 'provider/model-v1']);
    });
  });
});

describe('N-01: a failure is said by its own lenses only', () => {
  it('a lens rerun on its own fails: its note holds the message once, and its siblings say nothing of it', async () => {
    const { host, tab, engine } = await readBoard();
    engine.replies.A = 'unusable';
    await tab.press('motif');
    await quiet();
    const board = host.service.currentBoard() as LightboxBoard;
    expect(groupOn(host, 'A').status).toBe('failed');
    const notes = lightboxCallNotes(board);
    expect(notes).toHaveLength(1);
    expect(notes[0].message).toContain(receipt(1));
    expect(lightboxLensView(board, 'motif').callNote?.id).toBe(notes[0].id);
    for (const lens of ['headline', 'tension', 'gravity', 'palette'] as const) {
      const view = lightboxLensView(board, lens);
      expect([view.phase, view.notice, view.earlier, view.callNote]).toEqual(['ok', undefined, undefined, undefined]);
    }
  });
});
