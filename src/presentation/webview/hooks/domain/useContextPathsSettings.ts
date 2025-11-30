import React from 'react';
import { MessageType } from '@shared/types';
import { SettingsDataMessage } from '@messages';
import { useVSCodeApi } from '../useVSCodeApi';
import { usePersistedState } from '../usePersistence';

/**
 * Context Paths Settings
 * All 8 settings for Context Assistant resource paths
 * Syncs with package.json proseMinion.contextPaths.* settings
 */
export interface ContextPathsSettings {
  characters: string;     // Glob patterns for character reference files
  locations: string;      // Glob patterns for setting/location files
  themes: string;         // Glob patterns for theme notebooks
  things: string;         // Glob patterns for important objects/props
  chapters: string;       // Glob patterns for draft chapters and outlines
  manuscript: string;     // Glob patterns for polished manuscript chapters
  projectBrief: string;   // Glob patterns for project brief materials
  general: string;        // Glob patterns for general reference material
}

export interface ContextPathsSettingsState {
  settings: ContextPathsSettings;
}

export interface ContextPathsSettingsActions {
  updateSetting: (key: keyof ContextPathsSettings, value: any) => void;
  handleSettingsData: (message: SettingsDataMessage) => void;
}

export interface ContextPathsSettingsPersistence {
  contextPathsSettings: ContextPathsSettings;
}

export type UseContextPathsSettingsReturn =
  ContextPathsSettingsState &
  ContextPathsSettingsActions &
  { persistedState: ContextPathsSettingsPersistence };

/**
 * Context Paths Settings Hook
 *
 * Manages all 8 context path settings using the Domain Hooks pattern.
 * These are comma-separated glob patterns that define where the Context Assistant
 * looks for different types of reference material.
 *
 * Provides bidirectional sync with VSCode settings and webview persistence.
 *
 * Backend support: ConfigurationHandler.getAllSettings() (Sprint 02)
 * Config watcher: General settings watcher in MessageHandler
 *
 * @example
 * ```tsx
 * const contextPathsSettings = useContextPathsSettings();
 *
 * // Handle settings messages
 * useMessageRouter({
 *   [MessageType.SETTINGS_DATA]: contextPathsSettings.handleSettingsData,
 * });
 *
 * // Use in SettingsOverlay - Context Paths section
 * <div className="context-paths-settings">
 *   <label>Character Files</label>
 *   <input
 *     value={contextPathsSettings.settings.characters}
 *     onChange={(e) => contextPathsSettings.updateSetting('characters', e.target.value)}
 *     placeholder="characters/**\/*,Characters/**\/*"
 *   />
 *
 *   <label>Location Files</label>
 *   <input
 *     value={contextPathsSettings.settings.locations}
 *     onChange={(e) => contextPathsSettings.updateSetting('locations', e.target.value)}
 *     placeholder="locations/**\/*,Locations/**\/*"
 *   />
 *
 *   <label>Theme Notebooks</label>
 *   <input
 *     value={contextPathsSettings.settings.themes}
 *     onChange={(e) => contextPathsSettings.updateSetting('themes', e.target.value)}
 *     placeholder="themes/**\/*,Themes/**\/*"
 *   />
 *
 *   // ... similar inputs for things, chapters, manuscript, projectBrief, general
 * </div>
 * ```
 *
 * @returns Settings state (8 glob path patterns), actions (updateSetting, handleSettingsData), and persisted state
 */
export const useContextPathsSettings = (): UseContextPathsSettingsReturn => {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<{
    // Support both legacy and standardized persisted keys
    contextPaths?: ContextPathsSettings;
    contextPathsSettings?: ContextPathsSettings;
  }>();

  const defaults: ContextPathsSettings = {
    characters: 'characters/**/*,Characters/**/*',
    locations: 'locations/**/*,Locations/**/*,Locations-Settings/**/*',
    themes: 'themes/**/*,Themes/**/*',
    things: 'things/**/*,Things/**/*',
    chapters: 'drafts/**/*,Drafts/**/*,outlines/**/*,Outlines/**/*',
    manuscript: 'manuscript/**/*,Manuscript/**/*',
    projectBrief: 'brief/**/*,Brief/**/*',
    general: 'research/**/*,Research/**/*,tone-and-style/**/*,Tone-And-Style/**/*,literary-devices/**/*,Literary-Devices/**/*,**/story-bible.md,**/synopsis.md,**/voice-and-tone.md,**/genre-conventions.md',
  };

  // Seed from persisted state (prefer standardized key, fallback to legacy)
  const persistedSeed = (persisted?.contextPathsSettings ?? persisted?.contextPaths) as
    | ContextPathsSettings
    | undefined;

  const [settings, setSettings] = React.useState<ContextPathsSettings>({
    ...defaults,
    ...(persistedSeed ?? {}),
  });

  // Handle SETTINGS_DATA messages and extract context path settings
  const handleSettingsData = React.useCallback((message: SettingsDataMessage) => {
    if (message.type === MessageType.SETTINGS_DATA) {
      const { settings: settingsData } = message.payload;

      // Extract contextPaths.* settings from flat structure
      const contextPathsSettings: Partial<ContextPathsSettings> = {
        characters: settingsData['contextPaths.characters'] as string | undefined,
        locations: settingsData['contextPaths.locations'] as string | undefined,
        themes: settingsData['contextPaths.themes'] as string | undefined,
        things: settingsData['contextPaths.things'] as string | undefined,
        chapters: settingsData['contextPaths.chapters'] as string | undefined,
        manuscript: settingsData['contextPaths.manuscript'] as string | undefined,
        projectBrief: settingsData['contextPaths.projectBrief'] as string | undefined,
        general: settingsData['contextPaths.general'] as string | undefined,
      };

      // Only update if we got valid data (check at least one setting is defined)
      if (contextPathsSettings.characters !== undefined) {
        setSettings(prev => ({
          ...prev,
          characters: contextPathsSettings.characters ?? prev.characters,
          locations: contextPathsSettings.locations ?? prev.locations,
          themes: contextPathsSettings.themes ?? prev.themes,
          things: contextPathsSettings.things ?? prev.things,
          chapters: contextPathsSettings.chapters ?? prev.chapters,
          manuscript: contextPathsSettings.manuscript ?? prev.manuscript,
          projectBrief: contextPathsSettings.projectBrief ?? prev.projectBrief,
          general: contextPathsSettings.general ?? prev.general,
        }));
      }
    }
  }, []);

  // Update a specific setting (send to backend with optimistic update)
  const updateSetting = React.useCallback((key: keyof ContextPathsSettings, value: any) => {
    // Optimistically update local state immediately for responsive UI
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));

    // Send to backend
    vscode.postMessage({
      type: MessageType.UPDATE_SETTING,
      source: 'webview.hooks.useContextPathsSettings',
      payload: {
        key: `contextPaths.${key}`,
        value
      },
      timestamp: Date.now()
    });
  }, [vscode]);

  return {
    settings,
    updateSetting,
    handleSettingsData,
    persistedState: { contextPathsSettings: settings }
  };
};
