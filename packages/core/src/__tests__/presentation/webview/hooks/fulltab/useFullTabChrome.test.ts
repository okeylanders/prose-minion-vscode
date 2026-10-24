/**
 * @jest-environment jsdom
 */

/**
 * useFullTabChrome — the shared frame state behind every full editor tab
 * (Lightbox Slice 1). Pins the three contracts a second root relies on: the
 * route fragment, the caller's envelope source, and a persistence shape that
 * matches what the Workshop stored before the extraction.
 */

import { act, renderHook } from '@testing-library/react';
import { MessageType } from '@messages';
import type { ApiKeyStatusMessage } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import {
  buildFullTabChromeRoutes,
  FullTabChromeRouteDeps,
  useFullTabChrome
} from '@hooks/fulltab/useFullTabChrome';

jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const apiKeyStatus = (hasSavedKey: boolean): ApiKeyStatusMessage => ({
  type: MessageType.API_KEY_STATUS,
  source: 'extension.configuration',
  payload: { hasSavedKey },
  timestamp: 1
});

describe('useFullTabChrome', () => {
  let mockVSCode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    mockVSCode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(mockVSCode);
  });

  afterEach(() => jest.clearAllMocks());

  const posted = () => mockVSCode.postMessage.mock.calls.map(([message]) => message);

  it('asks for model data and API-key status on mount, under the caller source', () => {
    renderHook(() => useFullTabChrome({ source: 'webview.lightbox' }));

    const keyRequest = posted().find((message) => message.type === MessageType.REQUEST_API_KEY);
    expect(keyRequest).toEqual(expect.objectContaining({ source: 'webview.lightbox', payload: {} }));
    expect(posted().some((message) => message.type === MessageType.REQUEST_MODEL_DATA)).toBe(true);
    // The balance chip fetches its own (cache-friendly) value on mount.
    expect(posted().some((message) => message.type === MessageType.REQUEST_ACCOUNT_BALANCE))
      .toBe(true);
  });

  it('opens the assistant settings under the caller source', () => {
    const { result } = renderHook(() => useFullTabChrome({ source: 'webview.workshop' }));
    mockVSCode.postMessage.mockClear();

    act(() => result.current.openAssistantSettings());

    expect(posted()).toEqual([expect.objectContaining({
      type: MessageType.OPEN_ASSISTANT_SETTINGS,
      source: 'webview.workshop',
      payload: {}
    })]);
  });

  it('pauses the provider only once the host says no key is saved', () => {
    const { result } = renderHook(() => useFullTabChrome({ source: 'webview.workshop' }));
    expect(result.current.hasSavedKey).toBeNull();
    expect(result.current.providerPaused).toBe(false);

    act(() => result.current.handleApiKeyStatus(apiKeyStatus(false)));
    expect(result.current.hasSavedKey).toBe(false);
    expect(result.current.providerPaused).toBe(true);

    act(() => result.current.handleApiKeyConfigured());
    expect(result.current.hasSavedKey).toBe(true);
    expect(result.current.providerPaused).toBe(false);
  });

  it('force-refreshes the balance when a key becomes configured', () => {
    const { result } = renderHook(() => useFullTabChrome({ source: 'webview.workshop' }));
    mockVSCode.postMessage.mockClear();

    act(() => result.current.handleApiKeyStatus(apiKeyStatus(true)));

    expect(posted()).toContainEqual(expect.objectContaining({
      type: MessageType.REQUEST_ACCOUNT_BALANCE,
      payload: { forceRefresh: true }
    }));
  });

  it('persists the same keys the Workshop stored for these hooks before the extraction, and which scopes follow (Slice 4L)', () => {
    const { result } = renderHook(() => useFullTabChrome({ source: 'webview.workshop' }));

    expect(Object.keys(result.current.persistedState).sort())
      .toEqual(['followingModelScopes', 'modelSelections', 'modelsSettings', 'tokenTracking']);
    expect(result.current.persistedState).toEqual({
      ...result.current.modelsSettings.persistedState,
      ...result.current.tokenTracking.persistedState,
      ...result.current.accountBalance.persistedState
    });
  });
});

describe('buildFullTabChromeRoutes', () => {
  const makeDeps = (): FullTabChromeRouteDeps => ({
    modelsSettings: { handleModelData: jest.fn(), handleSettingsData: jest.fn() },
    tokenTracking: { handleTokenUsageUpdate: jest.fn() },
    accountBalance: { handleAccountBalanceData: jest.fn() },
    handleApiKeyStatus: jest.fn(),
    handleApiKeyConfigured: jest.fn()
  });

  it('owns exactly the frame’s generic messages', () => {
    expect(Object.keys(buildFullTabChromeRoutes(makeDeps())).sort()).toEqual([
      MessageType.ACCOUNT_BALANCE_DATA,
      MessageType.API_KEY_STATUS,
      MessageType.CLEAR_TRANSIENT_API_KEY_WARNING,
      MessageType.MODEL_DATA,
      MessageType.SETTINGS_DATA,
      MessageType.TOKEN_USAGE_UPDATE
    ].sort());
  });

  it('binds each message to its owner', () => {
    const deps = makeDeps();
    const routes = buildFullTabChromeRoutes(deps);

    expect(routes[MessageType.MODEL_DATA]).toBe(deps.modelsSettings.handleModelData);
    expect(routes[MessageType.SETTINGS_DATA]).toBe(deps.modelsSettings.handleSettingsData);
    expect(routes[MessageType.TOKEN_USAGE_UPDATE]).toBe(deps.tokenTracking.handleTokenUsageUpdate);
    expect(routes[MessageType.ACCOUNT_BALANCE_DATA])
      .toBe(deps.accountBalance.handleAccountBalanceData);
    expect(routes[MessageType.API_KEY_STATUS]).toBe(deps.handleApiKeyStatus);
    expect(routes[MessageType.CLEAR_TRANSIENT_API_KEY_WARNING]).toBe(deps.handleApiKeyConfigured);
  });
});
