/**
 * Model-facing text for session recall (ADR 2026-10-05 §4, §6): the catalog,
 * search hits grouped by session, and read windows. Pure: the caller supplies
 * the service's data and the clock.
 *
 * - The first line of every body is the one-line quoted-record framing
 *   (WorkshopRecallCopy), so it travels with the evidence when publication
 *   delivers it to others.
 * - Search and catalog text state every bound the service disclosed.
 * - A read is a header, a packed window (WorkshopRecallReadWindow), and a
 *   footer naming what was shown and where to continue.
 *
 * This module renders the transcript projection only. It never imports the
 * room-frame renderer, whose output includes thread-artifact bodies (F11).
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { WORKSHOP_TRANSCRIPT_WRITER_LABEL } from '@/application/services/workshop/transcript/WorkshopTranscript';
import type { WorkshopTranscriptEntry } from '@/application/services/workshop/transcript/WorkshopTranscript';
import type { WorkshopRecallHeader } from '@/application/services/workshop/recall/WorkshopRecallDocument';
import {
  formatWorkshopRecallTurnRanges,
  packWorkshopRecallReadWindow,
  WORKSHOP_RECALL_BLOCK_SEPARATOR,
  WorkshopRecallDeliveredRange,
  WorkshopRecallReadWindow,
  WorkshopRecallTruncatedEntry
} from '@/application/services/workshop/recall/WorkshopRecallReadWindow';
import { WorkshopRecallClock } from '@/application/services/workshop/recall/WorkshopRecallTime';
import {
  recallBlock,
  recallLabel,
  recallLabelList
} from '@/application/services/workshop/recall/WorkshopRecallText';
import {
  recallBody,
  recallCount,
  recallListingNote,
  recallMatchWords,
  recallQuoted,
  recallSavedAt,
  recallScopeLine,
  recallUnavailable,
  recallUnknownSession
} from '@/application/services/workshop/recall/WorkshopRecallCopy';
import type {
  WorkshopRecallHit,
  WorkshopRecallSessionHits
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallSearch';
import type {
  WorkshopRecallCatalogResult,
  WorkshopRecallCatalogSession,
  WorkshopRecallReadResult,
  WorkshopRecallSearchResult,
  WorkshopRecallTurnRange
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';

/** The context-attachment labels in a read's header. */
const READ_CONTEXT_LABEL_CHARACTERS = 2_000;
/** The context-attachment labels in one session-level search hit. */
const HIT_CONTEXT_LABEL_CHARACTERS = 400;
/** Participant names on one header or catalog line. */
const PARTICIPANT_CHARACTERS = 400;
/** Sessions named in one hit's "also in". */
const ALSO_IN_SESSIONS = 3;
/** Ranges one footer or header list names before counting the rest. */
const LISTED_RANGES = 12;

/**
 * A read's complete text is header + entries + footer. The header and the
 * footer each have a hard cap, so the entries' share is known before any
 * metadata is rendered, whatever a saved file holds (PR 126 review F-01).
 */
const READ_HEADER_CHARACTERS = 4_000;
const READ_FOOTER_CHARACTERS = 1_000;
/**
 * The smallest supported `readCharacters`: both caps, plus room for a
 * readable head of one entry. A smaller window is a programming error.
 */
export const WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS =
  READ_HEADER_CHARACTERS + READ_FOOTER_CHARACTERS + 1_000;

export interface WorkshopRecallRenderOptions {
  /** Epoch ms, for relative dates. */
  readonly now: number;
  /** Defaults to PROMPT_BUDGETS.workshopTranscriptRecall.readCharacters. */
  readonly readCharacters?: number;
}

export interface WorkshopRecallRenderedRead {
  readonly content: string;
  /** Empty unless the result was a read. */
  readonly delivered: readonly WorkshopRecallDeliveredRange[];
  /** Requested turns the window did not reach; empty when it reached them all. */
  readonly continuation: readonly WorkshopRecallTurnRange[];
  readonly truncatedEntry?: WorkshopRecallTruncatedEntry;
}

