import React from 'react';
import { MessageType, ModelScope, ModelOption } from '../../../../shared/types';
import { SettingsDataMessage, ModelDataMessage } from '../../../../shared/types/messages';
import { useVSCodeApi } from '../useVSCodeApi';
import { usePersistedState } from '../usePersistence';

/**
 * Models Settings
 * All 8 settings for AI model configuration and agent behavior
 * Syncs with package.json proseMinion.* settings
 */
export interface ModelsSettings {
  // Model Selections (4 settings)
  assistantModel: string;          // Model for prose/dialogue analysis (default: z-ai/glm-4.6)
  dictionaryModel: string;         // Model for dictionary lookups (default: z-ai/glm-4.6)
  contextModel: string;            // Model for context generation (default: z-ai/glm-4.6)
  model: string;                   // Legacy fallback model (default: z-ai/glm-4.6)

  // Agent Behavior (4 settings)
  includeCraftGuides: boolean;     // Include craft guides in prompts (default: true)
  temperature: number;             // Sampling temperature 0-2 (default: 0.7)
  maxTokens: number;               // Max tokens per request (default: 10000)
  applyContextWindowTrimming: boolean;  // Apply context window trimming (default: true)
}

export interface ModelsSettingsState {
  settings: ModelsSettings;
  modelOptions: ModelOption[];                          // Available models
  modelSelections: Partial<Record<ModelScope, string>>; // Current selections by scope
}

export interface ModelsSettingsActions {
  updateSetting: (key: keyof ModelsSettings, value: any) => void;
  setModelSelection: (scope: ModelScope, modelId: string) => void;
  handleSettingsData: (message: SettingsDataMessage) => void;
  handleModelData: (message: ModelDataMessage) => void;
}

export interface ModelsSettingsPersistence {
  modelsSettings: ModelsSettings;
  modelSelections: Partial<Record<ModelScope, string>>;
}

export type UseModelsSettingsReturn =
  ModelsSettingsState &
  ModelsSettingsActions &
  { persistedState: ModelsSettingsPersistence };

/**
 * Models Settings Hook
 *
 * Manages all AI model configuration and agent behavior settings using the Domain Hooks pattern.
 * Handles both model selections (which model to use for each scope) and agent behavior
 * (temperature, max tokens, craft guides, etc.).
 *
 * Provides bidirectional sync with VSCode settings and webview persistence.
 *
 * Backend support: ConfigurationHandler.getAllSettings() (Sprint 02)
 * Config watcher: General settings watcher in MessageHandler
 *
 * @returns Settings state, actions, and persisted state
 */
export const useModelsSettings = (): UseModelsSettingsReturn => {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<{
    // Support both legacy and standardized persisted keys
    modelsSettings?: ModelsSettings;
    modelSelections?: Partial<Record<ModelScope, string>>;
  }>();

  const defaults: ModelsSettings = {
    // Model Selections
    assistantModel: 'z-ai/glm-4.6',
    dictionaryModel: 'z-ai/glm-4.6',
    contextModel: 'z-ai/glm-4.6',
    model: 'z-ai/glm-4.6',  // Legacy fallback

    // Agent Behavior
    includeCraftGuides: true,
    temperature: 0.7,
    maxTokens: 10000,
    applyContextWindowTrimming: true,
  };

  // Seed from persisted state
  const persistedSeed = persisted?.modelsSettings as ModelsSettings | undefined;

  const [settings, setSettings] = React.useState<ModelsSettings>({
    ...defaults,
    ...(persistedSeed ?? {}),
  });

  const [modelOptions, setModelOptions] = React.useState<ModelOption[]>([]);
  const [modelSelections, setModelSelections] = React.useState<Partial<Record<ModelScope, string>>>(
    persisted?.modelSelections ?? {}
  );

  // Handle SETTINGS_DATA messages and extract model/agent behavior settings
  const handleSettingsData = React.useCallback((message: SettingsDataMessage) => {
    if (message.type === MessageType.SETTINGS_DATA) {
      const { settings: settingsData } = message.payload;

      // Extract model and agent behavior settings from flat structure
      const modelsSettings: Partial<ModelsSettings> = {
        // Model Selections
        assistantModel: settingsData['assistantModel'] as string | undefined,
        dictionaryModel: settingsData['dictionaryModel'] as string | undefined,
        contextModel: settingsData['contextModel'] as string | undefined,
        model: settingsData['model'] as string | undefined,

        // Agent Behavior
        includeCraftGuides: settingsData['includeCraftGuides'] as boolean | undefined,
        temperature: settingsData['temperature'] as number | undefined,
        maxTokens: settingsData['maxTokens'] as number | undefined,
        applyContextWindowTrimming: settingsData['applyContextWindowTrimming'] as boolean | undefined,
      };

      // Only update if we got valid data (check at least one setting is defined)
      if (modelsSettings.assistantModel !== undefined || modelsSettings.temperature !== undefined) {
        setSettings(prev => ({
          ...prev,
          // Model Selections
          assistantModel: modelsSettings.assistantModel ?? prev.assistantModel,
          dictionaryModel: modelsSettings.dictionaryModel ?? prev.dictionaryModel,
          contextModel: modelsSettings.contextModel ?? prev.contextModel,
          model: modelsSettings.model ?? prev.model,
          // Agent Behavior
          includeCraftGuides: modelsSettings.includeCraftGuides ?? prev.includeCraftGuides,
          temperature: modelsSettings.temperature ?? prev.temperature,
          maxTokens: modelsSettings.maxTokens ?? prev.maxTokens,
          applyContextWindowTrimming: modelsSettings.applyContextWindowTrimming ?? prev.applyContextWindowTrimming,
        }));
      }
    }
  }, []);

  // Handle MODEL_DATA messages (model options and selections)
  const handleModelData = React.useCallback((message: ModelDataMessage) => {
    if (message.type === MessageType.MODEL_DATA) {
      const { options, selections } = message.payload;

      if (options) {
        setModelOptions(options);
      }

      if (selections) {
        setModelSelections(prev => ({
          ...prev,
          ...(selections ?? {}),
        }));
      }
    }
  }, []);

  // Update a specific setting (send to backend with optimistic update)
  const updateSetting = React.useCallback((key: keyof ModelsSettings, value: any) => {
    // Optimistically update local state immediately for responsive UI
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));

    // Send to backend
    vscode.postMessage({
      type: MessageType.UPDATE_SETTING,
      source: 'webview.hooks.useModelsSettings',
      payload: {
        key,  // No prefix - these are top-level settings
        value
      },
      timestamp: Date.now()
    });
  }, [vscode]);

  // Set model selection for a specific scope (special handler)
  const setModelSelection = React.useCallback((scope: ModelScope, modelId: string) => {
    // Optimistically update local state immediately
    setModelSelections(prev => ({
      ...prev,
      [scope]: modelId,
    }));

    // Send to backend to persist
    vscode.postMessage({
      type: MessageType.SET_MODEL_SELECTION,
      source: 'webview.hooks.useModelsSettings',
      payload: {
        scope,
        modelId,
      },
      timestamp: Date.now(),
    });

    // Backend will send MODEL_DATA with the updated value after saving
  }, [vscode]);

  return {
    settings,
    modelOptions,
    modelSelections,
    updateSetting,
    setModelSelection,
    handleSettingsData,
    handleModelData,
    persistedState: {
      modelsSettings: settings,
      modelSelections,
    }
  };
};
