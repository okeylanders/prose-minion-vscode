/** Workshop session, excerpt, turn, todo, and persistence-facing contracts. */

import { MessageEnvelope, MessageType } from '../base';
import { TokenUsage } from '../tokenUsage';
import { UrlCitation } from '../citations';
import type { LabeledContextBudgetSnapshot } from '../inferenceContext';
import type {
  WorkshopAnalysisInputProvenance,
  WorkshopCapabilityArtifactDetails
} from '../../workshopCapabilities';
import { ContextPathGroup, isContextPathGroup } from '../../context';
import {
  WorkshopConfiguredResourceRef,
  WorkshopContextAttachmentSnapshot,
  WorkshopMessageAttachmentSnapshot
} from './context';
import {
  WorkshopParticipantsSnapshot,
  WorkshopPersonaId,
  WorkshopToolId
} from './participants';
import {
  WorkshopConversationBehavior,
  WorkshopConversationBehaviorTransition,
  WorkshopWebResearchSettings,
  WorkshopWriterProfile
} from './settings';
import {
  WorkshopStandingDirectiveChange,
  WorkshopStandingDirectiveSummary
} from './standingDirectives';
import {
  WorkshopTurnWidgetCommit,
  WorkshopWidgetConfigSummary,
  WorkshopWidgetId,
  WorkshopWidgetRecommendation
} from './widgets';

/**
 * How this Workshop session was started (Sprint 13A; locked by ADR 2026-07-25).
 *
 * `null` means the writer has not chosen a path yet — the center shows the path
 * chooser. Scope is ASSIGNED by an explicit writer action (choosing a path,
 * pinning an excerpt, running a tool), never DERIVED from excerpt presence at
 * read time.
 *
 * It is also IMMUTABLE once the room has a memory: a session that has been
 * talked to keeps the path it was started on, because changing it would mean
 * asking a participant to un-read what it holds. Changing path means a new
 * session, which carries the excerpt and context attachments across.
 */
export type WorkshopSessionScope = 'excerpt' | 'open' | null;

/** The two scopes a writer can explicitly select; `null` is never requested. */
export type WorkshopSelectableSessionScope = Exclude<WorkshopSessionScope, null>;

export function isWorkshopSelectableSessionScope(
  value: unknown
): value is WorkshopSelectableSessionScope {
  return value === 'excerpt' || value === 'open';
}

