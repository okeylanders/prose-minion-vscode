/**
 * @jest-environment jsdom
 */

/**
 * useContext Behavioral Tests
 */

import { act, renderHook } from '@testing-library/react';
import { useContext } from '@/presentation/webview/hooks/domain/useContext';
import { API_KEY_NOT_CONFIGURED_HEADING, ClearTransientApiKeyWarningMessage, MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../../../presentation/webview/hooks/usePersistence');

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { usePersistedState } from '@hooks/usePersistence';

describe('useContext - Transient Warning Persistence', () => {
  let mockVSCode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    mockVSCode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(mockVSCode);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does not seed or persist a stale API-key warning as context text', () => {
    (usePersistedState as jest.Mock).mockReturnValue({
      contextText: `${API_KEY_NOT_CONFIGURED_HEADING}\n\nAdd your key to generate context.`,
      contextRequestedResources: ['chapter-1.md']
    });

    const { result } = renderHook(() => useContext());

    expect(result.current.contextText).toBe('');
    expect(result.current.persistedState.contextText).toBe('');
    expect(result.current.persistedState.contextRequestedResources).toEqual(['chapter-1.md']);
  });

  it('persists ordinary context text', () => {
    (usePersistedState as jest.Mock).mockReturnValue({
      contextText: 'A real generated context result.'
    });

    const { result } = renderHook(() => useContext());

    expect(result.current.contextText).toBe('A real generated context result.');
    expect(result.current.persistedState.contextText).toBe('A real generated context result.');
  });

  it('clears a live API-key warning without clearing ordinary context text', () => {
    (usePersistedState as jest.Mock).mockReturnValue({});

    const { result } = renderHook(() => useContext());
    const clearMessage: ClearTransientApiKeyWarningMessage = {
      type: MessageType.CLEAR_TRANSIENT_API_KEY_WARNING,
      source: 'extension.handler',
      payload: {},
      timestamp: 123
    };

    act(() => {
      result.current.handleContextResult({
        type: MessageType.CONTEXT_RESULT,
        source: 'extension.context',
        payload: {
          result: `${API_KEY_NOT_CONFIGURED_HEADING}\n\nAdd your key to generate context.`,
          toolName: 'context'
        },
        timestamp: 1
      });
    });
    act(() => result.current.handleClearTransientApiKeyWarning(clearMessage));
    expect(result.current.contextText).toBe('');

    act(() => {
      result.current.handleContextResult({
        type: MessageType.CONTEXT_RESULT,
        source: 'extension.context',
        payload: {
          result: 'Real generated context.',
          toolName: 'context'
        },
        timestamp: 2
      });
    });
    act(() => result.current.handleClearTransientApiKeyWarning(clearMessage));
    expect(result.current.contextText).toBe('Real generated context.');
  });
});
