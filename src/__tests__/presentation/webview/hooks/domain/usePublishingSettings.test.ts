/**
 * @jest-environment jsdom
 */

/**
 * usePublishingSettings Tests
 *
 * Comprehensive behavioral tests for publishing settings hook.
 * Tests initialization, state updates, message handling, and persistence.
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { usePublishingSettings } from '../../../../../presentation/webview/hooks/domain/usePublishingSettings';
import { MessageType } from '../../../../../shared/types';
import { createMockVSCode } from '../../../../mocks/vscode';

// Mock dependencies
jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../../../presentation/webview/hooks/usePersistence');

import { useVSCodeApi } from '../../../../../presentation/webview/hooks/useVSCodeApi';
import { usePersistedState } from '../../../../../presentation/webview/hooks/usePersistence';

describe('usePublishingSettings', () => {
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
      const { result } = renderHook(() => usePublishingSettings());

      expect(result.current.publishingPreset).toBe('none');
      expect(result.current.publishingTrimKey).toBe('');
      expect(result.current.publishingGenres).toEqual([]);
    });

    it('should initialize with persisted state when available', () => {
      mockPersistedState.publishingPreset = 'genre:thriller';
      mockPersistedState.publishingTrimKey = '6x9';

      const { result } = renderHook(() => usePublishingSettings());

      expect(result.current.publishingPreset).toBe('genre:thriller');
      expect(result.current.publishingTrimKey).toBe('6x9');
    });

    it('should request publishing standards data on mount', () => {
      renderHook(() => usePublishingSettings());

      expect(mockVSCode.postMessage).toHaveBeenCalledWith({
        type: MessageType.REQUEST_PUBLISHING_STANDARDS_DATA,
        source: 'webview.hooks.usePublishingSettings',
        payload: {},
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Persistence State', () => {
    it('should expose persistedState for usePersistence', () => {
      const { result } = renderHook(() => usePublishingSettings());

      expect(result.current.persistedState).toHaveProperty('publishingPreset');
      expect(result.current.persistedState).toHaveProperty('publishingTrimKey');
      expect(result.current.persistedState.publishingPreset).toBe('none');
      expect(result.current.persistedState.publishingTrimKey).toBe('');
    });

    it('should update persistedState when settings change', () => {
      const { result } = renderHook(() => usePublishingSettings());

      act(() => {
        result.current.setPublishingPreset('genre:literary_fiction');
      });

      expect(result.current.persistedState.publishingPreset).toBe('genre:literary_fiction');
    });
  });

  describe('setPublishingPreset', () => {
    it('should send SET_PUBLISHING_PRESET message when setPublishingPreset called', () => {
      const { result } = renderHook(() => usePublishingSettings());

      // Clear the REQUEST_PUBLISHING_STANDARDS_DATA message from mount
      mockVSCode.postMessage.mockClear();

      act(() => {
        result.current.setPublishingPreset('genre:thriller');
      });

      expect(mockVSCode.postMessage).toHaveBeenCalledWith({
        type: MessageType.SET_PUBLISHING_PRESET,
        source: 'webview.settings.publishing',
        payload: {
          preset: 'genre:thriller'
        },
        timestamp: expect.any(Number)
      });
    });

    it('should optimistically update local state', () => {
      const { result } = renderHook(() => usePublishingSettings());

      act(() => {
        result.current.setPublishingPreset('genre:thriller');
      });

      expect(result.current.publishingPreset).toBe('genre:thriller');
    });
  });

  describe('setPublishingTrim', () => {
    it('should send SET_PUBLISHING_TRIM_SIZE message when setPublishingTrim called', () => {
      const { result } = renderHook(() => usePublishingSettings());

      mockVSCode.postMessage.mockClear();

      act(() => {
        result.current.setPublishingTrim('6x9');
      });

      expect(mockVSCode.postMessage).toHaveBeenCalledWith({
        type: MessageType.SET_PUBLISHING_TRIM_SIZE,
        source: 'webview.settings.publishing',
        payload: {
          pageSizeKey: '6x9'
        },
        timestamp: expect.any(Number)
      });
    });

    it('should handle undefined trim key (reset)', () => {
      const { result } = renderHook(() => usePublishingSettings());

      mockVSCode.postMessage.mockClear();

      act(() => {
        result.current.setPublishingTrim(undefined);
      });

      expect(mockVSCode.postMessage).toHaveBeenCalledWith({
        type: MessageType.SET_PUBLISHING_TRIM_SIZE,
        source: 'webview.settings.publishing',
        payload: {
          pageSizeKey: undefined
        },
        timestamp: expect.any(Number)
      });
    });
  });

  describe('handlePublishingStandardsData', () => {
    it('should update state on PUBLISHING_STANDARDS_DATA message', () => {
      const { result } = renderHook(() => usePublishingSettings());

      const mockGenres = [
        { key: 'thriller', name: 'Thriller', abbreviation: 'THR', pageSizes: [] }
      ];

      const message = {
        type: MessageType.PUBLISHING_STANDARDS_DATA,
        payload: {
          preset: 'genre:thriller',
          pageSizeKey: '6x9',
          genres: mockGenres
        }
      };

      act(() => {
        result.current.handlePublishingStandardsData(message as any);
      });

      expect(result.current.publishingPreset).toBe('genre:thriller');
      expect(result.current.publishingTrimKey).toBe('6x9');
      expect(result.current.publishingGenres).toEqual(mockGenres);
    });

    it('should preserve persisted state on initial empty message', () => {
      mockPersistedState.publishingPreset = 'genre:literary_fiction';
      mockPersistedState.publishingTrimKey = '5x8';

      const { result } = renderHook(() => usePublishingSettings());

      // Simulate empty message (no preset/pageSizeKey)
      const message = {
        type: MessageType.PUBLISHING_STANDARDS_DATA,
        payload: {
          genres: []
        }
      };

      act(() => {
        result.current.handlePublishingStandardsData(message as any);
      });

      // Persisted state should be preserved
      expect(result.current.publishingPreset).toBe('genre:literary_fiction');
      expect(result.current.publishingTrimKey).toBe('5x8');
    });

    it('should handle empty/none preset values', () => {
      const { result } = renderHook(() => usePublishingSettings());

      const message = {
        type: MessageType.PUBLISHING_STANDARDS_DATA,
        payload: {
          preset: '',
          pageSizeKey: '',
          genres: []
        }
      };

      act(() => {
        result.current.handlePublishingStandardsData(message as any);
      });

      expect(result.current.publishingPreset).toBe('none');
      expect(result.current.publishingTrimKey).toBe('');
    });
  });

  describe('Stability and Re-renders', () => {
    it('should have stable function references (useCallback)', () => {
      const { result, rerender } = renderHook(() => usePublishingSettings());

      const firstHandlePublishingStandardsData = result.current.handlePublishingStandardsData;
      const firstSetPublishingPreset = result.current.setPublishingPreset;
      const firstSetPublishingTrim = result.current.setPublishingTrim;

      rerender();

      expect(result.current.handlePublishingStandardsData).toBe(firstHandlePublishingStandardsData);
      expect(result.current.setPublishingPreset).toBe(firstSetPublishingPreset);
      expect(result.current.setPublishingTrim).toBe(firstSetPublishingTrim);
    });
  });
});
