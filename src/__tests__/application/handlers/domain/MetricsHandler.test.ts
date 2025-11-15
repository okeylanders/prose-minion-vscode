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

  beforeEach(() => {
    handler = new MetricsHandler(
      jest.fn().mockResolvedValue(undefined) as any, // postMessage
      {} as any, // outputChannel
      {} as any, // wordFrequency
      {} as any, // proseStats
      {} as any, // styleFlags
      {} as any  // workspaceConfig
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
});
