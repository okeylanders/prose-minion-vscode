/**
 * The store's paged walk (ADR 2026-11-05 D8, PR #214 F-02): every named
 * session file in one stable order, past the browser's 200-file cap, each
 * page bounded by files and bytes and always moving on, read-only.
 */

import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import {
  readWorkshopSessionPage,
  WorkshopSessionPageRead
} from '@/infrastructure/storage/WorkshopSessionStorePage';
import { WorkshopSessionStore } from '@/infrastructure/storage/WorkshopSessionStore';
import { WORKSHOP_BOOKMARK_BROWSER_LIMITS } from '@shared/constants/workshopBookmarkBrowser';
import { RECALL_WORKSPACE, recallLog } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import { saveBookmarkedSessions } from '@/__tests__/application/services/workshop/recall/workshopBookmarkBrowserFixtures';

const sized = (bytes: number) => async (): Promise<WorkshopSessionPageRead> => ({ kind: 'read', bytes });

/** Walk every page from the start, returning each page's cursors. */
async function walk(page: (after?: string) => Promise<{ entries: readonly { cursor: string }[]; next?: string }>) {
  const pages: string[][] = [];
  let after: string | undefined;
  do {
    const result = await page(after);
    pages.push(result.entries.map((entry) => entry.cursor));
    after = result.next;
  } while (after !== undefined);
  return pages;
}

describe('readWorkshopSessionPage', () => {
  const names = ['2026-01-a.json', '2026-03-c.json', '2026-02-b.json', '2026-04-d.json', '2026-05-e.json'];

  it('walks newest first, by cursor, until every file is read', async () => {
    const pages = await walk((after) => readWorkshopSessionPage(names, { ...(after ? { after } : {}), limit: 2 }, sized(1)));
    expect(pages).toEqual([
      ['2026-05-e.json', '2026-04-d.json'],
      ['2026-03-c.json', '2026-02-b.json'],
      ['2026-01-a.json']
    ]);
  });

  it('counts what is left, and ends with no cursor', async () => {
    const first = await readWorkshopSessionPage(names, { limit: 2 }, sized(1));
    expect(first).toMatchObject({ next: '2026-04-d.json', remaining: 3 });
    const last = await readWorkshopSessionPage(names, { after: '2026-02-b.json', limit: 2 }, sized(1));
    expect(last).toEqual({ entries: [{ cursor: '2026-01-a.json' }], remaining: 0 });
  });

  it('caps a page at the store\'s own session bound, whatever the caller asks', async () => {
    const many = Array.from({ length: 60 }, (_, index) => `2026-${String(index).padStart(3, '0')}.json`);
    const page = await readWorkshopSessionPage(many, { limit: 1_000 }, sized(1));
    expect(page.entries).toHaveLength(WORKSHOP_BOOKMARK_BROWSER_LIMITS.bookmarkBrowserSessions);
  });

  it('stops at the byte budget without omitting a session: the next page starts at the first one left', async () => {
    const limits = { bookmarkBrowserSessions: 25, bookmarkBrowserBytes: 100 };
    const sizes = new Map([
      ['2026-05-e.json', 60], ['2026-04-d.json', 60], ['2026-03-c.json', 250], ['2026-02-b.json', 10], ['2026-01-a.json', 10]
    ]);
    const read = async (name: string): Promise<WorkshopSessionPageRead> => ({ kind: 'read', bytes: sizes.get(name)! });
    const pages = await walk((after) => readWorkshopSessionPage(names, { ...(after ? { after } : {}), limit: 25 }, read, undefined, limits));
    // 60 + 60 reaches the budget; a file over it is read alone; the rest fit together.
    expect(pages).toEqual([
      ['2026-05-e.json', '2026-04-d.json'],
      ['2026-03-c.json'],
      ['2026-02-b.json', '2026-01-a.json']
    ]);
    expect(pages.flat().sort()).toEqual([...names].sort());
  });

  it('passes over a file gone since the listing, and keeps one it could not summarize', async () => {
    const read = async (name: string): Promise<WorkshopSessionPageRead> =>
      name === '2026-04-d.json' ? { kind: 'gone' } : { kind: 'read', bytes: 1 };
    const page = await readWorkshopSessionPage(names, { limit: 2 }, read);
    expect(page.entries.map((entry) => entry.cursor)).toEqual(['2026-05-e.json', '2026-03-c.json']);
    expect(page.entries.every((entry) => entry.summary === undefined)).toBe(true);
    expect(page).toMatchObject({ next: '2026-03-c.json', remaining: 2 });
  });

  it('stops when cancelled', async () => {
    const controller = new AbortController();
    const read = async (): Promise<WorkshopSessionPageRead> => {
      controller.abort();
      return { kind: 'read', bytes: 1 };
    };
    await expect(readWorkshopSessionPage(names, { limit: 5 }, read, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('WorkshopSessionStore.listPage', () => {
  const save = (store: WorkshopSessionStore, count: number) => saveBookmarkedSessions(store, count);

  it('reaches every one of 205 sessions page by page, where the browser\'s listing stops at 200', async () => {
    const fs = new MemoryFileSystem();
    const store = new WorkshopSessionStore(fs, RECALL_WORKSPACE, recallLog());
    await save(store, 205);
    expect((await store.list()).truncated).toBe(true);
    const writes = [jest.spyOn(fs, 'writeFile'), jest.spyOn(fs, 'rename'), jest.spyOn(fs, 'delete')];

    const ids: string[] = [];
    let after: string | undefined;
    let pages = 0;
    do {
      const page = await store.listPage({ ...(after ? { after } : {}), limit: 25 });
      pages += 1;
      ids.push(...page.entries.map((entry) => entry.summary!.sessionId));
      after = page.next;
    } while (after !== undefined);

    expect(pages).toBe(9);
    expect(new Set(ids).size).toBe(205);
    expect(ids).toHaveLength(205);
    // Read-only: paging writes, renames and deletes nothing.
    writes.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });

  it('bounds a page by the files\' bytes, and a cold corpus past the budget still reaches every session', async () => {
    const fs = new MemoryFileSystem();
    const store = new WorkshopSessionStore(fs, RECALL_WORKSPACE, recallLog(), undefined, undefined, {
      bookmarkBrowserSessions: 25,
      bookmarkBrowserBytes: 1
    });
    await save(store, 4);
    const pages = await walk((after) => store.listPage({ ...(after ? { after } : {}), limit: 25 }));
    expect(pages.map((page) => page.length)).toEqual([1, 1, 1, 1]);
  });

  it('answers an empty page for a workspace with no sessions folder', async () => {
    const store = new WorkshopSessionStore(new MemoryFileSystem(), RECALL_WORKSPACE, recallLog());
    expect(await store.listPage({ limit: 25 })).toEqual({ entries: [], remaining: 0 });
  });
});
