/**
 * ConfigurationHandler Tests
 * Validates route registration for settings, models, and API keys
 */

import { ConfigurationHandler } from '@/application/handlers/domain/ConfigurationHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType } from '@/shared/types/messages';

describe('ConfigurationHandler', () => {
  let handler: ConfigurationHandler;
  let router: MessageRouter;

  beforeEach(() => {
    handler = new ConfigurationHandler(
      {} as any, // context
      jest.fn().mockResolvedValue(undefined) as any, // postMessage
      {} as any, // outputChannel
      {} as any, // contextService
      {} as any, // publishingRepo
      {} as any, // standardsService
      {} as any, // aiResourceManager
      {} as any, // workspaceConfig
      {} as any  // secretStorage
    );
    router = new MessageRouter();
  });

  describe('Route Registration', () => {
    it('should register configuration routes', () => {
      handler.registerRoutes(router);

      const expectedRoutes = [
        MessageType.REQUEST_MODEL_DATA,
        MessageType.SET_MODEL_SELECTION,
        MessageType.REQUEST_SETTINGS_DATA,
        MessageType.UPDATE_SETTING,
        MessageType.REQUEST_API_KEY,
        MessageType.UPDATE_API_KEY,
        MessageType.DELETE_API_KEY,
        MessageType.RESET_TOKEN_USAGE
      ];

      expectedRoutes.forEach(route => {
        expect(router.hasHandler(route)).toBe(true);
      });
    });

    it('should register at least 5 routes', () => {
      handler.registerRoutes(router);
      expect(router.handlerCount).toBeGreaterThanOrEqual(5);
    });
  });
});
