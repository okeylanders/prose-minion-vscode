import * as path from 'node:path';
import {
  RejectedModelResponseRecoveryStore,
  RejectedModelResponseRecoveryShellPresenter
} from '@/infrastructure/storage/RejectedModelResponseRecoveryStore';
import { FileSystem, FileType } from '@/platform';
import {
  createFakeShellService,
  createFakeWorkspace
} from '@/__tests__/mocks/platform';

const decoder = new TextDecoder();
// The store test owns only durable persistence; VS Code presentation is explicit.

const statefulFileSystem = () => {
  const files = new Map<string, Uint8Array>();
  const writeFile = jest.fn(async (filePath: string, bytes: Uint8Array) => {
    files.set(filePath, bytes);
  });
  const deleteFile = jest.fn(async (filePath: string) => {
    files.delete(filePath);
  });
  const rename = jest.fn(async (
    fromPath: string,
    toPath: string,
    options?: { overwrite?: boolean }
  ) => {
    const bytes = files.get(fromPath);
    if (!bytes) {
      throw new Error(`Missing temporary file ${fromPath}`);
    }
    if (files.has(toPath) && !options?.overwrite) {
      throw new Error(`EEXIST ${toPath}`);
    }
    files.delete(fromPath);
    files.set(toPath, bytes);
  });
  const fileSystem: FileSystem = {
    readFile: async (filePath) => {
      const bytes = files.get(filePath);
      if (!bytes) {
        throw new Error('ENOENT');
      }
      return bytes;
    },
    writeFile,
    rename,
    delete: deleteFile,
    readDirectory: async (directoryPath) => [...files.keys()]
      .filter((filePath) => path.dirname(filePath) === directoryPath)
      .map((filePath) => [path.basename(filePath), FileType.File]),
    stat: async (filePath) => {
      const bytes = files.get(filePath);
      if (!bytes) {
        throw new Error('ENOENT');
      }
      return { type: FileType.File, ctime: 0, mtime: 0, size: bytes.length };
    },
    createDirectory: async () => undefined
  };
  return { fileSystem, files, writeFile, rename, deleteFile };
};

// `present()` contains two awaited host calls; one event-loop turn drains both
// promise continuations for these immediately-resolving host fakes.
const flushPresentation = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

