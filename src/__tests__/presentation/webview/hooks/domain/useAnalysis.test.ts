/**
 * @jest-environment jsdom
 */

/**
 * useAnalysis Contract + Behavioral Tests
 *
 * Validates that useAnalysis hook exports the Tripartite Interface pattern:
 * - State: Read-only state properties
 * - Actions: User-triggered operations
 * - Persistence: What gets saved to vscode.setState
 *
 * Also tests critical streaming cancellation behavior (content preservation).
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { AnalysisState, AnalysisActions, AnalysisPersistence, useAnalysis } from '@/presentation/webview/hooks/domain/useAnalysis';
import { MessageType } from '@shared/types';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

// Mock dependencies
jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../../../presentation/webview/hooks/usePersistence');

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { usePersistedState } from '@hooks/usePersistence';

describe('useAnalysis - Type Contracts', () => {
  describe('AnalysisState Interface', () => {
    it('should define read-only state properties', () => {
      const requiredProperties: (keyof AnalysisState)[] = [
        'result',
        'toolName',
        'loading',
        'usedGuides',
        'tickerMessage',
        'statusMessage',
        // Streaming state
        'isStreaming',
        'isBuffering',
        'streamingContent',
        'streamingTokenCount',
        'currentRequestId'
      ];

      // Type assertion validates the interface exists and has these properties
      const state: AnalysisState = {
        result: '',
        toolName: undefined,
        loading: false,
        usedGuides: [],
        tickerMessage: '',
        statusMessage: '',
        // Streaming state
        isStreaming: false,
        isBuffering: false,
        streamingContent: '',
        streamingTokenCount: 0,
        currentRequestId: null
      };

      requiredProperties.forEach(prop => {
        expect(state).toHaveProperty(prop);
      });
    });
  });

  describe('AnalysisActions Interface', () => {
    it('should define action methods', () => {
      const requiredActions: (keyof AnalysisActions)[] = [
        'handleAnalysisResult',
        'handleStatusMessage',
        'setLoading',
        'clearResult',
        'clearStatus',
        // Streaming actions
        'handleStreamStarted',
        'handleStreamChunk',
        'handleStreamComplete',
        'startStreaming',
        'cancelStreaming'
      ];

      // Type assertion validates the interface exists
      const actions: AnalysisActions = {
        handleAnalysisResult: jest.fn(),
        handleStatusMessage: jest.fn(),
        setLoading: jest.fn(),
        clearResult: jest.fn(),
        clearStatus: jest.fn(),
        // Streaming actions
        handleStreamStarted: jest.fn(),
        handleStreamChunk: jest.fn(),
        handleStreamComplete: jest.fn(),
        startStreaming: jest.fn(),
        cancelStreaming: jest.fn()
      };

      requiredActions.forEach(action => {
        expect(actions).toHaveProperty(action);
        expect(typeof actions[action]).toBe('function');
      });
    });
  });

  describe('AnalysisPersistence Interface', () => {
    it('should define persisted state properties', () => {
      const requiredProperties: (keyof AnalysisPersistence)[] = [
        'analysisResult',
        'analysisToolName',
        'usedGuides',
        'tickerMessage',
        'statusMessage'
      ];

      // Type assertion validates the interface exists
      const persistence: AnalysisPersistence = {
        analysisResult: '',
        analysisToolName: undefined,
        usedGuides: [],
        tickerMessage: '',
        statusMessage: ''
      };

      requiredProperties.forEach(prop => {
        expect(persistence).toHaveProperty(prop);
      });
    });
  });

  describe('Tripartite Interface Pattern Compliance', () => {
    it('should maintain separation of concerns', () => {
      // State properties (read-only) - including streaming state
      const stateProps: (keyof AnalysisState)[] = [
        'result', 'toolName', 'loading', 'usedGuides', 'tickerMessage', 'statusMessage',
        'isStreaming', 'isBuffering', 'streamingContent', 'streamingTokenCount', 'currentRequestId'
      ];

      // Actions (user-triggered operations) - including streaming actions
      const actionProps: (keyof AnalysisActions)[] = [
        'handleAnalysisResult', 'handleStatusMessage', 'setLoading', 'clearResult', 'clearStatus',
        'handleStreamStarted', 'handleStreamChunk', 'handleStreamComplete', 'startStreaming', 'cancelStreaming'
      ];

      // Persistence (what gets saved) - note: streaming state is NOT persisted (transient)
      const persistenceProps: (keyof AnalysisPersistence)[] = ['analysisResult', 'analysisToolName', 'usedGuides', 'tickerMessage', 'statusMessage'];

      // Validate no overlap between State and Actions
      const stateActionOverlap = stateProps.filter(prop => actionProps.includes(prop as any));
      expect(stateActionOverlap).toHaveLength(0);

      // Validate separation is maintained
      expect(stateProps.length).toBeGreaterThan(0);
      expect(actionProps.length).toBeGreaterThan(0);
      expect(persistenceProps.length).toBeGreaterThan(0);
    });
  });
});

describe('useAnalysis - Streaming Cancellation', () => {
  let mockVSCode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    mockVSCode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(mockVSCode);
    (usePersistedState as jest.Mock).mockReturnValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should preserve streamed content when cancelling', () => {
    const { result } = renderHook(() => useAnalysis());

    // Simulate streaming: start, receive chunks, then cancel
    act(() => result.current.startStreaming('req-1'));

    act(() => result.current.handleStreamChunk({
      type: MessageType.STREAM_CHUNK,
      source: 'extension.test',
      payload: { domain: 'analysis', requestId: 'req-1', token: 'Hello ' },
      timestamp: Date.now()
    }));

    act(() => result.current.handleStreamChunk({
      type: MessageType.STREAM_CHUNK,
      source: 'extension.test',
      payload: { domain: 'analysis', requestId: 'req-1', token: 'world' },
      timestamp: Date.now()
    }));

    // Cancel — content should be preserved, not erased
    act(() => result.current.cancelStreaming());

    expect(result.current.result).toBe('Hello world');
    expect(result.current.loading).toBe(false);
    expect(result.current.isStreaming).toBe(false);
  });

  it('should not overwrite result when cancelling with empty buffer', () => {
    const { result } = renderHook(() => useAnalysis());

    // Set a previous result via analysis result message
    act(() => result.current.handleAnalysisResult({
      type: MessageType.ANALYSIS_RESULT,
      source: 'extension.test',
      payload: { result: 'previous result', toolName: 'prose', usedGuides: [] },
      timestamp: Date.now()
    }));

    expect(result.current.result).toBe('previous result');

    // Start streaming (clears result), then immediately cancel with no chunks
    act(() => result.current.startStreaming('req-2'));
    act(() => result.current.cancelStreaming());

    // No streamed content, so result stays cleared (expected — nothing to preserve)
    expect(result.current.result).toBe('');
    expect(result.current.loading).toBe(false);
  });
});
