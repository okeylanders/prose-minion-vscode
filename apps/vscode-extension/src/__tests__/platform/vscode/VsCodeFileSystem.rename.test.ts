/**
 * The named-session lock's fence relies on `rename` failing when its source
 * is gone or its destination's folder is missing (ADR 2026-11-19 D6d): the
 * adapter passes the call straight to `workspace.fs.rename`, never over
 * anything by default, never creating a parent, and lets its failure through.
 */

const rename = jest.fn();
const createDirectory = jest.fn();

jest.mock('vscode', () => ({
  Uri: { file: (fsPath: string) => ({ fsPath, scheme: 'file' }) },
  workspace: { fs: { rename: (...args: unknown[]) => rename(...args), createDirectory: (...args: unknown[]) => createDirectory(...args) } }
}), { virtual: true });

import { VsCodeFileSystem } from '../../../platform/vscode/VsCodeFileSystem';

describe('VsCodeFileSystem.rename (D6d)', () => {
  beforeEach(() => {
    rename.mockReset();
    createDirectory.mockReset();
  });

  it('fails when the source is gone, creating nothing', async () => {
    rename.mockRejectedValue(Object.assign(new Error('EntryNotFound (FileSystemError)'), { code: 'FileNotFound' }));
    await expect(new VsCodeFileSystem().rename('/novel/.polish.json.lock/owner-a/next.json', '/novel/polish.json'))
      .rejects.toThrow('EntryNotFound');
    expect(createDirectory).not.toHaveBeenCalled();
  });

  it('fails when the destination folder is missing, never making it', async () => {
    rename.mockRejectedValue(new Error('EntryNotFound (FileSystemError): /novel/.polish.json.lock/owner-a'));
    await expect(new VsCodeFileSystem().rename('/novel/polish.json', '/novel/.polish.json.lock/owner-a/prior.json'))
      .rejects.toThrow('EntryNotFound');
    expect(createDirectory).not.toHaveBeenCalled();
  });

  it('never renames over anything unless asked', async () => {
    rename.mockResolvedValue(undefined);
    await new VsCodeFileSystem().rename('/novel/a.json', '/novel/b.json');
    expect(rename).toHaveBeenCalledWith({ fsPath: '/novel/a.json', scheme: 'file' }, { fsPath: '/novel/b.json', scheme: 'file' }, { overwrite: false });
  });
});
