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
  let postMessage: jest.Mock;

  beforeEach(() => {
    postMessage = jest.fn().mockResolvedValue(undefined);
    handler = new SearchHandler(
      {} as any,  // wordSearchService
      postMessage as any, // postMessage
      { appendLine: jest.fn() } as any, // outputChannel
      {} as any, // textSourceResolver
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

  describe('Text source errors', () => {
    it('surfaces unsaved active-file guidance as the user-facing search error', async () => {
      const message = 'Active file is not saved to disk. Save the file first or use selected text instead.';
      handler = new SearchHandler(
        {} as any,
        postMessage as any,
        { appendLine: jest.fn() } as any,
        { resolve: jest.fn().mockRejectedValue(new Error(message)) } as any,
        {} as any
      );

      await handler.handleMeasureWordSearch({
        type: MessageType.RUN_WORD_SEARCH,
        source: 'webview.search.word',
        payload: {
          source: { mode: 'activeFile' },
          options: {}
        },
        timestamp: Date.now()
      } as any);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          payload: {
            source: 'search',
            message
          }
        })
      );
    });
  });
});
