/**
 * One-way compatibility normalization for checkpoints written before Workshop
 * scope became immutable, and before capability artifacts persisted their
 * invoking principal (Sprint 13C). Current code cannot write these states;
 * saved writer sessions may still contain them.
 */

import type {
  WorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';

export type WorkshopSessionHydrationMigration =
  | 'discarded-legacy-scope-transition'
  | 'inferred-missing-scope'
  | 'normalized-open-session-with-excerpt'
  | 'restored-undelivered-withdrawal'
  | 'defaulted-capability-principal';

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

  // Pre-13C capability artifacts carry no invoking principal. The host was
  // the sole possible invoker then, so stamping `host` records the truth —
  // and keeps ownership recoverable now that guests invoke too (ADR §2).
  let defaultedPrincipal = false;
  const turns = state.turns.map((turn) => {
    if (!turn.capability || turn.capability.invokedBy !== undefined) {
      return turn;
    }
    defaultedPrincipal = true;
    return {
      ...turn,
      capability: { ...turn.capability, invokedBy: { kind: 'host' as const } }
    };
  });
  if (defaultedPrincipal) {
    migrations.push('defaulted-capability-principal');
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
      turns,
      excerpt,
      scope,
      shelvedExcerpt,
      revisions
    },
    migrations
  };
}
