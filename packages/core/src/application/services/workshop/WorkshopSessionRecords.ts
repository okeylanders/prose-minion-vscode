/**
 * Host-owned Workshop session records and their defensive-copy boundaries.
 *
 * The type declarations intentionally stay together in this file so
 * `WorkshopSessionService` can read as aggregate behavior instead of a long
 * prelude of data shapes. The copy and webview-projection helpers stay beside
 * those records on purpose: when a record gains a nested mutable or
 * host-private field, its boundary copy must change in the same place.
 *
 * This module owns shapes and copies only. It performs no I/O and owns no
 * mutation policy; `WorkshopSessionService` remains the aggregate facade and
 * whole-session consistency boundary.
 */

import type {
  ContextSourceEntry,
  WorkshopActionableFinding,
  WorkshopConversationBehavior,
  WorkshopConversationBehaviorTransition,
  WorkshopContextAttachmentSnapshot,
  WorkshopExcerpt,
  WorkshopExcerptSnapshot,
  WorkshopExcerptSource,
  WorkshopExcerptTruncation,
  WorkshopMessageAttachmentSnapshot,
  WorkshopPersonaId,
  WorkshopSessionScope,
  WorkshopToolId,
  WorkshopTurn,
  WorkshopTurnArtifact,
  WorkshopTurnKind,
  WorkshopWidgetRecommendation
} from '@messages';
import type {
  WorkshopCapabilityArtifactDetails,
  WorkshopCapabilityResult
} from '@shared/types/workshopCapabilities';
import type {
  WorkshopConversationLogicalKey
} from '@/application/services/workshop/WorkshopSessionStateV1';
import type {
  WorkshopSessionCheckpointNormalization
} from '@/application/services/workshop/WorkshopSessionCheckpointNormalization';
import type {
  WorkshopThreadArtifact
} from '@/application/services/workshop/WorkshopThreadArtifactFrame';
import type {
  WorkshopWidgetRecoveryNotice
} from '@/application/services/workshop/widgets/WorkshopWidgetCheckpointRecoveryContracts';

export type WorkshopActivePhase =
  | 'tool_report'
  | 'persona_synthesis'
  | 'host_message'
  | 'guest_message'
  | 'direct_tool_message';

export interface WorkshopActiveRun {
  requestId: string;
  kind: WorkshopTurnKind;
  artifact: WorkshopTurnArtifact;
  phase: WorkshopActivePhase;
  target: 'host' | 'tool' | 'personaGuest';
  toolId?: WorkshopToolId;
  guestPersonaId?: WorkshopPersonaId;
  reportTurnId?: string;
  excerptVersion: number;
  /** Behavior captured when a persona run begins; settings cannot change mid-run. */
  behavior?: WorkshopConversationBehavior;
  behaviorTransition?: WorkshopConversationBehaviorTransition;
  /** Provisional evidence finalized only if this participant reply commits. */
  capabilityTurnIds?: string[];
  /** Visible writer turn provisionally appended for this message run. */
  writerTurnId?: string;
  /** Writer-origin rows captured from the exact fresh-guest join envelope. */
  guestJoinWriterSources?: ContextSourceEntry[];
}

export interface WorkshopExcerptInput {
  text: string;
  /** Validated provenance — callers coerce IPC claims before reaching the aggregate. */
  source: WorkshopExcerptSource;
  truncation?: WorkshopExcerptTruncation;
  sourceFingerprint?: string;
}

export type WorkshopParticipantSubjectStatus =
  | { ready: true }
  | { ready: false; reason: 'scope-unchosen' | 'excerpt-missing' };

/** State the caller must broadcast after a session-scope transition. */
export interface WorkshopScopeTransition {
  scope: WorkshopSessionScope;
  /** False when the request was a no-op (already in that scope). */
  changed: boolean;
  excerpt?: WorkshopExcerpt;
  shelvedExcerpt?: WorkshopExcerpt;
}

/**
 * Full host-side attachment: snapshot metadata plus the content that enters
 * prompt frames. File content and sourceUri never cross to the webview; text
 * note content remains in its pill snapshot because that is the note's only
 * presentation home.
 */
export interface WorkshopContextAttachment extends WorkshopContextAttachmentSnapshot {
  content: string;
  /** File kind only; host-private (used for duplicate guards and re-reads). */
  sourceUri?: string;
}

export type WorkshopContextAttachmentInput = Omit<
  WorkshopContextAttachment,
  'id' | 'addedAt'
>;

