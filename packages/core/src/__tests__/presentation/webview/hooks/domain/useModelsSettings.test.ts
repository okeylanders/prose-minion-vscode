/**
 * @jest-environment jsdom
 */

/**
 * useModelsSettings Tests
 *
 * Comprehensive behavioral tests for models settings hook.
 * Tests initialization, state updates, message handling, and persistence.
 */

import { renderHook, act } from '@testing-library/react';
import { useModelsSettings } from '@hooks/domain/useModelsSettings';
import { MessageType } from '@shared/types';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

// Mock dependencies
jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../../../presentation/webview/hooks/usePersistence');

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { usePersistedState } from '@hooks/usePersistence';

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
        assistantModel: 'anthropic/claude-sonnet-5',
        dictionaryModel: 'anthropic/claude-haiku-4.5',
        contextModel: 'openai/gpt-5.4',
        categoryModel: 'openai/gpt-oss-120b:nitro',
        widgetModel: 'anthropic/claude-sonnet-5',
        includeCraftGuides: true,
        temperature: 0.7,
        maxTokens: 10000,
        claudeCacheTtl: '5m',
        applyContextWindowTrimming: true
      });
    });

    it('should initialize with persisted state when available', () => {
      mockPersistedState.modelsSettings = {
        assistantModel: 'anthropic/claude-3-5-sonnet',
        dictionaryModel: 'openai/gpt-4',
        contextModel: 'google/gemini-pro',
        categoryModel: 'anthropic/claude-sonnet-4.5',
        widgetModel: 'openai/gpt-5.4',
        includeCraftGuides: false,
        temperature: 0.5,
        maxTokens: 5000,
        claudeCacheTtl: '5m',
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
        dictionaryModel: 'anthropic/claude-haiku-4.5',  // Default
        contextModel: 'openai/gpt-5.4',                 // Default
        categoryModel: 'openai/gpt-oss-120b:nitro',     // Default
        widgetModel: 'anthropic/claude-sonnet-5',       // Default
        includeCraftGuides: true,                       // Default
        temperature: 0.9,                               // From persisted
        maxTokens: 10000,                               // Default
        claudeCacheTtl: '5m',
        applyContextWindowTrimming: true                // Default
      });
    });
  });

  describe('Persistence State', () => {
    it('saves the Claude duration and synchronizes external settings edits', () => {
      const { result } = renderHook(() => useModelsSettings());
      act(() => result.current.updateSetting('claudeCacheTtl', '1h'));
      expect(mockVSCode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: MessageType.UPDATE_SETTING, payload: { key: 'claudeCacheTtl', value: '1h' }
      }));
      expect(result.current.persistedState.modelsSettings.claudeCacheTtl).toBe('1h');
      act(() => result.current.handleSettingsData({ type: MessageType.SETTINGS_DATA,
        source: 'extension.handler', timestamp: 0, payload: { settings: { claudeCacheTtl: '5m' } } }));
      expect(result.current.settings.claudeCacheTtl).toBe('5m');
    });
    it('should expose persistedState for usePersistence', () => {
      const { result } = renderHook(() => useModelsSettings());

      expect(result.current.persistedState).toHaveProperty('modelsSettings');
      expect(result.current.persistedState.modelsSettings.assistantModel).toBe('anthropic/claude-sonnet-5');
      expect(result.current.persistedState.modelsSettings.categoryModel).toBe('openai/gpt-oss-120b:nitro');
      expect(result.current.persistedState.modelsSettings.widgetModel).toBe('anthropic/claude-sonnet-5');
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
            'widgetModel': 'openai/gpt-5.4',
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
      expect(result.current.settings.widgetModel).toBe('openai/gpt-5.4');
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
      expect(result.current.settings.assistantModel).toBe('anthropic/claude-sonnet-5'); // Default preserved
    });

    it('should accept a widget-only settings refresh', () => {
      const { result } = renderHook(() => useModelsSettings());

      act(() => {
        result.current.handleSettingsData({
          type: MessageType.SETTINGS_DATA,
          payload: {
            settings: {
              widgetModel: 'google/gemini-3.1-pro-preview'
            }
          }
        } as any);
      });

      expect(result.current.settings.widgetModel).toBe('google/gemini-3.1-pro-preview');
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
      const firstFollow = result.current.followModelSelection;

      rerender();

      expect(result.current.handleSettingsData).toBe(firstHandleSettingsData);
      expect(result.current.updateSetting).toBe(firstUpdateSetting);
      expect(result.current.followModelSelection).toBe(firstFollow);
    });
  });

  /** The Lightbox's own model (Slice 4L): placeholder ids for the Workshop's and the Lightbox's. */
  describe('the Lightbox model scope (Slice 4L)', () => {
    const WORKSHOP = 'placeholder/workshop-model';
    const LIGHTBOX = 'placeholder/lightbox-model';
    const modelData = (selections: Record<string, string>, following?: unknown) => ({
      type: MessageType.MODEL_DATA,
      source: 'extension.handler',
      timestamp: 1,
      payload: { options: [], selections, ...(following !== undefined ? { following } : {}) }
    });

    it('follows until the host says otherwise, since unset is the setting’s default', () => {
      const { result } = renderHook(() => useModelsSettings());
      expect(result.current.followingModelScopes).toEqual(['lightbox', 'craft']);
      expect(result.current.persistedState.followingModelScopes).toEqual(['lightbox', 'craft']);
    });

    it('takes which scopes follow from MODEL_DATA, and keeps what it knew when a message omits it', () => {
      const { result } = renderHook(() => useModelsSettings());

      act(() => result.current.handleModelData(modelData({ assistant: WORKSHOP, lightbox: LIGHTBOX }, []) as never));
      expect(result.current.followingModelScopes).toEqual([]);
      expect(result.current.modelSelections).toMatchObject({ assistant: WORKSHOP, lightbox: LIGHTBOX });

      act(() => result.current.handleModelData(modelData({ assistant: WORKSHOP }) as never));
      expect(result.current.followingModelScopes).toEqual([]);

      act(() => result.current.handleModelData(modelData({ lightbox: WORKSHOP }, ['lightbox', 'assistant', 7]) as never));
      expect(result.current.followingModelScopes).toEqual(['lightbox']);
    });

    it('restores which scopes follow from saved state, ignoring anything that is not one', () => {
      mockPersistedState.followingModelScopes = ['widget', 'lightbox', 'lightbox'];
      expect(renderHook(() => useModelsSettings()).result.current.followingModelScopes).toEqual(['lightbox']);

      mockPersistedState.followingModelScopes = [];
      expect(renderHook(() => useModelsSettings()).result.current.followingModelScopes).toEqual([]);
    });

    it('a Lightbox pick is the Lightbox’s own: posted on the lightbox scope, and it stops following', () => {
      const { result } = renderHook(() => useModelsSettings());
      act(() => result.current.handleModelData(modelData({ assistant: WORKSHOP, lightbox: WORKSHOP }, ['lightbox']) as never));

      act(() => result.current.setModelSelection('lightbox', LIGHTBOX));

      expect(mockVSCode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: MessageType.SET_MODEL_SELECTION,
        payload: { scope: 'lightbox', modelId: LIGHTBOX }
      }));
      expect(result.current.modelSelections).toMatchObject({ assistant: WORKSHOP, lightbox: LIGHTBOX });
      expect(result.current.followingModelScopes).toEqual([]);
    });

    it('"Same as Workshop" posts null for the lightbox scope and shows the Workshop’s model at once', () => {
      const { result } = renderHook(() => useModelsSettings());
      act(() => result.current.handleModelData(modelData({ assistant: WORKSHOP, lightbox: LIGHTBOX }, []) as never));

      act(() => result.current.followModelSelection('lightbox'));

      expect(mockVSCode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: MessageType.SET_MODEL_SELECTION,
        payload: { scope: 'lightbox', modelId: null }
      }));
      expect(result.current.modelSelections).toMatchObject({ assistant: WORKSHOP, lightbox: WORKSHOP });
      expect(result.current.followingModelScopes).toEqual(['lightbox']);
    });

    it('an assistant pick never touches the Lightbox’s own model', () => {
      const { result } = renderHook(() => useModelsSettings());
      act(() => result.current.handleModelData(modelData({ assistant: WORKSHOP, lightbox: LIGHTBOX }, []) as never));

      act(() => result.current.setModelSelection('assistant', 'placeholder/workshop-model-next'));

      expect(result.current.modelSelections).toMatchObject({ assistant: 'placeholder/workshop-model-next', lightbox: LIGHTBOX });
      expect(result.current.followingModelScopes).toEqual([]);
    });
  });
});
