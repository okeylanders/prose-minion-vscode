import {
  buildWorkshopAppMessageRoutes,
  WorkshopAppMessageRouterDeps
} from '@hooks/useWorkshopAppMessageRouter';
import { MessageType, WorkshopWidgetActionResultMessage } from '@messages';

const makeDeps = (): WorkshopAppMessageRouterDeps => ({
  workshopRoom: {
    handleSessionState: jest.fn(),
    handleTurn: jest.fn(),
    handleComposerDraftRestored: jest.fn(),
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
  creativeVariations: {
    handleGenerationProgress: jest.fn(),
    handleGenerationResult: jest.fn()
  } as never,
  creativeVariationsAuthoring: {
    handleSubjectSelection: jest.fn()
  } as never,
  standingDirectives: { handleActionResult: jest.fn() } as never,
  excerptVerify: { handleSelectionData: jest.fn() } as never,
  modelsSettings: { handleModelData: jest.fn(), handleSettingsData: jest.fn() } as never,
  tokenTracking: { handleTokenUsageUpdate: jest.fn() } as never,
  accountBalance: { handleAccountBalanceData: jest.fn() } as never,
  startupNotice: { handleStartupNoticeData: jest.fn() } as never,
  handleApiKeyStatus: jest.fn(),
  handleApiKeyConfigured: jest.fn(),
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
        code: 'recovered-widget-lexical-gravity-v1',
        widgetId: 'lexical-gravity',
        configId: 'wc-1',
        message: 'Recovered.'
      }
    } as const;

    routes[MessageType.WORKSHOP_SESSION_RECOVERY_NOTICE]!(message as never);

    expect(deps.workshopSessions.handleSessionRecoveryNotice).toHaveBeenCalledWith(message);
  });

  it('routes rolled-back writer text to the room composer recovery handler', () => {
    const deps = makeDeps();
    const routes = buildWorkshopAppMessageRoutes(deps);
    const message = {
      type: MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED,
      source: 'extension.workshop',
      timestamp: 1,
      payload: { text: 'Try me again.' }
    } as const;

    routes[MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED]!(message as never);

    expect(deps.workshopRoom.handleComposerDraftRestored).toHaveBeenCalledWith(message);
  });

  it('routes successful key self-heal to the Workshop availability owner', () => {
    const deps = makeDeps();
    const routes = buildWorkshopAppMessageRoutes(deps);
    const message = {
      type: MessageType.CLEAR_TRANSIENT_API_KEY_WARNING,
      source: 'extension.handler',
      timestamp: 1,
      payload: {}
    } as const;

    routes[MessageType.CLEAR_TRANSIENT_API_KEY_WARNING]!(message as never);

    expect(deps.handleApiKeyConfigured).toHaveBeenCalledTimes(1);
  });

  it('routes Creative generation and exact subject intake to their named owners', () => {
    const deps = makeDeps();
    const routes = buildWorkshopAppMessageRoutes(deps);
    const selection = {
      type: MessageType.SELECTION_DATA,
      source: 'extension.ui',
      timestamp: 1,
      payload: {
        target: 'workshop_creative_variations_subject',
        content: 'Selected passage.',
        sourceUri: 'file:///draft.md',
        relativePath: 'draft.md'
      }
    } as const;
    const progress = {
      type: MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATION_PROGRESS,
      source: 'extension.workshop',
      timestamp: 2,
      payload: {
        widgetId: 'creative-variations',
        token: 'cv-1',
        workupId: 'cvw-1',
        phase: 'started',
        stage: 'requesting',
        outputCharacters: 0,
        estimatedOutputTokens: 0,
        outputTokenLimit: 45_000
      }
    } as const;

    routes[MessageType.SELECTION_DATA]!(selection as never);
    routes[MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATION_PROGRESS]!(
      progress as never
    );

    expect(deps.creativeVariationsAuthoring.handleSubjectSelection)
      .toHaveBeenCalledWith(selection.payload);
    expect(deps.excerptVerify.handleSelectionData).not.toHaveBeenCalled();
    expect(deps.creativeVariations.handleGenerationProgress).toHaveBeenCalledWith(progress);
  });
});
