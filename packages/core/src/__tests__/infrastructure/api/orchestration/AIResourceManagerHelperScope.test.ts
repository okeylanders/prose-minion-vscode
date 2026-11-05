/**
 * The helper's model scope in the shared manager (ADR 2026-11-05 D3): an
 * engine of its own, on Proofread's model while the writer has picked none,
 * moving when Proofread's does; picked, its own. Model ids are placeholders.
 */
import { AIResourceManager } from '@orchestration/AIResourceManager';
import { DEFAULT_PROOFREAD_MODEL } from '@orchestration/ModelScopeSelections';

const PROOFREAD = 'placeholder/proofread-model';
const HELPER = 'placeholder/helper-model';

function managerOf(configured: Record<string, string | undefined>, apiKey: string | null = 'key') {
  return new AIResourceManager(
    { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
    { getApiKey: jest.fn().mockResolvedValue(apiKey ?? undefined) } as never,
    { get: jest.fn((_section, key, fallback) => configured[key] ?? fallback) } as never,
    { createProvider: jest.fn() } as never
  );
}

describe('AIResourceManager: the helper scope (ADR 2026-11-05 D3)', () => {
  it('builds an engine of its own, on Proofread\'s default while neither has a model', async () => {
    const manager = managerOf({});
    await manager.ensureInitialized();
    const helper = manager.getEngine('helper');
    expect(helper).toBeDefined();
    expect(helper).not.toBe(manager.getEngine('proofread'));
    expect(helper).not.toBe(manager.getEngine('assistant'));
    expect(helper?.getModel()).toBe(DEFAULT_PROOFREAD_MODEL);
    manager.dispose();
  });

  it('follows a Proofread pick in place, and never the assistant model', async () => {
    const configured: Record<string, string | undefined> = { proofreadModel: PROOFREAD };
    const manager = managerOf(configured);
    await manager.ensureInitialized();
    const helper = manager.getEngine('helper');
    expect(helper?.getModel()).toBe(PROOFREAD);

    configured.proofreadModel = 'placeholder/proofread-model-next';
    configured.assistantModel = 'placeholder/workshop-model';
    await manager.refreshModelSelections();
    expect(manager.getEngine('helper')).toBe(helper);
    expect(helper?.getModel()).toBe('placeholder/proofread-model-next');
    manager.dispose();
  });

  it('keeps its own model once picked: Proofread never moves it, nor it Proofread', async () => {
    const configured: Record<string, string | undefined> = { proofreadModel: PROOFREAD, helperModel: HELPER };
    const manager = managerOf(configured);
    await manager.ensureInitialized();
    expect(manager.getEngine('helper')?.getModel()).toBe(HELPER);

    configured.proofreadModel = 'placeholder/proofread-model-next';
    await manager.refreshModelSelections();
    expect(manager.getEngine('helper')?.getModel()).toBe(HELPER);
    expect(manager.getEngine('proofread')?.getModel()).toBe('placeholder/proofread-model-next');

    configured.helperModel = '';
    await manager.refreshModelSelections();
    expect(manager.getEngine('helper')?.getModel()).toBe('placeholder/proofread-model-next');
    manager.dispose();
  });

  it('has no engine without an API key, but still resolves its model', async () => {
    const manager = managerOf({ proofreadModel: PROOFREAD }, null);
    await manager.ensureInitialized();
    expect(manager.getEngine('helper')).toBeUndefined();
    expect(manager.getResolvedModel('helper')).toBe(PROOFREAD);
    manager.dispose();
  });
});
