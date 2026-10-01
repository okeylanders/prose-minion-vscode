/**
 * Durable Workshop aggregate state, schema version 1.
 *
 * V1 is intentional here: persisted sessions must retain their original
 * decoder after a future schema is introduced. Generic aggregate behavior and
 * copy helpers remain unversioned elsewhere.
 */

import {
  ContextSourceEntry,
  WorkshopChatTarget,
  WorkshopConversationBehavior,
  WorkshopExcerpt,
  WorkshopPersonaId,
  WorkshopSessionScope,
  WorkshopStandingDirectiveSnapshot,
  WorkshopToolId,
  WorkshopTurn,
  WorkshopTodoItem,
  WorkshopWidgetConfigSnapshot
} from '@messages';
import type {
  WorkshopContextAttachment,
  WorkshopMessageAttachment
} from '@/application/services/workshop/WorkshopSessionRecords';
import {
  validateWorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1Integrity';
import {
  assertWorkshopSessionCheckpointShape,
  assertWorkshopSessionStateShape
} from '@/application/services/workshop/WorkshopSessionStateV1Shape';
import {
  clonePersistedJson
} from '@/application/services/workshop/persistedJson';
import type {
  WorkshopThreadArtifact
} from '@/application/services/workshop/WorkshopThreadArtifactFrame';

export type WorkshopStoredTodoItemV1 = Omit<WorkshopTodoItem, 'stale'>;

export type WorkshopConversationLogicalKey =
  | 'host'
  | `tool:${WorkshopToolId}`
  | `guest:${WorkshopPersonaId}`;

export type WorkshopRuntimeConversationBindings = Readonly<
  Partial<Record<WorkshopConversationLogicalKey, string>>
>;

/**
 * Where one participant's retained provider history stood at a ledger turn
 * (ADR 2026-09-30 §3). The room ledger and each retained history are parallel
 * ordered records with no shared index; a mark is the recorded bridge that
 * lets a rewind cut both at the same moment without parsing message formats.
 *
 * Host-private: marks never enter the webview snapshot.
 */
export interface WorkshopRetainedHistoryMarkV1 {
  /** Ledger turn at which this participant state held (reply/report/join turn, or head for a baseline). */
  turnId: string;
  conversationKey: WorkshopConversationLogicalKey;
  /** Archived message count, system message excluded. Always even. */
  messageCount: number;
  /** Committed ConversationManager contextSources rows at this point. */
  contextSourceCount: number;
  /** The participant's writer-source manifest rows at this point. */
  writerSourceCount: number;
  /** Reader offset at this point; absent for tool sidecars (instruments read nothing). */
  lastSeenRoomTurnId?: string;
  /**
   * Host marks only: the context revision the host holds at this point. The
   * ledger shows no reliable record of context delivery (a session-open file
   * refresh changes the revision without a divider), so a rewind re-queues
   * pending context exactly when this is older than the current revision.
   */
  contextRevision?: number;
  origin: 'commit' | 'baseline';
}

export interface WorkshopSessionStateV1 {
  excerpt?: WorkshopExcerpt;
  /**
   * Explicit session scope (Sprint 13A). OPTIONAL in the persisted grammar:
   * checkpoints written before scope existed have none, and
   * `hydrateCommittedState` migrates them once rather than refusing to open a
   * writer's saved room.
   */
  scope?: WorkshopSessionScope;
  /** The passage the writer set aside; restored by re-pin, never deleted. */
  shelvedExcerpt?: WorkshopExcerpt;
  contextAttachments: WorkshopContextAttachment[];
  pendingMessageAttachments: WorkshopMessageAttachment[];
  /**
   * Host-private bodies for committed room-wide one-shot artifacts. OPTIONAL
   * because checkpoints written before the room-ledger repair retain only
   * display-safe turn references and cannot reconstruct already-shipped bodies.
   */
  threadArtifacts?: WorkshopThreadArtifact[];
  revisions: {
    excerpt: number;
    replacementCount: number;
    context: number;
    pendingExcerpt?: number;
    /**
     * LEGACY (Sprint 13A, retired by ADR 2026-07-25). Both fields serviced
     * mid-conversation scope changes, which the scope lock made impossible.
     * They are still ACCEPTED so that checkpoints written before the lock
     * parse rather than failing a writer's real session open — and they are
     * discarded at the hydration boundary and never written again. Removing
     * them from this list would make the shape validator reject those files
     * as carrying unknown fields.
     */
    pendingExcerptChange?: 'revised' | 'added' | 'repinned';
    /** LEGACY — see `pendingExcerptChange`. */
    pendingExcerptWithdrawal?: true;
    pendingContext?: number;
  };
  counters: {
    attachment: number;
    threadArtifact: number;
    turn: number;
    todo: number;
    /**
     * OPTIONAL in the persisted grammar (ADR 2026-07-22): checkpoints written
     * before Conversation Widgets have no widget counter, and hydration
     * defaults it to zero rather than refusing to open a writer's saved room.
     */
    widgetConfig?: number;
    /** Optional for checkpoints written before standing prose directives. */
    standingDirective?: number;
  };
  /**
   * Persisted widget authoring configs (ADR 2026-07-22). OPTIONAL for the
   * same pre-widget-checkpoint reason as `counters.widgetConfig`; absent
   * hydrates empty.
   */
  widgetConfigs?: WorkshopWidgetConfigSnapshot[];
  /** Active directives, one per closed family. Optional for older checkpoints. */
  standingDirectives?: WorkshopStandingDirectiveSnapshot[];
  writerSources: {
    host: ContextSourceEntry[];
    tools: Partial<Record<WorkshopToolId, ContextSourceEntry[]>>;
    guests: Array<{
      personaId: WorkshopPersonaId;
      sources: ContextSourceEntry[];
    }>;
  };
  turns: WorkshopTurn[];
  participants: {
    host: {
      personaId: WorkshopPersonaId;
      conversationKey?: 'host';
      lastSeenRoomTurnId?: string;
    };
    toolSidecars: Array<{
      toolId: WorkshopToolId;
      conversationKey: `tool:${WorkshopToolId}`;
      latestReportTurnId: string;
      /**
       * LEGACY (Sprint 13D). Accepted only at the raw checkpoint boundary,
       * discarded during hydration, and never written again.
       */
      deliveredToHostThroughTurnId?: string;
    }>;
    personaGuests: Array<{
      personaId: WorkshopPersonaId;
      conversationKey?: `guest:${WorkshopPersonaId}`;
      lastSeenRoomTurnId?: string;
      /** LEGACY — see the tool-sidecar delivery cursor above. */
      lastSeenHostTurnId?: string;
      /** LEGACY — see the tool-sidecar delivery cursor above. */
      deliveredToHostThroughTurnId?: string;
      liveness: 'live' | 'disposed';
    }>;
    chatTarget: WorkshopChatTarget;
  };
  selectedToolId?: WorkshopToolId;
  todos: WorkshopStoredTodoItemV1[];
  /**
   * Retained-history marks in ledger order (ADR 2026-09-30 §3). OPTIONAL in
   * the persisted grammar, like `widgetConfigs` before it (ADR 2026-07-30: an
   * optional field invalidates no prior shape, so no schema bump). Absent
   * means no marks; hydration records baselines at the ledger head.
   */
  retainedHistoryMarks?: WorkshopRetainedHistoryMarkV1[];
  lastCommittedPersonaBehavior?: Pick<
    WorkshopConversationBehavior,
    'interactionMode' | 'expressionLevel' | 'relationalDepth'
  >;
}

/**
 * Decode the host-private aggregate at the raw JSON boundary. Exact checkpoint
 * structure and compatibility-safe aggregate invariants run on a defensive
 * clone. Widget-local semantics intentionally wait until callers normalize,
 * assert current shape, and run strict integrity; this return value alone is
 * not hydration- or import-ready.
 */
export function parseWorkshopSessionStateV1(value: unknown): WorkshopSessionStateV1 {
  assertWorkshopSessionCheckpointShape(value);
  const decoded = clonePersistedJson(value, 'workshop');
  // Compatibility states are accepted only at the raw checkpoint boundary.
  // Hydration runs the named V1 migration and validates its output again
  // against current invariants before replacing the live aggregate.
  validateWorkshopSessionStateV1(decoded, {
    allowLegacyOpenSessionWithExcerpt: true,
    skipWidgetDraftIntegrity: true,
    // An inconsistent mark degrades rewindability, never a session open:
    // checkpoint normalization drops such keys before strict validation.
    skipRetainedHistoryMarkIntegrity: true
  });
  return decoded;
}

/** Strict current-state witness used after checkpoint normalization. */
export function assertCurrentWorkshopSessionStateV1(
  value: unknown
): asserts value is WorkshopSessionStateV1 {
  assertWorkshopSessionStateShape(value);
}
