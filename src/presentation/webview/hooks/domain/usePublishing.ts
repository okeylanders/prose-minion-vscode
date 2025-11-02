/**
 * usePublishing - Domain hook for publishing standards management
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
  abbreviation?: string;
  pageSizes: Array<{ key: string; label: string }>;
}

export interface PublishingState {
  publishingPreset: string;
  publishingTrimKey: string;
  publishingGenres: Genre[];
}

export interface PublishingActions {
  handlePublishingStandardsData: (message: PublishingStandardsDataMessage) => void;
  setPublishingPreset: (preset: string) => void;
  setPublishingTrim: (pageSizeKey?: string) => void;
}

export interface PublishingPersistence {
  publishingPreset: string;
  publishingTrimKey: string;
}

export type UsePublishingReturn = PublishingState & PublishingActions & { persistedState: PublishingPersistence };

/**
 * Custom hook for managing publishing standards state and operations
 *
 * @example
 * ```tsx
 * const publishing = usePublishing();
 *
 * // Handle publishing standards data message
 * useMessageRouter({
 *   [MessageType.PUBLISHING_STANDARDS_DATA]: publishing.handlePublishingStandardsData,
 * });
 *
 * // Use in SettingsOverlay
 * <SettingsOverlay
 *   publishing={{
 *     preset: publishing.publishingPreset,
 *     trimKey: publishing.publishingTrimKey,
 *     genres: publishing.publishingGenres,
 *     onPresetChange: publishing.setPublishingPreset,
 *     onTrimChange: publishing.setPublishingTrim,
 *   }}
 * />
 * ```
 */
export const usePublishing = (): UsePublishingReturn => {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<{ publishingPreset?: string; publishingTrimKey?: string }>();

  const [publishingPreset, setPublishingPresetState] = React.useState<string>(
    persisted?.publishingPreset ?? 'none'
  );
  const [publishingTrimKey, setPublishingTrimKeyState] = React.useState<string>(
    persisted?.publishingTrimKey ?? ''
  );
  const [publishingGenres, setPublishingGenres] = React.useState<Genre[]>([]);

  const handlePublishingStandardsData = React.useCallback((message: PublishingStandardsDataMessage) => {
    const { preset, pageSizeKey, genres } = message.payload;
    setPublishingPresetState(preset || 'none');
    setPublishingTrimKeyState(pageSizeKey || '');
    setPublishingGenres((genres ?? []) as Genre[]);
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
