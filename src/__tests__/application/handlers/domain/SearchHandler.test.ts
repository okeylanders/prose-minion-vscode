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
      jest.fn().mockResolvedValue(undefined) as any, // postMessage
      {} as any, // outputChannel
      {} as any  // wordSearchService
    );
    router = new MessageRouter();
  });

  describe('Route Registration', () => {
    it('should register RUN_WORD_SEARCH route', () => {
      handler.registerRoutes(router);
      expect(router.hasHandler(MessageType.RUN_WORD_SEARCH)).toBe(true);
    });

    it('should register exactly 1 route', () => {
      handler.registerRoutes(router);
      expect(router.handlerCount).toBe(1);
    });
  });
});
