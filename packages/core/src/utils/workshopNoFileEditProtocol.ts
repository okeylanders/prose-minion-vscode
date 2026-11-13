/**
 * The no-file-edit frame (ADR 2026-11-10 D4, D5; epic Slice 2). Pure.
 *
 * A persona asked to answer a reply's offer with file edits, and finding
 * nothing to change, answers with exactly:
 *
 *   <prose-minion-no-file-edit><why>one line</why></prose-minion-no-file-edit>
 *
 * The tag joins the tail extractor's one pass (`workshopReplyControls`), so
 * the frame never shows in a bubble, a stream or retained history, wherever
 * a persona writes it. Only the answer reader (`workshopEditOfferAnswer`)
 * gives it meaning; in any other reply it is stripped and counted.
 *
 * A frame is kept when it is closed, exactly tagged, not nested, at the
 * tail, and holds one `<why>`: one line, not empty, at most `whyCharacters`.
 * The first kept frame is the reply's; a second is `duplicate`. Faults are
 * values, never thrown. Reasons, never text: no caller logs the why.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  workshopReplyTrailerStructureRejection,
  type WorkshopReplyTrailerFrame,
  type WorkshopReplyTrailerStructureRejection
} from '@/utils/workshopReplyTrailerFrames';
import { readWorkshopTrailerElements, type WorkshopTrailerReadFault } from '@/utils/workshopTrailerElements';

export const WORKSHOP_NO_FILE_EDIT_TAG = 'prose-minion-no-file-edit';

export const WORKSHOP_NO_FILE_EDIT_REDACTION = '[no file edit note removed]';

export const WORKSHOP_NO_FILE_EDIT_ELEMENTS = ['why'] as const;

export type WorkshopNoFileEditFault = 'missing-why' | 'repeated-element' | 'why-not-one-line' | 'why-too-long' | WorkshopTrailerReadFault;

export type WorkshopReplyNoFileEditRejection =
  | WorkshopReplyTrailerStructureRejection
  | 'duplicate'
  | `malformed:${WorkshopNoFileEditFault}`;

export interface WorkshopReplyNoFileEditControl {
  readonly kind: 'frames';
  /** The kept frame's one line; absent when no frame was kept. */
  readonly why?: string;
  /** One reason per frame dropped, in the order written. */
  readonly rejections: readonly WorkshopReplyNoFileEditRejection[];
}

const NOT_ONE_LINE = /[\p{Cc}\u2028\u2029]/u;

/** Decode a frame's inside: its one line, or why it has none. */
export function decodeWorkshopNoFileEdit(inner: string): { readonly why: string } | { readonly fault: WorkshopNoFileEditFault } {
  const read = readWorkshopTrailerElements(inner, { elements: WORKSHOP_NO_FILE_EDIT_ELEMENTS, empty: [] });
  if (read.kind === 'fault') {
    return { fault: read.fault };
  }
  if (read.elements.length > 1) {
    return { fault: 'repeated-element' };
  }
  const why = read.elements[0]?.content.trim();
  if (!why) {
    return { fault: 'missing-why' };
  }
  if (NOT_ONE_LINE.test(why)) {
    return { fault: 'why-not-one-line' };
  }
  return why.length > PROMPT_BUDGETS.workshopEditOffers.whyCharacters ? { fault: 'why-too-long' } : { why };
}

export function judgeWorkshopReplyNoFileEdit(
  frames: ReadonlyArray<{ readonly frame: WorkshopReplyTrailerFrame; readonly atTail: boolean }>
): WorkshopReplyNoFileEditControl {
  let why: string | undefined;
  const rejections: WorkshopReplyNoFileEditRejection[] = [];
  for (const { frame, atTail } of frames) {
    const structural = workshopReplyTrailerStructureRejection(frame, atTail);
    if (structural) {
      rejections.push(structural);
      continue;
    }
    const decoded = decodeWorkshopNoFileEdit(frame.inner ?? '');
    if ('fault' in decoded) {
      rejections.push(`malformed:${decoded.fault}`);
    } else if (why !== undefined) {
      rejections.push('duplicate');
    } else {
      why = decoded.why;
    }
  }
  return { kind: 'frames', ...(why !== undefined ? { why } : {}), rejections };
}
