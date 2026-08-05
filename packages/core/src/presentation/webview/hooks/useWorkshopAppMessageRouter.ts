/** Testable extension-to-webview route composition for WorkshopApp. */

import { MessageType } from '@messages';
import type {
  ApiKeyStatusMessage,
  CopyResultSuccessMessage,
  ErrorMessage,
  SaveResultSuccessMessage,
  StatusMessage
} from '@messages';
import type { UseAccountBalanceReturn } from '@hooks/domain/useAccountBalance';
import type { UseModelsSettingsReturn } from '@hooks/domain/useModelsSettings';
import type { UseStartupNoticeReturn } from '@hooks/domain/useStartupNotice';
import type { UseTokenTrackingReturn } from '@hooks/domain/useTokenTracking';
import type { UseWorkshopRoomReturn } from '@hooks/domain/workshop/useWorkshopRoom';
import type { UseWorkshopSessionsReturn } from '@hooks/domain/workshop/useWorkshopSessions';
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
  UseWorkshopStandingDirectivesReturn
} from '@hooks/domain/workshop/useWorkshopStandingDirectives';
import {
  dispatchWorkshopWidgetActionResult
} from '@hooks/domain/workshop/dispatchWorkshopWidgetActionResult';
import { MessageHandlerMap, useMessageRouter } from '@hooks/useMessageRouter';

export interface WorkshopAppMessageRouterDeps {
  workshopRoom: UseWorkshopRoomReturn;
  workshopSessions: UseWorkshopSessionsReturn;
  widgetHost: UseWorkshopWidgetHostReturn;
  gesturePlayground: UseGesturePlaygroundReturn;
  lexicalGravity: UseLexicalGravityReturn;
  standingDirectives: UseWorkshopStandingDirectivesReturn;
  excerptVerify: UseWorkshopExcerptVerifyReturn;
  modelsSettings: UseModelsSettingsReturn;
  tokenTracking: UseTokenTrackingReturn;
  accountBalance: UseAccountBalanceReturn;
  startupNotice: UseStartupNoticeReturn;
  handleApiKeyStatus: (message: ApiKeyStatusMessage) => void;
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
    widgetHost,
    gesturePlayground,
    lexicalGravity,
    standingDirectives,
    excerptVerify,
    modelsSettings,
    tokenTracking,
    accountBalance,
    startupNotice,
    handleApiKeyStatus,
    handleStatusMessage,
    handleErrorMessage,
    handleCopyResultSuccess,
    handleSaveResultSuccess
  } = deps;

  return {
    [MessageType.WORKSHOP_SESSION_STATE]: workshopRoom.handleSessionState,
    [MessageType.WORKSHOP_TURN]: workshopRoom.handleTurn,
    [MessageType.WORKSHOP_SESSIONS_DATA]: workshopSessions.handleSessionsData,
    [MessageType.WORKSHOP_SESSION_ACTION_RESULT]: workshopSessions.handleSessionActionResult,
    [MessageType.WORKSHOP_SESSION_SAVE_STATUS]: workshopSessions.handleSessionSaveStatus,
    [MessageType.SELECTION_DATA]: excerptVerify.handleSelectionData,
    [MessageType.WORKSHOP_CONTEXT_CATALOG]: workshopRoom.handleContextCatalog,
    [MessageType.WORKSHOP_CONTEXT_ATTACHMENT_CONTENT]: workshopRoom.handleContextAttachmentContent,
    [MessageType.WORKSHOP_CONTEXT_SEARCH_RESULTS]: workshopRoom.handleContextSearchResults,
    [MessageType.WORKSHOP_GESTURE_PLAYGROUND_MENU_RESULT]:
      gesturePlayground.handleWidgetMenuResult,
    [MessageType.WORKSHOP_WIDGET_CONFIG_DATA]: widgetHost.handleWidgetConfigData,
    [MessageType.WORKSHOP_GESTURE_PLAYGROUND_GENERATION_PROGRESS]:
      gesturePlayground.handleWidgetGenerationProgress,
    [MessageType.WORKSHOP_WIDGET_ACTION_RESULT]: (message) => {
      dispatchWorkshopWidgetActionResult(message, {
        handleGestureActionResult: gesturePlayground.handleWidgetActionResult,
        handleLexicalActionResult: lexicalGravity.handleActionResult,
        handleStandingDirectiveActionResult: standingDirectives.handleActionResult
      });
    },
    [MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_DATA]: lexicalGravity.handleLensesData,
    [MessageType.WORKSHOP_LEXICAL_GRAVITY_PREVIEW_RESULT]: lexicalGravity.handlePreviewResult,
    [MessageType.WORKSHOP_LEXICAL_GRAVITY_LENS_CANDIDATES]: lexicalGravity.handleCandidates,
    [MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_SAVED]: lexicalGravity.handleLensesSaved,
    [MessageType.STREAM_STARTED]: workshopRoom.handleStreamStarted,
    [MessageType.STREAM_CHUNK]: workshopRoom.handleStreamChunk,
    [MessageType.STREAM_COMPLETE]: workshopRoom.handleStreamComplete,
    [MessageType.STATUS]: handleStatusMessage,
    [MessageType.ERROR]: handleErrorMessage,
    [MessageType.MODEL_DATA]: modelsSettings.handleModelData,
    [MessageType.SETTINGS_DATA]: modelsSettings.handleSettingsData,
    [MessageType.TOKEN_USAGE_UPDATE]: tokenTracking.handleTokenUsageUpdate,
    [MessageType.ACCOUNT_BALANCE_DATA]: accountBalance.handleAccountBalanceData,
    [MessageType.STARTUP_NOTICE_DATA]: startupNotice.handleStartupNoticeData,
    [MessageType.API_KEY_STATUS]: handleApiKeyStatus,
    [MessageType.COPY_RESULT_SUCCESS]: handleCopyResultSuccess,
    [MessageType.SAVE_RESULT_SUCCESS]: handleSaveResultSuccess
  };
}

export function useWorkshopAppMessageRouter(deps: WorkshopAppMessageRouterDeps): void {
  useMessageRouter(buildWorkshopAppMessageRoutes(deps));
}
