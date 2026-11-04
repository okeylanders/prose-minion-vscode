/**
 * Bookmarks in the persisted session (ADR 2026-11-03 D5, D9).
 *
 * `bookmarks` is an optional, additive key: a session without it reads and
 * writes exactly as before. When present, each entry is exact:
 * `{ id, turnId, label?, createdAt }`, with an id the ledger mints, a label
 * stored as the label rule leaves it, ids and turns each used once, and a
 * turn that may carry a bookmark.
 *
 * A bookmark whose turn is gone is a development checkpoint's drift, not a
 * fault: checkpoint normalization drops it with a named, logged
 * normalization (ADR 2026-07-30), and strict validation refuses it after.
 */

import type { WorkshopTurn, WorkshopTurnBookmark } from '@messages';
import { isStoredWorkshopBookmarkLabel } from '@shared/constants/workshopBookmarks';
import {
  arrayOf,
  exactObject,
  shapeError
} from '@/application/services/workshop/persistedValidation';
import {
  isWorkshopBookmarkableTurn,
  parseWorkshopBookmarkId
} from '@/application/services/workshop/session/WorkshopBookmarkLedger';

const PATH = 'Workshop session state.bookmarks';

/** Strict structure of `bookmarks`: entries, keys, types, and uniqueness. */
export function assertWorkshopBookmarksShape(value: unknown): void {
  const ids = new Set<string>();
  const turnIds = new Set<string>();
  arrayOf(value, PATH, (item, path) => {
    const bookmark = exactObject(item, path, ['id', 'turnId', 'createdAt'], ['label']);
    if (typeof bookmark.id !== 'string' || !parseWorkshopBookmarkId(bookmark.id)) {
      shapeError(`${path}.id`, 'a bookmark id (bookmark-<n>-<ms>, each a canonical safe integer of at least 1)');
    }
    if (typeof bookmark.turnId !== 'string' || bookmark.turnId.length === 0) {
      shapeError(`${path}.turnId`, 'non-empty string');
    }
    if (bookmark.label !== undefined && (
      typeof bookmark.label !== 'string' || !isStoredWorkshopBookmarkLabel(bookmark.label)
    )) {
      shapeError(`${path}.label`, 'a trimmed, one-line, non-empty label of at most 80 characters');
    }
    if (!Number.isSafeInteger(bookmark.createdAt) || (bookmark.createdAt as number) < 0) {
      shapeError(`${path}.createdAt`, 'non-negative safe integer');
    }
    if (ids.has(bookmark.id)) {
      shapeError(`${path}.id`, 'an id not already used by another bookmark');
    }
    if (turnIds.has(bookmark.turnId)) {
      shapeError(`${path}.turnId`, 'a turn no other bookmark marks');
    }
    ids.add(bookmark.id);
    turnIds.add(bookmark.turnId);
  });
}

/** Bookmarks whose turn is not in the ledger. */
export function danglingWorkshopBookmarks(
  bookmarks: readonly WorkshopTurnBookmark[] | undefined,
  turns: readonly Pick<WorkshopTurn, 'id'>[]
): WorkshopTurnBookmark[] {
  if (!bookmarks || bookmarks.length === 0) {
    return [];
  }
  const turnIds = new Set(turns.map((turn) => turn.id));
  return bookmarks.filter((bookmark) => !turnIds.has(bookmark.turnId));
}

/**
 * The bookmarks that survive in a room of `turns`, or undefined when none do,
 * so a room without them writes no key. Used by the checkpoint normalization
 * and by the rewind transform, the one code that cuts a room.
 */
export function workshopBookmarksWithin(
  bookmarks: readonly WorkshopTurnBookmark[] | undefined,
  turnIds: ReadonlySet<string>
): WorkshopTurnBookmark[] | undefined {
  const kept = (bookmarks ?? []).filter((bookmark) => turnIds.has(bookmark.turnId));
  return kept.length > 0 ? kept : undefined;
}

/**
 * Referential integrity: every bookmark names a turn in the ledger, and a turn
 * that may carry one. Raw checkpoint preflight skips the first rule, because
 * normalization drops a dangling bookmark; it never skips the second.
 */
export function assertWorkshopBookmarkIntegrity(
  bookmarks: readonly WorkshopTurnBookmark[] | undefined,
  turns: readonly WorkshopTurn[],
  options: { allowDanglingTurns?: boolean } = {}
): void {
  if (!bookmarks || bookmarks.length === 0) {
    return;
  }
  const byId = new Map(turns.map((turn) => [turn.id, turn]));
  for (const bookmark of bookmarks) {
    const turn = byId.get(bookmark.turnId);
    if (!turn) {
      if (options.allowDanglingTurns === true) {
        continue;
      }
      throw new Error(`Persisted Workshop bookmark ${bookmark.id} references an unknown turn`);
    }
    if (!isWorkshopBookmarkableTurn(turn)) {
      throw new Error(`Persisted Workshop bookmark ${bookmark.id} marks a turn that cannot be bookmarked`);
    }
  }
}
