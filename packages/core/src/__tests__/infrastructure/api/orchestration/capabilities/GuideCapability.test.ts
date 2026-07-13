import { GuideCapability } from '@orchestration/capabilities/GuideCapability';

describe('GuideCapability', () => {
  const registry = {
    listAvailableGuides: jest.fn().mockResolvedValue([{ path: 'dialogue.md', displayName: 'Dialogue', category: 'Craft' }]),
    formatGuideListForPrompt: jest.fn().mockReturnValue('Guide catalog')
  };
  const loader = { loadGuide: jest.fn().mockResolvedValue('Guide body') };
  const settings = { get: jest.fn((_section, _key, fallback) => fallback) };

  beforeEach(() => jest.clearAllMocks());

  it('accepts allow-listed tail-exact XML requests and fulfills guides with provenance', async () => {
    const adapter = new GuideCapability(registry as never, loader as never, settings as never);
    const catalog = await adapter.appendContract('Analyze this.');
    expect(catalog).toContain('<prose-minion-tool-call name="resource.read">');
    expect(catalog).toContain('<path>dialogue.md</path>');
    expect(adapter.inspectRequest('<prose-minion-tool-call name="resource.read"><paths><path>dialogue.md</path></paths></prose-minion-tool-call>')).toEqual({ kind: 'request', request: { operation: 'resource.read', paths: ['dialogue.md'] } });
    expect(adapter.inspectRequest('<prose-minion-tool-call name="resource.read"><paths><path>../secrets.md</path></paths></prose-minion-tool-call>')).toEqual({
      kind: 'invalid', reason: 'path-not-allowlisted', pathCount: 1, allowlistedPathCount: 0
    });
    expect(adapter.inspectRequest('<prose-minion-tool-call name="resource.read"><paths></paths></prose-minion-tool-call>')).toMatchObject({ kind: 'invalid', reason: 'empty-path' });
    expect(adapter.inspectRequest('Need this: <prose-minion-tool-call name="resource.read"><paths><path>dialogue.md</path></paths></prose-minion-tool-call>')).toMatchObject({ kind: 'request' });
    expect(adapter.inspectRequest('<prose-minion-tool-call name="resource.read"><paths><path>dialogue.md</path></paths></prose-minion-tool-call> Then I will answer.')).toMatchObject({ kind: 'invalid', reason: 'mixed-content' });
    expect(adapter.statusTicker({ operation: 'resource.read', paths: ['scene-example-guides/campfire-stories.md', 'dialogue-tags.md'] }))
      .toBe('Campfire Stories, Dialogue Tags');
    expect(adapter.invalidRequestInstruction({ kind: 'invalid', reason: 'mixed-content', pathCount: 2 }))
      .toContain('resubmit the intended request now as one bare XML document');

    const fulfillment = await adapter.fulfill({ operation: 'resource.read', paths: ['dialogue.md'] });
    expect(loader.loadGuide).toHaveBeenCalledWith('dialogue.md');
    expect(fulfillment.artifacts).toEqual([expect.objectContaining({ id: 'dialogue.md', category: 'Craft' })]);
    expect(fulfillment.evidence).toContain('Guide body');
  });

  it('reports a guide that fails to load in the model evidence instead of dropping it silently', async () => {
    loader.loadGuide.mockRejectedValueOnce(new Error('EACCES: permission denied'));
    const adapter = new GuideCapability(registry as never, loader as never, settings as never);
    await adapter.appendContract('Analyze this.');

    const fulfillment = await adapter.fulfill({ operation: 'resource.read', paths: ['dialogue.md'] });

    expect(fulfillment.deliveredItems).toEqual([]);
    expect(fulfillment.artifacts).toEqual([]);
    expect(fulfillment.evidence).toContain('dialogue.md');
    expect(fulfillment.evidence).toContain('continue without');
  });
});
