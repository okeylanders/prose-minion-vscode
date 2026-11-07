/**
 * Between a stored card and the gateway (ADR 2026-11-05 D8, D10; epic
 * Slice 4a). Pure.
 *
 * - **What is applied** is the host's stored card, never a request: its
 *   staged identity, class and baseline, and its operations
 *   (`workshopStagedFileEditOf`). A card refused at staging has none.
 * - **What an Apply leaves on the card** (`workshopFileEditSettlementOf`),
 *   by the gateway's state:
 *   - `applied`: every operation landed, with its landed record;
 *   - `partial`: by operation, with a record per landed one;
 *   - `unknown`: by operation (`unknown` where unknown, else `not-applied`),
 *     with its reason (`outcome-unknown` when the gateway gave none);
 *   - `stale` and `refused`: their reason, no outcomes (the codec's rule);
 *   - `declined` (a discarded review wrote nothing) and a refusal at the
 *     last boundary (`superseded`, `authority-changed`: nothing written)
 *     return the card to `pending`, so it can be applied again;
 *   - so do the transient refusals (`catalog-unreadable` at Apply,
 *     `host-failed`), which the gateway gives only when nothing was written
 *     (D8, amended 2026-11-06). Their reason is the answer's
 *     (`workshopFileEditRetryReasonOf`), never stored: a pending card holds
 *     no reason.
 */

import type { FileEditApplyOutcome, StagedFileEdit } from '@/domain/models/FileEdit';
import type { WorkshopFileEditOperationOutcome, WorkshopFileEditProposal } from '@messages';
import type { WorkshopFileEditSettlement } from '@/application/services/workshop/session/WorkshopFileEditProposalRecords';

/** Refusals at the last dispatch boundary: nothing was written, and the card may be applied again (D8.3). */
export const WORKSHOP_FILE_EDIT_BOUNDARY_REFUSALS: ReadonlySet<string> = new Set(['superseded', 'authority-changed']);

/**
 * Transient refusals: nothing was written, and the next Apply may succeed (Okey, 2026-11-06). The gateway gives
 * `host-failed` only before any `applyEdits`, or when the read-back found nothing landed; a failure that may follow a
 * landing reads `unknown`.
 */
export const WORKSHOP_FILE_EDIT_TRANSIENT_REFUSALS: ReadonlySet<string> = new Set(['catalog-unreadable', 'host-failed']);

/** The reason an `unknown` card carries when the gateway gave none. */
export const WORKSHOP_FILE_EDIT_UNKNOWN_REASON = 'outcome-unknown';

export function workshopStagedFileEditOf(turnId: string, index: number, proposal: WorkshopFileEditProposal): StagedFileEdit | undefined {
  const { target, baseline } = proposal;
  if (!target?.documentUri || !proposal.class || !baseline) {
    return undefined;
  }
  return {
    target: { kind: target.kind, documentUri: target.documentUri, relativePath: target.relativePath },
    class: proposal.class,
    baseline: { sha256: baseline.sha256, length: baseline.length },
    operations: proposal.operations.map((operation) => ({ ...operation })),
    source: { kind: 'proposal', turnId, index }
  };
}

export function workshopFileEditSettlementOf(outcome: FileEditApplyOutcome): WorkshopFileEditSettlement {
  const outcomes = (): WorkshopFileEditOperationOutcome[] => outcome.operations.map(({ outcome: each }) =>
    each === 'landed' ? 'landed' : each === 'unknown' ? 'unknown' : 'not-applied');
  switch (outcome.state) {
    case 'applied':
    case 'partial':
      return {
        state: outcome.state,
        ...(outcome.reason ? { reason: outcome.reason } : {}),
        outcomes: outcomes(),
        ...(outcome.landed?.length ? { landed: outcome.landed } : {})
      };
    case 'unknown':
      return { state: 'unknown', reason: outcome.reason ?? WORKSHOP_FILE_EDIT_UNKNOWN_REASON, outcomes: outcomes() };
    case 'declined':
      return { state: 'pending' };
    case 'stale':
      return { state: 'stale', ...(outcome.reason ? { reason: outcome.reason } : {}) };
    case 'refused':
      return returnsToPending(outcome.reason)
        ? { state: 'pending' }
        : { state: 'refused', reason: outcome.reason ?? 'refused' };
    default: {
      const never: never = outcome.state;
      throw new Error(`Unhandled file edit state: ${String(never)}`);
    }
  }
}

/**
 * The reason an Apply's answer carries when its card went back to `pending` with words to say: a transient refusal's.
 * The writer reads why, and Apply is offered again. A boundary refusal or a discarded review carries none.
 */
export function workshopFileEditRetryReasonOf(outcome: FileEditApplyOutcome): string | undefined {
  return outcome.state === 'refused' && outcome.reason !== undefined && WORKSHOP_FILE_EDIT_TRANSIENT_REFUSALS.has(outcome.reason)
    ? outcome.reason
    : undefined;
}

function returnsToPending(reason: string | undefined): boolean {
  return reason !== undefined && (WORKSHOP_FILE_EDIT_BOUNDARY_REFUSALS.has(reason) || WORKSHOP_FILE_EDIT_TRANSIENT_REFUSALS.has(reason));
}
