/**
 * usePublishingSettings - Domain hook for publishing standards management
 *
 * Manages publishing preset, trim size, and genre data.
 */

import * as React from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import { usePersistedState } from '../usePersistence';
import { MessageType } from '../../../../shared/types';
import { PublishingStandardsDataMessage } from '../../../../shared/types/messages';

export interface Genre {
  key: string;
  name: string;
  abbreviation: string;
  pageSizes: Array<{ key: string; label: string; width: number; height: number; common: boolean }>;
}

export interface PublishingSettingsState {
  publishingPreset: string;
  publishingTrimKey: string;
  publishingGenres: Genre[];
}

export interface PublishingSettingsActions {
  handlePublishingStandardsData: (message: PublishingStandardsDataMessage) => void;
  setPublishingPreset: (preset: string) => void;
  setPublishingTrim: (pageSizeKey?: string) => void;
}

export interface PublishingSettingsPersistence {
  publishingPreset: string;
  publishingTrimKey: string;
}

export type UsePublishingSettingsReturn = PublishingSettingsState & PublishingSettingsActions & { persistedState: PublishingSettingsPersistence };

/**
 * Custom hook for managing publishing standards state and operations
 *
 * @example
 * ```tsx
 * const publishingSettings = usePublishingSettings();
 *
 * // Handle publishing standards data message
 * useMessageRouter({
 *   [MessageType.PUBLISHING_STANDARDS_DATA]: publishingSettings.handlePublishingStandardsData,
 * });
 *
 * // Use in SettingsOverlay
 * <SettingsOverlay
 *   publishing={{
 *     preset: publishingSettings.publishingPreset,
 *     trimKey: publishingSettings.publishingTrimKey,
 *     genres: publishingSettings.publishingGenres,
 *     onPresetChange: publishingSettings.setPublishingPreset,
 *     onTrimChange: publishingSettings.setPublishingTrim,
 *   }}
 * />
 * ```
 */
export const usePublishingSettings = (): UsePublishingSettingsReturn => {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<{ publishingPreset?: string; publishingTrimKey?: string }>();

  const [publishingPreset, setPublishingPresetState] = React.useState<string>(
    persisted?.publishingPreset ?? 'none'
  );
  const [publishingTrimKey, setPublishingTrimKeyState] = React.useState<string>(
    persisted?.publishingTrimKey ?? ''
  );
  const [publishingGenres, setPublishingGenres] = React.useState<Genre[]>([]);

  // Request publishing standards data on mount to populate genres array
  React.useEffect(() => {
    vscode.postMessage({
      type: MessageType.REQUEST_PUBLISHING_STANDARDS_DATA,
      source: 'webview.hooks.usePublishingSettings',
      payload: {},
      timestamp: Date.now()
    });
  }, [vscode]);

  const handlePublishingStandardsData = React.useCallback((message: PublishingStandardsDataMessage) => {
    const { preset, pageSizeKey, genres } = message.payload;

    // Only update if values are provided (preserves persisted state on initial empty message)
    if (preset !== undefined) {
      setPublishingPresetState(preset || 'none');
    }
    if (pageSizeKey !== undefined) {
      setPublishingTrimKeyState(pageSizeKey || '');
    }
    if (genres !== undefined) {
      setPublishingGenres(genres as Genre[]);
    }
  }, []);

  const setPublishingPreset = React.useCallback(
    (preset: string) => {
      setPublishingPresetState(preset);
      vscode.postMessage({
        type: MessageType.SET_PUBLISHING_PRESET,
        source: 'webview.settings.publishing',
        payload: { preset },
        timestamp: Date.now()
      });
    },
    [vscode]
  );

  const setPublishingTrim = React.useCallback(
    (pageSizeKey?: string) => {
      setPublishingTrimKeyState(pageSizeKey || '');
      vscode.postMessage({
        type: MessageType.SET_PUBLISHING_TRIM_SIZE,
        source: 'webview.settings.publishing',
        payload: { pageSizeKey },
        timestamp: Date.now()
      });
    },
    [vscode]
  );

  return {
    // State
    publishingPreset,
    publishingTrimKey,
    publishingGenres,

    // Actions
    handlePublishingStandardsData,
    setPublishingPreset,
    setPublishingTrim,

    // Persistence
    persistedState: {
      publishingPreset,
      publishingTrimKey,
    },
  };
};
