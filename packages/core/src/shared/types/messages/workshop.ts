/**
 * Workshop domain messages (ADR 2026-07-03, Sprint 2 — session spine).
 *
 * The Workshop editor tab runs the EXISTING analysis tools (dialogue, prose,
 * and the twelve WritingToolsFocus modes) against an excerpt pinned host-side
 * in WorkshopSessionService. These contracts carry tool ids and completed
 * turns — never raw model prompts and never the API key.
 *
 * Sprint 2 is single-turn: WORKSHOP_RUN_TOOL starts a fresh turn each time.
 * WORKSHOP_SEND_MESSAGE (free-text continuation) arrives in Sprint 3 and
 * WORKSHOP_QUICK_ACTION (deterministic chips) in Sprint 4.
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

/** The excerpt pinned in the left rail — the text every tool run works on. */
export interface WorkshopExcerpt {
  text: string;
  /** URI of the source document, when the excerpt came from a file. */
  sourceUri?: string;
  /** Workspace-relative path for display (e.g. `chapters/03.md`). */
  relativePath?: string;
  /** Epoch ms when the excerpt was pinned (host-stamped). */
  pinnedAt: number;
}

/**
 * One completed entry in the session thread. User turns record the request
 * ("Run Dialogue & Beats"); assistant turns carry the streamed analysis.
 * Content is markdown. Ids are host-generated and stable across reloads.
 */
export interface WorkshopTurn {
  id: string;
  role: WorkshopTurnRole;
  /** What produced this turn. Sprint 2: always a tool run. Sprint 3 adds free text. */
  kind: 'tool_run';
  toolId: WorkshopToolId;
  /** Deterministic display label for the tool — never model-generated. */
  toolLabel: string;
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
 */
export interface WorkshopSessionSnapshot {
  excerpt?: WorkshopExcerpt;
  /** Context-brief reference (seeded in Sprint 3; carried now so the shape is stable). */
  contextBrief?: string;
  turns: WorkshopTurn[];
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

export interface WorkshopSetExcerptPayload {
  text: string;
  sourceUri?: string;
  relativePath?: string;
}

export interface WorkshopSetExcerptMessage extends MessageEnvelope<WorkshopSetExcerptPayload> {
  type: MessageType.WORKSHOP_SET_EXCERPT;
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
