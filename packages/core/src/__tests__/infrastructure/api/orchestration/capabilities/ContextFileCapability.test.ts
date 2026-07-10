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
    expect((await adapter.appendCatalog('Brief')).includes('characters/mara.md')).toBe(true);
    expect(adapter.parseExactDirective('<context-request path=["characters/mara.md"] />')).toEqual(['characters/mara.md']);
    expect(adapter.parseExactDirective('<context-request path=[] />')).toBeUndefined();
    expect(adapter.parseExactDirective('<context-request path=["characters/mara.md"] /> Explain it')).toBeUndefined();

    const fulfillment = await adapter.fulfill(['characters/mara.md']);
    expect(provider.loadResources).toHaveBeenCalledWith(['characters/mara.md']);
    expect(fulfillment.artifacts).toEqual([expect.objectContaining({ catalog: 'projectContext', category: 'characters', path: 'characters/mara.md' })]);
    expect(fulfillment.evidence).toContain('Mara is tired.');
  });
});
