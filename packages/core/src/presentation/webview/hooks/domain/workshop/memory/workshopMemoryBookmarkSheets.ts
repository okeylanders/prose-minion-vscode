/**
 * The memory sheet opened from a bookmark (Bookmark Recall Slice 3, ADR
 * 2026-11-05 D9), as pure sheet states for `useWorkshopProjectMemory`:
 *
 * - **A turn of this room outside the window** opens in `turn` mode with
 *   the room it was asked in (`roomRevision`), prefilled from the host's
 *   message: the browser's live row, or a turn preview the hook asks for
 *   (`loading` until it lands).
 * - **A saved session's turn** opens in `saved-turn` mode, naming its
 *   session and title, prefilled from the message the host sent for its row.
 *
 * Every prefill is the host's projected message, capped as a bubble's is
 * (`workshopMemoryNoteFromTurn`), never a webview copy.
 */

import type { WorkshopMemoryDraft, WorkshopTurn, WorkshopTurnPreview, WorkshopTurnPreviewPayload } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopMemorySheetState } from '@hooks/domain/workshop/useWorkshopProjectMemory';

/** A bookmark of this room: its turn when the snapshot holds it, else its room and, when known, the host's message. */
export interface WorkshopMemoryRoomBookmark {
  readonly turnId: string;
  readonly roomRevision: number;
  readonly turn?: WorkshopTurn;
  readonly message?: WorkshopTurnPreview;
}

/** A saved session's bookmark, with the message the host sent for its row. */
export interface WorkshopMemorySavedBookmark {
  readonly sessionId: string;
  readonly sessionTitle: string;
  readonly turnId: string;
  readonly message: WorkshopTurnPreview;
}

export const WORKSHOP_MEMORY_EMPTY_DRAFT: WorkshopMemoryDraft = {
  title: '', kind: 'decision', summary: '', body: '', supersedes: [], pinned: false
};

/** A bubble's text as a new memory's note: whole when it fits, else cut at the bound, for the writer to shape. */
export function workshopMemoryNoteFromTurn(content: string): string {
  const text = content.trim();
  const bound = PROMPT_BUDGETS.workshopProjectMemory.bodyCharacters;
  return text.length <= bound ? text : text.slice(0, bound).trimEnd();
}

/** Who a host message is from, as the source line names it. */
function sourceOf(message: WorkshopTurnPreview): string {
  return message.kind === 'writer' ? 'your message' : message.speaker;
}

function prefilled(message: WorkshopTurnPreview): WorkshopMemoryDraft {
  return { ...WORKSHOP_MEMORY_EMPTY_DRAFT, supersedes: [], body: workshopMemoryNoteFromTurn(message.content) };
}

/** A room bookmark whose turn the snapshot doesn't hold. */
export function workshopMemoryRoomBookmarkSheet(bookmark: Omit<WorkshopMemoryRoomBookmark, 'turn'>): WorkshopMemorySheetState {
  const { turnId, roomRevision, message } = bookmark;
  return {
    mode: 'turn',
    turnId,
    roomRevision,
    draft: message ? prefilled(message) : { ...WORKSHOP_MEMORY_EMPTY_DRAFT, supersedes: [] },
    replaces: [],
    loading: message === undefined,
    saving: false,
    ...(message ? { sourceLabel: sourceOf(message) } : {})
  };
}

export function workshopMemorySavedBookmarkSheet(bookmark: WorkshopMemorySavedBookmark): WorkshopMemorySheetState {
  return {
    mode: 'saved-turn',
    turnId: bookmark.turnId,
    sessionId: bookmark.sessionId,
    sessionTitle: bookmark.sessionTitle,
    draft: prefilled(bookmark.message),
    replaces: [],
    loading: false,
    saving: false,
    sourceLabel: sourceOf(bookmark.message)
  };
}

/**
 * The sheet once the turn preview it waits for lands: the note filled, or
 * the host's refusal. Undefined when the answer is for another sheet (its
 * turn or room), so it changes nothing.
 */
export function workshopMemorySheetWithPreview(
  current: WorkshopMemorySheetState | null,
  answer: WorkshopTurnPreviewPayload
): WorkshopMemorySheetState | undefined {
  if (!current || current.mode !== 'turn' || !current.loading
    || current.turnId !== answer.turnId || current.roomRevision !== answer.roomRevision) {
    return undefined;
  }
  return answer.turn
    ? { ...current, draft: prefilled(answer.turn), loading: false, sourceLabel: sourceOf(answer.turn) }
    : { ...current, loading: false, error: answer.error ?? 'That message could not be shown.' };
}
