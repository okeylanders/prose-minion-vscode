import type { WorkshopSessionAction, WorkshopTurn } from '@messages';
import { MessageType } from '@messages';

/** Register a Workshop mutation behind the shared session-operation gate. */
export type WorkshopMutationRouteRegistrar = (
  messageType: MessageType,
  handler: (message: never) => Promise<void>,
  sessionAction?: WorkshopSessionAction,
  onBlocked?: (reason: string, message: never) => void
) => void;

/**
 * Room-owned effects available to Workshop route slices.
 *
 * Callbacks keep live run/budget state and transport ownership in the room
 * orchestrator. A slice receives only the effects it actually uses via Pick.
 */
export interface WorkshopRoomEffects {
  postSessionState: () => void;
  postTurn: (turn: WorkshopTurn) => void;
  markDirty: (reason: string) => void;
  reportError: (message: string, details?: string) => void;
  sendStatus: (message: string) => void;
  discardConversations: (conversationIds: string[]) => void;
}

/** The guarded run state an excerpt/scope slice may query but must not own. */
export interface WorkshopRunGate {
  excerptMutationBlockedReason: () => string | undefined;
}
