/**
 * The library's writes (ADR 2026-11-04 D4, D5, D8, D10; epic Slice 3), over
 * a real ProjectMemoryStore on the memory file system. *Alice*, made-up ids.
 */
import * as path from 'node:path';
import type { WorkshopMemoryDraft } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { allLines, libraryHost, MEMORY, memory, writerMemory } from './projectMemoryLibraryHost';

const SENTINEL = 'QQX-SENTINEL';

const draft = (changes: Partial<WorkshopMemoryDraft> = {}): WorkshopMemoryDraft => ({
  title: 'The Cheshire Cat is never seen arriving',
  kind: 'canon',
  summary: 'It is always already there.',
  body: 'Every scene with the Cat starts after it has appeared.',
  supersedes: [],
  pinned: false,
  ...changes
});

const WRITER = { origin: 'writer' as const, sourceTurns: [] };
const PROPOSED = {
  origin: 'proposed' as const,
  proposedBy: 'jill',
  sourceSession: 'live-room-0001',
  sourceTurns: ['turn-4-user-1700000000000', 'turn-5-assistant-1700000001000']
};

const bytesOf = (fileSystem: MemoryFileSystem, file: string): string => new TextDecoder().decode(fileSystem.files.get(file));
const memoryFiles = (fileSystem: MemoryFileSystem): string[] =>
  [...fileSystem.files.keys()].filter((file) => path.dirname(file) === MEMORY && file.endsWith('.md')).sort();

