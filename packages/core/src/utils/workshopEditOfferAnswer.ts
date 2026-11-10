/**
 * Reading the answer to a pressed offer (ADR 2026-11-10 D5; epic Slice 2).
 * Pure. The answer is read with every other trailer closed, by the tail
 * extractor's one pass:
 *
 * | The reply holds                          | Outcome    |
 * |------------------------------------------|------------|
 * | One or more kept file-edit frames        | `proposed` |
 * | The no-file-edit frame and no file edit  | `none`     |
 * | Neither                                  | `neither`  |
 *
 * - **Kept** is the reply reader's own rule (`workshopReplyFileEdits`): a
 *   closed, well-formed frame at the tail, within its bounds. A reply whose
 *   file-edit frames were all dropped is `neither`, even beside a no-edit
 *   frame: it tried to edit and did not.
 * - **Everything else is dropped and counted,** never read: memory
 *   proposals, edit offers, a no-edit frame beside kept edits, and the
 *   reply's prose (a widget recommendation's text included; its reader is
 *   not run). `stray` is how many characters of prose that was.
 *
 * The same function is behind the engine's final-reply check for a press
 * (`workshopEditOfferAnswerVerdict`) and completion's reading of the
 * result, and the engine hands the check the reply as it returns it, before
 * any display notice, so the two cannot disagree about what an answer is
 * (PR #252 F-01).
 */

import type { WorkshopFileEditDraft } from '@/utils/workshopFileEditProtocol';
import { extractWorkshopReplyControls } from '@/utils/workshopReplyControls';

export interface WorkshopEditOfferAnswerDropped {
  /** File-edit frames the reply reader dropped. */
  readonly fileEdits: number;
  /** Project-memory frames: an answer proposes none. */
  readonly memory: number;
  /** Edit-offer frames: an answer offers nothing. */
  readonly editOffers: number;
  /** No-file-edit frames dropped as malformed, or beside kept edits. */
  readonly noFileEdit: number;
  /** Characters of prose (and any widget text) outside every trailer. */
  readonly strayCharacters: number;
}

export type WorkshopEditOfferAnswerRead =
  | { readonly outcome: 'proposed'; readonly proposals: readonly WorkshopFileEditDraft[]; readonly dropped: WorkshopEditOfferAnswerDropped }
  | { readonly outcome: 'none'; readonly why: string; readonly dropped: WorkshopEditOfferAnswerDropped }
  | { readonly outcome: 'neither'; readonly dropped: WorkshopEditOfferAnswerDropped };

export function readWorkshopEditOfferAnswer(reply: string): WorkshopEditOfferAnswerRead {
  // File edits are read as open: the press checked the setting before the run, and completion checks it again.
  const controls = extractWorkshopReplyControls(reply, { memoryOpen: false, fileEditsOpen: true });
  const proposals = controls.fileEdits?.proposals ?? [];
  const fileEditFrames = proposals.length + (controls.fileEdits?.rejections.length ?? 0);
  const why = controls.noFileEdit?.why;
  const base = {
    fileEdits: controls.fileEdits?.rejections.length ?? 0,
    memory: controls.memory.kind === 'frames' ? controls.memory.proposals.length + controls.memory.rejections.length : 0,
    editOffers: controls.editOffers ? controls.editOffers.offers.length + controls.editOffers.rejections.length : 0,
    strayCharacters: controls.rest.trim().length
  };
  const noFileEditRejected = controls.noFileEdit?.rejections.length ?? 0;
  if (proposals.length > 0) {
    return { outcome: 'proposed', proposals, dropped: { ...base, noFileEdit: noFileEditRejected + (why !== undefined ? 1 : 0) } };
  }
  if (why !== undefined && fileEditFrames === 0) {
    return { outcome: 'none', why, dropped: { ...base, noFileEdit: noFileEditRejected } };
  }
  return { outcome: 'neither', dropped: { ...base, noFileEdit: noFileEditRejected + (why !== undefined ? 1 : 0) } };
}

/** What a press's final-reply check answers: nothing (accepted), `correct` (one correction turn), or `refuse` (a failure at once). */
export type WorkshopEditOfferAnswerVerdict = 'correct' | 'refuse' | undefined;

/**
 * The verdict on a press's final reply (D5; PR #252 F-01), by the one rule
 * the engine's check and completion both read:
 * - a reply the provider cut short (its token ceiling, or an interrupted
 *   stream) is refused outright. A cut-off answer is never salvaged: a frame
 *   may be whole and its neighbour lost, and a correction would be cut the
 *   same way;
 * - a reply that is neither edits nor the no-edit frame is corrected once;
 * - anything else is accepted.
 */
export function workshopEditOfferAnswerVerdict(reply: string, facts: { readonly incomplete: boolean }): WorkshopEditOfferAnswerVerdict {
  if (facts.incomplete) {
    return 'refuse';
  }
  return readWorkshopEditOfferAnswer(reply).outcome === 'neither' ? 'correct' : undefined;
}
