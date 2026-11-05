/**
 * A reply's file-edit proposals, staged and settled before completion (ADR
 * 2026-11-05 D2, D4, D10, D11, D13; epic Slice 3).
 *
 * The room reads the setting when the reply is read and, while it is `ask`,
 * stages each frame that decodes through the `FileEditStaging` port (the
 * gateway's target module implements it; Slice 4 binds it). Staging is async
 * and bounded: at most `proposalsPerReply` frames, staged together. A frame
 * staged becomes a `pending` card with the identity, class and baseline
 * staging took; a frame staging refused becomes a `refused` card with the
 * refusal's kind as its reason, so the writer sees what the persona tried and
 * nothing can be applied. A staged identity a session can't hold (the
 * staging contract, `workshopFileEditIdentityHoldable`) is refused as
 * `identity-unpersistable`, so no card makes the session unsaveable (PR #230
 * F-01). A rewrite staged to prose is refused here, since
 * staging decided the class (`rewrite-on-prose`, D5), keeping its identity.
 * Two frames staged to one identity (one `documentUri`) keep only the first
 * (`duplicate-identity`): one card per file per reply. With the setting `off`, nothing is staged. With no
 * port bound, nothing is staged and no card is made (`staging-unavailable`).
 *
 * Completion (`WorkshopRunCompletion`) takes the context this returns and
 * uses its cards only for the reply it was resolved from. A reply holding no
 * file-edit tag costs no await.
 *
 * Logs carry kinds, counts and reasons: never a path, a URI, a quote, a why
 * or any text an operation holds (D13).
 */

import {
  WORKSHOP_FILE_EDIT_UNPERSISTABLE_IDENTITY_REASON,
  workshopFileEditIdentityHoldable,
  type WorkshopFileEditProposal
} from '@messages';

/** The host's reason for a rewrite staged to prose (D5: prose is never rewritten whole). */
export const WORKSHOP_FILE_EDIT_REWRITE_ON_PROSE = 'rewrite-on-prose';
import type { FileEditStaging, FileEditStagingResult } from '@/domain/models/FileEditStaging';
import type { WorkshopFileEditDraft } from '@/utils/workshopFileEditProtocol';
import { extractWorkshopReplyControls, hasWorkshopFileEditText } from '@/utils/workshopReplyControls';

/** What completion needs to know about a reply's file edits, resolved before it runs. */
export interface WorkshopReplyFileEditContext {
  /** The reply this was resolved from; completion uses the cards only for exactly this reply. */
  readonly reply: string;
  /** The cards, in the order written; empty when none survived. */
  readonly proposals: readonly WorkshopFileEditProposal[];
  /** One log line per frame. */
  readonly logs: readonly string[];
}

export interface WorkshopReplyFileEditInput {
  readonly reply: string;
  /** The setting, read when the reply is read (D11). */
  readonly open: boolean;
  /** The staging port; absent until Slice 4 binds it. */
  readonly staging?: FileEditStaging;
  readonly signal?: AbortSignal;
}

/**
 * Stage a reply's frames and settle them into cards. Undefined when the reply
 * holds no file-edit tag (no await). Never rejects: a port that rejects
 * reads as a refusal (`unreadable`).
 */
export async function resolveWorkshopReplyFileEdits(
  input: WorkshopReplyFileEditInput
): Promise<WorkshopReplyFileEditContext | undefined> {
  if (!hasWorkshopFileEditText(input.reply)) {
    return undefined;
  }
  const control = extractWorkshopReplyControls(input.reply, { memoryOpen: false, fileEditsOpen: input.open }).fileEdits;
  if (!control) {
    return undefined;
  }
  const logs = control.rejections.map((reason) => `File edit proposal dropped (reason=${reason})`);
  if (control.proposals.length === 0 || input.signal?.aborted) {
    return { reply: input.reply, proposals: [], logs };
  }
  const staging = input.staging;
  if (!staging) {
    logs.push(...control.proposals.map(() => 'File edit proposal dropped (reason=staging-unavailable)'));
    return { reply: input.reply, proposals: [], logs };
  }
  const results = await Promise.all(control.proposals.map((draft) => stageOne(staging, draft)));
  const proposals: WorkshopFileEditProposal[] = [];
  const identities = new Set<string>();
  control.proposals.forEach((draft, index) => {
    const result = results[index];
    if (result.kind === 'staged') {
      if (identities.has(result.target.documentUri)) {
        logs.push('File edit proposal dropped (reason=duplicate-identity)');
        return;
      }
      identities.add(result.target.documentUri);
    }
    const proposal = settle(draft, result);
    logs.push(proposal.state === 'pending'
      ? `File edit proposal pending (target=${result.kind === 'staged' ? result.target.kind : 'none'}; class=${proposal.class}; operations=${operationKinds(draft)})`
      : `File edit proposal refused at staging (reason=${proposal.reason}; operations=${operationKinds(draft)})`);
    proposals.push(proposal);
  });
  return { reply: input.reply, proposals, logs };
}

async function stageOne(staging: FileEditStaging, draft: WorkshopFileEditDraft): Promise<StagedOrRefused> {
  let result: FileEditStagingResult;
  try {
    result = await staging.stage(draft.target);
  } catch {
    return { kind: 'refused', reason: 'unreadable' };
  }
  // The staging contract, before a card is adopted (PR #230 F-01): an
  // identity a session can't hold becomes a persistable refusal, so no
  // accepted card ever makes the session unsaveable.
  return result.kind === 'staged' && !workshopFileEditIdentityHoldable(result.target)
    ? { kind: 'refused', reason: WORKSHOP_FILE_EDIT_UNPERSISTABLE_IDENTITY_REASON }
    : result;
}

/** Staging's answer, or a refusal the host made of it. */
type StagedOrRefused = FileEditStagingResult | { readonly kind: 'refused'; readonly reason: typeof WORKSHOP_FILE_EDIT_UNPERSISTABLE_IDENTITY_REASON };

function settle(draft: WorkshopFileEditDraft, result: StagedOrRefused): WorkshopFileEditProposal {
  const common = {
    requested: { ...draft.target },
    operations: draft.operations.map((operation) => ({ ...operation })),
    why: draft.why
  };
  if (result.kind === 'refused') {
    return { ...common, state: 'refused', reason: result.reason };
  }
  const rewritesProse = result.class === 'prose' && draft.operations.some((operation) => operation.op === 'rewrite');
  return {
    ...common,
    target: { kind: result.target.kind, documentUri: result.target.documentUri, relativePath: result.target.relativePath },
    class: result.class,
    baseline: { sha256: result.baseline.sha256, length: result.baseline.length },
    ...(rewritesProse ? { state: 'refused' as const, reason: WORKSHOP_FILE_EDIT_REWRITE_ON_PROSE } : { state: 'pending' as const })
  };
}

function operationKinds(draft: WorkshopFileEditDraft): string {
  return draft.operations.map((operation) => operation.op).join(',');
}
