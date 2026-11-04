/**
 * Presentation controller for renaming a bookmark in the Notes tab (ADR
 * 2026-11-03 D5): which bookmark's field is open, its draft, and why a label
 * was refused.
 *
 * The field checks the label with the shared rule
 * (`checkWorkshopBookmarkLabel`) before anything is sent, so the writer is
 * told what is wrong while the draft is still on screen. A blank label
 * restores the default (`null`). The host checks again and stays the
 * authority: a submitted draft stays in the field, saving, until the host
 * answers that request. Accepted closes it; refused gives the draft back with
 * the host's reason (PR #189 F-01). A later snapshot's label is never read
 * as the answer: a reset, or a name the bookmark already had, looks the same.
 *
 * One field is open at a time. Its draft belongs to its bookmark: once that
 * bookmark leaves the list, the draft is dropped rather than shown on
 * another (PR #184 F-01's rule for to-dos). The list that mounts this stays
 * mounted while Notes is hidden, so an open rename survives a tab switch,
 * and it is keyed by room, so a draft never crosses into another room.
 *
 * A controller: the rename itself is injected, and nothing here posts.
 */

import * as React from 'react';
import type { WorkshopBookmarkSummary, WorkshopRenameBookmarkResultPayload } from '@messages';
import {
  checkWorkshopBookmarkLabel,
  WORKSHOP_BOOKMARK_LABEL_FAULTS
} from '@shared/constants/workshopBookmarks';

export interface UseWorkshopBookmarkRenameOptions {
  bookmarks: readonly WorkshopBookmarkSummary[];
  /** Sends the rename and returns its request id; `null` restores the default label. */
  onRename: (bookmarkId: string, label: string | null) => string;
  /** The host's answer to the latest rename, matched here by request id. */
  outcome?: WorkshopRenameBookmarkResultPayload | null;
}

export interface WorkshopBookmarkRenameState {
  /** The bookmark whose field is open, if any. */
  editingId?: string;
  draft: string;
  /** Why the draft was refused, in the writer's words; cleared on typing. */
  fault?: string;
  /** True from Save until the host answers: Save cannot send twice. */
  saving: boolean;
  /**
   * The bookmark whose field just closed, so the list can return focus to
   * its Rename button; cleared once the list has done so.
   */
  closedId?: string;
}

export interface WorkshopBookmarkRenameActions {
  beginRename: (bookmark: WorkshopBookmarkSummary) => void;
  changeDraft: (value: string) => void;
  /** Checks the draft; sends it and closes the field, or keeps it open with the fault. */
  saveRename: () => void;
  cancelRename: () => void;
  /** The list has returned focus after a close. */
  acknowledgeClosed: () => void;
}

export interface WorkshopBookmarkRenamePersistence {
  // A draft is transient: the session file owns the label.
}

export type UseWorkshopBookmarkRenameReturn = WorkshopBookmarkRenameState &
  WorkshopBookmarkRenameActions & {
    persistedState: WorkshopBookmarkRenamePersistence;
  };

export function useWorkshopBookmarkRename({
  bookmarks,
  onRename,
  outcome = null
}: UseWorkshopBookmarkRenameOptions): UseWorkshopBookmarkRenameReturn {
  const [editingId, setEditingId] = React.useState<string>();
  const [draft, setDraft] = React.useState('');
  const [fault, setFault] = React.useState<string>();
  const [closedId, setClosedId] = React.useState<string>();
  const [submittedRequestId, setSubmittedRequestId] = React.useState<string>();

  const close = React.useCallback((id: string | undefined) => {
    setEditingId(undefined);
    setDraft('');
    setFault(undefined);
    setSubmittedRequestId(undefined);
    setClosedId(id);
  }, []);

  const clearDraftWhenBookmarkGone = React.useCallback(() => {
    if (editingId !== undefined && !bookmarks.some((bookmark) => bookmark.id === editingId)) {
      setEditingId(undefined);
      setDraft('');
      setFault(undefined);
      setSubmittedRequestId(undefined);
    }
  }, [bookmarks, editingId]);
  React.useEffect(clearDraftWhenBookmarkGone, [clearDraftWhenBookmarkGone]);

  const settleWhenHostAnswered = React.useCallback(() => {
    if (submittedRequestId === undefined || outcome?.requestId !== submittedRequestId) {
      return;
    }
    if (outcome.accepted) {
      close(editingId);
      return;
    }
    setSubmittedRequestId(undefined);
    setFault(outcome.error ?? 'The bookmark was not renamed.');
  }, [close, editingId, outcome, submittedRequestId]);
  React.useEffect(settleWhenHostAnswered, [settleWhenHostAnswered]);

  const beginRename = React.useCallback((bookmark: WorkshopBookmarkSummary) => {
    setEditingId(bookmark.id);
    setDraft(bookmark.label);
    setFault(undefined);
    setClosedId(undefined);
  }, []);

  const changeDraft = React.useCallback((value: string) => {
    setDraft(value);
    setFault(undefined);
  }, []);

  const saveRename = React.useCallback(() => {
    if (editingId === undefined || submittedRequestId !== undefined) {
      return;
    }
    const check = checkWorkshopBookmarkLabel(draft);
    if (check.kind === 'invalid') {
      setFault(WORKSHOP_BOOKMARK_LABEL_FAULTS[check.fault]);
      return;
    }
    setFault(undefined);
    setSubmittedRequestId(onRename(editingId, check.kind === 'named' ? check.label : null));
  }, [draft, editingId, onRename, submittedRequestId]);

  const cancelRename = React.useCallback(() => close(editingId), [close, editingId]);
  const acknowledgeClosed = React.useCallback(() => setClosedId(undefined), []);

  return {
    editingId,
    draft,
    fault,
    saving: submittedRequestId !== undefined,
    closedId,
    beginRename,
    changeDraft,
    saveRename,
    cancelRename,
    acknowledgeClosed,
    persistedState: {}
  };
}
