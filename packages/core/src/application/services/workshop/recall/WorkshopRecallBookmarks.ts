/**
 * The writer's bookmarks as session recall sees them (ADR 2026-11-05 D1,
 * D2, D5): one shape for a saved session's and the open room's, built from
 * a ledger and its stored bookmarks by the same rule.
 *
 * - Field by field, as recall copies a to-do: the stored id, turn id, label
 *   and time, never anything else the session holds.
 * - The label is the writer's, or the default the thread shows
 *   (`workshopBookmarkDefaultLabel`), computed at read and never stored.
 * - The message is the turn as `projectWorkshopTranscriptTurn` shows it, the
 *   rule reads and export use: a capability card is its request summary,
 *   never its evidence.
 * - A bookmark whose turn is gone is left out; named reads drop those at
 *   decode already.
 *
 * Pure: the caller supplies the turns and bookmarks.
 */

import type { WorkshopTurn, WorkshopTurnBookmark } from '@messages';
import { isWorkshopPersonaId, workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { workshopToolLabel } from '@shared/constants/workshopTools';
import type { WorkshopRecallBookmarkSpeakerId } from '@shared/types/workshopCapabilities';
import { workshopBookmarkDefaultLabel } from '@/application/services/workshop/session/WorkshopBookmarkLedger';
import {
  projectWorkshopTranscriptTurn,
  WORKSHOP_TRANSCRIPT_WRITER_LABEL,
  WorkshopTranscriptEntry
} from '@/application/services/workshop/transcript/WorkshopTranscript';

/** Who said a bookmarked turn: an id `<speaker>` can name, when it has one, and the label rows show. */
export interface WorkshopRecallBookmarkSpeaker {
  readonly id?: WorkshopRecallBookmarkSpeakerId;
  readonly label: string;
}

export interface WorkshopRecallBookmark {
  readonly id: string;
  readonly turnId: string;
  /** The writer's own name for it; absent until the writer names it. */
  readonly label?: string;
  /** Epoch ms when the writer set it. */
  readonly createdAt: number;
  /** The turn's 1-based ledger position: where it stands now. */
  readonly position: number;
  /** `label`, else the default the thread shows. */
  readonly displayLabel: string;
  readonly speaker: WorkshopRecallBookmarkSpeaker;
  /** The turn as the thread shows it; absent when the thread shows nothing of it. */
  readonly entry?: WorkshopTranscriptEntry;
}

/**
 * The bookmarks whose turns `turns` holds, in thread order. `turns` is the
 * whole ledger in order, so positions are ledger positions.
 */
export function workshopRecallBookmarks(
  turns: readonly WorkshopTurn[],
  bookmarks: readonly WorkshopTurnBookmark[]
): WorkshopRecallBookmark[] {
  if (bookmarks.length === 0) {
    return [];
  }
  const byTurn = new Map(bookmarks.map((bookmark) => [bookmark.turnId, bookmark]));
  return turns.flatMap((turn, index) => {
    const bookmark = byTurn.get(turn.id);
    return bookmark ? [workshopRecallBookmark(bookmark, turn, index + 1)] : [];
  });
}

/** One bookmark on `turn`, which stands at `position`. */
export function workshopRecallBookmark(
  bookmark: WorkshopTurnBookmark,
  turn: WorkshopTurn,
  position: number
): WorkshopRecallBookmark {
  const entry = projectWorkshopTranscriptTurn(turn);
  return {
    id: bookmark.id,
    turnId: bookmark.turnId,
    ...(bookmark.label !== undefined ? { label: bookmark.label } : {}),
    createdAt: bookmark.createdAt,
    position,
    displayLabel: bookmark.label ?? workshopBookmarkDefaultLabel(turn),
    speaker: workshopRecallBookmarkSpeaker(turn),
    ...(entry ? { entry } : {})
  };
}

/**
 * Who said a turn: the writer, a tool by its id, or a persona by its id (a
 * capability card's, the persona that asked for it). A turn with none of
 * them keeps its label and matches no `<speaker>`.
 */
export function workshopRecallBookmarkSpeaker(turn: WorkshopTurn): WorkshopRecallBookmarkSpeaker {
  if (turn.role === 'user') {
    return { id: 'writer', label: WORKSHOP_TRANSCRIPT_WRITER_LABEL };
  }
  if (turn.participant === 'tool' && turn.toolId !== undefined) {
    return { id: turn.toolId, label: turn.toolLabel ?? workshopToolLabel(turn.toolId) };
  }
  const personaId = turn.personaId ?? turn.capability?.requestedByPersonaId;
  if (personaId !== undefined && isWorkshopPersonaId(personaId)) {
    return { id: personaId, label: turn.personaLabel ?? workshopPersonaLabel(personaId) };
  }
  return { label: turn.personaLabel ?? turn.toolLabel ?? 'Follow-up' };
}
