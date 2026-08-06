/**
 * Workshop-internal composition seam.
 *
 * extension.ts remains the application composition root, while MessageHandler
 * assembles the domain ingress owners. This Workshop-internal seam assembles
 * route slices around the room/run owner, owns the shared session-operation
 * mutation gate, and fans out slice disposal. It has no room execution state
 * and constructs no transport envelopes.
 */

import { ContextAssistantService } from '@services/analysis/ContextAssistantService';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import { WorkshopSessionPersistenceCoordinator } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { LogSink, ShellService } from '@/platform';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { MessageRouter } from '@handlers/MessageRouter';
import { WorkshopContextHandler } from '@handlers/domain/workshop/WorkshopContextHandler';
import { WorkshopExcerptScopeHandler } from '@handlers/domain/workshop/WorkshopExcerptScopeHandler';
import { WorkshopSessionMessageHandler } from '@handlers/domain/workshop/WorkshopSessionMessageHandler';
import { WorkshopStandingDirectiveHandler } from '@handlers/domain/workshop/WorkshopStandingDirectiveHandler';
import { WorkshopTodoHandler } from '@handlers/domain/workshop/WorkshopTodoHandler';
import { WorkshopWidgetHostHandler } from '@handlers/domain/workshop/widgets/WorkshopWidgetHostHandler';
import {
  WorkshopGesturePlaygroundHandler,
  WorkshopGesturePlaygroundHandlerOptions,
  WorkshopGesturePlaygroundServicePort
} from '@handlers/domain/workshop/widgets/gesturePlayground/WorkshopGesturePlaygroundHandler';
import {
  WorkshopLexicalGravityHandler,
  WorkshopLexicalGravityModelPort,
  WorkshopLexicalGravityRepositoryPort
} from '@handlers/domain/workshop/widgets/lexicalGravity/WorkshopLexicalGravityHandler';
import type {
  WorkshopMutationRouteRegistrar
} from '@handlers/domain/workshop/WorkshopRouteContracts';
import type {
  ErrorSource,
  WorkshopSessionAction,
  WorkshopTurn
} from '@messages';
import { MessageType } from '@messages';
import type {
  WorkshopStandingDirectiveServicePort
} from '@handlers/domain/workshop/WorkshopStandingDirectiveHandler';

/** Feature collaborators cross the Workshop boundary as one focused bundle. */
export interface WorkshopWidgetRuntime {
  gesturePlayground: WorkshopGesturePlaygroundServicePort;
  standingDirectives: WorkshopStandingDirectiveServicePort;
  lexicalGravity: {
    model: WorkshopLexicalGravityModelPort;
    repository: WorkshopLexicalGravityRepositoryPort;
  };
}

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

export interface WorkshopSliceHostEffects {
  postSessionState: () => void;
  postTurn: (turn: WorkshopTurn) => void;
  markDirty: (reason: string) => void;
  reportError: (
    source: ErrorSource,
    message: string,
    details: string | undefined,
    owner: string
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
  flushPersistence: () => void;
}

export type WorkshopRoomRouteRegistration = (
  router: MessageRouter,
  registerMutation: WorkshopMutationRouteRegistrar
) => void;

export class WorkshopSliceComposition {
  private readonly sessionMessageHandler: WorkshopSessionMessageHandler;
  private readonly gesturePlaygroundHandler: WorkshopGesturePlaygroundHandler;
  private readonly widgetHostHandler: WorkshopWidgetHostHandler;
  private readonly standingDirectiveHandler: WorkshopStandingDirectiveHandler;
  private readonly lexicalGravityHandler: WorkshopLexicalGravityHandler;
  private readonly todoHandler: WorkshopTodoHandler;
  private readonly contextHandler: WorkshopContextHandler;
  private readonly excerptScopeHandler: WorkshopExcerptScopeHandler;

