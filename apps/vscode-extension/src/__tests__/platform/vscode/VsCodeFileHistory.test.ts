/**
 * `VsCodeFileHistory` (ADR 2026-11-19 D12): the `FileHistory` port over the
 * built-in Git extension's API, version 1. VS Code and the Git extension
 * are a controlled double, shaped as `extensions/git/src/api/git.d.ts`
 * describes them. Made-up *Alice* history.
 */

/* eslint-disable @typescript-eslint/naming-convention -- the double mirrors VS Code's own API names. */
jest.mock('vscode', () => ({
  extensions: { getExtension: jest.fn() },
  Uri: { file: (fsPath: string) => ({ fsPath, scheme: 'file' }) }
}), { virtual: true });

// The adapter reaches the core barrel for the port's id rule and the wait; the whole barrel
// cannot load under jest, so those modules are required directly.
jest.mock('@prose-minion/core', () => ({
  fileHistoryCommitId: jest.requireActual('@/platform/FileHistory').fileHistoryCommitId,
  WORKSHOP_HISTORY_GIT_READY_MS: jest.requireActual('@shared/constants/promptBudgets').PROMPT_BUDGETS.workshopHistory.gitReadyMs
}));

import * as vscode from 'vscode';
import { fileHistoryCommitId } from '@prose-minion/core';
import { gitAddressable, gitLiteralPathspec, VsCodeFileHistory } from '@app/platform/vscode/VsCodeFileHistory';

const ROOT = '/projects/wonderland';
const FILE = `${ROOT}/Drafts/6.11.md`;
const HASH = 'a'.repeat(40);
const getExtension = vscode.extensions.getExtension as jest.Mock;

interface Double {
  enabled?: boolean;
  state?: 'uninitialized' | 'initialized';
  repository?: ReturnType<typeof repository> | null;
  getAPI?: jest.Mock;
}

function gitDouble(options: Double = {}) {
  const listeners = new Set<(state: string) => void>();
  const api = {
    state: options.state ?? 'initialized',
    onDidChangeState: (listener: (state: string) => void) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    getRepository: jest.fn(() => (options.repository === undefined ? null : options.repository))
  };
  const git = { enabled: options.enabled ?? true, getAPI: options.getAPI ?? jest.fn(() => api) };
  getExtension.mockReturnValue({ isActive: false, exports: undefined, activate: jest.fn(async () => git) });
  return { api, git, initialize: () => { api.state = 'initialized'; listeners.forEach((listener) => listener('initialized')); }, listeners };
}

function repository() {
  return { rootUri: { fsPath: ROOT }, log: jest.fn(), buffer: jest.fn(), getObjectDetails: jest.fn() };
}

beforeEach(() => getExtension.mockReset());

