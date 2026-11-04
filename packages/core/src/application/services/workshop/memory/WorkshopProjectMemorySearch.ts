/**
 * `memory.search` (ADR 2026-11-04 D1): deterministic lexical matching over
 * each memory's title, summary and body, by session recall's term rules
 * (Unicode words, stop words dropped, prefix matches, all terms preferred
 * over any term, a phrase bonus; ADR 2026-10-05 §4). Pure.
 *
 * Ranking: more matched terms, then the phrase, then terms matched as whole
 * words, then the newer `updated`, then the id. `<status>` chooses which
 * memories are searched: active ones in effect (the default), superseded,
 * archived, or all of them.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopMemorySearchStatus } from '@shared/types/workshopCapabilities';
import {
  parseWorkshopRecallQuery,
  rankWorkshopRecallText,
  workshopRecallSnippet,
  type WorkshopRecallMatchMode,
  type WorkshopRecallQuery,
  type WorkshopRecallTextRank
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallSearch';
import {
  compareProjectMemoryNewestFirst,
  isProjectMemoryInEffect,
  type ProjectMemoryListed
} from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';

export interface ProjectMemorySearchHit {
  readonly listed: ProjectMemoryListed;
  readonly matchedTerms: number;
  /** Around the first match in the body, else the summary. */
  readonly snippet: string;
}

export interface ProjectMemorySearchOutcome {
  readonly query: WorkshopRecallQuery;
  /** Absent when nothing matched. */
  readonly mode?: WorkshopRecallMatchMode;
  readonly hits: readonly ProjectMemorySearchHit[];
  /** Every memory that matched; past `searchHits` they are counted, not shown. */
  readonly matched: number;
  /** Memories the status chose, before matching. */
  readonly searched: number;
}

/** Whether a memory's standing is the status asked for. */
export function projectMemoryHasStatus(listed: ProjectMemoryListed, status: WorkshopMemorySearchStatus): boolean {
  switch (status) {
    case 'active':
      return isProjectMemoryInEffect(listed);
    case 'superseded':
      return listed.memory.status === 'active' && listed.superseded;
    case 'archived':
      return listed.memory.status === 'archived';
    case 'all':
      return true;
    default:
      return assertNever(status);
  }
}

export function searchProjectMemories(
  memories: readonly ProjectMemoryListed[],
  text: string,
  status: WorkshopMemorySearchStatus,
  limits: { readonly hits: number; readonly snippetCharacters: number } = {
    hits: PROMPT_BUDGETS.workshopProjectMemory.searchHits,
    snippetCharacters: PROMPT_BUDGETS.workshopProjectMemory.snippetCharacters
  }
): ProjectMemorySearchOutcome {
  const query = parseWorkshopRecallQuery(text);
  const chosen = memories.filter((listed) => projectMemoryHasStatus(listed, status));
  if (query.terms.length === 0) {
    return { query, hits: [], matched: 0, searched: chosen.length };
  }
  const ranked = chosen.map((listed) => ({
    listed,
    rank: rankWorkshopRecallText([listed.memory.title, listed.memory.summary, listed.memory.body].join('\n'), query)
  }));
  const best = ranked.reduce((most, { rank }) => Math.max(most, rank.matchedTerms), 0);
  if (best === 0) {
    return { query, hits: [], matched: 0, searched: chosen.length };
  }
  const mode: WorkshopRecallMatchMode = best === query.terms.length ? 'all-terms' : 'any-term';
  const kept = ranked
    .filter(({ rank }) => (mode === 'all-terms' ? rank.matchedTerms === best : rank.matchedTerms > 0))
    .sort((left, right) => compareRanks(left.rank, right.rank) || compareProjectMemoryNewestFirst(left.listed, right.listed));
  return {
    query,
    mode,
    hits: kept.slice(0, limits.hits).map(({ listed, rank }) => ({
      listed,
      matchedTerms: rank.matchedTerms,
      snippet: snippetOf(listed, query, limits.snippetCharacters)
    })),
    matched: kept.length,
    searched: chosen.length
  };
}

function compareRanks(left: WorkshopRecallTextRank, right: WorkshopRecallTextRank): number {
  return (right.matchedTerms - left.matchedTerms) ||
    (Number(right.phrase) - Number(left.phrase)) ||
    (right.wholeWords - left.wholeWords);
}

function snippetOf(listed: ProjectMemoryListed, query: WorkshopRecallQuery, limit: number): string {
  const body = listed.memory.body.trim();
  const source = body.length > 0 && rankWorkshopRecallText(body, query).matchedTerms > 0 ? body : listed.memory.summary;
  return workshopRecallSnippet(source, query, limit);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled memory search status: ${String(value)}`);
}
