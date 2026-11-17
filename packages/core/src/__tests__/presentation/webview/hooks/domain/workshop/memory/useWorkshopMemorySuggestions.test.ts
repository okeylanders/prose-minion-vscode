/**
 * @jest-environment jsdom
 */

/**
 * useWorkshopMemorySuggestions (Everyday Conveniences, Round Two, item B):
 * the level is the host's, heard with each session state; a choice is posted
 * through the settings route and shown only once the host says it; the hook
 * honors the tripartite contract and persists nothing.
 */

import { act, renderHook } from '@testing-library/react';
import { MessageType, type WorkshopSessionStateMessage } from '@messages';
import { useWorkshopMemorySuggestions } from '@hooks/domain/workshop/memory/useWorkshopMemorySuggestions';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('../../../../../../../presentation/webview/hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const sessionState = (memorySuggestions?: unknown): WorkshopSessionStateMessage => ({
  type: MessageType.WORKSHOP_SESSION_STATE,
  source: 'extension.workshop',
  payload: { memorySuggestions },
  timestamp: 1
} as unknown as WorkshopSessionStateMessage);

describe('useWorkshopMemorySuggestions', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('exposes state, actions and an empty persistence contract', () => {
    const { result } = renderHook(() => useWorkshopMemorySuggestions());
    expect(Object.keys(result.current).sort()).toEqual(['handleSessionState', 'level', 'persistedState', 'setLevel']);
    expect(result.current.persistedState).toEqual({});
    expect(typeof result.current.handleSessionState).toBe('function');
    expect(typeof result.current.setLevel).toBe('function');
  });

  it('starts at Sparingly and asks the host for nothing', () => {
    const { result } = renderHook(() => useWorkshopMemorySuggestions());
    expect(result.current.level).toBe('sparingly');
    expect(vscode.postMessage).not.toHaveBeenCalled();
  });

  it('takes the level from each session state; absent or unknown reads Sparingly', () => {
    const { result } = renderHook(() => useWorkshopMemorySuggestions());
    act(() => result.current.handleSessionState(sessionState('aggressively')));
    expect(result.current.level).toBe('aggressively');
    act(() => result.current.handleSessionState(sessionState('readily')));
    expect(result.current.level).toBe('readily');
    act(() => result.current.handleSessionState(sessionState('always')));
    expect(result.current.level).toBe('sparingly');
    act(() => result.current.handleSessionState(sessionState('readily')));
    act(() => result.current.handleSessionState(sessionState(undefined)));
    expect(result.current.level).toBe('sparingly');
  });

  it('a choice posts the setting through UPDATE_SETTING, and the level moves only when the host says so', () => {
    const { result } = renderHook(() => useWorkshopMemorySuggestions());
    act(() => result.current.setLevel('readily'));

    expect(vscode.postMessage).toHaveBeenCalledTimes(1);
    expect(vscode.postMessage).toHaveBeenCalledWith({
      type: MessageType.UPDATE_SETTING,
      source: 'webview.hooks.useWorkshopMemorySuggestions',
      payload: { key: 'workshop.memory.suggestions', value: 'readily' },
      timestamp: expect.any(Number)
    });
    expect(result.current.level).toBe('sparingly');

    act(() => result.current.handleSessionState(sessionState('readily')));
    expect(result.current.level).toBe('readily');
  });

  it('keeps its callbacks stable across renders', () => {
    const { result, rerender } = renderHook(() => useWorkshopMemorySuggestions());
    const { handleSessionState, setLevel } = result.current;
    act(() => handleSessionState(sessionState('readily')));
    rerender();
    expect(result.current.handleSessionState).toBe(handleSessionState);
    expect(result.current.setLevel).toBe(setLevel);
  });
});
