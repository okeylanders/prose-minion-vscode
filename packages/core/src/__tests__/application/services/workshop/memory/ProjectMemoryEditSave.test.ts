/**
 * An edit suggestion's Save (epic Slice 6c): an ordinary update through the
 * library's queue, applied only while the note's D14 version is the one the
 * edit was anchored against, checked at the write's turn and again under
 * the store's claim. A changed note writes nothing. A real ProjectMemoryStore
 * on the memory file system. *Alice*, made-up ids.
 */

import * as path from 'node:path';
import type { WorkshopMemoryDraft } from '@messages';
import { decodeProjectMemory } from '@/infrastructure/storage/ProjectMemoryCodec';
import { projectMemoryEditToken } from '@/application/services/workshop/memory/ProjectMemoryVersion';
import { allLines, holdOnce, libraryHost, MEMORY, memory } from './projectMemoryLibraryHost';

const NOTE = memory();
const TOKEN = projectMemoryEditToken(NOTE, false);
const RESULT: WorkshopMemoryDraft = {
  title: NOTE.title,
  kind: NOTE.kind,
  summary: NOTE.summary,
  body: 'Settled at the tea party. Alice notices first, and says nothing.',
  supersedes: [],
  pinned: false
};
const FILE = path.join(MEMORY, '7f3c2a-note.md');

const fileText = (host: ReturnType<typeof libraryHost>): string => new TextDecoder().decode(host.fileSystem.files.get(FILE));
const bodyOf = (host: ReturnType<typeof libraryHost>): string => {
  const decoded = decodeProjectMemory(fileText(host));
  return decoded.kind === 'memory' ? decoded.memory.body.trim() : 'unreadable';
};

const noteOf = (host: ReturnType<typeof libraryHost>) => {
  const decoded = decodeProjectMemory(fileText(host));
  if (decoded.kind !== 'memory') {
    throw new Error('unreadable');
  }
  return decoded.memory;
};

