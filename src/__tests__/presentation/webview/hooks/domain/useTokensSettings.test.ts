/**
 * @jest-environment jsdom
 */

/**
 * useTokensSettings Tests
 *
 * Comprehensive behavioral tests for tokens settings hook.
 * Tests initialization, state updates, message handling, and persistence.
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useTokensSettings } from '../../../../../presentation/webview/hooks/domain/useTokensSettings';
import { MessageType } from '../../../../../shared/types';
import { createMockVSCode } from '../../../../mocks/vscode';

// Mock dependencies
jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../../../presentation/webview/hooks/usePersistence');

import { useVSCodeApi } from '../../../../../presentation/webview/hooks/useVSCodeApi';
import { usePersistedState } from '../../../../../presentation/webview/hooks/usePersistence';

describe('useTokensSettings', () => {
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
      const { result } = renderHook(() => useTokensSettings());

      expect(result.current.settings).toEqual({
        showTokenWidget: true
      });
    });

    it('should initialize with persisted state when available', () => {
      mockPersistedState.tokensSettings = {
        showTokenWidget: false
      };

      const { result } = renderHook(() => useTokensSettings());

      expect(result.current.settings).toEqual({
        showTokenWidget: false
      });
    });

    it('should support legacy persisted key (showTokenWidget)', () => {
      mockPersistedState.showTokenWidget = false;

      const { result } = renderHook(() => useTokensSettings());

      expect(result.current.settings.showTokenWidget).toBe(false);
    });
  });

  describe('Persistence State', () => {
    it('should expose persistedState for usePersistence', () => {
      const { result } = renderHook(() => useTokensSettings());

      expect(result.current.persistedState).toHaveProperty('tokensSettings');
      expect(result.current.persistedState.tokensSettings).toEqual({
        showTokenWidget: true
      });
    });

    it('should update persistedState when settings change', () => {
      const { result } = renderHook(() => useTokensSettings());

      act(() => {
        result.current.updateSetting('showTokenWidget', false);
      });

      expect(result.current.persistedState.tokensSettings.showTokenWidget).toBe(false);
    });
  });

  describe('updateSetting', () => {
    it('should send UPDATE_SETTING message when updateSetting called', () => {
      const { result } = renderHook(() => useTokensSettings());

      act(() => {
        result.current.updateSetting('showTokenWidget', false);
      });

      expect(mockVSCode.postMessage).toHaveBeenCalledWith({
        type: MessageType.UPDATE_SETTING,
        source: 'webview.hooks.useTokensSettings',
        payload: {
          key: 'ui.showTokenWidget',
          value: false
        },
        timestamp: expect.any(Number)
      });
    });

    it('should optimistically update local state', () => {
      const { result } = renderHook(() => useTokensSettings());

      act(() => {
        result.current.updateSetting('showTokenWidget', false);
      });

      expect(result.current.settings.showTokenWidget).toBe(false);
    });
  });

  describe('handleSettingsData', () => {
    it('should update state on SETTINGS_DATA message', () => {
      const { result } = renderHook(() => useTokensSettings());

      const message = {
        type: MessageType.SETTINGS_DATA,
        payload: {
          settings: {
            'ui.showTokenWidget': false
          }
        }
      };

      act(() => {
        result.current.handleSettingsData(message as any);
      });

      expect(result.current.settings.showTokenWidget).toBe(false);
    });

    it('should not update if message has no showTokenWidget setting', () => {
      const { result } = renderHook(() => useTokensSettings());

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

  describe('handleModelData', () => {
    it('should handle MODEL_DATA messages (no-op for tokens settings)', () => {
      const { result } = renderHook(() => useTokensSettings());

      const message = {
        type: MessageType.MODEL_DATA,
        payload: {}
      };

      // Should not throw
      act(() => {
        result.current.handleModelData(message as any);
      });

      // Settings should remain unchanged
      expect(result.current.settings.showTokenWidget).toBe(true);
    });
  });

  describe('Stability and Re-renders', () => {
    it('should have stable function references (useCallback)', () => {
      const { result, rerender } = renderHook(() => useTokensSettings());

      const firstHandleSettingsData = result.current.handleSettingsData;
      const firstHandleModelData = result.current.handleModelData;
      const firstUpdateSetting = result.current.updateSetting;

      rerender();

      expect(result.current.handleSettingsData).toBe(firstHandleSettingsData);
      expect(result.current.handleModelData).toBe(firstHandleModelData);
      expect(result.current.updateSetting).toBe(firstUpdateSetting);
    });
  });
});
