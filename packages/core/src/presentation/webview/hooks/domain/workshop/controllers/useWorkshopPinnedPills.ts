/**
 * The context sheet's pin marks and Pin from a pill (ADR 2026-11-04 D4, D7,
 * decided question 6; epic Slice 4). A presentation controller: it holds only
 * which pill last asked to be pinned, and takes the pin-by-attachment-id
 * action and the host's answer from `useWorkshopPinnedContext` as injected
 * ports. It posts nothing itself and adds no route.
 *
 * Everything drawn is derived (`workshopPinnedPillViews`): the mark from the
 * list the host last sent, with its platform, through the shared match rule.
 * Nothing is persisted; the host owns the list.
 *
 * A press records the room and the attachment it was made for, so its
 * outcome is never drawn on another room's pill under a reused id (PR #213
 * F01). A press while another change waits does nothing: the button says so
 * with `aria-disabled` and keeps the focus.
 */

import * as React from 'react';
import type {
  WorkshopContextAttachmentSnapshot,
  WorkshopPinnedContextPayload
} from '@messages';
import {
  workshopPillOwnerKey,
  workshopPinnedPillViews,
  type WorkshopPillPinPosted,
  type WorkshopPinnedPillView
} from '@hooks/domain/workshop/pinnedContext/workshopPinnedPills';

export interface UseWorkshopPinnedPillsInput {
  /** The host's last answer, from `useWorkshopPinnedContext`. */
  answer?: WorkshopPinnedContextPayload;
  attachments: readonly WorkshopContextAttachmentSnapshot[];
  /** The room on screen: the snapshot's `roomRevision`. */
  room: number;
  /** The tab's view of the attachments that could be pinned. */
  pinnableIds: readonly string[];
  /** A change to the list is waiting for the host. */
  pending: boolean;
  /** Slice 3's pin by attachment id: the request id it posted, or undefined with no list to change. */
  pinAttachments: (attachmentIds: readonly string[]) => string | undefined;
}

export interface WorkshopPinnedPillsState {
  /** Each pill's mark, Pin button and refusal, by attachment id. */
  pills: Readonly<Record<string, WorkshopPinnedPillView>>;
}

export interface WorkshopPinnedPillsActions {
  /** Pin one pill's file for new sessions. */
  pin: (attachmentId: string) => void;
}

/** The host owns the list; this controller persists nothing. */
export type WorkshopPinnedPillsPersistence = Record<string, never>;

export type UseWorkshopPinnedPillsReturn = WorkshopPinnedPillsState &
  WorkshopPinnedPillsActions & {
    persistedState: WorkshopPinnedPillsPersistence;
  };

const NOTHING_PERSISTED: WorkshopPinnedPillsPersistence = {};

export function useWorkshopPinnedPills({
  answer,
  attachments,
  room,
  pinnableIds,
  pending,
  pinAttachments
}: UseWorkshopPinnedPillsInput): UseWorkshopPinnedPillsReturn {
  const [posted, setPosted] = React.useState<WorkshopPillPinPosted | undefined>(undefined);

  const pin = React.useCallback((attachmentId: string) => {
    const attachment = attachments.find((candidate) => candidate.id === attachmentId);
    if (pending || !attachment) {
      return;
    }
    const requestId = pinAttachments([attachmentId]);
    setPosted(requestId === undefined
      ? undefined
      : { attachmentId, requestId, room, owner: workshopPillOwnerKey(attachment) });
  }, [attachments, pending, pinAttachments, room]);

  const pills = React.useMemo(
    () => workshopPinnedPillViews({
      ...(answer ? { answer } : {}),
      attachments,
      room,
      pinnableIds,
      pending,
      ...(posted ? { posted } : {})
    }),
    [answer, attachments, pending, pinnableIds, posted, room]
  );

  return { pills, pin, persistedState: NOTHING_PERSISTED };
}
