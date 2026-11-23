/**
 * `trailerOutcomes` on a persisted turn (ADR 2026-11-17 D13): what became
 * of a persona reply's memory-note and file-edit trailers, as counts and
 * closed reasons. An optional, additive turn field: a session without it
 * reads and writes exactly as before, with no `schemaVersion` bump and no
 * normalization (ADR 2026-07-30). Forward only: an older build's strict
 * reader rejects a session that holds the key. Called from the session
 * shape file.
 *
 * When present it is exact:
 * - on a persona reply only (`role: 'assistant'`, a host or guest turn);
 * - at least one side, and each side counts at least one frame (a side is
 *   present only when the reply carried that kind of trailer);
 * - each side's reasons are checked against that side's own list (a
 *   `pinned-budget` under `fileEdits` is refused);
 * - `dropped` is canonical: at most one entry per reason, in the reason
 *   list's order, each `count` at least 1;
 * - every count is a whole number within `WORKSHOP_TRAILER_OUTCOME_LIMITS`.
 *
 * It rides the reply, so a cut that removes the reply removes the record.
 */

import {
  WORKSHOP_FILE_EDIT_TRAILER_DROP_REASONS,
  WORKSHOP_LOCATIONS_TRAILER_DROP_REASONS,
  WORKSHOP_MEMORY_TRAILER_DROP_REASONS,
  WORKSHOP_PASSAGE_SEARCH_TRAILER_DROP_REASONS,
  WORKSHOP_TODO_TRAILER_DROP_REASONS,
  type WorkshopTrailerOutcomes
} from '@shared/types/workshopTrailerOutcomes';
import { arrayOf, exactObject, shapeError } from '@/application/services/workshop/persistedValidation';

/**
 * The most one count holds: the longest an array can be. Every count is a
 * tally over an array of frames, so no reply can count past it, and the
 * builder never clips: a count is the number of frames, exactly (D13; PR
 * #276 F-02). The codec's own bound, pinned so a saved session stays valid
 * however the per-reply caps are later tuned (ADR 2026-07-30).
 */
export const WORKSHOP_TRAILER_OUTCOME_LIMITS = Object.freeze({ count: 2 ** 32 - 1 });

/** Strict structure of a turn's `trailerOutcomes`; refused on any turn but a host or guest reply. */
export function assertWorkshopTrailerOutcomesShape(
  value: unknown,
  path: string,
  turn: { readonly role?: unknown; readonly participant?: unknown }
): void {
  if (turn.role !== 'assistant' || (turn.participant !== 'host' && turn.participant !== 'guest')) {
    shapeError(path, 'a record on a persona reply');
  }
  const outcomes = exactObject(value, path, [], ['memory', 'fileEdits', 'todos', 'locations', 'passageSearch']);
  if (outcomes.memory === undefined && outcomes.fileEdits === undefined && outcomes.todos === undefined
    && outcomes.locations === undefined && outcomes.passageSearch === undefined) {
    shapeError(path, 'at least one of memory, fileEdits, todos, locations and passageSearch');
  }
  if (outcomes.memory !== undefined) {
    const side = exactObject(outcomes.memory, `${path}.memory`, ['cards', 'dropped']);
    const frames = countAt(side.cards, `${path}.memory.cards`, 0)
      + droppedAt(side.dropped, `${path}.memory.dropped`, WORKSHOP_MEMORY_TRAILER_DROP_REASONS);
    if (frames === 0) {
      shapeError(`${path}.memory`, 'at least one frame counted');
    }
  }
  if (outcomes.fileEdits !== undefined) {
    const side = exactObject(outcomes.fileEdits, `${path}.fileEdits`, ['cards', 'refused', 'dropped']);
    const frames = countAt(side.cards, `${path}.fileEdits.cards`, 0)
      + countAt(side.refused, `${path}.fileEdits.refused`, 0)
      + droppedAt(side.dropped, `${path}.fileEdits.dropped`, WORKSHOP_FILE_EDIT_TRAILER_DROP_REASONS);
    if (frames === 0) {
      shapeError(`${path}.fileEdits`, 'at least one frame counted');
    }
  }
  // To-do status frames (ADR 2026-11-19 D7; additive).
  if (outcomes.todos !== undefined) {
    const side = exactObject(outcomes.todos, `${path}.todos`, ['changes', 'dropped']);
    const frames = countAt(side.changes, `${path}.todos.changes`, 0)
      + droppedAt(side.dropped, `${path}.todos.dropped`, WORKSHOP_TODO_TRAILER_DROP_REASONS);
    if (frames === 0) {
      shapeError(`${path}.todos`, 'at least one frame counted');
    }
  }
  if (outcomes.locations !== undefined) {
    assertLocationsSide(outcomes.locations, `${path}.locations`);
  }
  if (outcomes.passageSearch !== undefined) {
    // Passage-search request frames (ADR 2026-11-20 D17; additive): at most one card.
    const side = exactObject(outcomes.passageSearch, `${path}.passageSearch`, ['cards', 'dropped']);
    const cards = countAt(side.cards, `${path}.passageSearch.cards`, 0);
    if (cards > 1) {
      shapeError(`${path}.passageSearch.cards`, 'at most one card');
    }
    if (cards + droppedAt(side.dropped, `${path}.passageSearch.dropped`, WORKSHOP_PASSAGE_SEARCH_TRAILER_DROP_REASONS) === 0) {
      shapeError(`${path}.passageSearch`, 'at least one frame counted');
    }
  }
}

