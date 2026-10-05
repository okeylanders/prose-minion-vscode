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
 * - Copies and branches repeat their source's turns with the same ids (runway
 *   F14). Each turn appears once, attributed to the newest session holding
 *   it; the others are named as "also in". A shared id only merges when the
 *   visible text is identical too, so an id collision never hides a turn.
 */

import type { WorkshopTranscriptEntry } from '@/application/services/workshop/transcript/WorkshopTranscript';
import {
  workshopRecallEntryText,
  workshopRecallWords,
  WorkshopRecallDocument,
  WorkshopRecallEntry,
  WorkshopRecallHeader
} from '@/application/services/workshop/recall/WorkshopRecallDocument';

export const WORKSHOP_RECALL_QUERY_TERMS = 8;

export type WorkshopRecallMatchMode = 'all-terms' | 'any-term';

export interface WorkshopRecallQuery {
  /** Distinct normalized terms that search matches, at most eight. */
  readonly terms: readonly string[];
  /** Distinct terms past the eight-term limit; disclosed, never searched. */
  readonly overflowTerms: readonly string[];
  /** Every normalized query word in order, for the phrase bonus. */
  readonly phrase: readonly string[];
}

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

export function parseWorkshopRecallQuery(query: string): WorkshopRecallQuery {
  const words = workshopRecallWords(query).map((word) => word.normalized);
  const distinct = [...new Set(words)];
  const content = distinct.filter((word) => !STOP_WORDS.has(word));
  const candidates = content.length > 0 ? content : distinct;
  return {
    terms: candidates.slice(0, WORKSHOP_RECALL_QUERY_TERMS),
    overflowTerms: candidates.slice(WORKSHOP_RECALL_QUERY_TERMS),
    phrase: words
  };
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

interface Rank extends WorkshopRecallHitRank {
  readonly wholeWords: number;
}

interface Candidate {
  readonly recency: number;
  readonly document: WorkshopRecallDocument;
  /** Absent for a session-level hit, which sorts before the session's turns. */
  readonly turn?: WorkshopRecallEntry;
  readonly rank: Rank;
  alsoIn: WorkshopRecallSharedTurn[];
}

class QueryMatcher {
  private readonly phraseText?: string;

  constructor(readonly query: WorkshopRecallQuery) {
    // Whole words, except the last, which may still be a prefix: "keeper's mo"
    // finds "keeper's mother".
    this.phraseText = query.phrase.length > 1 ? ` ${query.phrase.join(' ')}` : undefined;
  }

  /** Rank one normalized, space-separated text. */
  rank(searchText: string): Rank {
    const padded = ` ${searchText} `;
    let matchedTerms = 0;
    let wholeWords = 0;
    for (const term of this.query.terms) {
      if (padded.includes(` ${term}`)) {
        matchedTerms += 1;
        if (padded.includes(` ${term} `)) {
          wholeWords += 1;
        }
      }
    }
    const phrase = this.phraseText !== undefined && padded.includes(this.phraseText);
    return { matchedTerms, phrase, wholeWords };
  }

  matchesWord(normalizedWord: string): boolean {
    return this.query.terms.some((term) => normalizedWord.startsWith(term));
  }
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
    const key = `${candidate.turn.turnId}\u0000${candidate.turn.searchText}`;
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

const ELLIPSIS = '…';
/** How far a cut may move to land on a word boundary. */
const BOUNDARY_SLACK = 24;

/**
 * At most `limit` characters around the first matching word, with the match
 * about a third of the way in, cut at word boundaries where one is near.
 */
function snippet(text: string, matcher: QueryMatcher, limit: number): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= limit) {
    return collapsed;
  }
  const first = workshopRecallWords(collapsed).find((word) => matcher.matchesWord(word.normalized));
  const window = limit - 2 * ELLIPSIS.length;
  const anchor = first?.start ?? 0;
  let start = Math.max(0, Math.min(anchor - Math.floor(window / 3), collapsed.length - window));
  let end = Math.min(collapsed.length, start + window);
  if (start > 0) {
    const space = collapsed.indexOf(' ', start);
    if (space >= 0 && space < Math.min(anchor, start + BOUNDARY_SLACK)) {
      start = space + 1;
    }
  }
  if (end < collapsed.length) {
    const space = collapsed.lastIndexOf(' ', end);
    if (space > Math.max(start, end - BOUNDARY_SLACK)) {
      end = space;
    }
  }
  return `${start > 0 ? ELLIPSIS : ''}${collapsed.slice(start, end).trim()}${end < collapsed.length ? ELLIPSIS : ''}`;
}

function normalized(text: string): string {
  return workshopRecallWords(text).map((word) => word.normalized).join(' ');
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

/** Common English function words, in normalized form (apostrophes dropped). */
const STOP_WORDS: ReadonlySet<string> = new Set([
  'a', 'about', 'after', 'again', 'all', 'also', 'am', 'an', 'and', 'any', 'are',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'but', 'by', 'can',
  'could', 'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont', 'down',
  'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his',
  'how', 'i', 'if', 'im', 'in', 'into', 'is', 'isnt', 'it', 'its', 'itself',
  'ive', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves',
  'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than',
  'that', 'thats', 'the', 'their', 'theirs', 'them', 'themselves', 'then',
  'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under',
  'until', 'up', 'very', 'was', 'wasnt', 'we', 'were', 'what', 'when', 'where',
  'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would', 'you',
  'youre', 'your', 'yours', 'yourself', 'yourselves'
]);
