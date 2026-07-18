/**
 * Workshop domain messages (ADR 2026-07-03; Sprint 2 session spine, Sprint 3
 * multi-turn).
 *
 * The Workshop editor tab runs the EXISTING analysis tools (dialogue, prose,
 * and the twelve WritingToolsFocus modes) against an excerpt pinned host-side
 * in WorkshopSessionService. These contracts carry tool ids and completed
 * turns — never raw model prompts and never the API key.
 *
 * Sprint 06B adds a selected persona host and retained per-tool sidecars.
 * WORKSHOP_SEND_MESSAGE starts/continues the host unless an explicit direct
 * target is selected; provider ids remain host-private.
 */

import { MessageEnvelope, MessageType } from './base';
import { WritingToolsFocus } from './analysis';
import { TokenUsage } from '../index';
import type { LabeledContextBudgetSnapshot } from './inferenceContext';
import type { WorkshopCapabilityArtifactDetails } from '../workshopCapabilities';
import { ContextPathGroup, isContextPathGroup } from '../context';

/**
 * Wire id for a Workshop tool — the design catalog's 14 tools mapped 1:1 onto
 * the existing analysis contracts: `dialogue`, `prose`, and the twelve
 * WritingToolsFocus modes. The handler routes on this; it never invents tools.
 */
export type WorkshopToolId = 'dialogue' | 'prose' | WritingToolsFocus;

/** Stable ids for the Writers' Room hosts packaged with Workshop. */
export type WorkshopPersonaId =
  | 'jill'
  | 'agnes'
  | 'cliff'
  | 'dev'
  | 'edna'
  | 'felix'
  | 'harper'
  | 'margot'
  | 'penny'
  | 'quinn'
  | 'theo'
  | 'wren';

/** The one explicit routing choice behind the Workshop composer. */
export type WorkshopChatTarget =
  | { kind: 'host' }
  | { kind: 'tool'; toolId: WorkshopToolId }
  | { kind: 'personaGuest'; personaId: WorkshopPersonaId };

/** Metadata safe to expose for the permanent persona participant. */
export interface WorkshopHostParticipantSnapshot {
  personaId: WorkshopPersonaId;
  hasConversation: boolean;
}

/** Metadata safe to expose for a retained tool sidecar. Never includes its id. */
export interface WorkshopToolSidecarSnapshot {
  toolId: WorkshopToolId;
  hasConversation: true;
  /** Stable correlation for the report that owns this retained sidecar. */
  latestReportTurnId: string;
  /** False only when the retained provider conversation has been lost. */
  availableForDirectFollowUp: boolean;
  /** Convenience flag for rendering the explicit composer target. */
  activeTarget: boolean;
}

/** Public view of a guest persona retained beside the immutable host. */
export interface WorkshopPersonaGuestSnapshot {
  personaId: WorkshopPersonaId;
  personaLabel: string;
  hasConversation: boolean;
  liveness: 'live' | 'disposed';
  activeTarget: boolean;
}

/** Public view of the session's private participant graph. */
export interface WorkshopParticipantsSnapshot {
  host: WorkshopHostParticipantSnapshot;
  toolSidecars: WorkshopToolSidecarSnapshot[];
  personaGuests: WorkshopPersonaGuestSnapshot[];
  chatTarget: WorkshopChatTarget;
}

/** A validated, deterministic item parsed from an exact next-steps section. */
export interface WorkshopActionableFinding {
  /** Stable only within its originating turn; pair with the source turn id. */
  key: string;
  text: string;
  ordinal: number;
  /** Declared by the strict list prefix, when the source supports priority. */
  priority?: WorkshopTodoPriority;
}

export type WorkshopTodoStatus = 'open' | 'completed' | 'dismissed';
export type WorkshopTodoPriority = 'high' | 'medium' | 'low';

export interface WorkshopTodoWriterEdit {
  /** Immutable first text promoted from the source finding. */
  originalText: string;
  editedAt: number;
}

interface WorkshopTodoSourceBase {
  turnId: string;
  participantLabel: string;
  findingKey: string;
  findingText: string;
  excerptVersion: number;
}

export type WorkshopTodoSource =
  | (WorkshopTodoSourceBase & {
      kind: 'tool_report';
      toolId: WorkshopToolId;
    })
  | (WorkshopTodoSourceBase & {
      kind: 'host_turn';
      personaId: WorkshopPersonaId;
      /** Tool report the host was synthesizing, when this proposal derived from one. */
      upstreamReportTurnId?: string;
    });

