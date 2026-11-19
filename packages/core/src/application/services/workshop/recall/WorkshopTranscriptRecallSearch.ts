/**
 * Deterministic, ranked lexical search over recall documents (ADR 2026-10-05
 * §4). Pure: the service supplies documents newest first, and the same
 * documents and query always yield the same hits in the same order.
 *
 * - Query terms are Unicode words with stop words dropped, at most eight. A
 *   query made only of stop words keeps its words, so "what we said" can
 *   still find a phrase.
 * - A term matches a word it prefixes. Search prefers hits that match every
 *   term and falls back to any term when none do.
 * - Ranking: more matched terms, then the phrase bonus (the query's words in
 *   order, the last one as a prefix), then terms matched as whole words, then
 *   the newer session, then the earlier turn.
 * - Title, excerpt-label, and context-label matches are session-level hits.
 *   A tool reply also matches its speaker ("Cliché"); persona names do not.
 * - `<match>` (matchWorkshopRecallSessions) applies these rules to a session's
 *   title and excerpt label only, to narrow the sessions a call reads.
 * - Copies and branches repeat their source's turns with the same ids (runway
 *   F14). Each turn appears once, attributed to the newest session holding
 *   it; the others are named as "also in". A shared id only merges when
 *   everything visible is exactly equal too (not merely equal after search
 *   normalization), so an id collision never hides a turn.
 */

import type { WorkshopTranscriptEntry } from '@/application/services/workshop/transcript/WorkshopTranscript';
import {
  workshopRecallEntryText,
  WorkshopRecallDocument,
  WorkshopRecallEntry,
  WorkshopRecallHeader
} from '@/application/services/workshop/recall/WorkshopRecallDocument';

import {
  type WorkshopQuery as WorkshopRecallQuery,
  type WorkshopMatchMode as WorkshopRecallMatchMode,
  type WorkshopSearchRank as Rank,
  WorkshopQueryMatcher as QueryMatcher,
  normalizeWorkshopText as normalized,
  workshopSearchSnippet as snippet
} from '@/application/services/workshop/WorkshopTextSearch';

export {
  parseWorkshopQuery as parseWorkshopRecallQuery,
  WORKSHOP_QUERY_TERMS as WORKSHOP_RECALL_QUERY_TERMS,
  type WorkshopQuery as WorkshopRecallQuery,
  type WorkshopMatchMode as WorkshopRecallMatchMode
} from '@/application/services/workshop/WorkshopTextSearch';

export interface WorkshopRecallSearchLimits {
  readonly hits: number;
  readonly hitsPerSession: number;
  readonly snippetCharacters: number;
}

/** Another session holding the same turn (a copy or a branch). */
export interface WorkshopRecallSharedTurn {
  readonly sessionId: string;
  readonly title: string;
  readonly position: number;
}

interface WorkshopRecallHitRank {
  readonly matchedTerms: number;
  readonly phrase: boolean;
}

export interface WorkshopRecallTurnHit extends WorkshopRecallHitRank {
  readonly kind: 'turn';
  readonly position: number;
  readonly turnId: string;
  readonly entry: WorkshopTranscriptEntry;
  /** Visible text around the first match, whitespace collapsed. */
  readonly snippet: string;
  readonly alsoIn: readonly WorkshopRecallSharedTurn[];
}

/** The session's own labels matched: which ones, by their visible text. */
export interface WorkshopRecallSessionHit extends WorkshopRecallHitRank {
  readonly kind: 'session';
  readonly title?: string;
  readonly excerptLabel?: string;
  readonly contextLabels: readonly string[];
}

export type WorkshopRecallHit = WorkshopRecallTurnHit | WorkshopRecallSessionHit;

export interface WorkshopRecallSessionHits {
  readonly header: WorkshopRecallHeader;
  readonly hits: readonly WorkshopRecallHit[];
  /** This session's matches that the per-session or total cap left out. */
  readonly omittedHits: number;
}

export interface WorkshopRecallSearchOutcome {
  /** Absent when nothing matched. */
  readonly mode?: WorkshopRecallMatchMode;
  /** Sessions with shown hits, ordered by their best hit. */
  readonly sessions: readonly WorkshopRecallSessionHits[];
  /** Matches after lineage de-duplication, before caps. */
  readonly matchedHits: number;
  readonly shownHits: number;
  /** Sessions with matches but no shown hit, because the total cap ran out. */
  readonly sessionsWithOnlyOmittedHits: number;
  /** Copies of a shown-or-omitted turn folded into "also in". */
  readonly lineageDuplicates: number;
}

