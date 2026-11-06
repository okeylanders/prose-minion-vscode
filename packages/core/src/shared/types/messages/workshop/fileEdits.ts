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
import type { MessageEnvelope, MessageType } from '../base';

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
  documentUriCharacters: 8_192,
  /** A staged identity's display path: the host's, so not the model's lookup bound (PR #230 F-01). */
  displayPathCharacters: 8_192
});

/** The reason a card carries when staging returned an identity a session can't hold (PR #230 F-01). */
export const WORKSHOP_FILE_EDIT_UNPERSISTABLE_IDENTITY_REASON = 'identity-unpersistable';

const NOT_ONE_LINE = /[\p{Cc}\u2028\u2029]/u;

/**
 * Whether a host-staged identity can be persisted (PR #230 F-01): the one
 * contract between staging's output and the session codec, checked before a
 * card is adopted and again when a session is read.
 *
 * The display path is the host's (the excerpt's own `relativePath`, or a
 * catalog row's), not a model lookup path: it is held only to be one line,
 * non-empty and within `displayPathCharacters`, never to the configured-
 * resource grammar (`draft:one.md` and a deep nested path are fine). The URI
 * is non-empty, one line and within `documentUriCharacters`. Containment and
 * authorization are staging's and the gateway's, not this rule's.
 */
export function workshopFileEditIdentityHoldable(target: {
  readonly documentUri?: unknown;
  readonly relativePath?: unknown;
}): boolean {
  return holdable(target.documentUri, WORKSHOP_FILE_EDIT_RECORD_LIMITS.documentUriCharacters)
    && holdable(target.relativePath, WORKSHOP_FILE_EDIT_RECORD_LIMITS.displayPathCharacters);
}

function holdable(value: unknown, maximum: number): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum && !NOT_ONE_LINE.test(value);
}

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

/*
 * Routes (ADR 2026-11-05 D8, D9; epic Slice 4a). Every request carries a
 * webview-minted `requestId` the host echoes, and the room generation the
 * card was shown in (`roomRevision`, the session state's). An answer names
 * the generation it belongs to, so the webview ignores one for an earlier
 * room (the #221 pattern). This correlates answers only: the host's claim is
 * what serializes writes. No route carries or answers a `documentUri`.
 */

/**
 * A card's action: `apply` applies directly (the card was the review),
 * `review` through the editor's Refactor Preview ("Review in editor…"),
 * `decline` declines it. Offered only while the card is `pending`; the host
 * answers every other state by replaying it, writing nothing.
 */
export type WorkshopFileEditAction = 'apply' | 'review' | 'decline';

export interface WorkshopFileEditActionPayload {
  requestId: string;
  /** The room generation the card was shown in; another room's action is refused. */
  roomRevision: number;
  turnId: string;
  /** Which of the turn's cards: its index in `fileEditProposals`. */
  index: number;
  action: WorkshopFileEditAction;
}

export interface WorkshopFileEditActionMessage extends MessageEnvelope<WorkshopFileEditActionPayload> {
  type: MessageType.WORKSHOP_FILE_EDIT_ACTION;
}

/**
 * What an action came to:
 * - `settled`: it ran; `state` is the card's now (a declined card, or an
 *   Apply's outcome; a discarded review or a lost boundary is `pending`
 *   again, nothing written);
 * - `joined`: an Apply or Review joined one already running on this card,
 *   and carries that one's outcome;
 * - `replayed`: the card had already settled; nothing was written;
 * - `held`: Decline while the card is being applied; nothing changed;
 * - `refused`: nothing was written and the card stays as it was (`state`),
 *   for `reason` (the setting off, a reply running, a checkpoint refused);
 * - `room-changed`: the room was replaced before or while it ran; any
 *   outcome belongs to the earlier room and was dropped;
 * - `no-card`: the turn holds no card there.
 */
export type WorkshopFileEditAnswer = 'settled' | 'joined' | 'replayed' | 'held' | 'refused' | 'room-changed' | 'no-card';

export interface WorkshopFileEditResultPayload {
  requestId: string;
  /** The room generation the action was taken in. */
  roomRevision: number;
  turnId: string;
  index: number;
  answer: WorkshopFileEditAnswer;
  /** The card's state after; absent for `room-changed` and `no-card`. */
  state?: WorkshopFileEditState;
  /** A reason kind (`WORKSHOP_FILE_EDIT_REASON_WORDS`), when there is one. */
  reason?: string;
  /** The writer's words for it. */
  message: string;
}

export interface WorkshopFileEditResultMessage extends MessageEnvelope<WorkshopFileEditResultPayload> {
  type: MessageType.WORKSHOP_FILE_EDIT_RESULT;
}

/** A rewrite card's before and after (D6, D9), asked for when the card is shown. */
export interface WorkshopFileEditPreviewRequestPayload {
  requestId: string;
  roomRevision: number;
  turnId: string;
  index: number;
}

export interface WorkshopFileEditPreviewRequestMessage extends MessageEnvelope<WorkshopFileEditPreviewRequestPayload> {
  type: MessageType.WORKSHOP_FILE_EDIT_PREVIEW;
}

/**
 * The live content a rewrite would replace and the rewrite, read only
 * while the baseline holds; `stale` once it no longer does (the card turns
 * stale too); `refused` with a reason kind otherwise. Never a URI.
 */
export type WorkshopFileEditPreview =
  | { readonly kind: 'rewrite'; readonly before: string; readonly after: string }
  | { readonly kind: 'stale'; readonly reason: string; readonly message: string }
  | { readonly kind: 'refused'; readonly reason: string; readonly message: string };

export interface WorkshopFileEditPreviewResultPayload {
  requestId: string;
  roomRevision: number;
  turnId: string;
  index: number;
  preview: WorkshopFileEditPreview;
}

export interface WorkshopFileEditPreviewResultMessage extends MessageEnvelope<WorkshopFileEditPreviewResultPayload> {
  type: MessageType.WORKSHOP_FILE_EDIT_PREVIEW_RESULT;
}

/** A card's routes, webview to host. */
export type WorkshopFileEditWebviewMessage = WorkshopFileEditActionMessage | WorkshopFileEditPreviewRequestMessage;

/** Their answers, host to webview. */
export type WorkshopFileEditExtensionMessage = WorkshopFileEditResultMessage | WorkshopFileEditPreviewResultMessage;
