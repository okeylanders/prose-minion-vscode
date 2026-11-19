/**
 * The named-session lock without takeover, and explicit recovery (ADR
 * 2026-11-19 D6e), with an injected clock and held promises:
 *
 * - a stale release never moves a lock: A's lock is removed by recovery
 *   and B acquires; A's delayed release runs all three steps; no rename or
 *   delete names B's lock folder, owner file or token folder, and B commits;
 * - a lock past its lease is reported, never taken: reads and writes answer
 *   recovery-required, and nothing in the lock changes;
 * - a read that straddles a publish never decides missing: the reader finds
 *   no file while a writer is between claim and publish, its acquire is
 *   busy, so it answers busy; after the publish a read returns the file;
 * - explicit recovery: one test per row of D6e's table, each checking the
 *   saved file, every recovery session created and the lock's removal; a
 *   failing copy leaves the lock and its contents untouched; a retry after
 *   an interrupted recovery reuses its copy; a lock within its lease is
 *   busy, not recovered.
 *
 * *Alice*, made-up ids.
 */

import * as path from 'node:path';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import {
  WorkshopNamedSessionBusyError,
  WorkshopNamedSessionLock,
  WorkshopNamedSessionRecoveryRequiredError,
  type WorkshopNamedSessionLockHooks
} from '@/infrastructure/storage/WorkshopNamedSessionLock';
import { WorkshopNamedSessionRecoveryFailedError } from '@/infrastructure/storage/WorkshopNamedSessionRecovery';
import { WorkshopSessionStore } from '@/infrastructure/storage/WorkshopSessionStore';
import { STORED_FILE_CLAIM_LEASE_MS } from '@/infrastructure/storage/StoredFileClaims';
import { decodeWorkshopPersistedSessionCheckpoint, type WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import type { LogSink, Workspace } from '@/platform';

const root = '/workspace/novel';
const folder = `${root}/prose-minion/sessions`;
const fileName = '20261119-120000-polish.json';
const filePath = `${folder}/${fileName}`;
const lockPath = `${folder}/.${fileName}.lock`;
let clock = Date.parse('2026-11-19T12:00:00.000Z');
const now = () => new Date(clock);
const log = (): LogSink => ({ appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() });
const errors = { changed: () => new Error('changed'), missing: (id: string) => new Error(`missing ${id}`) };
const workspace: Workspace = { workspaceFolders: () => [{ name: 'novel', path: root }], extensionPath: '/extension', asRelativePath: (value) => value, findFiles: async () => [] };
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value, undefined, 2));

/** A rename whose destination's folder holds nothing fails, as VS Code's and Node's do: it never creates a parent. */
class StrictFileSystem extends MemoryFileSystem {
  override async rename(fromPath: string, toPath: string, options?: { overwrite?: boolean }): Promise<void> {
    const parent = path.dirname(toPath);
    if (parent !== folder && ![...this.files.keys()].some((name) => name.startsWith(`${parent}${path.sep}`))) {
      throw new Error(`ENOENT: ${parent}`);
    }
    return super.rename(fromPath, toPath, options);
  }
}

function checkpoint(title: string, sessionId = 'alice-polish'): WorkshopPersistedSessionV2 {
  const session = new WorkshopSessionService(() => clock);
  session.setExcerpt({ text: 'Alice was beginning to get very tired.', source: { kind: 'manual' } });
  return {
    schemaVersion: 2, sessionId, title,
    createdAt: now().toISOString(), updatedAt: now().toISOString(),
    temporal: new WorkshopSessionTimeService({ now }).exportState(),
    summary: { hostPersonaId: 'jill', participantPersonaIds: ['jill'], turnCount: 0, excerptWordCount: 6 },
    workshop: session.exportCommittedState(), conversations: []
  };
}

function gate() {
  let open!: () => void;
  let reached!: () => void;
  const atGate = new Promise<void>((resolve) => { reached = resolve; });
  const opened = new Promise<void>((resolve) => { open = resolve; });
  return { atGate, open, pause: async () => { reached(); await opened; } };
}

async function setup() {
  const fs = new StrictFileSystem();
  fs.listsFolders = true;
  const original = checkpoint('Polish 6.11');
  await fs.writeFile(filePath, encode(original));
  const readExact = async () => {
    const bytes = fs.files.get(filePath);
    return bytes ? decodeWorkshopPersistedSessionCheckpoint(JSON.parse(new TextDecoder().decode(bytes))) : undefined;
  };
  const lockWith = (hooks: WorkshopNamedSessionLockHooks = {}) => new WorkshopNamedSessionLock(fs, log(), now, 1 << 24, errors, hooks);
  const store = new WorkshopSessionStore(fs, workspace, log(), now);
  return { fs, original, readExact, lockWith, store };
}