export function renderWorkshopRecallCatalog(
  result: WorkshopRecallCatalogResult,
  options: WorkshopRecallRenderOptions
): string {
  if (!result.available) {
    return recallUnavailable(result);
  }
  const which = [
    ...(result.personaId ? [` that include ${workshopPersonaLabel(result.personaId)}`] : []),
    ...(result.match ? [` with a ${recallMatchWords(result.match)}`] : [])
  ].join(',');
  if (result.sessions.length === 0) {
    return recallBody([`No other saved Workshop sessions in this workspace${which}.`, ...recallListingNote(result.listingTruncated)]);
  }
  const shown = result.sessions.length;
  return recallBody([
    `Saved Workshop sessions in this workspace${which}, newest first. ` +
      `The current session is never listed.`,
    '',
    ...result.sessions.flatMap((session, index) => [
      ...(index > 0 ? [''] : []),
      ...catalogEntry(session, index + 1, options.now)
    ]),
    ...(shown < result.matchingSessions
      ? ['', `Showing ${shown} of ${result.matchingSessions} ${result.match ? 'matching ' : ''}sessions; the rest are older.`]
      : []),
    ...recallListingNote(result.listingTruncated)
  ]);
}

export function renderWorkshopRecallSearch(
  result: WorkshopRecallSearchResult,
  options: WorkshopRecallRenderOptions
): string {
  if (!result.available) {
    return recallUnavailable(result);
  }
  if (result.outcome === 'unknown-session') {
    return recallUnknownSession(result);
  }
  const { query, search, bounds } = result;
  const lines = [
    `Search: ${recallQuoted(result.queryText)} · terms: ${query.terms.join(', ') || 'none'}` +
      (query.overflowTerms.length > 0
        ? ` (not searched, past the eight-term limit: ${query.overflowTerms.join(', ')})`
        : ''),
    searchedLine(result),
    ...(bounds.listingTruncated ? recallListingNote(true) : []),
    ''
  ];
  if (!search.mode) {
    lines.push(
      query.terms.length === 0
        ? 'The query has no words to search for.'
        : bounds.sessionsSearched === 0
          ? 'Nothing was searched.'
          : 'No visible turn or session label matched.'
    );
    return recallBody(lines);
  }
  lines.push(
    search.mode === 'all-terms'
      ? 'Every hit matches every term.'
      : 'No turn matched every term; these match some of them.',
    ''
  );
  search.sessions.forEach((session, index) => {
    if (index > 0) {
      lines.push('');
    }
    lines.push(...sessionHits(session, options.now));
  });
  if (search.shownHits < search.matchedHits) {
    lines.push(
      '',
      `${search.shownHits} of ${search.matchedHits} hits shown` +
        (search.sessionsWithOnlyOmittedHits > 0
          ? `; ${recallCount(search.sessionsWithOnlyOmittedHits, 'more session')} also matched.`
          : '.')
    );
  }
  const example = firstTurnHit(search.sessions);
  if (example) {
    lines.push(
      '',
      `Read around a hit with transcript.read, for example <session>${example.sessionId}</session> ` +
        `<turns>${Math.max(1, example.position - 2)}-${example.position + 3}</turns>.`
    );
  }
  return recallBody(lines);
}

export function renderWorkshopRecallRead(
  result: WorkshopRecallReadResult,
  options: WorkshopRecallRenderOptions
): WorkshopRecallRenderedRead {
  if (!result.available) {
    return notRead(recallUnavailable(result));
  }
  if (result.outcome === 'unknown-session') {
    return notRead(recallUnknownSession(result));
  }
  if (result.outcome === 'unreadable') {
    return notRead(recallBody([
      `The saved session ${recallQuoted(result.title)} (id ${recallLabel(result.sessionId)}) could not be read; ` +
        'its file may be damaged or too large. Nothing from it is shown.'
    ]));
  }
  const budget = options.readCharacters ?? PROMPT_BUDGETS.workshopTranscriptRecall.readCharacters;
  if (budget < WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS) {
    throw new RangeError(
      `A session-recall read needs at least ${WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS} characters; got ${budget}.`
    );
  }
  const header = recallBlock(
    recallBody([...readHeader(result.header, options.now), requestedLine(result), ...contextLine(result.header)]),
    READ_HEADER_CHARACTERS,
    '[header shortened to fit the window]'
  );
  // header + separator + blocks (each costed with its separator) + footer.
  const window = packWorkshopRecallReadWindow(
    result.ranges,
    result.header.timezone,
    budget - header.length - WORKSHOP_RECALL_BLOCK_SEPARATOR.length - READ_FOOTER_CHARACTERS
  );
  const footer = recallBlock(
    readFooter(result, window).join('\n'),
    READ_FOOTER_CHARACTERS,
    '[footer shortened]'
  );
  return {
    content: [header, ...window.blocks, footer].join(WORKSHOP_RECALL_BLOCK_SEPARATOR),
    delivered: window.delivered,
    continuation: window.continuation,
    ...(window.truncatedEntry ? { truncatedEntry: window.truncatedEntry } : {})
  };
}

