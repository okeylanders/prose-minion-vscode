/**
 * A reply's file-edit proposals, settled at completion (ADR 2026-11-05 D1,
 * D2, D8, D9; epic Slice 3). Pure: the extractor judged each frame against
 * the setting as it stood when the reply was read; this turns its verdict
 * into the turn's `fileEditProposals`, every card `pending` (nothing changes
 * until the writer applies one: Slice 4), with one log line per frame.
 *
 * Logs carry the target's group (or `excerpt`), operation kinds, counts and
 * reasons: never a path, a quote, a why or any text an operation holds.
 */

import type { WorkshopFileEditProposal } from '@messages';
import type { WorkshopReplyFileEditControl } from '@/utils/workshopReplyFileEdits';

export interface WorkshopSettledFileEditProposals {
  /** The cards, in the order written; empty when none survived. */
  readonly proposals: readonly WorkshopFileEditProposal[];
  /** One log line per frame; empty when the reply held none. */
  readonly logs: readonly string[];
}

const NOTHING: WorkshopSettledFileEditProposals = Object.freeze({ proposals: [], logs: [] });

export function settleWorkshopFileEditProposals(
  control: WorkshopReplyFileEditControl | undefined
): WorkshopSettledFileEditProposals {
  if (!control) {
    return NOTHING;
  }
  const logs = control.rejections.map((reason) => `File edit proposal dropped (reason=${reason})`);
  const proposals = control.proposals.map((draft): WorkshopFileEditProposal => {
    logs.push(
      `File edit proposal pending (target=${draft.target.kind === 'excerpt' ? 'excerpt' : draft.target.group}; ` +
      `operations=${draft.operations.map((operation) => operation.op).join(',')})`
    );
    return {
      target: { ...draft.target },
      operations: draft.operations.map((operation) => ({ ...operation })),
      why: draft.why,
      state: 'pending'
    };
  });
  return { proposals, logs };
}
