/**
 * PublishingHandler Tests
 * Validates route registration for publishing standards
 */

import { PublishingHandler } from '@/application/handlers/domain/PublishingHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import {
  ErrorMessage,
  MessageType,
  RequestPublishingStandardsDataMessage
} from '@/shared/types/messages';
import { MessageTransport } from '@/application/handlers/MessageHandlerContracts';
import { StandardsService } from '@services/resources/StandardsService';
import { createFakeSettings } from '../../../mocks/platform';

describe('PublishingHandler', () => {
  let handler: PublishingHandler;
  let router: MessageRouter;
  let getGenres: jest.Mock;
  let postMessage: jest.Mock;

  beforeEach(() => {
    getGenres = jest.fn().mockResolvedValue([]);
    postMessage = jest.fn().mockResolvedValue(undefined);
    handler = new PublishingHandler(
      { getGenres } as unknown as StandardsService,
      postMessage as MessageTransport,
      createFakeSettings()
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

  it('surfaces repository read failures as publishing errors', async () => {
    getGenres.mockRejectedValue(new Error('standards file unreadable'));

    await handler.handleRequestPublishingStandardsData({
      type: MessageType.REQUEST_PUBLISHING_STANDARDS_DATA,
      source: 'webview.test',
      payload: {},
      timestamp: Date.now()
    } as RequestPublishingStandardsDataMessage);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining<Partial<ErrorMessage>>({
        type: MessageType.ERROR,
        source: 'extension.publishing',
        payload: expect.objectContaining({
          source: 'publishing',
          message: 'Failed to load publishing standards',
          details: 'standards file unreadable'
        })
      })
    );
  });
});