// ── Read windows ─────────────────────────────────────────────────────────────

/** Context labels come last, so a header over its cap loses them first. */
function readHeader(header: WorkshopRecallHeader, now: number): string[] {
  const clock = new WorkshopRecallClock(header.timezone);
  return [
    `Session ${recallQuoted(header.title)} · id ${recallLabel(header.sessionId)}`,
    `Saved ${recallSavedAt(header.savedAt, header.timezone, now)} · started ${clock.date(Date.parse(header.startedAt))}`,
    `Host ${recallLabel(header.host)} · participants ${recallLabelList(header.participants, PARTICIPANT_CHARACTERS)}`,
    ...recallScopeLine(header.scope, header.excerptLabel)
  ];
}

function contextLine(header: WorkshopRecallHeader): string[] {
  return header.contextLabels.length > 0
    ? [`Context attachments (labels only): ${recallLabelList(header.contextLabels, READ_CONTEXT_LABEL_CHARACTERS)}`]
    : [];
}

function requestedLine(result: Extract<WorkshopRecallReadResult, { outcome: 'read' }>): string {
  const total = result.header.turnCount;
  return result.fromStart
    ? `Requested: the whole session from turn 1 (${recallCount(total, 'turn')}).`
    : `Requested: turns ${listedRanges(result.ranges)} of ${total}.`;
}

/** At most LISTED_RANGES ranges in the `<turns>` grammar, then a count of the rest. */
function listedRanges(ranges: readonly WorkshopRecallTurnRange[]): string {
  const listed = formatWorkshopRecallTurnRanges(ranges.slice(0, LISTED_RANGES));
  return ranges.length > LISTED_RANGES ? `${listed}, and ${ranges.length - LISTED_RANGES} more ranges` : listed;
}

function readFooter(
  result: Extract<WorkshopRecallReadResult, { outcome: 'read' }>,
  window: WorkshopRecallReadWindow
): string[] {
  const lines: string[] = [];
  const empty = result.ranges.filter((range) => range.entries.length === 0);
  if (window.delivered.length === 0 && empty.length === result.ranges.length) {
    lines.push(
      result.header.turnCount === 0
        ? 'This session has no turns.'
        : `No visible turns in ${listedRanges(empty)}; ` +
          `this session ends at turn ${result.header.turnCount}.`
    );
    return lines;
  }
  lines.push(
    window.delivered.length === 0
      ? 'No turn fit in this window.'
      : window.continuation.length === 0
        ? `Shown: turns ${listedRanges(window.delivered)}; every requested turn is here.`
        : `Shown: turns ${listedRanges(window.delivered)}; the window is full.`
  );
  if (empty.length > 0) {
    lines.push(`No visible turns in ${listedRanges(empty)}.`);
  }
  if (window.continuation.length > 0) {
    const next = window.continuation.slice(0, LISTED_RANGES);
    const later = window.continuation.length - next.length;
    lines.push(
      `Continue with <turns>${formatWorkshopRecallTurnRanges(next)}</turns>` +
        (later > 0 ? `, then the ${later} further ranges requested.` : '.')
    );
  }
  return lines;
}

// ── Catalog and search ───────────────────────────────────────────────────────

function catalogEntry(session: WorkshopRecallCatalogSession, ordinal: number, now: number): string[] {
  return [
    `${ordinal}. ${recallQuoted(session.title)} · id ${recallLabel(session.sessionId)}`,
    `   Saved ${recallSavedAt(session.savedAt, session.timezone, now)}`,
    `   Host ${recallLabel(session.host)} · participants ${recallLabelList(session.participants, PARTICIPANT_CHARACTERS)}`,
    `   ${[...recallScopeLine(session.scope, session.excerptLabel), `last turn ${session.lastTurn}`].join(' · ')}`
  ];
}

