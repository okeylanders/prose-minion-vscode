/**
 * How a session-recall request reads before it runs: the live status line
 * and ticker, the log line's input, the summary a refused or failed call
 * records in the thread, and the advice a refused read ends with. A request
 * has passed the codec, so every field is bounded; titles are known only
 * after a read and are never here.
 */

import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import type { WorkshopTranscriptRecallRequest } from '@shared/types/workshopCapabilities';
import { formatWorkshopRecallTurnRanges } from '@/application/services/workshop/recall/WorkshopRecallReadWindow';
import { recallCount, recallQuoted } from '@/application/services/workshop/recall/WorkshopRecallCopy';

/** "Jill is reading 3 saved sessions…" */
export function workshopTranscriptRecallStatusMessage(request: WorkshopTranscriptRecallRequest, speaker: string): string {
  switch (request.capability) {
    case 'transcript.catalog':
      return `${speaker} is listing saved Workshop sessions…`;
    case 'transcript.search':
      return `${speaker} is searching saved Workshop sessions for ${recallQuoted(request.query)}…`;
    case 'transcript.read':
      return `${speaker} is reading ${request.sessions.length === 1 ? 'a saved session' : recallCount(request.sessions.length, 'saved session')}…`;
    case 'transcript.todos':
      return `${speaker} is checking to-dos in saved Workshop sessions…`;
    default:
      return assertNever(request);
  }
}

export function workshopTranscriptRecallStatusTicker(request: WorkshopTranscriptRecallRequest): string {
  switch (request.capability) {
    case 'transcript.catalog':
      return 'Recall · catalog';
    case 'transcript.search':
      return 'Recall · search';
    case 'transcript.read':
      return `Recall · ${recallCount(request.sessions.length, 'session')}`;
    case 'transcript.todos':
      return `Recall · ${request.status ?? 'open'} to-dos`;
    default:
      return assertNever(request);
  }
}

/** Counts and ids only; ids and a query are bounded by the codec, and a query is quoted as JSON. */
export function workshopTranscriptRecallRequestLogSummary(request: WorkshopTranscriptRecallRequest): string {
  switch (request.capability) {
    case 'transcript.catalog':
      return `persona=${request.personaId ?? 'any'}; matchChars=${request.match?.length ?? 0}`;
    case 'transcript.search':
      return `query=${JSON.stringify(request.query)}; session=${request.sessionId ?? 'any'}; persona=${request.personaId ?? 'any'}`;
    case 'transcript.read':
      // Ids as the persona wrote them, so a live pass can tell a garbled id from a shortened one (U2).
      return `sessions=${request.sessions.length}; ids=${request.sessions.map(({ sessionId }) => sessionId).join(',')}; ` +
        `ranges=${request.sessions.reduce((total, session) => total + (session.turns?.length ?? 0), 0)}; ` +
        `detail=${request.detail ?? 'default'}`;
    case 'transcript.todos':
      return `status=${request.status ?? 'open'}; recent=${request.recent ?? 'default'}; ` +
        `session=${request.sessionId ?? 'any'}; source=${request.source ?? 'any'}; ` +
        `persona=${request.personaId ?? 'any'}; matchChars=${request.match?.length ?? 0}`;
    default:
      return assertNever(request);
  }
}

/**
 * What the thread names the call by when it has nothing better: a refusal,
 * a failure, or a cancellation. A completed call names what it found.
 */
export function workshopTranscriptRecallRequestSummary(request: WorkshopTranscriptRecallRequest): string {
  switch (request.capability) {
    case 'transcript.catalog':
      return [
        request.match ? `sessions matching ${recallQuoted(request.match)}` : 'saved-session catalog',
        ...(request.personaId ? [`with ${workshopPersonaLabel(request.personaId)}`] : [])
      ].join(' ');
    case 'transcript.search':
      return `${recallQuoted(request.query)}${request.sessionId ? ' in one session' : ''}`;
    case 'transcript.read': {
      const [first] = request.sessions;
      return request.sessions.length === 1
        ? `a saved session${first.turns ? ` · turns ${formatWorkshopRecallTurnRanges(first.turns)}` : ''}`
        : recallCount(request.sessions.length, 'saved session');
    }
    case 'transcript.todos':
      return [
        `${request.status ?? 'open'} to-dos`,
        ...(request.match ? [`in sessions matching ${recallQuoted(request.match)}`] : []),
        ...(request.recent !== undefined ? [`from the ${recallCount(request.recent, 'latest session')}`] : []),
        ...(request.sessionId ? ['from one session'] : [])
      ].join(' ');
    default:
      return assertNever(request);
  }
}

/**
 * How a refused read ends: answer from what the turn holds, then tell the
 * writer what is left, so a bounded answer never passes for a complete one.
 * Only a turn's total promises room next turn; the window may not.
 */
export function workshopTranscriptRecallRefusedReadAdvice(named: number, left: 'next-turn' | 'unread'): string {
  const tell = left === 'next-turn'
    ? 'tell the writer which sessions and turns are left for your next turn'
    : 'tell the writer which sessions and turns you could not read';
  return named > 1
    ? `Read fewer sessions at once, or answer from what you have and ${tell}.`
    : `Answer from what you have, and ${tell}.`;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled session-recall request: ${JSON.stringify(value)}`);
}
