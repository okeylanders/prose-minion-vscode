/**
 * Public Workshop session migration for the first Conversation Widgets release.
 *
 * Released V1 checkpoints predate persisted widget state. This adjacent
 * migration initializes only the structural defaults introduced by V2. It
 * deliberately preserves any already-present development fields so the
 * separate checkpoint normalizer and current integrity validator remain the
 * only owners of beta compatibility and feature semantics.
 */

import { clonePersistedJson } from '@/application/services/workshop/persistedJson';
import { isRecord } from '@/application/services/workshop/persistedValidation';

export const WORKSHOP_PERSISTED_SESSION_V1_TO_V2_MIGRATION = 'v1-to-v2' as const;

export type WorkshopPersistedSessionMigration =
  typeof WORKSHOP_PERSISTED_SESSION_V1_TO_V2_MIGRATION;

export function migrateWorkshopPersistedSessionV1ToV2(
  value: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const migrated = clonePersistedJson(value, 'Workshop session V1');
  const workshop = migrated.workshop;
  if (!isRecord(workshop)) {
    // Preserve malformed input for the current shape validator to reject with
    // its ordinary field-specific diagnostic. A migration is not a repairer.
    return { ...migrated, schemaVersion: 2 };
  }

  const counters = workshop.counters;
  const migratedCounters = isRecord(counters)
    ? {
        ...counters,
        ...(counters.widgetConfig === undefined ? { widgetConfig: 0 } : {}),
        ...(counters.standingDirective === undefined ? { standingDirective: 0 } : {})
      }
    : counters;

  return {
    ...migrated,
    schemaVersion: 2,
    workshop: {
      ...workshop,
      counters: migratedCounters,
      ...(workshop.widgetConfigs === undefined ? { widgetConfigs: [] } : {}),
      ...(workshop.standingDirectives === undefined ? { standingDirectives: [] } : {}),
      ...(workshop.threadArtifacts === undefined ? { threadArtifacts: [] } : {})
    }
  };
}
