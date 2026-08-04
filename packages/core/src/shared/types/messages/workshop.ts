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
import { UrlCitation } from './citations';
import type { LabeledContextBudgetSnapshot } from './inferenceContext';
import type {
  WorkshopAnalysisInputProvenance,
  WorkshopCapabilityArtifactDetails
} from '../workshopCapabilities';
import { ContextPathGroup, isContextPathGroup } from '../context';
import type { CancelRequestPayload } from './streaming';

/**
 * Wire id for a Workshop tool — the design catalog's 14 tools mapped 1:1 onto
 * the existing analysis contracts: `dialogue`, `prose`, and the twelve
 * WritingToolsFocus modes. The handler routes on this; it never invents tools.
 */
export type WorkshopToolId = 'dialogue' | 'prose' | WritingToolsFocus;

/**
 * Wire id for a Conversation Widget (ADR 2026-07-22). The canonical catalog —
 * labels, rails, groups, and `live` availability — is
 * shared/constants/workshopWidgets.ts; handlers validate against it and the
 * thread-artifact `kind` is derived from it (`widget:<id>`), so the id IS the
 * frame identity. Ids for unshipped widgets exist so the browser can show an
 * honest roadmap; only `live` ids may launch, commit, or be recommended.
 */
export type WorkshopWidgetId =
  | 'gesture-playground'
  | 'show-vs-tell'
  | 'creative-variations'
  | 'topic-relationship'
  | 'genre-relationship'
  | 'writers-dictionary'
  | 'lexical-gravity'
  | 'prose-controller'
  | 'lens-blending'
  | 'learner-english'
  | 'learner-craft'
  | 'decisions'
  | 'scratch-pad';

/** Closed family key carried by the standing prose-directive frame. */
export type WorkshopStandingDirectiveFamily =
  | 'lexical-gravity'
  | 'prose-controller';

export type WorkshopLexicalGravityReach = 1 | 2 | 3;

export interface WorkshopLexicalGravityWordBucket {
  nouns: string[];
  verbs: string[];
  modifiers: string[];
}

export interface WorkshopLexicalGravityCliche {
  worn: string;
  fresh: string;
}

export interface WorkshopLexicalGravitySubstitutions {
  plan: string;
  conflict: string;
  agreement: string;
  turning: string;
  ending: string;
}

/**
 * One complete, deterministic lexical field. Built-ins and project-authored
 * fields share this contract so choosing a generated take makes every panel
 * tab immediately available without another model call.
 */
export interface WorkshopLexicalGravityLens {
  version: 1;
  slug: string;
  name: string;
  source: 'built-in' | 'project';
  /** Writer-entered subject that produced a project lens. */
  originQuery?: string;
  /** Human-readable angle distinguishing multiple generated takes. */
  variant?: string;
  description?: string;
  degrees: {
    1: WorkshopLexicalGravityWordBucket;
    2: WorkshopLexicalGravityWordBucket;
    3: WorkshopLexicalGravityWordBucket;
  };
  gradient: string[];
  cliches: WorkshopLexicalGravityCliche[];
  substitutions: WorkshopLexicalGravitySubstitutions;
  metaphor: string;
  sample: string;
}

export interface WorkshopLexicalGravityPreview {
  /** Stable key of the four writer-facing values this preview demonstrates. */
  configKey: string;
  /** The prose transformed by this preview; optional only for older checkpoints. */
  sourceText?: string;
  text: string;
}

/** Four authored controls plus the resolved lens and optional cached preview. */
export interface WorkshopLexicalGravityDraft {
  lensSlug: string;
  weight: number;
  reach: WorkshopLexicalGravityReach;
  metaphorPull: boolean;
  resolvedLens: WorkshopLexicalGravityLens;
  preview?: WorkshopLexicalGravityPreview;
}

export interface WorkshopLexicalGravityRecommendationSeed {
  lensSlug?: string;
  weight?: number;
  reach?: WorkshopLexicalGravityReach;
  metaphorPull?: boolean;
}

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

/** The one explicit routing choice behind the Workshop composer. */
export type WorkshopChatTarget =
  | { kind: 'host' }
  | { kind: 'tool'; toolId: WorkshopToolId }
  | { kind: 'personaGuest'; personaId: WorkshopPersonaId };

