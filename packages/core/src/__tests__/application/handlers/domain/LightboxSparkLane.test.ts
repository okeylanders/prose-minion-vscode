/**
 * The Spark lane's "Not for me" and its Undo (ADR 2026-10-19 D7; Slice 4),
 * through the real LightboxReadingHandler, LightboxService and runner over a
 * mocked engine: the host marks the board's own spark, so a reloaded tab,
 * a stale carry and a re-read each see the right thing, and a dismissal that
 * names a spark the board no longer holds changes nothing. No provider is
 * called; group C is its worked example over "Alice's Adventures in
 * Wonderland" (1865, public domain).
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import type { LightboxBoard, LightboxSparkTile } from '@messages';
import { MessageType } from '@messages';
import { LIGHTBOX_SPARK_LANE_REFUSALS } from '@/infrastructure/lightbox/LightboxSparkLane';
import { CHAPTER, createLightboxReadingHost, settle } from './lightboxReadingHarness';

const sparksOf = (board: LightboxBoard | undefined): LightboxSparkTile[] =>
  (board?.readings ?? []).flatMap((group) => group.tiles).filter((tile): tile is LightboxSparkTile => tile.kind === 'spark');

async function readSparks() {
  const host = await createLightboxReadingHost();
  const tab = host.openTab();
  await tab.run({ mode: 'all' });
  await settle();
  const board = host.service.currentBoard() as LightboxBoard;
  const dismiss = async (title: string, dismissed = true, boardId = board.boardId) => {
    const tileId = sparksOf(host.service.currentBoard()).find((tile) => tile.title === title)?.id ?? `missing:${title}`;
    await tab.route(MessageType.LIGHTBOX_SET_SPARK_DISMISSED, { boardId, tileId, dismissed });
  };
  const marks = () => sparksOf(host.service.currentBoard()).map((tile) => [tile.title, tile.dismissedOrder ?? null]);
  return { host, tab, board, dismiss, marks };
}

describe('the Spark lane: Not for me, and Undo (Slice 4)', () => {
  it('sets a spark aside on the host board, in order, and publishes the board', async () => {
    const { tab, dismiss, marks } = await readSparks();
    const before = tab.ofType(MessageType.LIGHTBOX_BOARD).length;
    await dismiss('Late for what?');
    await dismiss('The empty jar');
    expect(marks()).toEqual([['The empty jar', 2], ['Late for what?', 1], ['Nobody at home', null]]);
    const published = tab.ofType(MessageType.LIGHTBOX_BOARD).slice(before);
    expect(published).toHaveLength(2);
    expect(sparksOf(published[1].payload.board ?? undefined).map((tile) => tile.dismissedOrder ?? null)).toEqual([2, 1, null]);
    // The log names what happened, never a spark's words.
    expect(tab.logged()).toContain('Spark set aside');
    expect(tab.logged()).not.toMatch(/empty jar|Late for what/);
  });

  it('brings the latest back first on Undo, and a repeated request changes nothing', async () => {
    const { tab, dismiss, marks } = await readSparks();
    await dismiss('Late for what?');
    await dismiss('The empty jar');
    await dismiss('The empty jar', false);
    expect(marks()).toEqual([['The empty jar', null], ['Late for what?', 1], ['Nobody at home', null]]);
    const published = tab.ofType(MessageType.LIGHTBOX_BOARD).length;
    await dismiss('The empty jar', false);
    await dismiss('Late for what?', true);
    expect(tab.ofType(MessageType.LIGHTBOX_BOARD)).toHaveLength(published);
  });

  it('keeps the mark for a reloaded tab: the host owns it, not the webview', async () => {
    const { host, dismiss } = await readSparks();
    await dismiss('Nobody at home');
    const reloaded = host.openTab();
    await reloaded.setLenses();
    expect(sparksOf(host.service.currentOutcome().board ?? undefined).find((tile) => tile.title === 'Nobody at home')?.dismissedOrder).toBe(1);
  });

  it('keeps a spark set aside through a stale carry, and Undo still brings it back on the stale board', async () => {
    const { host, tab, dismiss, marks } = await readSparks();
    await dismiss('Nobody at home');
    // A typo fixed far from every spark: the board is rebuilt, its readings carried stale.
    const rebuilt = await host.service.buildBoard({
      kind: 'file',
      text: CHAPTER.replace('very sleepy and stupid', 'very sleepy and dull'),
      displayPath: 'Drafts/alice-1.md',
      rereadPath: '/workspace/Drafts/alice-1.md'
    });
    if (rebuilt.kind !== 'board') {
      throw new Error('expected a board');
    }
    const groupC = rebuilt.board.readings.find((group) => group.group === 'C');
    expect(groupC?.staleLenses?.map((mark) => mark.lens)).toEqual(['genre', 'lineage', 'spark']);
    expect(marks()).toEqual([['The empty jar', null], ['Late for what?', null], ['Nobody at home', 1]]);
    await dismiss('Nobody at home', false, rebuilt.board.boardId);
    expect(marks()).toEqual([['The empty jar', null], ['Late for what?', null], ['Nobody at home', null]]);
    expect(tab.logged()).toContain('Spark brought back');
  });

  it('draws a re-read Spark lens with new sparks, none set aside', async () => {
    const { tab, dismiss, marks } = await readSparks();
    await dismiss('The empty jar');
    await tab.run({ mode: 'lens', lens: 'spark' });
    await settle();
    expect(marks()).toEqual([['The empty jar', null], ['Late for what?', null], ['Nobody at home', null]]);
  });

  it('refuses a request for another board, a tile that is not a spark, or a request it cannot read, and changes nothing', async () => {
    const { host, tab, board } = await readSparks();
    const before = JSON.stringify(host.service.currentBoard());
    const published = tab.ofType(MessageType.LIGHTBOX_BOARD).length;
    const motif = board.readings.flatMap((group) => group.tiles).find((tile) => tile.kind !== 'spark')?.id
      ?? host.service.currentBoard()?.readings[0].tiles[0].id;
    const spark = sparksOf(host.service.currentBoard())[0].id;
    await tab.route(MessageType.LIGHTBOX_SET_SPARK_DISMISSED, { boardId: 'board-old', tileId: spark, dismissed: true });
    await tab.route(MessageType.LIGHTBOX_SET_SPARK_DISMISSED, { boardId: board.boardId, tileId: motif, dismissed: true });
    await tab.route(MessageType.LIGHTBOX_SET_SPARK_DISMISSED, { boardId: board.boardId, tileId: spark, dismissed: 'yes' });
    expect(JSON.stringify(host.service.currentBoard())).toBe(before);
    expect(tab.ofType(MessageType.LIGHTBOX_BOARD)).toHaveLength(published);
    expect(tab.logged()).toContain(LIGHTBOX_SPARK_LANE_REFUSALS.boardChanged);
    expect(tab.logged()).toContain(LIGHTBOX_SPARK_LANE_REFUSALS.notOnBoard);
    expect(tab.logged()).toContain(LIGHTBOX_SPARK_LANE_REFUSALS.unknown);
  });

  it('refuses a spark a full run of its group has cleared', async () => {
    const { host, tab, board } = await readSparks();
    const spark = sparksOf(host.service.currentBoard())[0].id;
    // A full run of group C clears its tiles before it lands.
    host.service.updateReadings(board.boardId, (readings) =>
      readings.map((group) => (group.group === 'C' ? { ...group, status: 'running', tiles: [], pending: ['genre', 'lineage', 'spark'] } : group)));
    await tab.route(MessageType.LIGHTBOX_SET_SPARK_DISMISSED, { boardId: board.boardId, tileId: spark, dismissed: true });
    expect(tab.logged()).toContain(LIGHTBOX_SPARK_LANE_REFUSALS.notOnBoard);
  });
});
