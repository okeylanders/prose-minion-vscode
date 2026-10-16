/**
 * Dictionary history navigation rules (ADR 2026-10-14, D6, D8, and D9).
 *
 * Pure functions, so the `‹` `›` stepping, the draft rule, the position
 * label, and the prior-lookup check can be tested without React. `useDictionaryHistory` owns the state and
 * transport; this module only decides.
 */

import type { DictionaryHistoryEntry, DictionaryHistorySummary, DictionaryLookupRequest } from '@messages';
import type { DictionaryView } from '@hooks/domain/useDictionary';

/** Words a Dictionary lookup accepts; the tab trims longer phrases to this. */
export const DICTIONARY_PHRASE_WORDS = 6;

/** The normalization the tab applies on submit: collapse whitespace, trim, keep six words. */
export function normalizeDictionaryPhrase(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }
  return normalized.split(' ').slice(0, DICTIONARY_PHRASE_WORDS).join(' ');
}

/**
 * The identity "looked up before" compares: the submit normalization, then
 * case-folded, so `Luminous` and `luminous ` name the same lookup.
 */
export function dictionaryPhraseKey(value: string): string {
  return normalizeDictionaryPhrase(value).toLocaleLowerCase();
}

/**
 * Recorded lookups of `word`, newest first, that a new lookup could reuse
 * instead (D9). Empty when there are none, or when the result pane already
 * shows one of them: a writer rerunning the entry in front of them wants a
 * fresh run, not an offer of what they are already reading.
 */
export function findPriorDictionaryLookups(
  entries: readonly DictionaryHistorySummary[],
  word: string,
  cursorId: string | null
): DictionaryHistorySummary[] {
  const key = dictionaryPhraseKey(word);
  if (!key) {
    return [];
  }
  const matches = entries.filter(entry => dictionaryPhraseKey(entry.word) === key);
  return matches.some(entry => entry.id === cursorId) ? [] : matches;
}

export type DictionaryHistoryDirection = 'older' | 'newer';

export type DictionaryHistoryStep =
  | { kind: 'entry'; id: string }
  | { kind: 'draft' }
  | null;

export interface DictionaryHistoryStepInput {
  /** Entry ids, newest first. */
  ids: readonly string[];
  /** `pendingEntryId ?? cursorId`; `null` is live. An id not in `ids` also counts as live. */
  position: string | null;
  direction: DictionaryHistoryDirection;
  hasDraft: boolean;
}

/**
 * Where `‹` (older) or `›` (newer) leads from `position`, like browser back and
 * forward over a log that navigation never truncates. `›` from the newest entry
 * returns to the stashed draft; nothing is newer than live.
 */
export function stepDictionaryHistory({
  ids,
  position,
  direction,
  hasDraft
}: DictionaryHistoryStepInput): DictionaryHistoryStep {
  const index = position === null ? -1 : ids.indexOf(position);

  if (direction === 'older') {
    const olderId = ids[index + 1];
    return olderId === undefined ? null : { kind: 'entry', id: olderId };
  }

  if (index < 0) {
    return null;
  }
  if (index === 0) {
    return hasDraft ? { kind: 'draft' } : null;
  }
  return { kind: 'entry', id: ids[index - 1] };
}

/** The form fields the draft rule compares with the request behind the result. */
export interface DictionaryForm {
  word: string;
  context: string;
  includeEncyclopedia: boolean;
  includePalettes: boolean;
}

/**
 * True when the form holds input the displayed result does not answer, so
 * navigating away must stash it. Words compare after submit normalization and
 * context after trimming, so whitespace alone never counts as an edit.
 */
export function isDictionaryFormDirty(
  form: DictionaryForm,
  subject: DictionaryLookupRequest | null
): boolean {
  const word = normalizeDictionaryPhrase(form.word);
  const context = form.context.trim();

  if (subject === null) {
    return word.length > 0 || context.length > 0;
  }

  return word !== normalizeDictionaryPhrase(subject.word)
    || context !== subject.context.trim()
    || form.includeEncyclopedia !== subject.includeEncyclopedia
    || form.includePalettes !== subject.includePalettes;
}

/** The tab view a recorded entry restores: its request becomes the lookup subject. */
export function dictionaryViewFromEntry(entry: DictionaryHistoryEntry): DictionaryView {
  const { request } = entry;
  return {
    word: request.word,
    context: request.context,
    includeEncyclopedia: request.includeEncyclopedia,
    includePalettes: request.includePalettes,
    sourceUri: request.sourceUri ?? '',
    relativePath: request.relativePath ?? '',
    result: entry.result,
    toolName: entry.toolName,
    lookupSubject: { ...request }
  };
}

export interface DictionaryHistoryPosition {
  /** 1-based from the newest entry; `null` when live or the id is unknown. */
  index: number | null;
  total: number;
}

/** The `3 / 12` label: the newest entry is 1. */
export function describeDictionaryHistoryPosition(
  ids: readonly string[],
  cursorId: string | null
): DictionaryHistoryPosition {
  const index = cursorId === null ? -1 : ids.indexOf(cursorId);
  return { index: index < 0 ? null : index + 1, total: ids.length };
}
