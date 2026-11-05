/**
 * PR #216 F-01: bookmark paging never changes how an exact action resolves a
 * session id. Astra's witnesses, as regressions, with the real store, the real
 * recall service and the normal 25-file pages: two older files claim one id,
 * behind the browser's 200-file cutoff, on one page (200 newer files) and
 * split across two pages (224 newer files).
 *
 * - Before and after a full walk, an exact read of the id refuses the
 *   conflict: paging never writes the exact-read path cache.
 * - The walk never resolves the id to one file: each claiming file is named
 *   unreadable on whichever page it lands, and never counted as read.
 * - A unique session still reads, by the page's own file.
 */

import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import {
  WorkshopNamedSessionIdentityConflictError,
  WorkshopSessionStore
} from '@/infrastructure/storage/WorkshopSessionStore';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import type { WorkshopRecallBookmarkPage } from '@/application/services/workshop/recall/WorkshopRecallBookmarkPage';
import { RECALL_WORKSPACE, recallLog } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import { bookmarkedCheckpoint } from '@/__tests__/application/services/workshop/recall/workshopBookmarkBrowserFixtures';

const SESSIONS = '/workspace/novel/prose-minion/sessions';

function corpus(newerFiles: number) {
  const fs = new MemoryFileSystem();
  const put = (name: string, id: string, title: string) =>
    fs.files.set(`${SESSIONS}/${name}.json`, new TextEncoder().encode(JSON.stringify(bookmarkedCheckpoint(id, title))));
  for (let index = 0; index < newerFiles; index += 1) {
    put(`20260101-${String(index).padStart(4, '0')}`, `new-${index}`, `New ${index}`);
  }
  put('20200101-000001-newer-duplicate', 'duplicate', 'Newer duplicate');
  put('20200101-000000-older-duplicate', 'duplicate', 'Older duplicate');
  const store = new WorkshopSessionStore(fs, RECALL_WORKSPACE, recallLog());
  const recall = new WorkshopTranscriptRecallService(store, { recallScope: () => ({ available: true, liveSessionId: 'live' }) }, recallLog());
  return { store, recall };
}

async function walk(recall: WorkshopTranscriptRecallService): Promise<WorkshopRecallBookmarkPage[]> {
  const pages: WorkshopRecallBookmarkPage[] = [];
  let after: string | undefined;
  do {
    const page = await recall.bookmarkPage(after === undefined ? {} : { after });
    if (!page.available) {
      throw new Error('unavailable');
    }
    pages.push(page);
    after = page.next;
  } while (after !== undefined);
  return pages;
}

describe('bookmark paging and duplicate session ids (PR #216 F-01)', () => {
  it.each([
    [200, 'on one page'],
    [224, 'split across two pages']
  ])('leaves an id two files claim unresolved after %i newer files (%s)', async (newerFiles) => {
    const { store, recall } = corpus(newerFiles);
    expect((await store.list()).sessions.some((session) => session.sessionId === 'duplicate')).toBe(false);
    await expect(store.readNamed('duplicate')).rejects.toBeInstanceOf(WorkshopNamedSessionIdentityConflictError);

    const pages = await walk(recall);

    // Never resolved: neither file is read, each is named unreadable where it lands.
    expect(pages.flatMap((page) => page.sessions).some((session) => session.sessionId === 'duplicate')).toBe(false);
    expect(pages.flatMap((page) => page.unreadableSessions)).toEqual([
      { sessionId: 'duplicate', title: 'Newer duplicate' },
      { sessionId: 'duplicate', title: 'Older duplicate' }
    ]);
    expect(pages.reduce((total, page) => total + page.read, 0)).toBe(newerFiles);
    expect(pages.reduce((total, page) => total + page.unreadable, 0)).toBe(2);
    // The exact action still refuses the conflict: paging wrote nothing it trusts.
    await expect(store.readNamed('duplicate')).rejects.toBeInstanceOf(WorkshopNamedSessionIdentityConflictError);
  });

  it('marks both claiming entries ambiguous at the store, on every page they land', async () => {
    const { store } = corpus(224);
    const flagged: Array<{ cursor: string; ambiguous: boolean }> = [];
    let after: string | undefined;
    do {
      const page = await store.listPage({ ...(after ? { after } : {}), limit: 25 });
      flagged.push(...page.entries
        .filter((entry) => entry.summary?.sessionId === 'duplicate')
        .map((entry) => ({ cursor: entry.cursor, ambiguous: entry.ambiguous === true })));
      after = page.next;
    } while (after !== undefined);
    expect(flagged).toEqual([
      { cursor: '20200101-000001-newer-duplicate.json', ambiguous: true },
      { cursor: '20200101-000000-older-duplicate.json', ambiguous: true }
    ]);
  });

  it('reads a page\'s session only from the file its entry names', async () => {
    const { store } = corpus(1);
    expect((await store.readPagedSession('20260101-0000.json', 'new-0'))?.title).toBe('New 0');
    // Another file's id, a path, or a name the folder never had: nothing.
    expect(await store.readPagedSession('20260101-0000.json', 'duplicate')).toBeUndefined();
    expect(await store.readPagedSession('../20260101-0000.json', 'new-0')).toBeUndefined();
    expect(await store.readPagedSession('current.json', 'new-0')).toBeUndefined();
  });
});