/** Writer-owned planning item with immutable source-turn provenance. */
export interface WorkshopTodoItem {
  /** Opaque host-generated correlation key; never a provider conversation id. */
  id: string;
  text: string;
  status: WorkshopTodoStatus;
  priority?: WorkshopTodoPriority;
  source: WorkshopTodoSource;
  createdAt: number;
  writerEdit?: WorkshopTodoWriterEdit;
  /** Derived from source excerpt version; stale tasks never enter host evidence. */
  stale: boolean;
}

export type WorkshopTurnRole = 'user' | 'assistant' | 'system';

/** The participant responsible for a visible Workshop turn. */
export type WorkshopTurnParticipant = 'writer' | 'host' | 'guest' | 'tool' | 'session';

/**
 * Semantic artifact carried by a turn. `kind` remains the coarse interaction
 * shape; this field keeps report, synthesis, and direct exchanges honest.
 */
export type WorkshopTurnArtifact =
  | 'tool_request'
  | 'persona_message'
  | 'tool_report'
  | 'persona_synthesis'
  | 'direct_tool_message'
  | 'direct_tool_response'
  | 'dictionary_lookup'
  | 'dictionary_full_entry'
  | 'resource_catalog'
  | 'resource_search'
  | 'resource_read'
  | 'excerpt_revision'
  | 'context_change';

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

/**
 * Canonical configured-resource key from the context-path resolver, stamped
 * during source resolution so model-requested reads can cite `{ group, path }`
 * instead of reconstructing a path (Sprint 12).
 */
export interface WorkshopConfiguredResourceRef {
  group: ContextPathGroup;
  path: string;
}

/**
 * Where the excerpt text actually came from (Sprint 12). Intake method and
 * provenance are different facts: pasted text that exactly matches the active
 * editor selection earns `editor-selection`; anything unverifiable stays
 * honestly `manual`. The union is closed — locked-state affordances
 * (`Update text…` vs `Re-read from file`) switch on `kind` alone.
 */
export type WorkshopExcerptSource =
  | { kind: 'manual' }
  | {
      kind: 'editor-selection';
      /** `document.uri.toString()` of the verified source document. */
      sourceUri: string;
      /** Workspace-relative display path (e.g. `chapters/03.md`). */
      relativePath: string;
      /** 1-based inclusive selection lines, when the host editor supplied them. */
      startLine?: number;
      endLine?: number;
      configuredResource?: WorkshopConfiguredResourceRef;
    }
  | {
      kind: 'file';
      sourceUri: string;
      relativePath: string;
      configuredResource?: WorkshopConfiguredResourceRef;
    };

/** Display path for a sourced excerpt; undefined for manual text. */
export function workshopExcerptSourcePath(source: WorkshopExcerptSource): string | undefined {
  return source.kind === 'manual' ? undefined : source.relativePath;
}

/** Source document URI for a sourced excerpt; undefined for manual text. */
export function workshopExcerptSourceUri(source: WorkshopExcerptSource): string | undefined {
  return source.kind === 'manual' ? undefined : source.sourceUri;
}

const isSelectionLine = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function coerceConfiguredResource(raw: unknown): WorkshopConfiguredResourceRef | undefined {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const candidate = raw as { group?: unknown; path?: unknown };
  return typeof candidate.group === 'string' &&
    isContextPathGroup(candidate.group) &&
    isNonEmptyString(candidate.path)
    ? { group: candidate.group, path: candidate.path }
    : undefined;
}

/**
 * The ONE parser for excerpt-source wire traffic. The payload crosses the
 * webview IPC boundary, so it is validated as `unknown` — a claim that cannot
 * prove its shape degrades to `{ kind: 'manual' }` rather than borrowing a
 * source it cannot demonstrate. An invalid line range is dropped (the kind
 * survives); an invalid configuredResource claim is dropped (re-derivable).
 */
