/**
 * A Proofread reply's frame (ADR 2026-10-21 D6): its sentinels and ceiling,
 * read by the frame reader every Draft Edit pass shares
 * (`DraftEditResponseFrame`).
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { readDraftEditFrame, type DraftEditFrame, type DraftEditFrameSpec } from '@services/draftEdit/DraftEditResponseFrame';

export const PROOFREAD_OPENING_SENTINEL = '===PROOFREAD_V1===';
export const PROOFREAD_CLOSING_SENTINEL = '===END_PROOFREAD_V1===';

export const PROOFREAD_FRAME: DraftEditFrameSpec = {
  opening: PROOFREAD_OPENING_SENTINEL,
  closing: PROOFREAD_CLOSING_SENTINEL,
  responseCharacters: PROMPT_BUDGETS.proofread.responseCharacters
};

/** Read a Proofread reply's frame; throws `DraftEditFrameError` when it cannot be read. */
export function readProofreadFrame(content: string): DraftEditFrame {
  return readDraftEditFrame(content, PROOFREAD_FRAME);
}
