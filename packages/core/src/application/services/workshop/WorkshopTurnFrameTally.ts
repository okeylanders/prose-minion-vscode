/**
 * The room handler's frames, tallied as they are placed (ADR 2026-11-18 D3,
 * D6). Each helper returns or places exactly what the handler placed
 * before, in the same order, and adds each frame to the run's recorder
 * under its piece. Nothing here writes a frame of its own.
 */

import type { WorkshopContextTallyRecorder } from '@services/analysis/WorkshopContextTally';
import {
  buildGuestExcerptFrame,
  type WorkshopBehaviorFrames,
  type WorkshopGuestJoinInput,
  type WorkshopGuestJoinMessage
} from '@/application/services/workshop/WorkshopPromptBuilder';
import { buildWorkshopOpenConversationFrame } from '@/utils/workshopPromptFrames';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';

export interface WorkshopTurnThreadFrames {
  /** Message attachments and a widget commit's artifact, as built. */
  readonly attachments: readonly string[];
  /** A pressed edit offer's directive. */
  readonly directive: readonly string[];
  /** The edit-offer reminder. */
  readonly reminders: readonly string[];
  /** The `<workshop-trailer-outcomes>` line (ADR 2026-11-17 D14). */
  readonly trailerOutcomes: readonly string[];
}

/** The thread-artifact slot's frames in the handler's order, each tallied. */
export function tallyWorkshopThreadFrames(
  tally: WorkshopContextTallyRecorder | undefined,
  frames: WorkshopTurnThreadFrames
): string[] {
  tally?.add('context.message-attachments', ...frames.attachments);
  tally?.add('room.directive', ...frames.directive);
  tally?.add('room.reminders', ...frames.reminders);
  tally?.add('room.trailer-outcomes', ...frames.trailerOutcomes);
  return [...frames.attachments, ...frames.directive, ...frames.reminders, ...frames.trailerOutcomes];
}

/** The rest of a turn's host-written frames, each as the message carries it. */
export function tallyWorkshopTurnFrames(
  tally: WorkshopContextTallyRecorder | undefined,
  frames: {
    readonly roomCatchUp?: string;
    readonly todoSnapshot?: string;
    readonly hostUpdate?: string;
    readonly reactions?: string;
    /** Absent when the message does not carry them (a fresh host's envelope tallies its own). */
    readonly behavior?: WorkshopBehaviorFrames;
  }
): void {
  tally?.add('room.catch-up', frames.roomCatchUp);
  tally?.add('todos.snapshot', frames.todoSnapshot);
  tally?.add('context.updates', frames.hostUpdate);
  tally?.add('room.reactions', frames.reactions);
  tally?.add('room.time', frames.behavior?.timeFrame);
  tally?.add('room.behavior', frames.behavior?.transitionFrame, frames.behavior?.interactionFrame, frames.behavior?.activationFrame);
}

/** A guest's join message, piece by piece; the join builder writes it, unchanged. */
export function tallyWorkshopGuestJoin(
  tally: WorkshopContextTallyRecorder | undefined,
  input: WorkshopGuestJoinInput,
  join: WorkshopGuestJoinMessage
): void {
  tally?.add('room.join', join.transcript.message);
  tally?.add('context.excerpt', input.excerpt
    ? buildGuestExcerptFrame(input.excerpt)
    : buildWorkshopOpenConversationFrame(workshopPersonaLabel(input.guestPersonaId)));
  tally?.add('context.attachments', input.contextAttachmentsFrame);
  tally?.add('room.reactions', input.reactionsFrame);
  tally?.add('room.reminders', input.reactionInviteFrame);
  tally?.add('room.time', input.timeFrame);
  tally?.add('room.behavior', input.transitionFrame, input.interactionFrame, input.activationFrame);
}
