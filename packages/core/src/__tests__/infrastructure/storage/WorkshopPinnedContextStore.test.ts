/**
 * WorkshopPinnedContextStore in one window (Workshop Pinned Context,
 * Slice 1; ADR 2026-11-04 D5): where the list is kept, read live; reads
 * with revisions; a create, an update and a refusal by revision; a file
 * that does not read is never written; claims settle by the shared
 * primitive's rules; a folder that cannot be read is `io`, never absent.
 * *Alice*, with made-up paths.
 */
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { createFakeWorkspace } from '@/__tests__/mocks/platform';
import { STORED_FILE_CLAIM_LEASE_MS } from '@/infrastructure/storage/StoredFileClaims';
import {
  WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION as ABSENT,
  WorkshopPinnedContextStore,
  workshopPinnedContextRevisionOf
} from '@/infrastructure/storage/WorkshopPinnedContextStore';
import { WORKSHOP_PINNED_CONTEXT_FILE_BYTES, WORKSHOP_PINNED_CONTEXT_FILES } from '@shared/types/workshopPinnedContext';
import { FILE, FOLDER, NOW, OTHER_FILE, OTHER_ROOT, ROOT, bytesOf, everyFile, list, listRenames, pin, pinnedHost as host, text } from '@/__tests__/infrastructure/storage/workshopPinnedContextStoreHost';

const claimOf = (at: number, id: string) => path.join(FOLDER, `.pinned-context.json.claim-${at}-${id}`);

describe('where the list is kept, read live', () => {
  it('is the one workspace folder\'s prose-minion/pinned-context.json', () => {
    expect(host().store.availability()).toEqual({
      available: true,
      rootPath: ROOT,
      filePath: FILE,
      displayPath: 'prose-minion/pinned-context.json'
    });
  });

  it('is unavailable with no folder, or several, and says which', () => {
    const none = new WorkshopPinnedContextStore(new MemoryFileSystem(), createFakeWorkspace(), host().log);
    expect(none.availability()).toEqual({ available: false, reason: 'no-workspace' });
    const several = host({ folders: [{ path: '/a', name: 'a' }, { path: '/b', name: 'b' }] });
    expect(several.store.availability()).toEqual({ available: false, reason: 'multi-root' });
  });

  it('is read again on every call', async () => {
    const window = host();
    window.folders.push({ path: '/other', name: 'other' });
    expect(window.store.availability()).toEqual({ available: false, reason: 'multi-root' });
    expect(await window.store.read()).toEqual({ state: 'unavailable', reason: 'multi-root' });
    expect(await window.store.update(ABSENT, pin('Characters/alice.md'))).toEqual({ ok: false, reason: 'unavailable' });
    expect(window.fileSystem.files.size).toBe(0);
  });
});

describe('reads', () => {
  it('reads no file as absent, at the fixed absent revision', async () => {
    expect(await host().store.read()).toEqual({ state: 'absent', revision: ABSENT });
  });

  it('reads a list with the SHA-256 of its bytes as its revision', async () => {
    const window = host();
    window.fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    const revision = createHash('sha256').update(bytesOf(list('Characters/alice.md'))).digest('hex');
    expect(await window.store.read()).toEqual({ state: 'ok', list: list('Characters/alice.md'), revision });
    expect(revision).not.toBe(ABSENT);
  });

  it('reads a file that breaks the format as unreadable, with its reason, entry and revision', async () => {
    const window = host();
    const bad = new TextEncoder().encode(JSON.stringify({ format: 1, files: [{ path: 'Characters/alice.md' }, { path: '../secret.md' }] }));
    window.fileSystem.files.set(FILE, bad);
    expect(await window.store.read()).toEqual({ state: 'unreadable', reason: 'path', entry: 1, revision: workshopPinnedContextRevisionOf(bad) });
  });

  it('reads a folder it cannot list as io, never absent', async () => {
    const window = host();
    jest.spyOn(window.fileSystem, 'readDirectory').mockRejectedValue(Object.assign(new Error('EACCES: /workspace/prose-minion'), { code: 'EACCES' }));
    expect(await window.store.read()).toEqual({ state: 'io' });
    expect(await window.store.update(ABSENT, pin('Characters/alice.md'))).toEqual({ ok: false, reason: 'io' });
    expect(window.fileSystem.files.size).toBe(0);
  });

  it('reads a file it cannot open as io', async () => {
    const window = host();
    window.fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    jest.spyOn(window.fileSystem, 'readFile').mockRejectedValue(Object.assign(new Error('EACCES: /workspace/prose-minion/pinned-context.json'), { code: 'EACCES' }));
    expect(await window.store.read()).toEqual({ state: 'io' });
    expect(window.lines.join('\n')).toContain('EACCES');
  });
});

