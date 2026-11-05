/**
 * WorkshopPinnedContextStore across windows and workspaces (Workshop Pinned
 * Context, Slice 1; ADR 2026-11-04 D5). Two stores on one folder are two
 * VS Code windows, each with its own queue; one is held mid-write at a
 * file operation while the other acts.
 *
 * - **A stale revision is refused, and the first write stands.**
 * - **One writer at a time** (PR #204 F-01): a window that cannot take the
 *   list's lock is busy, for create vs create, create vs a claimed rewrite
 *   (the review's probe) and rewrite vs rewrite; one that waited reads the
 *   list at its turn.
 * - **A lease that expires mid-write:** the lock is taken over, and the
 *   stalled holder withdraws before it commits.
 * - **The fence** (the re-review): a holder stalled *inside* its commit
 *   rename past the lease lands nothing, a create or a rewrite, because its
 *   staged list lived in the lock a takeover removed.
 * - **A hand edit,** which takes no lock, at each step: it stands, and the
 *   write is refused or its claimed bytes are set aside.
 * - **A write belongs to the workspace it was asked in:** one whose turn,
 *   or commit, comes under another folder is withdrawn as `unavailable`,
 *   and neither folder's file changes, even though the new folder has a
 *   list of its own.
 *
 * *Alice*, with made-up paths.
 */
import * as path from 'node:path';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import {
  WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION as ABSENT,
  workshopPinnedContextRevisionOf
} from '@/infrastructure/storage/WorkshopPinnedContextStore';
import { STORED_FILE_CLAIM_LEASE_MS } from '@/infrastructure/storage/StoredFileClaims';
import { WORKSHOP_PINNED_CONTEXT_LOCK_OWNER_BYTES } from '@/infrastructure/storage/WorkshopPinnedContextLock';
import {
  FILE,
  FOLDER,
  NOW,
  OTHER_FILE,
  OTHER_ROOT,
  bytesOf,
  everyFile,
  holdOnce,
  list,
  pin,
  pinnedHost as host,
  text
} from '@/__tests__/infrastructure/storage/workshopPinnedContextStoreHost';

const LOCK = path.join(FOLDER, '.pinned-context.lock');
const OWNER = path.join(LOCK, 'owner.json');
const lockBytes = (token: string, at: number) => new TextEncoder().encode(JSON.stringify({ token, at }));

