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
  let outputChannel: { appendLine: jest.Mock };

  beforeEach(() => {
    postMessage = jest.fn().mockResolvedValue(undefined);
    outputChannel = { appendLine: jest.fn() };
    handler = new MetricsHandler(
      {} as any, // proseStatsService
      {} as any, // styleFlagsService
      {} as any, // wordFrequencyService
      {} as any, // standardsService
      postMessage as any, // postMessage
      outputChannel as any, // outputChannel
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
    it.each([
      {
        name: 'prose stats',
        source: 'metrics.prose_stats',
        logPrefix: 'Prose stats',
        run: (testHandler: MetricsHandler) => testHandler.handleMeasureProseStats({
          type: MessageType.MEASURE_PROSE_STATS,
          source: 'webview.metrics',
          payload: { source: { mode: 'activeFile' } },
          timestamp: Date.now()
        } as any)
      },
      {
        name: 'style flags',
        source: 'metrics.style_flags',
        logPrefix: 'Style flags',
        run: (testHandler: MetricsHandler) => testHandler.handleMeasureStyleFlags({
          type: MessageType.MEASURE_STYLE_FLAGS,
          source: 'webview.metrics',
          payload: { source: { mode: 'activeFile' } },
          timestamp: Date.now()
        } as any)
      },
      {
        name: 'word frequency',
        source: 'metrics.word_frequency',
        logPrefix: 'Word frequency',
        run: (testHandler: MetricsHandler) => testHandler.handleMeasureWordFrequency({
          type: MessageType.MEASURE_WORD_FREQUENCY,
          source: 'webview.metrics',
          payload: { source: { mode: 'activeFile' } },
          timestamp: Date.now()
        } as any)
      }
    ])('surfaces unsaved active-file guidance as the user-facing $name error', async ({ source, logPrefix, run }) => {
      const message = 'Active file is not saved to disk. Save the file first or use selected text instead.';
      handler = new MetricsHandler(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        postMessage as any,
        outputChannel as any,
        { resolve: jest.fn().mockRejectedValue(new Error(message)) } as any
      );

      await run(handler);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          payload: {
            source,
            message
          }
        })
      );
      expect(outputChannel.appendLine).toHaveBeenCalledWith(`[MetricsHandler] ${logPrefix} error: ${message}`);
    });
  });
});
