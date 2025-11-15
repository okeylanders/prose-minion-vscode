/**
 * FileOperationsHandler Tests
 * Validates route registration for file operations (save, export)
 */

import { FileOperationsHandler } from '@/application/handlers/domain/FileOperationsHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType } from '@/shared/types/messages';

describe('FileOperationsHandler', () => {
  let handler: FileOperationsHandler;
  let router: MessageRouter;

  beforeEach(() => {
    const mockPostMessage = jest.fn().mockResolvedValue(undefined);

    handler = new FileOperationsHandler(mockPostMessage);
    router = new MessageRouter();
  });

  describe('Route Registration', () => {
    it('should register SAVE_RESULT route', () => {
      handler.registerRoutes(router);
      expect(router.hasHandler(MessageType.SAVE_RESULT)).toBe(true);
    });

    it('should register at least 1 route', () => {
      handler.registerRoutes(router);
      expect(router.handlerCount).toBeGreaterThanOrEqual(1);
    });
  });
});