export function coerceWorkshopExcerptSource(raw: unknown): WorkshopExcerptSource {
  if (typeof raw !== 'object' || raw === null) {
    return { kind: 'manual' };
  }
  const candidate = raw as {
    kind?: unknown;
    sourceUri?: unknown;
    relativePath?: unknown;
    startLine?: unknown;
    endLine?: unknown;
    configuredResource?: unknown;
  };
  if (candidate.kind !== 'editor-selection' && candidate.kind !== 'file') {
    return { kind: 'manual' };
  }
  if (!isNonEmptyString(candidate.sourceUri) || !isNonEmptyString(candidate.relativePath)) {
    return { kind: 'manual' };
  }
  const configuredResource = coerceConfiguredResource(candidate.configuredResource);
  if (candidate.kind === 'file') {
    return {
      kind: 'file',
      sourceUri: candidate.sourceUri,
      relativePath: candidate.relativePath,
      ...(configuredResource ? { configuredResource } : {})
    };
  }
  const hasLineRange =
    isSelectionLine(candidate.startLine) &&
    isSelectionLine(candidate.endLine) &&
    candidate.endLine >= candidate.startLine;
  return {
    kind: 'editor-selection',
    sourceUri: candidate.sourceUri,
    relativePath: candidate.relativePath,
    ...(hasLineRange ? { startLine: candidate.startLine as number, endLine: candidate.endLine as number } : {}),
    ...(configuredResource ? { configuredResource } : {})
  };
}

/** The excerpt set in the left rail — the text every tool run works on. */
export interface WorkshopExcerpt {
  text: string;
  /** Monotonic version assigned by the host session aggregate. */
  version: number;
  /** Provenance of the text — the single source of truth (no flat sourceUri/relativePath). */
  source: WorkshopExcerptSource;
  /** Epoch ms when the excerpt was pinned (host-stamped). */
  pinnedAt: number;
  /** Present when the host head-sliced a huge file at pin time. */
  truncation?: WorkshopExcerptTruncation;
}

/** What produced a turn: a deterministic tool run, or a free-text follow-up. */
export type WorkshopTurnKind = 'tool_run' | 'message' | 'divider';

// ─────────────────────────────────────────────────────────────────────────────
// Context attachments (Sprint 12) — the ordered, removable list that replaced
// the single paste-only context brief.
// ─────────────────────────────────────────────────────────────────────────────

/** Who put this attachment in the list. Wizard picks render with a wand. */
export type WorkshopContextAttachmentOrigin = 'writer' | 'wizard';

/** A file attachment carries a head slice, and the UI says so durably. */
export interface WorkshopContextAttachmentTruncation {
  keptWords: number;
  totalWords: number;
}

/**
 * Display-safe attachment metadata as exposed to the webview. Content stays
 * host-side — the pill is the inspectable artifact (label, kind, size,
 * remove control), never a second copy of the text.
 */
export interface WorkshopContextAttachmentSnapshot {
  /** Host-generated stable id; remove routes address this. */
  id: string;
  kind: 'text' | 'file';
  origin: WorkshopContextAttachmentOrigin;
  /** Display label: file basename, or the first words of a text note. */
  label: string;
  words: number;
  /** Workspace-relative display path (file kind only; never absolute). */
  relativePath?: string;
  configuredResource?: WorkshopConfiguredResourceRef;
  truncation?: WorkshopContextAttachmentTruncation;
  /**
   * Text-kind ONLY: the note's full content, so the pill is inspectable —
   * typed notes and wizard briefs have no on-disk home to re-read. File
   * content stays host-side (re-readable, potentially large).
   */
  content?: string;
  /** Epoch ms when attached (host-stamped). */
  addedAt: number;
}

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
  participant: WorkshopTurnParticipant;
  artifact: WorkshopTurnArtifact;
  /** Tool for a tool run or an assistant reply from a direct tool sidecar. */
  toolId?: WorkshopToolId;
  /** Deterministic display label for the tool — never model-generated. */
  toolLabel?: string;
  /** Persona attribution for host turns; tool turns deliberately omit this. */
  personaId?: WorkshopPersonaId;
  /** Deterministic display label for the persona — never model-generated. */
  personaLabel?: string;
  /** Report/sidecar generation this turn belongs to, when applicable. */
  reportTurnId?: string;
  /** Persona-callable capability provenance; raw protocol never crosses this boundary. */
  capability?: WorkshopCapabilityArtifactDetails;
  /** Excerpt version this turn observed or announced. */
  excerptVersion: number;
  /** Strictly parsed actionable findings proposed by a tool report or host turn. */
  actionableFindings?: WorkshopActionableFinding[];
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
  /** Current monotonic excerpt version (zero before the first pin). */
  excerptVersion: number;
  /** Number of excerpt replacements since the last new-session boundary. */
  replacementCount: number;
  /** Ordered context attachments shared with host and tools (Sprint 12). */
  contextAttachments: WorkshopContextAttachmentSnapshot[];
  /** Host update waiting for the next successful retained-host turn. */
  pendingHostUpdate?: {
    excerptVersion?: number;
    /** True when the attachment list changed since the host last saw it. */
    context: boolean;
  };
  /** Host-owned, defensively copied writer task list in explicit order. */
  todos: WorkshopTodoItem[];
  turns: WorkshopTurn[];
  /** Total turns held host-side (>= turns.length). */
  totalTurns: number;
  /** Older turns omitted from this snapshot's window. */
  truncatedTurns: number;
  /**
   * True when any retained host or tool-sidecar conversation remains live.
   * Composer enablement also requires a ready, non-empty pinned excerpt.
   */
  hasConversation: boolean;
  /** The public participant graph. Conversation ids remain host-private. */
  participants: WorkshopParticipantsSnapshot;
  /** Active-target context telemetry, already stripped of private conversation identity. */
  contextBudget?: LabeledContextBudgetSnapshot;
  /** Last selected tool/lens, retained after a completed run for UI restore. */
  selectedToolId?: WorkshopToolId;
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