describe('writes, by revision', () => {
  it('creates the file: staged inside its lock, then renamed into place, never over anything', async () => {
    const window = host();
    const saved = await window.store.update(ABSENT, pin('Characters/alice.md'));
    expect(saved).toEqual({ ok: true, list: list('Characters/alice.md'), revision: workshopPinnedContextRevisionOf(bytesOf(list('Characters/alice.md'))) });
    expect(text(window.fileSystem.files.get(FILE))).toBe(text(bytesOf(list('Characters/alice.md'))));
    expect(listRenames(window.fileSystem)).toEqual([{ fromPath: path.join(FOLDER, '.pinned-context.lock', '.pinned-context.json.tmp-s2'), toPath: FILE, overwrite: false }]);
    expect(everyFile(window.fileSystem)).toEqual(['pinned-context.json']);
  });

  it('updates the list in place under a claim, at the revision it names', async () => {
    const window = host();
    const created = await window.store.update(ABSENT, pin('Characters/alice.md'));
    if (!created.ok) {
      throw new Error(created.reason);
    }
    const updated = await window.store.update(created.revision, pin('Characters/the-hatter.md'));
    expect(updated).toMatchObject({ ok: true, list: list('Characters/alice.md', 'Characters/the-hatter.md') });
    expect(await window.store.read()).toMatchObject({ state: 'ok', list: list('Characters/alice.md', 'Characters/the-hatter.md') });
    // The file was claimed (renamed aside, never over anything) before the staged list took its name.
    const claims = listRenames(window.fileSystem).filter((call) => /\.claim-\d{13}-/.test(call.toPath));
    expect(claims).toHaveLength(1);
    expect(listRenames(window.fileSystem).every((call) => !call.overwrite)).toBe(true);
    expect(everyFile(window.fileSystem)).toEqual(['pinned-context.json']);
  });

  it('refuses a stale revision, writes nothing, and answers with the list as it reads now', async () => {
    const window = host();
    window.fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    const before = text(window.fileSystem.files.get(FILE));
    const answer = await window.store.update('0'.repeat(64), pin('Characters/the-hatter.md'));
    expect(answer).toEqual({
      ok: false,
      reason: 'changed',
      current: { state: 'ok', list: list('Characters/alice.md'), revision: workshopPinnedContextRevisionOf(bytesOf(list('Characters/alice.md'))) }
    });
    expect(text(window.fileSystem.files.get(FILE))).toBe(before);
    expect(listRenames(window.fileSystem)).toEqual([]);
  });

  it('refuses a create when a file stands, and a change when the file is gone', async () => {
    const window = host();
    window.fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    expect(await window.store.update(ABSENT, pin('Characters/the-hatter.md'))).toMatchObject({ ok: false, reason: 'changed', current: { state: 'ok' } });
    const revision = workshopPinnedContextRevisionOf(bytesOf(list('Characters/alice.md')));
    window.fileSystem.files.delete(FILE);
    expect(await window.store.update(revision, pin('Characters/the-hatter.md'))).toEqual({ ok: false, reason: 'changed', current: { state: 'absent', revision: ABSENT } });
    expect(window.fileSystem.files.size).toBe(0);
  });

  it('writes nothing when the change leaves the bytes as they are, or leaves an absent list empty', async () => {
    const window = host();
    expect(await window.store.update(ABSENT, (current) => current)).toEqual({ ok: true, list: list(), revision: ABSENT });
    expect(window.fileSystem.files.size).toBe(0);
    window.fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    const revision = workshopPinnedContextRevisionOf(bytesOf(list('Characters/alice.md')));
    expect(await window.store.update(revision, (current) => ({ files: [...current.files] }))).toEqual({ ok: true, list: list('Characters/alice.md'), revision });
    expect(listRenames(window.fileSystem)).toEqual([]);
  });

  it('writes an emptied list as an empty list, never by deleting the file', async () => {
    const window = host();
    window.fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    const answer = await window.store.update(workshopPinnedContextRevisionOf(bytesOf(list('Characters/alice.md'))), () => list());
    expect(answer).toMatchObject({ ok: true, list: list() });
    expect(text(window.fileSystem.files.get(FILE))).toBe('{\n  "format": 1,\n  "files": []\n}\n');
  });

  it('refuses a change that would not read back, by its reason, and writes nothing', async () => {
    const window = host();
    window.fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    const revision = workshopPinnedContextRevisionOf(bytesOf(list('Characters/alice.md')));
    expect(await window.store.update(revision, pin('Characters/alice.md'))).toEqual({ ok: false, reason: 'invalid', refusal: 'duplicate', entry: 1 });
    expect(await window.store.update(revision, pin('../alice.md'))).toEqual({ ok: false, reason: 'invalid', refusal: 'path', entry: 1 });
    const full = () => list(...Array.from({ length: WORKSHOP_PINNED_CONTEXT_FILES + 1 }, (_, index) => `Notes/${index}.md`));
    expect(await window.store.update(revision, full)).toEqual({ ok: false, reason: 'invalid', refusal: 'too-many' });
    expect(text(window.fileSystem.files.get(FILE))).toBe(text(bytesOf(list('Characters/alice.md'))));
    expect(listRenames(window.fileSystem)).toEqual([]);
  });

  it('compares paths case-folded on Windows', async () => {
    const window = host({ platform: 'windows' });
    window.fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    const revision = workshopPinnedContextRevisionOf(bytesOf(list('Characters/alice.md')));
    expect(await window.store.update(revision, pin('characters/ALICE.md'))).toMatchObject({ ok: false, reason: 'invalid', refusal: 'duplicate' });
  });

  it('withdraws a write its caller\'s commit point refuses, as unavailable', async () => {
    const window = host();
    expect(await window.store.update(ABSENT, pin('Characters/alice.md'), { beforeCommit: () => false })).toEqual({ ok: false, reason: 'unavailable' });
    expect(window.fileSystem.files.size).toBe(0);
  });
});

