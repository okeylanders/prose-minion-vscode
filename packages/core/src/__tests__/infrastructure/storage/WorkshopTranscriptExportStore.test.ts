import { WorkshopTranscriptExportStore } from '@/infrastructure/storage/WorkshopTranscriptExportStore';
import {
  workshopTranscriptExportFileName,
  workshopTranscriptExportStem
} from '@shared/constants/workshopTranscriptExport';
import { createFakeFileSystem, createFakeWorkspace } from '../../mocks/platform';

/** A disk that remembers what was renamed into place, so collisions are real. */
const diskWith = (existing: string[] = []) => {
  const files = new Map<string, string>(existing.map((file) => [file, 'earlier export']));
  const pending = new Map<string, string>();
  const fileSystem = createFakeFileSystem({
    createDirectory: jest.fn(async () => undefined),
    writeFile: jest.fn(async (filePath: string, bytes: Uint8Array) => {
      pending.set(filePath, new TextDecoder().decode(bytes));
    }),
    rename: jest.fn(async (from: string, to: string, options?: { overwrite?: boolean }) => {
      if (files.has(to) && !options?.overwrite) {
        throw new Error(`EntryExists (FileExists): ${to}`);
      }
      files.set(to, pending.get(from) ?? '');
      pending.delete(from);
    }),
    stat: jest.fn(async (filePath: string) => {
      if (!files.has(filePath)) {
        throw new Error('ENOENT');
      }
      return { type: 1, ctime: 0, mtime: 0, size: 1 };
    }),
    delete: jest.fn(async (filePath: string) => {
      pending.delete(filePath);
    })
  });
  return { fileSystem, files, pending };
};

const workspace = createFakeWorkspace({
  workspaceFolders: () => [{ path: '/workspace', name: 'novel' }],
  asRelativePath: (filePath: string) => filePath.replace('/workspace/', '')
});

describe('WorkshopTranscriptExportStore', () => {
  it('writes into prose-minion/exports and reports a workspace-relative path', async () => {
    const { fileSystem, files } = diskWith();
    const store = new WorkshopTranscriptExportStore(fileSystem, workspace);

    const written = await store.writeNew('dock-scene', 'md', '# Dock scene\n');

    expect(fileSystem.createDirectory).toHaveBeenCalledWith('/workspace/prose-minion/exports');
    expect(written).toEqual({
      absolutePath: '/workspace/prose-minion/exports/dock-scene.md',
      relativePath: 'prose-minion/exports/dock-scene.md'
    });
    expect(files.get('/workspace/prose-minion/exports/dock-scene.md')).toBe('# Dock scene\n');
  });

  it('never replaces an earlier export; it takes the next free number', async () => {
    const { fileSystem, files, pending } = diskWith([
      '/workspace/prose-minion/exports/dock-scene.md',
      '/workspace/prose-minion/exports/dock-scene-2.md'
    ]);
    const store = new WorkshopTranscriptExportStore(fileSystem, workspace);

    const written = await store.writeNew('dock-scene', 'md', 'third');

    expect(written.relativePath).toBe('prose-minion/exports/dock-scene-3.md');
    expect(files.get('/workspace/prose-minion/exports/dock-scene.md')).toBe('earlier export');
    expect(files.get('/workspace/prose-minion/exports/dock-scene-3.md')).toBe('third');
    expect(pending.size).toBe(0);
  });

  it('refuses to write without a workspace folder', async () => {
    const { fileSystem } = diskWith();
    const store = new WorkshopTranscriptExportStore(fileSystem, createFakeWorkspace());

    await expect(store.writeNew('dock-scene', 'md', 'x')).rejects.toThrow(
      'Open a workspace folder before exporting a Workshop transcript.'
    );
    expect(fileSystem.writeFile).not.toHaveBeenCalled();
  });

  it('cleans up its temporary file when the write fails for another reason', async () => {
    const { fileSystem } = diskWith();
    (fileSystem.rename as jest.Mock).mockRejectedValueOnce(new Error('EACCES: permission denied'));
    const store = new WorkshopTranscriptExportStore(fileSystem, workspace);

    await expect(store.writeNew('dock-scene', 'md', 'x')).rejects.toThrow('EACCES');
    expect(fileSystem.delete).toHaveBeenCalledWith(
      expect.stringMatching(/^\/workspace\/prose-minion\/exports\/\.dock-scene\..+\.tmp$/)
    );
  });
});

describe('workshop transcript export file names', () => {
  it.each([
    ['Dock scene — Jill & Felix', 'dock-scene-jill-felix'],
    ['Ébauche: chapitre trois', 'ebauche-chapitre-trois'],
    ['../../etc/passwd', 'etc-passwd'],
    ['C:\\Users\\me\\notes', 'c-users-me-notes'],
    ['🔥🔥🔥', 'workshop-transcript'],
    ['   ', 'workshop-transcript']
  ])('derives a portable stem from %j', (title, stem) => {
    expect(workshopTranscriptExportStem(title)).toBe(stem);
  });

  it('caps the stem without leaving a trailing hyphen', () => {
    const stem = workshopTranscriptExportStem(`${'a'.repeat(63)} tail`);

    expect(stem).toBe('a'.repeat(63));
  });

  it('names the file by format', () => {
    expect(workshopTranscriptExportFileName('Dock scene', 'markdown')).toBe('dock-scene.md');
    expect(workshopTranscriptExportFileName('Dock scene', 'json')).toBe('dock-scene.json');
    expect(workshopTranscriptExportFileName('Dock scene', 'html')).toBe('dock-scene.html');
  });
});