describe('two windows on one list', () => {
  it('refuses the second window\'s stale revision, and the first write stands', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host({ fileSystem, prefix: 'a' });
    const theirs = host({ fileSystem, prefix: 'b' });
    expect(await mine.store.read()).toEqual({ state: 'absent', revision: ABSENT });
    expect(await theirs.store.read()).toEqual({ state: 'absent', revision: ABSENT });

    expect(await mine.store.update(ABSENT, pin('Characters/alice.md'))).toMatchObject({ ok: true });
    const answer = await theirs.store.update(ABSENT, pin('Characters/the-hatter.md'));

    expect(answer).toMatchObject({ ok: false, reason: 'changed', current: { state: 'ok', list: list('Characters/alice.md') } });
    expect(text(fileSystem.files.get(FILE))).toBe(text(bytesOf(list('Characters/alice.md'))));
    expect(fileSystem.files.has(OWNER)).toBe(false);
  });

  it('create vs create: the window without the lock is busy, and the holder\'s create stands', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host({ fileSystem, prefix: 'a' });
    const theirs = host({ fileSystem, prefix: 'b' });
    // Mine holds the lock, and is held staging its list.
    const held = holdOnce(fileSystem, 'writeFile', (file) => file.includes('.pinned-context.json.tmp-a'));
    const saving = mine.store.update(ABSENT, pin('Characters/alice.md'));
    await held.reached;
    expect(await theirs.store.update(ABSENT, pin('Characters/the-hatter.md'))).toEqual({ ok: false, reason: 'busy' });
    held.open();

    expect(await saving).toMatchObject({ ok: true, list: list('Characters/alice.md') });
    expect(everyFile(fileSystem)).toEqual(['pinned-context.json']);
  });

  it('create vs create: a create that waited for the lock reads the list at its turn, and is refused as changed', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host({ fileSystem, prefix: 'a' });
    const theirs = host({ fileSystem, prefix: 'b' });
    // Theirs is held staging its lock, before it holds anything; mine creates meanwhile.
    const held = holdOnce(fileSystem, 'writeFile', (file) => file.includes('.lock.staged-b'));
    const late = theirs.store.update(ABSENT, pin('Characters/the-hatter.md'));
    await held.reached;
    expect(await mine.store.update(ABSENT, pin('Characters/alice.md'))).toMatchObject({ ok: true });
    held.open();

    expect(await late).toMatchObject({ ok: false, reason: 'changed', current: { state: 'ok', list: list('Characters/alice.md') } });
    expect(text(fileSystem.files.get(FILE))).toBe(text(bytesOf(list('Characters/alice.md'))));
  });

  // PR #204 F-01, the review's probe: a create holding an absent revision must never take the saved name while a rewrite holds the list under its claim.
  it('create vs claimed rewrite: a stale create never takes the saved name a rewrite\'s claim emptied', async () => {
    const fileSystem = new MemoryFileSystem();
    const late = host({ fileSystem, prefix: 'late' });
    const current = host({ fileSystem, prefix: 'current' });
    const lateHeld = holdOnce(fileSystem, 'writeFile', (file) => file.includes('-late'));
    const lateSave = late.store.update(ABSENT, pin('Characters/late.md'));
    await lateHeld.reached;
    const first = await current.store.update(ABSENT, pin('Characters/alice.md'));
    if (!first.ok) {
      throw new Error(first.reason);
    }
    // The rewrite holds the list under its claim (the saved name stands empty) when the late create resumes.
    const claimHeld = holdOnce(fileSystem, 'readFile', (file) => file.includes('.claim-'));
    const rewrite = current.store.update(first.revision, pin('Characters/the-hatter.md'));
    await claimHeld.reached;
    expect(fileSystem.files.has(FILE)).toBe(false);
    lateHeld.open();
    const lateResult = await lateSave;
    claimHeld.open();

    expect(lateResult).toEqual({ ok: false, reason: 'busy' });
    expect(await rewrite).toMatchObject({ ok: true, list: list('Characters/alice.md', 'Characters/the-hatter.md') });
    expect(text(fileSystem.files.get(FILE))).not.toContain('late.md');
    expect(everyFile(fileSystem)).toEqual(['pinned-context.json']);
  });

  it('create vs claimed rewrite: a create holding the lock makes the other window\'s create and rewrite busy', async () => {
    const fileSystem = new MemoryFileSystem();
    const late = host({ fileSystem, prefix: 'late' });
    const current = host({ fileSystem, prefix: 'current' });
    const lateHeld = holdOnce(fileSystem, 'writeFile', (file) => file.includes('.pinned-context.json.tmp-late'));
    const lateSave = late.store.update(ABSENT, pin('Characters/late.md'));
    await lateHeld.reached;
    expect(await current.store.update(ABSENT, pin('Characters/alice.md'))).toEqual({ ok: false, reason: 'busy' });
    lateHeld.open();

    expect(await lateSave).toMatchObject({ ok: true, list: list('Characters/late.md') });
    expect(text(fileSystem.files.get(FILE))).toBe(text(bytesOf(list('Characters/late.md'))));
  });

  it('rewrite vs rewrite: busy while the other window holds the lock and its claim, then that write commits', async () => {
    const fileSystem = new MemoryFileSystem();
    fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    const revision = workshopPinnedContextRevisionOf(bytesOf(list('Characters/alice.md')));
    const mine = host({ fileSystem, prefix: 'a' });
    const theirs = host({ fileSystem, prefix: 'b' });
    // Mine has claimed the file and staged its rewrite; hold it at the rename that commits.
    const held = holdOnce(fileSystem, 'rename', (from) => from.includes('.pinned-context.json.tmp-a'));

    const saving = mine.store.update(revision, pin('Characters/the-hatter.md'));
    await held.reached;
    expect(await theirs.store.read()).toEqual({ state: 'busy' });
    expect(await theirs.store.update(revision, pin('Places/the tea party.md'))).toEqual({ ok: false, reason: 'busy' });
    held.open();

    expect(await saving).toMatchObject({ ok: true, list: list('Characters/alice.md', 'Characters/the-hatter.md') });
    expect(everyFile(fileSystem)).toEqual(['pinned-context.json']);
  });
});

