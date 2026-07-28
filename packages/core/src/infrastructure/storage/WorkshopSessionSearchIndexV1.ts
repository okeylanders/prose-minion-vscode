/**
 * Compact, schema-versioned browser index for Workshop session snapshots.
 *
 * The full session remains authoritative. This codec owns only the bounded
 * read model used to list and identify saved rooms without parsing transcripts.
 */

import {
  WorkshopPersistedSessionV1,
  WorkshopPersistedSummaryV1
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopPersonaId, WorkshopSessionScope, isWorkshopSessionScope } from '@messages';
import { isWorkshopPersonaId } from '@shared/constants/workshopPersonas';
import {
  assertTimezone,
  exactKeys,
  isNonNegativeInteger,
  isRecord,
  isTimestamp,
  normalizeTimestamp
} from '@/application/services/workshop/persistedValidation';

export interface WorkshopStoredSessionSummary {
  /** Durable envelope identity; safe to send back in typed IPC. Never a path. */
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  savedAt?: string;
  startedAt: string;
  timezone: string;
  hostPersonaId: WorkshopPersistedSessionV1['summary']['hostPersonaId'];
  participantPersonaIds: WorkshopPersistedSessionV1['summary']['participantPersonaIds'];
  turnCount: number;
  excerptWordCount: number;
  /** The session's scope (Sprint 13A); absent on rows written before it existed. */
  scope?: WorkshopPersistedSummaryV1['scope'];
  excerptLabel?: string;
  excerptIdentity?: string;
  preview?: string;
  /** Storage identity for diagnostic display only; never an absolute path. */
  fileName: string;
}

export interface WorkshopSessionSearchIndexV1 {
  schemaVersion: 1;
  fileName: string;
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  savedAt?: string;
  startedAt: string;
  timezone: string;
  summary: WorkshopPersistedSummaryV1;
}

export function workshopStoredSessionSummary(
  session: WorkshopPersistedSessionV1,
  fileName: string
): WorkshopStoredSessionSummary {
  return workshopStoredSummaryFromSearchIndex(buildWorkshopSessionSearchIndexV1(session, fileName));
}

export function buildWorkshopSessionSearchIndexV1(
  session: WorkshopPersistedSessionV1,
  fileName: string
): WorkshopSessionSearchIndexV1 {
  return {
    schemaVersion: 1,
    fileName,
    sessionId: session.sessionId,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    ...(session.savedAt ? { savedAt: session.savedAt } : {}),
    startedAt: session.temporal.startedAt,
    timezone: session.temporal.timezone,
    summary: {
      hostPersonaId: session.summary.hostPersonaId,
      participantPersonaIds: [...session.summary.participantPersonaIds],
      turnCount: session.summary.turnCount,
      excerptWordCount: session.summary.excerptWordCount,
      ...(session.summary.scope !== undefined ? { scope: session.summary.scope } : {}),
      ...(session.summary.excerptLabel ? { excerptLabel: session.summary.excerptLabel } : {}),
      ...(session.summary.excerptIdentity ? { excerptIdentity: session.summary.excerptIdentity } : {}),
      ...(session.summary.preview ? { preview: session.summary.preview } : {})
    }
  };
}

export function workshopStoredSummaryFromSearchIndex(
  searchIndex: WorkshopSessionSearchIndexV1
): WorkshopStoredSessionSummary {
  return {
    sessionId: searchIndex.sessionId,
    title: searchIndex.title,
    createdAt: searchIndex.createdAt,
    updatedAt: searchIndex.updatedAt,
    ...(searchIndex.savedAt ? { savedAt: searchIndex.savedAt } : {}),
    startedAt: searchIndex.startedAt,
    timezone: searchIndex.timezone,
    hostPersonaId: searchIndex.summary.hostPersonaId,
    participantPersonaIds: [...searchIndex.summary.participantPersonaIds],
    turnCount: searchIndex.summary.turnCount,
    excerptWordCount: searchIndex.summary.excerptWordCount,
    ...(searchIndex.summary.scope !== undefined ? { scope: searchIndex.summary.scope } : {}),
    ...(searchIndex.summary.excerptLabel ? { excerptLabel: searchIndex.summary.excerptLabel } : {}),
    ...(searchIndex.summary.excerptIdentity ? { excerptIdentity: searchIndex.summary.excerptIdentity } : {}),
    ...(searchIndex.summary.preview ? { preview: searchIndex.summary.preview } : {}),
    fileName: searchIndex.fileName
  };
}

