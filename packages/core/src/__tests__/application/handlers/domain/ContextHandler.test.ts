/**
 * ContextHandler Tests
 * Validates route registration for context generation
 */

import { ContextHandler } from '@/application/handlers/domain/ContextHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType } from '@/shared/types/messages';

describe('ContextHandler', () => {
  let handler: ContextHandler;
  let router: MessageRouter;

  beforeEach(() => {
    const mockService = {} as any;
    const mockPostMessage = jest.fn().mockResolvedValue(undefined);

    handler = new ContextHandler(mockService, mockPostMessage);
    router = new MessageRouter();
  });

  describe('Route Registration', () => {
    it('should register GENERATE_CONTEXT route', () => {
      handler.registerRoutes(router);
      expect(router.hasHandler(MessageType.GENERATE_CONTEXT)).toBe(true);
    });

    it('should register at least 1 route', () => {
      handler.registerRoutes(router);
      expect(router.handlerCount).toBeGreaterThanOrEqual(1);
    });
  });
});
