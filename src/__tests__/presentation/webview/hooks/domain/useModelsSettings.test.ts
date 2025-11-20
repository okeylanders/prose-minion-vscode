/**
 * @jest-environment jsdom
 */

/**
 * useModelsSettings Tests
 *
 * Comprehensive behavioral tests for models settings hook.
 * Tests initialization, state updates, message handling, and persistence.
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useModelsSettings } from '../../../../../presentation/webview/hooks/domain/useModelsSettings';
import { MessageType } from '../../../../../shared/types';
import { createMockVSCode } from '../../../../mocks/vscode';

// Mock dependencies
jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../../../presentation/webview/hooks/usePersistence');

import { useVSCodeApi } from '../../../../../presentation/webview/hooks/useVSCodeApi';
import { usePersistedState } from '../../../../../presentation/webview/hooks/usePersistence';

describe('useModelsSettings', () => {
  let mockVSCode: ReturnType<typeof createMockVSCode>;
  let mockPersistedState: any;

  beforeEach(() => {
    mockVSCode = createMockVSCode();
    mockPersistedState = {};

    (useVSCodeApi as jest.Mock).mockReturnValue(mockVSCode);
    (usePersistedState as jest.Mock).mockReturnValue(mockPersistedState);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct defaults', () => {
      const { result } = renderHook(() => useModelsSettings());

      expect(result.current.settings).toEqual({
        assistantModel: 'z-ai/glm-4.6',
        dictionaryModel: 'z-ai/glm-4.6',
        contextModel: 'z-ai/glm-4.6',
        categoryModel: 'anthropic/claude-sonnet-4.5',
        model: 'z-ai/glm-4.6',
        includeCraftGuides: true,
        temperature: 0.7,
        maxTokens: 10000,
        applyContextWindowTrimming: true
      });
    });

    it('should initialize with persisted state when available', () => {
      mockPersistedState.modelsSettings = {
        assistantModel: 'anthropic/claude-3-5-sonnet',
        dictionaryModel: 'openai/gpt-4',
        contextModel: 'google/gemini-pro',
        categoryModel: 'anthropic/claude-sonnet-4.5',
        model: 'anthropic/claude-3-5-sonnet',
        includeCraftGuides: false,
        temperature: 0.5,
        maxTokens: 5000,
        applyContextWindowTrimming: false
      };

      const { result } = renderHook(() => useModelsSettings());

      expect(result.current.settings).toEqual(mockPersistedState.modelsSettings);
    });

    it('should merge persisted state with defaults (partial persistence)', () => {
      mockPersistedState.modelsSettings = {
        assistantModel: 'anthropic/claude-3-5-sonnet',
        temperature: 0.9
      };

      const { result } = renderHook(() => useModelsSettings());

      expect(result.current.settings).toEqual({
        assistantModel: 'anthropic/claude-3-5-sonnet',  // From persisted
        dictionaryModel: 'z-ai/glm-4.6',                // Default
        contextModel: 'z-ai/glm-4.6',                   // Default
        categoryModel: 'anthropic/claude-sonnet-4.5',   // Default
        model: 'z-ai/glm-4.6',                          // Default
        includeCraftGuides: true,                       // Default
        temperature: 0.9,                               // From persisted
        maxTokens: 10000,                               // Default
        applyContextWindowTrimming: true                // Default
      });
    });
  });

  describe('Persistence State', () => {
    it('should expose persistedState for usePersistence', () => {
      const { result } = renderHook(() => useModelsSettings());

      expect(result.current.persistedState).toHaveProperty('modelsSettings');
      expect(result.current.persistedState.modelsSettings.assistantModel).toBe('z-ai/glm-4.6');
      expect(result.current.persistedState.modelsSettings.categoryModel).toBe('anthropic/claude-sonnet-4.5');
    });

    it('should update persistedState when settings change', () => {
      const { result } = renderHook(() => useModelsSettings());

      act(() => {
        result.current.updateSetting('temperature', 0.5);
      });

      expect(result.current.persistedState.modelsSettings.temperature).toBe(0.5);
    });
  });

  describe('updateSetting', () => {
    it('should send UPDATE_SETTING message when updateSetting called', () => {
      const { result } = renderHook(() => useModelsSettings());

      act(() => {
        result.current.updateSetting('temperature', 0.5);
      });

      expect(mockVSCode.postMessage).toHaveBeenCalledWith({
        type: MessageType.UPDATE_SETTING,
        source: 'webview.hooks.useModelsSettings',
        payload: {
          key: 'temperature',
          value: 0.5
        },
        timestamp: expect.any(Number)
      });
    });

    it('should optimistically update local state', () => {
      const { result } = renderHook(() => useModelsSettings());

      act(() => {
        result.current.updateSetting('temperature', 0.5);
      });

      expect(result.current.settings.temperature).toBe(0.5);
    });

    it('should update multiple settings independently', () => {
      const { result } = renderHook(() => useModelsSettings());

      act(() => {
        result.current.updateSetting('assistantModel', 'anthropic/claude-3-5-sonnet');
      });

      act(() => {
        result.current.updateSetting('temperature', 0.9);
      });

      expect(result.current.settings.assistantModel).toBe('anthropic/claude-3-5-sonnet');
      expect(result.current.settings.temperature).toBe(0.9);
      expect(result.current.settings.maxTokens).toBe(10000); // Unchanged
    });
  });

  describe('handleSettingsData', () => {
    it('should update state on SETTINGS_DATA message', () => {
      const { result } = renderHook(() => useModelsSettings());

      const message = {
        type: MessageType.SETTINGS_DATA,
        payload: {
          settings: {
            'assistantModel': 'anthropic/claude-3-5-sonnet',
            'dictionaryModel': 'openai/gpt-4',
            'contextModel': 'google/gemini-pro',
            'model': 'anthropic/claude-3-5-sonnet',
            'includeCraftGuides': false,
            'temperature': 0.5,
            'maxTokens': 5000,
            'applyContextWindowTrimming': false
          }
        }
      };

      act(() => {
        result.current.handleSettingsData(message as any);
      });

      expect(result.current.settings.assistantModel).toBe('anthropic/claude-3-5-sonnet');
      expect(result.current.settings.temperature).toBe(0.5);
      expect(result.current.settings.maxTokens).toBe(5000);
      expect(result.current.settings.includeCraftGuides).toBe(false);
    });

    it('should use defaults for missing settings in message', () => {
      const { result } = renderHook(() => useModelsSettings());

      const message = {
        type: MessageType.SETTINGS_DATA,
        payload: {
          settings: {
            'temperature': 0.9
            // Other settings missing - should preserve defaults
          }
        }
      };

      act(() => {
        result.current.handleSettingsData(message as any);
      });

      expect(result.current.settings.temperature).toBe(0.9);
      expect(result.current.settings.assistantModel).toBe('z-ai/glm-4.6'); // Default preserved
    });

    it('should not update if message has no models settings', () => {
      const { result } = renderHook(() => useModelsSettings());

      const initialSettings = { ...result.current.settings };

      const message = {
        type: MessageType.SETTINGS_DATA,
        payload: {
          settings: {
            'someOther.setting': 'value'
          }
        }
      };

      act(() => {
        result.current.handleSettingsData(message as any);
      });

      expect(result.current.settings).toEqual(initialSettings);
    });
  });

  describe('Stability and Re-renders', () => {
    it('should have stable function references (useCallback)', () => {
      const { result, rerender } = renderHook(() => useModelsSettings());

      const firstHandleSettingsData = result.current.handleSettingsData;
      const firstUpdateSetting = result.current.updateSetting;

      rerender();

      expect(result.current.handleSettingsData).toBe(firstHandleSettingsData);
      expect(result.current.updateSetting).toBe(firstUpdateSetting);
    });
  });
});
