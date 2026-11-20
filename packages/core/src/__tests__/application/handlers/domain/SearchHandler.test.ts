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
  let outputChannel: { appendLine: jest.Mock };

  beforeEach(() => {
    postMessage = jest.fn().mockResolvedValue(undefined);
    outputChannel = { appendLine: jest.fn() };
    handler = new SearchHandler(
      {} as any,  // wordSearchService
      postMessage as any, // postMessage
      outputChannel as any, // outputChannel
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

    it('also registers Passage Search\'s routes when given its engine, and stops its search on dispose', async () => {
      const controller: { signal?: AbortSignal } = {};
      let finish: (value: unknown) => void = () => undefined;
      const engine = {
        plan: jest.fn(async () => ({ kind: 'planned', plan: { estimate: { model: 'test/reader', files: 1, calls: 1, inputTokens: 1, outputTokens: 1, leftOut: { unreadable: 0, unsplittable: 0, empty: 0 } } } })),
        run: jest.fn((_plan: unknown, options: { signal?: AbortSignal }) => {
          controller.signal = options.signal;
          return new Promise((resolve) => { finish = resolve; });
        })
      };
      handler = new SearchHandler(
        {} as any, postMessage as any, outputChannel as any, {} as any, {} as any,
        { engine: engine as any, shell: { openFileInEditor: jest.fn() } }
      );
      handler.registerRoutes(router);
      expect(router.handlerCount).toBe(9);
      for (const type of [
        MessageType.PASSAGE_SEARCH_PLAN_REQUEST,
        MessageType.PASSAGE_SEARCH_RUN,
        MessageType.PASSAGE_SEARCH_STOP,
        MessageType.PASSAGE_SEARCH_OPEN_INSTANCE,
        MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN_REQUEST,
        MessageType.PASSAGE_SEARCH_ORGANIZE_RUN
      ]) {
        expect(router.hasHandler(type)).toBe(true);
      }

      await router.route({
        type: MessageType.PASSAGE_SEARCH_PLAN_REQUEST,
        source: 'webview.search.passage',
        payload: { requestId: 'plan-1', question: 'Where does Alice fall?', scopes: { activeFile: true, selection: false, groups: [], pattern: '' }, organize: false },
        timestamp: 1
      } as never);
      const planId = postMessage.mock.calls[0][0].payload.planId;
      void router.route({ type: MessageType.PASSAGE_SEARCH_RUN, source: 'webview.search.passage', payload: { requestId: 'run-1', planId }, timestamp: 2 } as never);
      await Promise.resolve();
      expect(controller.signal?.aborted).toBe(false);

      handler.dispose();
      expect(controller.signal?.aborted).toBe(true);
      finish({});
    });
  });

  describe('Text source errors', () => {
    it('surfaces unsaved active-file guidance as the user-facing search error', async () => {
      const message = 'Active file is not saved to disk. Save the file first or use selected text instead.';
      handler = new SearchHandler(
        {} as any,
        postMessage as any,
        outputChannel as any,
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
      expect(outputChannel.appendLine).toHaveBeenCalledWith(`[SearchHandler] Word search error: ${message}`);
    });
  });
});