const lockFiles = (fs: MemoryFileSystem) => new Map([...fs.files].filter(([name]) => name.startsWith(`${lockPath}/`)));
const leftovers = (fs: MemoryFileSystem) => [...fs.files.keys()].filter((name) => /\.(lock|retired-)/.test(name));
const titleOf = (fs: MemoryFileSystem, target = filePath) => (JSON.parse(new TextDecoder().decode(fs.files.get(target)!)) as WorkshopPersistedSessionV2).title;
const recoveryTitles = (fs: MemoryFileSystem) => [...fs.files.keys()]
  .filter((name) => path.dirname(name) === folder && name.endsWith('.json') && name !== filePath && !name.endsWith('.summary.json') && !path.basename(name).startsWith('.'))
  .map((name) => titleOf(fs, name))
  .filter((title) => title.endsWith('(local recovery)'))
  .sort();

/** A stale lock as a window that closed mid-save leaves it: one owner, past its lease. */
function leaveLock(fs: MemoryFileSystem, copies: { prior?: WorkshopPersistedSessionV2; next?: WorkshopPersistedSessionV2 }, token = 'gone-writer'): void {
  fs.files.set(`${lockPath}/owner-${token}.json`, encode({ token, at: clock - STORED_FILE_CLAIM_LEASE_MS - 1 }));
  if (copies.prior) {
    fs.files.set(`${lockPath}/${token}/prior.json`, encode(copies.prior));
  }
  if (copies.next) {
    fs.files.set(`${lockPath}/${token}/next.json`, encode(copies.next));
  }
}

describe('the named-session lock takes nothing over (D6e)', () => {
  it('a stale release never moves a lock: A\'s delayed release leaves B\'s lock, owner file and token folder as they were', async () => {
    const { fs, original, readExact, lockWith, store } = await setup();
    const aStall = gate();
    const writeA = lockWith({ beforePublish: aStall.pause })
      .replace({ sessionId: 'alice-polish', filePath, readExact, session: checkpoint('Writer A'), expected: original })
      .then(() => 'published', (error: Error) => error);
    await aStall.atGate;
    clock += STORED_FILE_CLAIM_LEASE_MS + 1;
    // The writer recovers A's lock: prior restored, A's staged copy kept, the lock removed.
    const recovered = await store.recoverNamed('alice-polish');
    expect(recovered.restored).toBe(true);
    expect(leftovers(fs)).toEqual([]);
    const bStall = gate();
    const writeB = lockWith({ beforePublish: bStall.pause })
      .replace({ sessionId: 'alice-polish', filePath, readExact, session: checkpoint('Writer B'), expected: original });
    await bStall.atGate;
    const bLock = lockFiles(fs);
    const bToken = [...bLock.keys()].find((name) => name.endsWith('/prior.json'))!.split('/').slice(-2, -1)[0];
    const bOwner = `${lockPath}/owner-${bToken}.json`;
    expect(bLock.has(bOwner)).toBe(true);
    const renames = jest.spyOn(fs, 'rename');
    const deletes = jest.spyOn(fs, 'delete');
    aStall.open();
    expect(await writeA).toBeInstanceOf(Error);
    const touchesB = (target: string) => target === bOwner || target === `${lockPath}/${bToken}` || target.startsWith(`${lockPath}/${bToken}/`);
    expect(renames.mock.calls.filter(([from, to]) => touchesB(from) || touchesB(to) || from === lockPath)).toEqual([]);
    expect(deletes.mock.calls.filter(([target, options]) => touchesB(target) || (target === lockPath && options?.recursive !== false))).toEqual([]);
    // A's third step was the non-recursive delete of the lock directory, and it failed on B's lock.
    expect(deletes.mock.calls.some(([target, options]) => target === lockPath && options?.recursive === false)).toBe(true);
    expect(lockFiles(fs)).toEqual(bLock);
    renames.mockRestore();
    deletes.mockRestore();
    bStall.open();
    await writeB;
    expect(titleOf(fs)).toBe('Writer B');
    expect(leftovers(fs)).toEqual([]);
  });

  it('a lock past its lease is reported, never taken: reads and writes answer recovery-required, and nothing in it changes', async () => {
    const { fs, original, readExact, lockWith, store } = await setup();
    const stall = gate();
    const writeA = lockWith({ beforePublish: stall.pause })
      .replace({ sessionId: 'alice-polish', filePath, readExact, session: checkpoint('Writer A'), expected: original })
      .catch((error: Error) => error);
    await stall.atGate;
    clock += STORED_FILE_CLAIM_LEASE_MS + 1;
    const before = lockFiles(fs);
    await expect(store.readNamedWithRecovery('alice-polish')).rejects.toBeInstanceOf(WorkshopNamedSessionRecoveryRequiredError);
    await expect(lockWith().replace({ sessionId: 'alice-polish', filePath, readExact, session: checkpoint('Writer B'), expected: original }))
      .rejects.toBeInstanceOf(WorkshopNamedSessionRecoveryRequiredError);
    await expect(lockWith().remove(filePath, 'alice-polish')).rejects.toBeInstanceOf(WorkshopNamedSessionRecoveryRequiredError);
    expect(lockFiles(fs)).toEqual(before);
    const listed = await store.list();
    expect(listed.sessions.map((row) => [row.sessionId, row.lock])).toEqual([['alice-polish', 'recovery-required']]);
    stall.open();
    await writeA;
  });

  it('a read that straddles a publish never decides missing: busy while the writer holds the lock, the file after', async () => {
    const { fs, original, readExact, lockWith, store } = await setup();
    const stall = gate();
    const writeA = lockWith({ beforePublish: stall.pause })
      .replace({ sessionId: 'alice-polish', filePath, readExact, session: checkpoint('Writer A'), expected: original });
    await stall.atGate;
    expect(fs.files.has(filePath)).toBe(false);
    await expect(store.readNamedWithRecovery('alice-polish')).rejects.toBeInstanceOf(WorkshopNamedSessionBusyError);
    expect((await store.list()).sessions.map((row) => [row.sessionId, row.lock])).toEqual([['alice-polish', 'busy']]);
    stall.open();
    await writeA;
    expect((await store.readNamedWithRecovery('alice-polish'))?.session.title).toBe('Writer A');
    expect(leftovers(fs)).toEqual([]);
  });

  it('a session truly gone is missing only after a read under its lock', async () => {
    const { fs, store } = await setup();
    expect((await store.readNamedWithRecovery('alice-polish'))?.session.title).toBe('Polish 6.11');
    fs.files.delete(filePath);
    const renames = jest.spyOn(fs, 'rename');
    expect(await store.readNamedWithRecovery('alice-polish')).toBeUndefined();
    // The reader knew the file's name: it took that lock before answering missing.
    expect(renames.mock.calls.some(([from, to]) => from.startsWith(`${lockPath}.staged-`) && to === lockPath)).toBe(true);
    expect(leftovers(fs)).toEqual([]);
  });
});

