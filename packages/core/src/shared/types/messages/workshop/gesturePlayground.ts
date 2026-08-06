/** Gesture Playground feature contracts. */

import { MessageEnvelope, MessageType } from '../base';
import type { CancelRequestPayload } from '../streaming';
import { WorkshopWidgetSourceReference } from './context';
// ─────────────────────────────────────────────────────────────────────────────
// Conversation Widgets (ADR 2026-07-22; Sprint 01 widget host + Gesture
// Playground). A widget is played BEFORE it commits: the pre-commit Draft is
// local to the modal, the commit is one atomic host route, and the full Draft
// persists by stable `wc-N` id so the transcript chip re-hydrates the exact
// authoring surface (config, not just output, is session-owned).
// ─────────────────────────────────────────────────────────────────────────────

/** One group of generated gesture directions ("The eyes", "Hands & body", …). */
export interface WorkshopGesturePlaygroundMenuGroup {
  heading: string;
  options: string[];
}

/**
 * The Gesture Playground authoring state. `menu` is the generated exploration
 * cloud — persisted so a chip re-opens the exact surface. Kept directions and
 * the note always shape the one-shot artifact; the writer may also explicitly
 * include the full dictionary as room-wide reference material.
 */
export interface WorkshopGesturePlaygroundDraft {
  targetPhrase: string;
  writerInstructions: string;
  contextText: string;
  characterNotes: string;
  sourceReferences: WorkshopWidgetSourceReference[];
  /** Writer-facing semantic scan generated before the menu in the same call. */
  dictionaryMarkdown: string;
  /** Validated menu generated from the same composite response as the dictionary. */
  menu: WorkshopGesturePlaygroundMenuGroup[];
  /** The directions the writer kept — exact option strings, order preserved. */
  selections: string[];
  note: string;
  /** Opt-in: deliver the full dictionary once to every host/guest for this room turn. */
  includeDictionaryInCommit: boolean;
}

/**
 * Persona-supplied prefill for a recommended widget. Every field is editable.
 * Gesture Playground's accepted persona frame supplies the first four fields
 * together; optionality keeps the shared seed usable by future widget kinds.
 */
export interface WorkshopGesturePlaygroundRecommendationSeed {
  targetPhrase?: string;
  writerInstructions?: string;
  contextText?: string;
  characterNotes?: string;
  sourceReferences?: WorkshopWidgetSourceReference[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation Widget messages (ADR 2026-07-22). Generate is the pre-commit
// model call — it touches no session state and may run freely. Commit is one
// atomic mutation-gated route: config + artifact + visible turn, or nothing.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-commit composite generation. `token` is webview-minted and echoed back
 * so a regenerate race resolves to the latest request (stale results are
 * dropped).
 */
interface WorkshopGesturePlaygroundGenerateBasePayload {
  widgetId: 'gesture-playground';
  token: string;
  targetPhrase: string;
  writerInstructions: string;
  contextText: string;
  characterNotes: string;
  sourceReferences: WorkshopWidgetSourceReference[];
}

export type WorkshopGesturePlaygroundGeneratePayload =
  | (WorkshopGesturePlaygroundGenerateBasePayload & { mode: 'full' })
  | (WorkshopGesturePlaygroundGenerateBasePayload & {
      mode: 'more';
      dictionaryMarkdown: string;
      menu: WorkshopGesturePlaygroundMenuGroup[];
    });

export interface WorkshopGesturePlaygroundGenerateMessage
  extends MessageEnvelope<WorkshopGesturePlaygroundGeneratePayload> {
  type: MessageType.WORKSHOP_GESTURE_PLAYGROUND_GENERATE;
}

/** Abandon the in-flight generate call (modal closed, or superseded). */
export interface CancelGesturePlaygroundGenerateRequestMessage
  extends MessageEnvelope<CancelRequestPayload> {
  type: MessageType.CANCEL_GESTURE_PLAYGROUND_GENERATE_REQUEST;
}

export interface WorkshopGesturePlaygroundGenerationProgressPayload {
  widgetId: 'gesture-playground';
  token: string;
  phase: 'started' | 'streaming' | 'completed' | 'cancelled';
  stage: 'requesting' | 'dictionary' | 'menu' | 'validating';
  outputCharacters: number;
  /** Character-derived estimate of the visible text received so far. */
  estimatedOutputTokens: number;
  /** Terminal provider usage for diagnostics; absent while the stream is live. */
  completionTokens?: number;
  outputTokenLimit: number;
}

export interface WorkshopGesturePlaygroundGenerationProgressMessage
  extends MessageEnvelope<WorkshopGesturePlaygroundGenerationProgressPayload> {
  type: MessageType.WORKSHOP_GESTURE_PLAYGROUND_GENERATION_PROGRESS;
}

export interface WorkshopGesturePlaygroundMenuResultPayload {
  widgetId: 'gesture-playground';
  token: string;
  mode: 'full' | 'more';
  ok: boolean;
  /** Present whenever the model produced a valid, bounded Gesture Dictionary. */
  dictionaryMarkdown?: string;
  menu?: WorkshopGesturePlaygroundMenuGroup[];
  /** A valid dictionary survived, but the menu protocol or JSON was unusable. */
  menuError?: string;
  /** User-facing fatal failure text when no valid dictionary can be recovered. */
  error?: string;
  /** True when the provider stopped at the configured output-token ceiling. */
  truncated?: boolean;
}

export interface WorkshopGesturePlaygroundMenuResultMessage
  extends MessageEnvelope<WorkshopGesturePlaygroundMenuResultPayload> {
  type: MessageType.WORKSHOP_GESTURE_PLAYGROUND_MENU_RESULT;
}

/**
 * The atomic widget commit. The full Draft crosses so the host can persist
 * the exact authoring state (`wc-N`) before shipping the directive; the
 * exploration cloud in `draft.menu` is persisted for chip re-hydration but
 * never enters the prompt.
 */
export interface WorkshopGesturePlaygroundCommitPayload {
  widgetId: 'gesture-playground';
  requestToken: string;
  draft: WorkshopGesturePlaygroundDraft;
  /** Present on clone-and-recommit: the config this Draft was re-opened from. */
  clonedFromConfigId?: string;
}
