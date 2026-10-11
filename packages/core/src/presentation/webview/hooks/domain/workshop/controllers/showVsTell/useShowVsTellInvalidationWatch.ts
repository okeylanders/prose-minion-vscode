/**
 * Room-side invalidation for the Show vs. Tell authoring controller.
 *
 * Two host facts outside the draft can make settled work stale while the sheet
 * is open: the writer changes the widget model (a different model would have
 * produced a different workup), or the room a source reference resolved
 * against becomes a different room. Both cancel an in-flight attempt and clear
 * the workup, kept variants, and carry modes, with a visible notice.
 *
 * Transport-free: the controller injects how to cancel and how to clear.
 */

import * as React from 'react';
import type { WorkshopShowVsTellDraft } from '@messages';
import { changedWorkNotice, hasSettledWork } from './showVsTellAuthoringRules';

export interface UseShowVsTellInvalidationWatchOptions {
  open: boolean;
  widgetModelId: string;
  /**
   * Host revision of what the room's source references resolve to. Only work
   * grounded on a source reference depends on it: a beat generated with no
   * source is the same request in any room.
   */
  roomKey: string;
  draftRef: React.MutableRefObject<WorkshopShowVsTellDraft>;
  activeTokenRef: React.MutableRefObject<string | undefined>;
  cancelActiveGeneration: () => void;
  clearSettledWork: (draft: WorkshopShowVsTellDraft) => void;
  setInvalidationNotice: (notice: string | null) => void;
}

export function useShowVsTellInvalidationWatch({
  open,
  widgetModelId,
  roomKey,
  draftRef,
  activeTokenRef,
  cancelActiveGeneration,
  clearSettledWork,
  setInvalidationNotice
}: UseShowVsTellInvalidationWatchOptions): void {
  const previousWidgetModelIdRef = React.useRef(widgetModelId);
  const previousRoomKeyRef = React.useRef(roomKey);
  const wasOpenRef = React.useRef(false);

  const invalidate = React.useCallback((
    label: 'widget model' | 'room',
    onlyWhenGrounded: boolean
  ) => {
    const current = draftRef.current;
    if (onlyWhenGrounded && current.surroundingContext.sourceReferences.length === 0) {
      return;
    }
    const hadActiveGeneration = activeTokenRef.current !== undefined;
    const hadWork = hasSettledWork(current);
    if (!hadActiveGeneration && !hadWork) {
      return;
    }
    cancelActiveGeneration();
    if (hadWork) {
      clearSettledWork(current);
    }
    setInvalidationNotice(changedWorkNotice(label, hadActiveGeneration, hadWork));
  }, [activeTokenRef, cancelActiveGeneration, clearSettledWork, draftRef, setInvalidationNotice]);

  React.useEffect(() => {
    // A sheet that is closed, or only just opened, adopts the current values:
    // what changed before the writer saw it cannot have invalidated their work.
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    const modelChanged = previousWidgetModelIdRef.current !== widgetModelId;
    const roomChanged = previousRoomKeyRef.current !== roomKey;
    previousWidgetModelIdRef.current = widgetModelId;
    previousRoomKeyRef.current = roomKey;
    if (!open || justOpened) {
      return;
    }
    if (modelChanged) {
      invalidate('widget model', false);
    }
    if (roomChanged) {
      invalidate('room', true);
    }
  }, [invalidate, open, roomKey, widgetModelId]);
}
