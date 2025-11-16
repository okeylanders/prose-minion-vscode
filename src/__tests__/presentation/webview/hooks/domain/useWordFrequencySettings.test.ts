/**
 * @jest-environment jsdom
 */

/**
 * useWordFrequencySettings Tests
 *
 * Comprehensive behavioral tests for word frequency settings hook.
 * Tests initialization, state updates, message handling, and persistence.
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useWordFrequencySettings } from '../../../../../presentation/webview/hooks/domain/useWordFrequencySettings';
import { MessageType } from '../../../../../shared/types';
import { createMockVSCode } from '../../../../mocks/vscode';

// Mock dependencies
jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../../../presentation/webview/hooks/usePersistence');

import { useVSCodeApi } from '../../../../../presentation/webview/hooks/useVSCodeApi';
import { usePersistedState } from '../../../../../presentation/webview/hooks/usePersistence';

describe('useWordFrequencySettings', () => {
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
      const { result } = renderHook(() => useWordFrequencySettings());

      expect(result.current.settings).toEqual({
        topN: 100,
        includeHapaxList: true,
        hapaxDisplayMax: 300,
        includeStopwordsTable: true,
        contentWordsOnly: true,
        posEnabled: true,
        includeBigrams: true,
        includeTrigrams: true,
        enableLemmas: false,
        lengthHistogramMaxChars: 10,
        minCharacterLength: 1
      });
    });

    it('should initialize with persisted state when available', () => {
      mockPersistedState.wordFrequencySettings = {
        topN: 50,
        includeHapaxList: false,
        hapaxDisplayMax: 100,
        includeStopwordsTable: false,
        contentWordsOnly: false,
        posEnabled: false,
        includeBigrams: false,
        includeTrigrams: false,
        enableLemmas: true,
        lengthHistogramMaxChars: 15,
        minCharacterLength: 3
      };

      const { result } = renderHook(() => useWordFrequencySettings());

      expect(result.current.settings).toEqual(mockPersistedState.wordFrequencySettings);
    });

    it('should support legacy persisted key (wordFrequency)', () => {
      mockPersistedState.wordFrequency = {
        topN: 200
      };

      const { result } = renderHook(() => useWordFrequencySettings());

      expect(result.current.settings.topN).toBe(200);
      expect(result.current.settings.includeHapaxList).toBe(true); // Default for missing
    });

    it('should merge persisted state with defaults (partial persistence)', () => {
      mockPersistedState.wordFrequencySettings = {
        topN: 75,
        enableLemmas: true,
        minCharacterLength: 2
      };

      const { result } = renderHook(() => useWordFrequencySettings());

      expect(result.current.settings.topN).toBe(75);
      expect(result.current.settings.enableLemmas).toBe(true);
      expect(result.current.settings.minCharacterLength).toBe(2);
      expect(result.current.settings.includeHapaxList).toBe(true); // Default
      expect(result.current.settings.posEnabled).toBe(true); // Default
    });
  });

  describe('Persistence State', () => {
    it('should expose persistedState for usePersistence', () => {
      const { result } = renderHook(() => useWordFrequencySettings());

      expect(result.current.persistedState).toHaveProperty('wordFrequencySettings');
      expect(result.current.persistedState.wordFrequencySettings.topN).toBe(100);
    });

    it('should update persistedState when settings change', () => {
      const { result } = renderHook(() => useWordFrequencySettings());

      act(() => {
        result.current.updateSetting('topN', 50);
      });

      expect(result.current.persistedState.wordFrequencySettings.topN).toBe(50);
    });
  });

  describe('updateSetting', () => {
    it('should send UPDATE_SETTING message when updateSetting called', () => {
      const { result } = renderHook(() => useWordFrequencySettings());

      act(() => {
        result.current.updateSetting('topN', 50);
      });

      expect(mockVSCode.postMessage).toHaveBeenCalledWith({
        type: MessageType.UPDATE_SETTING,
        source: 'webview.hooks.useWordFrequencySettings',
        payload: {
          key: 'wordFrequency.topN',
          value: 50
        },
        timestamp: expect.any(Number)
      });
    });

    it('should optimistically update local state', () => {
      const { result } = renderHook(() => useWordFrequencySettings());

      act(() => {
        result.current.updateSetting('topN', 50);
      });

      expect(result.current.settings.topN).toBe(50);
    });

    it('should update multiple settings independently', () => {
      const { result } = renderHook(() => useWordFrequencySettings());

      act(() => {
        result.current.updateSetting('topN', 50);
      });

      act(() => {
        result.current.updateSetting('enableLemmas', true);
      });

      act(() => {
        result.current.updateSetting('minCharacterLength', 3);
      });

      expect(result.current.settings.topN).toBe(50);
      expect(result.current.settings.enableLemmas).toBe(true);
      expect(result.current.settings.minCharacterLength).toBe(3);
      expect(result.current.settings.includeHapaxList).toBe(true); // Unchanged
    });
  });

  describe('handleSettingsData', () => {
    it('should update state on SETTINGS_DATA message', () => {
      const { result } = renderHook(() => useWordFrequencySettings());

      const message = {
        type: MessageType.SETTINGS_DATA,
        payload: {
          settings: {
            'wordFrequency.topN': 75,
            'wordFrequency.includeHapaxList': false,
            'wordFrequency.hapaxDisplayMax': 200,
            'wordFrequency.includeStopwordsTable': false,
            'wordFrequency.contentWordsOnly': false,
            'wordFrequency.posEnabled': false,
            'wordFrequency.includeBigrams': false,
            'wordFrequency.includeTrigrams': false,
            'wordFrequency.enableLemmas': true,
            'wordFrequency.lengthHistogramMaxChars': 12,
            'wordFrequency.minCharacterLength': 2
          }
        }
      };

      act(() => {
        result.current.handleSettingsData(message as any);
      });

      expect(result.current.settings.topN).toBe(75);
      expect(result.current.settings.enableLemmas).toBe(true);
      expect(result.current.settings.minCharacterLength).toBe(2);
      expect(result.current.settings.includeHapaxList).toBe(false);
    });

    it('should use defaults for missing settings in message', () => {
      const { result } = renderHook(() => useWordFrequencySettings());

      const message = {
        type: MessageType.SETTINGS_DATA,
        payload: {
          settings: {
            'wordFrequency.topN': 50
            // Other settings missing
          }
        }
      };

      act(() => {
        result.current.handleSettingsData(message as any);
      });

      expect(result.current.settings.topN).toBe(50);
      expect(result.current.settings.includeHapaxList).toBe(true); // Default preserved
      expect(result.current.settings.posEnabled).toBe(true); // Default preserved
    });

    it('should not update if message has no word frequency settings', () => {
      const { result } = renderHook(() => useWordFrequencySettings());

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
      const { result, rerender } = renderHook(() => useWordFrequencySettings());

      const firstHandleSettingsData = result.current.handleSettingsData;
      const firstUpdateSetting = result.current.updateSetting;

      rerender();

      expect(result.current.handleSettingsData).toBe(firstHandleSettingsData);
      expect(result.current.updateSetting).toBe(firstUpdateSetting);
    });
  });
});
