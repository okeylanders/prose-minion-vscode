/**
 * UIHandler Tests
 * Validates route registration for UI operations (tab changes, file opening)
 */

import { UIHandler } from '@/application/handlers/domain/UIHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType } from '@/shared/types/messages';

describe('UIHandler', () => {
  let handler: UIHandler;
  let router: MessageRouter;

  beforeEach(() => {
    handler = new UIHandler(
      jest.fn().mockResolvedValue(undefined) as any, // postMessage
      {} as any, // outputChannel
      {} as any  // extensionUri
    );
    router = new MessageRouter();
  });

  describe('Route Registration', () => {
    it('should register UI routes', () => {
      handler.registerRoutes(router);

      const expectedRoutes = [
        MessageType.TAB_CHANGED,
        MessageType.OPEN_GUIDE_FILE,
        MessageType.OPEN_RESOURCE,
        MessageType.REQUEST_SELECTION
      ];

      expectedRoutes.forEach(route => {
        expect(router.hasHandler(route)).toBe(true);
      });
    });

    it('should register at least 4 routes', () => {
      handler.registerRoutes(router);
      expect(router.handlerCount).toBeGreaterThanOrEqual(4);
    });
  });
});
