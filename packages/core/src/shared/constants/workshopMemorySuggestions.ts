/**
 * How readily Workshop personas suggest project notes (Everyday
 * Conveniences, Round Two, item B). A closed list: the manifest's enum, the
 * prompt files and the Memory tab are each held to it by a sync test.
 *
 * - `sparingly` (the default) is the prompt as it has always been.
 * - `readily` and `aggressively` change one paragraph of the proposals
 *   prompt: how often to suggest. What a good note is, the trailer and
 *   every bound stay as they are.
 *
 * The setting is global, like the project-memory mode it sits beside.
 */

export const WORKSHOP_MEMORY_SUGGESTION_LEVELS = ['sparingly', 'readily', 'aggressively'] as const;
export type WorkshopMemorySuggestionLevel = (typeof WORKSHOP_MEMORY_SUGGESTION_LEVELS)[number];

export const DEFAULT_WORKSHOP_MEMORY_SUGGESTION_LEVEL: WorkshopMemorySuggestionLevel = 'sparingly';

export const WORKSHOP_MEMORY_SUGGESTIONS_SETTING = Object.freeze({
  section: 'proseMinion',
  key: 'workshop.memory.suggestions'
});

export function isWorkshopMemorySuggestionLevel(raw: unknown): raw is WorkshopMemorySuggestionLevel {
  return WORKSHOP_MEMORY_SUGGESTION_LEVELS.some((level) => level === raw);
}

/** Unset, or anything but a known level, reads as the default: a bad value never makes a persona suggest more. */
export function coerceWorkshopMemorySuggestionLevel(raw: unknown): WorkshopMemorySuggestionLevel {
  return isWorkshopMemorySuggestionLevel(raw) ? raw : DEFAULT_WORKSHOP_MEMORY_SUGGESTION_LEVEL;
}
