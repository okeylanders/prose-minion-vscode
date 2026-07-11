import { GuideCapability } from '@orchestration/capabilities/GuideCapability';

describe('GuideCapability', () => {
  const registry = {
    listAvailableGuides: jest.fn().mockResolvedValue([{ path: 'dialogue.md', displayName: 'Dialogue', category: 'Craft' }]),
    formatGuideListForPrompt: jest.fn().mockReturnValue('Guide catalog')
  };
  const loader = { loadGuide: jest.fn().mockResolvedValue('Guide body') };
  const settings = { get: jest.fn((_section, _key, fallback) => fallback) };

  beforeEach(() => jest.clearAllMocks());

  it('accepts only whole allow-listed XML requests and fulfills guides with provenance', async () => {
    const adapter = new GuideCapability(registry as never, loader as never, settings as never);
    const catalog = await adapter.appendCatalog('Analyze this.');
    expect(catalog).toContain('<prose-minion-tool-call name="resource.read">');
    expect(adapter.parseExactRequest('<prose-minion-tool-call name="resource.read"><paths><path>dialogue.md</path></paths></prose-minion-tool-call>')).toEqual({ operation: 'resource.read', paths: ['dialogue.md'] });
    expect(adapter.parseExactRequest('<prose-minion-tool-call name="resource.read"><paths><path>../secrets.md</path></paths></prose-minion-tool-call>')).toBeUndefined();
    expect(adapter.parseExactRequest('<prose-minion-tool-call name="resource.read"><paths></paths></prose-minion-tool-call>')).toBeUndefined();
    expect(adapter.parseExactRequest('Need this: <prose-minion-tool-call name="resource.read"><paths><path>dialogue.md</path></paths></prose-minion-tool-call>')).toBeUndefined();

    const fulfillment = await adapter.fulfill(['dialogue.md']);
    expect(loader.loadGuide).toHaveBeenCalledWith('dialogue.md');
    expect(fulfillment.artifacts).toEqual([expect.objectContaining({ path: 'dialogue.md', category: 'Craft' })]);
    expect(fulfillment.evidence).toContain('Guide body');
  });
});
