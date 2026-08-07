import {
  buildWorkshopAppMessageRoutes,
  WorkshopAppMessageRouterDeps
} from '@hooks/useWorkshopAppMessageRouter';
import { MessageType, WorkshopWidgetActionResultMessage } from '@messages';

const makeDeps = (): WorkshopAppMessageRouterDeps => ({
  workshopRoom: {
    handleSessionState: jest.fn(),
    handleTurn: jest.fn(),
    handleContextCatalog: jest.fn(),
    handleContextAttachmentContent: jest.fn(),
    handleContextSearchResults: jest.fn(),
    handleStreamStarted: jest.fn(),
    handleStreamChunk: jest.fn(),
    handleStreamComplete: jest.fn()
  } as never,
  workshopSessions: {
    handleSessionsData: jest.fn(),
    handleSessionActionResult: jest.fn(),
    handleSessionSaveStatus: jest.fn(),
    handleSessionRecoveryNotice: jest.fn()
  } as never,
  widgetHost: { handleWidgetConfigData: jest.fn() } as never,
  gesturePlayground: {
    handleWidgetMenuResult: jest.fn(),
    handleWidgetGenerationProgress: jest.fn(),
    handleWidgetActionResult: jest.fn()
  } as never,
  lexicalGravity: {
    handleActionResult: jest.fn(),
    handleLensesData: jest.fn(),
    handlePreviewResult: jest.fn(),
    handleCandidates: jest.fn(),
    handleLensesSaved: jest.fn()
  } as never,
  standingDirectives: { handleActionResult: jest.fn() } as never,
  excerptVerify: { handleSelectionData: jest.fn() } as never,
  modelsSettings: { handleModelData: jest.fn(), handleSettingsData: jest.fn() } as never,
  tokenTracking: { handleTokenUsageUpdate: jest.fn() } as never,
  accountBalance: { handleAccountBalanceData: jest.fn() } as never,
  startupNotice: { handleStartupNoticeData: jest.fn() } as never,
  handleApiKeyStatus: jest.fn(),
  handleStatusMessage: jest.fn(),
  handleErrorMessage: jest.fn(),
  handleCopyResultSuccess: jest.fn(),
  handleSaveResultSuccess: jest.fn()
});

describe('buildWorkshopAppMessageRoutes', () => {
  it('binds widget config data to the generic host and action results to both features', () => {
    const deps = makeDeps();
    const routes = buildWorkshopAppMessageRoutes(deps);
    const configMessage = {
      type: MessageType.WORKSHOP_WIDGET_CONFIG_DATA,
      source: 'extension.workshop.widget',
      timestamp: 1,
      payload: { configId: 'wc-1', error: 'Unavailable.' }
    } as const;
    const actionMessage: WorkshopWidgetActionResultMessage = {
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.lexical-gravity',
      timestamp: 2,
      payload: {
        action: 'remove-standing',
        requestToken: 'remove-1',
        widgetId: 'lexical-gravity',
        ok: true,
        removed: true
      }
    };

    routes[MessageType.WORKSHOP_WIDGET_CONFIG_DATA]!(configMessage as never);
    routes[MessageType.WORKSHOP_WIDGET_ACTION_RESULT]!(actionMessage);

    expect(deps.widgetHost.handleWidgetConfigData).toHaveBeenCalledWith(configMessage);
    expect(deps.gesturePlayground.handleWidgetActionResult).toHaveBeenCalledWith(actionMessage);
    expect(deps.lexicalGravity.handleActionResult).toHaveBeenCalledWith(actionMessage);
    expect(deps.standingDirectives.handleActionResult).toHaveBeenCalledWith(actionMessage);
  });

  it('routes consume-once checkpoint recovery notices to the session owner', () => {
    const deps = makeDeps();
    const routes = buildWorkshopAppMessageRoutes(deps);
    const message = {
      type: MessageType.WORKSHOP_SESSION_RECOVERY_NOTICE,
      source: 'extension.workshop',
      timestamp: 1,
      payload: {
        code: 'recovered-lexical-gravity-v1',
        widgetId: 'lexical-gravity',
        configId: 'wc-1',
        message: 'Recovered.'
      }
    } as const;

    routes[MessageType.WORKSHOP_SESSION_RECOVERY_NOTICE]!(message as never);

    expect(deps.workshopSessions.handleSessionRecoveryNotice).toHaveBeenCalledWith(message);
  });
});
