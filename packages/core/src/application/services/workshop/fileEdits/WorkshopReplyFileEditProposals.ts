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
 * nothing can be applied. With the setting `off`, nothing is staged. With no
 * port bound, nothing is staged and no card is made (`staging-unavailable`).
 *
 * Completion (`WorkshopRunCompletion`) takes the context this returns and
 * uses its cards only for the reply it was resolved from. A reply holding no
 * file-edit tag costs no await.
 *
 * Logs carry kinds, counts and reasons: never a path, a URI, a quote, a why
 * or any text an operation holds (D13).
 */

import type { WorkshopFileEditProposal } from '@messages';
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
  const proposals = control.proposals.map((draft, index) => {
    const result = results[index];
    logs.push(result.kind === 'staged'
      ? `File edit proposal pending (target=${result.target.kind}; class=${result.class}; operations=${operationKinds(draft)})`
      : `File edit proposal refused at staging (reason=${result.reason}; operations=${operationKinds(draft)})`);
    return settle(draft, result);
  });
  return { reply: input.reply, proposals, logs };
}

async function stageOne(staging: FileEditStaging, draft: WorkshopFileEditDraft): Promise<FileEditStagingResult> {
  try {
    return await staging.stage(draft.target);
  } catch {
    return { kind: 'refused', reason: 'unreadable' };
  }
}

function settle(draft: WorkshopFileEditDraft, result: FileEditStagingResult): WorkshopFileEditProposal {
  const common = {
    requested: { ...draft.target },
    operations: draft.operations.map((operation) => ({ ...operation })),
    why: draft.why
  };
  if (result.kind === 'refused') {
    return { ...common, state: 'refused', reason: result.reason };
  }
  return {
    ...common,
    target: { kind: result.target.kind, documentUri: result.target.documentUri, relativePath: result.target.relativePath },
    class: result.class,
    baseline: { sha256: result.baseline.sha256, length: result.baseline.length },
    state: 'pending'
  };
}

function operationKinds(draft: WorkshopFileEditDraft): string {
  return draft.operations.map((operation) => operation.op).join(',');
}