  constructor(
    private readonly dependencies: WorkshopSliceCompositionDependencies,
    private readonly host: WorkshopSliceHostEffects
  ) {
    const {
      contextAssistantService,
      session,
      postMessage,
      shell,
      contextIntakeService,
      sessionPersistence,
      widgetRuntime,
      outputChannel
    } = dependencies;

    this.contextHandler = new WorkshopContextHandler(
      contextAssistantService,
      session,
      shell,
      contextIntakeService,
      postMessage,
      outputChannel,
      {
        postSessionState: host.postSessionState,
        postTurn: host.postTurn,
        markDirty: host.markDirty,
        reportError: (message, details) =>
          host.reportError('workshop', message, details, 'WorkshopContextHandler'),
        sendStatus: host.sendStatus
      }
    );
    this.excerptScopeHandler = new WorkshopExcerptScopeHandler(
      session,
      shell,
      contextIntakeService,
      outputChannel,
      {
        excerptMutationBlockedReason: host.excerptMutationBlockedReason
      },
      {
        postSessionState: host.postSessionState,
        postTurn: host.postTurn,
        markDirty: host.markDirty,
        reportError: (message, details) =>
          host.reportError('workshop', message, details, 'WorkshopExcerptScopeHandler'),
        sendStatus: host.sendStatus,
        discardConversations: (conversationIds) => host.discardConversations(conversationIds)
      }
    );
    this.sessionMessageHandler = new WorkshopSessionMessageHandler(
      sessionPersistence,
      postMessage,
      shell,
      outputChannel,
      {
        postSessionState: host.postSessionState,
        flushDeferredConversationSettings: host.flushDeferredConversationSettings,
        reportError: (message, details) =>
          host.reportError('workshop', message, details, 'WorkshopSessionMessageHandler'),
        activeRunLabel: host.activeRunLabel
      }
    );
    this.gesturePlaygroundHandler = new WorkshopGesturePlaygroundHandler(
      session,
      widgetRuntime.gesturePlayground,
      postMessage,
      outputChannel,
      {
        sendRoomMessage: host.sendRoomMessage,
        postSessionState: host.postSessionState,
        markDirty: host.markDirty,
        reportError: (message, details) =>
          host.reportError('workshop', message, details, 'WorkshopGesturePlaygroundHandler'),
        isRoomRunActive: host.isRoomRunActive
      }
    );
    this.widgetHostHandler = new WorkshopWidgetHostHandler(
      session,
      postMessage,
      outputChannel
    );
    this.lexicalGravityHandler = new WorkshopLexicalGravityHandler(
      widgetRuntime.lexicalGravity.model,
      widgetRuntime.lexicalGravity.repository,
      postMessage,
      outputChannel
    );
    this.standingDirectiveHandler = new WorkshopStandingDirectiveHandler(
      widgetRuntime.standingDirectives,
      postMessage,
      outputChannel,
      {
        postSessionState: host.postSessionState,
        postTurn: host.postTurn,
        markDirty: host.markDirty
      }
    );
    this.todoHandler = new WorkshopTodoHandler(
      session,
      outputChannel,
      {
        postSessionState: host.postSessionState,
        markDirty: host.markDirty,
        reportError: (message, details) =>
          host.reportError('workshop.todo', message, details, 'WorkshopTodoHandler')
      }
    );
  }

  registerRoutes(
    router: MessageRouter,
    registerRoomRoutes: WorkshopRoomRouteRegistration
  ): void {
    const registerMutation: WorkshopMutationRouteRegistrar = (
      messageType: MessageType,
      handler: (message: never) => Promise<void>,
      sessionAction?: WorkshopSessionAction,
      onBlocked?: (reason: string, message: never) => void
    ): void => {
      router.register(messageType, async (message) => {
        const reportBlocked = onBlocked
          ? (reason: string) => onBlocked(reason, message as never)
          : undefined;
        if (this.rejectMutationDuringSessionOperation(sessionAction, reportBlocked)) {
          return;
        }
        await handler(message as never);
      });
    };

    registerRoomRoutes(router, registerMutation);
    this.excerptScopeHandler.registerRoutes(router, registerMutation);
    this.contextHandler.registerRoutes(router, registerMutation);
    this.sessionMessageHandler.registerRoutes(router, registerMutation);
    this.gesturePlaygroundHandler.registerRoutes(router, registerMutation);
    this.widgetHostHandler.registerRoutes(router);
    this.standingDirectiveHandler.registerRoutes(router, registerMutation);
    this.lexicalGravityHandler.registerRoutes(router, registerMutation);
    this.todoHandler.registerRoutes(router, registerMutation);
  }

  isContextRunActive(): boolean {
    return this.contextHandler.isRunning();
  }

  cancelContextRun(requestId: string): boolean {
    return this.contextHandler.cancelRun(requestId);
  }

  dispose(): void {
    this.gesturePlaygroundHandler.dispose();
    this.lexicalGravityHandler.dispose();
    this.host.disposeRoomSubscriptions();
    this.sessionMessageHandler.dispose();
    this.host.disposeActiveRoomRun();
    this.contextHandler.dispose();
    this.host.flushPersistence();
  }

  private rejectMutationDuringSessionOperation(
    sessionAction?: WorkshopSessionAction,
    onBlocked?: (message: string) => void
  ): boolean {
    if (!this.dependencies.sessionPersistence.isSessionOperationPending()) {
      return false;
    }
    const message =
      'Wait for the current session save or replacement to finish before changing the room.';
    if (onBlocked) {
      onBlocked(message);
    } else if (sessionAction) {
      this.sessionMessageHandler.postActionResult(sessionAction, false, message);
    } else {
      this.host.reportError('workshop', message, undefined, 'WorkshopRoomHandler');
    }
    return true;
  }
}