describe('a file that does not read is never written', () => {
  it('refuses every write to it, even at its own revision', async () => {
    const window = host();
    const bad = new TextEncoder().encode('{"format": 1, "files": [{"path": "Characters/alice.md", "pinned": true}]}');
    window.fileSystem.files.set(FILE, bad);
    const read = await window.store.read();
    expect(read).toMatchObject({ state: 'unreadable', reason: 'unknown-key', entry: 0 });
    const revision = read.state === 'unreadable' ? read.revision : '';
    expect(await window.store.update(revision, () => list())).toEqual({ ok: false, reason: 'unreadable' });
    expect(await window.store.update(ABSENT, () => list())).toEqual({ ok: false, reason: 'unreadable' });
    expect(window.fileSystem.files.get(FILE)).toEqual(bad);
    expect(listRenames(window.fileSystem)).toEqual([]);
    expect(everyFile(window.fileSystem)).toEqual(['pinned-context.json']);
  });
});

describe('a file over the byte bound', () => {
  const oversized = () => new TextEncoder().encode(`${text(bytesOf(list('Characters/alice.md')))}${' '.repeat(WORKSHOP_PINNED_CONTEXT_FILE_BYTES)}`);

  it('reads as unreadable, too-large, without its bytes being read', async () => {
    const window = host();
    window.fileSystem.files.set(FILE, oversized());
    const read = await window.store.read();
    expect(read).toMatchObject({ state: 'unreadable', reason: 'too-large' });
    expect(read.state === 'unreadable' && /^[0-9a-f]{64}$/.test(read.revision)).toBe(false);
    expect(window.fileSystem.readFileCalls).not.toContain(FILE);
  });

  it('is never written, even by an update naming its revision', async () => {
    const window = host();
    const bytes = oversized();
    window.fileSystem.files.set(FILE, bytes);
    const read = await window.store.read();
    const revision = read.state === 'unreadable' ? read.revision : '';
    expect(await window.store.update(revision, () => list())).toEqual({ ok: false, reason: 'unreadable' });
    expect(window.fileSystem.files.get(FILE)).toEqual(bytes);
    expect(window.fileSystem.readFileCalls).not.toContain(FILE);
    expect(listRenames(window.fileSystem)).toEqual([]);
    expect(everyFile(window.fileSystem)).toEqual(['pinned-context.json']);
  });

  // The re-review's F-04 probe, as written.
  it('refuses an oversized standing file before reading bytes even when it has an abandoned claim', async () => {
    const h = host();
    h.fileSystem.files.set(FILE, new Uint8Array(WORKSHOP_PINNED_CONTEXT_FILE_BYTES + 1).fill(32));
    h.fileSystem.files.set(`${FOLDER}/.pinned-context.json.claim-${NOW - STORED_FILE_CLAIM_LEASE_MS - 1}-old`, bytesOf(list('Characters/alice.md')));
    expect(await h.store.read()).toMatchObject({ state: 'unreadable', reason: 'too-large' });
    expect(h.fileSystem.readFileCalls).not.toContain(FILE);
  });

  it('keeps an abandoned claim beside an oversized list, unread and untouched', async () => {
    const window = host();
    const claim = claimOf(NOW - STORED_FILE_CLAIM_LEASE_MS - 1, 'old');
    window.fileSystem.files.set(FILE, new Uint8Array(WORKSHOP_PINNED_CONTEXT_FILE_BYTES + 1).fill(32));
    window.fileSystem.files.set(claim, bytesOf(list('Characters/alice.md')));
    await window.store.read();
    expect(window.fileSystem.readFileCalls).not.toContain(claim);
    expect(text(window.fileSystem.files.get(claim))).toBe(text(bytesOf(list('Characters/alice.md'))));
  });

  it('never reads an oversized abandoned claim beside a standing list, and sets it aside rather than deleting it', async () => {
    const window = host();
    const claim = claimOf(NOW - STORED_FILE_CLAIM_LEASE_MS - 1, 'big');
    const big = new Uint8Array(WORKSHOP_PINNED_CONTEXT_FILE_BYTES + 1).fill(32);
    window.fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    window.fileSystem.files.set(claim, big);
    expect(await window.store.read()).toMatchObject({ state: 'ok', list: list('Characters/alice.md') });
    expect(window.fileSystem.readFileCalls).not.toContain(claim);
    const aside = everyFile(window.fileSystem).filter((file) => file.startsWith('pinned-context.json.set-aside-'));
    expect(aside).toHaveLength(1);
    expect(window.fileSystem.files.get(path.join(FOLDER, aside[0]))?.byteLength).toBe(big.byteLength);
  });

  it('refuses a change whose list would pass the bound, and writes nothing', async () => {
    const window = host();
    const huge = () => list(...Array.from({ length: WORKSHOP_PINNED_CONTEXT_FILES }, (_, index) => `Notes/${index}-${'a'.repeat(7_000)}`));
    expect(await window.store.update(ABSENT, huge)).toEqual({ ok: false, reason: 'invalid', refusal: 'too-large' });
    expect(window.fileSystem.files.size).toBe(0);
  });
});

