/**
 * Workshop persona file edits (ADR 2026-11-05 D2, D8, D9; epic Slice 3).
 *
 * A persona's reply may end with up to `proposalsPerReply` file-edit
 * trailers. Each becomes one `WorkshopFileEditProposal` on the reply's turn
 * (`WorkshopTurn.fileEditProposals`), in the order written: its target, its
 * operations, its `why`, and its state. Nothing changes in a file until the
 * writer applies a card (Slice 4), which sets its state and, when it lands,
 * what landed.
 *
 * - **Targets** name a file as `resource.read` does (a catalog key: group and
 *   workspace-relative path), or the room's excerpt document. Never a URI.
 * - **Operations** are the shared planner's (`TextEditOperation`, ADR D3),
 *   in the order written.
 * - **`landed`** records what an Apply wrote (D8): the file's catalog key as
 *   the gateway resolved it, or the excerpt; the document version after; and
 *   each applied range's new text, with the operations it carries. A later
 *   Revert (D10) finds the text again without trusting the version.
 */

import type { ContextPathGroup } from '../../context';

/** The one setting (D9): `off` teaches nothing and reads no frame; `ask` holds every edit for the writer. */
export const WORKSHOP_FILE_EDITS_MODES = ['off', 'ask'] as const;
export type WorkshopFileEditsMode = (typeof WORKSHOP_FILE_EDITS_MODES)[number];

export const DEFAULT_WORKSHOP_FILE_EDITS_MODE: WorkshopFileEditsMode = 'ask';

export const WORKSHOP_FILE_EDITS_SETTING = Object.freeze({
  section: 'proseMinion',
  key: 'workshop.fileEdits'
});

/**
 * The setting as stored: unset reads as the default (`ask`, Q1); anything
 * but a known mode fails closed to `off`.
 */
export function coerceWorkshopFileEditsMode(raw: unknown): WorkshopFileEditsMode {
  if (raw === undefined) {
    return DEFAULT_WORKSHOP_FILE_EDITS_MODE;
  }
  return WORKSHOP_FILE_EDITS_MODES.find((mode) => mode === raw) ?? 'off';
}

/** Which file an edit is for: a configured resource by its catalog key, or the excerpt's document. */
export type WorkshopFileEditTarget =
  | { readonly kind: 'resource'; readonly group: ContextPathGroup; readonly path: string }
  | { readonly kind: 'excerpt' };

/** One operation, as the shared planner reads it (ADR D3). */
export type WorkshopFileEditOperation =
  | { readonly op: 'rewrite'; readonly text: string }
  | { readonly op: 'replace'; readonly find: string; readonly with: string }
  | { readonly op: 'append' | 'prepend'; readonly text: string };

export const WORKSHOP_FILE_EDIT_STATES = ['pending', 'applied', 'declined', 'stale', 'refused'] as const;
export type WorkshopFileEditState = (typeof WORKSHOP_FILE_EDIT_STATES)[number];

/** One applied range's new text, and which of the card's operations it carries (by index). */
export interface WorkshopFileEditLandedRange {
  readonly operations: readonly number[];
  readonly text: string;
}

/** What an Apply wrote (D8). */
export interface WorkshopFileEditLanded {
  /** The file as the gateway resolved it: its canonical catalog key, or the excerpt. */
  readonly target: WorkshopFileEditTarget;
  /** The document's version after the edit landed. */
  readonly version: number;
  /** Each applied range, in document order. */
  readonly ranges: readonly WorkshopFileEditLandedRange[];
}

/** A persona's proposed edit to one file, its trailer stripped (D2, D8). */
export interface WorkshopFileEditProposal {
  readonly target: WorkshopFileEditTarget;
  /** In the order written; at most one rewrite, which then stands alone. */
  readonly operations: readonly WorkshopFileEditOperation[];
  /** One line: what the edit is for, shown on the card. */
  readonly why: string;
  readonly state: WorkshopFileEditState;
  /** Only on an applied card. */
  readonly landed?: WorkshopFileEditLanded;
  /** The host's words for a stale, refused or partly applied card. */
  readonly reason?: string;
}

/** Bounds the host's own fields hold (the model's are `PROMPT_BUDGETS.workshopFileEdits`). */
export const WORKSHOP_FILE_EDIT_RECORD_LIMITS = Object.freeze({
  reasonCharacters: 500
});
