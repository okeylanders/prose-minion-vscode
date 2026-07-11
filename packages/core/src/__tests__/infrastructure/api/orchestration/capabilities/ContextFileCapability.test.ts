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
    expect(adapter.parseExactRequest('<prose-minion-tool-call name="resource.read"><paths><path>characters/mara.md</path></paths></prose-minion-tool-call>')).toEqual({ operation: 'resource.read', paths: ['characters/mara.md'] });
    expect(adapter.parseExactRequest('<prose-minion-tool-call name="resource.read"><paths></paths></prose-minion-tool-call>')).toBeUndefined();
    expect(adapter.parseExactRequest('<prose-minion-tool-call name="resource.read"><paths><path>characters/mara.md</path></paths></prose-minion-tool-call> Explain it')).toBeUndefined();

    const fulfillment = await adapter.fulfill(['characters/mara.md']);
    expect(provider.loadResources).toHaveBeenCalledWith(['characters/mara.md']);
    expect(fulfillment.artifacts).toEqual([expect.objectContaining({ catalog: 'projectContext', category: 'characters', path: 'characters/mara.md' })]);
    expect(fulfillment.evidence).toContain('Mara is tired.');
  });
});