describe('a lease that expires mid-write', () => {
  it('lets another window take the abandoned lock; the stalled holder withdraws as busy before it commits', async () => {
    const fileSystem = new MemoryFileSystem();
    const clock = { at: NOW };
    const mine = host({ fileSystem, prefix: 'a', clock });
    const theirs = host({ fileSystem, prefix: 'b', clock });
    // Mine holds the lock and stalls staging its list, past the lease.
    const mineHeld = holdOnce(fileSystem, 'writeFile', (file) => file.includes('.pinned-context.json.tmp-a'));
    const stalled = mine.store.update(ABSENT, pin('Characters/alice.md'));
    await mineHeld.reached;
    clock.at = NOW + STORED_FILE_CLAIM_LEASE_MS + 1;
    // Theirs takes the lock over, and is held at its commit rename while it holds it (another method than mine's hold).
    const theirsHeld = holdOnce(fileSystem, 'rename', (from) => from.includes('.pinned-context.json.tmp-b'));
    const taking = theirs.store.update(ABSENT, pin('Characters/the-hatter.md'));
    await theirsHeld.reached;
    expect(theirs.lines).toEqual(expect.arrayContaining([expect.stringContaining('Took over an abandoned lock')]));
    mineHeld.open();

    expect(await stalled).toEqual({ ok: false, reason: 'busy' });
    expect(fileSystem.files.has(FILE)).toBe(false);
    theirsHeld.open();
    expect(await taking).toMatchObject({ ok: true, list: list('Characters/the-hatter.md') });
    expect(everyFile(fileSystem)).toEqual(['pinned-context.json']);
  });

  it('a stalled rewrite whose lock was taken over and whose list was rewritten meanwhile writes nothing', async () => {
    const fileSystem = new MemoryFileSystem();
    fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    const revision = workshopPinnedContextRevisionOf(bytesOf(list('Characters/alice.md')));
    const clock = { at: NOW };
    const mine = host({ fileSystem, prefix: 'a', clock });
    const theirs = host({ fileSystem, prefix: 'b', clock });
    // Mine stalls staging its rewrite, before it claims the file.
    const held = holdOnce(fileSystem, 'writeFile', (file) => file.includes('.pinned-context.json.tmp-a'));
    const stalled = mine.store.update(revision, pin('Characters/the-hatter.md'));
    await held.reached;
    clock.at = NOW + STORED_FILE_CLAIM_LEASE_MS + 1;
    expect(await theirs.store.update(revision, pin('Places/the tea party.md'))).toMatchObject({ ok: true });
    held.open();

    expect(await stalled).toMatchObject({ ok: false });
    expect(text(fileSystem.files.get(FILE))).toBe(text(bytesOf(list('Characters/alice.md', 'Places/the tea party.md'))));
    expect(everyFile(fileSystem)).toEqual(['pinned-context.json']);
  });
});

