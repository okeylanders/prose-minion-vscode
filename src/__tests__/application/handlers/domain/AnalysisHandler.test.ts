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
      setStatusEmitter: jest.fn()
    } as any;

    mockPostMessage = jest.fn().mockResolvedValue(undefined);

    handler = new AnalysisHandler(mockService, mockPostMessage);
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

    it('should register CANCEL_REQUEST route', () => {
      handler.registerRoutes(router);

      expect(router.hasHandler(MessageType.CANCEL_REQUEST)).toBe(true);
    });

    it('should register exactly 3 routes', () => {
      handler.registerRoutes(router);

      expect(router.handlerCount).toBe(3);
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
