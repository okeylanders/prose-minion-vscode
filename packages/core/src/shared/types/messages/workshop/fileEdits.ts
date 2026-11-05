/**
 * Workshop persona file edits (ADR 2026-11-05 D2, D4, D8, D10, D11; epic
 * Slice 3).
 *
 * A persona's reply may end with up to `proposalsPerReply` file-edit
 * trailers. Each frame that decodes is staged by the host (`FileEditStaging`,
 * D4) and becomes one `WorkshopFileEditProposal` on the reply's turn
 * (`WorkshopTurn.fileEditProposals`), in the order written. Nothing changes
 * in a file until the writer applies a card (Slice 4).
 *
 * - **`requested`** is what the frame named: a catalog key or the excerpt.
 *   It is kept for display, and is all a card refused at staging has.
 * - **`target`** is the host-owned identity staging took (D4.3): a
 *   `documentUri` the host wrote, and the display `relativePath`. The
 *   webview's view omits `documentUri` (`workshopFileEditProposalForWebview`);
 *   host-side and on disk it is always present on a staged card.
 * - **`class`** and **`baseline`** are staging's too (D5, D6).
 * - **`state`**, `reason`, per-operation `outcomes` and `landed` records are
 *   Slice 4's to set (D8, D10). `applying` is persisted only around a
 *   dispatched write, and reads as `unknown` on reopen.
 */

import type { ContextPathGroup } from '../../context';

/** The one setting (D11): exactly `off` | `ask`. No input can name another value. */
export const WORKSHOP_FILE_EDITS_MODES = ['off', 'ask'] as const;
export type WorkshopFileEditsMode = (typeof WORKSHOP_FILE_EDITS_MODES)[number];

export const DEFAULT_WORKSHOP_FILE_EDITS_MODE: WorkshopFileEditsMode = 'ask';

export const WORKSHOP_FILE_EDITS_SETTING = Object.freeze({
  section: 'proseMinion',
  key: 'workshop.fileEdits'
});

/**
 * The setting as stored: unset reads as the default (`ask`, Q1); anything
 * but `off` or `ask` fails closed to `off`.
 */
export function coerceWorkshopFileEditsMode(raw: unknown): WorkshopFileEditsMode {
  if (raw === undefined) {
    return DEFAULT_WORKSHOP_FILE_EDITS_MODE;
  }
  return WORKSHOP_FILE_EDITS_MODES.find((mode) => mode === raw) ?? 'off';
}

/** What a frame named (D2): a configured resource by its catalog key, or the room's excerpt. */
export type WorkshopFileEditRequestedTarget =
  | { readonly kind: 'resource'; readonly group: ContextPathGroup; readonly path: string }
  | { readonly kind: 'excerpt' };

/** The host-owned identity a frame was staged to (D4.3). */
export interface WorkshopFileEditTarget {
  readonly kind: 'file' | 'excerpt';
  /** Host-written; present host-side and on disk, never in the webview's view. */
  readonly documentUri?: string;
  /** The display path: workspace-relative. */
  readonly relativePath: string;
}

export const WORKSHOP_FILE_EDIT_CLASSES = ['prose', 'notes'] as const;
export type WorkshopFileEditClass = (typeof WORKSHOP_FILE_EDIT_CLASSES)[number];

/** SHA-256 (hex) and UTF-16 length of the file's content at staging (D6). */
export interface WorkshopFileEditBaseline {
  readonly sha256: string;
  readonly length: number;
}

/** One operation, as the shared planner reads it (ADR D3). */
export type WorkshopFileEditOperation =
  | { readonly op: 'rewrite'; readonly text: string }
  | { readonly op: 'replace'; readonly find: string; readonly with: string }
  | { readonly op: 'append' | 'prepend'; readonly text: string };

export const WORKSHOP_FILE_EDIT_STATES = [
  'pending', 'applying', 'applied', 'partial', 'declined', 'stale', 'refused', 'unknown'
] as const;
export type WorkshopFileEditState = (typeof WORKSHOP_FILE_EDIT_STATES)[number];

/** What became of one operation once a card settled (D8). */
export const WORKSHOP_FILE_EDIT_OPERATION_OUTCOMES = ['landed', 'not-applied', 'unknown'] as const;
export type WorkshopFileEditOperationOutcome = (typeof WORKSHOP_FILE_EDIT_OPERATION_OUTCOMES)[number];

/**
 * What one landed operation wrote (D10, N-01): its text before and after,
 * with up to `landedContextCharacters` on each side to anchor a deletion,
 * and the document version after. Past `revertCharacters`, only hashes,
 * and the operation is not revertible.
 */
export type WorkshopFileEditLanded =
  | {
    readonly operation: number;
    readonly before: string;
    readonly after: string;
    readonly contextBefore: string;
    readonly contextAfter: string;
    readonly versionAfter: number;
  }
  | {
    readonly operation: number;
    readonly beforeSha256: string;
    readonly afterSha256: string;
  };

/** A persona's proposed edit to one file, its trailer stripped (D2, D10). */
export interface WorkshopFileEditProposal {
  readonly requested: WorkshopFileEditRequestedTarget;
  /** Absent only on a card refused at staging. */
  readonly target?: WorkshopFileEditTarget;
  /** With `target`. */
  readonly class?: WorkshopFileEditClass;
  /** In the order written; a rewrite stands alone. */
  readonly operations: readonly WorkshopFileEditOperation[];
  /** One line: what the edit is for, shown on the card. */
  readonly why: string;
  /** With `target`. */
  readonly baseline?: WorkshopFileEditBaseline;
  readonly state: WorkshopFileEditState;
  /** The host's reason: a staging refusal's kind, or why a card is stale, partial or unknown. */
  readonly reason?: string;
  /** One per operation, in order, once a card settled. */
  readonly outcomes?: readonly WorkshopFileEditOperationOutcome[];
  /** One per landed operation. */
  readonly landed?: readonly WorkshopFileEditLanded[];
}

/** Bounds the host's own fields hold (the model's are `PROMPT_BUDGETS.workshopFileEdits`). */
export const WORKSHOP_FILE_EDIT_RECORD_LIMITS = Object.freeze({
  reasonCharacters: 500,
  documentUriCharacters: 8_192
});

/** The reason a card found `applying` on reopen carries (D8): its write's outcome can't be known. */
export const WORKSHOP_FILE_EDIT_REOPENED_APPLYING_REASON = 'applying-on-reopen';

/** A card as the webview sees it: the identity's display path, never its `documentUri` (D4.3). */
export function workshopFileEditProposalForWebview(proposal: WorkshopFileEditProposal): WorkshopFileEditProposal {
  if (!proposal.target) {
    return proposal;
  }
  return { ...proposal, target: { kind: proposal.target.kind, relativePath: proposal.target.relativePath } };
}

/** A card's display path: the staged identity's, else what the frame named. */
export function workshopFileEditDisplayPath(proposal: Pick<WorkshopFileEditProposal, 'requested' | 'target'>): string {
  if (proposal.target) {
    return proposal.target.relativePath;
  }
  return proposal.requested.kind === 'excerpt' ? 'excerpt' : proposal.requested.path;
}
