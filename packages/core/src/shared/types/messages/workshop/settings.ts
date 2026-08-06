/** Workshop settings, defaults, validation, and settings-route contracts. */

import { MessageEnvelope, MessageType } from '../base';

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
