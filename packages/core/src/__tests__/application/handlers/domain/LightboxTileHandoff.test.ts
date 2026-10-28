/**
 * Bring to Workshop (ADR 2026-10-19 D11; Slice 4): `LIGHTBOX_HAND_OFF` names
 * a reading tile by id; the host resolves it on the board on screen, refuses
 * a stale, re-reading or set-aside tile, re-checks its quotes against the
 * chapter (a said line first), and hands the Workshop a bounded item of the
 * claim and its found quotes. "Staged" waits for the Workshop's own answer,
 * or for the session that holds it when that answer was lost (F-08). The
 * tray posts what the Workshop holds. The real LightboxHandler and
 * LightboxService, over the worked examples' own excerpts of "Alice's
 * Adventures in Wonderland" (1865, public domain).
 */
import type {
  LightboxBoard,
  LightboxHandOffResultPayload,
  LightboxReadingGroupId,
  LightboxWorkshopHandoff,
  LightboxWorkshopHandoffOutcome,
  LightboxWorkshopTrayTile
} from '@messages';
import { MessageType } from '@messages';
import { LIGHTBOX_HANDOFF_REFUSALS } from '@/infrastructure/lightbox/LightboxHandoff';
import {
  LIGHTBOX_TILE_HANDOFF_REFUSALS,
  LIGHTBOX_TILE_WORKSHOP_REFUSALS
} from '@/infrastructure/lightbox/LightboxTileHandoff';
import { setLightboxSparkDismissed } from '@/infrastructure/lightbox/LightboxSparkLane';
import { readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';
import { readGroup } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';
import { createLightboxHost, settle } from './lightboxHandlerHarness';

const answering = (outcome: LightboxWorkshopHandoffOutcome = { opened: true }) =>
  jest.fn((_handoff: LightboxWorkshopHandoff) => Promise.resolve(outcome));

/** A tray port the test holds: what the Workshop's session has staged. */
function fakeTray() {
  let tiles: LightboxWorkshopTrayTile[] = [];
  const listeners = new Set<() => void>();
  return {
    port: {
      read: () => tiles.map((tile) => ({ ...tile })),
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    },
    set(next: LightboxWorkshopTrayTile[]) {
      tiles = next;
      listeners.forEach((listener) => listener());
    },
    listeners
  };
}

async function boardOf(group: LightboxReadingGroupId, options: {
  handOff?: jest.Mock; tray?: ReturnType<typeof fakeTray>; openWorkshop?: jest.Mock;
} = {}) {
  const host = createLightboxHost();
  host.addFile('Drafts/alice-1.md', readWorkedExample(group).paragraphs.join('\n\n'));
  const panel = host.openPanel({
    handOff: options.handOff,
    workshop: { tray: options.tray?.port, openWorkshop: options.openWorkshop }
  });
  await panel.route(MessageType.LIGHTBOX_SET_SOURCE, host.fileSource('Drafts/alice-1.md'));
  await settle();
  const board = host.service.currentBoard() as LightboxBoard;
  host.service.updateReadings(board.boardId, (readings) => readings.map((entry) => (entry.group === group ? readGroup(group) : entry)));
  const tiles = () => host.service.currentBoard()?.readings.flatMap((entry) => entry.tiles) ?? [];
  const tileId = (kind: string, index = 0) => tiles().filter((tile) => tile.kind === kind)[index]?.id ?? '';
  const results = () => panel.posted.flatMap((message) =>
    message.type === MessageType.LIGHTBOX_HAND_OFF_RESULT ? [message.payload as LightboxHandOffResultPayload] : []);
  const trays = () => panel.posted.flatMap((message) =>
    message.type === MessageType.LIGHTBOX_WORKSHOP_TRAY ? [(message.payload as { tiles: LightboxWorkshopTrayTile[] }).tiles] : []);
  const bring = async (id: string, boardId = board.boardId) => {
    await panel.route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'tile', boardId, tileId: id });
    await settle();
  };
  return { host, panel, board, tiles, tileId, results, trays, bring };
}

