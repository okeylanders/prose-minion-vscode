/**
 * Saved sessions for the Bookmarks screen's tests (ADR 2026-11-05 D8): one
 * scripted room, built through the real aggregate, with its first reply
 * bookmarked and named, saved under as many ids and titles as a test needs.
 * Made-up text only (Alice).
 */

import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopSessionStore } from '@/infrastructure/storage/WorkshopSessionStore';
import { ScriptedWorkshopRoom } from '@/__tests__/application/services/workshop/session/ScriptedWorkshopRoom';
import { scriptedCheckpoint } from '@/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness';

export const BOOKMARK_LABEL = 'Alice at the door';

let room: { scripted: ScriptedWorkshopRoom; replyId: string; questionId: string } | undefined;

/** The scripted room, built once: a question, a reply, the reply bookmarked and named. */
export function bookmarkedRoom(): { scripted: ScriptedWorkshopRoom; replyId: string; questionId: string } {
  if (!room) {
    const scripted = new ScriptedWorkshopRoom().start();
    const reply = scripted.hostMessage('Where does Alice go next?', { reply: 'HOST-REPLY: Alice opens the little door.' });
    scripted.session.setTurnBookmark(reply.id, true);
    scripted.session.renameBookmark(scripted.session.getSnapshot().bookmarks[0].id, BOOKMARK_LABEL);
    const question = scripted.session.readRoomLedger().find((turn) => turn.role === 'user')!;
    room = { scripted, replyId: reply.id, questionId: question.id };
  }
  return room;
}

export function bookmarkedCheckpoint(sessionId: string, title = sessionId): WorkshopPersistedSessionV2 {
  return { ...scriptedCheckpoint(sessionId, bookmarkedRoom().scripted), title };
}

/** Save `count` bookmarked sessions, `alice-1` … `alice-{count}`. */
export async function saveBookmarkedSessions(store: WorkshopSessionStore, count: number, prefix = 'alice'): Promise<string[]> {
  const ids: string[] = [];
  for (let index = 1; index <= count; index += 1) {
    const sessionId = `${prefix}-${index}`;
    await store.saveNamed(bookmarkedCheckpoint(sessionId, `Alice ${prefix} ${index}`));
    ids.push(sessionId);
  }
  return ids;
}
