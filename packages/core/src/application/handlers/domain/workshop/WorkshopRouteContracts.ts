import type { ContextAssistantService } from '@services/analysis/ContextAssistantService';
import type { MessageTransport } from '@handlers/MessageHandlerContracts';
import type { MessageRouter } from '@handlers/MessageRouter';
import type {
  WorkshopGesturePlaygroundHandlerOptions,
  WorkshopGesturePlaygroundServicePort
} from '@handlers/domain/workshop/widgets/gesturePlayground/WorkshopGesturePlaygroundHandler';
import type {
  WorkshopLexicalGravityModelPort,
  WorkshopLexicalGravityRepositoryPort
} from '@handlers/domain/workshop/widgets/lexicalGravity/WorkshopLexicalGravityHandler';
import type {
  WorkshopStandingDirectiveServicePort
} from '@handlers/domain/workshop/WorkshopStandingDirectiveHandler';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type {
  WorkshopContextIntakeService
} from '@/application/services/workshop/WorkshopContextIntakeService';
import type {
  WorkshopSessionPersistenceCoordinator
} from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import type { LogSink, ShellService } from '@/platform';
import type {
  ErrorSource,
  MessageType,
  WorkshopSessionAction,
  WorkshopTurn
} from '@messages';

/** Register a Workshop mutation behind the shared session-operation gate. */
export type WorkshopMutationRouteRegistrar = (
  messageType: MessageType,
  handler: (message: never) => Promise<void>,
  sessionAction?: WorkshopSessionAction,
  onBlocked?: (reason: string, message: never) => void
) => void;

/** The route owner used when the shared mutation gate reports a refusal. */
export type WorkshopMutationRouteOwner =
  | 'WorkshopContextHandler'
  | 'WorkshopExcerptScopeHandler'
  | 'WorkshopGesturePlaygroundHandler'
  | 'WorkshopLexicalGravityHandler'
  | 'WorkshopRoomHandler'
  | 'WorkshopSessionMessageHandler'
  | 'WorkshopStandingDirectiveHandler'
  | 'WorkshopTodoHandler';

/**
 * Room-owned effects available to Workshop route slices.
 *
 * Callbacks keep live run/budget state and transport ownership in the room
 * orchestrator. A slice receives only the effects it actually uses via Pick.
 * Error source and route-owner attribution are pre-bound by the composition.
 */
export interface WorkshopRoomEffects {
  postSessionState: () => void;
  postTurn: (turn: WorkshopTurn) => void;
  markDirty: (reason: string) => void;
  reportError: (message: string, details?: string) => void;
  sendStatus: (message: string) => void;
  discardConversations: (conversationIds: readonly string[]) => void;
}

/** The guarded run state an excerpt/scope slice may query but must not own. */
export interface WorkshopRunGate {
  excerptMutationBlockedReason: () => string | undefined;
}

/**
 * Feature collaborators cross the Workshop boundary as one focused bundle.
 * Adding another widget extends this seam; it does not add another positional
 * argument to the already broad room-controller constructor.
 */
export interface WorkshopWidgetRuntime {
  gesturePlayground: WorkshopGesturePlaygroundServicePort;
  standingDirectives: WorkshopStandingDirectiveServicePort;
  lexicalGravity: {
    model: WorkshopLexicalGravityModelPort;
    repository: WorkshopLexicalGravityRepositoryPort;
  };
}

/** Stable dependencies owned by the Workshop-internal composition tier. */
export interface WorkshopSliceCompositionDependencies {
  contextAssistantService: ContextAssistantService;
  session: WorkshopSessionService;
  postMessage: MessageTransport;
  shell: ShellService;
  contextIntakeService: WorkshopContextIntakeService;
  sessionPersistence: WorkshopSessionPersistenceCoordinator;
  widgetRuntime: WorkshopWidgetRuntime;
  outputChannel: LogSink;
}

/**
 * Live room facts and effects needed across the composition seam.
 *
 * Slice constructors may retain these callbacks but must not invoke them until
 * WorkshopSliceComposition construction has completed. Persistence stays in
 * the dependency bundle rather than being re-exposed as pass-through effects.
 */
export interface WorkshopSliceHostEffects {
  postSessionState: () => void;
  postTurn: (turn: WorkshopTurn) => void;
  reportRouteError: (
    source: ErrorSource,
    message: string,
    details: string | undefined,
    owner: WorkshopMutationRouteOwner
  ) => void;
  sendStatus: (message: string) => void;
  discardConversations: (conversationIds: readonly string[]) => void;
  excerptMutationBlockedReason: () => string | undefined;
  flushDeferredConversationSettings: () => Promise<void>;
  activeRunLabel: () => 'Context wizard' | 'response' | undefined;
  sendRoomMessage: WorkshopGesturePlaygroundHandlerOptions['sendRoomMessage'];
  isRoomRunActive: () => boolean;
  disposeRoomSubscriptions: () => void;
  disposeActiveRoomRun: () => void;
}

export type WorkshopRoomRouteRegistration = (
  router: MessageRouter,
  registerMutation: WorkshopMutationRouteRegistrar
) => void;
