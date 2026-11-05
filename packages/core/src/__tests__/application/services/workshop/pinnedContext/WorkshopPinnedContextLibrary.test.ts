/**
 * WorkshopPinnedContextLibrary (ADR 2026-11-04 D3, D5, D8; Slice 2b):
 * `describe()` in the tab's words, and the accepted-room check its writes
 * pass the store as `beforeCommit`. Through the real store and intake
 * service. *Alice*, with made-up paths and text.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION } from '@/infrastructure/storage/WorkshopPinnedContextStore';
import { LIST_FILE, ROOT, seedHost, words } from './pinnedContextSeedHost';

const BUDGET = PROMPT_BUDGETS.contextAttachments.words;

describe('describe(): the list as the tab draws it', () => {
  it('resolves every entry now: its group or the workspace, its words, and its state in the tab\'s words', async () => {
    const host = seedHost({ catalog: [{ group: 'characters', path: 'Characters/alice.md' }] });
    host.write('Characters/alice.md', 'Alice is seven.');
    host.write('Project/brief.md', 'A girl, a hole, a garden.');
    host.write('Drafts/manuscript.md', words(BUDGET + 5));
    host.write('Characters/blank.md', ' ');
    host.pin('Characters/alice.md', 'Project/brief.md', 'Drafts/manuscript.md', 'Characters/the-cheshire-cat.md', 'Characters/blank.md');

    const description = await host.library.describe();

    expect(description).toMatchObject({ state: 'listed', words: 3 + 6 + BUDGET });
    if (description.state !== 'listed') {
      throw new Error('not listed');
    }
    expect(description.rows).toEqual([
      { path: 'Characters/alice.md', label: 'alice.md', source: { kind: 'catalog', group: 'characters' }, state: 'ready', words: 3 },
      { path: 'Project/brief.md', label: 'brief.md', source: { kind: 'workspace' }, state: 'ready', words: 6 },
      {
        path: 'Drafts/manuscript.md',
        label: 'manuscript.md',
        source: { kind: 'workspace' },
        state: 'head-sliced',
        words: BUDGET,
        totalWords: BUDGET + 5,
        stateWords: 'Attached as its first 100,000 of 100,005 words'
      },
      { path: 'Characters/the-cheshire-cat.md', label: 'the-cheshire-cat.md', state: 'missing', words: 0, stateWords: 'Not found' },
      {
        path: 'Characters/blank.md',
        label: 'blank.md',
        source: { kind: 'workspace' },
        state: 'unreadable',
        words: 0,
        fault: 'empty',
        stateWords: 'Can’t read: it’s empty.'
      }
    ]);
  });

  it('an absent list is listed and empty, at the absent revision', async () => {
    await expect(seedHost().library.describe()).resolves.toEqual({
      state: 'listed', revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION, rows: [], words: 0, absent: true
    });
  });

  it('an unreadable list names its reason and the entry at fault', async () => {
    const host = seedHost();
    host.fileSystem.files.set(LIST_FILE, new TextEncoder().encode('{"format": 1, "files": [{"path": "a.md"}, {"path": "a.md"}]}'));

    await expect(host.library.describe()).resolves.toMatchObject({
      state: 'unreadable',
      reason: 'duplicate',
      entry: 1,
      words: 'pinned-context.json can’t be read. It names one file twice (entry 2). Nothing is attached from it until it’s fixed. Fix it in the editor.'
    });
  });

  it.each([
    ['no folder', [], 'no-workspace', 'No folder is open'],
    ['several folders', [{ path: ROOT, name: 'novel' }, { path: '/workspace/notes', name: 'notes' }], 'multi-root', 'several folders']
  ])('with %s, the list is unavailable, with the Memory tab\'s notice', async (_name, folders, reason, phrase) => {
    const host = seedHost({ folders: [...folders] });

    const description = await host.library.describe();

    expect(description).toMatchObject({ state: 'unavailable', reason });
    expect(description.state === 'unavailable' && description.words).toContain('Pinned context isn’t available here.');
    expect(description.state === 'unavailable' && description.words).toContain(phrase);
  });
});

describe('the accepted-room check (D5; PR #202 F01)', () => {
  it('holds while the live room and the folder stay, and fails when either moves', () => {
    const host = seedHost();
    const ask = host.library.askLiveRoom();
    expect(ask.accepted).toBe(true);
    expect(ask.still()).toBe(true);

    host.scope.current = () => ({ available: true, liveSessionId: 'room-2' });
    expect(ask.still()).toBe(false);

    host.scope.current = () => ({ available: true, liveSessionId: 'room-1' });
    expect(ask.still()).toBe(true);
    host.folders.splice(0, 1, { path: '/workspace/other', name: 'other' });
    expect(ask.still()).toBe(false);
  });

  it('a write is never asked before the coordinator settles a room; a seed is, as the first room', () => {
    const host = seedHost({ scope: () => ({ available: false, reason: 'not-ready' }) });
    expect(host.library.askLiveRoom().accepted).toBe(false);
    expect(host.library.askSeedWorkspace().accepted).toBe(true);

    host.scope.current = () => ({ available: false, reason: 'workspace-changed' });
    expect(host.library.askSeedWorkspace().accepted).toBe(false);
  });

  it('is the beforeCommit that withdraws a store write once the room has moved', async () => {
    const host = seedHost();
    const ask = host.library.askLiveRoom();
    host.scope.current = () => ({ available: true, liveSessionId: 'room-2' });

    const result = await host.store.update(
      WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION,
      (list) => ({ files: [...list.files, { path: 'Characters/alice.md' }] }),
      { beforeCommit: ask.still }
    );

    expect(result).toEqual({ ok: false, reason: 'unavailable' });
    expect(host.fileSystem.files.has(LIST_FILE)).toBe(false);
  });
});