export interface WorkshopPersonaGuestJoinStart {
  turn: WorkshopTurn;
  excerpt?: WorkshopExcerpt;
  contextAttachments: WorkshopContextAttachment[];
}

export type WorkshopContextAttachmentResult =
  | { ok: true; attachment: WorkshopContextAttachment; eventTurn?: WorkshopTurn }
  | { ok: false; reason: 'duplicate' | 'over-budget'; remainingWords: number };

export type WorkshopContextAttachmentUpdateResult =
  | { ok: true; attachment: WorkshopContextAttachment; eventTurn?: WorkshopTurn }
  | {
      ok: false;
      reason: 'unknown' | 'not-editable' | 'over-budget';
      remainingWords: number;
    };

/**
 * Full host-side one-shot attachment: the display-safe snapshot plus the
 * content that enters exactly one thread-artifact frame.
 */
export interface WorkshopMessageAttachment extends WorkshopMessageAttachmentSnapshot {
  content: string;
  /** Host-private duplicate-guard key. */
  sourceUri?: string;
}

export type WorkshopMessageAttachmentInput = Omit<WorkshopMessageAttachment, 'id'>;

export type WorkshopMessageAttachmentResult =
  | { ok: true; attachment: WorkshopMessageAttachment }
  | { ok: false; reason: 'duplicate' | 'limit' };

export interface WorkshopPendingHostUpdates {
  excerpt?: WorkshopExcerpt;
  contextAttachments?: {
    revision: number;
    attachments: WorkshopContextAttachment[];
  };
}

export interface WorkshopToolReportCompletion {
  turn: WorkshopTurn;
  replacedConversationId?: string;
}

export interface WorkshopCapabilityArtifactInput {
  /** The invoking participant's active run (host or persona guest). */
  requestId: string;
  excerptVersion: number;
  details: WorkshopCapabilityArtifactDetails;
  result: WorkshopCapabilityResult;
  toolId?: WorkshopToolId;
  truncated?: boolean;
  actionableFindings?: WorkshopActionableFinding[];
}

export interface WorkshopExcerptReplacement {
  excerpt: WorkshopExcerpt;
  disposedConversationIds: string[];
  dividerTurn?: WorkshopTurn;
  retiredSidecarCount: number;
  replacementCount: number;
  /** The one-slot shelf entry displaced by this pin, if any. */
  discardedShelvedExcerpt?: WorkshopExcerpt;
}

export interface WorkshopSessionHydrationResult {
  discardedConversationIds: string[];
  degradedConversationKeys: WorkshopConversationLogicalKey[];
  normalizations: WorkshopSessionCheckpointNormalization[];
  recoveryNotices: WorkshopWidgetRecoveryNotice[];
}

export function cloneToolWriterSources(
  sources: Partial<Record<WorkshopToolId, ContextSourceEntry[]>>
): Partial<Record<WorkshopToolId, ContextSourceEntry[]>> {
  return Object.fromEntries(
    Object.entries(sources).flatMap(([toolId, entries]) =>
      entries ? [[toolId, entries.map(cloneSourceEntry)]] : []
    )
  ) as Partial<Record<WorkshopToolId, ContextSourceEntry[]>>;
}

export function cloneTurn(turn: WorkshopTurn): WorkshopTurn {
  return cloneRecord(turn);
}

export function cloneWidgetRecommendation(
  recommendation: WorkshopWidgetRecommendation
): WorkshopWidgetRecommendation {
  switch (recommendation.widgetId) {
    case 'gesture-playground':
      return {
        widgetId: recommendation.widgetId,
        seed: recommendation.seed
          ? {
              ...recommendation.seed,
              sourceReferences: recommendation.seed.sourceReferences?.map(
                (reference) => ({ ...reference })
              )
            }
          : undefined
      };
    case 'lexical-gravity':
      return {
        widgetId: recommendation.widgetId,
        seed: recommendation.seed ? { ...recommendation.seed } : undefined
      };
    default:
      return assertNever(recommendation);
  }
}

export function cloneSourceEntry(entry: ContextSourceEntry): ContextSourceEntry {
  return {
    ...entry,
    configuredResource: entry.configuredResource ? { ...entry.configuredResource } : undefined
  };
}

export function cloneMessageAttachmentSnapshot(
  snapshot: WorkshopMessageAttachmentSnapshot
): WorkshopMessageAttachmentSnapshot {
  return {
    ...snapshot,
    configuredResource: snapshot.configuredResource ? { ...snapshot.configuredResource } : undefined,
    truncation: snapshot.truncation ? { ...snapshot.truncation } : undefined
  };
}

