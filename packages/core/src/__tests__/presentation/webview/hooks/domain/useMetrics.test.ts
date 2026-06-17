/**
 * useMetrics Contract Tests
 *
 * Validates Tripartite Interface pattern for metrics operations.
 */

import { MetricsState, MetricsActions, MetricsPersistence } from '@/presentation/webview/hooks/domain/useMetrics';

describe('useMetrics - Type Contracts', () => {
  describe('Tripartite Interface Pattern', () => {
    it('should define State interface', () => {
      const state: MetricsState = {
        metricsByTool: {},
        activeTool: 'prose_stats',
        loading: false,
        loadingByTool: {},
        sourceMode: 'selection',
        pathText: ''
      };

      expect(state).toHaveProperty('metricsByTool');
      expect(state).toHaveProperty('activeTool');
      expect(state).toHaveProperty('loading');
      expect(state).toHaveProperty('sourceMode');
      expect(state).toHaveProperty('pathText');
    });

    it('should define Actions interface', () => {
      const actions: MetricsActions = {
        handleMetricsResult: jest.fn(),
        handleActiveFile: jest.fn(),
        handleManuscriptGlobs: jest.fn(),
        handleChapterGlobs: jest.fn(),
        setActiveTool: jest.fn(),
        setLoadingForTool: jest.fn(),
        isLoading: jest.fn().mockReturnValue(false),
        setSourceMode: jest.fn(),
        setPathText: jest.fn(),
        clearSubtoolResult: jest.fn(),
        clearResults: jest.fn()
      };

      expect(typeof actions.handleMetricsResult).toBe('function');
      expect(typeof actions.setActiveTool).toBe('function');
      expect(typeof actions.clearResults).toBe('function');
    });

    it('should define Persistence interface', () => {
      const persistence: MetricsPersistence = {
        metricsResultsByTool: {},
        metricsActiveTool: 'prose_stats',
        metricsSourceMode: 'selection',
        metricsPathText: ''
      };

      expect(persistence).toHaveProperty('metricsResultsByTool');
      expect(persistence).toHaveProperty('metricsActiveTool');
      expect(persistence).toHaveProperty('metricsSourceMode');
      expect(persistence).toHaveProperty('metricsPathText');
    });
  });
});