function searchedLine(result: Extract<WorkshopRecallSearchResult, { outcome: 'searched' }>): string {
  const { bounds } = result;
  const filter = [
    ...(result.sessionId ? [`session ${recallLabel(result.sessionId)}`] : []),
    ...(result.personaId ? [`sessions that include ${workshopPersonaLabel(result.personaId)}`] : [])
  ];
  const notSearched = [
    ...(bounds.notSearchedBySessionLimit > 0
      ? [`${bounds.notSearchedBySessionLimit} older past the session limit`]
      : []),
    ...(bounds.notSearchedByByteBudget > 0
      ? [`${bounds.notSearchedByByteBudget} past this search's reading budget`]
      : [])
  ];
  return [
    `Searched ${bounds.sessionsSearched} of ${recallCount(bounds.corpusSessions, 'saved session')}` +
      (filter.length > 0 ? ` (${filter.join(', ')})` : '') +
      '; the current session is never searched.',
    ...(notSearched.length > 0 ? [`Not searched: ${notSearched.join('; ')}.`] : []),
    ...(bounds.unreadableSessions > 0
      ? [`${recallCount(bounds.unreadableSessions, 'session')} could not be read and ${bounds.unreadableSessions === 1 ? 'was' : 'were'} skipped.`]
      : [])
  ].join(' ');
}

function sessionHits(session: WorkshopRecallSessionHits, now: number): string[] {
  const { header } = session;
  return [
    `${recallQuoted(header.title)} · id ${recallLabel(header.sessionId)} · saved ${recallSavedAt(header.savedAt, header.timezone, now)}`,
    ...session.hits.map((hit) => `- ${hitLine(hit)}`),
    ...(session.omittedHits > 0
      ? [`  ${recallCount(session.omittedHits, 'more hit')} in this session not shown.`]
      : [])
  ];
}

function hitLine(hit: WorkshopRecallHit): string {
  if (hit.kind === 'session') {
    const labels = [
      ...(hit.title ? [`title ${recallQuoted(hit.title)}`] : []),
      ...(hit.excerptLabel ? [`excerpt ${recallLabel(hit.excerptLabel)}`] : []),
      ...(hit.contextLabels.length > 0 ? [`context ${recallLabelList(hit.contextLabels, HIT_CONTEXT_LABEL_CHARACTERS)}`] : [])
    ];
    return `session labels: ${labels.join('; ')}`;
  }
  const shared = hit.alsoIn.slice(0, ALSO_IN_SESSIONS)
    .map((other) => `${recallQuoted(other.title)} turn ${other.position}`);
  if (hit.alsoIn.length > ALSO_IN_SESSIONS) {
    shared.push(`and ${hit.alsoIn.length - ALSO_IN_SESSIONS} more`);
  }
  const also = hit.alsoIn.length > 0
    ? ` (also in ${shared.join(', ')})`
    : '';
  return `turn ${hit.position} · ${speakerOf(hit.entry)}: ${hit.snippet}${also}`;
}

function speakerOf(entry: WorkshopTranscriptEntry): string {
  switch (entry.kind) {
    case 'writer':
      return `${WORKSHOP_TRANSCRIPT_WRITER_LABEL}${entry.privateWith ? ` · private with ${recallLabel(entry.privateWith)}` : ''}`;
    case 'reply':
      return `${recallLabel(entry.speaker)}${entry.privateWith ? ' · private' : ''}`;
    case 'event':
      return 'event';
    default:
      return assertNever(entry);
  }
}

function firstTurnHit(
  sessions: readonly WorkshopRecallSessionHits[]
): { sessionId: string; position: number } | undefined {
  for (const session of sessions) {
    const hit = session.hits.find((candidate) => candidate.kind === 'turn');
    if (hit?.kind === 'turn') {
      return { sessionId: session.header.sessionId, position: hit.position };
    }
  }
  return undefined;
}

// ── Shared copy ──────────────────────────────────────────────────────────────

function notRead(content: string): WorkshopRecallRenderedRead {
  return { content, delivered: [], continuation: [] };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled session-recall value: ${JSON.stringify(value)}`);
}