describe('claims settle by the shared primitive\'s rules', () => {
  it('puts back a list an abandoned claim holds, and reads it', async () => {
    const window = host();
    const old = NOW - STORED_FILE_CLAIM_LEASE_MS - 1;
    window.fileSystem.files.set(claimOf(old, 'gone'), bytesOf(list('Characters/alice.md')));
    expect(await window.store.read()).toMatchObject({ state: 'ok', list: list('Characters/alice.md') });
    expect(everyFile(window.fileSystem)).toEqual(['pinned-context.json']);
  });

  it('reads a live claim as busy, and writes nothing over it', async () => {
    const window = host();
    window.fileSystem.files.set(claimOf(NOW - 1_000, 'live'), bytesOf(list('Characters/alice.md')));
    expect(await window.store.read()).toEqual({ state: 'busy' });
    expect(await window.store.update(ABSENT, pin('Characters/the-hatter.md'))).toEqual({ ok: false, reason: 'busy' });
    expect(everyFile(window.fileSystem)).toEqual([`.pinned-context.json.claim-${NOW - 1_000}-live`]);
  });

  it('removes an abandoned claim beside the standing list only when it holds the very bytes that stand', async () => {
    const window = host();
    window.fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    window.fileSystem.files.set(claimOf(NOW - STORED_FILE_CLAIM_LEASE_MS - 1, 'left'), bytesOf(list('Characters/alice.md')));
    expect(await window.store.read()).toMatchObject({ state: 'ok', list: list('Characters/alice.md') });
    expect(everyFile(window.fileSystem)).toEqual(['pinned-context.json']);
  });

  it('sets aside any other abandoned claim beside the standing list, never deleting it (PR #204 F-02)', async () => {
    const window = host();
    window.fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md', 'Characters/the-hatter.md')));
    window.fileSystem.files.set(claimOf(NOW - STORED_FILE_CLAIM_LEASE_MS - 1, 'left'), bytesOf(list('Characters/alice.md')));
    expect(await window.store.read()).toMatchObject({ state: 'ok', list: list('Characters/alice.md', 'Characters/the-hatter.md') });
    expect(everyFile(window.fileSystem)).toEqual(['pinned-context.json', 'pinned-context.json.set-aside-s1']);
    expect(text(window.fileSystem.files.get(path.join(FOLDER, 'pinned-context.json.set-aside-s1')))).toBe(text(bytesOf(list('Characters/alice.md'))));
  });

  it('keeps a refused rewrite\'s claimed bytes through a failed release, and sets them aside once the fault clears and the lease passes (PR #204 F-02)', async () => {
    const window = host();
    const { fileSystem } = window;
    const original = bytesOf(list('Characters/alice.md'));
    const edited = bytesOf(list('Characters/the-hatter.md'));
    const competing = bytesOf(list('Characters/the-queen.md'));
    fileSystem.files.set(FILE, original);
    const rename = fileSystem.rename.bind(fileSystem);
    let claimed = false;
    let releaseFails = true;
    jest.spyOn(fileSystem, 'rename').mockImplementation(async (from, to, options) => {
      if (from === FILE && /\.claim-/.test(to) && !claimed) {
        // A hand edit lands just before the claim, which takes it; another list then takes the saved name.
        claimed = true;
        fileSystem.files.set(FILE, edited);
        await rename(from, to, options);
        fileSystem.files.set(FILE, competing);
        return;
      }
      if (/\.claim-/.test(from) && releaseFails) {
        throw Object.assign(new Error('EACCES: claim'), { code: 'EACCES' });
      }
      return rename(from, to, options);
    });

    expect(await window.store.update(workshopPinnedContextRevisionOf(original), pin('Characters/the-rabbit.md'))).toMatchObject({ ok: false, reason: 'changed' });
    const holding = () => [...fileSystem.files.entries()].filter(([, bytes]) => text(bytes) === text(edited)).map(([file]) => path.basename(file));
    expect(holding()).toHaveLength(1);
    expect(holding()[0]).toMatch(/^\.pinned-context\.json\.claim-/);

    releaseFails = false;
    window.clock.at = NOW + STORED_FILE_CLAIM_LEASE_MS + 1;
    expect(await window.store.read()).toMatchObject({ state: 'ok', list: list('Characters/the-queen.md') });
    expect(holding()).toHaveLength(1);
    expect(holding()[0]).toMatch(/^pinned-context\.json\.set-aside-/);
  });

  it('leaves the folder\'s other files alone', async () => {
    const window = host();
    window.fileSystem.files.set(path.join(FOLDER, '.memory.md.claim-1000000000000-x'), new Uint8Array([1]));
    expect(await window.store.read()).toEqual({ state: 'absent', revision: ABSENT });
    expect(everyFile(window.fileSystem)).toEqual(['.memory.md.claim-1000000000000-x']);
  });
});

