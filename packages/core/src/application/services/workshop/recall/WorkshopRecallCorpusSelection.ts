/**
 * What one session-recall call selects: the recallable sessions in a
 * listing, the catalog rows, and a read's turn ranges resolved against a
 * document. Pure; the service owns scope, reads, and the cache.
 */

import type { WorkshopPersonaId } from '@messages';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import type { WorkshopRecallDocument } from '@/application/services/workshop/recall/WorkshopRecallDocument';
import type {
  WorkshopRecallCatalogSession,
  WorkshopRecallReadRange,
  WorkshopRecallTurnRange,
  WorkshopRecallUnknownSession
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import type { WorkshopRecallSessionSummary } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';

/** Newest first, the live room excluded, and one session per id. */
export function recallableSessions(
  listed: readonly WorkshopRecallSessionSummary[],
  liveSessionId: string
): WorkshopRecallSessionSummary[] {
  const seen = new Set<string>();
  return [...listed]
    .sort(newestFirst)
    .filter((session) => {
      if (session.sessionId === liveSessionId || seen.has(session.sessionId)) {
        return false;
      }
      seen.add(session.sessionId);
      return true;
    });
}

export function withParticipant(
  sessions: readonly WorkshopRecallSessionSummary[],
  personaId: WorkshopPersonaId | undefined
): readonly WorkshopRecallSessionSummary[] {
  return personaId === undefined
    ? sessions
    : sessions.filter((session) => session.participantPersonaIds.includes(personaId));
}

export function catalogSession(summary: WorkshopRecallSessionSummary): WorkshopRecallCatalogSession {
  // A saved file may repeat a participant; the codec accepts that (PR 126 re-review F-01).
  const participantPersonaIds = [...new Set(summary.participantPersonaIds)];
  return {
    sessionId: summary.sessionId,
    title: summary.title,
    savedAt: summary.savedAt ?? summary.updatedAt,
    timezone: summary.timezone,
    hostPersonaId: summary.hostPersonaId,
    host: workshopPersonaLabel(summary.hostPersonaId),
    participantPersonaIds,
    participants: participantPersonaIds.map(workshopPersonaLabel),
    ...(summary.scope !== undefined ? { scope: summary.scope } : {}),
    ...(summary.excerptLabel ? { excerptLabel: summary.excerptLabel } : {}),
    lastTurn: summary.turnCount
  };
}

export function unknownSession(sessionId: string, liveSessionId: string): WorkshopRecallUnknownSession {
  return {
    available: true,
    outcome: 'unknown-session',
    sessionId,
    liveSession: sessionId === liveSessionId
  };
}

/** Sort ascending and merge overlapping or adjacent ranges. */
export function normalizeTurnRanges(ranges: readonly WorkshopRecallTurnRange[]): WorkshopRecallTurnRange[] {
  for (const range of ranges) {
    if (!Number.isSafeInteger(range.from) || !Number.isSafeInteger(range.to) || range.from < 1 || range.to < range.from) {
      throw new Error(`Invalid session-recall turn range ${range.from}-${range.to}.`);
    }
  }
  const sorted = [...ranges].sort((left, right) => left.from - right.from || left.to - right.to);
  const merged: Array<{ from: number; to: number }> = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range.from <= last.to + 1) {
      last.to = Math.max(last.to, range.to);
    } else {
      merged.push({ from: range.from, to: range.to });
    }
  }
  return merged;
}

export function resolveRange(
  document: WorkshopRecallDocument,
  range: WorkshopRecallTurnRange
): WorkshopRecallReadRange {
  const entries = document.entries.filter(
    (entry) => entry.position >= range.from && entry.position <= range.to
  );
  return {
    from: range.from,
    to: range.to,
    entries,
    ...(entries.length > 0
      ? { firstTurnId: entries[0].turnId, lastTurnId: entries[entries.length - 1].turnId }
      : {})
  };
}

function newestFirst(left: WorkshopRecallSessionSummary, right: WorkshopRecallSessionSummary): number {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
    left.sessionId.localeCompare(right.sessionId);
}
