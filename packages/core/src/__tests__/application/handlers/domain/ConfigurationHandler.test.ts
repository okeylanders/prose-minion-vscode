/**
 * ConfigurationHandler Tests
 * Validates route registration plus the curated⨝live MODEL_DATA transform
 * (buildModelOption / hasLivePricing / getReleaseDate / isFallback / categoryOptions).
 */

import { ConfigurationHandler } from '@/application/handlers/domain/ConfigurationHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType, ModelDataMessage } from '@/shared/types/messages';
import { OpenRouterModels, OpenRouterModel } from '@providers/OpenRouterModels';

describe('ConfigurationHandler', () => {
  let handler: ConfigurationHandler;
  let router: MessageRouter;

  beforeEach(() => {
    handler = new ConfigurationHandler(
      {} as any, // aiResourceManager
      {} as any, // assistantToolService
      {} as any, // dictionaryService
      {} as any, // contextAssistantService
      {} as any, // secretsService
      {} as any, // settings port
      {} as any, // shell port
      jest.fn().mockResolvedValue(undefined) as any, // postMessage
      {} as any // outputChannel
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

  describe('sendModelData (curated⨝live transform)', () => {
    const CURATED_ID = 'anthropic/claude-opus-4.8';

    const recommended = [
      { id: CURATED_ID, name: 'Claude Opus 4.8', family: 'Claude Opus', description: 'curated blurb' }
    ];

    /**
     * Build a handler whose only real dependencies are the settings store,
     * output channel, and postMessage spy — everything sendModelData() touches.
     */
    const buildHandler = (
      settingValues: Record<string, unknown>
    ): { handler: ConfigurationHandler; postMessage: jest.Mock; appendLine: jest.Mock } => {
      const postMessage = jest.fn().mockResolvedValue(undefined);
      const appendLine = jest.fn();
      const settings = {
        get: jest.fn((_section: string, key: string, def?: unknown) =>
          key in settingValues ? settingValues[key] : def
        )
      };
      const aiResourceManager = { getResolvedModelSelections: () => ({}) };
      const built = new ConfigurationHandler(
        aiResourceManager as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        settings as any,
        {} as any,
        postMessage as any,
        { appendLine, show: jest.fn(), clear: jest.fn() } as any
      );
      return { handler: built, postMessage, appendLine };
    };

    const allCuratedSettings = {
      assistantModel: CURATED_ID,
      dictionaryModel: CURATED_ID,
      contextModel: CURATED_ID,
      categoryModel: CURATED_ID,
      'ui.showTokenWidget': true
    };

    const getPayload = (postMessage: jest.Mock): ModelDataMessage['payload'] => {
      const sent = postMessage.mock.calls.find(
        ([msg]) => msg?.type === MessageType.MODEL_DATA
      )?.[0] as ModelDataMessage | undefined;
      expect(sent).toBeDefined();
      return sent!.payload;
    };

    afterEach(() => jest.restoreAllMocks());

    it('joins live pricing/context/release onto the curated option when live data is present', async () => {
      const created = 1754352000; // 2025-08-05
      const live: OpenRouterModel[] = [{
        id: CURATED_ID,
        name: 'Claude Opus 4.8 (live)',
        created,
        pricing: { prompt: '0.000015', completion: '0.000075' },
        context_length: 200000
      }];
      jest.spyOn(OpenRouterModels, 'getRecommendedModels').mockReturnValue(recommended as any);
      jest.spyOn(OpenRouterModels, 'fetchModels').mockResolvedValue(live);

      const { handler: h, postMessage } = buildHandler(allCuratedSettings);
      await h.sendModelData();

      const option = getPayload(postMessage).options.find(o => o.id === CURATED_ID)!;
      expect(option.pricingAvailable).toBe(true);
      expect(option.liveDataAvailable).toBe(true);
      expect(option.pricing).toEqual({ prompt: '0.000015', completion: '0.000075' });
      expect(option.contextLength).toBe(200000);
      expect(option.releaseDate).toBe(new Date(created * 1000).toISOString().slice(0, 10));
      // Curated metadata still wins for label/description/family.
      expect(option.label).toBe('Claude Opus 4.8');
      expect(option.family).toBe('Claude Opus');
    });

    it('suppresses pricing and logs a degraded WARN when the catalog is all fallback', async () => {
      const fallback: OpenRouterModel[] = [{
        id: CURATED_ID,
        name: 'Claude Opus 4.8',
        isFallback: true,
        pricing: { prompt: '0', completion: '0' },
        context_length: 200000
      }];
      jest.spyOn(OpenRouterModels, 'getRecommendedModels').mockReturnValue(recommended as any);
      jest.spyOn(OpenRouterModels, 'fetchModels').mockResolvedValue(fallback);

      const { handler: h, postMessage, appendLine } = buildHandler(allCuratedSettings);
      await h.sendModelData();

      const option = getPayload(postMessage).options.find(o => o.id === CURATED_ID)!;
      expect(option.pricingAvailable).toBe(false);
      expect(option.pricing).toBeUndefined();         // never "$0.00"
      expect(option.contextLength).toBeUndefined();
      expect(option.releaseDate).toBeUndefined();
      expect(option.liveDataAvailable).toBe(false);
      // Degraded state must be visible in the Output channel, not a silent success.
      expect(appendLine.mock.calls.some(([line]) =>
        /offline fallback/i.test(String(line))
      )).toBe(true);
    });

    it('omits releaseDate when the live created timestamp is 0', async () => {
      const live: OpenRouterModel[] = [{
        id: CURATED_ID,
        name: 'Claude Opus 4.8',
        created: 0,
        pricing: { prompt: '0.000015', completion: '0.000075' },
        context_length: 200000
      }];
      jest.spyOn(OpenRouterModels, 'getRecommendedModels').mockReturnValue(recommended as any);
      jest.spyOn(OpenRouterModels, 'fetchModels').mockResolvedValue(live);

      const { handler: h, postMessage } = buildHandler(allCuratedSettings);
      await h.sendModelData();

      const option = getPayload(postMessage).options.find(o => o.id === CURATED_ID)!;
      expect(option.releaseDate).toBeUndefined();     // 0 is not 1970-01-01
      expect(option.pricingAvailable).toBe(true);      // pricing still resolves
    });

    it('injects a custom option for a selected model that is not in the curated list', async () => {
      jest.spyOn(OpenRouterModels, 'getRecommendedModels').mockReturnValue(recommended as any);
      jest.spyOn(OpenRouterModels, 'fetchModels').mockResolvedValue([]);

      const { handler: h, postMessage } = buildHandler({
        ...allCuratedSettings,
        assistantModel: 'custom/model-x'
      });
      await h.sendModelData();

      const payload = getPayload(postMessage);
      const custom = payload.options.find(o => o.id === 'custom/model-x');
      expect(custom).toBeDefined();
      expect(custom!.label).toBe('custom/model-x');
      expect(custom!.description).toBe('Custom model (from settings)');
      // categoryOptions is always sent alongside options.
      expect(Array.isArray(payload.categoryOptions)).toBe(true);
      expect(payload.categoryOptions!.length).toBeGreaterThan(0);
    });

    it('busts the cache only on explicit refresh (refresh point is browser-open)', async () => {
      jest.spyOn(OpenRouterModels, 'getRecommendedModels').mockReturnValue(recommended as any);
      jest.spyOn(OpenRouterModels, 'fetchModels').mockResolvedValue([]);
      const clearCache = jest.spyOn(OpenRouterModels, 'clearCache').mockImplementation(() => {});

      const { handler: h } = buildHandler(allCuratedSettings);

      await h.sendModelData();                       // selection / mount path
      expect(clearCache).not.toHaveBeenCalled();

      await h.sendModelData({ refreshCatalog: true }); // browser-open path
      expect(clearCache).toHaveBeenCalledTimes(1);
    });
  });
});