/** @param documents Newest first: the order is the recency tie-break. */
export function searchWorkshopRecallDocuments(
  documents: readonly WorkshopRecallDocument[],
  query: WorkshopRecallQuery,
  limits: WorkshopRecallSearchLimits
): WorkshopRecallSearchOutcome {
  if (query.terms.length === 0) {
    return emptyOutcome();
  }
  const matcher = new QueryMatcher(query);
  const candidates = collectCandidates(documents, matcher);
  const best = candidates.reduce((most, candidate) => Math.max(most, candidate.rank.matchedTerms), 0);
  if (best === 0) {
    return emptyOutcome();
  }
  const mode: WorkshopRecallMatchMode = best === query.terms.length ? 'all-terms' : 'any-term';
  const kept = mode === 'all-terms'
    ? candidates.filter((candidate) => candidate.rank.matchedTerms === best)
    : candidates;
  const { unique, duplicates } = foldLineage(kept);
  unique.sort(compareCandidates);

  const shownBySession = new Map<number, Candidate[]>();
  const omittedBySession = new Map<number, number>();
  let shown = 0;
  for (const candidate of unique) {
    const sessionHits = shownBySession.get(candidate.recency) ?? [];
    if (shown >= limits.hits || sessionHits.length >= limits.hitsPerSession) {
      omittedBySession.set(candidate.recency, (omittedBySession.get(candidate.recency) ?? 0) + 1);
      continue;
    }
    sessionHits.push(candidate);
    shownBySession.set(candidate.recency, sessionHits);
    shown += 1;
  }

  const sessions = [...shownBySession.entries()].map(([recency, hits]) => ({
    header: documents[recency].header,
    hits: hits.map((candidate) => toHit(candidate, matcher, limits.snippetCharacters)),
    omittedHits: omittedBySession.get(recency) ?? 0
  }));
  return {
    mode,
    sessions,
    matchedHits: unique.length,
    shownHits: shown,
    sessionsWithOnlyOmittedHits: [...omittedBySession.keys()]
      .filter((recency) => !shownBySession.has(recency)).length,
    lineageDuplicates: duplicates
  };
}

/** The labels `<match>` reads (ADR 2026-10-05 D8): both are in the store's listing. */
export interface WorkshopRecallMatchLabels {
  readonly title: string;
  readonly excerptLabel?: string;
}

export interface WorkshopRecallSessionMatch<T> {
  /** Absent when nothing matched. */
  readonly mode?: WorkshopRecallMatchMode;
  /** The sessions that match, in the order given. */
  readonly sessions: readonly T[];
}

/**
 * `<match>` for the whole transcript family (D8): the sessions whose title or
 * excerpt label match, under search's own rules (the same terms, prefix
 * matching, and all-terms preference). It narrows sessions and keeps their
 * order. Context labels never count: they stay a search feature, and the
 * listing does not hold them, so matching parses no session file.
 */
export function matchWorkshopRecallSessions<T extends WorkshopRecallMatchLabels>(
  sessions: readonly T[],
  query: WorkshopRecallQuery
): WorkshopRecallSessionMatch<T> {
  if (query.terms.length === 0) {
    return { sessions: [] };
  }
  const matcher = new QueryMatcher(query);
  const ranked = sessions.map((session) => ({
    session,
    matchedTerms: matcher.rank(normalized([session.title, session.excerptLabel ?? ''].join('\n'))).matchedTerms
  }));
  const best = ranked.reduce((most, entry) => Math.max(most, entry.matchedTerms), 0);
  if (best === 0) {
    return { sessions: [] };
  }
  const mode: WorkshopRecallMatchMode = best === query.terms.length ? 'all-terms' : 'any-term';
  return {
    mode,
    sessions: ranked
      .filter((entry) => (mode === 'all-terms' ? entry.matchedTerms === best : entry.matchedTerms > 0))
      .map((entry) => entry.session)
  };
}

/**
 * Search's term rules over one free text, for another family's lexical
 * search (project memory, ADR 2026-11-04 D1): how many query terms it
 * matches, whether it holds the phrase, and how many terms matched whole
 * words. Pure.
 */
export function rankWorkshopRecallText(text: string, query: WorkshopRecallQuery): WorkshopRecallTextRank {
  return new QueryMatcher(query).rank(normalized(text));
}

export type WorkshopRecallTextRank = Readonly<Rank>;

