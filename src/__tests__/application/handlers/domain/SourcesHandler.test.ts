/**
 * SourcesHandler Tests
 * Validates route registration for file and glob operations
 */

import { SourcesHandler } from '@/application/handlers/domain/SourcesHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType } from '@/shared/types/messages';

describe('SourcesHandler', () => {
  let handler: SourcesHandler;
  let router: MessageRouter;

  beforeEach(() => {
    const mockPostMessage = jest.fn().mockResolvedValue(undefined);

    handler = new SourcesHandler(mockPostMessage);
    router = new MessageRouter();
  });

  describe('Route Registration', () => {
    it('should register source routes', () => {
      handler.registerRoutes(router);

      const expectedRoutes = [
        MessageType.REQUEST_ACTIVE_FILE,
        MessageType.REQUEST_MANUSCRIPT_GLOBS,
        MessageType.REQUEST_CHAPTER_GLOBS
      ];

      expectedRoutes.forEach(route => {
        expect(router.hasHandler(route)).toBe(true);
      });
    });

    it('should register at least 3 routes', () => {
      handler.registerRoutes(router);
      expect(router.handlerCount).toBeGreaterThanOrEqual(3);
    });
  });
});
