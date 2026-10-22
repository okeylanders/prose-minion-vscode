/**
 * A board whose Opinion was cited under another basis rule (Slice 5A, the
 * writer-data rule, epic decision 32): a saved board only ever loses
 * standing, never the board. Its Opinion is stale with a host reason, its
 * cited bases are not compared, and its Bring is refused with the same
 * reason, in the host and in the webview. Every other kind behaves as it
 * does now. The control, a board cited under this build's rule, reads its
 * standing normally.
 *
 * The board is the every-kind board: the production service's measure of
 * ¶1–¶8 of "Alice's Adventures in Wonderland" (1865, public domain), read
 * from the worked examples, with the Opinion standing on it.
 */
import type { LightboxBoard, LightboxOpinionTile } from '@messages';
import { lightboxOpinionStanding, lightboxOpinionTile } from '@shared/constants/lightboxOpinion';
import { prepareLightboxTileHandoff } from '@/infrastructure/lightbox/LightboxTileHandoff';
import { lightboxOpinionBringBlock, lightboxOpinionTileView } from '@hooks/domain/lightbox/lightboxOpinion';
import { ALICE } from './lightboxOpinionFixtures';
import { everyKindBoard } from './lightboxSavedBoardFixtures';

/** A synthetic id: a basis rule this build does not have. */
const EARLIER = 'rendered-text-2026-10-21';
const REASON = 'Saved under an earlier citation rule; read the Opinion again to bring it current.';
/** Every reading tile on the board but the Opinion. */
const OTHERS = 78;

let board: LightboxBoard;
let earlier: LightboxBoard;
let opinion: LightboxOpinionTile;

beforeAll(async () => {
  ({ board } = await everyKindBoard());
  earlier = { ...board, rules: { ...board.rules, opinionBasis: EARLIER } };
  const tile = lightboxOpinionTile(board);
  if (!tile) {
    throw new Error('the every-kind board has no Opinion');
  }
  opinion = tile;
});

const bring = (on: LightboxBoard, tileId: string) =>
  prepareLightboxTileHandoff({ kind: 'tile', boardId: on.boardId, tileId }, on, ALICE);

describe('an Opinion cited under another basis rule (the writer-data rule)', () => {
  it('control: cited under this build\'s rule, the Opinion stands and brings', () => {
    expect(board.rules.opinionBasis).toBe('item-data-2026-10-22');
    expect(lightboxOpinionStanding(opinion, board)).toEqual({ stale: false, readEarlier: false, reading: false, earlierRule: false, changed: [] });
    expect(lightboxOpinionBringBlock(board, opinion, 'enthusiastic')).toBeUndefined();
    expect(bring(board, opinion.id).ok).toBe(true);
  });

  it('is stale with the host\'s reason, and its cited bases are not compared', () => {
    expect(lightboxOpinionStanding(opinion, earlier)).toEqual({
      stale: true, readEarlier: false, reading: false, earlierRule: true, changed: [], note: REASON
    });
    const view = lightboxOpinionTileView(earlier, opinion);
    expect(view.standing.note).toBe(REASON);
    // No observation, and none of its cites, is marked changed: under another rule every basis differs, so none is compared.
    expect(view.observations.map((observation) => [observation.id, observation.changed, observation.cites.some((cite) => cite.changed)]))
      .toEqual([['O1', false, false], ['O3', false, false], ['O4', false, false], ['O5', false, false]]);
  });

  it('refuses its Bring with the same reason, in the host and in the webview', () => {
    expect(bring(earlier, opinion.id)).toEqual({ ok: false, reason: REASON });
    expect(lightboxOpinionBringBlock(earlier, opinion, 'enthusiastic')).toBe(REASON);
  });

  it('leaves every other kind as it is: each other tile brings exactly as it does under this build\'s rule', () => {
    const others = board.readings.flatMap((group) => group.tiles).filter((tile) => tile.kind !== 'opinion');
    expect(others).toHaveLength(OTHERS);
    const answers = (on: LightboxBoard) => others.map((tile) => {
      const prepared = bring(on, tile.id);
      return [tile.kind, prepared.ok ? 'ok' : prepared.reason];
    });
    expect(answers(earlier)).toEqual(answers(board));
    expect(answers(earlier).filter(([, answer]) => answer === REASON)).toEqual([]);
  });
});
