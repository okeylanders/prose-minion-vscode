/**
 * Workshop domain messages (ADR 2026-07-03; Sprint 2 session spine, Sprint 3
 * multi-turn).
 *
 * The Workshop editor tab runs the EXISTING analysis tools (dialogue, prose,
 * and the twelve WritingToolsFocus modes) against an excerpt pinned host-side
 * in WorkshopSessionService. These contracts carry tool ids and completed
 * turns — never raw model prompts and never the API key.
 *
 * Sprint 3: WORKSHOP_SEND_MESSAGE continues the session's retained
 * conversation (the "now tighten it" loop), WORKSHOP_PICK_EXCERPT_FILE seeds
 * the excerpt from a host file picker, and CANCEL_WORKSHOP_REQUEST (in
 * streaming.ts, beside its four siblings) stops the in-flight run.
 * WORKSHOP_QUICK_ACTION (deterministic chips) arrives in Sprint 4.
 */

import { MessageEnvelope, MessageType } from './base';
import { WritingToolsFocus } from './analysis';
import { TokenUsage } from '../index';

/**
 * Wire id for a Workshop tool — the design catalog's 14 tools mapped 1:1 onto
 * the existing analysis contracts: `dialogue`, `prose`, and the twelve
 * WritingToolsFocus modes. The handler routes on this; it never invents tools.
 */
export type WorkshopToolId = 'dialogue' | 'prose' | WritingToolsFocus;

export type WorkshopTurnRole = 'user' | 'assistant';

/**
 * Truncation provenance for a file-seeded excerpt: the host pinned a
 * head-slice of a huge file rather than silently pinning a novel, and the UI
 * says so (Sprint 3 file-picker guardrail).
 */
export interface WorkshopExcerptTruncation {
  /** Words actually pinned (the head slice). */
  pinnedWords: number;
  /** Words in the full source file. */
  totalWords: number;
}

/** The excerpt pinned in the left rail — the text every tool run works on. */
export interface WorkshopExcerpt {
  text: string;
  /** URI of the source document, when the excerpt came from a file. */
  sourceUri?: string;
  /** Workspace-relative path for display (e.g. `chapters/03.md`). */
  relativePath?: string;
  /** Epoch ms when the excerpt was pinned (host-stamped). */
  pinnedAt: number;
  /** Present when the host head-sliced a huge file at pin time. */
  truncation?: WorkshopExcerptTruncation;
}

/** What produced a turn: a deterministic tool run, or a free-text follow-up. */
export type WorkshopTurnKind = 'tool_run' | 'message';

/**
 * One completed entry in the session thread. Tool-run user turns record the
 * request ("Run Dialogue & Beats"); message user turns carry the follow-up
 * text; assistant turns carry the streamed analysis or reply. Content is
 * markdown. Ids are host-generated and stable across reloads.
 */
export interface WorkshopTurn {
  id: string;
  role: WorkshopTurnRole;
  kind: WorkshopTurnKind;
  /** Tool for `tool_run` turns; absent on free-text `message` turns. */
  toolId?: WorkshopToolId;
  /** Deterministic display label for the tool — never model-generated. */
  toolLabel?: string;
  content: string;
  /** Epoch ms when the turn was appended (host-stamped). */
  timestamp: number;
  /** Usage for assistant turns, when the provider reported it. */
  usage?: TokenUsage;
  /** True when the response stopped at the max-token limit (assistant turns). */
  truncated?: boolean;
}

/**
 * Full host-side session aggregate, as exposed to the webview. This is the
 * reload-safety contract: a webview that (re)mounts requests this snapshot and
 * rebuilds the thread from it — React never owns the session.
 *
 * Snapshot payloads are BOUNDED (PR #67 review #12): `turns` carries at most
 * the window of most-recent turns; `truncatedTurns` counts older turns that
 * exist host-side but were left out of this snapshot. Live WORKSHOP_TURN
 * increments are never dropped — the window only bites on reload of a
 * marathon thread.
 */
export interface WorkshopSessionSnapshot {
  excerpt?: WorkshopExcerpt;
  /** Context-brief reference (carried for shape stability; feature lands later). */
  contextBrief?: string;
  turns: WorkshopTurn[];
  /** Total turns held host-side (>= turns.length). */
  totalTurns: number;
  /** Older turns omitted from this snapshot's window. */
  truncatedTurns: number;
  /**
   * True when the session holds a retained conversation a follow-up can
   * continue — the composer's enablement signal.
   */
  hasConversation: boolean;
  /** Tool currently running, if any. */
  activeToolId?: WorkshopToolId;
  /** Streaming requestId of the in-flight run, if any (stream reattach after reload). */
  activeRequestId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Webview → extension
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkshopRunToolPayload {
  /** Tool to run against the pinned excerpt (the excerpt itself lives host-side). */
  toolId: WorkshopToolId;
}

export interface WorkshopRunToolMessage extends MessageEnvelope<WorkshopRunToolPayload> {
  type: MessageType.WORKSHOP_RUN_TOOL;
}

/** Free-text follow-up: continues the session's retained conversation. */
export interface WorkshopSendMessagePayload {
  text: string;
}

export interface WorkshopSendMessageMessage extends MessageEnvelope<WorkshopSendMessagePayload> {
  type: MessageType.WORKSHOP_SEND_MESSAGE;
}

export interface WorkshopSetExcerptPayload {
  text: string;
  sourceUri?: string;
  relativePath?: string;
}

export interface WorkshopSetExcerptMessage extends MessageEnvelope<WorkshopSetExcerptPayload> {
  type: MessageType.WORKSHOP_SET_EXCERPT;
}

/**
 * "Pin from file…": the host opens its file picker (ShellService.pickFile),
 * reads the chosen file, head-slices if huge, and pins with full provenance.
 * Zero payload — the dialog IS the input.
 */
export interface WorkshopPickExcerptFileMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.WORKSHOP_PICK_EXCERPT_FILE;
}

/**
 * Zero-payload messages use the house `Record<string, never>` idiom directly
 * (9 prior siblings; PR #67 review #9) — unlike an empty interface, it
 * actually rejects smuggled fields.
 */
export interface WorkshopResetSessionMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.WORKSHOP_RESET_SESSION;
}

/** Sent on webview mount: "give me the session as the host knows it". */
export interface WorkshopRequestSessionMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.WORKSHOP_REQUEST_SESSION;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extension → webview
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkshopTurnPayload {
  turn: WorkshopTurn;
}

/** A completed turn appended to the session (user request or finished analysis). */
export interface WorkshopTurnMessage extends MessageEnvelope<WorkshopTurnPayload> {
  type: MessageType.WORKSHOP_TURN;
}

export interface WorkshopSessionStatePayload {
  session: WorkshopSessionSnapshot;
}

/**
 * Full session snapshot. Posted in reply to WORKSHOP_REQUEST_SESSION and after
 * host-side mutations (set-excerpt, reset, completed run) so the webview can
 * always reconcile to the aggregate instead of accumulating drift.
 */
export interface WorkshopSessionStateMessage extends MessageEnvelope<WorkshopSessionStatePayload> {
  type: MessageType.WORKSHOP_SESSION_STATE;
}
