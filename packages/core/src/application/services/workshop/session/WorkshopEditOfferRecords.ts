/**
 * `WorkshopTurn.editOffers` in the persisted session (ADR 2026-11-10 D2, D8;
 * epic Slice 1). Optional and additive: written only when present, no
 * `schemaVersion` change in this slice (the release decision is ADR
 * 2026-07-30's, at the epic's end). A session without it reads and writes
 * exactly as before.
 *
 * When present it is exact: one to `offersPerReply` offers, only on a
 * persona's reply, no two of one kind. Each offer holds:
 * - `kind`: `WORKSHOP_EDIT_OFFER_KINDS`;
 * - `target`: the host-written identity its file resolved to when the reply
 *   was read, held to the staging contract a file-edit card's identity is
 *   (`workshopFileEditIdentityHoldable`), never to a model's lookup grammar;
 * - `count`, optional: a whole number within the trailer's bound.
 * An offer stores no state (D3), so there is nothing to settle on reopen.
 *
 * **The press's two keys** (D3; Slice 2), optional and additive the same way:
 * - `editOfferRequest` on the writer turn a press made: exactly
 *   `{ sourceTurnId, kind }`;
 * - `editOfferAnswer` on the persona's answer: exactly
 *   `{ sourceTurnId, kind, outcome }`, with a one-line `why` within
 *   `whyCharacters` on a `none` answer and never on a `proposed` one.
 * Neither stores whether the offer was used: that is derived
 * (`workshopEditOfferStatus`).
 *
 * No development checkpoint ever held another shape of these fields, so
 * `WorkshopSessionCheckpointNormalization` repairs nothing for them.
 */

import {
  WORKSHOP_EDIT_OFFER_KINDS,
  WORKSHOP_EDIT_OFFER_OUTCOMES,
  workshopFileEditIdentityHoldable,
  type WorkshopEditOffer
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  boundedArrayAt,
  enumAt,
  exactObject,
  shapeError,
  stringAt
} from '@/application/services/workshop/persistedValidation';
import { oneLineAt } from '@/application/services/workshop/session/WorkshopMemoryProposalRecords';
import { isWorkshopEditOfferCount } from '@/utils/workshopEditOfferProtocol';

const BUDGETS = PROMPT_BUDGETS.workshopEditOffers;

/** Strict structure of one turn's `editOffers`, and that its turn may carry them. */
export function assertWorkshopEditOfferShape(turn: Record<string, unknown>, path: string, checkpoint: boolean): void {
  if (turn.editOffers === undefined) {
    return;
  }
  const at = `${path}.editOffers`;
  if (!checkpoint && (turn.role !== 'assistant' || (turn.participant !== 'host' && turn.participant !== 'guest'))) {
    shapeError(at, 'a host or guest persona reply');
  }
  boundedArrayAt(turn.editOffers, at, 1, BUDGETS.offersPerReply, 'edit offers');
  const kinds = new Set<unknown>();
  turn.editOffers.forEach((item, index) => {
    const offer = exactObject(item, `${at}[${index}]`, ['kind', 'target'], ['count']);
    enumAt(offer.kind, `${at}[${index}].kind`, WORKSHOP_EDIT_OFFER_KINDS);
    if (kinds.has(offer.kind)) {
      shapeError(`${at}[${index}].kind`, 'a kind no earlier offer has');
    }
    kinds.add(offer.kind);
    const target = exactObject(offer.target, `${at}[${index}].target`, ['kind', 'documentUri', 'relativePath']);
    enumAt(target.kind, `${at}[${index}].target.kind`, ['file', 'excerpt']);
    if (!workshopFileEditIdentityHoldable(target)) {
      shapeError(`${at}[${index}].target`, 'a host identity: a one-line documentUri and display path, each within its bound');
    }
    if (offer.count !== undefined && !isWorkshopEditOfferCount(offer.count)) {
      shapeError(`${at}[${index}].count`, `a whole number from 1 to ${BUDGETS.count}`);
    }
  });
}

/** Strict structure of a turn's `editOfferRequest` and `editOfferAnswer`, and that its turn may carry them. */
export function assertWorkshopEditOfferPressShape(turn: Record<string, unknown>, path: string, checkpoint: boolean): void {
  if (turn.editOfferRequest !== undefined) {
    const at = `${path}.editOfferRequest`;
    if (!checkpoint && (turn.role !== 'user' || turn.participant !== 'writer')) {
      shapeError(at, 'a writer turn');
    }
    const request = exactObject(turn.editOfferRequest, at, ['sourceTurnId', 'kind']);
    stringAt(request.sourceTurnId, `${at}.sourceTurnId`);
    enumAt(request.kind, `${at}.kind`, WORKSHOP_EDIT_OFFER_KINDS);
  }
  if (turn.editOfferAnswer !== undefined) {
    const at = `${path}.editOfferAnswer`;
    if (!checkpoint && (turn.role !== 'assistant' || (turn.participant !== 'host' && turn.participant !== 'guest'))) {
      shapeError(at, 'a host or guest persona reply');
    }
    const answer = exactObject(turn.editOfferAnswer, at, ['sourceTurnId', 'kind', 'outcome'], ['why']);
    stringAt(answer.sourceTurnId, `${at}.sourceTurnId`);
    enumAt(answer.kind, `${at}.kind`, WORKSHOP_EDIT_OFFER_KINDS);
    enumAt(answer.outcome, `${at}.outcome`, WORKSHOP_EDIT_OFFER_OUTCOMES);
    if (answer.why !== undefined) {
      if (answer.outcome !== 'none') {
        shapeError(`${at}.why`, 'absent on an answer that proposed edits');
      }
      oneLineAt(answer.why, `${at}.why`, BUDGETS.whyCharacters);
    }
  }
}

export function cloneWorkshopEditOffer(offer: WorkshopEditOffer): WorkshopEditOffer {
  return { ...offer, target: { ...offer.target } };
}
