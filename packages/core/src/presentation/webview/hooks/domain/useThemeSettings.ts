import React from 'react';
import { MessageType } from '@shared/types';
import { SettingsDataMessage } from '@messages';
import { useVSCodeApi } from '../useVSCodeApi';
import { usePersistedState } from '../usePersistence';

/**
 * Sidebar theme preference (UI-only).
 *
 * 'warm-dark' (default) pins Prose Minion's brand palette; 'follow-vscode'
 * re-anchors the surface ramp on the active VS Code theme (applied as
 * [data-pm-theme="follow"] on .app-container in App.tsx).
 *
 * Mirrors useTokensSettings: seeds from webview persistence, syncs via
 * SETTINGS_DATA (key 'ui.sidebarTheme'), and writes back through UPDATE_SETTING
 * (the 'ui.' prefix is already an allowed update key in ConfigurationHandler).
 */
export type SidebarTheme = 'warm-dark' | 'follow-vscode';

export interface ThemeSettings {
  sidebarTheme: SidebarTheme;
}

export interface ThemeSettingsState {
  settings: ThemeSettings;
}

export interface ThemeSettingsActions {
  updateSetting: (key: keyof ThemeSettings, value: SidebarTheme) => void;
  handleSettingsData: (message: SettingsDataMessage) => void;
}

export interface ThemeSettingsPersistence {
  themeSettings: ThemeSettings;
}

export type UseThemeSettingsReturn =
  ThemeSettingsState &
  ThemeSettingsActions &
  { persistedState: ThemeSettingsPersistence };

const isSidebarTheme = (value: unknown): value is SidebarTheme =>
  value === 'warm-dark' || value === 'follow-vscode';

export const useThemeSettings = (): UseThemeSettingsReturn => {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<{ themeSettings?: ThemeSettings }>();

  const defaults: ThemeSettings = { sidebarTheme: 'follow-vscode' };

  const [settings, setSettings] = React.useState<ThemeSettings>({
    ...defaults,
    ...(persisted?.themeSettings ?? {}),
  });

  // Handle SETTINGS_DATA messages (authoritative value from config on load)
  const handleSettingsData = React.useCallback((message: SettingsDataMessage) => {
    if (message.type === MessageType.SETTINGS_DATA) {
      const value = message.payload.settings['ui.sidebarTheme'];
      if (isSidebarTheme(value)) {
        setSettings(prev => ({ ...prev, sidebarTheme: value }));
      }
    }
  }, []);

  // Optimistically update local state, then persist to config (key 'ui.<key>')
  const updateSetting = React.useCallback((key: keyof ThemeSettings, value: SidebarTheme) => {
    setSettings(prev => ({ ...prev, [key]: value }));

    vscode.postMessage({
      type: MessageType.UPDATE_SETTING,
      source: 'webview.hooks.useThemeSettings',
      payload: {
        key: `ui.${key}`,
        value
      },
      timestamp: Date.now()
    });
  }, [vscode]);

  return {
    settings,
    updateSetting,
    handleSettingsData,
    persistedState: { themeSettings: settings }
  };
};
