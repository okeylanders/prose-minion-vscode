/**
 * PublishingHandler Tests
 * Validates route registration for publishing standards
 */

import { PublishingHandler } from '@/application/handlers/domain/PublishingHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType } from '@/shared/types/messages';

describe('PublishingHandler', () => {
  let handler: PublishingHandler;
  let router: MessageRouter;

  beforeEach(() => {
    handler = new PublishingHandler(
      jest.fn().mockResolvedValue(undefined) as any, // postMessage
      {} as any  // extensionUri
    );
    router = new MessageRouter();
  });

  describe('Route Registration', () => {
    it('should register publishing routes', () => {
      handler.registerRoutes(router);

      const expectedRoutes = [
        MessageType.REQUEST_PUBLISHING_STANDARDS_DATA,
        MessageType.SET_PUBLISHING_PRESET,
        MessageType.SET_PUBLISHING_TRIM_SIZE
      ];

      expectedRoutes.forEach(route => {
        expect(router.hasHandler(route)).toBe(true);
      });
    });

    it('should register exactly 3 routes', () => {
      handler.registerRoutes(router);
      expect(router.handlerCount).toBe(3);
    });
  });
});
