/**
 * Searching the Dictionary's lookup history in the popup (ADR 2026-10-14, the
 * 2026-11-14 search amendment).
 *
 * Pure. The popup holds every summary already, so word, context and file
 * name are filtered here, as the writer types, with no host call. The rule:
 *
 * - **Case and accents are ignored**, by the fold the host's definitions
 *   search uses (`foldedTextSearch`), so the two sides agree.
 * - **A word matches through `dictionaryPhraseKey`**, the prior-lookup
 *   offer's rule (`findPriorDictionaryLookups`): the query's key, folded,
 *   stands somewhere in the word's key, folded. Two phrases the offer calls
 *   the same lookup therefore always find each other here, and a part of a
 *   word ("gloam") finds the whole ("gloaming").
 * - **Context and file match as written**: the folded query stands somewhere
 *   in the row's context preview, or in its source path.
 * - The query is one phrase. It is not split into terms.
 *
 * A row found only in its definition (the host's answer) carries the host's
 * snippet in place of marks of its own.
 */

import type { DictionaryHistorySearchSnippet, DictionaryHistorySummary } from '@messages';
import { DICTIONARY_HISTORY_SEARCH_QUERY_CHARS } from '@shared/constants/dictionaryHistory';
import {
  TextRange,
  findFoldedMatches,
  foldSearchQuery,
  foldSearchText
} from '@shared/utils/foldedTextSearch';
import { dictionaryPhraseKey } from '@utils/dictionaryHistoryNavigation';

/**
 * The query as it is searched and as the host is asked for it: collapsed,
 * clipped to its bound and folded. `''` means the search is not active.
 */
export function dictionaryHistorySearchQuery(typed: string): string {
  return foldSearchQuery(typed, DICTIONARY_HISTORY_SEARCH_QUERY_CHARS);
}

/** A word, or a query read as one, as the word rule compares it: its phrase key, folded. */
export function dictionaryHistoryWordKey(value: string): string {
  return foldSearchQuery(dictionaryPhraseKey(value), DICTIONARY_HISTORY_SEARCH_QUERY_CHARS);
}

/** Whether a recorded word answers the query, through `dictionaryPhraseKey`. */
export function dictionaryHistoryWordMatches(word: string, query: string): boolean {
  const queryKey = dictionaryHistoryWordKey(query);
  return queryKey.length > 0 && foldSearchText(dictionaryPhraseKey(word)).includes(queryKey);
}

export interface DictionaryHistorySearchRow {
  entry: DictionaryHistorySummary;
  /** Where the query stands in the word as shown; may be empty though the word matched by its key. */
  word: TextRange[];
  context: TextRange[];
  file: TextRange[];
  /** The definition's hit, only for a row that nothing else found. */
  snippet: DictionaryHistorySearchSnippet | null;
}

export interface DictionaryHistorySearchView {
  /** False with no query: every entry is a row and nothing is marked. */
  active: boolean;
  /** Newest first, as the entries are. */
  rows: DictionaryHistorySearchRow[];
  total: number;
}

const NO_RANGES: TextRange[] = [];

/**
 * The rows the popup shows for what is typed. `definitions` is the host's
 * answer for this same query (entry id → snippet), or `null` while there is
 * none; the count of rows is the union of both.
 */
export function searchDictionaryHistory(
  entries: readonly DictionaryHistorySummary[],
  typed: string,
  definitions: ReadonlyMap<string, DictionaryHistorySearchSnippet> | null = null
): DictionaryHistorySearchView {
  const query = dictionaryHistorySearchQuery(typed);
  if (query.length === 0) {
    return {
      active: false,
      rows: entries.map(entry => ({ entry, word: NO_RANGES, context: NO_RANGES, file: NO_RANGES, snippet: null })),
      total: entries.length
    };
  }

  const wordKey = dictionaryHistoryWordKey(typed);
  const rows: DictionaryHistorySearchRow[] = [];
  for (const entry of entries) {
    const wordFound = dictionaryHistoryWordMatches(entry.word, typed);
    const word = wordFound ? findFoldedMatches(entry.word, wordKey) : NO_RANGES;
    const context = findFoldedMatches(entry.contextPreview, query);
    const file = entry.relativePath ? findFoldedMatches(entry.relativePath, query) : NO_RANGES;
    const foundHere = wordFound || context.length > 0 || file.length > 0;
    const snippet = foundHere ? null : definitions?.get(entry.id) ?? null;
    if (foundHere || snippet) {
      rows.push({ entry, word, context, file, snippet });
    }
  }
  return { active: true, rows, total: entries.length };
}

/** The line under the field: "12 of 500 match". */
export function describeDictionaryHistoryMatches(matched: number, total: number): string {
  return `${matched} of ${total} ${matched === 1 ? 'matches' : 'match'}`;
}
