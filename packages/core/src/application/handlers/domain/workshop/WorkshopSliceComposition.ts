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
import { WorkshopSessionExportHandler } from '@handlers/domain/workshop/WorkshopSessionExportHandler';
import { WorkshopStandingDirectiveHandler } from '@handlers/domain/workshop/WorkshopStandingDirectiveHandler';
import { WorkshopTodoHandler } from '@handlers/domain/workshop/WorkshopTodoHandler';
import { WorkshopBookmarkHandler } from '@handlers/domain/workshop/WorkshopBookmarkHandler';
import { WorkshopBookmarkBrowserHandler } from '@handlers/domain/workshop/WorkshopBookmarkBrowserHandler';
import { WorkshopProjectMemoryHandler } from '@handlers/domain/workshop/WorkshopProjectMemoryHandler';
import { WorkshopProjectMemoryManagerHandler } from '@handlers/domain/workshop/WorkshopProjectMemoryManagerHandler';
import { WorkshopSavedTurnMemoryHandler } from '@handlers/domain/workshop/WorkshopSavedTurnMemoryHandler';
import { WorkshopMemoryDraftHandler } from '@handlers/domain/workshop/WorkshopMemoryDraftHandler';
import { WorkshopLightboxTileHandler } from '@handlers/domain/workshop/WorkshopLightboxTileHandler';
import { WorkshopPinnedContextHandler } from '@handlers/domain/workshop/WorkshopPinnedContextHandler';
import { WorkshopFileEditHandler } from '@handlers/domain/workshop/WorkshopFileEditHandler';
import { WorkshopEditOfferHandler } from '@handlers/domain/workshop/WorkshopEditOfferHandler';
import { WorkshopWidgetHostHandler } from '@handlers/domain/workshop/widgets/WorkshopWidgetHostHandler';
import {
  WorkshopGesturePlaygroundHandler
} from '@handlers/domain/workshop/widgets/gesturePlayground/WorkshopGesturePlaygroundHandler';
import {
  WorkshopCreativeVariationsHandler
} from '@handlers/domain/workshop/widgets/creativeVariations/WorkshopCreativeVariationsHandler';
import {
  WorkshopShowVsTellHandler
} from '@handlers/domain/workshop/widgets/showVsTell/WorkshopShowVsTellHandler';
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
import {
  createShowVsTellWorkupIdFactory
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellWorkupId';
import type {
  WorkshopMutationRouteOwner,
  WorkshopMutationRouteRegistrar,
  WorkshopRoomRouteRegistration,
  WorkshopSliceCompositionDependencies,
  WorkshopSliceHostEffects
} from '@handlers/domain/workshop/WorkshopRouteContracts';
import type { WorkshopSessionAction, WorkshopTurn } from '@messages';
import { MessageType } from '@messages';

export class WorkshopSliceComposition {
  private readonly sessionMessageHandler: WorkshopSessionMessageHandler;
  private readonly sessionExportHandler: WorkshopSessionExportHandler;
  private readonly gesturePlaygroundHandler: WorkshopGesturePlaygroundHandler;
  private readonly creativeVariationsHandler: WorkshopCreativeVariationsHandler;
  private readonly showVsTellHandler: WorkshopShowVsTellHandler;
  private readonly widgetHostHandler: WorkshopWidgetHostHandler;
  private readonly standingDirectiveHandler: WorkshopStandingDirectiveHandler;
  private readonly lexicalGravityHandler: WorkshopLexicalGravityHandler;
  private readonly todoHandler: WorkshopTodoHandler;
  private readonly bookmarkHandler: WorkshopBookmarkHandler;
  private readonly bookmarkBrowserHandler: WorkshopBookmarkBrowserHandler;
  private readonly projectMemoryHandler: WorkshopProjectMemoryHandler;
  private readonly projectMemoryManagerHandler: WorkshopProjectMemoryManagerHandler;
  private readonly savedTurnMemoryHandler: WorkshopSavedTurnMemoryHandler;
  private readonly memoryDraftHandler: WorkshopMemoryDraftHandler;
  private readonly lightboxTileHandler: WorkshopLightboxTileHandler;
  private readonly pinnedContextHandler: WorkshopPinnedContextHandler;
  private readonly fileEditHandler: WorkshopFileEditHandler;
  private readonly editOfferHandler: WorkshopEditOfferHandler;
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
      transcriptExport,
      widgetRuntime,
      projectMemory,
      pinnedContext,
      bookmarkBrowser,
      fileEditApply,
      memoryDrafts,
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
        sendStatus: host.sendStatus,
        findReadInRecord: host.findReadInRecord
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
        refreshContextFiles: (origin) => this.contextHandler.refreshChangedContextFiles(origin),
        flushDeferredConversationSettings: host.flushDeferredConversationSettings,
        reportError: (message, details) =>
          host.reportRouteError('workshop', message, details, 'WorkshopSessionMessageHandler'),
        activeRunLabel: host.activeRunLabel,
        rewindCutForBubble: (turnId) => session.rewindCutForBubble(turnId)
      }
    );
    this.sessionExportHandler = new WorkshopSessionExportHandler(
      transcriptExport,
      sessionPersistence,
      shell,
      postMessage,
      outputChannel
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
    this.showVsTellHandler = new WorkshopShowVsTellHandler(
      session,
      widgetRuntime.showVsTell,
      createShowVsTellWorkupIdFactory(),
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
      'creative-variations': () => this.creativeVariationsHandler.isGenerationActive(),
      'show-vs-tell': () => this.showVsTellHandler.isGenerationActive()
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
    // A Lightbox tile handed over (Lightbox Slice 4): staged above the composer only after a granted claim.
    this.lightboxTileHandler = new WorkshopLightboxTileHandler(
      session,
      postMessage,
      outputChannel,
      {
        postSessionState: host.postSessionState,
        markDirty,
        isRoomRunActive: host.isRoomRunActive
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
    this.bookmarkHandler = new WorkshopBookmarkHandler(
      session,
      outputChannel,
      {
        postSessionState: host.postSessionState,
        markDirty,
        reportError: (message, details) =>
          host.reportRouteError('workshop.bookmark', message, details, 'WorkshopBookmarkHandler')
      },
      postMessage,
      sessionPersistence
    );
    // The Bookmarks screen's reads beside them (ADR 2026-11-05 D8): through recall, never the gate.
    this.bookmarkBrowserHandler = new WorkshopBookmarkBrowserHandler(
      bookmarkBrowser,
      session,
      sessionPersistence,
      postMessage,
      outputChannel,
      (message) => host.reportRouteError('workshop.bookmark', message, undefined, 'WorkshopBookmarkBrowserHandler')
    );
    // Project memory's write routes (ADR 2026-11-04 D13; Slice 3).
    this.projectMemoryHandler = new WorkshopProjectMemoryHandler(
      session,
      projectMemory,
      {
        isRoomRunActive: host.isRoomRunActive,
        isSessionOperationPending: () => sessionPersistence.isSessionOperationPending(),
        waitForSessionOperations: () => sessionPersistence.waitForSessionOperations(),
        liveSessionId: () => {
          const scope = sessionPersistence.recallScope();
          return scope.available ? scope.liveSessionId : undefined;
        }
      },
      {
        postSessionState: host.postSessionState,
        markDirty,
        reportError: (message, details) =>
          host.reportRouteError('workshop', message, details, 'WorkshopProjectMemoryHandler')
      },
      postMessage,
      outputChannel
    );
    // "Remember this" on a saved session's bookmark (ADR 2026-11-05 D9): checked through recall, written through the route above.
    this.savedTurnMemoryHandler = new WorkshopSavedTurnMemoryHandler(
      bookmarkBrowser,
      this.projectMemoryHandler,
      session,
      postMessage,
      outputChannel,
      (message) => host.reportRouteError('workshop', message, undefined, 'WorkshopSavedTurnMemoryHandler')
    );
    // The helper's draft of a memory opened from a turn (Helper Agent Slice 2): it reads the turn itself and writes nothing.
    this.memoryDraftHandler = new WorkshopMemoryDraftHandler(memoryDrafts, session, bookmarkBrowser, postMessage, outputChannel);
    // The memory manager's own routes beside them (Slice 4b): listing, Always load in full, Delete, Open file and folder.
    this.projectMemoryManagerHandler = new WorkshopProjectMemoryManagerHandler(
      projectMemory,
      shell,
      postMessage,
      outputChannel,
      (message) => host.reportRouteError('workshop', message, undefined, 'WorkshopProjectMemoryManagerHandler')
    );
    // The Pinned context tab's routes (Pinned Context Slice 3): the list's changes direct, Attach missing behind the gate.
    this.pinnedContextHandler = new WorkshopPinnedContextHandler(
      pinnedContext,
      session,
      shell,
      postMessage,
      outputChannel,
      {
        postSessionState: host.postSessionState,
        postTurn: host.postTurn,
        markDirty,
        sendStatus: host.sendStatus,
        activeRunLabel: host.activeRunLabel,
        roomReady: () => sessionPersistence.initialize(),
        runRoomOperation: (work) => sessionPersistence.runContextRefresh(work)
      }
    );
    // A persona file-edit card's Apply, Review in editor…, Decline and Preview (ADR 2026-11-05 D8, D9; Slice 4a).
    this.fileEditHandler = new WorkshopFileEditHandler(
      session,
      fileEditApply,
      sessionPersistence,
      { isRoomRunActive: host.isRoomRunActive, fileEditsMode: host.fileEditsMode },
      {
        postSessionState: host.postSessionState,
        markDirty,
        reportError: (message, details) =>
          host.reportRouteError('workshop', message, details, 'WorkshopFileEditHandler')
      },
      postMessage,
      outputChannel
    );
    // A press on a reply's edit offer (ADR 2026-11-10 D4): a host-directed run on the room's own message path.
    this.editOfferHandler = new WorkshopEditOfferHandler(
      session,
      {
        activeRunLabel: host.activeRunLabel,
        fileEditsMode: host.fileEditsMode,
        formatTurnTime: host.formatTurnTime,
        runDirected: host.runDirected
      },
      {
        reportError: (message, details) =>
          host.reportRouteError('workshop', message, details, 'WorkshopEditOfferHandler')
      },
      postMessage,
      outputChannel
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
    this.sessionExportHandler.registerRoutes(router);
    this.gesturePlaygroundHandler.registerRoutes(router);
    this.creativeVariationsHandler.registerRoutes(router);
    this.showVsTellHandler.registerRoutes(router);
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
    this.bookmarkHandler.registerRoutes(
      router,
      this.createMutationRegistrar(router, 'WorkshopBookmarkHandler')
    );
    this.bookmarkBrowserHandler.registerRoutes(router);
    this.lightboxTileHandler.registerRoutes(
      router,
      this.createMutationRegistrar(router, 'WorkshopLightboxTileHandler')
    );
    this.projectMemoryHandler.registerRoutes(
      router,
      this.createMutationRegistrar(router, 'WorkshopProjectMemoryHandler')
    );
    this.savedTurnMemoryHandler.registerRoutes(
      this.createMutationRegistrar(router, 'WorkshopSavedTurnMemoryHandler')
    );
    this.memoryDraftHandler.registerRoutes(router);
    this.projectMemoryManagerHandler.registerRoutes(router);
    this.pinnedContextHandler.registerRoutes(
      router,
      this.createMutationRegistrar(router, 'WorkshopPinnedContextHandler')
    );
    this.fileEditHandler.registerRoutes(
      router,
      this.createMutationRegistrar(router, 'WorkshopFileEditHandler')
    );
    this.editOfferHandler.registerRoutes(this.createMutationRegistrar(router, 'WorkshopEditOfferHandler'));
  }

  /** Save and tell me (Slice 5): a recorded reply's cards at `indexes`, saved now in order, as the tail of the run `signal` belongs to. */
  autoSaveMemoryProposals(turn: WorkshopTurn, indexes: readonly number[], signal: AbortSignal): Promise<void> {
    return this.projectMemoryHandler.autoSaveProposals(turn.id, indexes, signal);
  }

  /** The room's automatic saves, landed and in flight, for Save and tell me's cap (PR #201 F-04). */
  memoryAutoSavesInRoom(): number {
    return this.projectMemoryHandler.autoSavesInRoom();
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
    this.showVsTellHandler.dispose();
    this.lexicalGravityHandler.dispose();
    this.lightboxTileHandler.dispose();
    this.bookmarkBrowserHandler.dispose();
    this.memoryDraftHandler.dispose();
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
