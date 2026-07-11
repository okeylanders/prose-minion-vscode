import { ContextFileCapability } from '@orchestration/capabilities/ContextFileCapability';

describe('ContextFileCapability', () => {
  const provider = {
    listResources: jest.fn().mockReturnValue([{ group: 'characters', path: 'characters/mara.md', label: 'Mara' }]),
    loadResources: jest.fn().mockResolvedValue([{ group: 'characters', path: 'characters/mara.md', label: 'Mara', content: 'Mara is tired.' }])
  };
  const settings = { get: jest.fn((_section, _key, fallback) => fallback) };

  beforeEach(() => jest.clearAllMocks());

  it('uses only configured project-context resources and records compact provenance', async () => {
    const adapter = new ContextFileCapability(provider as never, settings as never);
    const catalog = await adapter.appendCatalog('Brief');
    expect(catalog).toContain('characters/mara.md');
    expect(catalog).toContain('<prose-minion-tool-call name="resource.read">');
    expect(catalog).toContain('<path>characters/mara.md</path>');
    expect(adapter.inspectRequest('<prose-minion-tool-call name="resource.read"><paths><path>characters/mara.md</path></paths></prose-minion-tool-call>')).toEqual({ kind: 'request', request: { operation: 'resource.read', paths: ['characters/mara.md'] } });
    expect(adapter.inspectRequest('<prose-minion-tool-call name="resource.read"><paths></paths></prose-minion-tool-call>')).toMatchObject({ kind: 'invalid', reason: 'empty-path' });
    expect(adapter.inspectRequest('<prose-minion-tool-call name="resource.read"><paths><path>characters/mara.md</path></paths></prose-minion-tool-call> Explain it')).toMatchObject({ kind: 'invalid' });

    const fulfillment = await adapter.fulfill(['characters/mara.md']);
    expect(provider.loadResources).toHaveBeenCalledWith(['characters/mara.md']);
    expect(fulfillment.artifacts).toEqual([expect.objectContaining({ catalog: 'projectContext', category: 'characters', path: 'characters/mara.md' })]);
    expect(fulfillment.evidence).toContain('Mara is tired.');
  });

  it('owns stable projectBrief-first catalog ordering, labels, the cap, and one XML instruction', async () => {
    const resources = [
      { group: 'characters' as const, path: 'characters/mara.md', label: 'Mara', workspaceFolder: 'novel' },
      { group: 'projectBrief' as const, path: 'story-overview.md', label: 'Story Overview' },
      { group: 'general' as const, path: 'style.md', label: 'style.md' },
      ...Array.from({ length: 99 }, (_, index) => ({
        group: 'chapters' as const,
        path: `chapters/${index}.md`,
        label: `Chapter ${index}`
      }))
    ];
    provider.listResources.mockReturnValueOnce(resources);
    const adapter = new ContextFileCapability(provider as never, settings as never);

    const catalog = await adapter.appendCatalog('Semantic context request');

    expect(catalog.indexOf('story-overview.md')).toBeLessThan(catalog.indexOf('characters/mara.md'));
    expect(catalog).toContain('- [characters] `characters/mara.md` — Mara (workspace: novel)');
    expect(catalog.match(/- \[/g)).toHaveLength(100);
    expect(catalog).toContain('...and 2 additional resource(s) not listed to save tokens.');
    expect(catalog.match(/## Resource Request Protocol/g)).toHaveLength(1);
    expect(catalog.match(/<prose-minion-tool-call name="resource.read">/g)).toHaveLength(1);
    expect(catalog).toContain('<path>story-overview.md</path>');
    expect(adapter.inspectRequest('<prose-minion-tool-call name="resource.read"><paths><path>chapters/98.md</path></paths></prose-minion-tool-call>')).toEqual({
      kind: 'invalid', reason: 'path-not-allowlisted', pathCount: 1, allowlistedPathCount: 0
    });
  });

  it('rejects paths outside its displayed catalog and never turns extra provider output into evidence', async () => {
    const adapter = new ContextFileCapability(provider as never, settings as never);
    await adapter.appendCatalog('Brief');

    const rejected = await adapter.fulfill(['outside.md']);
    expect(rejected.deliveredPaths).toEqual([]);
    expect(rejected.evidence).toContain('rejected');
    expect(provider.loadResources).not.toHaveBeenCalledWith(['outside.md']);

    provider.loadResources.mockResolvedValueOnce([
      { group: 'characters', path: 'characters/mara.md', label: 'Mara', content: 'Mara is tired.' },
      { group: 'characters', path: 'outside.md', label: 'Outside', content: 'Never show this.' }
    ]);
    const fulfillment = await adapter.fulfill(['characters/mara.md']);
    expect(fulfillment.deliveredPaths).toEqual(['characters/mara.md']);
    expect(fulfillment.evidence).not.toContain('Never show this.');
    expect(fulfillment.artifacts).toHaveLength(1);
  });

  it('describes an empty catalog and preserves missing-path and trimming limit behavior', async () => {
    provider.listResources.mockReturnValueOnce([]);
    const emptyAdapter = new ContextFileCapability(provider as never, settings as never);
    const emptyCatalog = await emptyAdapter.appendCatalog('Brief');
    expect(emptyCatalog).toContain('No project references matched');
    expect(emptyCatalog.match(/## Resource Request Protocol/g)).toHaveLength(1);

    const missingAdapter = new ContextFileCapability(provider as never, settings as never);
    await missingAdapter.appendCatalog('Brief');
    provider.loadResources.mockResolvedValueOnce([]);
    await expect(missingAdapter.fulfill(['characters/mara.md'])).resolves.toMatchObject({
      evidence: expect.stringContaining('characters/mara.md'),
      deliveredPaths: []
    });

    const largeProvider = {
      listResources: () => [{ group: 'general', path: 'large.md', label: 'Large' }],
      loadResources: async () => [{ group: 'general', path: 'large.md', label: 'Large', content: 'word '.repeat(50_001) }]
    };
    const trimmingAdapter = new ContextFileCapability(largeProvider as never, settings as never);
    await trimmingAdapter.appendCatalog('Brief');
    const trimmed = await trimmingAdapter.fulfill(['large.md']);
    expect(trimmed.evidence).toContain('combined evidence was trimmed to fit the context window');
    expect(trimmed.artifacts).toEqual([expect.objectContaining({ path: 'large.md', size: 250_005 })]);
  });
});
