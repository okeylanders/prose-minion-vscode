/**
 * AnalysisHandler Tests
 *
 * Validates route registration, message processing, and error handling
 * for dialogue and prose analysis operations.
 */

import { AnalysisHandler } from '@/application/handlers/domain/AnalysisHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType, WebviewToExtensionMessage } from '@/shared/types/messages';
import { AssistantToolService } from '@/infrastructure/api/services/analysis/AssistantToolService';
import { createFakeSettings } from '../../../mocks/platform';

// Test helper: Create test message
function createTestMessage(type: MessageType, payload: any = {}): WebviewToExtensionMessage {
  return {
    type,
    source: 'webview.test',
    payload,
    timestamp: Date.now()
  } as WebviewToExtensionMessage;
}

describe('AnalysisHandler', () => {
  let handler: AnalysisHandler;
  let mockService: jest.Mocked<AssistantToolService>;
  let mockPostMessage: jest.Mock;
  let router: MessageRouter;

  beforeEach(() => {
    // Mock service
    mockService = {
      analyzeDialogue: jest.fn().mockResolvedValue({
        result: 'Test analysis result',
        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      }),
      analyzeProse: jest.fn().mockResolvedValue({
        result: 'Test prose result',
        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      }),
      addStatusListener: jest.fn(() => jest.fn())
    } as any;

    mockPostMessage = jest.fn().mockResolvedValue(undefined);

    handler = new AnalysisHandler(mockService, mockPostMessage, createFakeSettings());
    router = new MessageRouter();
  });

  describe('Route Registration', () => {
    it('should register ANALYZE_DIALOGUE route', () => {
      handler.registerRoutes(router);

      expect(router.hasHandler(MessageType.ANALYZE_DIALOGUE)).toBe(true);
    });

    it('should register ANALYZE_PROSE route', () => {
      handler.registerRoutes(router);

      expect(router.hasHandler(MessageType.ANALYZE_PROSE)).toBe(true);
    });

    it('should register ANALYZE_WRITING_TOOLS route', () => {
      handler.registerRoutes(router);

      expect(router.hasHandler(MessageType.ANALYZE_WRITING_TOOLS)).toBe(true);
    });

    it('should register CANCEL_ANALYSIS_REQUEST route', () => {
      handler.registerRoutes(router);

      expect(router.hasHandler(MessageType.CANCEL_ANALYSIS_REQUEST)).toBe(true);
    });

    it('should register exactly 4 routes', () => {
      handler.registerRoutes(router);

      expect(router.handlerCount).toBe(4);
    });
  });

  describe('Message Processing', () => {
    it('should handle ANALYZE_DIALOGUE message', async () => {
      const message = createTestMessage(MessageType.ANALYZE_DIALOGUE, {
        text: 'Test dialogue',
        contextText: undefined,
        sourceFileUri: undefined,
        focus: 'both'
      });

      handler.registerRoutes(router);
      await router.route(message);

      expect(mockService.analyzeDialogue).toHaveBeenCalled();
    });

    it('should handle ANALYZE_PROSE message', async () => {
      const message = createTestMessage(MessageType.ANALYZE_PROSE, {
        text: 'Test prose',
        contextText: undefined,
        sourceFileUri: undefined
      });

      handler.registerRoutes(router);
      await router.route(message);

      expect(mockService.analyzeProse).toHaveBeenCalled();
    });

    it('should handle ANALYZE_WRITING_TOOLS message', async () => {
      // Add mock for analyzeWritingTools
      mockService.analyzeWritingTools = jest.fn().mockResolvedValue({
        result: 'Test writing tools result',
        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      });

      const message = createTestMessage(MessageType.ANALYZE_WRITING_TOOLS, {
        text: 'Test text for writing tools analysis',
        contextText: undefined,
        sourceFileUri: undefined,
        focus: 'cliche'
      });

      handler.registerRoutes(router);
      await router.route(message);

      expect(mockService.analyzeWritingTools).toHaveBeenCalled();
    });
  });

  describe('Shared-service status gating (PR #67 review)', () => {
    it('forwards guide-loading status only while a request is in flight', async () => {
      // Capture the listener registered on the SHARED AssistantToolService —
      // with two webviews live, un-gated forwarding would strand the other
      // surface's "Loading craft guides…" here with nothing to clear it.
      let captured: ((m: string, p?: { current: number; total: number }, t?: string) => void) | undefined;
      (mockService.addStatusListener as jest.Mock).mockImplementation((listener) => {
        captured = listener;
        return jest.fn();
      });
      const gatedHandler = new AnalysisHandler(mockService, mockPostMessage, createFakeSettings());
      expect(captured).toBeDefined();

      // Idle: another surface's run is loading guides — stay silent.
      captured!('Loading requested craft guides...', undefined, 'guide.md');
      expect(mockPostMessage).not.toHaveBeenCalled();

      // In flight: activeRequests is populated synchronously at run start,
      // before the handler's internal awaits — fire the shared-service event
      // in that window, then let the run settle.
      const runPromise = gatedHandler.handleAnalyzeProse(
        createTestMessage(MessageType.ANALYZE_PROSE, { text: 'Some prose' }) as never
      );

      captured!('Loading requested craft guides...', undefined, 'guide.md');
      const guideStatuses = mockPostMessage.mock.calls
        .map((call) => call[0])
        .filter(
          (m) => m?.type === MessageType.STATUS && m.payload.message === 'Loading requested craft guides...'
        );
      expect(guideStatuses).toHaveLength(1);

      await runPromise;
    });

    it('dispose releases the status subscription', () => {
      const disposeListener = jest.fn();
      (mockService.addStatusListener as jest.Mock).mockReturnValue(disposeListener);
      const localHandler = new AnalysisHandler(mockService, mockPostMessage, createFakeSettings());

      localHandler.dispose();

      expect(disposeListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockService.analyzeDialogue.mockRejectedValue(new Error('Service failure'));

      const message = createTestMessage(MessageType.ANALYZE_DIALOGUE, {
        text: 'Test dialogue',
        contextText: undefined,
        sourceFileUri: undefined,
        focus: 'both'
      });

      handler.registerRoutes(router);

      // Should not throw - errors should be sent via postMessage
      await expect(router.route(message)).resolves.not.toThrow();
    });

    it('should send error message when service fails', async () => {
      mockService.analyzeDialogue.mockRejectedValue(new Error('Service failure'));

      const message = createTestMessage(MessageType.ANALYZE_DIALOGUE, {
        text: 'Test dialogue',
        contextText: undefined,
        sourceFileUri: undefined,
        focus: 'both'
      });

      handler.registerRoutes(router);
      await router.route(message);

      // Verify error message was sent
      const errorCalls = mockPostMessage.mock.calls.filter(
        call => call[0]?.type === MessageType.ERROR
      );
      expect(errorCalls.length).toBeGreaterThan(0);
    });
  });
});
