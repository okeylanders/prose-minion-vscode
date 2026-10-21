/**
 * Bring to Workshop for the Opinion (Slice 4D; ADR 2026-10-19 D11, D7
 * addendum). The decision: the view on screen travels by name, ids only,
 * and nothing else of the Opinion. The host resolves the tile and the view
 * on its own board, refuses a withheld view or an Opinion that no longer
 * stands, finds the view's cited quotes again in the chapter, and the item
 * passes the Workshop's own validator. The board reads ¶1–¶8 of "Alice's
 * Adventures in Wonderland" (1865, public domain).
 */
import type { LightboxBoard, LightboxOpinionTile, LightboxOpinionViewId } from '@messages';
import { WORKSHOP_LIGHTBOX_TILE_LIMITS } from '@messages';
import { LIGHTBOX_TILE_HANDOFF_REFUSALS, prepareLightboxTileHandoff } from '@/infrastructure/lightbox/LightboxTileHandoff';
import { LIGHTBOX_OPINION_HANDOFF_REFUSALS } from '@/infrastructure/lightbox/LightboxOpinionHandoff';
import { parseLightboxHandOffRequest } from '@/infrastructure/lightbox/LightboxHandoff';
import { validateWorkshopLightboxTile } from '@/application/services/workshop/WorkshopLightboxTileAttachment';
import { LIGHTBOX_OPINION_WEIGHT_LABELS } from '@shared/constants/lightboxOpinion';
import { ALICE, aliceOpinionBoard, itemKey, opinionBody, readOpinion, withOpinion } from './lightboxOpinionFixtures';

const LIMITS = WORKSHOP_LIGHTBOX_TILE_LIMITS;

let board: LightboxBoard;
let tile: LightboxOpinionTile;
beforeAll(async () => {
  const read = await aliceOpinionBoard();
  const opinion = readOpinion(read);
  board = withOpinion(read, opinion);
  if (!opinion.tile) {
    throw new Error('expected the Opinion');
  }
  tile = opinion.tile;
});

const bring = (on: LightboxBoard, view?: LightboxOpinionViewId, paragraphs: readonly string[] = ALICE) =>
  prepareLightboxTileHandoff({ kind: 'tile', boardId: on.boardId, tileId: tile.id, ...(view ? { view } : {}) }, on, paragraphs);
const brought = (on: LightboxBoard, view?: LightboxOpinionViewId) => {
  const prepared = bring(on, view);
  if (!prepared.ok) {
    throw new Error(prepared.reason);
  }
  return prepared.handoff.tile;
};

describe('bringing the Opinion to the Workshop (Slice 4D)', () => {
  it('brings the view named, by its name: its headline, body and Why points, with its observations\' quotes found again', () => {
    const blunt = tile.views.find((view) => view.view === 'blunt');
    const sent = brought(board, 'blunt');
    expect(validateWorkshopLightboxTile(JSON.parse(JSON.stringify(sent)))).toEqual(sent);
    expect(sent).toMatchObject({
      origin: 'lightbox',
      boardId: board.boardId,
      tileId: tile.id,
      kindLabel: 'Opinion · Blunt view',
      lensLabel: 'Opinion',
      title: blunt?.headline,
      claim: blunt?.body,
      points: blunt?.why.map((point) => ({ label: LIGHTBOX_OPINION_WEIGHT_LABELS[point.weight], text: point.text }))
    });
    // The quotes of the observations its points weigh, in that order, each where the chapter has it.
    const weighed = [...new Set(blunt?.why.flatMap((point) => point.observations))];
    const cited = weighed.flatMap((id) => tile.observations.find((observation) => observation.id === id)?.cites ?? [])
      .flatMap((cite) => (cite.quote ? [{ paragraph: cite.quote.paragraph, text: cite.quote.text }] : []));
    expect(sent.quotes).toEqual(cited.slice(0, LIMITS.quotes));
    for (const quote of sent.quotes) {
      expect(ALICE[quote.paragraph - 1]).toContain(quote.text);
    }
  });

  it('brings nothing else of the Opinion: not the other views, not the observations\' words, not the digest', () => {
    const sent = JSON.stringify(brought(board, 'blunt'));
    for (const view of tile.views.filter((candidate) => candidate.view !== 'blunt')) {
      expect(sent).not.toContain(view.headline);
      expect(sent).not.toContain(view.body);
    }
    for (const observation of tile.observations) {
      expect(sent).not.toContain(observation.text);
    }
    expect(sent).not.toContain(tile.digest.key);
    expect(sent).not.toContain(tile.friction);
  });

  it('brings the view the tile opens on when none is named: Neutral', () => {
    expect(brought(board).kindLabel).toBe('Opinion · Neutral view');
  });

  it('refuses a view that was withheld', () => {
    const read = readOpinion(board, (() => {
      const body = opinionBody();
      body.views.blunt.why = [];
      return body;
    })());
    const withheld = withOpinion(board, read);
    expect(read.tile?.withheldViews.map((entry) => entry.view)).toEqual(['blunt']);
    expect(bring(withheld, 'blunt')).toEqual({ ok: false, reason: LIGHTBOX_OPINION_HANDOFF_REFUSALS.withheld });
    expect(bring(withheld, 'neutral').ok).toBe(true);
  });

  it('refuses an Opinion whose cited items changed since it was read, and one read against an earlier text', () => {
    const signature = itemKey(board, 'Stock & signature · Signature: The narrator’s aside');
    const changed: LightboxBoard = {
      ...board,
      readings: board.readings.map((group) => ({
        ...group,
        tiles: group.tiles.map((candidate) => (candidate.id === signature ? { ...candidate, claim: `${candidate.claim} Read again.` } : candidate))
      }))
    };
    expect(bring(changed, 'neutral')).toEqual({ ok: false, reason: LIGHTBOX_OPINION_HANDOFF_REFUSALS.changed });
    const earlier: LightboxBoard = {
      ...board,
      readings: board.readings.map((group) => (group.group === 'F' ? { ...group, staleLenses: [{ lens: 'opinion', readAgainst: 'old' }] } : group))
    };
    expect(bring(earlier, 'neutral')).toEqual({ ok: false, reason: LIGHTBOX_TILE_HANDOFF_REFUSALS.stale });
  });

  it('refuses a view whose observations\' quotes are no longer in the chapter', () => {
    expect(bring(board, 'neutral', ALICE.map(() => 'Nothing of the old chapter is here.')))
      .toEqual({ ok: false, reason: LIGHTBOX_OPINION_HANDOFF_REFUSALS.quotesGone });
  });

  it('reads the view from the request only by its name, and never a view it does not know', () => {
    expect(parseLightboxHandOffRequest({ kind: 'tile', boardId: 'b', tileId: 't', view: 'blunt' }))
      .toEqual({ kind: 'tile', boardId: 'b', tileId: 't', view: 'blunt' });
    expect(parseLightboxHandOffRequest({ kind: 'tile', boardId: 'b', tileId: 't' })).toEqual({ kind: 'tile', boardId: 'b', tileId: 't' });
    expect(parseLightboxHandOffRequest({ kind: 'tile', boardId: 'b', tileId: 't', view: 'loud' })).toBeUndefined();
    expect(parseLightboxHandOffRequest({ kind: 'tile', boardId: 'b', tileId: 't', view: 3 })).toBeUndefined();
  });
});
