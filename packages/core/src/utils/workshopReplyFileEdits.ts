/**
 * A reply's file-edit frames, judged (ADR 2026-11-05 D2, D9; epic Slice 3).
 * Pure: the tail extractor (`workshopReplyControls`) finds the frames and
 * hands this the ones tagged `<prose-minion-file-edit>`, each with whether it
 * stands at the tail. Each frame is judged on its own, in the order written,
 * so one malformed frame drops only itself:
 *
 * - file edits must be on (`fileEdits: ask`, read when the reply is read):
 *   with them off, every frame is `file-edits-off`, dropped and counted;
 * - the frame closed, not nested, exactly tagged, and at the tail, as a
 *   memory frame is (`workshopReplyTrailerStructureRejection`);
 * - its inside decodes (`malformed:<fault>` otherwise);
 * - its file is no earlier frame's (`duplicate`): one frame per file;
 * - at most `proposalsPerReply` are kept: a well-formed one past them is
 *   `over-cap`, dropped whole and counted, never cut.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  decodeWorkshopFileEdit,
  sameWorkshopFileEditTarget,
  type WorkshopFileEditDraft,
  type WorkshopFileEditFault
} from '@/utils/workshopFileEditProtocol';
import {
  workshopReplyTrailerStructureRejection,
  type WorkshopReplyTrailerFrame,
  type WorkshopReplyTrailerStructureRejection
} from '@/utils/workshopReplyTrailerFrames';

export const WORKSHOP_FILE_EDIT_PROPOSALS_PER_REPLY = PROMPT_BUDGETS.workshopFileEdits.proposalsPerReply;

export type WorkshopReplyFileEditRejection =
  | WorkshopReplyTrailerStructureRejection
  | 'duplicate'
  | 'over-cap'
  | 'file-edits-off'
  | `malformed:${WorkshopFileEditFault}`;

export interface WorkshopReplyFileEditControl {
  readonly kind: 'frames';
  /** The eligible edits, in the order written, at most `proposalsPerReply`. */
  readonly proposals: readonly WorkshopFileEditDraft[];
  /** One reason per frame dropped, in the order written. */
  readonly rejections: readonly WorkshopReplyFileEditRejection[];
}

export function judgeWorkshopReplyFileEdits(
  frames: ReadonlyArray<{ readonly frame: WorkshopReplyTrailerFrame; readonly atTail: boolean }>,
  open: boolean
): WorkshopReplyFileEditControl {
  const proposals: WorkshopFileEditDraft[] = [];
  const rejections: WorkshopReplyFileEditRejection[] = [];
  for (const { frame, atTail } of frames) {
    const verdict = judgeFrame(frame, atTail, open);
    if (typeof verdict === 'string') {
      rejections.push(verdict);
    } else if (proposals.some((proposal) => sameWorkshopFileEditTarget(proposal.target, verdict.target))) {
      rejections.push('duplicate');
    } else if (proposals.length >= WORKSHOP_FILE_EDIT_PROPOSALS_PER_REPLY) {
      rejections.push('over-cap');
    } else {
      proposals.push(verdict);
    }
  }
  return { kind: 'frames', proposals, rejections };
}

function judgeFrame(frame: WorkshopReplyTrailerFrame, atTail: boolean, open: boolean): WorkshopFileEditDraft | WorkshopReplyFileEditRejection {
  if (!open) {
    return 'file-edits-off';
  }
  const structural = workshopReplyTrailerStructureRejection(frame, atTail);
  if (structural) {
    return structural;
  }
  const decoded = decodeWorkshopFileEdit(frame.inner ?? '');
  return decoded.kind === 'edit' ? decoded.edit : `malformed:${decoded.fault}`;
}