describe('Bring to Workshop: a reading tile (D11)', () => {
  it('hands the Workshop a subtext pair: its claim, the speaker, the said line first, and evidence found again', async () => {
    const handOff = answering();
    const { bring, tileId, results, panel, board } = await boardOf('B', { handOff });
    const id = tileId('subtext');
    await bring(id);

    expect(handOff).toHaveBeenCalledTimes(1);
    expect(handOff.mock.calls[0][0]).toEqual({
      kind: 'tile',
      tile: {
        origin: 'lightbox',
        boardId: board.boardId,
        tileId: id,
        kindLabel: 'Said / meant',
        lensLabel: expect.any(String),
        title: expect.any(String),
        claim: 'Being late is the whole of its worry; what it is late for never comes into it.',
        points: [{ label: 'Speaker', text: 'White Rabbit' }],
        quotes: [
          { paragraph: 4, text: 'Oh dear! Oh dear! I shall be late!', said: true },
          { paragraph: 4, text: expect.stringMatching(/WATCH OUT OF ITS WAISTCOAT-POCKET/) }
        ],
        sourceLabel: 'Drafts/alice-1.md'
      }
    });
    expect(results()).toEqual([expect.objectContaining({ kind: 'tile', tileId: id, ok: true, message: expect.stringMatching(/^Staged “/) })]);
    expect(panel.logged()).toContain('The Workshop staged a tile: 2 quotes carried, 2 of 2 quotes found again');
    expect(panel.logged()).not.toMatch(/Rabbit|late|WAISTCOAT/);
  });

  it('carries a lineage story\'s stances as labeled points', async () => {
    const handOff = answering();
    const { bring, tileId } = await boardOf('C', { handOff });
    await bring(tileId('lineage'));
    const handoff = handOff.mock.calls[0][0] as Extract<LightboxWorkshopHandoff, { kind: 'tile' }>;
    expect(handoff.tile.kindLabel).toBe('Adjacent story');
    expect(handoff.tile.points.length).toBeGreaterThan(0);
    expect(handoff.tile.points.every((point) => ['Matches', 'Departs', 'Subverts'].includes(point.label))).toBe(true);
  });

  it('refuses a spark the writer set aside, and brings it once it is back', async () => {
    const handOff = answering();
    const { host, bring, tileId, results, board } = await boardOf('C', { handOff });
    const spark = tileId('spark');
    // The reading handler's route writes the mark the same way (LightboxSparkLane).
    const setAside = (dismissed: boolean) => host.service.updateReadings(
      board.boardId,
      (readings) => {
        const result = setLightboxSparkDismissed(readings, spark, dismissed);
        return result.ok ? result.readings : readings;
      }
    );
    setAside(true);
    await bring(spark);
    expect(handOff).not.toHaveBeenCalled();
    expect(results().at(-1)).toMatchObject({ ok: false, message: LIGHTBOX_TILE_HANDOFF_REFUSALS.setAside });

    setAside(false);
    await bring(spark);
    expect(handOff).toHaveBeenCalledTimes(1);
    expect(results().at(-1)).toMatchObject({ ok: true });
  });

  it('refuses a stale tile after the chapter is re-read, a tile on another board, one not on the board, and a request without a tile id', async () => {
    const handOff = answering();
    const { host, panel, bring, tileId, results, board } = await boardOf('B', { handOff });
    const id = tileId('subtext');
    await bring(id, 'board-old');
    await bring('lbt-withheld');
    await panel.route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'tile', boardId: board.boardId });
    await settle();
    host.addFile('Drafts/alice-1.md', readWorkedExample('B').paragraphs.join('\n\n').replace('thought Alice to herself', 'said Alice'));
    await panel.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
    await settle();
    const changed = host.service.currentBoard() as LightboxBoard;
    await bring(tileId('subtext'), changed.boardId);

    expect(handOff).not.toHaveBeenCalled();
    expect(results().map((result) => result.message)).toEqual([
      LIGHTBOX_TILE_HANDOFF_REFUSALS.boardChanged,
      LIGHTBOX_TILE_HANDOFF_REFUSALS.notOnBoard,
      LIGHTBOX_HANDOFF_REFUSALS.unknown,
      LIGHTBOX_TILE_HANDOFF_REFUSALS.stale
    ]);
  });

  it('says why the Workshop did not stage it, in the tile\'s words', async () => {
    for (const reason of ['busy', 'full', 'duplicate', 'replaced', 'timeout', 'reset', 'closed', 'unavailable'] as const) {
      const handOff = answering({ opened: false, reason });
      const { bring, tileId, results } = await boardOf('B', { handOff });
      await bring(tileId('subtext'));
      expect(results().at(-1)).toMatchObject({ ok: false, message: LIGHTBOX_TILE_WORKSHOP_REFUSALS[reason] });
    }
  });

  it('counts a tile the session holds as staged when the Workshop\'s answer was lost to a reload or a close (F-08)', async () => {
    for (const reason of ['reset', 'closed'] as const) {
      const tray = fakeTray();
      let boardId = '';
      let id = '';
      const handOff = jest.fn(async () => {
        // The Workshop staged it; its answer never came back.
        tray.set([{ boardId, tileId: id, label: 'Lightbox Said / meant: …' }]);
        return { opened: false as const, reason };
      });
      const fixture = await boardOf('B', { handOff, tray });
      boardId = fixture.board.boardId;
      id = fixture.tileId('subtext');
      await fixture.bring(id);
      expect(fixture.results().at(-1)).toMatchObject({ ok: true, message: expect.stringMatching(/^Staged/) });
      expect(fixture.panel.logged()).toContain(`its answer was lost (${reason}), the session holds it`);
    }
    // A timeout cannot have staged anything: the tile was never granted.
    const tray = fakeTray();
    const fixture = await boardOf('B', { handOff: answering({ opened: false, reason: 'timeout' }), tray });
    tray.set([{ boardId: fixture.board.boardId, tileId: fixture.tileId('subtext'), label: 'x' }]);
    await fixture.bring(fixture.tileId('subtext'));
    expect(fixture.results().at(-1)).toMatchObject({ ok: false });
  });

  it('posts the tray on mount and on every change, opens the Workshop on request, and stops when the tab closes', async () => {
    const tray = fakeTray();
    const openWorkshop = jest.fn();
    const { panel, trays } = await boardOf('B', { tray, openWorkshop });
    await panel.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    expect(trays().at(-1)).toEqual([]);
    tray.set([{ boardId: 'board-1', tileId: 'lbt-1', label: 'Lightbox Motif: Falling' }]);
    expect(trays().at(-1)).toEqual([{ boardId: 'board-1', tileId: 'lbt-1', label: 'Lightbox Motif: Falling' }]);
    expect(tray.listeners.size).toBe(1);

    await panel.route(MessageType.LIGHTBOX_OPEN_WORKSHOP);
    expect(openWorkshop).toHaveBeenCalledTimes(1);

    const count = trays().length;
    panel.dispose();
    expect(tray.listeners.size).toBe(0);
    tray.set([]);
    await panel.route(MessageType.LIGHTBOX_OPEN_WORKSHOP);
    expect(trays()).toHaveLength(count);
    expect(openWorkshop).toHaveBeenCalledTimes(1);
  });
});
