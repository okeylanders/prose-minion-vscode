import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType, WebviewToExtensionMessage } from '@/shared/types/messages';

/**
 * Test helper: Create a message envelope for testing
 */
function createTestMessage(type: MessageType, payload: any = {}): WebviewToExtensionMessage {
  return {
    type,
    source: 'webview.test',
    payload,
    timestamp: Date.now()
  } as WebviewToExtensionMessage;
}

describe('MessageRouter', () => {
  let router: MessageRouter;

  beforeEach(() => {
    router = new MessageRouter();
  });

  describe('Handler Registration', () => {
    it('should register handler for a message type', () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      router.register(MessageType.ANALYSIS_RESULT, handler);

      expect(router.hasHandler(MessageType.ANALYSIS_RESULT)).toBe(true);
      expect(router.handlerCount).toBe(1);
    });

    it('should register multiple handlers for different types', () => {
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);
      const handler3 = jest.fn().mockResolvedValue(undefined);

      router.register(MessageType.ANALYSIS_RESULT, handler1);
      router.register(MessageType.METRICS_RESULT, handler2);
      router.register(MessageType.STATUS, handler3);

      expect(router.handlerCount).toBe(3);
      expect(router.hasHandler(MessageType.ANALYSIS_RESULT)).toBe(true);
      expect(router.hasHandler(MessageType.METRICS_RESULT)).toBe(true);
      expect(router.hasHandler(MessageType.STATUS)).toBe(true);
    });

    it('should throw error when registering duplicate handler', () => {
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);

      router.register(MessageType.ANALYSIS_RESULT, handler1);

      expect(() => {
        router.register(MessageType.ANALYSIS_RESULT, handler2);
      }).toThrow('Duplicate handler registration');
    });

    it('should track registered message types', () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      router.register(MessageType.ANALYZE_DIALOGUE, handler);
      router.register(MessageType.ANALYZE_PROSE, handler);

      const types = router.getRegisteredTypes();

      expect(types).toContain(MessageType.ANALYZE_DIALOGUE);
      expect(types).toContain(MessageType.ANALYZE_PROSE);
      expect(types).toHaveLength(2);
    });
  });

  describe('Message Routing', () => {
    it('should route message to registered handler', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      const message = createTestMessage(MessageType.ANALYSIS_RESULT, { result: 'test' });

      router.register(MessageType.ANALYSIS_RESULT, handler);
      await router.route(message);

      expect(handler).toHaveBeenCalledWith(message);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should route multiple messages to correct handlers', async () => {
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);

      const message1 = createTestMessage(MessageType.ANALYSIS_RESULT);
      const message2 = createTestMessage(MessageType.METRICS_RESULT);

      router.register(MessageType.ANALYSIS_RESULT, handler1);
      router.register(MessageType.METRICS_RESULT, handler2);

      await router.route(message1);
      await router.route(message2);

      expect(handler1).toHaveBeenCalledWith(message1);
      expect(handler2).toHaveBeenCalledWith(message2);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should throw error for unregistered message type', async () => {
      const message = createTestMessage(MessageType.ANALYSIS_RESULT);

      await expect(router.route(message)).rejects.toThrow(
        'No handler registered for message type'
      );
    });

    it('should include registered types in error message', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      router.register(MessageType.STATUS, handler);

      const message = createTestMessage(MessageType.ANALYSIS_RESULT);

      await expect(router.route(message)).rejects.toThrow(/status/);
    });

    it('should handle async handlers correctly', async () => {
      const handler = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const message = createTestMessage(MessageType.STATUS);
      router.register(MessageType.STATUS, handler);

      await router.route(message);

      expect(handler).toHaveBeenCalledWith(message);
    });
  });

  describe('Edge Cases', () => {
    it('should handle handler that throws error', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Handler error'));
      const message = createTestMessage(MessageType.STATUS);

      router.register(MessageType.STATUS, handler);

      // Route should propagate the error
      await expect(router.route(message)).rejects.toThrow('Handler error');
    });

    it('should allow same handler for different message types', () => {
      const sharedHandler = jest.fn().mockResolvedValue(undefined);

      router.register(MessageType.ANALYZE_DIALOGUE, sharedHandler);
      router.register(MessageType.ANALYZE_PROSE, sharedHandler);

      expect(router.handlerCount).toBe(2);
      expect(router.hasHandler(MessageType.ANALYZE_DIALOGUE)).toBe(true);
      expect(router.hasHandler(MessageType.ANALYZE_PROSE)).toBe(true);
    });

    it('should start with zero registered handlers', () => {
      expect(router.handlerCount).toBe(0);
      expect(router.getRegisteredTypes()).toHaveLength(0);
    });
  });

  describe('Testing Utilities', () => {
    it('hasHandler should return false for unregistered type', () => {
      expect(router.hasHandler(MessageType.ANALYSIS_RESULT)).toBe(false);
    });

    it('handlerCount should reflect current registrations', () => {
      expect(router.handlerCount).toBe(0);

      const handler = jest.fn().mockResolvedValue(undefined);
      router.register(MessageType.STATUS, handler);

      expect(router.handlerCount).toBe(1);
    });

    it('getRegisteredTypes should return empty array initially', () => {
      expect(router.getRegisteredTypes()).toEqual([]);
    });
  });
});
