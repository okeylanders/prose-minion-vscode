/**
 * Model-facing text for session recall (ADR 2026-10-05 §4, §6, D9): the
 * catalog, search hits grouped by session, and reads. Pure: the caller
 * supplies the service's data and the clock.
 *
 * - The first line of every body is the one-line quoted-record framing
 *   (WorkshopRecallCopy), so it travels with the evidence when publication
 *   delivers it to others. A read of several sessions has it once.
 * - Search and catalog text state every bound the service disclosed.
 * - A read gives each session it names a fair share of its characters
 *   (WorkshopRecallReadAllocation). Within its share each session reads as
 *   a section of its own (WorkshopRecallReadSection): a header, a packed
 *   window, and a footer naming what was shown and where to continue.
 *
 * This module renders the transcript projection only. It never imports the
 * room-frame renderer, whose output includes thread-artifact bodies (F11).
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { WORKSHOP_TRANSCRIPT_WRITER_LABEL } from '@/application/services/workshop/transcript/WorkshopTranscript';
import type { WorkshopTranscriptEntry } from '@/application/services/workshop/transcript/WorkshopTranscript';
import { WORKSHOP_RECALL_BLOCK_SEPARATOR } from '@/application/services/workshop/recall/WorkshopRecallReadWindow';
import { allocateWorkshopRecallReadShares } from '@/application/services/workshop/recall/WorkshopRecallReadAllocation';
import {
  prepareWorkshopRecallReadSection,
  RECALL_PARTICIPANT_CHARACTERS,
  workshopRecallMinimumReadCharacters,
  WorkshopRecallRenderedSection
} from '@/application/services/workshop/recall/WorkshopRecallReadSection';
import {
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
  recallUnknownSession,
  WORKSHOP_TRANSCRIPT_RECALL_FRAMING
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
  WorkshopRecallSessionRead
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';

/** The context-attachment labels in one session-level search hit. */
const HIT_CONTEXT_LABEL_CHARACTERS = 400;
/** Sessions named in one hit's "also in". */
const ALSO_IN_SESSIONS = 3;
/** What discussion detail keeps and what it collapses (D10). */
const DISCUSSION_DETAIL =
  "each tool report is one line, and the writer's messages, persona replies, and events are whole";

export interface WorkshopRecallRenderOptions {
  /** Epoch ms, for relative dates. */
  readonly now: number;
  /**
   * The whole read's characters. Defaults to
   * PROMPT_BUDGETS.workshopTranscriptRecall.readCharacters; a caller may
   * lower it, never below workshopRecallMinimumReadCharacters(sessions).
   */
  readonly readCharacters?: number;
}

/** One named session's part of a rendered read, in the order asked, for provenance. */
export interface WorkshopRecallRenderedSession extends Omit<WorkshopRecallRenderedSection, 'text'> {
  readonly sessionId: string;
  readonly outcome: WorkshopRecallSessionRead['outcome'];
  /** The characters the allocation gave it, the separator before it included. */
  readonly share: number;
}

export interface WorkshopRecallRenderedRead {
  readonly content: string;
  /** One per named session, in the order asked; empty when recall was unavailable. */
  readonly sessions: readonly WorkshopRecallRenderedSession[];
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

/**
 * A read within `readCharacters`, whatever its saved files hold: each named
 * session's section gets a fair share (D9), a share never smaller than the
 * per-session minimum unless the section needs less, and the shares never
 * sum past the budget. Throws a RangeError for a read that names no
 * session, and below the minimum for the number of sessions named.
 */
export function renderWorkshopRecallRead(
  result: WorkshopRecallReadResult,
  options: WorkshopRecallRenderOptions
): WorkshopRecallRenderedRead {
  if (!result.available) {
    return { content: recallUnavailable(result), sessions: [] };
  }
  if (result.sessions.length === 0) {
    // The service refuses an empty read before reading anything; rendering one would be an empty body.
    throw new RangeError('A session-recall read names at least one session; got none.');
  }
  const budget = options.readCharacters ?? PROMPT_BUDGETS.workshopTranscriptRecall.readCharacters;
  const minimum = workshopRecallMinimumReadCharacters(result.sessions.length);
  if (budget < minimum) {
    throw new RangeError(
      `A session-recall read of ${recallCount(result.sessions.length, 'session')} needs at least ${minimum} characters; got ${budget}.`
    );
  }
  const count = result.sessions.length;
  const sections = result.sessions.map((read, index) => prepareWorkshopRecallReadSection(read, {
    now: options.now,
    detail: result.detail,
    opening: index === 0 ? readOpening(result) : [],
    ...(count > 1 ? { ordinal: { index: index + 1, count } } : {})
  }));
  // Each share covers its section and the separator before it.
  const separator = (index: number): number => (index > 0 ? WORKSHOP_RECALL_BLOCK_SEPARATOR.length : 0);
  const shares = allocateWorkshopRecallReadShares(budget, sections.map((section, index) => section.need + separator(index)));
  const rendered = sections.map((section, index) => section.render(shares[index] - separator(index)));
  return {
    content: rendered.map((section) => section.text).join(WORKSHOP_RECALL_BLOCK_SEPARATOR),
    sessions: rendered.map(({ text: _text, ...section }, index) => ({
      sessionId: sessionIdOf(result.sessions[index]),
      outcome: result.sessions[index].outcome,
      share: shares[index],
      ...section
    }))
  };
}

// ── Reads ────────────────────────────────────────────────────────────────────

/** The framing line, then, for several sessions or discussion detail, what the read is. */
function readOpening(result: Extract<WorkshopRecallReadResult, { outcome: 'read' }>): string[] {
  const count = result.sessions.length;
  const unlisted = result.bounds.listingTruncated &&
    result.sessions.some((read) => read.outcome === 'unknown-session' && !read.liveSession);
  const listing = unlisted ? recallListingNote(true) : [];
  if (count === 1) {
    return [
      WORKSHOP_TRANSCRIPT_RECALL_FRAMING,
      ...(result.detail === 'discussion' ? [`Discussion detail: ${DISCUSSION_DETAIL}.`] : []),
      ...listing
    ];
  }
  return [
    WORKSHOP_TRANSCRIPT_RECALL_FRAMING,
    `Read of ${count} saved sessions, in the order asked, in ${result.detail} detail` +
      `${result.detail === 'discussion' ? `: ${DISCUSSION_DETAIL}` : ''}. ` +
      'Each session has an equal share of this read; one that needs less leaves the rest to the others.',
    ...listing
  ];
}

function sessionIdOf(read: WorkshopRecallSessionRead): string {
  return read.outcome === 'read' ? read.header.sessionId : read.sessionId;
}

// ── Catalog and search ───────────────────────────────────────────────────────

function catalogEntry(session: WorkshopRecallCatalogSession, ordinal: number, now: number): string[] {
  return [
    `${ordinal}. ${recallQuoted(session.title)} · id ${recallLabel(session.sessionId)}`,
    `   Saved ${recallSavedAt(session.savedAt, session.timezone, now)}`,
    `   Host ${recallLabel(session.host)} · participants ${recallLabelList(session.participants, RECALL_PARTICIPANT_CHARACTERS)}`,
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

function assertNever(value: never): never {
  throw new Error(`Unhandled session-recall value: ${JSON.stringify(value)}`);
}
