/**
 * Durable Workshop session envelope (ADR 2026-07-14).
 *
 * The product aggregate and provider-neutral conversation archive are captured
 * together. Runtime conversation ids, leading system prompts, global behavior,
 * and the Writer Profile are deliberately outside this contract.
 */

import {
  assertCurrentWorkshopSessionStateV1,
  parseWorkshopSessionStateV1,
  WorkshopConversationLogicalKey,
  WorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';
import {
  normalizeWorkshopSessionCheckpointForHydration,
  WorkshopSessionCheckpointNormalization
} from '@/application/services/workshop/WorkshopSessionCheckpointNormalization';
import {
  validateWorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1Integrity';
import type {
  WorkshopWidgetRecoveryNotice
} from '@/application/services/workshop/widgets/WorkshopWidgetCheckpointRecoveryContracts';
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
import {
  migrateWorkshopPersistedSessionV1ToV2,
  WORKSHOP_PERSISTED_SESSION_V1_TO_V2_MIGRATION,
  WorkshopPersistedSessionMigration
} from '@/application/services/workshop/WorkshopPersistedSessionV1ToV2Migration';

export const CURRENT_WORKSHOP_PERSISTED_SESSION_SCHEMA_VERSION = 2 as const;

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

interface WorkshopPersistedSessionData {
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

/** Released by v2.1.1 and retained only as migration input. */
export interface WorkshopPersistedSessionV1
  extends WorkshopPersistedSessionData {
  schemaVersion: 1;
}

/** Current durable Workshop session envelope written by v2.2.0. */
export interface WorkshopPersistedSessionV2
  extends WorkshopPersistedSessionData {
  schemaVersion: 2;
}

export interface WorkshopPersistedSessionCheckpointDecodeResult {
  session: WorkshopPersistedSessionV2;
  migrations: WorkshopPersistedSessionMigration[];
  normalizations: WorkshopSessionCheckpointNormalization[];
  recoveryNotices: WorkshopWidgetRecoveryNotice[];
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
export function decodeWorkshopPersistedSessionCheckpoint(
  value: unknown
): WorkshopPersistedSessionCheckpointDecodeResult {
  assertSupportedWorkshopPersistedSessionEnvelope(value);
  const migrations: WorkshopPersistedSessionMigration[] = [];
  const current = value.schemaVersion === 1
    ? migrateWorkshopPersistedSessionV1ToV2(value)
    : value;
  if (value.schemaVersion === 1) {
    migrations.push(WORKSHOP_PERSISTED_SESSION_V1_TO_V2_MIGRATION);
  }
  assertCurrentWorkshopPersistedSessionEnvelope(current);
  const checkpoint = parseWorkshopSessionStateV1(current.workshop);
  const recovery = normalizeWorkshopSessionCheckpointForHydration(checkpoint);
  assertCurrentWorkshopSessionStateV1(recovery.state);
  assertWorkshopPersistedSessionStateV2(recovery.state);
  validateWorkshopSessionStateV1(recovery.state);
  return {
    migrations,
    normalizations: recovery.normalizations,
    recoveryNotices: recovery.notices,
    session: decodeWorkshopPersistedSessionEnvelope(current, recovery.state)
  };
}

function assertSupportedWorkshopPersistedSessionEnvelope(
  value: unknown
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('Workshop session file must contain a JSON object.');
  }
  if (value.schemaVersion !== 1 && value.schemaVersion !== 2) {
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
}

function assertCurrentWorkshopPersistedSessionEnvelope(
  value: unknown
): asserts value is Record<string, unknown> {
  assertSupportedWorkshopPersistedSessionEnvelope(value);
  if (value.schemaVersion !== CURRENT_WORKSHOP_PERSISTED_SESSION_SCHEMA_VERSION) {
    throw new Error(`Unsupported Workshop session schema: ${String(value.schemaVersion)}`);
  }
}

function decodeWorkshopPersistedSessionEnvelope(
  value: Record<string, unknown>,
  workshop: WorkshopSessionStateV1
): WorkshopPersistedSessionV2 {
  return {
    schemaVersion: CURRENT_WORKSHOP_PERSISTED_SESSION_SCHEMA_VERSION,
    sessionId: value.sessionId as string,
    title: value.title as string,
    createdAt: normalizeTimestamp(value.createdAt as string),
    updatedAt: normalizeTimestamp(value.updatedAt as string),
    ...(value.savedAt !== undefined
      ? { savedAt: normalizeTimestamp(value.savedAt as string) }
      : {}),
    temporal: parseWorkshopSessionTemporalStateV1(value.temporal),
    summary: parseSummary(value.summary),
    workshop,
    conversations: clonePersistedJson(value.conversations, 'conversations') as
      ConversationArchiveEntryV1<WorkshopConversationLogicalKey>[]
  };
}

/** Strict current-state parser used by writes and already-canonical callers. */
export function parseWorkshopPersistedSession(value: unknown): WorkshopPersistedSessionV2 {
  assertCurrentWorkshopPersistedSessionEnvelope(value);
  const workshop = parseWorkshopSessionStateV1(value.workshop);
  assertCurrentWorkshopSessionStateV1(workshop);
  assertWorkshopPersistedSessionStateV2(workshop);
  validateWorkshopSessionStateV1(workshop);
  return decodeWorkshopPersistedSessionEnvelope(value, workshop);
}

function assertWorkshopPersistedSessionStateV2(
  state: WorkshopSessionStateV1
): void {
  if (
    state.counters.widgetConfig === undefined
    || state.counters.standingDirective === undefined
    || state.widgetConfigs === undefined
    || state.standingDirectives === undefined
    || state.threadArtifacts === undefined
  ) {
    throw new Error('Workshop session schema V2 is missing persisted widget state.');
  }
}