// ─────────────────────────────────────────────────────────────────────────────
// Conversation behavior (ADR 2026-07-20) — the writer-owned, room-level
// interaction contract. One transactional object; persona identity never
// changes with it.
// ─────────────────────────────────────────────────────────────────────────────

/** Writer-selected interaction posture for persona conversations. */
export type WorkshopInteractionMode = 'analysis' | 'balanced' | 'conversational';

/** Writer-selected persona expression volume — never an identity switch. */
export type WorkshopPersonaExpressionLevel = 'subtle' | 'full' | 'amplified';

/** Writer-selected ceiling for contextual emotional and personal inference. */
export type WorkshopRelationalDepth = 'reserved' | 'attuned' | 'reflective';

/**
 * Room-level conversation behavior. Host and guest persona turns interpret the
 * same current object through their own stable profiles; deterministic tool
 * runs and tool sidecars never receive it.
 */
export interface WorkshopConversationBehavior {
  interactionMode: WorkshopInteractionMode;
  expressionLevel: WorkshopPersonaExpressionLevel;
  relationalDepth: WorkshopRelationalDepth;
  carryCuesThroughSession: boolean;
  /** Encourage one relevant tool or live-widget assist when it materially helps. */
  proactiveAssistance: boolean;
}

/**
 * The approved complete default (ADR 2026-07-20 §3). Fail-closed target for
 * every IPC/hydration boundary — the host never constructs a partially
 * defaulted combination whose behavior was not designed.
 */
export const DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR: Readonly<WorkshopConversationBehavior> =
  Object.freeze({
    interactionMode: 'balanced',
    expressionLevel: 'full',
    relationalDepth: 'attuned',
    carryCuesThroughSession: true,
    proactiveAssistance: true
  });

/** Durable host preference; inferred cue/attunement memory is intentionally separate. */
export const WORKSHOP_CONVERSATION_BEHAVIOR_SETTING = Object.freeze({
  section: 'proseMinion',
  key: 'workshop.conversationBehavior'
});

export function workshopConversationBehaviorsEqual(
  left: WorkshopConversationBehavior,
  right: WorkshopConversationBehavior
): boolean {
  return left.interactionMode === right.interactionMode
    && left.expressionLevel === right.expressionLevel
    && left.relationalDepth === right.relationalDepth
    && left.carryCuesThroughSession === right.carryCuesThroughSession
    && left.proactiveAssistance === right.proactiveAssistance;
}

/** Writer-authored global context shared only with Workshop personas. */
export interface WorkshopWriterProfile {
  enabled: boolean;
  preferredAddress: string;
  bio: string;
}

export const DEFAULT_WORKSHOP_WRITER_PROFILE: Readonly<WorkshopWriterProfile> = Object.freeze({
  enabled: false,
  preferredAddress: '',
  bio: ''
});

export const WORKSHOP_WRITER_PROFILE_LIMITS = Object.freeze({
  preferredAddress: 80,
  bio: 1_000
});

export const WORKSHOP_WRITER_PROFILE_SETTING = Object.freeze({
  section: 'proseMinion',
  key: 'workshop.writerProfile'
});

/** Optional live-web capability for persona conversations; deterministic tools stay offline. */
export interface WorkshopWebResearchSettings {
  enabled: boolean;
}

export const DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS: Readonly<WorkshopWebResearchSettings> =
  Object.freeze({ enabled: false });

export const WORKSHOP_WEB_RESEARCH_SETTING = Object.freeze({
  section: 'proseMinion',
  key: 'workshop.webResearch'
});

/** Fail closed: only the complete one-field setting shape may enable research. */
export function isValidWorkshopWebResearchSettings(raw: unknown): raw is WorkshopWebResearchSettings {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    && Object.keys(raw).length === 1 && typeof (raw as { enabled?: unknown }).enabled === 'boolean';
}

/** Coerce untrusted settings to the default-off live-web capability. */
export function coerceWorkshopWebResearchSettings(raw: unknown): WorkshopWebResearchSettings {
  return isValidWorkshopWebResearchSettings(raw)
    ? { enabled: (raw as { enabled: boolean }).enabled }
    : { ...DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS };
}

