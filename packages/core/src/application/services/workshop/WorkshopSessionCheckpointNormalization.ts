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
  normalizeWorkshopWidgetConfigForHydration,
  WorkshopWidgetCheckpointNormalization
} from '@/application/services/workshop/widgets/WorkshopWidgetPersistenceLifecycle';
import type {
  WorkshopWidgetRecoveryNotice
} from '@/application/services/workshop/widgets/WorkshopWidgetCheckpointRecoveryContracts';
import {
  findInconsistentRetainedHistoryMarkKeys,
  withoutRetainedHistoryMarkKeys
} from '@/application/services/workshop/session/WorkshopRetainedHistoryMarks';
import { listLegacyWorkshopMemoryProposal } from '@/application/services/workshop/session/WorkshopMemoryProposalRecords';
import { repairPendingLightboxTiles } from '@/application/services/workshop/WorkshopMessageAttachmentIdentity';
import {
  danglingWorkshopBookmarks,
  workshopBookmarksWithin
} from '@/application/services/workshop/session/WorkshopBookmarkRecords';
import {
  danglingWorkshopReactions,
  workshopReactionsWithin
} from '@/application/services/workshop/session/WorkshopReactionRecords';

export type WorkshopSessionCheckpointNormalization =
  | 'discarded-legacy-scope-transition'
  | 'discarded-legacy-delivery-cursors'
  | 'inferred-missing-scope'
  | 'normalized-null-scope-with-excerpt'
  | 'normalized-open-session-with-excerpt'
  | 'restored-undelivered-withdrawal'
  | 'defaulted-capability-principal'
  | 'defaulted-proactive-assistance'
  | 'discarded-nonpersona-widget-recommendation'
  | WorkshopWidgetCheckpointNormalization
  | 'headed-missing-room-offsets'
  // Lightbox Slice 4 development checkpoints (PR #151 F-01): a rewind could
  // restage a tile beside a copy already waiting, without its source key.
  | 'dropped-duplicate-pending-lightbox-tiles'
  | 'restored-lightbox-tile-source-keys'
  // Not development drift: ADR 2026-09-30 §3 degrades a mark that cannot be
  // trusted by dropping its key's marks, so it can never refuse a session.
  | 'dropped-inconsistent-retained-history-marks'
  | 'dropped-unverifiable-retained-history-marks'
  // Workshop Wayfinding Slice 4 (ADR 2026-11-03 D9): a bookmark whose turn is
  // gone marks nothing, so it goes rather than refusing the session.
  | 'dropped-dangling-bookmarks'
  // Message Reactions Slice 1 (ADR 2026-11-07 D2): a reaction whose turn, or
  // whose carrying reply, is gone marks nothing, so it goes.
  | 'dropped-dangling-reactions'
  // Project Memory Slice 6b: a development checkpoint's single memory card
  // (`memoryProposal`) becomes the only item of `memoryProposals`.
  | 'listed-single-memory-proposal';

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
  let discardedNonpersonaWidgetRecommendation = false;
  let listedSingleMemoryProposal = false;
  const turns = state.turns.map((checkpointTurn) => {
    const turn = listLegacyWorkshopMemoryProposal(checkpointTurn);
    listedSingleMemoryProposal ||= turn !== checkpointTurn;
    let normalizedTurn = turn;
    if (
      turn.widgetRecommendation !== undefined
      && turn.participant !== 'host'
      && turn.participant !== 'guest'
    ) {
      const {
        widgetRecommendation: _discardedRecommendation,
        ...turnWithoutRecommendation
      } = normalizedTurn;
      normalizedTurn = turnWithoutRecommendation;
      discardedNonpersonaWidgetRecommendation = true;
    }
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
  if (discardedNonpersonaWidgetRecommendation) {
    normalizations.push('discarded-nonpersona-widget-recommendation');
  }
  if (listedSingleMemoryProposal) {
    normalizations.push('listed-single-memory-proposal');
  }

  const widgetConfigs = state.widgetConfigs?.map((config) => {
    const recovery = normalizeWorkshopWidgetConfigForHydration(config);
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
  // A restored participant starts current rather than replaying the room
  // (ADR 2026-07-24 §12). A participant with no retained conversation — an
  // unbound host, a disposed guest — has read nothing: an absent offset is
  // its truth, and heading it would withhold the catch-up a fresh participant
  // needs (ADR 2026-09-30, Sprint 02 implementation findings).
  const hostRetainsConversation = state.participants.host.conversationKey === 'host';
  const guestRetainsConversation = (
    guest: WorkshopSessionStateV1['participants']['personaGuests'][number]
  ): boolean => guest.liveness === 'live' && guest.conversationKey !== undefined;
  const headedMissingRoomOffsets =
    ledgerHead !== undefined
    && (
      (hostRetainsConversation && state.participants.host.lastSeenRoomTurnId === undefined)
      || state.participants.personaGuests.some(
        (guest) => guestRetainsConversation(guest) && guest.lastSeenRoomTurnId === undefined
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
      lastSeenRoomTurnId: guestRetainsConversation(currentGuest)
        ? currentGuest.lastSeenRoomTurnId ?? ledgerHead
        : currentGuest.lastSeenRoomTurnId
    };
  });
  const participants = {
    ...state.participants,
    host: {
      ...state.participants.host,
      lastSeenRoomTurnId: hostRetainsConversation
        ? state.participants.host.lastSeenRoomTurnId ?? ledgerHead
        : state.participants.host.lastSeenRoomTurnId
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

  const pendingTiles = repairPendingLightboxTiles(state.pendingMessageAttachments);
  if (pendingTiles.droppedDuplicates) {
    normalizations.push('dropped-duplicate-pending-lightbox-tiles');
  }
  if (pendingTiles.restoredKeys) {
    normalizations.push('restored-lightbox-tile-source-keys');
  }

  const danglingBookmarks = danglingWorkshopBookmarks(state.bookmarks, turns);
  if (danglingBookmarks.length > 0) {
    normalizations.push('dropped-dangling-bookmarks');
  }

  const danglingReactions = danglingWorkshopReactions(state.reactions, turns);
  if (danglingReactions.length > 0) {
    normalizations.push('dropped-dangling-reactions');
  }

  const normalized: WorkshopSessionStateV1 = {
    ...state,
    ...(danglingReactions.length > 0
      ? { reactions: workshopReactionsWithin(state.reactions, new Set(turns.map((turn) => turn.id))) }
      : {}),
    ...(danglingBookmarks.length > 0
      ? { bookmarks: workshopBookmarksWithin(state.bookmarks, new Set(turns.map((turn) => turn.id))) }
      : {}),
    pendingMessageAttachments: pendingTiles.pending,
    turns,
    excerpt,
    scope,
    shelvedExcerpt,
    widgetConfigs,
    revisions,
    participants
  };
  // Runs last, against the normalized participants and turns it must agree
  // with. A key is judged whole: one untrustworthy mark discards the key.
  const inconsistentMarkKeys = findInconsistentRetainedHistoryMarkKeys(normalized);
  if (inconsistentMarkKeys.size > 0) {
    normalizations.push('dropped-inconsistent-retained-history-marks');
  }

  return {
    state: withoutRetainedHistoryMarkKeys(normalized, inconsistentMarkKeys),
    normalizations: [...new Set(normalizations)],
    notices
  };
}