describe('ProjectMemoryLibrary writes', () => {
  it('saves a persona\'s proposal with the host\'s provenance, and a writer\'s own with none', async () => {
    const host = libraryHost();
    const proposed = await host.library.save(draft(), PROPOSED);
    const own = await host.library.save(draft({ title: 'Tea is at six' }), WRITER);

    expect(proposed).toMatchObject({ kind: 'written', changedMeaning: true, memory: { origin: 'proposed', proposedBy: 'jill', sourceSession: 'live-room-0001', status: 'active' } });
    expect(own).toMatchObject({ kind: 'written', memory: { origin: 'writer', sourceTurns: [] } });
    expect(proposed.kind === 'written' && proposed.version).toMatch(/^[0-9a-f]{12}$/);
    expect(memoryFiles(host.fileSystem)).toHaveLength(2);
  });

  it('writes with memory off (the writer acts), and refuses where the workspace holds no memory', async () => {
    const off = libraryHost({ mode: 'off' });
    expect((await off.library.save(draft(), WRITER)).kind).toBe('written');

    const none = libraryHost({ folders: [] });
    expect(await none.library.save(draft(), WRITER)).toEqual({ kind: 'refused', reason: 'no-workspace' });
    const changed = libraryHost({ scope: { available: false, reason: 'workspace-changed' } as never });
    expect(await changed.library.save(draft(), WRITER)).toEqual({ kind: 'refused', reason: 'workspace-changed' });
  });

  describe('supersession (D4)', () => {
    it('writes one new file naming the old; the old reads as superseded, leaves the catalog, and is untouched on disk', async () => {
      const host = libraryHost();
      const oldFile = host.put(memory({ id: 'mem-1a9e04', title: 'The Rabbit\'s watch stops at six' }));
      const before = bytesOf(host.fileSystem, oldFile);

      const saved = await host.library.save(draft({ supersedes: ['mem-1a9e04', 'mem-ffffff'] }), PROPOSED);

      expect(saved).toMatchObject({ kind: 'written', memory: { supersedes: ['mem-1a9e04'] } });
      expect(bytesOf(host.fileSystem, oldFile)).toBe(before);
      expect(memoryFiles(host.fileSystem)).toHaveLength(2);
      const catalog = await host.library.catalog();
      const old = catalog.kind === 'catalog' ? catalog.set.memories.find((listed) => listed.memory.id === 'mem-1a9e04') : undefined;
      expect(old).toMatchObject({ superseded: true });
      const frame = await host.library.frame();
      expect(frame.kind === 'frame' && frame.frame.entries).not.toContain('mem-1a9e04');
    });

    it('Forget (archive) of the newer memory keeps the old one superseded (PR #192 N-01)', async () => {
      const host = libraryHost();
      host.put(memory({ id: 'mem-1a9e04' }));
      const saved = await host.library.save(draft({ supersedes: ['mem-1a9e04'] }), WRITER);
      const newer = saved.kind === 'written' ? saved.memory.id : '';

      expect(await host.library.forget(newer)).toMatchObject({ kind: 'written', memory: { status: 'archived' }, changedMeaning: false });

      const catalog = await host.library.catalog();
      const old = catalog.kind === 'catalog' ? catalog.set.memories.find((listed) => listed.memory.id === 'mem-1a9e04') : undefined;
      expect(old?.superseded).toBe(true);
    });
  });

  describe('update (D10)', () => {
    it('stamps updated for a change to what the memory says, never for a load-in-full toggle or a Forget', async () => {
      const host = libraryHost();
      host.put(writerMemory({ id: 'mem-7f3c2a', updated: '2026-11-02T00:00:00Z', body: '\nSettled at the tea party.\n' }));

      const toggled = await host.library.update('mem-7f3c2a', draft({
        title: 'The Rabbit\'s watch runs backward',
        summary: 'From chapter 3 on, the White Rabbit\'s watch runs backward.',
        body: 'Settled at the tea party.',
        pinned: true
      }));
      expect(toggled).toMatchObject({ kind: 'written', changedMeaning: false, memory: { pinned: true, updated: '2026-11-02T00:00:00Z' } });

      const edited = await host.library.update('mem-7f3c2a', draft({ title: 'The watch runs backward', summary: 'From chapter 3 on.', body: 'Settled at the tea party.', pinned: true }));
      expect(edited).toMatchObject({ kind: 'written', changedMeaning: true, memory: { title: 'The watch runs backward', updated: '2026-11-04T09:30:00Z' } });

      const forgotten = await host.library.forget('mem-7f3c2a');
      expect(forgotten).toMatchObject({ kind: 'written', memory: { status: 'archived', updated: '2026-11-04T09:30:00Z' } });
      expect(await host.library.restore('mem-7f3c2a')).toMatchObject({ kind: 'written', memory: { status: 'active' } });
    });

    it('keeps an unchanged body byte for byte', async () => {
      const host = libraryHost();
      const file = host.put(writerMemory({ id: 'mem-7f3c2a', body: '\r\nKept   as   written.\r\n\r\n' }));
      await host.library.update('mem-7f3c2a', draft({ title: 'Renamed', summary: 'S', body: 'Kept   as   written.' }));
      expect(bytesOf(host.fileSystem, file)).toContain('\r\nKept   as   written.\r\n\r\n');
    });

    it('refuses an unknown id', async () => {
      const host = libraryHost();
      expect(await host.library.update('mem-abcdef', draft())).toEqual({ kind: 'refused', reason: 'missing' });
    });
  });

  describe('the pinned budget on edit (D5, PR #192 F-04)', () => {
    const budget = PROMPT_BUDGETS.workshopProjectMemory.pinnedTokens;
    // About 4,350 tokens in one memory loaded in full (2,900 words at 1.5
    // tokens each), within the body's 8,000 characters.
    const big = Array.from({ length: 2_900 }, () => 'a').join(' ');

    it('refuses enlarging a pinned body past the budget, with the numbers, and leaves the file unchanged', async () => {
      const host = libraryHost();
      host.put(writerMemory({ id: 'mem-1a9e04', pinned: true, title: 'Big', body: `\n${big}\n`, created: '2026-10-01T00:00:00Z' }));
      const file = host.put(writerMemory({ id: 'mem-7f3c2a', pinned: true, title: 'Small', body: '\nShort.\n' }));
      const before = bytesOf(host.fileSystem, file);

      const refused = await host.library.update('mem-7f3c2a', draft({ title: 'Small', body: big.slice(0, 4_000), pinned: true }));

      expect(refused).toMatchObject({ kind: 'refused', reason: 'pinned-budget', budget: { budgetTokens: budget, refused: true } });
      expect(refused.kind === 'refused' && refused.budget!.totalTokens).toBeGreaterThan(budget);
      expect(bytesOf(host.fileSystem, file)).toBe(before);
    });

    it('refuses turning load-in-full on past the budget, and allows shortening or turning it off', async () => {
      const host = libraryHost();
      host.put(writerMemory({ id: 'mem-1a9e04', pinned: true, body: `\n${big}\n` }));
      host.put(writerMemory({ id: 'mem-7f3c2a', pinned: false, title: 'Other', body: `\n${big.slice(0, 1_200)}\n` }));

      expect(await host.library.update('mem-7f3c2a', draft({ title: 'Other', body: big.slice(0, 1_200), pinned: true })))
        .toMatchObject({ kind: 'refused', reason: 'pinned-budget' });
      expect(await host.library.update('mem-7f3c2a', draft({ title: 'Other', body: 'Short now.', pinned: true })))
        .toMatchObject({ kind: 'written' });
      expect((await host.library.estimatePinned('mem-1a9e04', draft({ body: big, pinned: false }))))
        .toMatchObject({ kind: 'estimate', estimate: { refused: false } });
    });

    it('lets a hand-made overflow shrink: an edit that lowers the total is never refused', async () => {
      const host = libraryHost();
      host.put(writerMemory({ id: 'mem-1a9e04', pinned: true, body: `\n${big}\n` }));
      host.put(writerMemory({ id: 'mem-7f3c2a', pinned: true, title: 'Also big', body: `\n${big}\n` }));
      expect(await host.library.update('mem-7f3c2a', draft({ title: 'Also big', body: big.slice(0, 2_000), pinned: true })))
        .toMatchObject({ kind: 'written' });
    });

    it('checks a new memory set to load in full too', async () => {
      const host = libraryHost();
      host.put(writerMemory({ id: 'mem-1a9e04', pinned: true, body: `\n${big}\n` }));
      expect(await host.library.save(draft({ body: big.slice(0, 1_200), pinned: true }), WRITER))
        .toMatchObject({ kind: 'refused', reason: 'pinned-budget' });
      expect(memoryFiles(host.fileSystem)).toHaveLength(1);
    });
  });

  it('two windows on one folder save at once, and both files stand', async () => {
    const one = libraryHost();
    const two = libraryHost({ fileSystem: one.fileSystem });
    const [left, right] = await Promise.all([
      one.library.save(draft({ title: 'Left' }), WRITER),
      two.library.save(draft({ title: 'Right' }), WRITER)
    ]);
    expect(left.kind).toBe('written');
    expect(right.kind).toBe('written');
    expect(memoryFiles(one.fileSystem)).toHaveLength(2);
  });

  it('logs ids and reasons, never a title, summary, body or supersedes', async () => {
    const host = libraryHost();
    host.put(writerMemory({ id: 'mem-1a9e04' }));
    const saved = await host.library.save(draft({
      title: `T ${SENTINEL}`, summary: `S ${SENTINEL}`, body: `B ${SENTINEL}`, supersedes: ['mem-1a9e04', 'mem-ffffff']
    }), PROPOSED);
    const id = saved.kind === 'written' ? saved.memory.id : '';
    await host.library.update(id, draft({ title: `T2 ${SENTINEL}`, body: `B2 ${SENTINEL}` }));
    await host.library.forget(id);
    await host.library.estimatePinned(id, draft({ body: SENTINEL }));
    await host.library.save(draft({ title: `${SENTINEL}\nbad` }), WRITER);
    expect(allLines(host.lines)).not.toContain(SENTINEL);
    expect(allLines(host.lines)).toContain(`saved id=${id}`);
  });
});
