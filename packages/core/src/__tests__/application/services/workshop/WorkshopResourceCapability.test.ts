import { WorkshopResourceCapability } from '@/application/services/workshop/WorkshopResourceCapability';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { ContextResourceProviderFactory } from '@/domain/models/ContextGeneration';
import type { LogSink } from '@/platform';

describe('WorkshopResourceCapability', () => {
  const summary = {
    group: 'characters' as const,
    path: 'characters/raven.md',
    label: 'Raven',
    workspaceFolder: 'novel'
  };
  let listResources: jest.Mock;
  let loadResources: jest.Mock;
  let factory: ContextResourceProviderFactory;
  let controller: AbortController;
  let capability: WorkshopResourceCapability;

  beforeEach(() => {
    listResources = jest.fn().mockReturnValue([summary]);
    loadResources = jest.fn().mockResolvedValue([{ ...summary, content: 'Raven waits.' }]);
    factory = {
      createProvider: jest.fn().mockResolvedValue({ listResources, loadResources })
    };
    controller = new AbortController();
    capability = new WorkshopResourceCapability(
      factory,
      { appendLine: jest.fn() } as unknown as LogSink,
      { requestId: 'host-1', personaId: 'jill', signal: controller.signal }
    );
  });

  it('reports bounded group availability and a display-safe catalog', async () => {
    listResources.mockReturnValue([
      summary,
      { group: 'characters', path: 'characters/mara.md', label: 'Mara' },
      { group: 'chapters', path: 'chapters/01.md', label: 'Chapter 1' }
    ]);

    expect(await capability.availability()).toEqual([
      { group: 'characters', fileCount: 2 },
      { group: 'chapters', fileCount: 1 }
    ]);
    const catalog = await capability.fulfill({ capability: 'resource.catalog', group: 'characters' });
    expect(catalog.content).toContain('[characters] `characters/raven.md` — Raven · workspace: novel');
    expect(catalog.content).toContain('[characters] `characters/mara.md` — Mara');
    expect(catalog.metadata).toMatchObject({ fileCount: 2, group: 'characters', truncated: false });
  });

  it('caps literal search matches and makes only returned paths readable', async () => {
    const lines = Array.from({ length: PROMPT_BUDGETS.workshopResource.searchMatches + 5 },
      (_, index) => `Raven match ${index + 1}`
    ).join('\n');
    loadResources.mockResolvedValue([{ ...summary, content: lines }]);

    const search = await capability.fulfill({
      capability: 'resource.search',
      query: 'Raven',
      group: 'characters'
    });
    expect(search.metadata).toMatchObject({
      filesScanned: 1,
      matchCount: PROMPT_BUDGETS.workshopResource.searchMatches,
      truncated: true
    });
    expect(search.content?.match(/### \[characters\]/g)).toHaveLength(
      PROMPT_BUDGETS.workshopResource.searchMatches
    );

    const read = await capability.fulfill({
      capability: 'resource.read',
      group: 'characters',
      path: 'characters/raven.md'
    });
    expect(read.status).toBe('success');
    expect(loadResources).toHaveBeenLastCalledWith(['characters/raven.md']);
  });

  it('reports omitted configured files when the search-file cap is reached', async () => {
    const summaries = Array.from(
      { length: PROMPT_BUDGETS.workshopResource.searchFiles + 1 },
      (_, index) => ({
        group: 'characters' as const,
        path: `characters/person-${index}.md`,
        label: `Person ${index}`
      })
    );
    listResources.mockReturnValue(summaries);
    loadResources.mockImplementation(async (paths: string[]) => paths.map(resourcePath => ({
      ...summaries.find(item => item.path === resourcePath)!,
      content: 'No match.'
    })));

    const result = await capability.fulfill({ capability: 'resource.search', query: 'Raven' });

    expect(result).toMatchObject({
      status: 'partial',
      metadata: {
        filesScanned: PROMPT_BUDGETS.workshopResource.searchFiles,
        configuredFiles: PROMPT_BUDGETS.workshopResource.searchFiles + 1,
        truncated: true
      }
    });
    expect(loadResources.mock.calls[0][0]).toHaveLength(PROMPT_BUDGETS.workshopResource.searchFiles);
  });

  it('head-slices reads at the shared byte limit and reports truncation provenance', async () => {
    const largeContent = 'a'.repeat(PROMPT_BUDGETS.workshopResource.readBytes + 50);
    loadResources.mockResolvedValue([{ ...summary, content: largeContent }]);
    await capability.fulfill({ capability: 'resource.catalog', group: 'characters' });

    const result = await capability.fulfill({
      capability: 'resource.read',
      group: 'characters',
      path: 'characters/raven.md'
    });

    expect(result.metadata).toMatchObject({
      bytes: PROMPT_BUDGETS.workshopResource.readBytes,
      totalBytes: PROMPT_BUDGETS.workshopResource.readBytes + 50,
      truncated: true
    });
    expect(result.content).toContain(`Read head slice: ${PROMPT_BUDGETS.workshopResource.readBytes}`);
  });

  it('rejects guessed paths and ignores provider output outside the configured catalog', async () => {
    const guessed = await capability.fulfill({
      capability: 'resource.read',
      group: 'characters',
      path: 'characters/raven.md'
    });
    expect(guessed).toMatchObject({ status: 'rejected' });
    expect(loadResources).not.toHaveBeenCalled();

    loadResources.mockResolvedValue([
      { ...summary, content: 'Allowed Raven evidence.' },
      { group: 'general', path: '../.env', label: 'Secret', content: 'TOKEN=never' }
    ]);
    const search = await capability.fulfill({ capability: 'resource.search', query: 'TOKEN' });
    expect(search.content).not.toContain('TOKEN=never');
    expect(search.metadata).toMatchObject({ matchCount: 0 });
  });

  it('cascades cancellation before provider I/O', async () => {
    controller.abort(new Error('writer cancelled'));
    await expect(capability.fulfill({ capability: 'resource.catalog' }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(factory.createProvider).not.toHaveBeenCalled();
  });

  it('cascades cancellation after resource I/O begins and before evidence is returned', async () => {
    loadResources.mockImplementationOnce(async () => {
      controller.abort(new Error('writer cancelled during search'));
      return [{ ...summary, content: 'Raven waits.' }];
    });

    await expect(capability.fulfill({ capability: 'resource.search', query: 'Raven' }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(loadResources).toHaveBeenCalledTimes(1);
  });
});
