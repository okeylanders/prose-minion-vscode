/**
 * Passage Search's model scope in the shared manager (ADR 2026-11-20 D14,
 * D7): an engine of its own, on Category Search's model while the writer has
 * picked none; and, through the production manager and run engine, a key
 * change mid-run that stops the search starting calls. The provider's
 * transport is the only stand-in. Model ids and keys are placeholders, and
 * the text adapts *Alice*.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  // One at a time, in order, so the second call starts only after the key change.
  default: () => {
    let chain: Promise<unknown> = Promise.resolve();
    return (fn: () => Promise<unknown>) => {
      const run = chain.then(fn);
      chain = run.catch(() => undefined);
      return run;
    };
  }
}));

import { AIResourceManager } from '@orchestration/AIResourceManager';
import { DEFAULT_CATEGORY_MODEL } from '@providers/OpenRouterModels';
import { OpenRouterClient } from '@providers/OpenRouterClient';
import { PassageSearchService } from '@services/search/passage/PassageSearchService';
import {
  QUEEN_CHAPTER,
  QUESTION,
  RABBIT_CHAPTER,
  replyOf,
  sourceFile
} from '@/__tests__/infrastructure/api/services/search/passage/passageSearchFixtures';

const CATEGORY = 'placeholder/category-model';
const PASSAGE = 'placeholder/passage-model';

function managerOf(configured: Record<string, string | undefined>, apiKey: string | null = 'sk-placeholder') {
  return new AIResourceManager(
    { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
    { getApiKey: jest.fn().mockResolvedValue(apiKey ?? undefined) } as never,
    { get: jest.fn((_section, key, fallback) => configured[key] ?? fallback) } as never,
    { createProvider: jest.fn() } as never
  );
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AIResourceManager: the passageSearch scope (ADR 2026-11-20 D14)', () => {
  it('builds an engine of its own, on Category Search\'s default while neither has a model', async () => {
    const manager = managerOf({});
    await manager.ensureInitialized();
    const engine = manager.getEngine('passageSearch');
    expect(engine).toBeDefined();
    expect(engine).not.toBe(manager.getEngine('category'));
    expect(engine?.getModel()).toBe(DEFAULT_CATEGORY_MODEL);
    manager.dispose();
  });

  it('follows a Category Search pick, and keeps its own model once picked', async () => {
    const configured: Record<string, string | undefined> = { categoryModel: CATEGORY };
    const manager = managerOf(configured);
    await manager.ensureInitialized();
    expect(manager.getEngine('passageSearch')?.getModel()).toBe(CATEGORY);

    configured.passageSearchModel = PASSAGE;
    configured.categoryModel = 'placeholder/category-model-next';
    await manager.refreshModelSelections();
    expect(manager.getEngine('passageSearch')?.getModel()).toBe(PASSAGE);
    expect(manager.getEngine('category')?.getModel()).toBe('placeholder/category-model-next');

    configured.passageSearchModel = '';
    await manager.refreshModelSelections();
    expect(manager.getEngine('passageSearch')?.getModel()).toBe('placeholder/category-model-next');
    manager.dispose();
  });

  it('has no engine without an API key, but still resolves its model', async () => {
    const manager = managerOf({ categoryModel: CATEGORY }, null);
    await manager.ensureInitialized();
    expect(manager.getEngine('passageSearch')).toBeUndefined();
    expect(manager.getResolvedModel('passageSearch')).toBe(CATEGORY);
    manager.dispose();
  });
});

describe('a Passage Search run through the production manager and engine (D7)', () => {
  it('starts no new call once the API key changes, keeps what finished, and ends key-changed', async () => {
    const manager = managerOf({ passageSearchModel: PASSAGE });
    const service = new PassageSearchService(
      manager,
      { loadPrompts: jest.fn(async () => 'SYSTEM') } as never,
      { facts: jest.fn(async () => ({})) },
      { appendLine: jest.fn() } as never
    );
    const model = await service.model();
    expect(model).toBe(PASSAGE);
    const planned = await service.plan({
      model: model!,
      question: QUESTION,
      organize: false,
      files: [sourceFile('chapters/1.md', RABBIT_CHAPTER), sourceFile('chapters/2.md', QUEEN_CHAPTER), sourceFile('chapters/3.md', RABBIT_CHAPTER)]
    });
    if (planned.kind !== 'planned') {
      throw new Error('expected a plan');
    }

    const requested: string[] = [];
    const complete = jest.spyOn(OpenRouterClient.prototype, 'createChatCompletion').mockImplementation(async (_messages, options) => {
      requested.push(String(options?.model));
      // The key is replaced while the first call is in flight: its bundle is rebuilt, and the held engine retired.
      await manager.refreshConfiguration();
      return {
        content: replyOf({ quote: 'took a watch out of its waistcoat-pocket' }),
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20, costUsd: 0.001 }
      };
    });

    const result = await service.run(planned.plan);

    expect(complete).toHaveBeenCalledTimes(1);
    expect(requested).toEqual([PASSAGE]);
    expect(result.ended).toBe('key-changed');
    expect(result.calls).toEqual({ planned: 3, answered: 1, failed: 0, cut: 0, cancelled: 0, unsent: 2 });
    expect(result.instances.map((instance) => instance.quote)).toEqual(['took a watch out of its waistcoat-pocket']);
    manager.dispose();
  });

  it('ends key-changed when the key changes with the last read already in flight, though no later call is refused (PR #293 F2)', async () => {
    const manager = managerOf({ passageSearchModel: PASSAGE });
    const organizer = { available: true, plan: jest.fn(), organize: jest.fn(async () => undefined) };
    const service = new PassageSearchService(
      manager,
      { loadPrompts: jest.fn(async () => 'SYSTEM') } as never,
      { facts: jest.fn(async () => ({})) },
      { appendLine: jest.fn() } as never,
      organizer as never
    );
    const planned = await service.plan({ model: PASSAGE, question: QUESTION, organize: true, files: [sourceFile('chapters/1.md', RABBIT_CHAPTER)] });
    if (planned.kind !== 'planned') {
      throw new Error('expected a plan');
    }
    const complete = jest.spyOn(OpenRouterClient.prototype, 'createChatCompletion').mockImplementation(async () => {
      await manager.refreshConfiguration();
      return {
        content: replyOf({ quote: 'took a watch out of its waistcoat-pocket' }),
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20, costUsd: 0.001 }
      };
    });

    const result = await service.run(planned.plan);

    expect(complete).toHaveBeenCalledTimes(1);
    expect(result.ended).toBe('key-changed');
    expect(result.calls).toEqual({ planned: 1, answered: 1, failed: 0, cut: 0, cancelled: 0, unsent: 0 });
    expect(result.instances).toHaveLength(1);
    expect(organizer.organize).not.toHaveBeenCalled();
    manager.dispose();
  });
});
