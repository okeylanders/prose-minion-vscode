/**
 * SearchHandler Tests
 * Validates route registration for word search
 */

import { SearchHandler } from '@/application/handlers/domain/SearchHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType } from '@/shared/types/messages';

describe('SearchHandler', () => {
  let handler: SearchHandler;
  let router: MessageRouter;

  beforeEach(() => {
    handler = new SearchHandler(
      {} as any,  // wordSearchService
      jest.fn().mockResolvedValue(undefined) as any, // postMessage
      {} as any, // outputChannel
      {} as any  // categorySearchService
    );
    router = new MessageRouter();
  });

  describe('Route Registration', () => {
    it('should register RUN_WORD_SEARCH route', () => {
      handler.registerRoutes(router);
      expect(router.hasHandler(MessageType.RUN_WORD_SEARCH)).toBe(true);
    });

    it('should register CATEGORY_SEARCH_REQUEST route', () => {
      handler.registerRoutes(router);
      expect(router.hasHandler(MessageType.CATEGORY_SEARCH_REQUEST)).toBe(true);
    });

    it('should register CANCEL_CATEGORY_SEARCH_REQUEST route', () => {
      handler.registerRoutes(router);
      expect(router.hasHandler(MessageType.CANCEL_CATEGORY_SEARCH_REQUEST)).toBe(true);
    });

    it('should register exactly 3 routes', () => {
      handler.registerRoutes(router);
      expect(router.handlerCount).toBe(3);
    });
  });
});
