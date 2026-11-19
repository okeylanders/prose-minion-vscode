/**
 * A persona's context-paths proposal as a card under its reply (ADR
 * 2026-11-19 D23, D24, D27), and the writer's Apply.
 *
 * - **`locationsProposal`** is optional and additive on a host or guest
 *   reply: the checker's view, each group's value as read when it was
 *   checked (the baseline Apply compares), the patterns Apply would write
 *   for each offered group, and its state. `pending` until the writer
 *   answers; then one answer per offered group: `applied`, `left` with its
 *   reason, or `declined` (offered and not ticked).
 * - **Apply posts ids only:** `requestId`, `roomRevision`, `turnId` and the
 *   groups ticked, never a pattern. No group ticked declines the card.
 */

import { MessageEnvelope, MessageType } from '../base';
import type { ContextPathGroup } from '../../context';
import type { ContextPathGroupApplyOutcome, ContextPathProposalView } from '../contextPathSuggestions';

/** One offered group's answer: Apply's outcome, or `declined` when the writer left it unticked. */
export type WorkshopLocationsGroupAnswer =
  | ContextPathGroupApplyOutcome
  | { group: ContextPathGroup; outcome: 'declined' };

export interface WorkshopLocationsProposalCard {
  view: ContextPathProposalView;
  /** Each group's value as read when the card was checked. */
  baselines: Record<ContextPathGroup, string>;
  /** The patterns Apply writes, for each group offered. */
  kept: Partial<Record<ContextPathGroup, string[]>>;
  state: 'pending' | 'answered';
  /** Present once answered: one per offered group, in group order. */
  answers?: WorkshopLocationsGroupAnswer[];
}

export interface WorkshopApplyLocationsProposalPayload {
  requestId: string;
  roomRevision: number;
  turnId: string;
  /** The groups ticked; none declines the card. Never a pattern. */
  groups: ContextPathGroup[];
}

export interface WorkshopApplyLocationsProposalMessage extends MessageEnvelope<WorkshopApplyLocationsProposalPayload> {
  type: MessageType.WORKSHOP_APPLY_LOCATIONS_PROPOSAL;
}

export type WorkshopLocationsProposalResultOutcome =
  /** The card is answered: `groups` says what each offered group came to. */
  | 'done'
  /** Another room is open now: nothing was written. */
  | 'room-changed'
  /** No pending card on that turn. */
  | 'unknown-card'
  /** The card was answered already. */
  | 'answered'
  /** An Apply on the card is still running. */
  | 'busy'
  /** Context paths can't be applied here. */
  | 'unavailable';

export interface WorkshopLocationsProposalResultPayload {
  requestId: string;
  turnId: string;
  outcome: WorkshopLocationsProposalResultOutcome;
  groups: WorkshopLocationsGroupAnswer[];
}

export interface WorkshopLocationsProposalResultMessage extends MessageEnvelope<WorkshopLocationsProposalResultPayload> {
  type: MessageType.WORKSHOP_LOCATIONS_PROPOSAL_RESULT;
}
