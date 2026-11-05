/**
 * PR #216 F-01, F-03 and F-04: bookmark paging and session identity, with
 * the real store, the real recall service and the normal page bounds
 * (25 files, 32 MiB). Astra's witnesses, as regressions.
 *
 * - **F-01.** Paging never changes how an exact action resolves an id:
 *   before and after a full walk, an exact read of an id two files claim
 *   still refuses the conflict. The walk never resolves it either: on one
 *   page both files are ambiguous; split across pages, the later page reports
 *   the id ambiguous, so the screen marks the earlier page's rows too.
 * - **F-03.** A page reads only its own files, within its budget, and a later
 *   page never reads an earlier page's files again: no folder-wide scan.
 * - **F-04.** A file too large to summarize has an unknown id, never a
 *   unique one: it is counted unreadable, and an exact read of the id that
 *   might be its refuses the conflict, which the preview names.
 */

import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import {
  WorkshopNamedSessionIdentityConflictError,
  WorkshopSessionStore
} from '@/infrastructure/storage/WorkshopSessionStore';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import type { WorkshopRecallBookmarkPage } from '@/application/services/workshop/recall/WorkshopRecallBookmarkPage';
import { WORKSHOP_BOOKMARK_BROWSER_LIMITS } from '@shared/constants/workshopBookmarkBrowser';
import { RECALL_WORKSPACE, recallLog } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import { bookmarkedCheckpoint, bookmarkedRoom } from '@/__tests__/application/services/workshop/recall/workshopBookmarkBrowserFixtures';

const SESSIONS = '/workspace/novel/prose-minion/sessions';
const MIB = 1024 * 1024;

/** A valid checkpoint whose bookmarked reply holds `characters` of real content. */
function checkpointText(sessionId: string, title: string, characters?: number): string {
  const checkpoint = JSON.parse(JSON.stringify(bookmarkedCheckpoint(sessionId, title)));
  if (characters !== undefined) {
    checkpoint.workshop.turns.find((turn: { id: string }) => turn.id === bookmarkedRoom().replyId).content = 'A'.repeat(characters);
  }
  return JSON.stringify(checkpoint);
}

function folder() {
  const fs = new MemoryFileSystem();
  const put = (name: string, id: string, title: string, characters?: number) =>
    fs.files.set(`${SESSIONS}/${name}.json`, new TextEncoder().encode(checkpointText(id, title, characters)));
  const store = new WorkshopSessionStore(fs, RECALL_WORKSPACE, recallLog());
  const recall = new WorkshopTranscriptRecallService(store, { recallScope: () => ({ available: true, liveSessionId: 'live' }) }, recallLog());
  return { fs, put, store, recall };
}

function withDuplicates(newerFiles: number) {
  const made = folder();
  for (let index = 0; index < newerFiles; index += 1) {
    made.put(`20260101-${String(index).padStart(4, '0')}`, `new-${index}`, `New ${index}`);
  }
  made.put('20200101-000001-newer-duplicate', 'duplicate', 'Newer duplicate');
  made.put('20200101-000000-older-duplicate', 'duplicate', 'Older duplicate');
  return made;
}

async function page(recall: WorkshopTranscriptRecallService, after?: string): Promise<WorkshopRecallBookmarkPage> {
  const result = await recall.bookmarkPage(after === undefined ? {} : { after });
  if (!result.available || result.outcome !== 'bookmark-page') {
    throw new Error(`expected a page, got ${JSON.stringify(result)}`);
  }
  return result;
}

async function walk(recall: WorkshopTranscriptRecallService): Promise<WorkshopRecallBookmarkPage[]> {
  const pages: WorkshopRecallBookmarkPage[] = [];
  let after: string | undefined;
  do {
    const next = await page(recall, after);
    pages.push(next);
    after = next.next;
  } while (after !== undefined);
  return pages;
}

const readIds = (pages: readonly WorkshopRecallBookmarkPage[]) => pages.map((each) => each.sessions.map((session) => session.sessionId));