describe('explicit recovery follows D6e\'s table', () => {
  it('saved, no prior, next that differs: next is kept as a local recovery session', async () => {
    const { fs, store } = await setup();
    leaveLock(fs, { next: checkpoint('Polish, unsaved') });
    const outcome = await store.recoverNamed('alice-polish');
    expect([outcome.restored, outcome.copies.length]).toEqual([false, 1]);
    expect(titleOf(fs)).toBe('Polish 6.11');
    expect(recoveryTitles(fs)).toEqual(['Polish, unsaved (local recovery)']);
    expect(leftovers(fs)).toEqual([]);
  });

  it('saved, no prior, next equal to it: next is dropped', async () => {
    const { fs, original, store } = await setup();
    leaveLock(fs, { next: original });
    const outcome = await store.recoverNamed('alice-polish');
    expect([outcome.copies.length, outcome.dropped]).toEqual([0, 1]);
    expect(recoveryTitles(fs)).toEqual([]);
    expect(leftovers(fs)).toEqual([]);
  });

  it('saved and prior, no next: prior is the superseded pre-image, dropped', async () => {
    const { fs, store } = await setup();
    leaveLock(fs, { prior: checkpoint('Polish 6.10') });
    const outcome = await store.recoverNamed('alice-polish');
    expect([outcome.restored, outcome.copies.length, outcome.dropped]).toEqual([false, 0, 1]);
    expect(titleOf(fs)).toBe('Polish 6.11');
    expect(recoveryTitles(fs)).toEqual([]);
    expect(leftovers(fs)).toEqual([]);
  });

  it('no saved file, prior and next: prior is restored, next kept when it differs', async () => {
    const { fs, original, store } = await setup();
    fs.files.delete(filePath);
    leaveLock(fs, { prior: original, next: checkpoint('Polish, unsaved') });
    const outcome = await store.recoverNamed('alice-polish');
    expect([outcome.restored, outcome.copies.length]).toEqual([true, 1]);
    expect(titleOf(fs)).toBe('Polish 6.11');
    expect(recoveryTitles(fs)).toEqual(['Polish, unsaved (local recovery)']);
    expect(leftovers(fs)).toEqual([]);
    expect((await store.readNamed('alice-polish'))?.title).toBe('Polish 6.11');
  });

  it('no saved file, prior only: a delete that did not finish, and the session is back', async () => {
    const { fs, original, store } = await setup();
    fs.files.delete(filePath);
    leaveLock(fs, { prior: original });
    const outcome = await store.recoverNamed('alice-polish');
    expect([outcome.restored, outcome.unfinishedDelete, outcome.copies.length]).toEqual([true, true, 0]);
    expect(titleOf(fs)).toBe('Polish 6.11');
    expect(leftovers(fs)).toEqual([]);
  });

  it('no saved file, next only: next is kept as a local recovery session', async () => {
    const { fs, store } = await setup();
    fs.files.delete(filePath);
    leaveLock(fs, { next: checkpoint('Polish, unsaved') });
    const outcome = await store.recoverNamed('alice-polish');
    expect([outcome.restored, outcome.copies.length]).toEqual([false, 1]);
    expect(fs.files.has(filePath)).toBe(false);
    expect(recoveryTitles(fs)).toEqual(['Polish, unsaved (local recovery)']);
    expect(leftovers(fs)).toEqual([]);
  });

  it('any other shape: every copy that differs from the saved file is kept', async () => {
    const { fs, original, store } = await setup();
    leaveLock(fs, { prior: checkpoint('Polish, first window'), next: original }, 'first-writer');
    leaveLock(fs, { next: checkpoint('Polish, second window') }, 'second-writer');
    const outcome = await store.recoverNamed('alice-polish');
    expect([outcome.restored, outcome.copies.length, outcome.dropped]).toEqual([false, 2, 1]);
    expect(titleOf(fs)).toBe('Polish 6.11');
    expect(recoveryTitles(fs)).toEqual(['Polish, first window (local recovery)', 'Polish, second window (local recovery)']);
    expect(leftovers(fs)).toEqual([]);
  });

  it('a failing copy leaves the lock and everything in it untouched, and says which step failed', async () => {
    const { fs, original, store } = await setup();
    fs.files.delete(filePath);
    leaveLock(fs, { prior: original, next: checkpoint('Polish, unsaved') });
    const before = lockFiles(fs);
    jest.spyOn(store, 'saveNamed').mockRejectedValueOnce(new Error('EIO'));
    const refused = await store.recoverNamed('alice-polish').catch((error: Error) => error);
    expect(refused).toBeInstanceOf(WorkshopNamedSessionRecoveryFailedError);
    expect((refused as WorkshopNamedSessionRecoveryFailedError).step).toBe('copy');
    expect(lockFiles(fs)).toEqual(before);
    expect(fs.files.has(filePath)).toBe(false);
    await expect(store.readNamedWithRecovery('alice-polish')).rejects.toBeInstanceOf(WorkshopNamedSessionRecoveryRequiredError);
  });

  it('a retry after an interrupted recovery reuses the copy it already saved: no duplicate', async () => {
    const { fs, original, store } = await setup();
    fs.files.delete(filePath);
    leaveLock(fs, { prior: original, next: checkpoint('Polish, unsaved') });
    fs.failRenameToPath = filePath; // The restore fails after the copy landed.
    const refused = await store.recoverNamed('alice-polish').catch((error: Error) => error);
    expect((refused as WorkshopNamedSessionRecoveryFailedError).step).toBe('restore');
    expect(recoveryTitles(fs)).toEqual(['Polish, unsaved (local recovery)']);
    fs.failRenameToPath = undefined;
    const outcome = await store.recoverNamed('alice-polish');
    expect([outcome.restored, outcome.copies.map((copy) => copy.title)]).toEqual([true, ['Polish, unsaved (local recovery)']]);
    expect(recoveryTitles(fs)).toEqual(['Polish, unsaved (local recovery)']);
    expect(titleOf(fs)).toBe('Polish 6.11');
    expect(leftovers(fs)).toEqual([]);
  });

  it('a lock within its lease is busy, and recovery moves nothing', async () => {
    const { fs, store } = await setup();
    leaveLock(fs, { next: checkpoint('Polish, unsaved') });
    fs.files.set(`${lockPath}/owner-gone-writer.json`, encode({ token: 'gone-writer', at: clock }));
    const before = lockFiles(fs);
    await expect(store.recoverNamed('alice-polish')).rejects.toBeInstanceOf(WorkshopNamedSessionBusyError);
    expect(lockFiles(fs)).toEqual(before);
  });
});
