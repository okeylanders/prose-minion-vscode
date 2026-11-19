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
import { VsCodeFileHistory } from '@app/platform/vscode/VsCodeFileHistory';

const FILE = '/projects/wonderland/Drafts/6.11.md';
const HASH = 'a'.repeat(40);
const getExtension = vscode.extensions.getExtension as jest.Mock;

interface Double {
  enabled?: boolean;
  state?: 'uninitialized' | 'initialized';
  repository?: { log: jest.Mock; show: jest.Mock } | null;
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
  return { log: jest.fn(), show: jest.fn() };
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
    expect(repo.log).toHaveBeenCalledWith({ path: FILE, maxEntries: 21 });
  });

  it('shows only a full hash, reads a missing path as absent, and any other failure as failed', async () => {
    const repo = repository();
    gitDouble({ repository: repo });
    const history = new VsCodeFileHistory();
    const id = fileHistoryCommitId(HASH)!;
    repo.show.mockResolvedValueOnce('Alice sat by the river bank.');
    expect(await history.show(FILE, id)).toEqual({ kind: 'text', text: 'Alice sat by the river bank.' });
    expect(repo.show).toHaveBeenCalledWith(HASH, FILE);
    repo.show.mockRejectedValueOnce(Object.assign(new Error('Git error'), { stderr: "fatal: path 'Drafts/6.11.md' does not exist in 'aaaa'" }));
    expect(await history.show(FILE, id)).toEqual({ kind: 'absent' });
    repo.show.mockRejectedValueOnce(Object.assign(new Error('Git error'), { stderr: "fatal: path 'Drafts/6.11.md' exists on disk, but not in 'aaaa'" }));
    expect(await history.show(FILE, id)).toEqual({ kind: 'absent' });
    repo.show.mockRejectedValueOnce(new Error('spawn git ENOENT'));
    expect(await history.show(FILE, id)).toEqual({ kind: 'unavailable', reason: 'failed' });
  });

  it('answers failed when the log throws', async () => {
    const repo = repository();
    repo.log.mockRejectedValue(new Error('Git error'));
    gitDouble({ repository: repo });
    expect(await new VsCodeFileHistory().log(FILE, 5)).toEqual({ kind: 'unavailable', reason: 'failed' });
  });
});
