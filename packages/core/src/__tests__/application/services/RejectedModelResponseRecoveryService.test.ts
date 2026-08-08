import * as path from 'node:path';
import {
  RejectedModelResponseRecoveryService
} from '@/application/services/RejectedModelResponseRecoveryService';
import { FileSystem, FileType } from '@/platform';
import {
  createFakeShellService,
  createFakeWorkspace
} from '@/__tests__/mocks/platform';

const decoder = new TextDecoder();

const statefulFileSystem = () => {
  const files = new Map<string, Uint8Array>();
  const writeFile = jest.fn(async (filePath: string, bytes: Uint8Array) => {
    files.set(filePath, bytes);
  });
  const rename = jest.fn(async (fromPath: string, toPath: string) => {
    const bytes = files.get(fromPath);
    if (!bytes) {
      throw new Error(`Missing temporary file ${fromPath}`);
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
    delete: async () => undefined,
    readDirectory: async () => [],
    stat: async (filePath) => {
      const bytes = files.get(filePath);
      if (!bytes) {
        throw new Error('ENOENT');
      }
      return { type: FileType.File, ctime: 0, mtime: 0, size: bytes.length };
    },
    createDirectory: async () => undefined
  };
  return { fileSystem, files, writeFile, rename };
};

const flushPresentation = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

describe('RejectedModelResponseRecoveryService', () => {
  it('saves the untouched response in the open project, ignores recovery files, and opens it', async () => {
    const { fileSystem, files, rename } = statefulFileSystem();
    const openFileInEditor = jest.fn().mockResolvedValue(undefined);
    const showWarningMessage = jest.fn().mockResolvedValue(undefined);
    const workspace = createFakeWorkspace({
      workspaceFolders: () => [{ path: '/novel', name: 'novel' }]
    });
    const service = new RejectedModelResponseRecoveryService(
      fileSystem,
      workspace,
      createFakeShellService({ openFileInEditor, showWarningMessage }),
      '/extension/recovery',
      undefined,
      () => new Date('2026-08-08T05:48:05.000Z')
    );
    const rawResponse = 'prefix\n10,348 characters the log would omit\nsuffix';

    const receipt = await service.capture({
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
      responseCharacters: rawResponse.length
    });
    expect(rename).toHaveBeenCalledWith(
      `${receipt!.filePath}.tmp`,
      receipt!.filePath,
      { overwrite: false }
    );

    await flushPresentation();
    expect(openFileInEditor).toHaveBeenCalledWith(receipt!.filePath, { beside: true });
    expect(showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('paid response'),
      'Reveal in Finder'
    );
  });

  it('uses extension storage only when no workspace is open', async () => {
    const { fileSystem } = statefulFileSystem();
    const service = new RejectedModelResponseRecoveryService(
      fileSystem,
      createFakeWorkspace(),
      createFakeShellService(),
      '/extension/recovery',
      undefined,
      () => new Date('2026-08-08T05:48:05.000Z')
    );

    const receipt = await service.capture({
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
    const service = new RejectedModelResponseRecoveryService(
      state.fileSystem,
      createFakeWorkspace({
        workspaceFolders: () => [{ path: '/novel', name: 'novel' }]
      }),
      createFakeShellService(),
      '/extension/recovery',
      { appendLine } as never
    );

    const receipt = await service.capture({
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

  it('keeps and presents the response when only its metadata sidecar fails', async () => {
    const state = statefulFileSystem();
    const writeFile = state.fileSystem.writeFile;
    state.fileSystem.writeFile = async (filePath, bytes) => {
      if (filePath.endsWith('.metadata.json.tmp')) {
        throw new Error('Sidecar unavailable');
      }
      await writeFile(filePath, bytes);
    };
    const openFileInEditor = jest.fn().mockResolvedValue(undefined);
    const service = new RejectedModelResponseRecoveryService(
      state.fileSystem,
      createFakeWorkspace({
        workspaceFolders: () => [{ path: '/novel', name: 'novel' }]
      }),
      createFakeShellService({ openFileInEditor }),
      '/extension/recovery'
    );

    const receipt = await service.capture({
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
    await flushPresentation();
    expect(openFileInEditor).toHaveBeenCalledWith(receipt!.filePath, { beside: true });
  });
});
