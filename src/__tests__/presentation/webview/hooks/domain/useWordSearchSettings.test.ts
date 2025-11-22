/**
 * @jest-environment jsdom
 */

/**
 * useWordSearchSettings Tests
 *
 * Comprehensive behavioral tests for word search settings hook.
 * Tests initialization, state updates, message handling, and persistence.
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useWordSearchSettings } from '@hooks/domain/useWordSearchSettings';
import { MessageType } from '@shared/types';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

// Mock dependencies
jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../../../presentation/webview/hooks/usePersistence');

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { usePersistedState } from '@hooks/usePersistence';

describe('useWordSearchSettings', () => {
  let mockVSCode: ReturnType<typeof createMockVSCode>;
  let mockPersistedState: any;

  beforeEach(() => {
    mockVSCode = createMockVSCode();
    mockPersistedState = {};

    // Mock useVSCodeApi to return our mock VSCode API
    (useVSCodeApi as jest.Mock).mockReturnValue(mockVSCode);

    // Mock usePersistedState to return our mock persisted state
    (usePersistedState as jest.Mock).mockReturnValue(mockPersistedState);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct defaults', () => {
      const { result } = renderHook(() => useWordSearchSettings());

      expect(result.current.settings).toEqual({
        contextWords: 7,
        clusterWindow: 150,
        minClusterSize: 2,
        caseSensitive: false,
        enableAssistantExpansion: false
      });
    });

    it('should initialize with persisted state when available', () => {
      mockPersistedState.wordSearchSettings = {
        contextWords: 10,
        clusterWindow: 200,
        minClusterSize: 3,
        caseSensitive: true,
        enableAssistantExpansion: true
      };

      const { result } = renderHook(() => useWordSearchSettings());

      expect(result.current.settings).toEqual({
        contextWords: 10,
        clusterWindow: 200,
        minClusterSize: 3,
        caseSensitive: true,
        enableAssistantExpansion: true
      });
    });

    it('should merge persisted state with defaults (partial persistence)', () => {
      mockPersistedState.wordSearchSettings = {
        contextWords: 15
        // Other settings missing - should use defaults
      };

      const { result } = renderHook(() => useWordSearchSettings());

      expect(result.current.settings).toEqual({
        contextWords: 15,          // From persisted state
        clusterWindow: 150,         // Default
        minClusterSize: 2,          // Default
        caseSensitive: false,       // Default
        enableAssistantExpansion: false // Default
      });
    });
  });

  describe('Persistence State', () => {
    it('should expose persistedState for usePersistence', () => {
      const { result } = renderHook(() => useWordSearchSettings());

      expect(result.current.persistedState).toHaveProperty('wordSearchSettings');
      expect(result.current.persistedState.wordSearchSettings).toEqual({
        contextWords: 7,
        clusterWindow: 150,
        minClusterSize: 2,
        caseSensitive: false,
        enableAssistantExpansion: false
      });
    });

    it('should update persistedState when settings change', () => {
      const { result } = renderHook(() => useWordSearchSettings());

      act(() => {
        result.current.updateSetting('contextWords', 20);
      });

      expect(result.current.persistedState.wordSearchSettings.contextWords).toBe(20);
    });
  });

  describe('updateSetting', () => {
    it('should send UPDATE_SETTING message when updateSetting called', () => {
      const { result } = renderHook(() => useWordSearchSettings());

      act(() => {
        result.current.updateSetting('contextWords', 10);
      });

      expect(mockVSCode.postMessage).toHaveBeenCalledWith({
        type: MessageType.UPDATE_SETTING,
        source: 'webview.search.settings',
        payload: {
          key: 'wordSearch.contextWords',
          value: 10
        },
        timestamp: expect.any(Number)
      });
    });

    it('should optimistically update local state', () => {
      const { result } = renderHook(() => useWordSearchSettings());

      act(() => {
        result.current.updateSetting('contextWords', 10);
      });

      expect(result.current.settings.contextWords).toBe(10);
    });

    it('should update multiple settings independently', () => {
      const { result } = renderHook(() => useWordSearchSettings());

      act(() => {
        result.current.updateSetting('contextWords', 10);
      });

      act(() => {
        result.current.updateSetting('caseSensitive', true);
      });

      expect(result.current.settings).toEqual({
        contextWords: 10,           // Updated
        clusterWindow: 150,          // Unchanged
        minClusterSize: 2,           // Unchanged
        caseSensitive: true,         // Updated
        enableAssistantExpansion: false // Unchanged
      });
    });
  });

  describe('handleSettingsData', () => {
    it('should update state on SETTINGS_DATA message', () => {
      const { result } = renderHook(() => useWordSearchSettings());

      const message = {
        type: MessageType.SETTINGS_DATA,
        payload: {
          settings: {
            'wordSearch.contextWords': 15,
            'wordSearch.clusterWindow': 200,
            'wordSearch.minClusterSize': 3,
            'wordSearch.caseSensitive': true,
            'wordSearch.enableAssistantExpansion': true
          }
        }
      };

      act(() => {
        result.current.handleSettingsData(message as any);
      });

      expect(result.current.settings).toEqual({
        contextWords: 15,
        clusterWindow: 200,
        minClusterSize: 3,
        caseSensitive: true,
        enableAssistantExpansion: true
      });
    });

    it('should use defaults for missing settings in message (nullish coalescing)', () => {
      const { result } = renderHook(() => useWordSearchSettings());

      const message = {
        type: MessageType.SETTINGS_DATA,
        payload: {
          settings: {
            'wordSearch.contextWords': 10
            // Other settings missing - should preserve defaults
          }
        }
      };

      act(() => {
        result.current.handleSettingsData(message as any);
      });

      expect(result.current.settings).toEqual({
        contextWords: 10,           // From message
        clusterWindow: 150,          // Default (preserved)
        minClusterSize: 2,           // Default (preserved)
        caseSensitive: false,        // Default (preserved)
        enableAssistantExpansion: false // Default (preserved)
      });
    });

    it('should not update if message has no contextWords (invalid data)', () => {
      const { result } = renderHook(() => useWordSearchSettings());

      const initialSettings = { ...result.current.settings };

      const message = {
        type: MessageType.SETTINGS_DATA,
        payload: {
          settings: {
            // No word search settings at all
            'someOther.setting': 'value'
          }
        }
      };

      act(() => {
        result.current.handleSettingsData(message as any);
      });

      // Settings should remain unchanged
      expect(result.current.settings).toEqual(initialSettings);
    });
  });

  describe('Stability and Re-renders', () => {
    it('should have stable function references (useCallback)', () => {
      const { result, rerender } = renderHook(() => useWordSearchSettings());

      const firstHandleSettingsData = result.current.handleSettingsData;
      const firstUpdateSetting = result.current.updateSetting;

      rerender();

      expect(result.current.handleSettingsData).toBe(firstHandleSettingsData);
      expect(result.current.updateSetting).toBe(firstUpdateSetting);
    });
  });
});
