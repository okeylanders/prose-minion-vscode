/**
 * DictionaryHandler Tests
 * Validates route registration for dictionary lookups
 */

import { DictionaryHandler } from '@/application/handlers/domain/DictionaryHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType } from '@/shared/types/messages';

describe('DictionaryHandler', () => {
  let handler: DictionaryHandler;
  let router: MessageRouter;

  beforeEach(() => {
    const mockService = {} as any;
    const mockPostMessage = jest.fn().mockResolvedValue(undefined);

    handler = new DictionaryHandler(mockService, mockPostMessage);
    router = new MessageRouter();
  });

  describe('Route Registration', () => {
    it('should register LOOKUP_DICTIONARY route', () => {
      handler.registerRoutes(router);
      expect(router.hasHandler(MessageType.LOOKUP_DICTIONARY)).toBe(true);
    });

    it('should register at least 1 route', () => {
      handler.registerRoutes(router);
      expect(router.handlerCount).toBeGreaterThanOrEqual(1);
    });
  });
});