/** Compare the value rather than allocation identity for settings synchronization. */
export function workshopWebResearchSettingsEqual(
  left: WorkshopWebResearchSettings,
  right: WorkshopWebResearchSettings
): boolean {
  return left.enabled === right.enabled;
}

export function isValidWorkshopWriterProfile(raw: unknown): raw is WorkshopWriterProfile {
  if (typeof raw !== 'object' || raw === null) {
    return false;
  }
  const allowedKeys = new Set(['enabled', 'preferredAddress', 'bio']);
  const keys = Object.keys(raw);
  if (keys.length !== allowedKeys.size || keys.some((key) => !allowedKeys.has(key))) {
    return false;
  }
  const candidate = raw as {
    enabled?: unknown;
    preferredAddress?: unknown;
    bio?: unknown;
  };
  return typeof candidate.enabled === 'boolean'
    && typeof candidate.preferredAddress === 'string'
    && typeof candidate.bio === 'string'
    && candidate.preferredAddress.trim().length
      <= WORKSHOP_WRITER_PROFILE_LIMITS.preferredAddress
    && candidate.bio.trim().length <= WORKSHOP_WRITER_PROFILE_LIMITS.bio;
}

/**
 * Validate the complete profile and normalize its outer whitespace. Partial,
 * overlong, unknown-key, or mistyped objects fail closed to disabled/empty.
 */
export function coerceWorkshopWriterProfile(raw: unknown): WorkshopWriterProfile {
  if (!isValidWorkshopWriterProfile(raw)) {
    return { ...DEFAULT_WORKSHOP_WRITER_PROFILE };
  }
  return {
    enabled: raw.enabled,
    preferredAddress: raw.preferredAddress.trim(),
    bio: raw.bio.trim()
  };
}

export function isWorkshopWriterProfileActive(profile: WorkshopWriterProfile): boolean {
  return profile.enabled && (profile.preferredAddress.length > 0 || profile.bio.length > 0);
}

export function workshopWriterProfilesEqual(
  left: WorkshopWriterProfile,
  right: WorkshopWriterProfile
): boolean {
  return left.enabled === right.enabled
    && left.preferredAddress === right.preferredAddress
    && left.bio === right.bio;
}

/**
 * Prompt-effective equality: every inactive profile emits no frame, while
 * active profiles are equal only when their writer-authored content matches.
 */
export function workshopWriterProfilePromptsEqual(
  left: WorkshopWriterProfile,
  right: WorkshopWriterProfile
): boolean {
  const leftActive = isWorkshopWriterProfileActive(left);
  const rightActive = isWorkshopWriterProfileActive(right);
  return leftActive === rightActive
    && (!leftActive || workshopWriterProfilesEqual(left, right));
}

/** Code-owned deterministic UI labels — never model-generated. */
export const WORKSHOP_INTERACTION_MODE_LABELS: Readonly<Record<WorkshopInteractionMode, string>> =
  Object.freeze({
    analysis: 'Analyze',
    balanced: 'Balanced',
    conversational: 'Converse'
  });

export const WORKSHOP_RELATIONAL_DEPTH_LABELS: Readonly<Record<WorkshopRelationalDepth, string>> =
  Object.freeze({
    reserved: 'Reserved',
    attuned: 'Attuned',
    reflective: 'Reflective'
  });

export function isWorkshopInteractionMode(value: unknown): value is WorkshopInteractionMode {
  return value === 'analysis' || value === 'balanced' || value === 'conversational';
}

export function isWorkshopPersonaExpressionLevel(
  value: unknown
): value is WorkshopPersonaExpressionLevel {
  return value === 'subtle' || value === 'full' || value === 'amplified';
}

export function isWorkshopRelationalDepth(value: unknown): value is WorkshopRelationalDepth {
  return value === 'reserved' || value === 'attuned' || value === 'reflective';
}

/**
 * The ONE parser for conversation-behavior wire traffic. The object is
 * validated as a whole: a missing, unknown, or mistyped field fails the
 * COMPLETE object closed to the approved default rather than inventing a
 * per-field fallback combination.
 */
