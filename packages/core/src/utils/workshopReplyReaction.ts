/**
 * A reply's reaction frames, judged (ADR 2026-11-07 D5). Pure: the tail
 * extractor (`workshopReplyControls`) finds the frames in the same pass as
 * memory and file-edit frames and hands this the ones tagged
 * `<prose-minion-reaction>`, each with whether it stands at the tail.
 *
 * Each frame is judged on its own, in the order written:
 *
 * - persona reactions must be on (`proseMinion.workshop.reactions.personas`,
 *   read with the reply; Q8): with them off, every frame is `reactions-off`;
 * - the frame closed, not nested, exactly tagged, and at the tail, as every
 *   trailer is (`workshopReplyTrailerStructureRejection`);
 * - its inside, trimmed and case-folded, exactly a known id (`unknown`
 *   otherwise). The model writes the id, never the glyph (D1), so the inside
 *   is compared against the closed ASCII list and nothing else is read;
 * - the first well-formed frame holds the reply's one slot: any later
 *   well-formed frame is `over-cap`;
 * - the reply must answer a writer message (`no-target` otherwise: a tool
 *   report's synthesis has no writer message to react to).
 *
 * Dropped means not shown and not stored. A log names the reason and, only
 * when the frame held a known id, that id; never the frame's text.
 */

import { isWorkshopReactionId, type WorkshopReactionId } from '@shared/constants/workshopReactions';
import {
  workshopReplyTrailerStructureRejection,
  type WorkshopReplyTrailerFrame,
  type WorkshopReplyTrailerStructureRejection
} from '@/utils/workshopReplyTrailerFrames';

export const WORKSHOP_REACTION_TAG = 'prose-minion-reaction';

export const WORKSHOP_REACTION_REDACTION = '[reaction removed]';

export type WorkshopReplyReactionRejection =
  | WorkshopReplyTrailerStructureRejection
  | 'unknown'
  | 'over-cap'
  | 'no-target'
  | 'reactions-off';

/** One dropped frame: why, and its id when it named a known one (safe for a log). */
export interface WorkshopReplyReactionDrop {
  readonly reason: WorkshopReplyReactionRejection;
  readonly reaction?: WorkshopReactionId;
}

export interface WorkshopReplyReactionControl {
  /** The reaction kept, at most one a reply. */
  readonly reaction?: WorkshopReactionId;
  /** One entry per frame dropped, in the order written. */
  readonly rejections: readonly WorkshopReplyReactionDrop[];
}

export interface WorkshopReplyReactionOptions {
  /** Whether personas may react now (Q8). */
  readonly open: boolean;
  /** Whether the reply answers a writer message it may react to. */
  readonly hasTarget: boolean;
}

/** A frame's inside as a known id: trimmed and case-folded, nothing else. */
export function decodeWorkshopReactionTrailer(inner: string): WorkshopReactionId | undefined {
  const id = inner.trim().toLowerCase();
  return isWorkshopReactionId(id) ? id : undefined;
}

export function judgeWorkshopReplyReactions(
  frames: ReadonlyArray<{ readonly frame: WorkshopReplyTrailerFrame; readonly atTail: boolean }>,
  options: WorkshopReplyReactionOptions
): WorkshopReplyReactionControl {
  const rejections: WorkshopReplyReactionDrop[] = [];
  let kept: WorkshopReactionId | undefined;
  let slotTaken = false;
  for (const { frame, atTail } of frames) {
    const known = frame.inner === undefined ? undefined : decodeWorkshopReactionTrailer(frame.inner);
    const drop = (reason: WorkshopReplyReactionRejection): void => {
      rejections.push(known ? { reason, reaction: known } : { reason });
    };
    if (!options.open) {
      drop('reactions-off');
      continue;
    }
    const structural = workshopReplyTrailerStructureRejection(frame, atTail);
    if (structural) {
      drop(structural);
      continue;
    }
    if (!known) {
      drop('unknown');
      continue;
    }
    if (slotTaken) {
      drop('over-cap');
      continue;
    }
    slotTaken = true;
    if (!options.hasTarget) {
      drop('no-target');
      continue;
    }
    kept = known;
  }
  return kept ? { reaction: kept, rejections } : { rejections };
}

/** The log line for one dropped frame: the reason, and the id only when known. */
export function workshopReplyReactionDropLog(drop: WorkshopReplyReactionDrop): string {
  return `Persona reaction dropped (reason=${drop.reason}${drop.reaction ? `; reaction=${drop.reaction}` : ''})`;
}
