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
} from './WorkshopSessionService';
import {
  parseWorkshopSessionTemporalStateV1,
  WorkshopSessionTemporalStateV1
} from './WorkshopSessionTimeService';
import { ConversationArchiveEntryV1 } from '@orchestration/ConversationManager';
import { WorkshopPersonaId } from '@messages';
import { isWorkshopPersonaId } from '@shared/constants/workshopPersonas';

export interface WorkshopPersistedSummaryV1 {
  hostPersonaId: WorkshopPersonaId;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

const isNonNegativeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

const normalizeTimestamp = (value: string): string => new Date(value).toISOString();

function exactKeys(
  value: Record<string, unknown>,
  label: string,
  required: readonly string[],
  optional: readonly string[] = []
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} contains unknown field ${key}.`);
    }
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(`${label} is missing required field ${key}.`);
    }
  }
}

function parseSummary(value: unknown): WorkshopPersistedSummaryV1 {
  if (!isRecord(value) || !isWorkshopPersonaId(value.hostPersonaId)) {
    throw new Error('Workshop session summary has an invalid host persona.');
  }
  exactKeys(
    value,
    'Workshop session summary',
    ['hostPersonaId', 'participantPersonaIds', 'turnCount', 'excerptWordCount'],
    ['excerptLabel', 'excerptIdentity', 'preview']
  );
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
    ...(typeof excerptLabel === 'string' ? { excerptLabel } : {}),
    ...(typeof excerptIdentity === 'string' ? { excerptIdentity } : {}),
    ...(typeof preview === 'string' ? { preview } : {})
  };
}

/**
 * Conversation entries intentionally validate independently during import so a
 * malformed participant can degrade without bricking the product aggregate.
 * This boundary still returns a defensive JSON clone and rejects values that
 * could not have come from a persisted JSON document.
 */
function cloneConversationJson(value: unknown, path = 'conversations'): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Workshop session ${path} contains a non-finite number.`);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => cloneConversationJson(entry, `${path}[${index}]`));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        cloneConversationJson(entry, `${path}.${key}`)
      ])
    );
  }
  throw new Error(`Workshop session ${path} contains a non-JSON value.`);
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
    conversations: cloneConversationJson(value.conversations) as
      ConversationArchiveEntryV1<WorkshopConversationLogicalKey>[]
  };
}
