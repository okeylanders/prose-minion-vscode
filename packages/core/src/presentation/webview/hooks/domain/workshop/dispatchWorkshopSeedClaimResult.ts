/**
 * Seed delivery's claim results, routed by seed kind (PR #150 F-03; Lightbox
 * Slice 4). One kind's result never reaches another kind's receiver: each
 * receiver holds its own claim, and the closed `Record` makes a new kind
 * name its receiver here.
 */

import type { WorkshopSeedClaimResultMessage, WorkshopSeedKind } from '@messages';

export type WorkshopSeedClaimResultReceivers = Readonly<
  Record<WorkshopSeedKind, (message: WorkshopSeedClaimResultMessage) => void>
>;

export function dispatchWorkshopSeedClaimResult(
  message: WorkshopSeedClaimResultMessage,
  receivers: WorkshopSeedClaimResultReceivers
): void {
  const kind = message.payload?.kind;
  if (typeof kind === 'string' && Object.prototype.hasOwnProperty.call(receivers, kind)) {
    receivers[kind](message);
  }
}