describe('the fence: a stale owner\'s commit cannot land after a takeover (PR #204 re-review F-01)', () => {
  // The re-review's probe, as written (braces added for lint).
  it('does not let a stale creator commit after its final token check and lease takeover', async () => {
    const fs = new MemoryFileSystem(); const clock = { at: NOW };
    const stale = host({ fileSystem: fs, prefix: 'late', clock });
    const current = host({ fileSystem: fs, prefix: 'current', clock });
    // Hold the I/O primitive after the creator has passed its final ownership check.
    const lateGate = holdOnce(fs, 'rename', (from) => from.includes('.tmp-late'));
    const lateSave = stale.store.update(ABSENT, pin('Characters/late.md'));
    await lateGate.reached;
    clock.at += STORED_FILE_CLAIM_LEASE_MS + 1;
    const first = await current.store.update(ABSENT, pin('Characters/alice.md'));
    if (!first.ok) { throw new Error(first.reason); }
    const claimedGate = holdOnce(fs, 'readFile', (from) => from.includes('.claim-'));
    const rewrite = current.store.update(first.revision, pin('Characters/hatter.md'));
    await claimedGate.reached;
    lateGate.open(); const staleResult = await lateSave;
    claimedGate.open(); await rewrite;
    expect(staleResult.ok).toBe(false);
    expect(text(fs.files.get(FILE))).not.toContain('late.md');
  });

  it('answers the stale creator busy, and the successor\'s rewrite commits', async () => {
    const fileSystem = new MemoryFileSystem();
    const clock = { at: NOW };
    const stale = host({ fileSystem, prefix: 'late', clock });
    const current = host({ fileSystem, prefix: 'current', clock });
    const lateGate = holdOnce(fileSystem, 'rename', (from) => from.includes('.tmp-late'));
    const lateSave = stale.store.update(ABSENT, pin('Characters/late.md'));
    await lateGate.reached;
    clock.at += STORED_FILE_CLAIM_LEASE_MS + 1;
    const first = await current.store.update(ABSENT, pin('Characters/alice.md'));
    if (!first.ok) {
      throw new Error(first.reason);
    }
    const claimedGate = holdOnce(fileSystem, 'readFile', (file) => file.includes('.claim-'));
    const rewrite = current.store.update(first.revision, pin('Characters/the-hatter.md'));
    await claimedGate.reached;
    lateGate.open();
    expect(await lateSave).toEqual({ ok: false, reason: 'busy' });
    claimedGate.open();

    expect(await rewrite).toMatchObject({ ok: true, list: list('Characters/alice.md', 'Characters/the-hatter.md') });
    expect(everyFile(fileSystem)).toEqual(['pinned-context.json']);
  });

  it('fences a stale claimed rewrite the same way: stalled inside its commit rename past the lease, it lands nothing', async () => {
    const fileSystem = new MemoryFileSystem();
    fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    const revision = workshopPinnedContextRevisionOf(bytesOf(list('Characters/alice.md')));
    const clock = { at: NOW };
    const stale = host({ fileSystem, prefix: 'late', clock });
    const current = host({ fileSystem, prefix: 'current', clock });
    // The stale rewrite has claimed the list and passed its token check; it stalls inside the rename that commits.
    const lateGate = holdOnce(fileSystem, 'rename', (from) => from.includes('.tmp-late'));
    const staleRewrite = stale.store.update(revision, pin('Characters/late.md'));
    await lateGate.reached;
    expect(fileSystem.files.has(FILE)).toBe(false);
    clock.at += STORED_FILE_CLAIM_LEASE_MS + 1;
    // The successor takes the lock over (the stale staged list goes with it), puts the abandoned claim back, and rewrites.
    expect(await current.store.update(revision, pin('Characters/the-hatter.md'))).toMatchObject({ ok: true });
    lateGate.open();

    expect(await staleRewrite).toEqual({ ok: false, reason: 'busy' });
    expect(text(fileSystem.files.get(FILE))).toBe(text(bytesOf(list('Characters/alice.md', 'Characters/the-hatter.md'))));
    expect(everyFile(fileSystem)).toEqual(['pinned-context.json']);
  });
});

