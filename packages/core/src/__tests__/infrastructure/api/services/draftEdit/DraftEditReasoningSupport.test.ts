/**
 * PR #181 F-01: a Draft Edit pass at reasoning `off` refuses a model the
 * catalog marks as always reasoning; any other level, or a catalog that
 * cannot say, sends as asked. Only `off` asks the catalog. Model ids are
 * placeholders; no provider is reached.
 */
import { REASONING_LEVELS } from '@/domain/models/ReasoningLevel';
import { OpenRouterModels } from '@providers/OpenRouterModels';
import { liveCatalogReasoning, refusesReasoningOff, type ReasoningCatalog } from '@services/draftEdit/DraftEditReasoningSupport';

const MODEL = 'test/model';

function catalogSaying(answer: boolean | undefined | Error): ReasoningCatalog & { alwaysReasons: jest.Mock } {
  return {
    alwaysReasons: jest.fn(async () => {
      if (answer instanceof Error) {
        throw answer;
      }
      return answer;
    })
  };
}

describe('refusesReasoningOff', () => {
  it('asks the catalog only at off', async () => {
    for (const level of REASONING_LEVELS.filter((each) => each !== 'off')) {
      const catalog = catalogSaying(true);
      const log = { appendLine: jest.fn() };

      await expect(refusesReasoningOff(level, MODEL, catalog, log as never, '[Proofread] chapter-01.md')).resolves.toBe(false);
      expect(catalog.alwaysReasons).not.toHaveBeenCalled();
      expect(log.appendLine).not.toHaveBeenCalled();
    }
  });

  it('refuses at off when the catalog marks the model as always reasoning, and says so', async () => {
    const catalog = catalogSaying(true);
    const log = { appendLine: jest.fn() };

    await expect(refusesReasoningOff('off', MODEL, catalog, log as never, '[Proofread] chapter-01.md')).resolves.toBe(true);
    expect(catalog.alwaysReasons).toHaveBeenCalledWith(MODEL);
    expect(log.appendLine).toHaveBeenCalledWith(
      '[Proofread] chapter-01.md: the model catalog says test/model always reasons, so reasoning off was refused and nothing was sent'
    );
  });

  it('sends off, silently, to a model the catalog says can stop reasoning', async () => {
    const log = { appendLine: jest.fn() };

    await expect(refusesReasoningOff('off', MODEL, catalogSaying(false), log as never, '[CraftFlags] chapter-01.md')).resolves.toBe(false);
    expect(log.appendLine).not.toHaveBeenCalled();
  });

  it('sends off as asked when the catalog cannot say, and logs that it could not', async () => {
    const log = { appendLine: jest.fn() };

    await expect(refusesReasoningOff('off', MODEL, catalogSaying(undefined), log as never, '[CraftFlags] chapter-01.md')).resolves.toBe(false);
    expect(log.appendLine.mock.calls).toEqual([
      ['[CraftFlags] chapter-01.md: the model catalog cannot say whether test/model can stop reasoning; reasoning off sent as asked']
    ]);
  });

  it('reads a catalog that fails as one that cannot say', async () => {
    const log = { appendLine: jest.fn() };

    await expect(refusesReasoningOff('off', MODEL, catalogSaying(new Error('catalog unreachable')), log as never, '[Proofread] selection')).resolves.toBe(false);
    expect(log.appendLine.mock.calls).toEqual([
      ['[Proofread] selection: the model catalog could not be read (catalog unreachable)'],
      ['[Proofread] selection: the model catalog cannot say whether test/model can stop reasoning; reasoning off sent as asked']
    ]);
  });
});

describe('liveCatalogReasoning', () => {
  const previousFetch = global.fetch;
  beforeEach(() => OpenRouterModels.clearCache());
  afterEach(() => { global.fetch = previousFetch; OpenRouterModels.clearCache(); });

  it('fetches the catalog once, and reads its marks', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [
        { id: 'test/always', reasoning: { mandatory: true } },
        { id: 'test/optional', reasoning: { mandatory: false } }
      ] })
    }) as never;
    const catalog = liveCatalogReasoning({ appendLine: jest.fn() } as never);

    await expect(catalog.alwaysReasons('test/always')).resolves.toBe(true);
    await expect(catalog.alwaysReasons('test/optional')).resolves.toBe(false);
    await expect(catalog.alwaysReasons('test/unlisted')).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
