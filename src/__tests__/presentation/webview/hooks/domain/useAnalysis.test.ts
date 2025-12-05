/**
 * useAnalysis Contract Tests
 *
 * Validates that useAnalysis hook exports the Tripartite Interface pattern:
 * - State: Read-only state properties
 * - Actions: User-triggered operations
 * - Persistence: What gets saved to vscode.setState
 */

import { AnalysisState, AnalysisActions, AnalysisPersistence } from '@/presentation/webview/hooks/domain/useAnalysis';

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
        'handleStreamChunk', 'handleStreamComplete', 'startStreaming', 'cancelStreaming'
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
