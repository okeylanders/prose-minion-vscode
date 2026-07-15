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

  it('caps literal search matches and reads returned paths', async () => {
    const lines = Array.from({ length: PROMPT_BUDGETS.workshopResource.searchMatches + 5 },
      (_, index) => `Threshold match ${index + 1}`
    ).join('\n');
    loadResources.mockResolvedValue([{ ...summary, content: lines }]);

    const search = await capability.fulfill({
      capability: 'resource.search',
      query: 'Threshold',
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

  it('reads any configured path directly and resolves unique path casing canonically', async () => {
    const canonical = {
      group: 'characters' as const,
      path: 'Characters/Micah/micah-voice-guide.md',
      label: 'Micah Voice Guide'
    };
    listResources.mockReturnValue([canonical]);
    loadResources.mockResolvedValue([{ ...canonical, content: 'Dude is conversational punctuation.' }]);

    const result = await capability.fulfill({
      capability: 'resource.read',
      group: 'characters',
      path: 'characters/Micah/micah-voice-guide.md'
    });

    expect(result.status).toBe('success');
    expect(result.requestSummary).toBe(canonical.path);
    expect(result.metadata).toMatchObject({ path: canonical.path });
    expect(result.content).toContain('Dude is conversational punctuation.');
    expect(loadResources).toHaveBeenCalledWith([canonical.path]);
  });

  it('rejects an ambiguous case-insensitive path instead of choosing one', async () => {
    listResources.mockReturnValue([
      { ...summary, path: 'Characters/Micah.md' },
      { ...summary, path: 'characters/micah.md' }
    ]);

    const result = await capability.fulfill({
      capability: 'resource.read',
      group: 'characters',
      path: 'CHARACTERS/MICAH.MD'
    });

    expect(result).toMatchObject({ status: 'rejected' });
    expect(result.error).toContain('more than one configured resource');
    expect(loadResources).not.toHaveBeenCalled();
  });

  it('searches catalog paths and labels directly without loading the full group', async () => {
    const summaries = ['Micah', 'Jasper', 'Ava', 'Nate', 'Raven', 'Savannah'].map(label => ({
      group: 'characters' as const,
      path: `characters/${label.toLowerCase()}.md`,
      label
    }));
    listResources.mockReturnValue(summaries);
    loadResources.mockResolvedValue([{ ...summaries[0], content: 'Micah deflects with humor.' }]);

    const search = await capability.fulfill({
      capability: 'resource.search',
      query: 'Micah, Jasper, Ava, and Nate character guides',
      group: 'characters'
    });

    expect(search).toMatchObject({
      status: 'success',
      metadata: {
        searchMode: 'catalog',
        catalogEntriesScanned: 6,
        filesScanned: 0,
        bytesScanned: 0,
        matchCount: 4,
        truncated: false
      }
    });
    expect(search.content).toContain('characters/micah.md');
    expect(search.content).toContain('characters/jasper.md');
    expect(search.content).toContain('characters/ava.md');
    expect(search.content).toContain('characters/nate.md');
    expect(search.content).not.toContain('characters/raven.md');
    expect(search.content).not.toContain('characters/savannah.md');
    expect(loadResources).not.toHaveBeenCalled();

    const read = await capability.fulfill({
      capability: 'resource.read',
      group: 'characters',
      path: 'characters/micah.md'
    });
    expect(read.status).toBe('success');
    expect(loadResources).toHaveBeenCalledWith(['characters/micah.md']);
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

  it('applies the default line window before the hard byte limit', async () => {
    const content = Array.from(
      { length: PROMPT_BUDGETS.workshopResource.readDefaultLines + 5 },
      (_, index) => `Line ${index + 1}`
    ).join('\n');
    loadResources.mockResolvedValue([{ ...summary, content }]);

    const result = await capability.fulfill({
      capability: 'resource.read',
      group: 'characters',
      path: 'characters/raven.md'
    });

    expect(result.metadata).toMatchObject({
      startLine: 1,
      endLine: PROMPT_BUDGETS.workshopResource.readDefaultLines,
      totalLines: PROMPT_BUDGETS.workshopResource.readDefaultLines + 5,
      defaultLineWindow: true,
      truncated: false
    });
    expect(result.content).toContain(`Line ${PROMPT_BUDGETS.workshopResource.readDefaultLines}`);
    expect(result.content).not.toContain(`Line ${PROMPT_BUDGETS.workshopResource.readDefaultLines + 1}`);
  });

  it('reads an inclusive requested line window', async () => {
    const content = Array.from({ length: 100 }, (_, index) => `Line ${index + 1}`).join('\n');
    loadResources.mockResolvedValue([{ ...summary, content }]);

    const result = await capability.fulfill({
      capability: 'resource.read',
      group: 'characters',
      path: 'characters/raven.md',
      startLine: 41,
      endLine: 45
    });

    expect(result.metadata).toMatchObject({
      startLine: 41,
      endLine: 45,
      requestedEndLine: 45,
      totalLines: 100,
      defaultLineWindow: false,
      truncated: false
    });
    expect(result.content).toContain('Line 41');
    expect(result.content).toContain('Line 45');
    expect(result.content).not.toContain('Line 40');
    expect(result.content).not.toContain('Line 46');
  });

  it('enforces the shared byte ceiling even when a larger line window is requested', async () => {
    const largeContent = 'a'.repeat(PROMPT_BUDGETS.workshopResource.readBytes + 50);
    loadResources.mockResolvedValue([{ ...summary, content: largeContent }]);

    const result = await capability.fulfill({
      capability: 'resource.read',
      group: 'characters',
      path: 'characters/raven.md',
      startLine: 1,
      endLine: 2_000
    });

    expect(result.metadata).toMatchObject({
      bytes: PROMPT_BUDGETS.workshopResource.readBytes,
      totalBytes: PROMPT_BUDGETS.workshopResource.readBytes + 50,
      truncated: true
    });
    expect(result.content).toContain(`${PROMPT_BUDGETS.workshopResource.readBytes}-byte ceiling`);
  });

  it('rejects paths outside the configured catalog and ignores unrequested provider output', async () => {
    const unknown = await capability.fulfill({
      capability: 'resource.read',
      group: 'characters',
      path: 'characters/unknown.md'
    });
    expect(unknown).toMatchObject({ status: 'rejected' });
    expect(unknown.error).toContain('configured project resources');
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

    await expect(capability.fulfill({ capability: 'resource.search', query: 'waits' }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(loadResources).toHaveBeenCalledTimes(1);
  });
});
