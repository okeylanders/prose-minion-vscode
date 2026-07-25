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
  WorkshopToolId,
  WorkshopTurn,
  WorkshopTodoItem
} from '@messages';
import type {
  WorkshopContextAttachment,
  WorkshopExcerptDeliveryReason,
  WorkshopMessageAttachment
} from '@/application/services/workshop/WorkshopSessionService';
import {
  validateWorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1Integrity';
import {
  assertWorkshopSessionStateShape
} from '@/application/services/workshop/WorkshopSessionStateV1Shape';
import {
  clonePersistedJson
} from '@/application/services/workshop/persistedJson';

export type WorkshopStoredTodoItemV1 = Omit<WorkshopTodoItem, 'stale'>;

export type WorkshopConversationLogicalKey =
  | 'host'
  | `tool:${WorkshopToolId}`
  | `guest:${WorkshopPersonaId}`;

export type WorkshopRuntimeConversationBindings = Readonly<
  Partial<Record<WorkshopConversationLogicalKey, string>>
>;

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
  revisions: {
    excerpt: number;
    replacementCount: number;
    context: number;
    pendingExcerpt?: number;
    /** Why the queued excerpt frame is being delivered (Sprint 13A). */
    pendingExcerptChange?: WorkshopExcerptDeliveryReason;
    /** A shelved passage still has to be withdrawn from the retained host. */
    pendingExcerptWithdrawal?: true;
    pendingContext?: number;
  };
  counters: {
    attachment: number;
    threadArtifact: number;
    turn: number;
    todo: number;
  };
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
    };
    toolSidecars: Array<{
      toolId: WorkshopToolId;
      conversationKey: `tool:${WorkshopToolId}`;
      latestReportTurnId: string;
      deliveredToHostThroughTurnId: string;
    }>;
    personaGuests: Array<{
      personaId: WorkshopPersonaId;
      conversationKey?: `guest:${WorkshopPersonaId}`;
      lastSeenHostTurnId?: string;
      deliveredToHostThroughTurnId?: string;
      liveness: 'live' | 'disposed';
    }>;
    chatTarget: WorkshopChatTarget;
  };
  selectedToolId?: WorkshopToolId;
  todos: WorkshopStoredTodoItemV1[];
  lastCommittedPersonaBehavior?: Pick<
    WorkshopConversationBehavior,
    'interactionMode' | 'expressionLevel' | 'relationalDepth'
  >;
}

/**
 * Decode the host-private aggregate at the raw JSON boundary. Structural
 * validation is exact-key and recursive; semantic/referential validation then
 * runs on a defensive clone. Conversation import may safely happen only after
 * this preflight succeeds.
 */
export function parseWorkshopSessionStateV1(value: unknown): WorkshopSessionStateV1 {
  assertWorkshopSessionStateShape(value);
  const decoded = clonePersistedJson(value, 'workshop');
  validateWorkshopSessionStateV1(decoded);
  return decoded;
}