describe('logs and shutdown', () => {
  it('logs outcomes and categories, never a path or the list', async () => {
    const window = host();
    await window.store.update(ABSENT, pin('Characters/alice.md'));
    await window.store.update('stale', pin('Characters/the-hatter.md'));
    window.fileSystem.files.set(FILE, new TextEncoder().encode('{"format":1,"files":[{"path":"Characters/../alice.md"}]}'));
    await window.store.update(ABSENT, () => list());
    expect(window.lines.length).toBeGreaterThan(0);
    for (const line of window.lines) {
      expect(line).not.toMatch(/alice|hatter|Characters|workspace|pinned-context\.json/i);
    }
  });

  it('waits for every owed write before shutDown resolves', async () => {
    const window = host();
    const writing = window.store.update(ABSENT, pin('Characters/alice.md'));
    await window.store.shutDown();
    expect(window.fileSystem.files.has(FILE)).toBe(true);
    await expect(writing).resolves.toMatchObject({ ok: true });
  });
});

describe('a read pinned to a file (Slice 2b, PR #208 F01)', () => {
  it('reads the list when its turn finds the file the caller captured', async () => {
    const window = host();
    window.fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));

    await expect(window.store.read({ filePath: FILE })).resolves.toMatchObject({ state: 'ok', list: list('Characters/alice.md') });
  });

  it('answers workspace-changed, and reads nothing, when its turn finds another project\'s list', async () => {
    const window = host();
    window.fileSystem.files.set(OTHER_FILE, bytesOf(list('Private/queen.md')));
    const reading = window.store.read({ filePath: FILE });
    window.folders.splice(0, 1, { path: OTHER_ROOT, name: 'other' });

    await expect(reading).resolves.toEqual({ state: 'unavailable', reason: 'workspace-changed' });
    expect(window.fileSystem.readFileCalls).not.toContain(OTHER_FILE);
  });

  it('keeps today\'s live read for a caller that names no file', async () => {
    const window = host();
    window.fileSystem.files.set(OTHER_FILE, bytesOf(list('Private/queen.md')));
    const reading = window.store.read();
    window.folders.splice(0, 1, { path: OTHER_ROOT, name: 'other' });

    await expect(reading).resolves.toMatchObject({ state: 'ok', list: list('Private/queen.md') });
  });
});
