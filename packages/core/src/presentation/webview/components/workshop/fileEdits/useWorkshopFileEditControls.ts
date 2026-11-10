/**
 * The thread's file-edit controls, built from the hook and the room's lock
 * (epic Slice 4b), so `WorkshopApp` wires the cards with one call.
 */

import * as React from 'react';
import type { UseWorkshopFileEditsReturn } from '@hooks/domain/workshop/useWorkshopFileEdits';
import { workshopFileEditReasonWords } from '@shared/constants/workshopFileEditWords';
import type { WorkshopFileEditControls } from './WorkshopFileEditCard';

export interface WorkshopFileEditControlsInput {
  fileEdits: UseWorkshopFileEditsReturn;
  /** The room's mutation lock. */
  locked: boolean;
  /** A reply is running: the host would refuse Apply with `run-active`, so the buttons say so first. */
  running: boolean;
}

export function useWorkshopFileEditControls({ fileEdits, locked, running }: WorkshopFileEditControlsInput): WorkshopFileEditControls {
  const { busyCards, cardFeedback, previews, apply, review, decline, requestPreview } = fileEdits;
  return React.useMemo<WorkshopFileEditControls>(() => ({
    disabled: locked,
    ...(running ? { disabledReason: workshopFileEditReasonWords('run-active') } : {}),
    busyCards,
    cardFeedback,
    previews,
    onApply: apply,
    onReview: review,
    onDecline: decline,
    onRequestPreview: requestPreview
  }), [locked, running, busyCards, cardFeedback, previews, apply, review, decline, requestPreview]);
}