/** At most `limit` characters of `text` around its first matching word, by search's own snippet rule. */
export function workshopRecallSnippet(text: string, query: WorkshopRecallQuery, limit: number): string {
  return snippet(text, new QueryMatcher(query), limit);
}

interface Candidate {
  readonly recency: number;
  readonly document: WorkshopRecallDocument;
  /** Absent for a session-level hit, which sorts before the session's turns. */
  readonly turn?: WorkshopRecallEntry;
  readonly rank: Rank;
  alsoIn: WorkshopRecallSharedTurn[];
}

function collectCandidates(
  documents: readonly WorkshopRecallDocument[],
  matcher: QueryMatcher
): Candidate[] {
  const candidates: Candidate[] = [];
  documents.forEach((document, recency) => {
    const { header } = document;
    const labels = [header.title, header.excerptLabel ?? '', ...header.contextLabels].join('\n');
    const sessionRank = matcher.rank(normalized(labels));
    if (sessionRank.matchedTerms > 0) {
      candidates.push({
        recency,
        document,
        rank: { ...sessionRank, phrase: labelPhrase(header, matcher) },
        alsoIn: []
      });
    }
    for (const entry of document.entries) {
      const rank = matcher.rank(entry.searchText);
      if (rank.matchedTerms > 0) {
        candidates.push({ recency, document, turn: entry, rank, alsoIn: [] });
      }
    }
  });
  return candidates;
}

/** A phrase spans one label, never the seam between two. */
function labelPhrase(header: WorkshopRecallHeader, matcher: QueryMatcher): boolean {
  return [header.title, header.excerptLabel ?? '', ...header.contextLabels]
    .some((label) => matcher.rank(normalized(label)).phrase);
}

function foldLineage(candidates: readonly Candidate[]): { unique: Candidate[]; duplicates: number } {
  const byTurn = new Map<string, Candidate>();
  const unique: Candidate[] = [];
  let duplicates = 0;
  // Newest session first, so the first holder of a turn is its attribution.
  const ordered = [...candidates].sort((left, right) => left.recency - right.recency);
  for (const candidate of ordered) {
    if (!candidate.turn) {
      unique.push(candidate);
      continue;
    }
    // The projected entry carries the turn id and everything visible: text,
    // speaker, labels, sources, timestamp. Copies match it exactly.
    const key = JSON.stringify(candidate.turn.entry);
    const holder = byTurn.get(key);
    if (holder) {
      holder.alsoIn.push({
        sessionId: candidate.document.header.sessionId,
        title: candidate.document.header.title,
        position: candidate.turn.position
      });
      duplicates += 1;
      continue;
    }
    byTurn.set(key, candidate);
    unique.push(candidate);
  }
  return { unique, duplicates };
}

function compareCandidates(left: Candidate, right: Candidate): number {
  return (
    right.rank.matchedTerms - left.rank.matchedTerms ||
    Number(right.rank.phrase) - Number(left.rank.phrase) ||
    right.rank.wholeWords - left.rank.wholeWords ||
    left.recency - right.recency ||
    (left.turn?.position ?? 0) - (right.turn?.position ?? 0)
  );
}

function toHit(candidate: Candidate, matcher: QueryMatcher, snippetCharacters: number): WorkshopRecallHit {
  const { turn, rank } = candidate;
  if (!turn) {
    const { header } = candidate.document;
    const matches = (label: string): boolean => matcher.rank(normalized(label)).matchedTerms > 0;
    return {
      kind: 'session',
      matchedTerms: rank.matchedTerms,
      phrase: rank.phrase,
      ...(matches(header.title) ? { title: header.title } : {}),
      ...(header.excerptLabel && matches(header.excerptLabel) ? { excerptLabel: header.excerptLabel } : {}),
      contextLabels: header.contextLabels.filter(matches)
    };
  }
  return {
    kind: 'turn',
    matchedTerms: rank.matchedTerms,
    phrase: rank.phrase,
    position: turn.position,
    turnId: turn.turnId,
    entry: turn.entry,
    snippet: snippet(workshopRecallEntryText(turn.entry), matcher, snippetCharacters),
    alsoIn: candidate.alsoIn
  };
}

function emptyOutcome(): WorkshopRecallSearchOutcome {
  return {
    sessions: [],
    matchedHits: 0,
    shownHits: 0,
    sessionsWithOnlyOmittedHits: 0,
    lineageDuplicates: 0
  };
}
