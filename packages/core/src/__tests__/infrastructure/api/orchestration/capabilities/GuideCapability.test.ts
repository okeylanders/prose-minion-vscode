import { GuideCapability } from '@orchestration/capabilities/GuideCapability';

describe('GuideCapability', () => {
  const registry = {
    listAvailableGuides: jest.fn().mockResolvedValue([{ path: 'dialogue.md', displayName: 'Dialogue', category: 'Craft' }]),
    formatGuideListForPrompt: jest.fn().mockReturnValue('Guide catalog')
  };
  const loader = { loadGuide: jest.fn().mockResolvedValue('Guide body') };
  const settings = { get: jest.fn((_section, _key, fallback) => fallback) };

  beforeEach(() => jest.clearAllMocks());

  it('accepts only whole directives and fulfills only catalog allow-listed guides with provenance', async () => {
    const adapter = new GuideCapability(registry as never, loader as never, settings as never);
    expect(adapter.parseExactDirective('<guide-request path=["dialogue.md"] />')).toEqual(['dialogue.md']);
    expect(adapter.parseExactDirective('<guide-request path=[] />')).toBeUndefined();
    expect(adapter.parseExactDirective('Need this: <guide-request path=["dialogue.md"] />')).toBeUndefined();

    const fulfillment = await adapter.fulfill(['dialogue.md', '../secrets.md']);
    expect(loader.loadGuide).toHaveBeenCalledWith('dialogue.md');
    expect(loader.loadGuide).not.toHaveBeenCalledWith('../secrets.md');
    expect(fulfillment.artifacts).toEqual([expect.objectContaining({ path: 'dialogue.md', category: 'Craft' })]);
    expect(fulfillment.evidence).toContain('Guide body');
  });
});