/** Context-paths proposal frames (ADR 2026-11-19 D27; additive): at most one card. */
function assertLocationsSide(value: unknown, path: string): void {
  const side = exactObject(value, path, ['cards', 'dropped', 'patterns']);
  const cards = countAt(side.cards, `${path}.cards`, 0);
  if (cards > 1) {
    shapeError(`${path}.cards`, 'at most one card');
  }
  const frames = cards + droppedAt(side.dropped, `${path}.dropped`, WORKSHOP_LOCATIONS_TRAILER_DROP_REASONS);
  if (frames === 0) {
    shapeError(path, 'at least one frame counted');
  }
  const patterns = exactObject(side.patterns, `${path}.patterns`, ['kept', 'unmatched', 'incomplete', 'refused']);
  for (const key of ['kept', 'unmatched', 'incomplete', 'refused'] as const) {
    countAt(patterns[key], `${path}.patterns.${key}`, 0);
  }
}

/** A whole number from `minimum` to the codec's bound. */
function countAt(value: unknown, path: string, minimum: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > WORKSHOP_TRAILER_OUTCOME_LIMITS.count) {
    shapeError(path, `a whole number from ${minimum} to ${WORKSHOP_TRAILER_OUTCOME_LIMITS.count}`);
  }
  return value;
}

/** A side's drops: its own reasons only, each once, in the list's order. Returns how many frames they count. */
function droppedAt(value: unknown, path: string, reasons: readonly string[]): number {
  let frames = 0;
  let last = -1;
  arrayOf(value, path, (item, itemPath) => {
    const drop = exactObject(item, itemPath, ['reason', 'count']);
    const position = typeof drop.reason === 'string' ? reasons.indexOf(drop.reason) : -1;
    if (position < 0) {
      shapeError(`${itemPath}.reason`, `one of: ${reasons.join(', ')}`);
    }
    if (position <= last) {
      shapeError(`${itemPath}.reason`, 'each reason once, in the reason list\'s order');
    }
    last = position;
    frames += countAt(drop.count, `${itemPath}.count`, 1);
  });
  return frames;
}

/** A defensive copy of one record. */
export function cloneWorkshopTrailerOutcomes(outcomes: WorkshopTrailerOutcomes): WorkshopTrailerOutcomes {
  return {
    ...(outcomes.memory
      ? { memory: { cards: outcomes.memory.cards, dropped: outcomes.memory.dropped.map((drop) => ({ ...drop })) } }
      : {}),
    ...(outcomes.fileEdits
      ? {
        fileEdits: {
          cards: outcomes.fileEdits.cards,
          refused: outcomes.fileEdits.refused,
          dropped: outcomes.fileEdits.dropped.map((drop) => ({ ...drop }))
        }
      }
      : {}),
    ...(outcomes.todos
      ? { todos: { changes: outcomes.todos.changes, dropped: outcomes.todos.dropped.map((drop) => ({ ...drop })) } }
      : {}),
    ...(outcomes.locations
      ? {
        locations: {
          cards: outcomes.locations.cards,
          dropped: outcomes.locations.dropped.map((drop) => ({ ...drop })),
          patterns: { ...outcomes.locations.patterns }
        }
      }
      : {}),
    ...(outcomes.passageSearch
      ? { passageSearch: { cards: outcomes.passageSearch.cards, dropped: outcomes.passageSearch.dropped.map((drop) => ({ ...drop })) } }
      : {})
  };
}
