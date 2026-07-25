/**
 * One-way compatibility normalization for checkpoints written before Workshop
 * scope became immutable. Current code cannot write these states; saved writer
 * sessions may still contain them.
 */

import type {
  WorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';

export type WorkshopSessionHydrationMigration =
  | 'discarded-legacy-scope-transition'
  | 'inferred-missing-scope'
  | 'normalized-open-session-with-excerpt'
  | 'restored-undelivered-withdrawal';

export interface WorkshopSessionStateV1MigrationResult {
  state: WorkshopSessionStateV1;
  migrations: WorkshopSessionHydrationMigration[];
}

export function migrateWorkshopSessionStateV1ForHydration(
  state: WorkshopSessionStateV1
): WorkshopSessionStateV1MigrationResult {
  const migrations: WorkshopSessionHydrationMigration[] = [];
  const withdrawalNeverShipped =
    state.revisions.pendingExcerptWithdrawal === true
    && state.shelvedExcerpt !== undefined;
  const openSessionWithExcerpt =
    state.scope === 'open'
    && state.excerpt !== undefined;

  if (withdrawalNeverShipped) {
    migrations.push('restored-undelivered-withdrawal');
  } else if (openSessionWithExcerpt) {
    migrations.push('normalized-open-session-with-excerpt');
  }
  if (state.scope === undefined) {
    migrations.push('inferred-missing-scope');
  }
  if (
    state.revisions.pendingExcerptChange !== undefined
    || state.revisions.pendingExcerptWithdrawal !== undefined
  ) {
    migrations.push('discarded-legacy-scope-transition');
  }

  const excerpt = withdrawalNeverShipped
    ? state.shelvedExcerpt
    : state.excerpt;
  const shelvedExcerpt = withdrawalNeverShipped
    ? undefined
    : state.shelvedExcerpt;
  const scope = withdrawalNeverShipped || openSessionWithExcerpt
    ? 'excerpt'
    : state.scope ?? (excerpt ? 'excerpt' : null);
  const revisions = { ...state.revisions };
  delete revisions.pendingExcerptChange;
  delete revisions.pendingExcerptWithdrawal;

  return {
    state: {
      ...state,
      excerpt,
      scope,
      shelvedExcerpt,
      revisions
    },
    migrations
  };
}
