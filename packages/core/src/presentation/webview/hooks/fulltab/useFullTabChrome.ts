/**
 * useFullTabChrome — the generic state behind a full editor tab's frame
 * (ADR 2026-10-19 D2, Lightbox Slice 1).
 *
 * Every full-tab root (the Workshop today, the Lightbox next) shows the same
 * header status cluster and the same provider-paused banner. This hook owns
 * the state those pieces render from, which the Workshop used to compute
 * inline: model settings (the assistant-scope model chip), token tracking
 * (the processed chip), the OpenRouter balance, and whether an API key is
 * saved. It also issues the frame's two mount requests (model data and API-key
 * status) and owns the settings opener behind the banner's "Add API key".
 *
 * Messages this hook posts carry the caller's envelope `source`, so each tab
 * is traceable as itself (`webview.workshop`, `webview.lightbox`). The
 * matching inbound routes live in {@link buildFullTabChromeRoutes}; a root
 * merges that fragment into its own route table rather than redeclaring them.
 */
import * as React from 'react';
import { MessageType } from '@messages';
import type { ApiKeyStatusMessage } from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import type { MessageHandlerMap } from '@hooks/useMessageRouter';
import { UseAccountBalanceReturn, useAccountBalance } from '@hooks/domain/useAccountBalance';
import {
  ModelsSettingsPersistence,
  UseModelsSettingsReturn,
  useModelsSettings
} from '@hooks/domain/useModelsSettings';
import {
  TokenTrackingPersistence,
  UseTokenTrackingReturn,
  useTokenTracking
} from '@hooks/domain/useTokenTracking';

/** The webview half of `MessageSource`: which tab a posted envelope came from. */
export type FullTabEnvelopeSource = `webview.${string}`;

export interface UseFullTabChromeArgs {
  source: FullTabEnvelopeSource;
}

export interface FullTabChromeState {
  /** Assistant-scope model chip; also the widget model the Workshop reads. */
  modelsSettings: UseModelsSettingsReturn;
  /** Processed chip and the "last request" line of the balance title. */
  tokenTracking: UseTokenTrackingReturn;
  /** OpenRouter balance chip. */
  accountBalance: UseAccountBalanceReturn;
  /** `null` until the host answers REQUEST_API_KEY. */
  hasSavedKey: boolean | null;
  /** True only once the host has said no key is saved: show the paused banner. */
  providerPaused: boolean;
}

export interface FullTabChromeActions {
  handleApiKeyStatus: (message: ApiKeyStatusMessage) => void;
  /** A key self-healed host-side (CLEAR_TRANSIENT_API_KEY_WARNING). */
  handleApiKeyConfigured: () => void;
  /** Opens the existing settings overlay at the API key (OPEN_ASSISTANT_SETTINGS). */
  openAssistantSettings: () => void;
}

/**
 * Exactly what the Workshop persisted for these hooks before the extraction,
 * under the same keys, so a restored webview reads back unchanged state.
 * Balances are deliberately absent: `AccountBalancePersistence` is empty
 * because a persisted credit figure could only be stale (and intersecting its
 * `Record<string, never>` would erase every other key's type).
 */
export type FullTabChromePersistence = ModelsSettingsPersistence & TokenTrackingPersistence;

export type UseFullTabChromeReturn = FullTabChromeState & FullTabChromeActions & {
  persistedState: FullTabChromePersistence;
};

/** The narrow handler set the route fragment binds; a test can supply just this. */
export interface FullTabChromeRouteDeps {
  modelsSettings: Pick<UseModelsSettingsReturn, 'handleModelData' | 'handleSettingsData'>;
  tokenTracking: Pick<UseTokenTrackingReturn, 'handleTokenUsageUpdate'>;
  accountBalance: Pick<UseAccountBalanceReturn, 'handleAccountBalanceData'>;
  handleApiKeyStatus: FullTabChromeActions['handleApiKeyStatus'];
  handleApiKeyConfigured: FullTabChromeActions['handleApiKeyConfigured'];
}

/**
 * Inbound routes for the frame's generic messages. Roots spread this into
 * their own table; they do not declare these message types themselves.
 */
export function buildFullTabChromeRoutes(chrome: FullTabChromeRouteDeps): MessageHandlerMap {
  return {
    [MessageType.MODEL_DATA]: chrome.modelsSettings.handleModelData,
    [MessageType.SETTINGS_DATA]: chrome.modelsSettings.handleSettingsData,
    [MessageType.TOKEN_USAGE_UPDATE]: chrome.tokenTracking.handleTokenUsageUpdate,
    [MessageType.ACCOUNT_BALANCE_DATA]: chrome.accountBalance.handleAccountBalanceData,
    [MessageType.API_KEY_STATUS]: chrome.handleApiKeyStatus,
    [MessageType.CLEAR_TRANSIENT_API_KEY_WARNING]: chrome.handleApiKeyConfigured
  };
}

export function useFullTabChrome({ source }: UseFullTabChromeArgs): UseFullTabChromeReturn {
  const vscode = useVSCodeApi();
  const modelsSettings = useModelsSettings();
  const tokenTracking = useTokenTracking();
  const [hasSavedKey, setHasSavedKey] = React.useState<boolean | null>(null);
  const accountBalance = useAccountBalance({ apiKeyConfigured: hasSavedKey === true });

  const handleApiKeyStatus = React.useCallback((message: ApiKeyStatusMessage) => {
    setHasSavedKey(!!message.payload?.hasSavedKey);
  }, []);

  const handleApiKeyConfigured = React.useCallback(() => {
    setHasSavedKey(true);
  }, []);

  const openAssistantSettings = React.useCallback(() => {
    vscode.postMessage({
      type: MessageType.OPEN_ASSISTANT_SETTINGS,
      source,
      payload: {},
      timestamp: Date.now()
    });
  }, [source, vscode]);

  // Model options and selections are host truth; ask once on mount.
  React.useEffect(() => {
    modelsSettings.requestModelData();
  }, [modelsSettings.requestModelData]);

  // The paused banner and the balance refresh both wait on this answer.
  React.useEffect(() => {
    vscode.postMessage({
      type: MessageType.REQUEST_API_KEY,
      source,
      payload: {},
      timestamp: Date.now()
    });
  }, [source, vscode]);

  return {
    modelsSettings,
    tokenTracking,
    accountBalance,
    hasSavedKey,
    providerPaused: hasSavedKey === false,
    handleApiKeyStatus,
    handleApiKeyConfigured,
    openAssistantSettings,
    persistedState: {
      ...modelsSettings.persistedState,
      ...tokenTracking.persistedState,
      ...accountBalance.persistedState
    }
  };
}
