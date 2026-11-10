/**
 * Testable extension-to-webview route composition for WorkshopApp.
 *
 * The frame's generic routes (models, tokens, balance, API-key status) come
 * from the shared full-tab chrome fragment; this table adds only the
 * Workshop's own messages on top of it.
 */

import { MessageType } from '@messages';
import type {
  CopyResultSuccessMessage,
  ErrorMessage,
  SaveResultSuccessMessage,
  StatusMessage
} from '@messages';
import type { UseStartupNoticeReturn } from '@hooks/domain/useStartupNotice';
import {
  buildFullTabChromeRoutes,
  FullTabChromeRouteDeps
} from '@hooks/fulltab/useFullTabChrome';
import type { UseWorkshopRoomReturn } from '@hooks/domain/workshop/useWorkshopRoom';
import type { UseWorkshopSessionsReturn } from '@hooks/domain/workshop/useWorkshopSessions';
import type { UseWorkshopReadInReturn } from '@hooks/domain/workshop/useWorkshopReadIn';
import type { UseWorkshopBookmarksReturn } from '@hooks/domain/workshop/useWorkshopBookmarks';
import type { UseWorkshopReactionsReturn } from '@hooks/domain/workshop/useWorkshopReactions';
import type { UseWorkshopBookmarkBrowserReturn } from '@hooks/domain/workshop/useWorkshopBookmarkBrowser';
import type {
  UseWorkshopExcerptVerifyReturn
} from '@hooks/domain/useWorkshopExcerptVerify';
import type {
  UseWorkshopWidgetHostReturn
} from '@hooks/domain/workshop/useWorkshopWidgetHost';
import type {
  UseGesturePlaygroundReturn
} from '@hooks/domain/workshop/widgets/useGesturePlayground';
import type {
  UseLexicalGravityReturn
} from '@hooks/domain/workshop/widgets/useLexicalGravity';
import type {
  UseCreativeVariationsReturn
} from '@hooks/domain/workshop/widgets/creativeVariations/useCreativeVariations';
import type {
  UseCreativeVariationsAuthoringReturn
} from '@hooks/domain/workshop/controllers/creativeVariations/useCreativeVariationsAuthoring';
import type {
  UseShowVsTellReturn
} from '@hooks/domain/workshop/widgets/showVsTell/useShowVsTell';
import type {
  UseShowVsTellAuthoringReturn
} from '@hooks/domain/workshop/controllers/showVsTell/useShowVsTellAuthoring';
import type {
  UseWorkshopStandingDirectivesReturn
} from '@hooks/domain/workshop/useWorkshopStandingDirectives';
import {
  dispatchWorkshopWidgetActionResult
} from '@hooks/domain/workshop/dispatchWorkshopWidgetActionResult';
import {
  dispatchWorkshopSelectionData
} from '@hooks/domain/workshop/dispatchWorkshopSelectionData';
import {
  dispatchWorkshopSeedClaimResult
} from '@hooks/domain/workshop/dispatchWorkshopSeedClaimResult';
import type {
  UseWorkshopLightboxTilesReturn
} from '@hooks/domain/workshop/useWorkshopLightboxTiles';
import { MessageHandlerMap, useMessageRouter } from '@hooks/useMessageRouter';
import type { UseWorkshopProjectMemoryReturn } from '@hooks/domain/workshop/useWorkshopProjectMemory';
import type { UseWorkshopMemoryManagerReturn } from '@hooks/domain/workshop/useWorkshopMemoryManager';
import type { UseWorkshopPinnedContextReturn } from '@hooks/domain/workshop/useWorkshopPinnedContext';
import type { UseWorkshopFileEditsReturn } from '@hooks/domain/workshop/useWorkshopFileEdits';
import type { UseWorkshopEditOffersReturn } from '@hooks/domain/workshop/useWorkshopEditOffers';