export function workshopSessionSearchIndexFileName(fullFileName: string): string {
  if (fullFileName === 'current.json') {
    return 'current.summary.json';
  }
  return `${fullFileName.slice(0, -'.json'.length)}.summary.json`;
}

export function parseWorkshopSessionSearchIndexV1(
  value: unknown,
  expectedFileName: string
): WorkshopSessionSearchIndexV1 {
  if (!isRecord(value)) {
    throw new Error('Workshop session search index must contain a JSON object.');
  }
  exactKeys(
    value,
    'Workshop session search index',
    [
      'schemaVersion',
      'fileName',
      'sessionId',
      'title',
      'createdAt',
      'updatedAt',
      'startedAt',
      'timezone',
      'summary'
    ],
    ['savedAt']
  );
  if (value.schemaVersion !== 1) {
    throw new Error(
      `Unsupported Workshop session search-index schema: ${String(value.schemaVersion)}`
    );
  }
  if (value.fileName !== expectedFileName) {
    throw new Error('Workshop session search index belongs to a different snapshot.');
  }
  for (const key of ['sessionId', 'title', 'createdAt', 'updatedAt', 'startedAt', 'timezone'] as const) {
    if (typeof value[key] !== 'string' || value[key].trim().length === 0) {
      throw new Error(`Workshop session search index has an invalid ${key}.`);
    }
  }
  for (const key of ['createdAt', 'updatedAt', 'startedAt'] as const) {
    if (!isTimestamp(value[key])) {
      throw new Error(`Workshop session search index has an invalid ${key}.`);
    }
  }
  if (value.savedAt !== undefined && !isTimestamp(value.savedAt)) {
    throw new Error('Workshop session search index has an invalid savedAt.');
  }
  const sessionId = value.sessionId as string;
  const title = value.title as string;
  const createdAt = value.createdAt as string;
  const updatedAt = value.updatedAt as string;
  const startedAt = value.startedAt as string;
  const timezone = value.timezone as string;
  const savedAt = value.savedAt as string | undefined;
  assertTimezone(timezone);
  const summary = parseWorkshopSessionSearchIndexSummary(value.summary);
  return {
    schemaVersion: 1,
    fileName: expectedFileName,
    sessionId,
    title,
    createdAt: normalizeTimestamp(createdAt),
    updatedAt: normalizeTimestamp(updatedAt),
    ...(savedAt !== undefined ? { savedAt: normalizeTimestamp(savedAt) } : {}),
    startedAt: normalizeTimestamp(startedAt),
    timezone,
    summary
  };
}

function parseWorkshopSessionSearchIndexSummary(value: unknown): WorkshopPersistedSummaryV1 {
  if (!isRecord(value)) {
    throw new Error('Workshop session search index has an invalid summary.');
  }
  exactKeys(
    value,
    'Workshop session search index summary',
    ['hostPersonaId', 'participantPersonaIds', 'turnCount', 'excerptWordCount'],
    ['scope', 'excerptLabel', 'excerptIdentity', 'preview']
  );
  if (!isWorkshopPersonaId(value.hostPersonaId)) {
    throw new Error('Workshop session search index has an invalid host persona.');
  }
  if (!Array.isArray(value.participantPersonaIds) || value.participantPersonaIds.some(
    (personaId) => !isWorkshopPersonaId(personaId)
  )) {
    throw new Error('Workshop session search index has invalid participant personas.');
  }
  if (!isNonNegativeInteger(value.turnCount) || !isNonNegativeInteger(value.excerptWordCount)) {
    throw new Error('Workshop session search index has invalid counts.');
  }
  if (value.scope !== undefined && !isWorkshopSessionScope(value.scope)) {
    throw new Error('Workshop session search index has an invalid scope.');
  }
  for (const key of ['excerptLabel', 'excerptIdentity', 'preview'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'string') {
      throw new Error(`Workshop session search index has an invalid ${key}.`);
    }
  }
  return {
    hostPersonaId: value.hostPersonaId as WorkshopPersonaId,
    participantPersonaIds: [...value.participantPersonaIds] as WorkshopPersonaId[],
    turnCount: value.turnCount,
    excerptWordCount: value.excerptWordCount,
    ...(value.scope !== undefined ? { scope: value.scope as WorkshopSessionScope } : {}),
    ...(typeof value.excerptLabel === 'string' ? { excerptLabel: value.excerptLabel } : {}),
    ...(typeof value.excerptIdentity === 'string' ? { excerptIdentity: value.excerptIdentity } : {}),
    ...(typeof value.preview === 'string' ? { preview: value.preview } : {})
  };
}
