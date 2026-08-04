/** Testable extension-to-webview route composition for WorkshopApp. */

import { MessageType } from '@messages';
import type {
  ApiKeyStatusMessage,
  CopyResultSuccessMessage,
  ErrorMessage,
  SaveResultSuccessMessage,
  StatusMessage
} from '@messages';
import type { WorkshopToastState } from '@components/workshop/WorkshopToast';
import type { UseAccountBalanceReturn } from '@hooks/domain/useAccountBalance';
import type { UseModelsSettingsReturn } from '@hooks/domain/useModelsSettings';
import type { UseStartupNoticeReturn } from '@hooks/domain/useStartupNotice';
import type { UseTokenTrackingReturn } from '@hooks/domain/useTokenTracking';
import type { UseWorkshopReturn } from '@hooks/domain/useWorkshop';
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
import {
  dispatchWorkshopWidgetActionResult
} from '@hooks/domain/workshop/dispatchWorkshopWidgetActionResult';
import { MessageHandlerMap, useMessageRouter } from '@hooks/useMessageRouter';

export interface WorkshopAppMessageRouterDeps {
  workshop: UseWorkshopReturn;
  widgetHost: UseWorkshopWidgetHostReturn;
  gesturePlayground: UseGesturePlaygroundReturn;
  lexicalGravity: UseLexicalGravityReturn;
  excerptVerify: UseWorkshopExcerptVerifyReturn;
  modelsSettings: UseModelsSettingsReturn;
  tokenTracking: UseTokenTrackingReturn;
  accountBalance: UseAccountBalanceReturn;
  startupNotice: UseStartupNoticeReturn;
  showToast: (toast: WorkshopToastState) => void;
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
    workshop,
    widgetHost,
    gesturePlayground,
    lexicalGravity,
    excerptVerify,
    modelsSettings,
    tokenTracking,
    accountBalance,
    startupNotice,
    showToast,
    handleApiKeyStatus,
    handleStatusMessage,
    handleErrorMessage,
    handleCopyResultSuccess,
    handleSaveResultSuccess
  } = deps;

  return {
    [MessageType.WORKSHOP_SESSION_STATE]: workshop.handleSessionState,
    [MessageType.WORKSHOP_TURN]: workshop.handleTurn,
    [MessageType.WORKSHOP_SESSIONS_DATA]: workshop.handleSessionsData,
    [MessageType.WORKSHOP_SESSION_ACTION_RESULT]: workshop.handleSessionActionResult,
    [MessageType.WORKSHOP_SESSION_SAVE_STATUS]: workshop.handleSessionSaveStatus,
    [MessageType.SELECTION_DATA]: excerptVerify.handleSelectionData,
    [MessageType.WORKSHOP_CONTEXT_CATALOG]: workshop.handleContextCatalog,
    [MessageType.WORKSHOP_CONTEXT_ATTACHMENT_CONTENT]: workshop.handleContextAttachmentContent,
    [MessageType.WORKSHOP_CONTEXT_SEARCH_RESULTS]: workshop.handleContextSearchResults,
    [MessageType.WORKSHOP_WIDGET_MENU_RESULT]: gesturePlayground.handleWidgetMenuResult,
    [MessageType.WORKSHOP_WIDGET_CONFIG_DATA]: widgetHost.handleWidgetConfigData,
    [MessageType.WORKSHOP_WIDGET_GENERATION_PROGRESS]:
      gesturePlayground.handleWidgetGenerationProgress,
    [MessageType.WORKSHOP_WIDGET_ACTION_RESULT]: (message) => {
      dispatchWorkshopWidgetActionResult(message, {
        handleGestureActionResult: gesturePlayground.handleWidgetActionResult,
        handleLexicalActionResult: lexicalGravity.handleActionResult,
        showToast
      });
    },
    [MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_DATA]: lexicalGravity.handleLensesData,
    [MessageType.WORKSHOP_LEXICAL_GRAVITY_PREVIEW_RESULT]: lexicalGravity.handlePreviewResult,
    [MessageType.WORKSHOP_LEXICAL_GRAVITY_LENS_CANDIDATES]: lexicalGravity.handleCandidates,
    [MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_SAVED]: lexicalGravity.handleLensesSaved,
    [MessageType.STREAM_STARTED]: workshop.handleStreamStarted,
    [MessageType.STREAM_CHUNK]: workshop.handleStreamChunk,
    [MessageType.STREAM_COMPLETE]: workshop.handleStreamComplete,
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
