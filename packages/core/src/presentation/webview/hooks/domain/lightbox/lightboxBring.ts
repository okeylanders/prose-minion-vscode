/**
 * "Bring to Workshop", as the Lightbox webview offers it (ADR 2026-10-19
 * D11; Slice 4). Pure: no React, no transport.
 *
 * The webview names a reading tile on the board it shows, and nothing else;
 * the host resolves it, checks its quotes again and offers it to the
 * Workshop, which stages it above the composer only after its claim is
 * granted. Here the action is labeled, disabled with a reason where the
 * host would refuse (a stale tile, a lens being read again, a tile with no
 * quote), shows the host's answer, and shows **Bound** only while the
 * Workshop's own tray holds the tile: a tile the writer sent or removed
 * there can be brought again. The Opinion (Slice 4D) brings the one view on
 * show, by name; it is disabled where the host would refuse it (stale,
 * the view withheld, or no quote cited).
 */

import type {
  LightboxBoard,
  LightboxHandOffPayload,
  LightboxOpinionViewId,
  LightboxReadingTile,
  LightboxWorkshopTrayTile
} from '@messages';
import { lightboxHandOffConcerns, type LightboxHandOffState } from '@hooks/domain/lightbox/lightboxHandoff';
import { lightboxOpinionBringBlock } from '@hooks/domain/lightbox/lightboxOpinion';
import { LIGHTBOX_OPINION_EARLIER_RULE, lightboxOpinionDefaultView, lightboxOpinionStanding } from '@shared/constants/lightboxOpinion';

export const LIGHTBOX_BRING_LABEL = 'Bring to Workshop';
/** A spark is an offer phrased as a question; it travels as one. */
export const LIGHTBOX_BRING_SPARK_LABEL = 'Bring as a question';
export const LIGHTBOX_BOUND_LABEL = 'Bound for Workshop';
/** The Opinion travels as the one view the writer is looking at. */
export const LIGHTBOX_BRING_VIEW_LABEL = 'Bring this view to Workshop';

export type LightboxBringState = 'ready' | 'sending' | 'bound' | 'refused';

export interface LightboxBringView {
  label: string;
  disabled: boolean;
  /** Why it is disabled, when it is. */
  reason?: string;
  /** What pressing it does, the host's answer, or where the tile waits. */
  note: string;
  state: LightboxBringState;
}

const NOTE = 'Stages its claim and the quotes found in the chapter above the Workshop composer. Nothing is sent until you send it there.';
const BOUND_NOTE = 'Waiting above the Workshop composer. Send it with a message or remove it there.';

/** The request the webview sends: it names the tile and, for the Opinion, the view on show; nothing more. */
export function lightboxBringRequest(
  boardId: string,
  tileId: string,
  view?: LightboxOpinionViewId
): Extract<LightboxHandOffPayload, { kind: 'tile' }> {
  return { kind: 'tile', boardId, tileId, ...(view ? { view } : {}) };
}

/** Whether the Workshop's tray holds this tile of this board. */
export function lightboxTileBound(tray: readonly LightboxWorkshopTrayTile[], boardId: string, tileId: string): boolean {
  return tray.some((held) => held.boardId === boardId && held.tileId === tileId);
}

/** The action for a reading tile, pinned or in the spark lane. */
export function lightboxBringView(
  board: LightboxBoard,
  tile: LightboxReadingTile,
  handoff: LightboxHandOffState | null,
  tray: readonly LightboxWorkshopTrayTile[],
  /** The Opinion's view on show (Slice 4D). */
  opinionView?: LightboxOpinionViewId
): LightboxBringView {
  const label = tile.kind === 'spark' ? LIGHTBOX_BRING_SPARK_LABEL : tile.kind === 'opinion' ? LIGHTBOX_BRING_VIEW_LABEL : LIGHTBOX_BRING_LABEL;
  if (lightboxTileBound(tray, board.boardId, tile.id)) {
    return { label: LIGHTBOX_BOUND_LABEL, disabled: true, note: BOUND_NOTE, state: 'bound' };
  }
  const group = board.readings.find((candidate) => candidate.tiles.some((entry) => entry.id === tile.id));
  const stale = group?.staleLenses?.some((mark) => mark.lens === tile.lens) ?? false;
  const reading = group?.status === 'running' && (group.pending?.includes(tile.lens) ?? false);
  const mine = lightboxHandOffConcerns(handoff, 'tile', board.boardId, tile.id);
  // One handoff at a time: while anything is on its way, every Bring waits.
  const sending = handoff?.status === 'sending';
  // The Opinion is held to what the host checks of its view; any other tile needs a quote to carry.
  const blocked = tile.kind === 'opinion'
    ? lightboxOpinionBringBlock(board, tile, opinionView ?? lightboxOpinionDefaultView(tile))
    : tile.evidence.length === 0 ? 'It has no quote to carry.' : undefined;
  // An Opinion cited under another basis rule says so first, as its standing does (decision 32; PR #163 N-02).
  const earlierRule = tile.kind === 'opinion' && lightboxOpinionStanding(tile, board).earlierRule;
  const reason = earlierRule
    ? LIGHTBOX_OPINION_EARLIER_RULE
    : stale
      ? 'Read against an earlier version of the chapter. Read the lens again before bringing it.'
      : reading
      ? 'This lens is being read again.'
      : blocked ?? (sending
        ? mine ? 'Bringing it to the Workshop…' : 'Something else is on its way to the Workshop.'
        : undefined);
  if (reason) {
    return { label, disabled: true, reason, note: reason, state: mine && sending ? 'sending' : 'ready' };
  }
  const answer = mine && handoff?.status === 'answered' ? handoff.result : undefined;
  if (answer && !answer.ok) {
    return { label, disabled: false, note: answer.message, state: 'refused' };
  }
  // Staged and no longer held: the writer sent or removed it in the Workshop, so it can come again.
  return { label, disabled: false, note: NOTE, state: 'ready' };
}
