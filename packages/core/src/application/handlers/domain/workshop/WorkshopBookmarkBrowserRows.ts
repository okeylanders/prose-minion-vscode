/**
 * Recall's bookmarks as the Bookmarks screen receives them (ADR 2026-11-05
 * D8): field by field, the message through the turn preview's own copy
 * (`workshopTurnPreviewOfEntry`), so a row carries exactly what the room's
 * preview may, and nothing host-private. Pure.
 */

import type {
  WorkshopBookmarkBrowserRow,
  WorkshopBookmarkBrowserSession,
  WorkshopBookmarkPage
} from '@messages';
import { isWorkshopPersonaId } from '@shared/constants/workshopPersonas';
import type { WorkshopRecallBookmark } from '@/application/services/workshop/recall/WorkshopRecallBookmarks';
import type { WorkshopRecallBookmarkPage } from '@/application/services/workshop/recall/WorkshopRecallBookmarkPage';
import { workshopTurnPreviewOfEntry } from '@/application/services/workshop/transcript/WorkshopTurnPreview';

/** What the thread calls the writer (the turn preview's word). */
const WRITER_SPEAKER = 'You';

export function workshopBookmarkBrowserRow(bookmark: WorkshopRecallBookmark): WorkshopBookmarkBrowserRow {
  const { id } = bookmark.speaker;
  const identity = id === undefined || id === 'writer'
    ? undefined
    : isWorkshopPersonaId(id) ? id : `tool:${id}`;
  return {
    bookmarkId: bookmark.id,
    turnId: bookmark.turnId,
    label: bookmark.displayLabel,
    createdAt: bookmark.createdAt,
    speaker: id === 'writer' ? WRITER_SPEAKER : bookmark.speaker.label,
    ...(identity ? { identity } : {}),
    ...(bookmark.entry ? { message: workshopTurnPreviewOfEntry(bookmark.entry) } : {})
  };
}

export function workshopBookmarkBrowserPage(page: WorkshopRecallBookmarkPage): WorkshopBookmarkPage {
  return {
    sessions: page.sessions.map((session): WorkshopBookmarkBrowserSession => ({
      sessionId: session.sessionId,
      title: session.title,
      savedAt: session.savedAt,
      bookmarks: session.bookmarks.map(workshopBookmarkBrowserRow)
    })),
    read: page.read,
    unreadable: page.unreadable,
    unreadableSessions: page.unreadableSessions.map(({ sessionId, title }) => ({ sessionId, title })),
    remaining: page.remaining,
    ...(page.next !== undefined ? { next: page.next } : {})
  };
}