export function coerceWorkshopConversationBehavior(raw: unknown): WorkshopConversationBehavior {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR };
  }
  const allowedKeys = new Set([
    'interactionMode',
    'expressionLevel',
    'relationalDepth',
    'carryCuesThroughSession',
    'proactiveAssistance'
  ]);
  if (Object.keys(raw).some((key) => !allowedKeys.has(key))) {
    return { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR };
  }
  const candidate = raw as {
    interactionMode?: unknown;
    expressionLevel?: unknown;
    relationalDepth?: unknown;
    carryCuesThroughSession?: unknown;
    proactiveAssistance?: unknown;
  };
  // Normalize behavior objects written before 02B-A without discarding the
  // writer's other explicit choices. The contributed schema requires the
  // field for every newly written value.
  const proactiveAssistance = candidate.proactiveAssistance === undefined
    ? DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR.proactiveAssistance
    : candidate.proactiveAssistance;
  if (
    !isWorkshopInteractionMode(candidate.interactionMode) ||
    !isWorkshopPersonaExpressionLevel(candidate.expressionLevel) ||
    !isWorkshopRelationalDepth(candidate.relationalDepth) ||
    typeof candidate.carryCuesThroughSession !== 'boolean' ||
    typeof proactiveAssistance !== 'boolean'
  ) {
    return { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR };
  }
  return {
    interactionMode: candidate.interactionMode,
    expressionLevel: candidate.expressionLevel,
    relationalDepth: candidate.relationalDepth,
    carryCuesThroughSession: candidate.carryCuesThroughSession,
    proactiveAssistance
  };
}

/**
 * Trusted transition metadata: the room's system-prompt behavior changed
 * between the last committed persona reply and the writer turn this rides
 * with. Multiple selections before the next persona turn coalesce into one
 * transition; a selection that never governed a committed turn is not
 * transcript history.
 */