describe('when git cannot answer', () => {
  it('answers no-git without the extension, and git-disabled when it is off', async () => {
    getExtension.mockReturnValue(undefined);
    expect(await new VsCodeFileHistory().log(FILE, 5)).toEqual({ kind: 'unavailable', reason: 'no-git' });
    gitDouble({ enabled: false });
    expect(await new VsCodeFileHistory().log(FILE, 5)).toEqual({ kind: 'unavailable', reason: 'git-disabled' });
  });

  it('answers not-a-repository for a file no repository holds', async () => {
    const { api } = gitDouble({ repository: null });
    expect(await new VsCodeFileHistory().log(FILE, 5)).toEqual({ kind: 'unavailable', reason: 'not-a-repository' });
    expect(api.getRepository).toHaveBeenCalledWith({ fsPath: FILE, scheme: 'file' });
  });

  it('waits for an uninitialized API, and answers not-ready past the wait', async () => {
    jest.useFakeTimers();
    try {
      const repo = repository();
      repo.log.mockResolvedValue([]);
      const late = gitDouble({ state: 'uninitialized', repository: repo });
      const waiting = new VsCodeFileHistory(1_000).log(FILE, 5);
      await Promise.resolve();
      await Promise.resolve();
      late.initialize();
      expect(await waiting).toEqual({ kind: 'log', commits: [] });

      const never = gitDouble({ state: 'uninitialized', repository: repo });
      const stuck = new VsCodeFileHistory(1_000).log(FILE, 5);
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(1_000);
      expect(await stuck).toEqual({ kind: 'unavailable', reason: 'not-ready' });
      expect(never.listeners.size).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('log and show', () => {
  it('asks the log for the file and a count, and keeps hash, first line, author and date', async () => {
    const repo = repository();
    repo.log.mockResolvedValue([
      { hash: HASH.toUpperCase(), message: 'Trim the tea party\n\nLonger body.', authorName: 'Alice Liddell', authorDate: new Date(Date.UTC(2026, 2, 1)) },
      { hash: 'not-a-hash', message: 'skipped', authorName: 'Nobody' },
      { hash: 'b'.repeat(40), message: '', authorDate: new Date(Number.NaN) }
    ]);
    gitDouble({ repository: repo });
    expect(await new VsCodeFileHistory().log(FILE, 21)).toEqual({
      kind: 'log',
      commits: [
        { id: HASH, authoredAt: '2026-03-01T00:00:00.000Z', author: 'Alice Liddell', subject: 'Trim the tea party' },
        { id: 'b'.repeat(40), author: '', subject: '' }
      ]
    });
    // A literal pathspec, relative to the repository's root (PR #287).
    expect(repo.log).toHaveBeenCalledWith({ path: ':(literal)Drafts/6.11.md', maxEntries: 21 });
  });

  it('shows raw bytes for a full hash and the plain path, reads a missing path as absent, and any other failure as failed', async () => {
    const repo = repository();
    gitDouble({ repository: repo });
    const history = new VsCodeFileHistory();
    const id = fileHistoryCommitId(HASH)!;
    repo.buffer.mockResolvedValueOnce(Buffer.from([0xef, 0xbb, 0xbf, 0x41]));
    expect(await history.show(FILE, id)).toEqual({ kind: 'bytes', bytes: new Uint8Array([0xef, 0xbb, 0xbf, 0x41]) });
    expect(repo.buffer).toHaveBeenCalledWith(HASH, FILE);
    repo.buffer.mockRejectedValueOnce(Object.assign(new Error('Git error'), { stderr: "fatal: path 'Drafts/6.11.md' does not exist in 'aaaa'" }));
    expect(await history.show(FILE, id)).toEqual({ kind: 'absent' });
    repo.buffer.mockRejectedValueOnce(Object.assign(new Error('Git error'), { stderr: "fatal: path 'Drafts/6.11.md' exists on disk, but not in 'aaaa'" }));
    expect(await history.show(FILE, id)).toEqual({ kind: 'absent' });
    repo.buffer.mockRejectedValueOnce(new Error('spawn git ENOENT'));
    expect(await history.show(FILE, id)).toEqual({ kind: 'unavailable', reason: 'failed' });
  });

  it('sizes a blob before it is fetched, with the full hash and the plain path', async () => {
    const repo = repository();
    gitDouble({ repository: repo });
    const history = new VsCodeFileHistory();
    const id = fileHistoryCommitId(HASH)!;
    repo.getObjectDetails.mockResolvedValueOnce({ mode: '100644', object: 'b'.repeat(40), size: 1234 });
    expect(await history.size(FILE, id)).toEqual({ kind: 'size', bytes: 1234 });
    expect(repo.getObjectDetails).toHaveBeenCalledWith(HASH, FILE);
    expect(repo.buffer).not.toHaveBeenCalled();
    repo.getObjectDetails.mockRejectedValueOnce(new Error('Path not known by git'));
    expect(await history.size(FILE, id)).toEqual({ kind: 'absent' });
    repo.getObjectDetails.mockRejectedValueOnce(new Error('Git error'));
    expect(await history.size(FILE, id)).toEqual({ kind: 'unavailable', reason: 'failed' });
  });

  it('answers failed when the log throws', async () => {
    const repo = repository();
    repo.log.mockRejectedValue(new Error('Git error'));
    gitDouble({ repository: repo });
    expect(await new VsCodeFileHistory().log(FILE, 5)).toEqual({ kind: 'unavailable', reason: 'failed' });
  });
});

describe('the log names the authorized file literally (PR #287)', () => {
  it.each([
    ['Drafts/chapter*.md', ':(literal)Drafts/chapter*.md'],
    ['Drafts/who?.md', ':(literal)Drafts/who?.md'],
    ['Drafts/[draft] 6.11.md', ':(literal)Drafts/[draft] 6.11.md'],
    [':glob-looking.md', ':(literal):glob-looking.md'],
    [':(icase)tea.md', ':(literal):(icase)tea.md']
  ])('passes %s to git as %s, so it names only itself', async (name, pathspec) => {
    expect(gitLiteralPathspec(ROOT, `${ROOT}/${name}`)).toBe(pathspec);
    const repo = repository();
    repo.log.mockResolvedValue([]);
    gitDouble({ repository: repo });
    await new VsCodeFileHistory().log(`${ROOT}/${name}`, 5);
    expect(repo.log).toHaveBeenCalledWith({ path: pathspec, maxEntries: 5 });
  });

  it('refuses a file outside the repository\'s root rather than naming it', async () => {
    expect(gitLiteralPathspec(ROOT, '/elsewhere/6.11.md')).toBeUndefined();
    expect(gitLiteralPathspec(ROOT, ROOT)).toBeUndefined();
    expect(gitLiteralPathspec(ROOT, `${ROOT}/..hidden.md`)).toBe(':(literal)..hidden.md');
    const repo = repository();
    gitDouble({ repository: repo });
    expect(await new VsCodeFileHistory().log('/elsewhere/6.11.md', 5)).toEqual({ kind: 'unavailable', reason: 'not-a-repository' });
    expect(repo.log).not.toHaveBeenCalled();
  });
});

describe('the log, the size and the read name one file (PR #287 re-review)', () => {
  it('refuses a POSIX name with a backslash before log, size or buffer is called', async () => {
    const repo = repository();
    gitDouble({ repository: repo });
    const history = new VsCodeFileHistory();
    const file = `${ROOT}/Drafts/tea\\party.md`;
    const id = fileHistoryCommitId(HASH)!;
    expect(await history.log(file, 5)).toEqual({ kind: 'unavailable', reason: 'unaddressable' });
    expect(await history.size(file, id)).toEqual({ kind: 'unavailable', reason: 'unaddressable' });
    expect(await history.show(file, id)).toEqual({ kind: 'unavailable', reason: 'unaddressable' });
    expect(repo.log).not.toHaveBeenCalled();
    expect(repo.getObjectDetails).not.toHaveBeenCalled();
    expect(repo.buffer).not.toHaveBeenCalled();
  });

  it('allows a backslash only where it is the separator', () => {
    expect(gitAddressable(ROOT, `${ROOT}/Drafts/tea\\party.md`, '/')).toBe(false);
    expect(gitAddressable(ROOT, `${ROOT}/Drafts/tea party.md`, '/')).toBe(true);
    expect(gitAddressable('C:\\wonderland', 'C:\\wonderland\\Drafts\\6.11.md', '\\')).toBe(true);
  });
});
