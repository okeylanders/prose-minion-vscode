/**
 * A reply's edit-offer frames, judged (ADR 2026-11-10 D1; epic Slice 1).
 * Pure: the tail extractor (`workshopReplyControls`) finds the frames and
 * hands this the ones tagged `<prose-minion-edit-offer>`, each with whether
 * it stands at the tail, and what else the reply held. Each frame is judged
 * on its own, in the order written, so one bad frame drops only itself:
 *
 * - file edits must be on (`fileEdits: ask`, read when the reply is read):
 *   with them off, every frame is `file-edits-off`;
 * - the frame closed, not nested, exactly tagged, and at the tail, as every
 *   trailer is (`workshopReplyTrailerStructureRejection`);
 * - its inside within `frameCharacters` (`oversized` otherwise: dropped
 *   whole, never read);
 * - its inside decodes (`unknown-kind`, or `malformed:<fault>`, otherwise);
 * - its kind is no earlier kept frame's (`duplicate-kind`): one per kind;
 * - the reply holds prose (`no-prose` otherwise): an offer says what the
 *   reply's prose holds, so a reply of trailers alone offers nothing;
 * - the reply keeps no file-edit proposal (`has-file-edit-proposal`
 *   otherwise): it proposed outright, so there is nothing left to offer.
 *
 * What only the host can know is judged later, in
 * `WorkshopReplyEditOffers`: the file resolving to one identity, the reply
 * being a persona's, and the prose the ledger keeps (its length, and a reply
 * whose only prose was a widget's setup).
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  decodeWorkshopEditOffer,
  type WorkshopEditOfferDraft,
  type WorkshopEditOfferFault
} from '@/utils/workshopEditOfferProtocol';
import {
  workshopReplyTrailerStructureRejection,
  type WorkshopReplyTrailerFrame,
  type WorkshopReplyTrailerStructureRejection
} from '@/utils/workshopReplyTrailerFrames';

export const WORKSHOP_EDIT_OFFER_REDACTION = '[edit offer removed]';

export type WorkshopReplyEditOfferRejection =
  | WorkshopReplyTrailerStructureRejection
  | 'file-edits-off'
  | 'oversized'
  | 'unknown-kind'
  | 'duplicate-kind'
  | 'no-prose'
  | 'has-file-edit-proposal'
  | `malformed:${Exclude<WorkshopEditOfferFault, 'unknown-kind'>}`;

export interface WorkshopReplyEditOfferControl {
  readonly kind: 'frames';
  /** The eligible offers, in the order written: at most one per kind. */
  readonly offers: readonly WorkshopEditOfferDraft[];
  /** One reason per frame dropped, in the order written. */
  readonly rejections: readonly WorkshopReplyEditOfferRejection[];
}

/** What the rest of the reply is, as the extractor found it. */
export interface WorkshopReplyEditOfferSetting {
  /** Whether personas may propose file edits now (`fileEdits: ask`). */
  readonly open: boolean;
  /** Whether anything but trailers is left of the reply. */
  readonly hasProse: boolean;
  /** Whether the reply keeps a file-edit proposal of its own. */
  readonly hasFileEditProposal: boolean;
}

export function judgeWorkshopReplyEditOffers(
  frames: ReadonlyArray<{ readonly frame: WorkshopReplyTrailerFrame; readonly atTail: boolean }>,
  setting: WorkshopReplyEditOfferSetting
): WorkshopReplyEditOfferControl {
  const offers: WorkshopEditOfferDraft[] = [];
  const rejections: WorkshopReplyEditOfferRejection[] = [];
  for (const { frame, atTail } of frames) {
    const verdict = judgeFrame(frame, atTail, setting.open);
    if (typeof verdict === 'string') {
      rejections.push(verdict);
    } else if (offers.some((offer) => offer.kind === verdict.kind)) {
      rejections.push('duplicate-kind');
    } else if (!setting.hasProse) {
      rejections.push('no-prose');
    } else if (setting.hasFileEditProposal) {
      rejections.push('has-file-edit-proposal');
    } else {
      offers.push(verdict);
    }
  }
  return { kind: 'frames', offers, rejections };
}

function judgeFrame(frame: WorkshopReplyTrailerFrame, atTail: boolean, open: boolean): WorkshopEditOfferDraft | WorkshopReplyEditOfferRejection {
  if (!open) {
    return 'file-edits-off';
  }
  const structural = workshopReplyTrailerStructureRejection(frame, atTail);
  if (structural) {
    return structural;
  }
  const inner = frame.inner ?? '';
  if (inner.length > PROMPT_BUDGETS.workshopEditOffers.frameCharacters) {
    return 'oversized';
  }
  const decoded = decodeWorkshopEditOffer(inner);
  if (decoded.kind === 'offer') {
    return decoded.offer;
  }
  return decoded.fault === 'unknown-kind' ? 'unknown-kind' : `malformed:${decoded.fault}`;
}
