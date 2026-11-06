/**
 * The qualified bookmark ref's grammar (ADR 2026-11-05 D2, PR #214 F-07):
 * `{sessionId}/{bookmarkId}` for a saved session, and
 * `current@{liveSessionId}/{bookmarkId}` for the open room. The codec reads
 * refs with it, and the renderer emits only refs it reads back, so every
 * hint decodes as written.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  formatWorkshopRecallBookmarkRef,
  WorkshopRecallBookmarkRef
} from '@shared/types/workshopCapabilities';
import { parseWorkshopBookmarkId } from '@/application/services/workshop/session/WorkshopBookmarkLedger';

/** Session ids, as everywhere in recall: any id-like name, never a path. */
export const WORKSHOP_RECALL_SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

const CURRENT = 'current@';

/** The ref `text` names, or undefined when it is not one. */
export function parseWorkshopRecallBookmarkRef(text: string): WorkshopRecallBookmarkRef | undefined {
  const slash = text.lastIndexOf('/');
  if (slash < 0) {
    return undefined;
  }
  const bookmarkId = text.slice(slash + 1);
  if (!parseWorkshopBookmarkId(bookmarkId)) {
    return undefined;
  }
  const head = text.slice(0, slash);
  const current = head.startsWith(CURRENT);
  const sessionId = current ? head.slice(CURRENT.length) : head;
  if (sessionId.length > PROMPT_BUDGETS.workshopTranscriptRecall.sessionIdCharacters || !WORKSHOP_RECALL_SESSION_ID.test(sessionId)) {
    return undefined;
  }
  return current
    ? { source: 'current', liveSessionId: sessionId, bookmarkId }
    : { source: 'saved', sessionId, bookmarkId };
}

/** The ref as written, when it reads back as itself; undefined for one no call could name. */
export function writableWorkshopRecallBookmarkRef(ref: WorkshopRecallBookmarkRef): string | undefined {
  const written = formatWorkshopRecallBookmarkRef(ref);
  const read = parseWorkshopRecallBookmarkRef(written);
  return read && formatWorkshopRecallBookmarkRef(read) === written ? written : undefined;
}