describe('the lock directory', () => {
  it('a live lock makes a write busy and is left as it is', async () => {
    const window = host();
    window.fileSystem.files.set(OWNER, lockBytes('other', NOW - 1_000));
    expect(await window.store.update(ABSENT, pin('Characters/alice.md'))).toEqual({ ok: false, reason: 'busy' });
    expect(everyFile(window.fileSystem)).toEqual(['.pinned-context.lock/owner.json']);
  });

  it('an abandoned lock, or one that does not read as a lock, is taken over, and nothing of it is left', async () => {
    for (const abandoned of [lockBytes('other', NOW - STORED_FILE_CLAIM_LEASE_MS - 1), new TextEncoder().encode('not a lock')]) {
      const window = host();
      window.fileSystem.files.set(OWNER, abandoned);
      expect(await window.store.update(ABSENT, pin('Characters/alice.md'))).toMatchObject({ ok: true });
      expect(everyFile(window.fileSystem)).toEqual(['pinned-context.json']);
    }
  });

  it('an owner over its bound is never read, and the lock counts as abandoned by its file\'s age (PR #204 F-04)', async () => {
    const window = host();
    window.fileSystem.files.set(OWNER, new Uint8Array(WORKSHOP_PINNED_CONTEXT_LOCK_OWNER_BYTES + 1).fill(32));
    // This write's own owner later stands at the same path, so watch what is read, not where.
    const read = window.fileSystem.readFile.bind(window.fileSystem);
    const oversizedReads: string[] = [];
    jest.spyOn(window.fileSystem, 'readFile').mockImplementation(async (file: string) => {
      if ((window.fileSystem.files.get(file)?.byteLength ?? 0) > WORKSHOP_PINNED_CONTEXT_LOCK_OWNER_BYTES) {
        oversizedReads.push(path.basename(file));
      }
      return read(file);
    });
    expect(await window.store.update(ABSENT, pin('Characters/alice.md'))).toMatchObject({ ok: true });
    expect(oversizedReads).toEqual([]);
    expect(everyFile(window.fileSystem)).toEqual(['pinned-context.json']);
  });

  it('a takeover that finds a new, live lock where the abandoned one stood puts it back, and is busy', async () => {
    const window = host();
    window.fileSystem.files.set(OWNER, lockBytes('gone', NOW - STORED_FILE_CLAIM_LEASE_MS - 1));
    // Between judging the lock abandoned and moving it, another window takes the lock anew.
    const held = holdOnce(window.fileSystem, 'rename', (from) => from === LOCK);
    const writing = window.store.update(ABSENT, pin('Characters/alice.md'));
    await held.reached;
    window.fileSystem.files.set(OWNER, lockBytes('fresh', NOW));
    held.open();

    expect(await writing).toEqual({ ok: false, reason: 'busy' });
    expect(text(window.fileSystem.files.get(OWNER))).toBe(text(lockBytes('fresh', NOW)));
    expect(everyFile(window.fileSystem)).toEqual(['.pinned-context.lock/owner.json']);
  });
});

describe('a hand edit, which takes no lock, at each step of a write', () => {
  it('a file saved before a create commits stands, and the create is refused as changed', async () => {
    const window = host();
    const held = holdOnce(window.fileSystem, 'rename', (from) => from.includes('.pinned-context.json.tmp-'));
    const saving = window.store.update(ABSENT, pin('Characters/alice.md'));
    await held.reached;
    window.fileSystem.files.set(FILE, bytesOf(list('Characters/the-hatter.md')));
    held.open();

    expect(await saving).toMatchObject({ ok: false, reason: 'changed', current: { state: 'ok', list: list('Characters/the-hatter.md') } });
    expect(text(window.fileSystem.files.get(FILE))).toBe(text(bytesOf(list('Characters/the-hatter.md'))));
    expect(everyFile(window.fileSystem)).toEqual(['pinned-context.json']);
  });

  it('an edit between the read and the claim is claimed, found changed, put back, and the write refused', async () => {
    const window = host();
    window.fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    const revision = workshopPinnedContextRevisionOf(bytesOf(list('Characters/alice.md')));
    const held = holdOnce(window.fileSystem, 'rename', (from) => from === FILE);
    const saving = window.store.update(revision, pin('Characters/the-hatter.md'));
    await held.reached;
    window.fileSystem.files.set(FILE, bytesOf(list('Places/the tea party.md')));
    held.open();

    expect(await saving).toMatchObject({ ok: false, reason: 'changed', current: { state: 'ok', list: list('Places/the tea party.md') } });
    expect(text(window.fileSystem.files.get(FILE))).toBe(text(bytesOf(list('Places/the tea party.md'))));
    expect(everyFile(window.fileSystem)).toEqual(['pinned-context.json']);
  });

  it('a file saved while the claim holds the list stands; the claimed bytes are set aside, never lost', async () => {
    const window = host();
    window.fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    const revision = workshopPinnedContextRevisionOf(bytesOf(list('Characters/alice.md')));
    const held = holdOnce(window.fileSystem, 'readFile', (file) => file.includes('.claim-'));
    const saving = window.store.update(revision, pin('Characters/the-hatter.md'));
    await held.reached;
    window.fileSystem.files.set(FILE, bytesOf(list('Places/the tea party.md')));
    held.open();

    expect(await saving).toMatchObject({ ok: false });
    expect(text(window.fileSystem.files.get(FILE))).toBe(text(bytesOf(list('Places/the tea party.md'))));
    const files = everyFile(window.fileSystem);
    expect(files.filter((file) => file.startsWith('pinned-context.json.set-aside-'))).toHaveLength(1);
    const aside = files.find((file) => file.startsWith('pinned-context.json.set-aside-')) as string;
    expect(text(window.fileSystem.files.get(path.join(FOLDER, aside)))).toBe(text(bytesOf(list('Characters/alice.md'))));
  });
});

