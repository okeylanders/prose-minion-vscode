/**
 * The Bookmarks screen as WorkshopApp mounts it (ADR 2026-11-05 D8): the
 * transport hook's state handed to the presentational
 * `WorkshopBookmarkBrowserModal`, and each row's action routed to what
 * already does it.
 *
 * - **Preview** opens the turn-preview sheet over the screen: a saved turn
 *   by its own route, a turn of this conversation from the message its row
 *   already holds (so a turn outside the window previews too). Closing the
 *   sheet returns focus to the row that opened it.
 * - **Open session** closes the screen and goes through the existing Open,
 *   its confirmation included.
 * - **Open at bookmark** does the same, then jumps once the opened room is on
 *   screen (`useWorkshopBookmarkOpenAt`, held by WorkshopApp so a declined
 *   confirmation can drop it).
 * - **Show in thread** (this conversation) closes the screen and jumps
 *   through the thread's one jump path; a turn outside the window opens in
 *   the preview instead, over the screen.
 *
 * - **Remember this** (Bookmark Recall D9) closes the screen and opens the
 *   memory sheet from the row's message: a turn of this conversation names
 *   the room on screen, a saved one its session.
 *
 * WorkshopApp renders this before the text sheet, so the sheet stacks above.
 */

import * as React from 'react';
import type { WorkshopTurnPreview } from '@messages';
import { WorkshopBookmarkBrowserModal } from './WorkshopBookmarkBrowserModal';
import type { UseWorkshopBookmarkBrowserReturn } from '@hooks/domain/workshop/useWorkshopBookmarkBrowser';
import type { WorkshopBookmarkBrowserItem } from '@hooks/domain/workshop/bookmarks/workshopBookmarkBrowserView';
import type { WorkshopBookmarkOpenTarget } from '@hooks/domain/workshop/controllers/useWorkshopBookmarkOpenAt';
import type { WorkshopMemoryRoomBookmark, WorkshopMemorySavedBookmark } from '@hooks/domain/workshop/useWorkshopProjectMemory';
import { useWorkshopTurnJump } from '@hooks/domain/workshop/controllers/useWorkshopTurnJump';

interface WorkshopBookmarkBrowserMountProps {
  browser: UseWorkshopBookmarkBrowserReturn;
  /** Room-changing actions are off. */
  openDisabled: boolean;
  openStoredSession: (session: { sessionId: string; title: string }) => void;
  openAtBookmark: (target: WorkshopBookmarkOpenTarget) => void;
  openSavedTurnPreviewSheet: (sessionId: string, turnId: string, label: string, sessionTitle: string) => void;
  openGivenTurnPreviewSheet: (turnId: string, turn: WorkshopTurnPreview, label: string) => void;
  rememberRoomBookmark: (bookmark: WorkshopMemoryRoomBookmark) => void;
  rememberSavedBookmark: (bookmark: WorkshopMemorySavedBookmark) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopBookmarkBrowserMount: React.FC<WorkshopBookmarkBrowserMountProps> = ({
  browser,
  openDisabled,
  openStoredSession,
  openAtBookmark,
  openSavedTurnPreviewSheet,
  openGivenTurnPreviewSheet,
  rememberRoomBookmark,
  rememberSavedBookmark
}) => {
  const liveRows = browser.live.rows;
  const previewLive = React.useCallback((turnId: string) => {
    const row = liveRows.find((candidate) => candidate.turnId === turnId);
    if (row?.message) {
      openGivenTurnPreviewSheet(row.turnId, row.message, row.label);
    }
  }, [liveRows, openGivenTurnPreviewSheet]);
  const { jumpAfterClosing } = useWorkshopTurnJump({
    closeOverlay: browser.closeBrowser,
    onOutsideWindow: previewLive
  });

  const onPreview = (item: WorkshopBookmarkBrowserItem) => {
    if (item.source.kind === 'saved') {
      openSavedTurnPreviewSheet(item.source.sessionId, item.row.turnId, item.row.label, item.source.sessionTitle);
    } else {
      previewLive(item.row.turnId);
    }
  };
  const onOpenSession = (item: WorkshopBookmarkBrowserItem) => {
    if (item.source.kind !== 'saved') {
      return;
    }
    browser.closeBrowser();
    openStoredSession({ sessionId: item.source.sessionId, title: item.source.sessionTitle });
  };
  const onOpenAtBookmark = (item: WorkshopBookmarkBrowserItem) => {
    if (item.source.kind !== 'saved') {
      return;
    }
    browser.closeBrowser();
    openAtBookmark({
      sessionId: item.source.sessionId,
      title: item.source.sessionTitle,
      turnId: item.row.turnId,
      label: item.row.label
    });
  };

  const onRemember = (item: WorkshopBookmarkBrowserItem) => {
    const { row } = item;
    if (!row.message || !row.rememberable || item.ambiguous) {
      return;
    }
    if (item.source.kind === 'saved') {
      browser.closeBrowser();
      rememberSavedBookmark({ sessionId: item.source.sessionId, sessionTitle: item.source.sessionTitle, turnId: row.turnId, message: row.message });
    } else if (browser.roomRevision !== undefined) {
      browser.closeBrowser();
      rememberRoomBookmark({ turnId: row.turnId, roomRevision: browser.roomRevision, message: row.message });
    }
  };

  return (
    <WorkshopBookmarkBrowserModal
      open={browser.browserOpen}
      live={browser.live}
      saved={browser.saved}
      query={browser.query}
      openDisabled={openDisabled}
      onQueryChange={browser.setQuery}
      onLoadMore={browser.loadMore}
      onClose={browser.closeBrowser}
      onPreview={onPreview}
      onOpenSession={onOpenSession}
      onOpenAtBookmark={onOpenAtBookmark}
      onShowInThread={(item) => jumpAfterClosing(item.row.turnId)}
      onRemember={onRemember}
    />
  );
};