describe('RejectedModelResponseRecoveryStore', () => {
  it('saves the untouched response in the open project, ignores recovery files, and supports explicit presentation', async () => {
    const { fileSystem, files, rename } = statefulFileSystem();
    const openFileInEditor = jest.fn().mockResolvedValue(undefined);
    const showWarningMessage = jest.fn().mockResolvedValue(undefined);
    const workspace = createFakeWorkspace({
      workspaceFolders: () => [{ path: '/novel', name: 'novel' }]
    });
    const store = new RejectedModelResponseRecoveryStore(
      fileSystem,
      workspace,
      '/extension/recovery',
      undefined,
      () => new Date('2026-08-08T05:48:05.000Z')
    );
    const rawResponse = 'prefix\n10,348 characters the log would omit\nsuffix';

    const receipt = await store.capture({
      toolName: 'lexical-gravity-build',
      requestSummary: 'Build three lenses for "Fable"',
      rawResponse,
      rejection: 'Expected double-quoted property name at position 5522',
      modelId: 'anthropic/claude-fable-5',
      providerResponseId: 'gen-recover-me',
      finishReason: 'stop',
      usage: { promptTokens: 1757, completionTokens: 10061, totalTokens: 11818, costUsd: 0.72 }
    });

    expect(receipt).toEqual(expect.objectContaining({
      storageScope: 'project',
      filePath: expect.stringMatching(
        /^\/novel\/prose-minion\/recovery\/model-responses\/2026-08-08T05-48-05-000Z-lexical-gravity-build-.*\.response\.txt$/
      ),
      metadataPath: expect.stringMatching(/\.metadata\.json$/)
    }));
    const ignorePath = path.join('/novel', 'prose-minion', 'recovery', '.gitignore');
    expect(decoder.decode(files.get(ignorePath))).toBe('*\n!.gitignore\n');
    expect(decoder.decode(files.get(receipt!.filePath))).toBe(rawResponse);
    const metadata = JSON.parse(decoder.decode(files.get(receipt!.metadataPath!)));
    expect(metadata).toMatchObject({
      providerResponseId: 'gen-recover-me',
      modelId: 'anthropic/claude-fable-5',
      rejection: 'Expected double-quoted property name at position 5522',
      responseFile: path.basename(receipt!.filePath),
      responseCharacters: rawResponse.length,
      responseContentType: 'text/plain',
      contract: {
        id: 'lexical-gravity-lenses-v2',
        intendedContentType: 'application/json',
        protocol: expect.stringContaining('===LEXICAL_GRAVITY_LENSES_V2===')
      }
    });
    expect(rename).toHaveBeenCalledWith(
      `${receipt!.filePath}.tmp`,
      receipt!.filePath,
      { overwrite: false }
    );

    const presenter = new RejectedModelResponseRecoveryShellPresenter(
      createFakeShellService({ openFileInEditor, showWarningMessage })
    );
    void presenter.present(receipt!);
    await flushPresentation();
    expect(openFileInEditor).toHaveBeenCalledWith(receipt!.filePath, { beside: true });
    expect(showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('paid response'),
      'Reveal in Finder'
    );
  });

  it('uses extension storage only when no workspace is open', async () => {
    const { fileSystem } = statefulFileSystem();
    const store = new RejectedModelResponseRecoveryStore(
      fileSystem,
      createFakeWorkspace(),
      '/extension/recovery',
      undefined,
      () => new Date('2026-08-08T05:48:05.000Z')
    );

    const receipt = await store.capture({
      toolName: 'gesture-playground',
      requestSummary: 'Generate menu',
      rawResponse: 'broken body',
      rejection: 'menu JSON did not parse'
    });

    expect(receipt).toEqual(expect.objectContaining({
      storageScope: 'extension',
      filePath: expect.stringMatching(/^\/extension\/recovery\/model-responses\//)
    }));
  });

  it('uses extension storage instead of guessing a project in a multi-root workspace', async () => {
    const { fileSystem } = statefulFileSystem();
    const appendLine = jest.fn();
    const store = new RejectedModelResponseRecoveryStore(
      fileSystem,
      createFakeWorkspace({
        workspaceFolders: () => [
          { path: '/novel-a', name: 'novel-a' },
          { path: '/novel-b', name: 'novel-b' }
        ]
      }),
      '/extension/recovery',
      { appendLine } as never
    );

    const receipt = await store.capture({
      toolName: 'gesture-playground',
      requestSummary: 'Generate menu',
      rawResponse: 'broken body',
      rejection: 'menu JSON did not parse',
      providerResponseId: 'gen-multi-root'
    });

    expect(receipt).toEqual(expect.objectContaining({ storageScope: 'extension' }));
    expect(appendLine).toHaveBeenCalledWith(expect.stringContaining(
      'Multi-root workspace; using extension recovery storage providerResponseId=gen-multi-root'
    ));
  });

  it('falls back to extension storage when the open project cannot be written', async () => {
    const state = statefulFileSystem();
    const writeFile = state.fileSystem.writeFile;
    state.fileSystem.writeFile = async (filePath, bytes) => {
      if (filePath.startsWith('/novel/')) {
        throw new Error('Project is read-only');
      }
      await writeFile(filePath, bytes);
    };
    const appendLine = jest.fn();
    const store = new RejectedModelResponseRecoveryStore(
      state.fileSystem,
      createFakeWorkspace({
        workspaceFolders: () => [{ path: '/novel', name: 'novel' }]
      }),
      '/extension/recovery',
      { appendLine } as never
    );

    const receipt = await store.capture({
      toolName: 'lexical-gravity-build',
      requestSummary: 'Build lenses',
      rawResponse: 'still worth saving',
      rejection: 'invalid JSON'
    });

    expect(receipt).toEqual(expect.objectContaining({
      storageScope: 'extension',
      filePath: expect.stringMatching(/^\/extension\/recovery\/model-responses\//)
    }));
    expect(appendLine).toHaveBeenCalledWith(expect.stringContaining(
      'Project recovery failed; trying extension storage'
    ));
  });

  it('keeps the response when only its metadata sidecar fails', async () => {
    const state = statefulFileSystem();
    const writeFile = state.fileSystem.writeFile;
    state.fileSystem.writeFile = async (filePath, bytes) => {
      if (filePath.endsWith('.metadata.json.tmp')) {
        throw new Error('Sidecar unavailable');
      }
      await writeFile(filePath, bytes);
    };
    const store = new RejectedModelResponseRecoveryStore(
      state.fileSystem,
      createFakeWorkspace({
        workspaceFolders: () => [{ path: '/novel', name: 'novel' }]
      }),
      '/extension/recovery'
    );

    const receipt = await store.capture({
      toolName: 'gesture-playground',
      requestSummary: 'Generate menu',
      rawResponse: 'valuable malformed body',
      rejection: 'invalid JSON'
    });

    expect(receipt).toEqual(expect.objectContaining({
      storageScope: 'project',
      metadataPath: undefined
    }));
    expect(decoder.decode(state.files.get(receipt!.filePath))).toBe('valuable malformed body');
  });

  it('cleans the paid-body temp file before falling back after a project rename failure', async () => {
    const state = statefulFileSystem();
    const rename = state.fileSystem.rename;
    state.fileSystem.rename = async (fromPath, toPath, options) => {
      if (toPath.startsWith('/novel/') && toPath.endsWith('.response.txt')) {
        throw new Error('EPERM target locked');
      }
      await rename(fromPath, toPath, options);
    };
    const store = new RejectedModelResponseRecoveryStore(
      state.fileSystem,
      createFakeWorkspace({
        workspaceFolders: () => [{ path: '/novel', name: 'novel' }]
      }),
      '/extension/recovery'
    );

    const receipt = await store.capture({
      toolName: 'lexical-gravity-build',
      requestSummary: 'Build lenses',
      rawResponse: 'the paid body',
      rejection: 'invalid JSON'
    });

    expect(receipt).toEqual(expect.objectContaining({ storageScope: 'extension' }));
    expect(state.deleteFile).toHaveBeenCalledWith(expect.stringMatching(
      /^\/novel\/prose-minion\/recovery\/model-responses\/.*\.response\.txt\.tmp$/
    ));
    expect([...state.files.keys()].some((filePath) => filePath.startsWith('/novel/') && filePath.endsWith('.tmp')))
      .toBe(false);
  });

  it('returns undefined and logs the provider generation when neither storage location can write', async () => {
    const state = statefulFileSystem();
    state.fileSystem.writeFile = async () => {
      throw new Error('Disk unavailable');
    };
    const appendLine = jest.fn();
    const store = new RejectedModelResponseRecoveryStore(
      state.fileSystem,
      createFakeWorkspace(),
      '/extension/recovery',
      { appendLine } as never
    );

    await expect(store.capture({
      toolName: 'lexical-gravity-preview',
      requestSummary: 'Preview lens',
      rawResponse: 'lost body',
      rejection: 'invalid JSON',
      providerResponseId: 'gen-lost-123'
    })).resolves.toBeUndefined();
    expect(appendLine).toHaveBeenCalledWith(expect.stringContaining(
      'providerResponseId=gen-lost-123'
    ));
  });

  it('retains only the newest twenty rejected response bodies and their sidecars', async () => {
    const state = statefulFileSystem();
    const appendLine = jest.fn();
    let second = 0;
    const store = new RejectedModelResponseRecoveryStore(
      state.fileSystem,
      createFakeWorkspace(),
      '/extension/recovery',
      { appendLine } as never,
      () => new Date(Date.UTC(2026, 7, 8, 5, 48, second++))
    );
    const receipts = [];

    for (let index = 0; index < 21; index += 1) {
      receipts.push(await store.capture({
        toolName: 'creative-variations',
        requestSummary: `Generate workup ${index}`,
        rawResponse: `rejected body ${index}`,
        rejection: 'invalid response'
      }));
    }

    const responseFiles = [...state.files.keys()].filter(
      (filePath) => filePath.endsWith('.response.txt')
    );
    const metadataFiles = [...state.files.keys()].filter(
      (filePath) => filePath.endsWith('.metadata.json')
    );
    expect(responseFiles).toHaveLength(20);
    expect(metadataFiles).toHaveLength(20);
    expect(state.files.has(receipts[0]!.filePath)).toBe(false);
    expect(state.files.has(receipts.at(-1)!.filePath)).toBe(true);
    expect(appendLine).toHaveBeenCalledWith(
      '[RejectedModelResponseRecovery] Pruned 1 expired response entry; retaining 20.'
    );
  });

  it('models filesystem rename collisions instead of silently replacing a recovery file', async () => {
    const { fileSystem, files } = statefulFileSystem();
    files.set('/recovery/source.tmp', new TextEncoder().encode('new'));
    files.set('/recovery/existing.txt', new TextEncoder().encode('existing'));

    await expect(fileSystem.rename('/recovery/source.tmp', '/recovery/existing.txt', {
      overwrite: false
    })).rejects.toThrow('EEXIST');
  });
});
