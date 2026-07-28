/**
 * Durable Workshop session envelope (ADR 2026-07-14).
 *
 * The product aggregate and provider-neutral conversation archive are captured
 * together. Runtime conversation ids, leading system prompts, global behavior,
 * and the Writer Profile are deliberately outside this contract.
 */

import {
  parseWorkshopSessionStateV1,
  WorkshopConversationLogicalKey,
  WorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';
import {
  parseWorkshopSessionTemporalStateV1,
  WorkshopSessionTemporalStateV1
} from '@/application/services/workshop/WorkshopSessionTimeService';
import { ConversationArchiveEntryV1 } from '@orchestration/ConversationManager';
import { WorkshopPersonaId, WorkshopSessionScope, isWorkshopSessionScope } from '@messages';
import { isWorkshopPersonaId } from '@shared/constants/workshopPersonas';
import {
  exactKeys,
  isNonNegativeInteger,
  isRecord,
  isTimestamp,
  normalizeTimestamp
} from '@/application/services/workshop/persistedValidation';
import {
  clonePersistedJson
} from '@/application/services/workshop/persistedJson';

export interface WorkshopPersistedSummaryV1 {
  hostPersonaId: WorkshopPersonaId;
  /**
   * The session's scope (Sprint 13A §11), surfaced in restore/browser
   * metadata. Optional: rows written before scope existed have none, and the
   * browser says so rather than guessing.
   */
  scope?: WorkshopSessionScope;
  participantPersonaIds: WorkshopPersonaId[];
  turnCount: number;
  excerptWordCount: number;
  excerptLabel?: string;
  excerptIdentity?: string;
  preview?: string;
}

export interface WorkshopPersistedSessionV1 {
  schemaVersion: 1;
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** Present on named checkpoints; absent on rolling current state. */
  savedAt?: string;
  temporal: WorkshopSessionTemporalStateV1;
  summary: WorkshopPersistedSummaryV1;
  workshop: WorkshopSessionStateV1;
  conversations: ConversationArchiveEntryV1<WorkshopConversationLogicalKey>[];
}

function parseSummary(value: unknown): WorkshopPersistedSummaryV1 {
  if (!isRecord(value) || !isWorkshopPersonaId(value.hostPersonaId)) {
    throw new Error('Workshop session summary has an invalid host persona.');
  }
  exactKeys(
    value,
    'Workshop session summary',
    ['hostPersonaId', 'participantPersonaIds', 'turnCount', 'excerptWordCount'],
    ['scope', 'excerptLabel', 'excerptIdentity', 'preview']
  );
  if (value.scope !== undefined && !isWorkshopSessionScope(value.scope)) {
    throw new Error('Workshop session summary has an invalid scope.');
  }
  if (
    !Array.isArray(value.participantPersonaIds) ||
    value.participantPersonaIds.some((personaId) => !isWorkshopPersonaId(personaId))
  ) {
    throw new Error('Workshop session summary has invalid participant personas.');
  }
  if (!isNonNegativeInteger(value.turnCount) || !isNonNegativeInteger(value.excerptWordCount)) {
    throw new Error('Workshop session summary has invalid counts.');
  }
  for (const key of ['excerptLabel', 'excerptIdentity', 'preview'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'string') {
      throw new Error(`Workshop session summary has an invalid ${key}.`);
    }
  }
  const excerptLabel = value.excerptLabel;
  const excerptIdentity = value.excerptIdentity;
  const preview = value.preview;
  return {
    hostPersonaId: value.hostPersonaId,
    participantPersonaIds: [...value.participantPersonaIds] as WorkshopPersonaId[],
    turnCount: value.turnCount as number,
    excerptWordCount: value.excerptWordCount as number,
    ...(value.scope !== undefined ? { scope: value.scope as WorkshopSessionScope } : {}),
    ...(typeof excerptLabel === 'string' ? { excerptLabel } : {}),
    ...(typeof excerptIdentity === 'string' ? { excerptIdentity } : {}),
    ...(typeof preview === 'string' ? { preview } : {})
  };
}

/**
 * Decode the stable outer envelope into a defensive normalized clone. Product
 * and temporal state preflight here; each conversation archive entry still
 * performs its own validation during import so corruption degrades locally.
 */
export function parseWorkshopPersistedSession(value: unknown): WorkshopPersistedSessionV1 {
  if (!isRecord(value)) {
    throw new Error('Workshop session file must contain a JSON object.');
  }
  if (value.schemaVersion !== 1) {
    throw new Error(`Unsupported Workshop session schema: ${String(value.schemaVersion)}`);
  }
  exactKeys(
    value,
    'Workshop session file',
    [
      'schemaVersion',
      'sessionId',
      'title',
      'createdAt',
      'updatedAt',
      'temporal',
      'summary',
      'workshop',
      'conversations'
    ],
    ['savedAt']
  );
  if (typeof value.sessionId !== 'string' || value.sessionId.trim().length === 0) {
    throw new Error('Workshop session id must be a non-empty string.');
  }
  if (typeof value.title !== 'string' || value.title.trim().length === 0) {
    throw new Error('Workshop session title must be a non-empty string.');
  }
  if (!isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt)) {
    throw new Error('Workshop session file has invalid creation/activity timestamps.');
  }
  if (value.savedAt !== undefined && !isTimestamp(value.savedAt)) {
    throw new Error('Workshop session file has an invalid savedAt timestamp.');
  }
  if (!Array.isArray(value.conversations)) {
    throw new Error('Workshop session file has invalid conversation archive.');
  }

  return {
    schemaVersion: 1,
    sessionId: value.sessionId,
    title: value.title,
    createdAt: normalizeTimestamp(value.createdAt),
    updatedAt: normalizeTimestamp(value.updatedAt),
    ...(value.savedAt !== undefined
      ? { savedAt: normalizeTimestamp(value.savedAt) }
      : {}),
    temporal: parseWorkshopSessionTemporalStateV1(value.temporal),
    summary: parseSummary(value.summary),
    workshop: parseWorkshopSessionStateV1(value.workshop),
    conversations: clonePersistedJson(value.conversations, 'conversations') as
      ConversationArchiveEntryV1<WorkshopConversationLogicalKey>[]
  };
}