export function cloneMessageAttachmentInput(
  input: WorkshopMessageAttachmentInput
): WorkshopMessageAttachmentInput {
  return {
    ...input,
    configuredResource: input.configuredResource ? { ...input.configuredResource } : undefined,
    truncation: input.truncation ? { ...input.truncation } : undefined
  };
}

export function cloneMessageAttachment(
  attachment: WorkshopMessageAttachment
): WorkshopMessageAttachment {
  return {
    ...attachment,
    configuredResource: attachment.configuredResource
      ? { ...attachment.configuredResource }
      : undefined,
    truncation: attachment.truncation ? { ...attachment.truncation } : undefined
  };
}

export function cloneThreadArtifact(artifact: WorkshopThreadArtifact): WorkshopThreadArtifact {
  return {
    ...artifact,
    truncation: artifact.truncation ? { ...artifact.truncation } : undefined
  };
}

/** Webview projection: strips content and the host-private sourceUri. */
export function messageAttachmentSnapshot(
  attachment: WorkshopMessageAttachment
): WorkshopMessageAttachmentSnapshot {
  const { content: _content, sourceUri: _sourceUri, ...snapshot } =
    cloneMessageAttachment(attachment);
  return snapshot;
}

export function cloneFindings(
  findings: readonly WorkshopActionableFinding[]
): WorkshopActionableFinding[] {
  return findings.map((finding) => ({ ...finding }));
}

export function cloneCapabilityDetails(
  details: WorkshopCapabilityArtifactDetails
): WorkshopCapabilityArtifactDetails {
  return {
    ...details,
    invokedBy: { ...details.invokedBy },
    metadata: details.metadata
      ? Object.fromEntries(
          Object.entries(details.metadata).map(([key, value]) => [key, cloneMetadataValue(value)])
        )
      : undefined
  };
}

export function cloneAnalysisInputs(inputs: NonNullable<WorkshopTurn['analysisInputs']>) {
  return {
    excerpt: { ...inputs.excerpt },
    context: { ...inputs.context }
  };
}

export function cloneAttachmentInput(
  input: WorkshopContextAttachmentInput
): WorkshopContextAttachmentInput {
  return {
    ...input,
    configuredResource: input.configuredResource ? { ...input.configuredResource } : undefined,
    truncation: input.truncation ? { ...input.truncation } : undefined
  };
}

export function cloneAttachment(
  attachment: WorkshopContextAttachment
): WorkshopContextAttachment {
  return {
    ...attachment,
    configuredResource: attachment.configuredResource
      ? { ...attachment.configuredResource }
      : undefined,
    truncation: attachment.truncation ? { ...attachment.truncation } : undefined
  };
}

/**
 * Webview projection: strips sourceUri always and content for file
 * attachments. Text attachments keep content because the pill is the note's
 * only home.
 */
export function attachmentSnapshot(
  attachment: WorkshopContextAttachment
): WorkshopContextAttachmentSnapshot {
  const { content, sourceUri: _sourceUri, ...snapshot } = cloneAttachment(attachment);
  return attachment.kind === 'text' ? { ...snapshot, content } : snapshot;
}

/** Snapshot boundary: sourceUri and sourceFingerprint remain host-private. */
export function excerptSnapshot(excerpt: WorkshopExcerpt): WorkshopExcerptSnapshot {
  const { sourceFingerprint: _sourceFingerprint, source, ...snapshot } = excerpt;
  if (source.kind === 'manual') {
    return { ...snapshot, source: { kind: 'manual' } };
  }
  const { sourceUri: _sourceUri, ...displaySource } = source;
  return {
    ...snapshot,
    source: {
      ...displaySource,
      configuredResource: source.configuredResource ? { ...source.configuredResource } : undefined
    }
  };
}

function cloneMetadataValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cloneMetadataValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, cloneMetadataValue(nested)])
    );
  }
  return value;
}

/**
 * Workshop turns are JSON-shaped records, but this copier preserves own
 * `undefined` fields as well as nested arrays and objects. Keeping the single
 * turn-copy rule here means new nested turn decorations are isolated without
 * requiring a second ledger-specific copy implementation to stay in sync.
 */
function cloneRecord<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(cloneRecord) as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, cloneRecord(nested)])
    ) as T;
  }
  return value;
}

const assertNever = (value: never): never => {
  throw new Error(`Unhandled Workshop capability operation: ${JSON.stringify(value)}`);
};
