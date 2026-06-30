/**
 * @jest-environment jsdom
 */

/**
 * useDictionary Contract Tests
 *
 * Validates Tripartite Interface pattern for dictionary operations.
 */

import { act, renderHook } from '@testing-library/react';
import { DictionaryState, DictionaryActions, DictionaryPersistence, useDictionary } from '@/presentation/webview/hooks/domain/useDictionary';
import { API_KEY_NOT_CONFIGURED_HEADING, ClearTransientApiKeyWarningMessage, MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../../../presentation/webview/hooks/usePersistence');

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { usePersistedState } from '@hooks/usePersistence';

describe('useDictionary - Type Contracts', () => {
  describe('Tripartite Interface Pattern', () => {
    it('should define State interface', () => {
      const state: DictionaryState = {
        result: '',
        toolName: undefined,
        loading: false,
        word: '',
        context: '',
        wordEdited: false,
        sourceUri: '',
        relativePath: '',
        statusMessage: '',
        isFastGenerating: false,
        progress: undefined,
        lastFastGenerationMetadata: null,
        tickerMessage: '',
        // Streaming state
        isStreaming: false,
        isBuffering: false,
        streamingContent: '',
        streamingChunkCount: 0,
        streamingElapsedMs: 0,
        streamingInitialLatencyMs: undefined,
        streamingChunksPerSecond: 0,
        currentRequestId: null
      };

      expect(state).toHaveProperty('result');
      expect(state).toHaveProperty('loading');
      expect(state).toHaveProperty('word');
      expect(state).toHaveProperty('context');
      expect(state).toHaveProperty('wordEdited');
      expect(state).toHaveProperty('sourceUri');
      expect(state).toHaveProperty('isFastGenerating');
      expect(state).toHaveProperty('progress');
      expect(state).toHaveProperty('tickerMessage');
      expect(state).toHaveProperty('isStreaming');
      expect(state).toHaveProperty('isBuffering');
      expect(state).toHaveProperty('streamingContent');
    });

    it('should define Actions interface', () => {
      const actions: DictionaryActions = {
        handleDictionaryResult: jest.fn(),
        handleStatusMessage: jest.fn(),
        setLoading: jest.fn(),
        setWord: jest.fn(),
        setContext: jest.fn(),
        setWordEdited: jest.fn(),
        setSource: jest.fn(),
        clearResult: jest.fn(),
        handleClearTransientApiKeyWarning: jest.fn(),
        handleFastGenerateResult: jest.fn(),
        setFastGenerating: jest.fn(),
        // Streaming actions
        handleStreamStarted: jest.fn(),
        handleStreamChunk: jest.fn(),
        handleStreamComplete: jest.fn(),
        startStreaming: jest.fn(),
        cancelStreaming: jest.fn()
      };

      expect(typeof actions.handleDictionaryResult).toBe('function');
      expect(typeof actions.setWord).toBe('function');
      expect(typeof actions.clearResult).toBe('function');
      expect(typeof actions.handleClearTransientApiKeyWarning).toBe('function');
      expect(typeof actions.handleFastGenerateResult).toBe('function');
      expect(typeof actions.setFastGenerating).toBe('function');
      expect(typeof actions.handleStreamStarted).toBe('function');
      expect(typeof actions.handleStreamChunk).toBe('function');
      expect(typeof actions.handleStreamComplete).toBe('function');
      expect(typeof actions.cancelStreaming).toBe('function');
    });

    it('should define Persistence interface', () => {
      const persistence: DictionaryPersistence = {
        utilitiesResult: '',
        dictionaryToolName: undefined,
        dictionaryWord: '',
        dictionaryContext: '',
        dictionaryWordEdited: false,
        dictionarySourceUri: '',
        dictionaryRelativePath: '',
        dictionaryStatusMessage: ''
      };

      expect(persistence).toHaveProperty('utilitiesResult');
      expect(persistence).toHaveProperty('dictionaryWord');
      expect(persistence).toHaveProperty('dictionaryContext');
      expect(persistence).toHaveProperty('dictionaryToolName');
    });
  });
});

describe('useDictionary - Transient Warning Persistence', () => {
  let mockVSCode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    mockVSCode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(mockVSCode);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does not seed or persist a stale API-key warning as a dictionary result', () => {
    (usePersistedState as jest.Mock).mockReturnValue({
      utilitiesResult: `${API_KEY_NOT_CONFIGURED_HEADING}\n\nAdd your key to look up words.`,
      dictionaryToolName: 'dictionary_lookup'
    });

    const { result } = renderHook(() => useDictionary());

    expect(result.current.result).toBe('');
    expect(result.current.persistedState.utilitiesResult).toBe('');
    expect(result.current.persistedState.dictionaryToolName).toBe('dictionary_lookup');
  });

  it('persists ordinary dictionary results', () => {
    (usePersistedState as jest.Mock).mockReturnValue({
      utilitiesResult: 'A real dictionary result.'
    });

    const { result } = renderHook(() => useDictionary());

    expect(result.current.result).toBe('A real dictionary result.');
    expect(result.current.persistedState.utilitiesResult).toBe('A real dictionary result.');
  });

  it('clears a live API-key warning without clearing ordinary dictionary output', () => {
    (usePersistedState as jest.Mock).mockReturnValue({});

    const { result } = renderHook(() => useDictionary());
    const clearMessage: ClearTransientApiKeyWarningMessage = {
      type: MessageType.CLEAR_TRANSIENT_API_KEY_WARNING,
      source: 'extension.handler',
      payload: {},
      timestamp: 123
    };

    act(() => {
      result.current.handleDictionaryResult({
        type: MessageType.DICTIONARY_RESULT,
        source: 'extension.dictionary',
        payload: {
          result: `${API_KEY_NOT_CONFIGURED_HEADING}\n\nAdd your key to look up words.`,
          toolName: 'dictionary_lookup'
        },
        timestamp: 1
      });
    });
    act(() => result.current.handleClearTransientApiKeyWarning(clearMessage));
    expect(result.current.result).toBe('');

    act(() => {
      result.current.handleDictionaryResult({
        type: MessageType.DICTIONARY_RESULT,
        source: 'extension.dictionary',
        payload: {
          result: 'Real dictionary output.',
          toolName: 'dictionary_lookup'
        },
        timestamp: 2
      });
    });
    act(() => result.current.handleClearTransientApiKeyWarning(clearMessage));
    expect(result.current.result).toBe('Real dictionary output.');
  });
});
