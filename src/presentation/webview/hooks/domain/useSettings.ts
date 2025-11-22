/**
 * useSettings - Domain hook for settings overlay and configuration
 *
 * Manages settings overlay visibility, settings data, token tracking,
 * API key management, and model selections.
 */

import * as React from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import { usePersistedState } from '../usePersistence';
import { MessageType, ModelScope, ModelOption } from '@shared/types';
import { SettingsDataMessage, ApiKeyStatusMessage, ModelDataMessage, TokenUsage } from '@messages';

export interface SettingsState {
  showSettings: boolean;
  settingsData: Record<string, string | number | boolean>;
  tokenTotals: TokenUsage;
  showTokenWidget: boolean;
  apiKeyInput: string;
  hasSavedKey: boolean;
  modelOptions: ModelOption[];
  modelSelections: Partial<Record<ModelScope, string>>;
}

export interface SettingsActions {
  open: () => void;
  close: () => void;
  toggle: () => void;
  handleSettingsData: (message: SettingsDataMessage) => void;
  handleApiKeyStatus: (message: ApiKeyStatusMessage) => void;
  handleModelOptionsData: (message: ModelDataMessage) => void;
  handleTokenUsageUpdate: (message: { type: string; payload: { totals: TokenUsage } }) => void;
  updateSetting: (key: string, value: any) => void;
  resetTokens: () => void;
  toggleTokenWidget: () => void;
  setModelSelection: (scope: ModelScope, model: string) => void;
  setApiKeyInput: (input: string) => void;
  saveApiKey: () => void;
  clearApiKey: () => void;
}

export interface SettingsPersistence {
  settingsData: Record<string, any>;
  tokenTotals: TokenUsage;
  showTokenWidget: boolean;
  modelSelections: Partial<Record<ModelScope, string>>;
}

export type UseSettingsReturn = SettingsState & SettingsActions & { persistedState: SettingsPersistence };

/**
 * Custom hook for managing settings overlay and configuration
 *
 * @example
 * ```tsx
 * const settings = useSettings();
 *
 * // Handle settings messages
 * useMessageRouter({
 *   [MessageType.SETTINGS_DATA]: settings.handleSettingsData,
 *   [MessageType.API_KEY_STATUS]: settings.handleApiKeyStatus,
 *   [MessageType.OPEN_SETTINGS]: settings.open,
 *   [MessageType.OPEN_SETTINGS_TOGGLE]: settings.toggle,
 * });
 *
 * // Render settings overlay
 * {settings.showSettings && (
 *   <SettingsOverlay
 *     visible={settings.showSettings}
 *     onClose={settings.close}
 *     settings={settings.settingsData}
 *     onUpdate={settings.updateSetting}
 *     onResetTokens={settings.resetTokens}
 *     apiKey={{
 *       input: settings.apiKeyInput,
 *       hasSavedKey: settings.hasSavedKey,
 *       onInputChange: settings.setApiKeyInput,
 *       onSave: settings.saveApiKey,
 *       onClear: settings.clearApiKey,
 *     }}
 *   />
 * )}
 * ```
 */
