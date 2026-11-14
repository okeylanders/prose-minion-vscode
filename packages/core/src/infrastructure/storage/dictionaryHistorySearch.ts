/**
 * Searching the Dictionary history's result bodies (ADR 2026-10-14, the
 * 2026-11-14 search amendment).
 *
 * Pure. The store hands it the entries it holds (at most its cap) and the
 * query as typed; it answers with ids and a short snippet around each
 * entry's first hit, never a body. The query is clipped to its bound and
 * folded by the rule the popup's own filter uses (`foldedTextSearch`), and
 * the scan is plain substring search, one pass over each body: no pattern
 * is built from the query.
 */

import type {
  DictionaryHistoryDefinitionMatch,
  DictionaryHistoryEntry,
  DictionaryHistorySearchSnippet
} from '@messages';
import {
  DICTIONARY_HISTORY_SEARCH_QUERY_CHARS,
  DICTIONARY_HISTORY_SEARCH_SNIPPET_AFTER_CHARS,
  DICTIONARY_HISTORY_SEARCH_SNIPPET_BEFORE_CHARS
} from '@shared/constants/dictionaryHistory';
import { TextRange, findFoldedMatches, foldSearchQuery } from '@shared/utils/foldedTextSearch';

/**
 * A hit as written can run longer than the query that found it (its accents
 * may be written as separate marks), so the hit has a bound of its own.
 */
const HIT_CHARS = DICTIONARY_HISTORY_SEARCH_QUERY_CHARS * 2;

const ELLIPSIS = '…';

export interface DictionaryHistoryDefinitionSearch {
  /** Characters of the query that were searched for; 0 when it was empty. */
  queryCharacters: number;
  /** Entries read. */
  scanned: number;
  /** Newest first, as the entries are. */
  matches: DictionaryHistoryDefinitionMatch[];
}

/** An empty query (nothing but whitespace) matches nothing; an over-long one is clipped, never refused. */
export function searchDictionaryHistoryDefinitions(
  entries: readonly DictionaryHistoryEntry[],
  query: string
): DictionaryHistoryDefinitionSearch {
  const folded = foldSearchQuery(query, DICTIONARY_HISTORY_SEARCH_QUERY_CHARS);
  if (folded.length === 0) {
    return { queryCharacters: 0, scanned: 0, matches: [] };
  }
  const matches: DictionaryHistoryDefinitionMatch[] = [];
  for (const entry of entries) {
    const [hit] = findFoldedMatches(entry.result, folded, 1);
    if (hit) {
      matches.push({ id: entry.id, snippet: snippetAround(entry.result, hit) });
    }
  }
  return { queryCharacters: folded.length, scanned: entries.length, matches };
}

const collapse = (text: string): string => text.replace(/\s+/g, ' ');

const isLowSurrogate = (unit: number): boolean => unit >= 0xdc00 && unit <= 0xdfff;
const isHighSurrogate = (unit: number): boolean => unit >= 0xd800 && unit <= 0xdbff;

/** A cut never leaves half of a surrogate pair behind. */
function sliceWhole(text: string, start: number, end: number): string {
  let from = Math.max(0, start);
  let to = Math.min(text.length, end);
  if (from < to && from > 0 && isLowSurrogate(text.charCodeAt(from))) {
    from += 1;
  }
  if (to > from && to < text.length && isHighSurrogate(text.charCodeAt(to - 1))) {
    to -= 1;
  }
  return text.slice(from, to);
}

function snippetAround(body: string, hit: TextRange): DictionaryHistorySearchSnippet {
  const beforeStart = hit.start - DICTIONARY_HISTORY_SEARCH_SNIPPET_BEFORE_CHARS;
  const afterEnd = hit.end + DICTIONARY_HISTORY_SEARCH_SNIPPET_AFTER_CHARS;
  const before = collapse(sliceWhole(body, beforeStart, hit.start)).trimStart();
  const after = collapse(sliceWhole(body, hit.end, afterEnd)).trimEnd();
  return {
    before: beforeStart > 0 ? `${ELLIPSIS}${before}` : before,
    hit: collapse(sliceWhole(body, hit.start, Math.min(hit.end, hit.start + HIT_CHARS))),
    after: afterEnd < body.length ? `${after}${ELLIPSIS}` : after
  };
}
