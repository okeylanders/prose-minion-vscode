/**
 * What the webview sees of a turn's file-edit cards and edit offers (ADR
 * 2026-11-05 D4.3; ADR 2026-11-10 D2, D3, U5): each identity without its
 * host-only `documentUri`, so the webview holds only the display path. Every
 * turn the room handler posts (a turn, a session snapshot) passes through
 * this.
 *
 * **An offer's view is the host's** (`WorkshopEditOfferRoomView`, ADR
 * 2026-11-10 D3, U5), worked out again for every turn posted:
 * - while file edits are not `ask`, a turn's offers are left out: a chip
 *   that can never work is not drawn;
 * - otherwise each offer carries its derived status
 *   (`workshopEditOfferStatus`, over the full ledger, so an answer outside
 *   the webview's window still counts), and `blocked: 'author-left'` when
 *   the reply's author is no longer in the room. An offer with options
 *   carries one status per option (`optionStatuses`) in place of its own.
 * The ledger is read only for a turn that holds an offer. Without a room
 * view (a test, a caller with no room), offers pass with no status.
 *
 * `reactionDelivery` (ADR 2026-11-07 D6) is host bookkeeping the webview
 * never reads, so it never leaves the host (PR #246 L3). `trailerOutcomes`
 * (ADR 2026-11-17 D13) is host-only the same way: it is for the persona's
 * next message, never the webview.
 *
 * A passage-search card (ADR 2026-11-20 D19) carries the host's derived
 * `view` of its state, worked out the same way: from the full ledger and
 * from what this window is doing for it. The delivery's receipt
 * (`passageSearchDelivery`) is read on the host and never leaves it.
 */

import { workshopTodoStatusChangesForWebview } from '@/application/services/workshop/todos/WorkshopTodoStatusRows';
import {
  workshopEditOfferForWebview,
  workshopFileEditProposalForWebview,
  type WorkshopEditOfferStatus,
  type WorkshopTurn
} from '@messages';
import { workshopEditOfferStatus } from './WorkshopEditOfferStatus';
import {
  workshopPassageSearchRequestForWebview,
  type WorkshopPassageSearchWindowCard
} from '@/application/services/workshop/passageSearch/WorkshopPassageSearchStatus';

/** The room facts an offer's view is derived from; read when a turn is posted. */
export interface WorkshopEditOfferRoomView {
  /** `proseMinion.workshop.fileEdits` is `ask` now. */
  readonly fileEditsOpen: boolean;
  /** A reply is running. */
  readonly runActive: boolean;
  /** The full ledger, not the snapshot's window. */
  readonly ledger: () => readonly WorkshopTurn[];
  /** Whether the persona who wrote this reply is still in the room, as host or guest. */
  readonly authorPresent: (turn: WorkshopTurn) => boolean;
  /** The open room's session id: a saved to-do row made in another room offers no Undo (ADR 2026-11-19 D5). */
  readonly liveSessionId?: () => string | undefined;
  /** What this window is doing for a passage-search card (ADR 2026-11-20 D19): searching it, or holding its result. */
  readonly passageSearch?: (turnId: string) => WorkshopPassageSearchWindowCard | undefined;
}

/** A view for several turns that reads the ledger at most once. */
export function workshopEditOfferRoomViewOnce(view: WorkshopEditOfferRoomView): WorkshopEditOfferRoomView {
  let ledger: readonly WorkshopTurn[] | undefined;
  return { ...view, ledger: () => (ledger ??= view.ledger()) };
}

export function workshopTurnForWebview(turn: WorkshopTurn, room?: WorkshopEditOfferRoomView): WorkshopTurn {
  if (!turn.highlights && !turn.fileEditProposals && !turn.editOffers && !turn.reactionDelivery && !turn.trailerOutcomes && !turn.todoStatusChanges
    && !turn.passageSearchRequest && !turn.passageSearchDelivery) {
    return turn;
  }
  const {
    highlights, editOffers, reactionDelivery: _hostOnly, trailerOutcomes: _hostOnlyOutcomes, todoStatusChanges,
    passageSearchRequest: _card, passageSearchDelivery: _receipt, ...rest
  } = turn;
  const passageSearchRequest = workshopPassageSearchRequestForWebview(turn, room && {
    ledger: room.ledger,
    window: (turnId) => room.passageSearch?.(turnId),
    authorPresent: room.authorPresent(turn)
  });
  const offers = editOffers && (!room || room.fileEditsOpen) ? editOffers : undefined;
  return {
    ...rest,
    ...(highlights ? { highlightSummary: { title: highlights.set.title, count: highlights.set.places.length } } : {}),
    ...(passageSearchRequest ? { passageSearchRequest } : {}),
    ...(turn.fileEditProposals ? { fileEditProposals: turn.fileEditProposals.map(workshopFileEditProposalForWebview) } : {}),
    ...(todoStatusChanges ? { todoStatusChanges: workshopTodoStatusChangesForWebview(todoStatusChanges, room?.liveSessionId?.()) } : {}),
    ...(offers
      ? { editOffers: offers.map((offer) => workshopEditOfferForWebview(offer, room && ((option) => statusOf(turn, offer.kind, option, room)))) }
      : {})
  };
}

function statusOf(
  turn: WorkshopTurn,
  kind: NonNullable<WorkshopTurn['editOffers']>[number]['kind'],
  option: number | undefined,
  room: WorkshopEditOfferRoomView
): WorkshopEditOfferStatus {
  const status = workshopEditOfferStatus(room.ledger(), turn.id, kind, { runActive: room.runActive }, option);
  return status.state === 'asked' || room.authorPresent(turn) ? status : { ...status, blocked: 'author-left' };
}