export interface WorkshopAppMessageRouterDeps {
  workshopRoom: UseWorkshopRoomReturn;
  workshopSessions: UseWorkshopSessionsReturn;
  /** The Read in reader's file content (Wayfinding Slice 2). */
  readIn: UseWorkshopReadInReturn;
  /** Bookmarks and the turn preview (Wayfinding Slice 5). */
  bookmarks: UseWorkshopBookmarksReturn;
  /** Message reactions (ADR 2026-11-07 D8): the snapshot's summaries. */
  reactions: Pick<UseWorkshopReactionsReturn, 'handleSessionState' | 'noteLiveTurn'>;
  /** The Bookmarks screen's answers (Bookmark Recall Slice 2). */
  bookmarkBrowser: Pick<
    UseWorkshopBookmarkBrowserReturn,
    'handleSessionState' | 'handleBookmarkPage' | 'handleLiveBookmarks' | 'handleSavedTurnPreview'
  >;
  /** Project memory's write answers and the sheet's reads (Project Memory Slice 3). */
  projectMemory: Pick<UseWorkshopProjectMemoryReturn, 'handleWriteResult' | 'handleEditData' | 'handleEstimateResult' | 'handleTurnPreview' | 'handleMemoryDraftResult' | 'handleMemoryDraftsSetting'>;
  /** The Memory tab's listing and the manager's answers (Project Memory Slice 4b). */
  memoryManager: Pick<UseWorkshopMemoryManagerReturn, 'handleListing' | 'handleManagerResult' | 'noteWriteResult' | 'noteEditData' | 'noteSessionState'>;
  /** The Pinned context tab's list (Pinned Context Slice 3). */
  pinnedContext: Pick<UseWorkshopPinnedContextReturn, 'handlePinnedContext'>;
  /** A suggested file edit's answers (Persona File Edits Slice 4b); absent reads as none. */
  fileEdits?: Pick<UseWorkshopFileEditsReturn, 'handleResult' | 'handlePreviewResult'>;
  /** A pressed edit offer's answer (Reply Edit Actions Slice 3); absent reads as none. */
  editOffers?: Pick<UseWorkshopEditOffersReturn, 'handleResult' | 'noteSessionState'>;
  widgetHost: UseWorkshopWidgetHostReturn;
  gesturePlayground: UseGesturePlaygroundReturn;
  lexicalGravity: UseLexicalGravityReturn;
  /** Lightbox tiles handed over (Lightbox Slice 4). */
  lightboxTiles: UseWorkshopLightboxTilesReturn;
  creativeVariations: UseCreativeVariationsReturn;
  creativeVariationsAuthoring: UseCreativeVariationsAuthoringReturn;
  showVsTell: UseShowVsTellReturn;
  showVsTellAuthoring: UseShowVsTellAuthoringReturn;
  standingDirectives: UseWorkshopStandingDirectivesReturn;
  excerptVerify: UseWorkshopExcerptVerifyReturn;
  /** The shared full-tab frame's state; its routes are merged in, not redeclared. */
  chrome: FullTabChromeRouteDeps;
  startupNotice: UseStartupNoticeReturn;
  handleStatusMessage: (message: StatusMessage) => void;
  handleErrorMessage: (message: ErrorMessage) => void;
  handleCopyResultSuccess: (message: CopyResultSuccessMessage) => void;
  handleSaveResultSuccess: (message: SaveResultSuccessMessage) => void;
}

