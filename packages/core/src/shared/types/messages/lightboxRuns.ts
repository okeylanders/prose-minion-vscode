/**
 * Lightbox reading runs (ADR 2026-10-19 D6, D8; Slice 2B): what a press
 * reads, its progress, the estimate request and answer, and a settled
 * group's result. Apart from the reading contract so that module stays
 * within its size (Slice 4C); still exported from the `@messages` barrel.
 */

import { MessageEnvelope, MessageType } from './base';
import type { LightboxRunEstimate } from './lightboxEstimate';
import type { LightboxLensId, LightboxReadingGroup, LightboxReadingGroupId } from './lightboxReadings';

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

/**
 * What a press reads (Slice 4I adds `group`):
 * - `all`: every call with a lens on ("Run AI analyses", "Re-analyze");
 * - `rest`: only the calls not yet read, after a stop or a failure ("Finish");
 * - `group`: one call, by its group (a widget's "Analyze", a call's "Run" in
 *   the Lenses panel). The host resolves its lenses: the call's lenses that
 *   are on, with `lens` added even when it is off (the widget pressed). The
 *   webview never names a list of lenses. Group F, the Opinion, reads the
 *   board as it stands. A call that already holds readings is read again
 *   whole, cleared first, as in a full run;
 * - `lens`: one lens, with any lens read together with it (a tile's
 *   "Re-read"), leaving the group's other readings in place.
 */
export type LightboxRunScope =
  | { mode: 'all' }
  | { mode: 'rest' }
  | { mode: 'group'; group: LightboxReadingGroupId; lens?: LightboxLensId }
  | { mode: 'lens'; lens: LightboxLensId };

/**
 * - `started`: the host accepted the press; `token` names the run.
 * - `streaming`: throttled; `outputCharacters` grew.
 * - `finished`: every group settled (ok or failed).
 * - `cancelled`: the writer stopped it; finished groups are kept.
 * - `refused`: nothing was sent; `message` says why.
 */
export type LightboxRunPhase = 'started' | 'streaming' | 'finished' | 'cancelled' | 'refused';

export interface LightboxRunProgress {
  boardId: string;
  /** Host-minted; absent on a refusal. */
  token?: string;
  phase: LightboxRunPhase;
  /** The groups this run calls, in group order. */
  groups: LightboxReadingGroupId[];
  /** The lens of a single-lens re-read. */
  lens?: LightboxLensId;
  groupsBack: number;
  outputCharacters: number;
  /** Writer-facing, for a refusal or a stop. */
  message?: string;
  /**
   * On a refusal: the press named an estimate whose inputs are no longer
   * current (a model, price, lens, context or board change), so the webview
   * asks for a fresh one before the writer presses again.
   */
  reestimate?: true;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/**
 * The webview's lens toggles, and a request for the estimate (also sent after
 * a model, catalog or context change). The host answers with a fresh
 * estimate that echoes `requestId`.
 */
export interface LightboxSetLensesPayload {
  lensesOff: LightboxLensId[];
  /**
   * Webview-minted, one per request (PR #149 F-03). Only the reply that
   * echoes the latest one becomes the estimate a press may use.
   */
  requestId?: string;
}

export interface LightboxSetLensesMessage extends MessageEnvelope<LightboxSetLensesPayload> {
  type: MessageType.LIGHTBOX_SET_LENSES;
}

/** The run a board has in flight, so a reloaded or revealed tab can still stop it. */
export interface LightboxActiveRun {
  boardId: string;
  token: string;
  groups: LightboxReadingGroupId[];
  lens?: LightboxLensId;
}

export interface LightboxRunEstimatePayload {
  /** The request this answers (`LightboxSetLensesPayload.requestId`). */
  requestId?: string;
  /** `null` when there is no board to read. */
  estimate: LightboxRunEstimate | null;
  /** The current board's run, while one is active. */
  activeRun?: LightboxActiveRun;
}

export interface LightboxRunEstimateMessage extends MessageEnvelope<LightboxRunEstimatePayload> {
  type: MessageType.LIGHTBOX_RUN_ESTIMATE;
}

export interface LightboxRunPayload {
  boardId: string;
  scope: LightboxRunScope;
  /** `LightboxRunEstimate.key` of the estimate the press was shown. */
  estimateKey: string;
  /**
   * The assistant model the writer has selected, as the host last confirmed
   * it (`MODEL_DATA`). The host starts a run only on that model (PR #149
   * F-03 re-review).
   */
  model: string;
}

export interface LightboxRunMessage extends MessageEnvelope<LightboxRunPayload> {
  type: MessageType.LIGHTBOX_RUN;
}

export interface LightboxCancelRunPayload {
  boardId: string;
  token: string;
}

export interface LightboxCancelRunMessage extends MessageEnvelope<LightboxCancelRunPayload> {
  type: MessageType.LIGHTBOX_CANCEL_RUN;
}

export interface LightboxRunProgressMessage extends MessageEnvelope<LightboxRunProgress> {
  type: MessageType.LIGHTBOX_RUN_PROGRESS;
}

/** One group, as it now stands on the host's board, the moment its call settles. */
export interface LightboxGroupResultPayload {
  boardId: string;
  token: string;
  group: LightboxReadingGroup;
}

export interface LightboxGroupResultMessage extends MessageEnvelope<LightboxGroupResultPayload> {
  type: MessageType.LIGHTBOX_GROUP_RESULT;
}
