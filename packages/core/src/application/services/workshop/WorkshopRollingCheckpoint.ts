/** Clean-cache provenance, separate from optimistic named-write authority. */
import { createHash } from 'crypto';
import {
  decodeWorkshopPersistedSessionCheckpoint,
  WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';

export function withoutRollingProvenance(session: WorkshopPersistedSessionV2): WorkshopPersistedSessionV2 {
  const { rollingCleanHash, ...checkpoint } = session;
  return checkpoint;
}

function contentHash(session: WorkshopPersistedSessionV2): string {
  const decoded = decodeWorkshopPersistedSessionCheckpoint(withoutRollingProvenance(session)).session;
  // Normalize JSON omission and property order before hashing; never ignore
  // timestamps, archives or any other content when proving a clean cache.
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(canonical);
    }
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, entry]) => [key, canonical(entry)]));
    }
    return value;
  };
  return createHash('sha256').update(JSON.stringify(canonical(JSON.parse(JSON.stringify(decoded))))).digest('hex');
}

export function cleanRollingCheckpoint(session: WorkshopPersistedSessionV2): WorkshopPersistedSessionV2 {
  return { ...withoutRollingProvenance(session), rollingCleanHash: contentHash(session) };
}

export function isCleanRollingCheckpoint(session: WorkshopPersistedSessionV2): boolean {
  return session.rollingCleanHash !== undefined && session.rollingCleanHash === contentHash(session);
}
