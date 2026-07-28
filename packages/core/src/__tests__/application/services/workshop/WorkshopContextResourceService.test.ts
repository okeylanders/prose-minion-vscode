import {
  WorkshopContextResourceService
} from '@/application/services/workshop/WorkshopContextResourceService';

describe('WorkshopContextResourceService', () => {
  const summary = {
    group: 'characters',
    path: 'Characters/raven.md',
    label: 'Raven',
    sizeBytes: 32,
    absolutePath: '/workspace/Characters/raven.md'
  };

  const factory = (content: string, sizeBytes = summary.sizeBytes) => ({
    createProvider: jest.fn(async () => ({
      listResources: () => [{ ...summary, sizeBytes }],
      loadResources: jest.fn(async () => [{ ...summary, sizeBytes, content }])
    }))
  });

  it('opens a fresh catalog for each interaction instead of retaining workspace metadata', async () => {
    const providerFactory = factory('First version.');
    const service = new WorkshopContextResourceService(providerFactory as never);

    await service.openCatalog();
    await service.openCatalog();

    expect(providerFactory.createProvider).toHaveBeenCalledTimes(2);
  });

  it('rejects oversized resources before reading their content', async () => {
    const providerFactory = factory('Never read.', 101);
    const service = new WorkshopContextResourceService(providerFactory as never);
    const catalog = await service.openCatalog();

    await expect(catalog.load(
      { group: 'characters', path: 'Characters/raven.md' },
      { maxBytes: 100, maxWords: 100 }
    )).resolves.toMatchObject({ kind: 'too-large', summary: { path: 'Characters/raven.md' } });
    const provider = await providerFactory.createProvider.mock.results[0].value;
    expect(provider.loadResources).not.toHaveBeenCalled();
  });

  it('trims loaded text to the requested word bound and retains a source fingerprint', async () => {
    const service = new WorkshopContextResourceService(factory('one two three four') as never);
    const catalog = await service.openCatalog();

    await expect(catalog.load(
      { group: 'characters', path: 'Characters/raven.md' },
      { maxBytes: 100, maxWords: 2 }
    )).resolves.toEqual(expect.objectContaining({
      kind: 'loaded',
      resource: expect.objectContaining({
        text: 'one two',
        words: 2,
        sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        truncation: { keptWords: 2, totalWords: 4 }
      })
    }));
  });
});