export interface WorkshopQuickActionPayload {
  /** Tool context that owns this deterministic action label. */
  toolId: WorkshopToolId;
  /** The live report/sidecar generation the action was rendered beneath. */
  reportTurnId: string;
  /** One of the static labels from WORKSHOP_QUICK_ACTIONS_BY_TOOL. */
  label: string;
}

/**
 * Deterministic quick action. The webview sends the label the user clicked;
 * the handler resolves it to the static prompt template and runs the existing
 * retained-conversation follow-up path.
 */
export interface WorkshopQuickActionMessage extends MessageEnvelope<WorkshopQuickActionPayload> {
  type: MessageType.WORKSHOP_QUICK_ACTION;
}

/** Free-text follow-up: continues the session's retained conversation. */
export interface WorkshopSendMessagePayload {
  text: string;
}

export interface WorkshopSendMessageMessage extends MessageEnvelope<WorkshopSendMessagePayload> {
  type: MessageType.WORKSHOP_SEND_MESSAGE;
}

/** Explicit writer action: invite a second persona into a retained guest sidecar. */
export interface WorkshopInviteGuestPayload {
  personaId: WorkshopPersonaId;
  openingMessage: string;
}

export interface WorkshopInviteGuestMessage extends MessageEnvelope<WorkshopInviteGuestPayload> {
  type: MessageType.WORKSHOP_INVITE_GUEST;
}

/** Explicit writer action: dispose a retained guest sidecar. */
export interface WorkshopDismissGuestPayload {
  personaId: WorkshopPersonaId;
}

export interface WorkshopDismissGuestMessage extends MessageEnvelope<WorkshopDismissGuestPayload> {
  type: MessageType.WORKSHOP_DISMISS_GUEST;
}

export interface WorkshopSelectPersonaPayload {
  personaId: WorkshopPersonaId;
}

export interface WorkshopSelectPersonaMessage extends MessageEnvelope<WorkshopSelectPersonaPayload> {
  type: MessageType.WORKSHOP_SELECT_PERSONA;
}

/** Payload is deliberately the target itself: no second routing envelope. */
export interface WorkshopSetChatTargetMessage extends MessageEnvelope<WorkshopChatTarget> {
  type: MessageType.WORKSHOP_SET_CHAT_TARGET;
}

export interface WorkshopSetExcerptPayload {
  text: string;
  /**
   * Provenance claim. Absent or unprovable shapes degrade to
   * `{ kind: 'manual' }` host-side via `coerceWorkshopExcerptSource`.
   */
  source?: WorkshopExcerptSource;
}

export interface WorkshopSetExcerptMessage extends MessageEnvelope<WorkshopSetExcerptPayload> {
  type: MessageType.WORKSHOP_SET_EXCERPT;
}

/** Add a typed/pasted context note; the host derives the label and word count. */
export interface WorkshopAddContextTextPayload {
  text: string;
}

export interface WorkshopAddContextTextMessage
  extends MessageEnvelope<WorkshopAddContextTextPayload> {
  type: MessageType.WORKSHOP_ADD_CONTEXT_TEXT;
}

/**
 * Add a file attachment via the host's file picker (Sprint 12; the Context
 * Selector modal's "Explore project folders…" escape hatch reuses this
 * route). Zero payload — the dialog IS the input.
 */
export interface WorkshopAddContextFileMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.WORKSHOP_ADD_CONTEXT_FILE;
}