describe('a write belongs to the workspace it was asked in', () => {
  /** A file system holding a list in each folder; the window opens on the first. */
  function twoWorkspaces() {
    const fileSystem = new MemoryFileSystem();
    fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    fileSystem.files.set(OTHER_FILE, bytesOf(list('Characters/alice.md')));
    const window = host({ fileSystem });
    const revision = workshopPinnedContextRevisionOf(bytesOf(list('Characters/alice.md')));
    const moveToOther = () => window.folders.splice(0, window.folders.length, { path: OTHER_ROOT, name: 'other' });
    const unchanged = () => {
      expect(text(fileSystem.files.get(FILE))).toBe(text(bytesOf(list('Characters/alice.md'))));
      expect(text(fileSystem.files.get(OTHER_FILE))).toBe(text(bytesOf(list('Characters/alice.md'))));
      expect(everyFile(fileSystem)).toEqual(['pinned-context.json']);
      expect(everyFile(fileSystem, path.dirname(OTHER_FILE))).toEqual(['pinned-context.json']);
    };
    return { fileSystem, window, revision, moveToOther, unchanged };
  }

  it('withdraws a write whose turn comes under another workspace, though both lists are at its revision', async () => {
    const { window, revision, moveToOther, unchanged } = twoWorkspaces();
    // An earlier write holds the queue at its read, so the next one waits for its turn.
    const held = holdOnce(window.fileSystem, 'readDirectory', (folder) => folder === FOLDER);
    const earlier = window.store.read();
    await held.reached;
    const writing = window.store.update(revision, pin('Characters/the-hatter.md'));
    moveToOther();
    held.open();

    await earlier;
    expect(await writing).toEqual({ ok: false, reason: 'unavailable' });
    unchanged();
  });

  it('withdraws a rewrite whose commit comes under another workspace, and puts its claim back', async () => {
    const { fileSystem, window, revision, moveToOther, unchanged } = twoWorkspaces();
    // Held after the file is claimed, while the claimed bytes are checked: the commit point is next.
    const held = holdOnce(fileSystem, 'readFile', (file) => /\.claim-\d{13}-/.test(file));
    const writing = window.store.update(revision, pin('Characters/the-hatter.md'));
    await held.reached;
    moveToOther();
    held.open();

    expect(await writing).toEqual({ ok: false, reason: 'unavailable' });
    unchanged();
  });

  it('withdraws a first write whose commit comes under another workspace, leaving no file in either', async () => {
    const fileSystem = new MemoryFileSystem();
    const window = host({ fileSystem });
    const held = holdOnce(fileSystem, 'writeFile', (file) => file.includes('.tmp-'));
    const writing = window.store.update(ABSENT, pin('Characters/alice.md'));
    await held.reached;
    window.folders.splice(0, 1, { path: OTHER_ROOT, name: 'other' });
    held.open();

    expect(await writing).toEqual({ ok: false, reason: 'unavailable' });
    expect(fileSystem.files.size).toBe(0);
  });

  it('withdraws a write asked with no workspace, even once one opens', async () => {
    const window = host({ folders: [] });
    const writing = window.store.update(ABSENT, pin('Characters/alice.md'));
    window.folders.push({ path: '/workspace', name: 'workspace' });
    expect(await writing).toEqual({ ok: false, reason: 'unavailable' });
    expect(window.fileSystem.files.size).toBe(0);
  });
});