export function isWorkshopSessionScope(value: unknown): value is WorkshopSessionScope {
  return value === null || isWorkshopSelectableSessionScope(value);
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
    })
  | (WorkshopTodoSourceBase & {
      kind: 'guest_turn';
      personaId: WorkshopPersonaId;
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
  | 'context_change'
  | 'standing_directive_change'
  | 'session_start'
  | 'session_resume'
  /**
   * LEGACY (Sprint 13A, retired by ADR 2026-07-25). A mid-conversation
   * session-scope transition. Scope is now immutable once the room has a
   * memory, so no new turn of this artifact is ever minted — but real
   * transcripts written before the lock contain them, and they must keep
   * parsing and rendering as the history they are.
   */
  | 'scope_change';

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

/** Display-safe source provenance for the session snapshot; never exposes a host URI. */
export type WorkshopExcerptSourceSnapshot =
  | { kind: 'manual' }
  | {
      kind: 'editor-selection';
      relativePath: string;
      startLine?: number;
      endLine?: number;
      configuredResource?: WorkshopConfiguredResourceRef;
    }
  | {
      kind: 'file';
      relativePath: string;
      configuredResource?: WorkshopConfiguredResourceRef;
    };

/** Display path for a sourced excerpt; undefined for manual text. */
export function workshopExcerptSourcePath(
  source: WorkshopExcerptSource | WorkshopExcerptSourceSnapshot
): string | undefined {
  return source.kind === 'manual' ? undefined : source.relativePath;
}

/**
 * The passage's short display title (Sprint 13A) — the file's base name without
 * its extension, or "Pasted passage" for typed text.
 *
 * Shared by the aggregate's scope dividers and every webview surface that names
 * the excerpt (path chooser, scope strip, rail) so one passage never appears
 * under two different names in the same room.
 */
export function workshopExcerptTitle(
  source: WorkshopExcerptSource | WorkshopExcerptSourceSnapshot
): string {
  const relativePath = workshopExcerptSourcePath(source);
  if (relativePath === undefined) {
    return 'Pasted passage';
  }
  const base = relativePath.split(/[\\/]/).filter(Boolean).pop() ?? relativePath;
  return base.replace(/\.[^.]+$/, '') || base;
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
  /** SHA-256 of the original source bytes, used only to detect file revisions. */
  sourceFingerprint?: string;
}

/** Webview projection of an excerpt. Source URIs remain host-private. */
export type WorkshopExcerptSnapshot = Omit<WorkshopExcerpt, 'source' | 'sourceFingerprint'> & {
  source: WorkshopExcerptSourceSnapshot;
};

/** What produced a turn: a deterministic tool run, or a free-text follow-up. */
export type WorkshopTurnKind = 'tool_run' | 'message' | 'divider';

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
  /** Host-composed inputs delivered to an analysis report, direct or persona-run. */
  analysisInputs?: {
    excerpt: WorkshopAnalysisInputProvenance;
    context: WorkshopAnalysisInputProvenance;
  };
  /** Excerpt version this turn observed or announced. */
  excerptVersion: number;
  /** Strictly parsed actionable findings proposed by a tool report or host turn. */
  actionableFindings?: WorkshopActionableFinding[];
  /**
   * One-shot thread-artifacts belonging to THIS writer room turn.
   * Display-safe refs only; host-private bodies are reconstructed for each
   * host/guest through room delivery. Ids are the `ta-N` addresses.
   */
  messageAttachments?: WorkshopMessageAttachmentSnapshot[];
  content: string;
  /** Epoch ms when the turn was appended (host-stamped). */
  timestamp: number;
  /** Usage for assistant turns, when the provider reported it. */
  usage?: TokenUsage;
  /** Provider-returned web sources; model-authored [n] markers remain ordinary text. */
  citations?: UrlCitation[];
  /** True when the response stopped at the max-token limit (assistant turns). */
  truncated?: boolean;
  /**
   * Effective conversation behavior stamped on persona-directed writer turns
   * and their persona replies (ADR 2026-07-20 §3) — keeps a restored
   * transcript honest when settings changed mid-session. Tool turns omit it.
   */
  behavior?: WorkshopConversationBehavior;
  /**
   * Coalesced writer-selected behavior transition persisted with the first
   * committed writer turn after a mode, expression, or relational-depth
   * change. Never a synthetic chat message.
   */
  behaviorTransition?: WorkshopConversationBehaviorTransition;
  /**
   * Widget commit that produced this writer turn (ADR 2026-07-22). Display
   * decoration for the presentation-only chip; the model never sees it.
   */
  widgetCommit?: WorkshopTurnWidgetCommit;
  /** Host-authored install/shift/remove marker for a standing directive. */
  standingDirectiveChange?: WorkshopStandingDirectiveChange;
  /**
   * Strictly parsed widget recommendation a persona attached to this turn.
   * Presentation-only; malformed or non-live recommendations are rejected
   * wholesale host-side and never reach this field.
   */
  widgetRecommendation?: WorkshopWidgetRecommendation;
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
  excerpt?: WorkshopExcerptSnapshot;
  /**
   * Explicit session scope (Sprint 13A). Center view, header meta, composer,
   * and rail all key off THIS — never off `excerpt` being present.
   */
  scope: WorkshopSessionScope;
  /**
   * Aggregate-owned participant-subject policy (ADR 2026-07-26): true when a
   * host or persona guest may speak in the current scope. The webview consumes
   * this result; it does not re-derive scope/excerpt validity.
   */
  participantSubjectReady: boolean;
  /**
   * The passage the writer set aside when switching to open conversation.
   * Shelved, not deleted: re-pinning restores this exact version.
   */
  shelvedExcerpt?: WorkshopExcerptSnapshot;
  /** Current monotonic excerpt version (zero before the first pin). */
  excerptVersion: number;
  /** Number of excerpt replacements since the last new-session boundary. */
  replacementCount: number;
  /** Ordered context attachments shared with host and tools (Sprint 12). */
  contextAttachments: WorkshopContextAttachmentSnapshot[];
  /**
   * Attachments staged for the writer's NEXT composer message (Phase 6B).
   * They ride that one message as thread-artifacts, then leave this list.
   */
  pendingMessageAttachments: WorkshopMessageAttachmentSnapshot[];
  /** Host update waiting for the next successful retained-host turn. */
  pendingHostUpdate?: {
    excerptVersion?: number;
    /** True when the attachment list changed since the host last saw it. */
    context: boolean;
  };
  /** Host-owned, defensively copied writer task list in explicit order. */
  todos: WorkshopTodoItem[];
  /** Bounded widget identities for chips in the visible turn window. */
  widgetConfigs: WorkshopWidgetConfigSummary[];
  /** Active passage-scoped prose directives; one entry per closed family. */
  standingDirectives: WorkshopStandingDirectiveSummary[];
  turns: WorkshopTurn[];
  /** Total turns held host-side (>= turns.length). */
  totalTurns: number;
  /** Older turns omitted from this snapshot's window. */
  truncatedTurns: number;
  /**
   * True when any participant holds a conversation — host, tool sidecar, or
   * persona guest. This is ALSO the scope lock (ADR 2026-07-25): every surface
   * that offers to change the session path must hide that offer once this is
   * true, and point at a new session instead.
   *
   * Deliberately not "does the room have turns": every session records a
   * `session_start` marker before the writer acts, so a turn-based test would
   * report a locked room the instant one was created.
   */
  roomHasMemory: boolean;
  /** The public participant graph. Conversation ids remain host-private. */
  participants: WorkshopParticipantsSnapshot;
  /** The room's current writer-owned conversation behavior (ADR 2026-07-20). */
  conversationBehavior: WorkshopConversationBehavior;
  /** Active-target context telemetry, already stripped of private conversation identity. */
  contextBudget?: LabeledContextBudgetSnapshot;
  /** Last selected tool/lens, retained after a completed run for UI restore. */
  selectedToolId?: WorkshopToolId;
  /** Tool currently running, if any. */
  activeToolId?: WorkshopToolId;
  /** Streaming requestId of the in-flight run, if any (stream reattach after reload). */
  activeRequestId?: string;
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

// ─────────────────────────────────────────────────────────────────────────────
// Session scope (Sprint 13A) — the path chooser and both reversals. Every one
// of these is a context transition INSIDE one retained session, never a new
// session and never a deletion.
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkshopSetSessionScopePayload {
  scope: WorkshopSelectableSessionScope;
}

/**
 * Choose (or change) the session path. `open` shelves any pinned passage;
 * `excerpt` restores a shelved one. Rejected while a run is in flight.
 */
export interface WorkshopSetSessionScopeMessage
  extends MessageEnvelope<WorkshopSetSessionScopePayload> {
  type: MessageType.WORKSHOP_SET_SESSION_SCOPE;
}

/**
 * Re-pin the shelved passage without leaving the open conversation. Zero
 * payload — the shelf holds exactly one version.
 */
export interface WorkshopRepinExcerptMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.WORKSHOP_REPIN_EXCERPT;
}

/** Set the excerpt from ONE configured resource picked in the modal. */
export interface WorkshopSetExcerptResourceMessage
  extends MessageEnvelope<WorkshopConfiguredResourceRef> {
  type: MessageType.WORKSHOP_SET_EXCERPT_RESOURCE;
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
export interface WorkshopResetSessionPayload {
  /**
   * Clear the WORKING SET too — the pinned excerpt, the shelf, and every
   * context attachment (Sprint 13A follow-up).
   *
   * The ordinary new-session boundary deliberately carries those across so the
   * writer can keep workshopping the same passage in a fresh room. This asks
   * for the other thing: an empty room. Saved sessions on disk are untouched
   * either way — this replaces the live room and its rolling checkpoint, and
   * never deletes a named session.
   */
  clearWorkingSet?: boolean;
}

export interface WorkshopResetSessionMessage
  extends MessageEnvelope<WorkshopResetSessionPayload> {
  type: MessageType.WORKSHOP_RESET_SESSION;
}

/** Sent on webview mount: "give me the session as the host knows it". */
export interface WorkshopRequestSessionMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.WORKSHOP_REQUEST_SESSION;
}

/**
 * Save the coherent current session. Without `sessionId` this creates a named
 * checkpoint; with it, the host updates that exact checkpoint after verifying
 * it is still the identity of the live room. Titles are never used as identity.
 */
export interface WorkshopSaveSessionMessage extends MessageEnvelope<{
  title: string;
  sessionId?: string;
}> {
  type: MessageType.WORKSHOP_SAVE_SESSION;
}

/** Request tolerant, summary-only session-browser data. */
export interface WorkshopListSessionsMessage extends MessageEnvelope<{
  requestId: string;
  query?: string;
}> {
  type: MessageType.WORKSHOP_LIST_SESSIONS;
}

export interface WorkshopOpenSessionMessage extends MessageEnvelope<{
  sessionId: string;
}> {
  type: MessageType.WORKSHOP_OPEN_SESSION;
}

export interface WorkshopRenameSessionMessage extends MessageEnvelope<{
  sessionId: string;
  title: string;
}> {
  type: MessageType.WORKSHOP_RENAME_SESSION;
}

export interface WorkshopDuplicateSessionMessage extends MessageEnvelope<{
  sessionId: string;
  title?: string;
}> {
  type: MessageType.WORKSHOP_DUPLICATE_SESSION;
}

export interface WorkshopRevealSessionMessage extends MessageEnvelope<{
  sessionId: string;
}> {
  type: MessageType.WORKSHOP_REVEAL_SESSION;
}

export interface WorkshopDeleteSessionMessage extends MessageEnvelope<{
  sessionId: string;
}> {
  type: MessageType.WORKSHOP_DELETE_SESSION;
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
  /** Global writer setting, deliberately outside the serializable session aggregate. */
  writerProfile: WorkshopWriterProfile;
  /** Global web-research preference; deliberately outside the session aggregate. */
  webResearch: WorkshopWebResearchSettings;
  persistence: {
    available: boolean;
    unavailableReason?: 'no-workspace' | 'multi-root';
    /** True when an unreadable current.json is protected from automatic overwrite. */
    currentCheckpointProtected?: boolean;
    /** Non-empty only when product state survived but retained memory did not. */
    degradedConversationKeys: string[];
    /** Display-safe explanation for each participant whose retained memory degraded. */
    degradedConversations?: WorkshopConversationDegradation[];
  };
}

export interface WorkshopConversationDegradation {
  key: string;
  reason: string;
}

/**
 * Full session snapshot plus the current global profile beside it. Posted in
 * reply to WORKSHOP_REQUEST_SESSION and after host-side mutations so the
 * webview can reconcile without ever making profile data part of the session.
 */
export interface WorkshopSessionStateMessage extends MessageEnvelope<WorkshopSessionStatePayload> {
  type: MessageType.WORKSHOP_SESSION_STATE;
}

/** Lightweight, display-safe browser row. Full session content never crosses this route. */
export interface WorkshopSessionSummary {
  sessionId: string;
  title: string;
  fileName: string;
  kind: 'current' | 'named';
  startedAt: number;
  updatedAt: number;
  savedAt?: number;
  timezone: string;
  hostPersonaId: WorkshopPersonaId;
  participantPersonaIds: WorkshopPersonaId[];
  turnCount: number;
  excerptWordCount: number;
  excerptLabel?: string;
  excerptIdentity?: string;
  preview?: string;
  degradedConversationKeys?: string[];
  /**
   * The session's scope (Sprint 13A). Absent on rows written before scope
   * existed — the browser says "Scope unknown" rather than guessing.
   */
  scope?: WorkshopSessionScope;
}

export interface WorkshopSessionsDataMessage extends MessageEnvelope<{
  requestId: string;
  available: boolean;
  unavailableReason?: 'no-workspace' | 'multi-root';
  /** A bounded browser read failed; clears pending UI without inventing summaries. */
  error?: string;
  current?: WorkshopSessionSummary;
  sessions: WorkshopSessionSummary[];
  truncated?: boolean;
  /** Content search inspected only a bounded prefix for at least one session. */
  searchTruncated?: boolean;
}> {
  type: MessageType.WORKSHOP_SESSIONS_DATA;
}

export type WorkshopSessionAction =
  | 'new'
  | 'save'
  | 'open'
  | 'rename'
  | 'duplicate'
  | 'reveal'
  | 'delete';

export interface WorkshopSessionActionResultMessage extends MessageEnvelope<{
  action: WorkshopSessionAction;
  ok: boolean;
  message: string;
  session?: WorkshopSessionSummary;
}> {
  type: MessageType.WORKSHOP_SESSION_ACTION_RESULT;
}

/** Actual rolling/named persistence state emitted by the ordered write queue. */
export interface WorkshopSessionSaveStatusMessage extends MessageEnvelope<{
  sessionId: string;
  status: 'saving' | 'saved' | 'error';
  error?: string;
}> {
  type: MessageType.WORKSHOP_SESSION_SAVE_STATUS;
}

/** Consume-once, feature-authored notice after successful checkpoint recovery. */
export interface WorkshopSessionRecoveryNoticeMessage extends MessageEnvelope<{
  code: string;
  widgetId: WorkshopWidgetId;
  configId: string;
  message: string;
}> {
  type: MessageType.WORKSHOP_SESSION_RECOVERY_NOTICE;
}
