/**
 * Workshop-internal composition seam.
 *
 * extension.ts remains the application composition root, while MessageHandler
 * assembles the domain ingress owners. This Workshop-internal seam assembles
 * route slices around the room/run owner, owns the shared session-operation
 * mutation gate, and fans out slice plus room teardown in the preserved
 * lifecycle order. It owns no room execution state and constructs no transport
 * envelopes; room-owned steps enter as named host effects.
 */

import { MessageRouter } from '@handlers/MessageRouter';
import { WorkshopContextHandler } from '@handlers/domain/workshop/WorkshopContextHandler';
import { WorkshopExcerptScopeHandler } from '@handlers/domain/workshop/WorkshopExcerptScopeHandler';
import { WorkshopSessionMessageHandler } from '@handlers/domain/workshop/WorkshopSessionMessageHandler';
import { WorkshopStandingDirectiveHandler } from '@handlers/domain/workshop/WorkshopStandingDirectiveHandler';
import { WorkshopTodoHandler } from '@handlers/domain/workshop/WorkshopTodoHandler';
import { WorkshopWidgetHostHandler } from '@handlers/domain/workshop/widgets/WorkshopWidgetHostHandler';
import {
  WorkshopGesturePlaygroundHandler
} from '@handlers/domain/workshop/widgets/gesturePlayground/WorkshopGesturePlaygroundHandler';
import {
  WorkshopCreativeVariationsHandler
} from '@handlers/domain/workshop/widgets/creativeVariations/WorkshopCreativeVariationsHandler';
import {
  WorkshopLexicalGravityHandler
} from '@handlers/domain/workshop/widgets/lexicalGravity/WorkshopLexicalGravityHandler';
import {
  WorkshopOneShotWidgetCommitCoordinator
} from '@/application/services/workshop/widgets/WorkshopOneShotWidgetCommitCoordinator';
import type {
  WorkshopOneShotWidgetId
} from '@/application/services/workshop/widgets/WorkshopOneShotWidgetCommitOperations';
import {
  WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY
} from '@/application/services/workshop/widgets/WorkshopWidgetAvailabilityPolicy';
import {
  createCreativeVariationsWorkupIdFactory
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsWorkupId';
import type {
  WorkshopMutationRouteOwner,
  WorkshopMutationRouteRegistrar,
  WorkshopRoomRouteRegistration,
  WorkshopSliceCompositionDependencies,
  WorkshopSliceHostEffects
} from '@handlers/domain/workshop/WorkshopRouteContracts';
import type { WorkshopSessionAction } from '@messages';
import { MessageType } from '@messages';

export class WorkshopSliceComposition {
  private readonly sessionMessageHandler: WorkshopSessionMessageHandler;
  private readonly gesturePlaygroundHandler: WorkshopGesturePlaygroundHandler;
  private readonly creativeVariationsHandler: WorkshopCreativeVariationsHandler;
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
    const markDirty = (reason: string): void => sessionPersistence.markDirty(reason);

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
        markDirty,
        reportError: (message, details) =>
          host.reportRouteError('workshop', message, details, 'WorkshopContextHandler'),
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
        markDirty,
        reportError: (message, details) =>
          host.reportRouteError('workshop', message, details, 'WorkshopExcerptScopeHandler'),
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
          host.reportRouteError('workshop', message, details, 'WorkshopSessionMessageHandler'),
        activeRunLabel: host.activeRunLabel
      }
    );
    this.gesturePlaygroundHandler = new WorkshopGesturePlaygroundHandler(
      session,
      widgetRuntime.gesturePlayground,
      WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY,
      postMessage,
      outputChannel
    );
    this.creativeVariationsHandler = new WorkshopCreativeVariationsHandler(
      session,
      widgetRuntime.creativeVariations,
      createCreativeVariationsWorkupIdFactory(),
      WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY,
      postMessage,
      outputChannel
    );
    const oneShotCommitCoordinator = new WorkshopOneShotWidgetCommitCoordinator(
      session,
      outputChannel,
      {
        sendRoomMessage: host.sendRoomMessage,
        postSessionState: host.postSessionState,
        markDirty
      }
    );
    const oneShotGenerationActivity = {
      'gesture-playground': () => this.gesturePlaygroundHandler.isGenerationActive(),
      'creative-variations': () => this.creativeVariationsHandler.isGenerationActive()
    } satisfies Record<WorkshopOneShotWidgetId, () => boolean>;
    this.widgetHostHandler = new WorkshopWidgetHostHandler(
      session,
      oneShotCommitCoordinator,
      WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY,
      postMessage,
      outputChannel,
      {
        isRoomRunActive: host.isRoomRunActive,
        isWidgetGenerationActive: (widgetId) => oneShotGenerationActivity[widgetId]()
      }
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
        markDirty
      }
    );
    this.todoHandler = new WorkshopTodoHandler(
      session,
      outputChannel,
      {
        postSessionState: host.postSessionState,
        markDirty,
        reportError: (message, details) =>
          host.reportRouteError('workshop.todo', message, details, 'WorkshopTodoHandler')
      }
    );
  }

  registerRoutes(
    router: MessageRouter,
    registerRoomRoutes: WorkshopRoomRouteRegistration
  ): void {
    registerRoomRoutes(
      router,
      this.createMutationRegistrar(router, 'WorkshopRoomHandler')
    );
    this.excerptScopeHandler.registerRoutes(
      router,
      this.createMutationRegistrar(router, 'WorkshopExcerptScopeHandler')
    );
    this.contextHandler.registerRoutes(
      router,
      this.createMutationRegistrar(router, 'WorkshopContextHandler')
    );
    this.sessionMessageHandler.registerRoutes(
      router,
      this.createMutationRegistrar(router, 'WorkshopSessionMessageHandler')
    );
    this.gesturePlaygroundHandler.registerRoutes(router);
    this.creativeVariationsHandler.registerRoutes(router);
    this.widgetHostHandler.registerRoutes(
      router,
      this.createMutationRegistrar(router, 'WorkshopWidgetHostHandler')
    );
    this.standingDirectiveHandler.registerRoutes(
      router,
      this.createMutationRegistrar(router, 'WorkshopStandingDirectiveHandler')
    );
    this.lexicalGravityHandler.registerRoutes(
      router,
      this.createMutationRegistrar(router, 'WorkshopLexicalGravityHandler')
    );
    this.todoHandler.registerRoutes(
      router,
      this.createMutationRegistrar(router, 'WorkshopTodoHandler')
    );
  }

  isContextRunActive(): boolean {
    return this.contextHandler.isRunning();
  }

  cancelContextRun(requestId: string): boolean {
    return this.contextHandler.cancelRun(requestId);
  }

  dispose(): void {
    // Preserve the lifecycle phases: feature work, room listeners, session
    // work, active room run, context work, then the final persistence flush.
    this.gesturePlaygroundHandler.dispose();
    this.creativeVariationsHandler.dispose();
    this.lexicalGravityHandler.dispose();
    this.host.disposeRoomSubscriptions();
    this.sessionMessageHandler.dispose();
    this.host.disposeActiveRoomRun();
    this.contextHandler.dispose();
    void this.dependencies.sessionPersistence.flush();
  }

  private createMutationRegistrar(
    router: MessageRouter,
    owner: WorkshopMutationRouteOwner
  ): WorkshopMutationRouteRegistrar {
    return (
      messageType: MessageType,
      handler: (message: never) => Promise<void>,
      sessionAction?: WorkshopSessionAction,
      onBlocked?: (reason: string, message: never) => void
    ): void => {
      router.register(messageType, async (message) => {
        const reportBlocked = onBlocked
          ? (reason: string) => onBlocked(reason, message as never)
          : undefined;
        if (this.rejectMutationDuringSessionOperation(owner, sessionAction, reportBlocked)) {
          return;
        }
        await handler(message as never);
      });
    };
  }

  private rejectMutationDuringSessionOperation(
    owner: WorkshopMutationRouteOwner,
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
      this.host.reportRouteError('workshop', message, undefined, owner);
    }
    return true;
  }
}
