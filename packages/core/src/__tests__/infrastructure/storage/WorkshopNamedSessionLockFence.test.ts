/**
 * The named-session lock fences a stalled writer (ADR 2026-11-19 D6b, D6d;
 * PR #286 re-reviews), with an injected clock and held promises, over a
 * folder whose renames fail when the destination's folder is gone, as VS
 * Code's and Node's do:
 *
 * - A pauses before its publish; the lease expires; B takes over
 *   (restoring the file) and deletes, or updates; A resumes and its publish
 *   finds no source. Nothing is at the name, or B's content stands.
 * - A retired owner's late release (generation-scoped): A claims, then
 *   pauses before release; B takes over, restores, takes the lock, claims
 *   and pauses; A's one rename (its own token folder) finds nothing, and
 *   no rename or delete names B's lock or token folder; B commits.
 * - A reader during recovery (D6d): a takeover pauses after the lock became
 *   the recovery marker and before restoring; a read is busy; after the
 *   restore, the read returns the file. *Alice*, made-up ids.
 */

import * as path from 'node:path';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { WorkshopNamedSessionBusyError, WorkshopNamedSessionLock, type WorkshopNamedSessionLockHooks } from '@/infrastructure/storage/WorkshopNamedSessionLock';
import { WorkshopSessionStore } from '@/infrastructure/storage/WorkshopSessionStore';
import { STORED_FILE_CLAIM_LEASE_MS } from '@/infrastructure/storage/StoredFileClaims';
import { decodeWorkshopPersistedSessionCheckpoint, type WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import type { LogSink, Workspace } from '@/platform';

const root = '/workspace/novel';
const folder = `${root}/prose-minion/sessions`;
const filePath = `${folder}/20261119-120000-polish.json`;
let clock = Date.parse('2026-11-19T12:00:00.000Z');
const now = () => new Date(clock);
const log = (): LogSink => ({ appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() });
const errors = { changed: () => new Error('changed'), missing: (id: string) => new Error(`missing ${id}`) };

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

function checkpoint(title: string): WorkshopPersistedSessionV2 {
  const session = new WorkshopSessionService(() => clock);
  session.setExcerpt({ text: 'Alice was beginning to get very tired.', source: { kind: 'manual' } });
  return {
    schemaVersion: 2, sessionId: 'alice-polish', title,
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
  await fs.writeFile(filePath, new TextEncoder().encode(JSON.stringify(original, undefined, 2)));
  const readExact = async () => {
    const bytes = fs.files.get(filePath);
    return bytes ? decodeWorkshopPersistedSessionCheckpoint(JSON.parse(new TextDecoder().decode(bytes))) : undefined;
  };
  const lockWith = (hooks: WorkshopNamedSessionLockHooks = {}) => new WorkshopNamedSessionLock(fs, log(), now, 1 << 24, errors, hooks);
  return { fs, original, readExact, lockWith };
}

const leftovers = (fs: MemoryFileSystem) => [...fs.files.keys()].filter((name) => /\.(lock|recovering-|retired-)/.test(name));
const titleAt = (fs: MemoryFileSystem) => JSON.parse(new TextDecoder().decode(fs.files.get(filePath)!)).title as string;

describe('the named-session lock fences a stalled writer (D6b, D6d)', () => {
  it.each(['delete', 'update'] as const)('a writer paused past the lease cannot publish after a takeover and %s', async (successorWrites) => {
    const { fs, original, readExact, lockWith } = await setup();
    const paused = gate();
    const renames = jest.spyOn(fs, 'rename');
    const writeA = lockWith({ beforePublish: paused.pause })
      .replace({ sessionId: 'alice-polish', filePath, readExact, session: checkpoint('Writer A'), expected: original })
      .then(() => 'published', (error: Error) => error);
    await paused.atGate;
    expect(fs.files.has(filePath)).toBe(false);
    clock += STORED_FILE_CLAIM_LEASE_MS + 1;
    if (successorWrites === 'delete') {
      await lockWith().remove(filePath, 'alice-polish');
    } else {
      await lockWith().replace({ sessionId: 'alice-polish', filePath, readExact, session: checkpoint('Writer B'), expected: original });
    }
    const afterB = fs.files.get(filePath);
    paused.open();
    expect(await writeA).toBeInstanceOf(Error);
    // A's publish ran and found no source: its staged file went with the lock B took over.
    const publishes = renames.mock.calls.filter(([from, to]) => from.endsWith('/next.json') && to === filePath);
    expect(publishes.length).toBe(successorWrites === 'delete' ? 1 : 2);
    if (successorWrites === 'delete') {
      expect(fs.files.has(filePath)).toBe(false);
    } else {
      expect(fs.files.get(filePath)).toEqual(afterB);
      expect(titleAt(fs)).toBe('Writer B');
    }
    expect(leftovers(fs)).toEqual([]);
  });

  it('a retired owner\'s late release renames nothing of the successor\'s lock or token folder (generation-scoped release)', async () => {
    const { fs, original, readExact, lockWith } = await setup();
    const aStall = gate();
    const bStall = gate();
    // A stops after its claim, before publishing, then stalls before its cleanup: its prior file is under its token.
    const writeA = lockWith({ beforePublish: async () => { throw new Error('A stops before publishing'); }, beforeCleanup: aStall.pause })
      .replace({ sessionId: 'alice-polish', filePath, readExact, session: checkpoint('Writer A'), expected: original })
      .catch((error: Error) => error);
    await aStall.atGate;
    expect(fs.files.has(filePath)).toBe(false);
    clock += STORED_FILE_CLAIM_LEASE_MS + 1;
    const writeB = lockWith({ beforePublish: bStall.pause })
      .replace({ sessionId: 'alice-polish', filePath, readExact, session: checkpoint('Writer B'), expected: original });
    await bStall.atGate;
    const bLock = [...fs.files.keys()].filter((name) => /\.lock\//.test(name)).sort();
    expect(bLock.some((name) => name.endsWith('/prior.json'))).toBe(true);
    const bLockDir = bLock[0].slice(0, bLock[0].indexOf('.lock/') + '.lock'.length);
    const bToken = `${bLockDir}/${bLock[0].slice(bLockDir.length + 1).split('/')[0]}`;
    // A resumes its release: it detaches only its own token folder, which left with the takeover, so it stops.
    const renames = jest.spyOn(fs, 'rename');
    const deletes = jest.spyOn(fs, 'delete');
    aStall.open();
    expect(await writeA).toBeInstanceOf(Error);
    const touchesB = (from: string) => from === bLockDir || from === bToken || from.startsWith(`${bToken}/`);
    expect(renames.mock.calls.filter(([from]) => touchesB(from))).toEqual([]);
    expect(deletes.mock.calls.filter(([target]) => touchesB(target))).toEqual([]);
    expect(renames.mock.calls).toHaveLength(1);
    expect(renames.mock.calls[0][0].startsWith(`${bLockDir}/`)).toBe(true);
    expect(await renames.mock.results[0].value.then(() => 'moved', () => 'nothing')).toBe('nothing');
    expect([...fs.files.keys()].filter((name) => /\.lock\//.test(name)).sort()).toEqual(bLock);
    renames.mockRestore();
    deletes.mockRestore();
    bStall.open();
    await writeB;
    expect(titleAt(fs)).toBe('Writer B');
    expect(leftovers(fs)).toEqual([]);
  });

  it('a read during recovery is busy and detaches nothing; after the restore it returns the file (D6d)', async () => {
    const { fs, original, readExact, lockWith } = await setup();
    const stalled = gate();
    const writeA = lockWith({ beforePublish: stalled.pause })
      .replace({ sessionId: 'alice-polish', filePath, readExact, session: checkpoint('Writer A'), expected: original })
      .catch((error: Error) => error);
    await stalled.atGate;
    clock += STORED_FILE_CLAIM_LEASE_MS + 1;
    const restore = gate();
    const recovering = lockWith({ beforeRestore: restore.pause }).settledWhenMissing(folder);
    await restore.atGate;
    expect([...fs.files.keys()].some((name) => name.includes('.recovering-'))).toBe(true);
    expect(fs.files.has(filePath)).toBe(false);
    const workspace: Workspace = { workspaceFolders: () => [{ name: 'novel', path: root }], extensionPath: '/extension', asRelativePath: (value) => value, findFiles: async () => [] };
    const store = new WorkshopSessionStore(fs, workspace, log(), now);
    await expect(store.readNamedWithRecovery('alice-polish')).rejects.toBeInstanceOf(WorkshopNamedSessionBusyError);
    restore.open();
    expect(await recovering).toBe(true);
    expect((await store.readNamedWithRecovery('alice-polish'))?.session.title).toBe('Polish 6.11');
    stalled.open();
    expect(await writeA).toBeInstanceOf(Error);
    expect(titleAt(fs)).toBe('Polish 6.11');
    expect(leftovers(fs)).toEqual([]);
  });
});
