/**
 * DictionaryHandler Tests
 * Validates route registration for dictionary lookups
 */

import { DictionaryHandler } from '@/application/handlers/domain/DictionaryHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType } from '@/shared/types/messages';

describe('DictionaryHandler', () => {
  let handler: DictionaryHandler;
  let router: MessageRouter;
  let mockService: { lookupWordStreaming: jest.Mock; generateParallelDictionary: jest.Mock };

  beforeEach(() => {
    mockService = {
      lookupWordStreaming: jest.fn().mockResolvedValue({
        content: '# Entry', toolName: 'dictionary_lookup'
      }),
      generateParallelDictionary: jest.fn().mockResolvedValue({
        word: 'plosive', result: '# Entry',
        metadata: { totalDuration: 10, blockDurations: {}, partialFailures: [], successCount: 15, totalBlocks: 15 }
      })
    };
    const mockPostMessage = jest.fn().mockResolvedValue(undefined);

    handler = new DictionaryHandler(mockService as never, mockPostMessage);
    router = new MessageRouter();
  });

  describe('Route Registration', () => {
    it('should register LOOKUP_DICTIONARY route', () => {
      handler.registerRoutes(router);
      expect(router.hasHandler(MessageType.LOOKUP_DICTIONARY)).toBe(true);
    });

    it('should register at least 1 route', () => {
      handler.registerRoutes(router);
      expect(router.handlerCount).toBeGreaterThanOrEqual(1);
    });
  });

  it.each([true, false, undefined])('forwards encyclopedia=%s to streaming lookup', async includeEncyclopedia => {
    await handler.handleLookupDictionary({
      type: MessageType.LOOKUP_DICTIONARY,
      source: 'webview.dictionary',
      payload: { word: 'plosive', contextText: 'Compare consonant textures.', includeEncyclopedia },
      timestamp: 1
    });

    expect(mockService.lookupWordStreaming).toHaveBeenCalledWith(
      'plosive',
      'Compare consonant textures.',
      expect.any(Function),
      expect.any(AbortSignal),
      { includeEncyclopedia }
    );
  });

  it.each([true, false, undefined])('forwards encyclopedia=%s to Fast Generate', async includeEncyclopedia => {
    await handler.handleFastGenerate({
      type: MessageType.FAST_GENERATE_DICTIONARY,
      source: 'webview.dictionary',
      payload: { word: 'plosive', context: 'Compare consonant textures.', includeEncyclopedia },
      timestamp: 1
    });

    expect(mockService.generateParallelDictionary).toHaveBeenCalledWith(
      'plosive',
      'Compare consonant textures.',
      { includeEncyclopedia }
    );
  });
});
