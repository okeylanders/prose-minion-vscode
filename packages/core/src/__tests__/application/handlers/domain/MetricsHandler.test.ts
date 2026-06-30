/**
 * MetricsHandler Tests
 * Validates route registration for prose stats, style flags, word frequency
 */

import { MetricsHandler } from '@/application/handlers/domain/MetricsHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType } from '@/shared/types/messages';

describe('MetricsHandler', () => {
  let handler: MetricsHandler;
  let router: MessageRouter;
  let postMessage: jest.Mock;

  beforeEach(() => {
    postMessage = jest.fn().mockResolvedValue(undefined);
    handler = new MetricsHandler(
      {} as any, // proseStatsService
      {} as any, // styleFlagsService
      {} as any, // wordFrequencyService
      {} as any, // standardsService
      postMessage as any, // postMessage
      {} as any, // outputChannel
      {} as any  // textSourceResolver
    );
    router = new MessageRouter();
  });

  describe('Route Registration', () => {
    it('should register metrics routes', () => {
      handler.registerRoutes(router);

      const expectedRoutes = [
        MessageType.MEASURE_PROSE_STATS,
        MessageType.MEASURE_STYLE_FLAGS,
        MessageType.MEASURE_WORD_FREQUENCY
      ];

      expectedRoutes.forEach(route => {
        expect(router.hasHandler(route)).toBe(true);
      });
    });

    it('should register exactly 3 metrics routes', () => {
      handler.registerRoutes(router);
      expect(router.handlerCount).toBe(3);
    });
  });

  describe('Text source errors', () => {
    it('surfaces unsaved active-file guidance as the user-facing metrics error', async () => {
      const message = 'Active file is not saved to disk. Save the file first or use selected text instead.';
      handler = new MetricsHandler(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        postMessage as any,
        {} as any,
        { resolve: jest.fn().mockRejectedValue(new Error(message)) } as any
      );

      await handler.handleMeasureStyleFlags({
        type: MessageType.MEASURE_STYLE_FLAGS,
        source: 'webview.metrics',
        payload: {
          source: { mode: 'activeFile' }
        },
        timestamp: Date.now()
      } as any);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          payload: {
            source: 'metrics.style_flags',
            message
          }
        })
      );
    });
  });
});