export interface WorkshopConversationBehaviorTransition {
  from: Pick<
    WorkshopConversationBehavior,
    'interactionMode' | 'expressionLevel' | 'relationalDepth'
  >;
  to: Pick<
    WorkshopConversationBehavior,
    'interactionMode' | 'expressionLevel' | 'relationalDepth'
  >;
  reason: 'writer-selected';
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Message attachments — one-shot writer thread-artifacts (Sprint 12 Phase 6B;
// ADR 2026-07-18). They belong to exactly ONE room turn inside a
// `<thread-artifact id="ta-N">` frame and are delivered once per host/guest
// through room offsets. They have no standing budget and remain addressable by
// their stable host-minted id. Direct tool turns stay private.
// ─────────────────────────────────────────────────────────────────────────────

/** A message attachment carries a head slice past its cap, and the UI says so. */
export interface WorkshopMessageAttachmentTruncation {
  keptWords: number;
  totalWords: number;
}

/**
 * Display-safe pending/shipped message-attachment metadata. Content stays
 * host-side; the pill (and later the manifest row) is the inspectable
 * artifact. The id is the ADR's `ta-N` surgery/manifest address.
 */
export interface WorkshopMessageAttachmentSnapshot {
  /** Host-minted stable thread-artifact id (`ta-N`). */
  id: string;
  /** Display label: file basename. */
  label: string;
  words: number;
  /** Workspace-relative display path (never absolute). */
  relativePath?: string;
  configuredResource?: WorkshopConfiguredResourceRef;
  truncation?: WorkshopMessageAttachmentTruncation;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation Widgets (ADR 2026-07-22; Sprint 01 widget host + Gesture
// Playground). A widget is played BEFORE it commits: the pre-commit Draft is
// local to the modal, the commit is one atomic host route, and the full Draft
// persists by stable `wc-N` id so the transcript chip re-hydrates the exact
// authoring surface (config, not just output, is session-owned).
// ─────────────────────────────────────────────────────────────────────────────

/** One group of generated gesture directions ("The eyes", "Hands & body", …). */
export interface WorkshopGestureMenuGroup {
  heading: string;
  options: string[];
}

/**
 * Host-resolved source material a widget can read without asking a persona to
 * copy it into the recommendation. References remain display-safe across IPC;
 * the excerpt and attachment bodies never leave host-owned session state until
 * the writer deliberately generates.
 */
export type WorkshopWidgetSourceReference =
  | { kind: 'active-excerpt' }
  | { kind: 'context-attachment'; attachmentId: string };

/**
 * The Gesture Playground authoring state. `menu` is the generated exploration
 * cloud — persisted so a chip re-opens the exact surface. Kept directions and
 * the note always shape the one-shot artifact; the writer may also explicitly
 * include the full dictionary as room-wide reference material.
 */
export interface WorkshopGestureDraft {
  targetPhrase: string;
  writerInstructions: string;
  contextText: string;
  characterNotes: string;
  sourceReferences: WorkshopWidgetSourceReference[];
  /** Writer-facing semantic scan generated before the menu in the same call. */
  dictionaryMarkdown: string;
  /** Validated menu generated from the same composite response as the dictionary. */
  menu: WorkshopGestureMenuGroup[];
  /** The directions the writer kept — exact option strings, order preserved. */
  selections: string[];
  note: string;
  /** Opt-in: deliver the full dictionary once to every host/guest for this room turn. */
  includeDictionaryInCommit: boolean;
}

/**
 * A persisted widget authoring config. Ids are host-minted `wc-N` (monotonic,
 * never reused — the third identity beside turn ids and `ta-N` artifact ids).
 * One-shot configs stay at revision 1; standing widgets edit-in-place and
 * increment (Sprint 02). Clone-and-recommit mints a NEW config linked by
 * `clonedFromConfigId`.
 */
interface WorkshopWidgetConfigSnapshotBase {
  id: string;
  widgetId: WorkshopWidgetId;
  revision: number;
  clonedFromConfigId?: string;
  /** Set when the commit lands; a config without these is an uncommitted retry token. */
  committedTurnId?: string;
  artifactId?: string;
  directiveId?: string;
  /** Epoch ms when the config was created (host-stamped). */
  createdAt: number;
}

export interface WorkshopGestureWidgetConfigSnapshot
  extends WorkshopWidgetConfigSnapshotBase {
  widgetId: 'gesture-playground';
  draft: WorkshopGestureDraft;
}

export interface WorkshopLexicalGravityWidgetConfigSnapshot
  extends WorkshopWidgetConfigSnapshotBase {
  widgetId: 'lexical-gravity';
  draft: WorkshopLexicalGravityDraft;
}

/** Earned persisted union: each widget owns its exact authoring-state codec. */
export type WorkshopWidgetConfigSnapshot =
  | WorkshopGestureWidgetConfigSnapshot
  | WorkshopLexicalGravityWidgetConfigSnapshot;

/**
 * Bounded config identity carried in ordinary session snapshots. The full
 * authoring Draft (especially its generated dictionary/menu) is fetched only
 * when the writer opens a committed widget chip.
 */
export type WorkshopGestureWidgetConfigSummary =
  Omit<WorkshopGestureWidgetConfigSnapshot, 'draft'> & {
  targetPhrase: string;
  selectionCount: number;
};

export type WorkshopLexicalGravityWidgetConfigSummary =
  Omit<WorkshopLexicalGravityWidgetConfigSnapshot, 'draft'> & {
  lensName: string;
  lensVariant?: string;
  weight: number;
    reach: WorkshopLexicalGravityReach;
    metaphorPull: boolean;
  };

export type WorkshopWidgetConfigSummary =
  | WorkshopGestureWidgetConfigSummary
  | WorkshopLexicalGravityWidgetConfigSummary;

/** Session-owned identity for one currently active directive family. */
export interface WorkshopStandingDirectiveSnapshot {
  id: string;
  family: WorkshopStandingDirectiveFamily;
  widgetId: 'lexical-gravity' | 'prose-controller';
  widgetConfigId: string;
  revision: number;
  updatedAt: number;
}

export interface WorkshopLexicalGravityStandingDirectiveSummary
  extends WorkshopStandingDirectiveSnapshot {
  family: 'lexical-gravity';
  widgetId: 'lexical-gravity';
  lensName: string;
  lensVariant?: string;
  weight: number;
  reach: WorkshopLexicalGravityReach;
  metaphorPull: boolean;
}

export type WorkshopStandingDirectiveSummary =
  WorkshopLexicalGravityStandingDirectiveSummary;

/**
 * Display-safe widget-commit decoration on a normal user message turn —
 * rail-discriminated from day one (the standing arm arrives with Sprint 02).
 * `artifactId` intentionally duplicates the ref reachable through
 * `messageAttachments`-style joins: direct address beats a join; do not
 * "deduplicate" it (ADR 2026-07-22, Sprint 01 concretions).
 */
export interface WorkshopThreadArtifactWidgetCommit {
  widgetId: WorkshopWidgetId;
  widgetConfigId: string;
  rail: 'thread-artifact';
  artifactId: string;
  selectionCount: number;
}

export interface WorkshopStandingWidgetCommit {
  widgetId: 'lexical-gravity' | 'prose-controller';
  widgetConfigId: string;
  rail: 'standing';
  directiveId: string;
  revision: number;
}

export type WorkshopTurnWidgetCommit =
  | WorkshopThreadArtifactWidgetCommit
  | WorkshopStandingWidgetCommit;

export interface WorkshopStandingDirectiveChange {
  action: 'installed' | 'shifted' | 'removed';
  family: WorkshopStandingDirectiveFamily;
  widgetId: 'lexical-gravity' | 'prose-controller';
  directiveId: string;
  widgetConfigId: string;
  revision: number;
}

/**
 * Persona-supplied prefill for a recommended widget. Every field is editable.
 * Gesture Playground's accepted persona frame supplies the first four fields
 * together; optionality keeps the shared seed usable by future widget kinds.
 */
export interface WorkshopGestureRecommendationSeed {
  targetPhrase?: string;
  writerInstructions?: string;
  contextText?: string;
  characterNotes?: string;
  sourceReferences?: WorkshopWidgetSourceReference[];
}

/** Backward-friendly name retained for the shipped Gesture modal contract. */
export type WorkshopWidgetRecommendationSeed = WorkshopGestureRecommendationSeed;

/**
 * Strictly parsed persona widget recommendation (actionable-findings mold:
 * fail-closed host-side parse, typed field, presentation-only chip). Only
 * `live` registry ids survive parsing — comp-only widgets never render chips.
 */
export type WorkshopWidgetRecommendation =
  | {
      widgetId: 'gesture-playground';
      seed?: WorkshopGestureRecommendationSeed;
    }
  | {
      widgetId: 'lexical-gravity';
      seed?: WorkshopLexicalGravityRecommendationSeed;
    };

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

/**
 * One submission of the Conversation Settings modal's complete draft. The
 * profile remains a separate persisted object, but both values enter the live
 * room only after the single guarded system-message replacement batch succeeds.
 */
export interface WorkshopSetConversationSettingsPayload {
  behavior: WorkshopConversationBehavior;
  writerProfile: WorkshopWriterProfile;
  webResearch: WorkshopWebResearchSettings;
}

export interface WorkshopSetConversationSettingsMessage
  extends MessageEnvelope<WorkshopSetConversationSettingsPayload> {
  type: MessageType.WORKSHOP_SET_CONVERSATION_SETTINGS;
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

/**
 * Replace one authored attachment's text from the shared Edit/Preview sheet
 * (Sprint 13A). Writer text notes and wizard suggestions are editable in
 * session; a wizard edit never touches the source file on disk.
 */
export interface WorkshopUpdateContextTextPayload {
  id: string;
  text: string;
}

export interface WorkshopUpdateContextTextMessage
  extends MessageEnvelope<WorkshopUpdateContextTextPayload> {
  type: MessageType.WORKSHOP_UPDATE_CONTEXT_TEXT;
}

/**
 * Fetch one attachment's body for the Edit/Preview sheet (Sprint 13A).
 * Attachment content is prompt-bearing host state and is deliberately NOT in
 * every session snapshot (the shared budget is 50,000 words) — the webview
 * asks for exactly the one the writer opened.
 */
export interface WorkshopRequestContextAttachmentPayload {
  id: string;
}

export interface WorkshopRequestContextAttachmentMessage
  extends MessageEnvelope<WorkshopRequestContextAttachmentPayload> {
  type: MessageType.WORKSHOP_REQUEST_CONTEXT_ATTACHMENT;
}

export interface WorkshopContextAttachmentContentPayload {
  id: string;
  /** Absent when the attachment was removed between request and reply. */
  content?: string;
  /** Display-safe reason when the body could not be produced. */
  error?: string;
  /** True when the host can open this attachment's source in an editor tab. */
  canOpenInEditor: boolean;
}

export interface WorkshopContextAttachmentContentMessage
  extends MessageEnvelope<WorkshopContextAttachmentContentPayload> {
  type: MessageType.WORKSHOP_CONTEXT_ATTACHMENT_CONTENT;
}

/**
 * Open a file-backed attachment's source in a host editor tab (Sprint 13A).
 * The webview sheet is the prettified markdown read; this is the escape hatch
 * to the real document. Routed through the ShellService port, so core stays
 * host-agnostic.
 */
export interface WorkshopOpenContextAttachmentFilePayload {
  id: string;
}

export interface WorkshopOpenContextAttachmentFileMessage
  extends MessageEnvelope<WorkshopOpenContextAttachmentFilePayload> {
  type: MessageType.WORKSHOP_OPEN_CONTEXT_ATTACHMENT_FILE;
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

/**
 * Stage configured resources as attachments for the writer's next composer
 * message (Phase 6B): one-shot thread-artifacts, NOT standing context.
 */
export interface WorkshopAttachMessageResourcesPayload {
  items: WorkshopConfiguredResourceRef[];
}

export interface WorkshopAttachMessageResourcesMessage
  extends MessageEnvelope<WorkshopAttachMessageResourcesPayload> {
  type: MessageType.WORKSHOP_ATTACH_MESSAGE_RESOURCES;
}

/**
 * Stage an explored file (host picker) as a next-message attachment
 * (Phase 6B). Zero payload — the dialog IS the input.
 */
export interface WorkshopAttachMessageFileMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.WORKSHOP_ATTACH_MESSAGE_FILE;
}

export interface WorkshopRemoveMessageAttachmentPayload {
  id: string;
}

export interface WorkshopRemoveMessageAttachmentMessage
  extends MessageEnvelope<WorkshopRemoveMessageAttachmentPayload> {
  type: MessageType.WORKSHOP_REMOVE_MESSAGE_ATTACHMENT;
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
      menu: WorkshopGestureMenuGroup[];
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
  menu?: WorkshopGestureMenuGroup[];
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

export interface WorkshopRequestLexicalGravityLensesMessage
  extends MessageEnvelope<Record<string, never>> {
  type: MessageType.WORKSHOP_REQUEST_LEXICAL_GRAVITY_LENSES;
}

export interface WorkshopLexicalGravityLensesDataPayload {
  lenses: WorkshopLexicalGravityLens[];
  storagePath?: string;
  error?: string;
}

export interface WorkshopLexicalGravityLensesDataMessage
  extends MessageEnvelope<WorkshopLexicalGravityLensesDataPayload> {
  type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_DATA;
}

export interface WorkshopPreviewLexicalGravityMessage
  extends MessageEnvelope<{
    token: string;
    draft: WorkshopLexicalGravityDraft;
    sourceText: string;
  }> {
  type: MessageType.WORKSHOP_PREVIEW_LEXICAL_GRAVITY;
}

export interface WorkshopLexicalGravityPreviewResultPayload {
  token: string;
  ok: boolean;
  preview?: WorkshopLexicalGravityPreview;
  error?: string;
}

export interface WorkshopLexicalGravityPreviewResultMessage
  extends MessageEnvelope<WorkshopLexicalGravityPreviewResultPayload> {
  type: MessageType.WORKSHOP_LEXICAL_GRAVITY_PREVIEW_RESULT;
}

export interface WorkshopBuildLexicalGravityLensMessage
  extends MessageEnvelope<{ token: string; query: string }> {
  type: MessageType.WORKSHOP_BUILD_LEXICAL_GRAVITY_LENS;
}

export interface WorkshopLexicalGravityLensCandidate {
  candidateId: string;
  lens: WorkshopLexicalGravityLens;
}

export interface WorkshopLexicalGravityLensCandidatesPayload {
  token: string;
  query: string;
  ok: boolean;
  /** Existing project lens returned without a model call for repeat lookups. */
  existingLens?: WorkshopLexicalGravityLens;
  candidates?: WorkshopLexicalGravityLensCandidate[];
  error?: string;
}

export interface WorkshopLexicalGravityLensCandidatesMessage
  extends MessageEnvelope<WorkshopLexicalGravityLensCandidatesPayload> {
  type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENS_CANDIDATES;
}

export interface WorkshopSaveLexicalGravityLensesMessage
  extends MessageEnvelope<{
    token: string;
    query: string;
    /** Candidate ids selected by the writer; candidate bodies remain host-owned. */
    candidateIds: string[];
  }> {
  type: MessageType.WORKSHOP_SAVE_LEXICAL_GRAVITY_LENSES;
}

export interface WorkshopLexicalGravityLensesSavedPayload {
  token: string;
  ok: boolean;
  lenses?: WorkshopLexicalGravityLens[];
  /** Candidate ids admitted by this save operation. */
  candidateIds: string[];
  /** Generated candidates still available to save without another model call. */
  remainingCandidateIds?: string[];
  storagePath?: string;
  error?: string;
}

export interface WorkshopLexicalGravityLensesSavedMessage
  extends MessageEnvelope<WorkshopLexicalGravityLensesSavedPayload> {
  type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_SAVED;
}

export interface WorkshopRequestWidgetConfigMessage extends MessageEnvelope<{ configId: string }> {
  type: MessageType.WORKSHOP_REQUEST_WIDGET_CONFIG;
}

export interface WorkshopWidgetConfigDataMessage extends MessageEnvelope<{
  configId: string;
  config?: WorkshopWidgetConfigSnapshot;
  error?: string;
}> {
  type: MessageType.WORKSHOP_WIDGET_CONFIG_DATA;
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
  draft: WorkshopGestureDraft;
  /** Present on clone-and-recommit: the config this Draft was re-opened from. */
  clonedFromConfigId?: string;
}

/** Family rail contract; each supported one-shot widget contributes one exact arm. */
export type WorkshopCommitWidgetPayload = WorkshopGesturePlaygroundCommitPayload;

export interface WorkshopCommitWidgetMessage extends MessageEnvelope<WorkshopCommitWidgetPayload> {
  type: MessageType.WORKSHOP_COMMIT_WIDGET;
}

export interface WorkshopLexicalGravityApplyStandingWidgetPayload {
  requestToken: string;
  widgetId: 'lexical-gravity';
  draft: WorkshopLexicalGravityDraft;
  /** Present for edit-in-place; omitted for a first install. */
  widgetConfigId?: string;
}

/** Each live standing feature contributes one exact widget/draft arm. */
export type WorkshopApplyStandingWidgetPayload =
  WorkshopLexicalGravityApplyStandingWidgetPayload;

export interface WorkshopApplyStandingWidgetMessage
  extends MessageEnvelope<WorkshopApplyStandingWidgetPayload> {
  type: MessageType.WORKSHOP_APPLY_STANDING_WIDGET;
}

export interface WorkshopRemoveStandingWidgetPayload {
  requestToken: string;
  family: WorkshopStandingDirectiveFamily;
}

export interface WorkshopRemoveStandingWidgetMessage
  extends MessageEnvelope<WorkshopRemoveStandingWidgetPayload> {
  type: MessageType.WORKSHOP_REMOVE_STANDING_WIDGET;
}

interface WorkshopWidgetActionResultBase {
  requestToken: string;
  ok: boolean;
  widgetConfigId?: string;
  directiveId?: string;
  turnId?: string;
  /** User-facing failure text when ok is false. */
  message?: string;
}

export type WorkshopWidgetActionResultPayload =
  | (WorkshopWidgetActionResultBase & {
      action: 'commit';
      widgetId: 'gesture-playground';
    })
  | (WorkshopWidgetActionResultBase & {
      action: 'apply-standing';
      widgetId: 'lexical-gravity';
    })
  | (WorkshopWidgetActionResultBase & {
      action: 'remove-standing';
      widgetId: 'lexical-gravity' | 'prose-controller';
      /** Distinguishes a real removal from an idempotent no-op. */
      removed?: boolean;
    });

export interface WorkshopWidgetActionResultMessage
  extends MessageEnvelope<WorkshopWidgetActionResultPayload> {
  type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT;
}