export const useSettings = (): UseSettingsReturn => {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<{
    settingsData?: Record<string, any>;
    tokenTotals?: TokenUsage;
    showTokenWidget?: boolean;
    modelSelections?: Partial<Record<ModelScope, string>>;
  }>();

  const [showSettings, setShowSettings] = React.useState<boolean>(false);
  const [settingsData, setSettingsData] = React.useState<Record<string, string | number | boolean>>(
    persisted?.settingsData ?? {}
  );
  const [tokenTotals, setTokenTotals] = React.useState<TokenUsage>(
    persisted?.tokenTotals ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  );
  const [showTokenWidget, setShowTokenWidget] = React.useState<boolean>(
    persisted?.showTokenWidget ?? true
  );
  const [apiKeyInput, setApiKeyInput] = React.useState<string>('');
  const [hasSavedKey, setHasSavedKey] = React.useState<boolean>(false);
  const [modelOptions, setModelOptions] = React.useState<ModelOption[]>([]);
  const [modelSelections, setModelSelections] = React.useState<Partial<Record<ModelScope, string>>>(
    persisted?.modelSelections ?? {}
  );

  const open = React.useCallback(() => {
    setShowSettings(true);
    vscode.postMessage({
      type: MessageType.REQUEST_SETTINGS_DATA,
      source: 'webview.settings.overlay',
      payload: {},
      timestamp: Date.now()
    });
    vscode.postMessage({
      type: MessageType.REQUEST_MODEL_DATA,
      source: 'webview.settings.overlay',
      payload: {},
      timestamp: Date.now()
    });
    vscode.postMessage({
      type: MessageType.REQUEST_PUBLISHING_STANDARDS_DATA,
      source: 'webview.settings.overlay',
      payload: {},
      timestamp: Date.now()
    });
    vscode.postMessage({
      type: MessageType.REQUEST_API_KEY,
      source: 'webview.settings.overlay',
      payload: {},
      timestamp: Date.now()
    });
  }, [vscode]);

  const close = React.useCallback(() => {
    setShowSettings(false);
  }, []);

  const toggle = React.useCallback(() => {
    setShowSettings((prev) => {
      const next = !prev;
      if (next) {
        vscode.postMessage({
          type: MessageType.REQUEST_SETTINGS_DATA,
          source: 'webview.settings.overlay',
          payload: {},
          timestamp: Date.now()
        });
        vscode.postMessage({
          type: MessageType.REQUEST_MODEL_DATA,
          source: 'webview.settings.overlay',
          payload: {},
          timestamp: Date.now()
        });
        vscode.postMessage({
          type: MessageType.REQUEST_PUBLISHING_STANDARDS_DATA,
          source: 'webview.settings.overlay',
          payload: {},
          timestamp: Date.now()
        });
        vscode.postMessage({
          type: MessageType.REQUEST_API_KEY,
          source: 'webview.settings.overlay',
          payload: {},
          timestamp: Date.now()
        });
      }
      return next;
    });
  }, [vscode]);

  const handleSettingsData = React.useCallback((message: SettingsDataMessage) => {
    // SETTINGS_DATA only contains general settings (not model options/selections)
    // Model data comes separately via MODEL_DATA message
    const { settings } = message.payload;
    setSettingsData(settings || {});
  }, []);

  const handleApiKeyStatus = React.useCallback((message: ApiKeyStatusMessage) => {
    const { hasSavedKey } = message.payload;
    setHasSavedKey(hasSavedKey);
  }, []);

  const handleModelOptionsData = React.useCallback((message: ModelDataMessage) => {
    const { options, selections, ui } = message.payload;
    if (options) {
      setModelOptions(options);
    }
    if (selections) {
      setModelSelections((prev) => ({
        ...prev,
        ...(selections ?? {}),
      }));
    }
    if (ui && typeof ui.showTokenWidget === 'boolean') {
      setShowTokenWidget(ui.showTokenWidget);
    }
  }, []);

  const handleTokenUsageUpdate = React.useCallback((message: { type: string; payload: { totals: TokenUsage } }) => {
    const { totals } = message.payload;
    setTokenTotals(totals);
  }, []);

  const updateSetting = React.useCallback(
    (key: string, value: any) => {
      // Optimistically update local state immediately
      setSettingsData((prev) => ({
        ...prev,
        [key]: value,
      }));

      // Send update to backend
      vscode.postMessage({
        type: MessageType.UPDATE_SETTING,
        source: 'webview.settings.overlay',
        payload: {
          key,
          value,
        },
        timestamp: Date.now(),
      });
    },
    [vscode]
  );

  const resetTokens = React.useCallback(() => {
    setTokenTotals({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
    vscode.postMessage({
      type: MessageType.RESET_TOKEN_USAGE,
      source: 'webview.settings.overlay',
      payload: {},
      timestamp: Date.now(),
    });
  }, [vscode]);

  const toggleTokenWidget = React.useCallback(() => {
    setShowTokenWidget((prev) => {
      const next = !prev;
      // Persist UI preference via generic settings update
      vscode.postMessage({
        type: MessageType.UPDATE_SETTING,
        source: 'webview.settings.overlay',
        payload: {
          key: 'ui.showTokenWidget',
          value: next,
        },
        timestamp: Date.now(),
      });
      return next;
    });
  }, [vscode]);

  const setModelSelection = React.useCallback(
    (scope: ModelScope, model: string) => {
      // Optimistically update local state immediately
      setModelSelections((prev) => ({
        ...prev,
        [scope]: model,
      }));

      // Send to backend to persist
      vscode.postMessage({
        type: MessageType.SET_MODEL_SELECTION,
        source: 'webview.settings.overlay',
        payload: {
          scope,
          modelId: model,
        },
        timestamp: Date.now(),
      });

      // Backend will send MODEL_DATA with the updated value after saving
    },
    [vscode]
  );

  const saveApiKey = React.useCallback(() => {
    if (!apiKeyInput.trim()) return;

    vscode.postMessage({
      type: MessageType.UPDATE_API_KEY,
      source: 'webview.settings.overlay',
      payload: {
        apiKey: apiKeyInput.trim(),
      },
      timestamp: Date.now()
    });

    setApiKeyInput(''); // Clear input after save
  }, [vscode, apiKeyInput]);

  const clearApiKey = React.useCallback(() => {
    vscode.postMessage({
      type: MessageType.DELETE_API_KEY,
      source: 'webview.settings.overlay',
      payload: {},
      timestamp: Date.now()
    });
  }, [vscode]);

  // Handle body overflow when settings overlay is open
  React.useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevDoc = (document.documentElement as HTMLElement).style.overflow;

    if (showSettings) {
      document.body.style.overflow = 'hidden';
      (document.documentElement as HTMLElement).style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = prevBody || '';
      (document.documentElement as HTMLElement).style.overflow = prevDoc || '';
    };
  }, [showSettings]);

  return {
    // State
    showSettings,
    settingsData,
    tokenTotals,
    showTokenWidget,
    apiKeyInput,
    hasSavedKey,
    modelOptions,
    modelSelections,

    // Actions
    open,
    close,
    toggle,
    handleSettingsData,
    handleApiKeyStatus,
    handleModelOptionsData,
    handleTokenUsageUpdate,
    updateSetting,
    resetTokens,
    toggleTokenWidget,
    setModelSelection,
    setApiKeyInput,
    saveApiKey,
    clearApiKey,

    // Persistence
    persistedState: {
      settingsData,
      tokenTotals,
      showTokenWidget,
      modelSelections,
    },
  };
};
