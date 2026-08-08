/**
 * Development-checkpoint normalization for the evolving, unreleased Workshop
 * codec. It accepts narrowly named pre-release shape drift and returns the
 * current in-memory V1 shape. This is deliberately not a version migration:
 * formal released-codec migrations are introduced only when a Marketplace
 * release changes the persisted contract.
 */

import type {
  WorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';
import {
  recoverWorkshopWidgetConfigCheckpoint,
  WorkshopWidgetCheckpointNormalization
} from '@/application/services/workshop/widgets/WorkshopWidgetPersistenceLifecycle';
import type {
  WorkshopWidgetRecoveryNotice
} from '@/application/services/workshop/widgets/WorkshopWidgetCheckpointRecoveryContracts';

export type WorkshopSessionCheckpointNormalization =
  | 'discarded-legacy-scope-transition'
  | 'discarded-legacy-delivery-cursors'
  | 'inferred-missing-scope'
  | 'normalized-null-scope-with-excerpt'
  | 'normalized-open-session-with-excerpt'
  | 'restored-undelivered-withdrawal'
  | 'defaulted-capability-principal'
  | 'defaulted-proactive-assistance'
  | WorkshopWidgetCheckpointNormalization
  | 'headed-missing-room-offsets';

export interface WorkshopSessionCheckpointNormalizationResult {
  state: WorkshopSessionStateV1;
  normalizations: WorkshopSessionCheckpointNormalization[];
  notices: WorkshopWidgetRecoveryNotice[];
}

export function normalizeWorkshopSessionCheckpointForHydration(
  state: WorkshopSessionStateV1
): WorkshopSessionCheckpointNormalizationResult {
  const normalizations: WorkshopSessionCheckpointNormalization[] = [];
  const notices: WorkshopWidgetRecoveryNotice[] = [];
  const withdrawalNeverShipped =
    state.revisions.pendingExcerptWithdrawal === true
    && state.shelvedExcerpt !== undefined;
  const openSessionWithExcerpt =
    state.scope === 'open'
    && state.excerpt !== undefined;

  if (withdrawalNeverShipped) {
    normalizations.push('restored-undelivered-withdrawal');
  } else if (openSessionWithExcerpt) {
    normalizations.push('normalized-open-session-with-excerpt');
  }
  if (state.scope === undefined) {
    normalizations.push('inferred-missing-scope');
  }
  if (state.scope === null && state.excerpt !== undefined) {
    normalizations.push('normalized-null-scope-with-excerpt');
  }
  if (
    state.revisions.pendingExcerptChange !== undefined
    || state.revisions.pendingExcerptWithdrawal !== undefined
  ) {
    normalizations.push('discarded-legacy-scope-transition');
  }

  // Pre-13C capability artifacts carry no invoking principal. The host was
  // the sole possible invoker then, so stamping `host` records the truth —
  // and keeps ownership recoverable now that guests invoke too (ADR §2).
  let defaultedPrincipal = false;
  let defaultedProactiveAssistance = false;
  const turns = state.turns.map((turn) => {
    let normalizedTurn = turn;
    const behavior = turn.behavior;
    if (behavior && behavior.proactiveAssistance === undefined) {
      defaultedProactiveAssistance = true;
      normalizedTurn = {
        ...normalizedTurn,
        // Historical turns predate this permission and therefore could not
        // have exercised it. Preserve audit truth even though the live room
        // default for new/current behavior is intentionally on.
        behavior: { ...behavior, proactiveAssistance: false }
      };
    }
    if (!turn.capability || turn.capability.invokedBy !== undefined) {
      return normalizedTurn;
    }
    defaultedPrincipal = true;
    return {
      ...normalizedTurn,
      capability: { ...turn.capability, invokedBy: { kind: 'host' as const } }
    };
  });
  if (defaultedPrincipal) {
    normalizations.push('defaulted-capability-principal');
  }
  if (defaultedProactiveAssistance) {
    normalizations.push('defaulted-proactive-assistance');
  }

  const widgetConfigs = state.widgetConfigs?.map((config) => {
    const recovery = recoverWorkshopWidgetConfigCheckpoint(config);
    normalizations.push(...recovery.normalizations);
    notices.push(...recovery.notices);
    return recovery.config;
  });

  const ledgerHead = turns.at(-1)?.id;
  const discardedLegacyDeliveryCursors =
    state.participants.toolSidecars.some(
      (sidecar) => sidecar.deliveredToHostThroughTurnId !== undefined
    )
    || state.participants.personaGuests.some(
      (guest) =>
        guest.lastSeenHostTurnId !== undefined
        || guest.deliveredToHostThroughTurnId !== undefined
    );
  const headedMissingRoomOffsets =
    ledgerHead !== undefined
    && (
      state.participants.host.lastSeenRoomTurnId === undefined
      || state.participants.personaGuests.some(
        (guest) => guest.lastSeenRoomTurnId === undefined
      )
    );
  if (discardedLegacyDeliveryCursors) {
    normalizations.push('discarded-legacy-delivery-cursors');
  }
  if (headedMissingRoomOffsets) {
    normalizations.push('headed-missing-room-offsets');
  }

  const toolSidecars = state.participants.toolSidecars.map((sidecar) => {
    const {
      deliveredToHostThroughTurnId: _legacyDeliveryCursor,
      ...currentSidecar
    } = sidecar;
    return currentSidecar;
  });
  const personaGuests = state.participants.personaGuests.map((guest) => {
    const {
      lastSeenHostTurnId: _legacyHostCursor,
      deliveredToHostThroughTurnId: _legacyDeliveryCursor,
      ...currentGuest
    } = guest;
    return {
      ...currentGuest,
      lastSeenRoomTurnId: currentGuest.lastSeenRoomTurnId ?? ledgerHead
    };
  });
  const participants = {
    ...state.participants,
    host: {
      ...state.participants.host,
      lastSeenRoomTurnId:
        state.participants.host.lastSeenRoomTurnId ?? ledgerHead
    },
    toolSidecars,
    personaGuests
  };

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
      widgetConfigs,
      revisions,
      participants
    },
    normalizations: [...new Set(normalizations)],
    notices
  };
}