describe('duplicate session ids across the walk (PR #216 F-01)', () => {
  it('leaves an id two files claim on one page unresolved, and the exact read still refuses it', async () => {
    const { store, recall } = withDuplicates(200);
    await expect(store.readNamed('duplicate')).rejects.toBeInstanceOf(WorkshopNamedSessionIdentityConflictError);

    const pages = await walk(recall);
    const last = pages.at(-1)!;
    expect(last).toMatchObject({ ambiguous: 2, ambiguousSessionIds: ['duplicate'], unreadable: 0 });
    expect(readIds(pages).flat()).not.toContain('duplicate');
    expect(pages.reduce((total, each) => total + each.read, 0)).toBe(200);
    await expect(store.readNamed('duplicate')).rejects.toBeInstanceOf(WorkshopNamedSessionIdentityConflictError);
  });

  it('reports a duplicate split across pages as ambiguous once the walk reaches it, so the earlier row is marked too', async () => {
    const { store, recall } = withDuplicates(224);
    await expect(store.readNamed('duplicate')).rejects.toBeInstanceOf(WorkshopNamedSessionIdentityConflictError);

    const pages = await walk(recall);
    // Page 9 holds the newer file and reads it: nothing on that page, or before it, claims the id.
    expect(readIds(pages)[8]).toContain('duplicate');
    // Page 10 meets the older file: the walk already met the id, so the id is ambiguous, for both pages' rows.
    expect(pages[9]).toMatchObject({ ambiguous: 1, ambiguousSessionIds: ['duplicate'], read: 0, unreadable: 0 });
    expect(pages.flatMap((each) => each.ambiguousSessionIds)).toEqual(['duplicate']);
    // Never both read and unreadable, and the exact read still refuses the conflict.
    expect(pages.flatMap((each) => each.unreadableSessions)).toEqual([]);
    await expect(store.readNamed('duplicate')).rejects.toBeInstanceOf(WorkshopNamedSessionIdentityConflictError);
  });

  it('refuses a later page whose walk the host has forgotten, never restarting the check partway', async () => {
    const { recall } = withDuplicates(30);
    const first = await page(recall);
    expect(await recall.bookmarkPage({ after: `walk-999|${first.next!.split('|')[1]}` }))
      .toEqual({ available: true, outcome: 'walk-expired' });
  });

  it('reads a page\'s session only from the file its entry names', async () => {
    const { store } = withDuplicates(1);
    expect((await store.readPagedSession('20260101-0000.json', 'new-0'))?.title).toBe('New 0');
    expect(await store.readPagedSession('20260101-0000.json', 'duplicate')).toBeUndefined();
    expect(await store.readPagedSession('../20260101-0000.json', 'new-0')).toBeUndefined();
    expect(await store.readPagedSession('current.json', 'new-0')).toBeUndefined();
  });
});

describe('each page within its own budget (PR #216 F-03)', () => {
  it('reads 80 index-less 1 MiB sessions page by page, never past the budget and never an earlier page\'s file again', async () => {
    const { fs, put, recall } = folder();
    for (let index = 0; index < 80; index += 1) {
      put(`20260101-${String(index).padStart(4, '0')}`, `id-${index}`, `Session ${index}`, MIB);
    }
    const originalRead = fs.readFile.bind(fs);
    let bytes = 0;
    let files = new Set<string>();
    jest.spyOn(fs, 'readFile').mockImplementation(async (filePath) => {
      const data = await originalRead(filePath);
      bytes += data.byteLength;
      files.add(filePath);
      return data;
    });

    const pages: Array<{ bytes: number; files: Set<string> }> = [];
    let after: string | undefined;
    do {
      bytes = 0;
      files = new Set();
      const next = await page(recall, after);
      pages.push({ bytes, files });
      after = next.next;
    } while (after !== undefined);

    const sessionFiles = (read: Set<string>) => [...read].filter((file) => file.endsWith('.json') && !file.endsWith('.summary.json'));
    for (const each of pages) {
      expect(sessionFiles(each.files).length).toBeLessThanOrEqual(WORKSHOP_BOOKMARK_BROWSER_LIMITS.bookmarkBrowserSessions);
      // An index-less file is read twice (its summary, then the exact read); a page may cross the budget by its last file.
      expect(each.bytes).toBeLessThanOrEqual(WORKSHOP_BOOKMARK_BROWSER_LIMITS.bookmarkBrowserBytes + 2 * (MIB + 64 * 1024));
    }
    // No page reads a file an earlier page read, and the walk reads every file.
    const seen = new Set<string>();
    for (const each of pages) {
      for (const file of sessionFiles(each.files)) {
        expect(seen.has(file)).toBe(false);
        seen.add(file);
      }
    }
    expect(seen.size).toBe(80);
  });
});

describe('an unknown id is never a unique one (PR #216 F-04)', () => {
  it('counts a valid file too large to summarize as unreadable, and the exact read the small row needs refuses the conflict', async () => {
    const { store, put, recall } = folder();
    put('20200101-small', 'duplicate', 'Small', 100);
    put('20200101-large', 'duplicate', 'Large', 6 * MIB);
    // The exact decoder accepts the large file; the two share an id.
    expect((await store.readPagedSession('20200101-large.json', 'duplicate'))?.title).toBe('Large');
    await expect(store.readNamed('duplicate')).rejects.toBeInstanceOf(WorkshopNamedSessionIdentityConflictError);

    const only = await page(recall);
    // The large file's id is unknown: counted unreadable, never proof the small row is unique.
    expect(only).toMatchObject({ read: 1, unreadable: 1, ambiguous: 0 });
    expect(only.unreadableSessions).toEqual([]);
    // Preview of the small row goes through the exact read, which refuses and says why.
    expect(await recall.savedTurn('duplicate', bookmarkedRoom().replyId)).toEqual({ kind: 'ambiguous-session' });
    await expect(store.readNamed('duplicate')).rejects.toBeInstanceOf(WorkshopNamedSessionIdentityConflictError);
  });
});
