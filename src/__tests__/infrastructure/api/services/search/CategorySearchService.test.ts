import { CategorySearchService } from '@services/search/CategorySearchService';
import { WordSearchService } from '@services/search/WordSearchService';

jest.mock('../../../../../tools/shared/prompts', () => ({
  PromptLoader: jest.fn().mockImplementation(() => ({
    loadPrompts: jest.fn().mockResolvedValue('SYSTEM_PROMPT')
  }))
}));

describe('CategorySearchService', () => {
  const outputChannel = { appendLine: jest.fn() } as any;

  const createService = (
    overrides?: {
      orchestratorResponse?: { content: string; usage?: any };
      wordSearchResult?: any;
      orchestratorImpl?: any;
    }
  ) => {
    const orchestrator = overrides?.orchestratorImpl || {
      executeWithoutCapabilities: jest.fn().mockResolvedValue(
        overrides?.orchestratorResponse || { content: '["apple","pear"]' }
      )
    };

    const aiResourceManager = {
      getOrchestrator: jest.fn().mockReturnValue(orchestrator)
    } as any;

    const statusEmitter = jest.fn();

    const wordSearchService = {
      searchWords: jest.fn().mockResolvedValue(
        overrides?.wordSearchResult ?? {
          metrics: {
            scannedFiles: [],
            options: {},
            targets: []
          }
        }
      )
    } as unknown as WordSearchService;

    const service = new CategorySearchService(
      aiResourceManager,
      wordSearchService,
      {} as any,
      outputChannel,
      statusEmitter
    );

    return { service, orchestrator, wordSearchService, statusEmitter };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters hallucinated words before returning results', async () => {
    const { service, wordSearchService } = createService({
      orchestratorResponse: { content: '["apple","pear","berry"]' },
      wordSearchResult: {
        metrics: {
          scannedFiles: [],
          options: {},
          targets: [
            { target: 'apple', normalized: 'apple', totalOccurrences: 3, perFile: [] },
            { target: 'pear', normalized: 'pear', totalOccurrences: 0, perFile: [] },
            { target: 'berry', normalized: 'berry', totalOccurrences: 2, perFile: [] }
          ]
        }
      }
    });

    const result = await service.searchByCategory('fruit', 'apple pear berry apple', undefined, 'selection');

    expect(wordSearchService.searchWords).toHaveBeenCalled();
    expect(result.matchedWords).toEqual(['apple', 'berry']);
    expect(result.wordSearchResult.targets).toEqual([
      { target: 'apple', normalized: 'apple', totalOccurrences: 3, perFile: [] },
      { target: 'berry', normalized: 'berry', totalOccurrences: 2, perFile: [] }
    ]);
    expect(result.error).toBeUndefined();
  });

  it('chunks large unique word lists to avoid token overflows', async () => {
    const { service, orchestrator, statusEmitter } = createService({
      orchestratorResponse: { content: '["a","b"]', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } }
    });

    const alphabet = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));
    const uniqueWords = Array.from({ length: 900 }, (_, i) => {
      // Build purely alphabetic tokens so WordFrequency keeps them (digits are stripped)
      const a = alphabet[i % 26];
      const b = alphabet[Math.floor(i / 26) % 26];
      const c = alphabet[Math.floor(i / (26 * 26)) % 26];
      return `w${c}${b}${a}`;
    });
    const largeText = uniqueWords.join(' ');
    const result = await service.searchByCategory('anything', largeText, undefined, 'selection');

    // 900 unique words with batch size 400 => 3 calls
    expect(orchestrator.executeWithoutCapabilities).toHaveBeenCalledTimes(3);
    expect(result.tokensUsed?.total).toBe(45); // aggregated across batches
    expect(statusEmitter).toHaveBeenCalledWith(expect.stringContaining('Total unique words: 900'));
    expect(statusEmitter).toHaveBeenCalledWith(expect.stringContaining('Batch 1/3'));
    expect(statusEmitter).toHaveBeenCalledWith(expect.stringContaining('matched 2 words (accumulated'));
    expect(statusEmitter).toHaveBeenCalledWith(expect.stringContaining('Batch 2/3'));
    expect(statusEmitter).toHaveBeenCalledWith(expect.stringContaining('Batch 3/3'));
  });

  it('returns error message when no words are available to search', async () => {
    const { service, wordSearchService } = createService();
    const result = await service.searchByCategory('empty', '', undefined, 'selection');

    expect(wordSearchService.searchWords).not.toHaveBeenCalled();
    expect(result.error).toBe('No words found in text after filtering');
    expect(result.matchedWords).toEqual([]);
  });

  it('includes warning when batches fail', async () => {
    const failingOrchestrator = {
      executeWithoutCapabilities: jest.fn().mockRejectedValue(new Error('boom'))
    };
    const { service } = createService({ orchestratorImpl: failingOrchestrator });
    const result = await service.searchByCategory('fruit', 'apple orange pear', undefined, 'selection');

    expect(failingOrchestrator.executeWithoutCapabilities).toHaveBeenCalled();
    expect(result.warnings).toEqual(['Some batches failed; results may be incomplete.']);
  });

  it('halts early when hitting word limit and reports warning', async () => {
    // Mock AI returning 25 words (more than limit of 20)
    const words = Array.from({ length: 25 }, (_, i) => `word${i}`);
    const { service } = createService({
      orchestratorResponse: { content: JSON.stringify(words) }
    });

    const result = await service.searchByCategory(
      'fruit',
      'apple pear berry banana orange',
      undefined,
      'selection',
      { wordLimit: 20 }
    );

    expect(result.haltedEarly).toBe(true);
    expect(result.warnings?.[0]).toContain('Stopped after reaching word limit');
    expect(result.warnings?.[0]).toContain('narrow relevance');
  });
});