export function buildWorkshopAppMessageRoutes(
  deps: WorkshopAppMessageRouterDeps
): MessageHandlerMap {
  const {
    workshopRoom,
    workshopSessions,
    readIn,
    bookmarks,
    reactions,
    bookmarkBrowser,
    projectMemory,
    memoryManager,
    pinnedContext,
    fileEdits,
    editOffers,
    widgetHost,
    gesturePlayground,
    lexicalGravity,
    lightboxTiles,
    creativeVariations,
    creativeVariationsAuthoring,
    showVsTell,
    showVsTellAuthoring,
    standingDirectives,
    excerptVerify,
    chrome,
    startupNotice,
    handleStatusMessage,
    handleErrorMessage,
    handleCopyResultSuccess,
    handleSaveResultSuccess
  } = deps;

  return {
    ...buildFullTabChromeRoutes(chrome),
    [MessageType.WORKSHOP_SESSION_STATE]: (message) => {
      workshopRoom.handleSessionState(message);
      bookmarks.handleSessionState(message);
      reactions.handleSessionState(message);
      bookmarkBrowser.handleSessionState(message);
      widgetHost.handleSessionState(message);
      memoryManager.noteSessionState(message);
      editOffers?.noteSessionState();
    },
    [MessageType.WORKSHOP_TURN]: (message) => {
      workshopRoom.handleTurn(message);
      reactions.noteLiveTurn(message);
    },
    [MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED]:
      workshopRoom.handleComposerDraftRestored,
    [MessageType.WORKSHOP_SESSIONS_DATA]: workshopSessions.handleSessionsData,
    [MessageType.WORKSHOP_SESSION_ACTION_RESULT]: workshopSessions.handleSessionActionResult,
    [MessageType.WORKSHOP_SESSION_CONTEXT_SCAN]: workshopSessions.handleSessionContextScan,
    [MessageType.WORKSHOP_SESSION_SAVE_STATUS]: workshopSessions.handleSessionSaveStatus,
    [MessageType.WORKSHOP_SESSION_RECOVERY_NOTICE]:
      workshopSessions.handleSessionRecoveryNotice,
    [MessageType.SELECTION_DATA]: (message) => {
      dispatchWorkshopSelectionData(message, {
        handleExcerptVerification: excerptVerify.handleSelectionData,
        handleCreativeVariationsSubject:
          creativeVariationsAuthoring.handleSubjectSelection,
        handleShowVsTellBeat: showVsTellAuthoring.handleBeatSelection,
        handleShowVsTellPassage: showVsTellAuthoring.handlePassageSelection
      });
    },
    [MessageType.WORKSHOP_CONTEXT_CATALOG]: workshopRoom.handleContextCatalog,
    [MessageType.WORKSHOP_CONTEXT_ATTACHMENT_CONTENT]: workshopRoom.handleContextAttachmentContent,
    [MessageType.WORKSHOP_READ_IN_RESOURCE_CONTENT]: readIn.handleReadInResourceContent,
    // The reader's preview, and a memory sheet prefilled from a bookmark outside the window; each takes only its own requests.
    [MessageType.WORKSHOP_TURN_PREVIEW]: (message) => {
      bookmarks.handleTurnPreview(message);
      projectMemory.handleTurnPreview(message);
    },
    [MessageType.WORKSHOP_RENAME_BOOKMARK_RESULT]: bookmarks.handleRenameResult,
    [MessageType.WORKSHOP_BOOKMARK_PAGE]: bookmarkBrowser.handleBookmarkPage,
    [MessageType.WORKSHOP_LIVE_BOOKMARKS]: bookmarkBrowser.handleLiveBookmarks,
    [MessageType.WORKSHOP_SAVED_TURN_PREVIEW]: bookmarkBrowser.handleSavedTurnPreview,
    // Slice 3's answers reach both hooks; each takes only its own requests.
    [MessageType.WORKSHOP_MEMORY_WRITE_RESULT]: (message) => {
      projectMemory.handleWriteResult(message);
      memoryManager.noteWriteResult(message);
    },
    [MessageType.WORKSHOP_MEMORY_EDIT_DATA]: (message) => {
      projectMemory.handleEditData(message);
      memoryManager.noteEditData(message);
    },
    [MessageType.WORKSHOP_MEMORY_LISTING]: memoryManager.handleListing,
    [MessageType.WORKSHOP_MEMORY_MANAGER_RESULT]: memoryManager.handleManagerResult,
    [MessageType.WORKSHOP_PINNED_CONTEXT]: pinnedContext.handlePinnedContext,
    ...(fileEdits ? {
      [MessageType.WORKSHOP_FILE_EDIT_RESULT]: fileEdits.handleResult,
      [MessageType.WORKSHOP_FILE_EDIT_PREVIEW_RESULT]: fileEdits.handlePreviewResult
    } : {}),
    ...(editOffers ? { [MessageType.WORKSHOP_EDIT_OFFER_RESULT]: editOffers.handleResult } : {}),
    [MessageType.WORKSHOP_MEMORY_ESTIMATE_RESULT]: projectMemory.handleEstimateResult,
    [MessageType.WORKSHOP_MEMORY_DRAFT_RESULT]: projectMemory.handleMemoryDraftResult,
    [MessageType.WORKSHOP_MEMORY_DRAFTS_SETTING]: projectMemory.handleMemoryDraftsSetting,
    [MessageType.WORKSHOP_CONTEXT_SEARCH_RESULTS]: workshopRoom.handleContextSearchResults,
    [MessageType.WORKSHOP_GESTURE_PLAYGROUND_MENU_RESULT]:
      gesturePlayground.handleWidgetMenuResult,
    [MessageType.WORKSHOP_WIDGET_CONFIG_DATA]: widgetHost.handleWidgetConfigData,
    [MessageType.WORKSHOP_WIDGET_CONFIG_RESTORED]: widgetHost.handleWidgetConfigRestored,
    [MessageType.WORKSHOP_GESTURE_PLAYGROUND_GENERATION_PROGRESS]:
      gesturePlayground.handleWidgetGenerationProgress,
    [MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATION_PROGRESS]:
      creativeVariations.handleGenerationProgress,
    [MessageType.WORKSHOP_CREATIVE_VARIATIONS_RESULT]:
      creativeVariations.handleGenerationResult,
    [MessageType.WORKSHOP_SHOW_VS_TELL_GENERATION_PROGRESS]:
      showVsTell.handleGenerationProgress,
    [MessageType.WORKSHOP_SHOW_VS_TELL_RESULT]: showVsTell.handleGenerationResult,
    [MessageType.WORKSHOP_WIDGET_ACTION_RESULT]: (message) => {
      dispatchWorkshopWidgetActionResult(message, {
        handleGestureActionResult: gesturePlayground.handleWidgetActionResult,
        handleCreativeVariationsActionResult: creativeVariations.handleCommitResult,
        handleShowVsTellActionResult: showVsTell.handleCommitResult,
        handleLexicalActionResult: lexicalGravity.handleActionResult,
        handleStandingDirectiveActionResult: standingDirectives.handleActionResult
      });
    },
    [MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_DATA]: lexicalGravity.handleLensesData,
    [MessageType.WORKSHOP_LEXICAL_GRAVITY_PREVIEW_RESULT]: lexicalGravity.handlePreviewResult,
    [MessageType.WORKSHOP_LEXICAL_GRAVITY_LENS_CANDIDATES]: lexicalGravity.handleCandidates,
    [MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_SAVED]: lexicalGravity.handleLensesSaved,
    [MessageType.WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED]: lexicalGravity.handleBuildSeed,
    // Seed delivery's claim results, each to its own kind's receiver (PR #150 F-03; Lightbox Slice 4).
    [MessageType.WORKSHOP_SEED_CLAIM_RESULT]: (message) => {
      dispatchWorkshopSeedClaimResult(message, {
        // eslint-disable-next-line @typescript-eslint/naming-convention -- seed kinds are kebab-case protocol literals.
        'lexical-gravity-build': lexicalGravity.handleSeedClaimResult,
        // eslint-disable-next-line @typescript-eslint/naming-convention -- seed kinds are kebab-case protocol literals.
        'lightbox-tile': lightboxTiles.handleSeedClaimResult
      });
    },
    [MessageType.WORKSHOP_LIGHTBOX_TILE_OFFERED]: lightboxTiles.handleTileOffered,
    [MessageType.WORKSHOP_LIGHTBOX_TILE_STAGED]: lightboxTiles.handleTileStaged,
    [MessageType.STREAM_STARTED]: workshopRoom.handleStreamStarted,
    [MessageType.STREAM_CHUNK]: workshopRoom.handleStreamChunk,
    [MessageType.STREAM_COMPLETE]: workshopRoom.handleStreamComplete,
    [MessageType.STATUS]: handleStatusMessage,
    [MessageType.ERROR]: handleErrorMessage,
    [MessageType.STARTUP_NOTICE_DATA]: startupNotice.handleStartupNoticeData,
    [MessageType.COPY_RESULT_SUCCESS]: handleCopyResultSuccess,
    [MessageType.SAVE_RESULT_SUCCESS]: handleSaveResultSuccess
  };
}

export function useWorkshopAppMessageRouter(deps: WorkshopAppMessageRouterDeps): void {
  useMessageRouter(buildWorkshopAppMessageRoutes(deps));
}
