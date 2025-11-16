/**
 * @jest-environment jsdom
 */

/**
 * useContextPathsSettings Tests
 *
 * Comprehensive behavioral tests for context paths settings hook.
 * Tests initialization, state updates, message handling, and persistence.
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useContextPathsSettings } from '../../../../../presentation/webview/hooks/domain/useContextPathsSettings';
import { MessageType } from '../../../../../shared/types';
import { createMockVSCode } from '../../../../mocks/vscode';

// Mock dependencies
jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../../../presentation/webview/hooks/usePersistence');

import { useVSCodeApi } from '../../../../../presentation/webview/hooks/useVSCodeApi';
import { usePersistedState } from '../../../../../presentation/webview/hooks/usePersistence';

describe('useContextPathsSettings', () => {
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
      const { result } = renderHook(() => useContextPathsSettings());

      expect(result.current.settings).toEqual({
        characters: 'characters/**/*,Characters/**/*',
        locations: 'locations/**/*,Locations/**/*,Locations-Settings/**/*',
        themes: 'themes/**/*,Themes/**/*',
        things: 'things/**/*,Things/**/*',
        chapters: 'drafts/**/*,Drafts/**/*,outlines/**/*,Outlines/**/*',
        manuscript: 'manuscript/**/*,Manuscript/**/*',
        projectBrief: 'brief/**/*,Brief/**/*',
        general: 'research/**/*,Research/**/*,tone-and-style/**/*,Tone-And-Style/**/*,literary-devices/**/*,Literary-Devices/**/*,**/story-bible.md,**/synopsis.md,**/voice-and-tone.md,**/genre-conventions.md'
      });
    });

    it('should initialize with persisted state when available', () => {
      mockPersistedState.contextPathsSettings = {
        characters: 'custom-characters/**/*',
        locations: 'custom-locations/**/*',
        themes: 'custom-themes/**/*',
        things: 'custom-things/**/*',
        chapters: 'custom-chapters/**/*',
        manuscript: 'custom-manuscript/**/*',
        projectBrief: 'custom-brief/**/*',
        general: 'custom-research/**/*'
      };

      const { result } = renderHook(() => useContextPathsSettings());

      expect(result.current.settings).toEqual(mockPersistedState.contextPathsSettings);
    });

    it('should support legacy persisted key (contextPaths)', () => {
      mockPersistedState.contextPaths = {
        characters: 'legacy-characters/**/*'
      };

      const { result } = renderHook(() => useContextPathsSettings());

      expect(result.current.settings.characters).toBe('legacy-characters/**/*');
      // Other fields should use defaults
      expect(result.current.settings.locations).toBe('locations/**/*,Locations/**/*,Locations-Settings/**/*');
    });

    it('should merge persisted state with defaults (partial persistence)', () => {
      mockPersistedState.contextPathsSettings = {
        characters: 'custom-characters/**/*',
        locations: 'custom-locations/**/*'
        // Other settings missing - should use defaults
      };

      const { result } = renderHook(() => useContextPathsSettings());

      expect(result.current.settings.characters).toBe('custom-characters/**/*');
      expect(result.current.settings.locations).toBe('custom-locations/**/*');
      expect(result.current.settings.themes).toBe('themes/**/*,Themes/**/*'); // Default
      expect(result.current.settings.manuscript).toBe('manuscript/**/*,Manuscript/**/*'); // Default
    });
  });

  describe('Persistence State', () => {
    it('should expose persistedState for usePersistence', () => {
      const { result } = renderHook(() => useContextPathsSettings());

      expect(result.current.persistedState).toHaveProperty('contextPathsSettings');
      expect(result.current.persistedState.contextPathsSettings.characters).toBe('characters/**/*,Characters/**/*');
    });

    it('should update persistedState when settings change', () => {
      const { result } = renderHook(() => useContextPathsSettings());

      act(() => {
        result.current.updateSetting('characters', 'custom/**/*');
      });

      expect(result.current.persistedState.contextPathsSettings.characters).toBe('custom/**/*');
    });
  });

  describe('updateSetting', () => {
    it('should send UPDATE_SETTING message when updateSetting called', () => {
      const { result } = renderHook(() => useContextPathsSettings());

      act(() => {
        result.current.updateSetting('characters', 'custom/**/*');
      });

      expect(mockVSCode.postMessage).toHaveBeenCalledWith({
        type: MessageType.UPDATE_SETTING,
        source: 'webview.hooks.useContextPathsSettings',
        payload: {
          key: 'contextPaths.characters',
          value: 'custom/**/*'
        },
        timestamp: expect.any(Number)
      });
    });

    it('should optimistically update local state', () => {
      const { result } = renderHook(() => useContextPathsSettings());

      act(() => {
        result.current.updateSetting('characters', 'custom/**/*');
      });

      expect(result.current.settings.characters).toBe('custom/**/*');
    });

    it('should update multiple settings independently', () => {
      const { result } = renderHook(() => useContextPathsSettings());

      act(() => {
        result.current.updateSetting('characters', 'custom-characters/**/*');
      });

      act(() => {
        result.current.updateSetting('locations', 'custom-locations/**/*');
      });

      expect(result.current.settings.characters).toBe('custom-characters/**/*');
      expect(result.current.settings.locations).toBe('custom-locations/**/*');
      expect(result.current.settings.themes).toBe('themes/**/*,Themes/**/*'); // Unchanged
    });
  });

  describe('handleSettingsData', () => {
    it('should update state on SETTINGS_DATA message', () => {
      const { result } = renderHook(() => useContextPathsSettings());

      const message = {
        type: MessageType.SETTINGS_DATA,
        payload: {
          settings: {
            'contextPaths.characters': 'custom-characters/**/*',
            'contextPaths.locations': 'custom-locations/**/*',
            'contextPaths.themes': 'custom-themes/**/*',
            'contextPaths.things': 'custom-things/**/*',
            'contextPaths.chapters': 'custom-chapters/**/*',
            'contextPaths.manuscript': 'custom-manuscript/**/*',
            'contextPaths.projectBrief': 'custom-brief/**/*',
            'contextPaths.general': 'custom-research/**/*'
          }
        }
      };

      act(() => {
        result.current.handleSettingsData(message as any);
      });

      expect(result.current.settings.characters).toBe('custom-characters/**/*');
      expect(result.current.settings.locations).toBe('custom-locations/**/*');
      expect(result.current.settings.themes).toBe('custom-themes/**/*');
      expect(result.current.settings.manuscript).toBe('custom-manuscript/**/*');
    });

    it('should use defaults for missing settings in message', () => {
      const { result } = renderHook(() => useContextPathsSettings());

      const message = {
        type: MessageType.SETTINGS_DATA,
        payload: {
          settings: {
            'contextPaths.characters': 'custom/**/*'
            // Other settings missing
          }
        }
      };

      act(() => {
        result.current.handleSettingsData(message as any);
      });

      expect(result.current.settings.characters).toBe('custom/**/*');
      expect(result.current.settings.locations).toBe('locations/**/*,Locations/**/*,Locations-Settings/**/*'); // Default preserved
    });

    it('should not update if message has no context paths settings', () => {
      const { result } = renderHook(() => useContextPathsSettings());

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
      const { result, rerender } = renderHook(() => useContextPathsSettings());

      const firstHandleSettingsData = result.current.handleSettingsData;
      const firstUpdateSetting = result.current.updateSetting;

      rerender();

      expect(result.current.handleSettingsData).toBe(firstHandleSettingsData);
      expect(result.current.updateSetting).toBe(firstUpdateSetting);
    });
  });
});