export interface WorkshopRemoveContextAttachmentPayload {
  id: string;
}

export interface WorkshopRemoveContextAttachmentMessage
  extends MessageEnvelope<WorkshopRemoveContextAttachmentPayload> {
  type: MessageType.WORKSHOP_REMOVE_CONTEXT_ATTACHMENT;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Selector modal (Sprint 12 Phase 4) — browse/search the configured
// resource catalog and attach by canonical { group, path }. Display-safe
// resolver paths only; no absolute path ever crosses this contract.
// ─────────────────────────────────────────────────────────────────────────────

/** One configured resource as the modal browses it. */
export interface WorkshopContextCatalogEntry {
  group: ContextPathGroup;
  /** Resolver's display-safe workspace-relative path — the canonical key. */
  path: string;
  label: string;
  /** Byte size from catalog admission; word counts happen at attach time. */
  sizeBytes: number;
}

/** Sent on modal open: "give me the configured resource catalog". */
export interface WorkshopRequestContextCatalogMessage
  extends MessageEnvelope<Record<string, never>> {
  type: MessageType.WORKSHOP_REQUEST_CONTEXT_CATALOG;
}

export interface WorkshopContextCatalogPayload {
  entries: WorkshopContextCatalogEntry[];
}

export interface WorkshopContextCatalogMessage
  extends MessageEnvelope<WorkshopContextCatalogPayload> {
  type: MessageType.WORKSHOP_CONTEXT_CATALOG;
}

/**
 * Content search over the configured catalog (name matching is client-side —
 * the webview already holds the catalog). Runs under the same byte/file
 * bounds as the persona capability's resource.search.
 */
export interface WorkshopSearchContextResourcesPayload {
  query: string;
}

export interface WorkshopSearchContextResourcesMessage
  extends MessageEnvelope<WorkshopSearchContextResourcesPayload> {
  type: MessageType.WORKSHOP_SEARCH_CONTEXT_RESOURCES;
}

export interface WorkshopContextSearchResultsPayload {
  query: string;
  matches: WorkshopConfiguredResourceRef[];
  /** True when a file/byte bound stopped the scan early. */
  bounded: boolean;
}

export interface WorkshopContextSearchResultsMessage
  extends MessageEnvelope<WorkshopContextSearchResultsPayload> {
  type: MessageType.WORKSHOP_CONTEXT_SEARCH_RESULTS;
}

/** Attach selected configured resources, in the writer's selection order. */
export interface WorkshopAddContextResourcesPayload {
  items: WorkshopConfiguredResourceRef[];
}

/** Set the excerpt from ONE configured resource picked in the modal. */
export interface WorkshopSetExcerptResourceMessage
  extends MessageEnvelope<WorkshopConfiguredResourceRef> {
  type: MessageType.WORKSHOP_SET_EXCERPT_RESOURCE;
}

/**
 * Run the Context wizard (Sprint 12): the sidebar Context lane's generation
 * pipeline behind Workshop-scoped routes and the 'workshop-context' streaming
 * domain. One run at a time; results land as wizard-tagged attachments
 * through the standard add path. Zero payload — session state IS the input.
 */
export interface WorkshopRunContextWizardMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.WORKSHOP_RUN_CONTEXT_WIZARD;
}

export interface WorkshopAddContextResourcesMessage
  extends MessageEnvelope<WorkshopAddContextResourcesPayload> {
  type: MessageType.WORKSHOP_ADD_CONTEXT_RESOURCES;
}

export type WorkshopTodoAction =
  | { action: 'add'; sourceTurnId: string; findingKey: string }
  | { action: 'edit'; todoId: string; text: string }
  | { action: 'complete'; todoId: string }
  | { action: 'reopen'; todoId: string }
  | { action: 'dismiss'; todoId: string }
  | { action: 'reorder'; todoId: string; direction: 'up' | 'down' };

export interface WorkshopTodoActionMessage extends MessageEnvelope<WorkshopTodoAction> {
  type: MessageType.WORKSHOP_TODO_ACTION;
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
 * "Re-read from file" (Sprint 12): re-run the original read + head-slice
 * against the file-backed excerpt's stored sourceUri. Unchanged content
 * no-ops with a status line; changed content lands as a normal revision
 * (version bump, revision frame, no memory reset). Zero payload — the
 * host's own session state IS the input.
 */
export interface WorkshopRereadExcerptMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.WORKSHOP_REREAD_EXCERPT;
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
