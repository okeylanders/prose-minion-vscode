import {
  WorkshopConfiguredResourceLoadResult,
  WorkshopContextIntakeService
} from '@/application/services/workshop/WorkshopContextIntakeService';
import { FileType } from '@/platform';
import { createFakeFileSystem, createFakeWorkspace } from '../../../mocks/platform';
import { createHash } from 'crypto';

describe('WorkshopContextIntakeService', () => {
  const summary = {
    group: 'characters' as const,
    path: 'Characters/raven.md',
    label: 'Raven',
    sizeBytes: 32,
    absolutePath: '/workspace/Characters/raven.md'
  };

  const factory = (content: string | undefined, sizeBytes = summary.sizeBytes) => {
    const provider = {
      listResources: () => [{ ...summary, sizeBytes }],
      loadResources: jest.fn(async () => content === undefined
        ? []
        : [{ ...summary, sizeBytes, content }])
    };
    return {
      provider,
      providerFactory: { createProvider: jest.fn(async () => provider) }
    };
  };

  const serviceFor = (
    providerFactory: { createProvider: jest.Mock },
    fileSystem = createFakeFileSystem(),
    workspace = createFakeWorkspace()
  ) => new WorkshopContextIntakeService(providerFactory as never, fileSystem, workspace);

  it('opens a fresh catalog for each interaction instead of retaining workspace metadata', async () => {
    const { providerFactory } = factory('First version.');
    const service = serviceFor(providerFactory);

    await service.openCatalog();
    await service.openCatalog();

    expect(providerFactory.createProvider).toHaveBeenCalledTimes(2);
  });

  it('rejects oversized configured resources before reading their content', async () => {
    const { provider, providerFactory } = factory('Never read.', 101);
    const catalog = await serviceFor(providerFactory).openCatalog();

    await expect(catalog.load(
      { group: 'characters', path: 'Characters/raven.md' },
      { maxBytes: 100, maxWords: 100 }
    )).resolves.toMatchObject({ kind: 'too-large', summary: { path: 'Characters/raven.md' } });
    expect(provider.loadResources).not.toHaveBeenCalled();
  });

  it('preserves configured-load empty semantics when the provider omits the requested body', async () => {
    const { providerFactory } = factory(undefined);
    const catalog = await serviceFor(providerFactory).openCatalog();

    await expect(catalog.load(
      { group: 'characters', path: 'Characters/raven.md' },
      { maxBytes: 100, maxWords: 100 }
    )).resolves.toMatchObject({ kind: 'empty', summary });
  });

  it('returns missing when a configured resource left the fresh catalog', async () => {
    const { provider, providerFactory } = factory('body');
    const catalog = await serviceFor(providerFactory).openCatalog();

    await expect(catalog.load(
      { group: 'characters', path: 'Characters/missing.md' },
      { maxBytes: 100, maxWords: 100 }
    )).resolves.toEqual({ kind: 'missing' });
    expect(provider.loadResources).not.toHaveBeenCalled();
  });

  it('returns configured-resource read failures as data', async () => {
    const { provider, providerFactory } = factory('body');
    provider.loadResources.mockRejectedValueOnce(new Error('permission denied'));
    const catalog = await serviceFor(providerFactory).openCatalog();

    await expect(catalog.load(
      { group: 'characters', path: 'Characters/raven.md' },
      { maxBytes: 100, maxWords: 100 }
    )).resolves.toMatchObject({
      kind: 'unreadable',
      summary,
      details: 'permission denied'
    });
  });

  it('trims configured text to the requested word bound and retains a source fingerprint', async () => {
    const { providerFactory } = factory('one two three four');
    const catalog = await serviceFor(providerFactory).openCatalog();

    await expect(catalog.load(
      { group: 'characters', path: 'Characters/raven.md' },
      { maxBytes: 100, maxWords: 2 }
    )).resolves.toEqual(expect.objectContaining({
      kind: 'loaded',
      resource: expect.objectContaining({
        text: 'one two',
        words: 2,
        sourceFingerprint: createHash('sha256').update('one two three four').digest('hex'),
        truncation: { keptWords: 2, totalWords: 4 }
      })
    }));
  });

  it('creates display-safe workspace and external paths', () => {
    const { providerFactory } = factory('body');
    const workspace = createFakeWorkspace({
      asRelativePath: (filePath) => filePath.startsWith('/workspace/')
        ? filePath.slice('/workspace/'.length)
        : filePath
    });
    const service = serviceFor(providerFactory, createFakeFileSystem(), workspace);

    expect(service.toDisplayPath('/workspace/Chapters/one.md')).toBe('Chapters/one.md');
    expect(service.toDisplayPath('/outside/one.md')).toBe('External file: one.md');
  });

  it('loads, bounds, and fingerprints disk text without logging or choosing effects', async () => {
    const { providerFactory } = factory('body');
    const bytes = new TextEncoder().encode('one two three four');
    const fileSystem = createFakeFileSystem({
      stat: jest.fn().mockResolvedValue({ type: FileType.File, ctime: 0, mtime: 0, size: bytes.length }),
      readFile: jest.fn().mockResolvedValue(bytes)
    });
    const service = serviceFor(providerFactory, fileSystem);

    await expect(service.loadFile(
      '/workspace/chapter.md',
      'chapter.md',
      { maxBytes: 100, maxWords: 2 },
      'pin'
    )).resolves.toEqual({
      kind: 'loaded',
      file: {
        text: 'one two',
        words: 2,
        truncation: { keptWords: 2, totalWords: 4 },
        sourceFingerprint: createHash('sha256').update(bytes).digest('hex')
      }
    });
  });

  it('returns disk refusal data and does not read a non-file path', async () => {
    const { providerFactory } = factory('body');
    const readFile = jest.fn();
    const service = serviceFor(providerFactory, createFakeFileSystem({
      stat: jest.fn().mockResolvedValue({ type: FileType.Directory, ctime: 0, mtime: 0, size: 0 }),
      readFile
    }));

    await expect(service.loadFile(
      '/workspace/folder',
      'folder',
      { maxBytes: 100, maxWords: 100 },
      'attach'
    )).resolves.toEqual({
      kind: 'refused',
      refusal: {
        reason: 'not-file',
        message: 'The selected path is not a file.',
        details: 'folder'
      }
    });
    expect(readFile).not.toHaveBeenCalled();
  });

  it('rejects an oversized disk file before reading it', async () => {
    const { providerFactory } = factory('body');
    const readFile = jest.fn();
    const service = serviceFor(providerFactory, createFakeFileSystem({
      stat: jest.fn().mockResolvedValue({ type: FileType.File, ctime: 0, mtime: 0, size: 101 }),
      readFile
    }));

    await expect(service.loadFile(
      '/workspace/large.md',
      'large.md',
      { maxBytes: 100, maxWords: 100 },
      'pin'
    )).resolves.toMatchObject({
      kind: 'refused',
      refusal: { reason: 'too-large', message: expect.stringContaining('too large to pin safely') }
    });
    expect(readFile).not.toHaveBeenCalled();
  });

  it('returns disk inspection failures as refusal data', async () => {
    const { providerFactory } = factory('body');
    const service = serviceFor(providerFactory, createFakeFileSystem({
      stat: jest.fn().mockRejectedValue(new Error('stat denied'))
    }));

    await expect(service.loadFile(
      '/workspace/chapter.md',
      'chapter.md',
      { maxBytes: 100, maxWords: 100 },
      'attach'
    )).resolves.toEqual({
      kind: 'refused',
      refusal: {
        reason: 'inspect-failed',
        message: 'Could not inspect the selected file.',
        details: 'chapter.md: stat denied'
      }
    });
  });

  it('returns disk read failures as refusal data', async () => {
    const { providerFactory } = factory('body');
    const service = serviceFor(providerFactory, createFakeFileSystem({
      stat: jest.fn().mockResolvedValue({ type: FileType.File, ctime: 0, mtime: 0, size: 10 }),
      readFile: jest.fn().mockRejectedValue(new Error('read denied'))
    }));

    await expect(service.loadFile(
      '/workspace/chapter.md',
      'chapter.md',
      { maxBytes: 100, maxWords: 100 },
      'attach'
    )).resolves.toEqual({
      kind: 'refused',
      refusal: {
        reason: 'read-failed',
        message: 'Could not read the selected file.',
        details: 'chapter.md: read denied'
      }
    });
  });

  it('refuses an empty disk file with use-specific copy', async () => {
    const { providerFactory } = factory('body');
    const bytes = new TextEncoder().encode('  \n');
    const service = serviceFor(providerFactory, createFakeFileSystem({
      stat: jest.fn().mockResolvedValue({ type: FileType.File, ctime: 0, mtime: 0, size: bytes.length }),
      readFile: jest.fn().mockResolvedValue(bytes)
    }));

    await expect(service.loadFile(
      '/workspace/chapter.md',
      'chapter.md',
      { maxBytes: 100, maxWords: 100 },
      'pin'
    )).resolves.toEqual({
      kind: 'refused',
      refusal: {
        reason: 'empty',
        message: 'That file is empty — nothing to pin.',
        details: 'chapter.md'
      }
    });
  });

  it('retains the original total when bounding an already-sliced artifact', () => {
    const { providerFactory } = factory('body');
    const service = serviceFor(providerFactory);

    expect(service.boundText('one two three', 2, 40)).toEqual({
      text: 'one two',
      words: 2,
      truncation: { keptWords: 2, totalWords: 40 }
    });
  });

  it('describes configured-result refusals without sending them', () => {
    const { providerFactory } = factory('body');
    const service = serviceFor(providerFactory);
    const result: WorkshopConfiguredResourceLoadResult = {
      kind: 'too-large',
      summary: { ...summary, sizeBytes: 2_048 }
    };

    expect(service.describeConfiguredResourceFailure(result, 'pin', 1_024)).toEqual({
      message: 'That file is too large to pin safely (max 1.0 KiB).',
      details: 'Characters/raven.md is 2.0 KiB'
    });
  });

  it('matches canonical absolute-path provenance and strips a forged webview claim', async () => {
    const { providerFactory } = factory('body');
    const service = serviceFor(providerFactory);

    await expect(service.matchConfiguredSource({
      kind: 'editor-selection',
      sourceUri: 'file:///workspace/Characters/raven.md',
      relativePath: 'Characters/raven.md',
      startLine: 4,
      endLine: 9,
      configuredResource: { group: 'themes', path: 'Themes/echoes.md' }
    })).resolves.toMatchObject({
      kind: 'matched',
      source: {
        kind: 'editor-selection',
        startLine: 4,
        endLine: 9,
        configuredResource: { group: 'characters', path: 'Characters/raven.md' }
      }
    });
  });

  it('reports ambiguous case-folded provenance without guessing', async () => {
    const { providerFactory } = factory('body');
    providerFactory.createProvider.mockResolvedValue({
      listResources: () => [
        summary,
        { ...summary, path: 'Characters/RAVEN.md', absolutePath: '/workspace/Characters/RAVEN.md' }
      ],
      loadResources: jest.fn()
    });
    const service = serviceFor(providerFactory);

    await expect(service.matchConfiguredSource({
      kind: 'file',
      sourceUri: 'file:///workspace/characters/raven.md',
      relativePath: 'characters/raven.md'
    })).resolves.toMatchObject({ kind: 'ambiguous', matchCount: 2 });
  });
});