describe('ProjectMemoryLibrary.edit with the token an edit was anchored against', () => {
  it('writes the result while the note is the version it was suggested against', async () => {
    const host = libraryHost();
    host.put(NOTE);
    const result = await host.library.edit(NOTE.id, RESULT, { expectedToken: TOKEN });
    expect(result).toMatchObject({ kind: 'written', changedMeaning: true, memory: { id: NOTE.id } });
    expect(bodyOf(host)).toBe(RESULT.body);
  });

  it('refuses, writing nothing, when the note changed before the write\'s turn', async () => {
    const host = libraryHost();
    host.put({ ...NOTE, summary: 'Alice changed this by hand.' });
    const before = fileText(host);
    const result = await host.library.edit(NOTE.id, RESULT, { expectedToken: TOKEN });
    expect(result).toEqual({ kind: 'refused', reason: 'changed' });
    expect(fileText(host)).toBe(before);
    expect(allLines(host.lines)).toContain(`update refused id=${NOTE.id} reason=changed`);
  });

  it('refuses, writing nothing, when another window changes the note between the turn and the commit', async () => {
    const host = libraryHost();
    host.put(NOTE);
    // The turn's listing sees the version; the store's claimed read finds another window's change.
    const hold = holdOnce(host.store as never, 'replace', () => true);
    const saving = host.library.edit(NOTE.id, RESULT, { expectedToken: TOKEN });
    await hold.arrived;
    host.put({ ...NOTE, body: 'Another window wrote this.' });
    const otherWindow = fileText(host);
    hold.release();
    expect(await saving).toEqual({ kind: 'refused', reason: 'changed' });
    expect(fileText(host)).toBe(otherWindow);
  });

  it('a note that became superseded meanwhile is another version: nothing is written', async () => {
    const host = libraryHost();
    host.put(NOTE);
    host.put(memory({ id: 'mem-000002', title: 'The watch is broken', supersedes: [NOTE.id] }), '000002-note.md');
    const before = fileText(host);
    expect(await host.library.edit(NOTE.id, RESULT, { expectedToken: TOKEN })).toEqual({ kind: 'refused', reason: 'changed' });
    expect(fileText(host)).toBe(before);
  });

  it('keeps the project it was asked in: a workspace changed before its turn writes nothing (PR #202 F01)', async () => {
    const host = libraryHost();
    host.put(NOTE);
    const before = fileText(host);
    const hold = holdOnce(host.store as never, 'list', () => true);
    const saving = host.library.edit(NOTE.id, RESULT, { expectedToken: TOKEN });
    await hold.arrived;
    host.state.folders = [{ path: '/elsewhere', name: 'elsewhere' }];
    hold.release();
    expect(await saving).toMatchObject({ kind: 'refused' });
    expect(fileText(host)).toBe(before);
  });

  it('an edit without a version is the writer\'s ordinary update, as before', async () => {
    const host = libraryHost();
    host.put({ ...NOTE, summary: 'Alice changed this by hand.' });
    expect(await host.library.edit(NOTE.id, RESULT)).toMatchObject({ kind: 'written' });
    expect(bodyOf(host)).toBe(RESULT.body);
  });

  it('a supersedes-only change before the write\'s turn refuses, and leaves the newer bytes exactly (PR #212 F-02)', async () => {
    const host = libraryHost();
    host.put(memory({ id: 'mem-000001', title: 'The watch stops at six' }), '000001-note.md');
    host.put({ ...NOTE, supersedes: ['mem-000001'] });
    const newer = fileText(host);
    expect(await host.library.edit(NOTE.id, RESULT, { expectedToken: TOKEN })).toEqual({ kind: 'refused', reason: 'changed' });
    expect(fileText(host)).toBe(newer);
  });

  it('a supersedes-only change between the turn and the claimed rewrite refuses, and leaves the newer bytes exactly (PR #212 F-02)', async () => {
    const host = libraryHost();
    host.put(memory({ id: 'mem-000001', title: 'The watch stops at six' }), '000001-note.md');
    host.put(NOTE);
    const hold = holdOnce(host.store as never, 'replace', () => true);
    const saving = host.library.edit(NOTE.id, RESULT, { expectedToken: TOKEN });
    await hold.arrived;
    host.put({ ...NOTE, supersedes: ['mem-000001'] });
    const newer = fileText(host);
    hold.release();
    expect(await saving).toEqual({ kind: 'refused', reason: 'changed' });
    expect(fileText(host)).toBe(newer);
  });

  it('a note superseded by another between the turn and the claimed rewrite refuses: its own bytes never changed (PR #212 F-03)', async () => {
    const host = libraryHost();
    host.put(NOTE);
    const before = fileText(host);
    const hold = holdOnce(host.store as never, 'replace', () => true);
    const saving = host.library.edit(NOTE.id, RESULT, { expectedToken: TOKEN });
    await hold.arrived;
    host.put(memory({ id: 'mem-000002', title: 'The watch is broken', supersedes: [NOTE.id] }), '000002-note.md');
    hold.release();
    expect(await saving).toEqual({ kind: 'refused', reason: 'changed' });
    expect(fileText(host)).toBe(before);
  });

  it('keeps every id the note supersedes, a note the folder can\'t read included (PR #212 F-01)', async () => {
    const host = libraryHost();
    host.put(memory({ id: 'mem-000001', title: 'The watch stops at six' }), '000001-note.md');
    const related = { ...NOTE, supersedes: ['mem-000001', 'mem-000002'] };
    host.put(related);
    const draft = { ...RESULT, supersedes: ['mem-000001', 'mem-000002'] };
    expect(await host.library.edit(NOTE.id, draft, { expectedToken: projectMemoryEditToken(related, false) })).toMatchObject({ kind: 'written' });
    expect(noteOf(host).supersedes).toEqual(['mem-000001', 'mem-000002']);
  });
});
