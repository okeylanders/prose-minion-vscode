/**
 * The Bookmarks screen in words (ADR 2026-11-05 D8): items keyed by source,
 * search over label and message text, the two groupings, first lines, and
 * the coverage and search notes.
 */

import type { WorkshopBookmarkBrowserRow, WorkshopBookmarkBrowserSession } from '@messages';
import {
  bookmarkCoverageLine,
  bookmarkFirstLines,
  duplicateCheckNote,
  filterBookmarks,
  groupBookmarksByDate,
  groupBookmarksBySession,
  liveBookmarkItems,
  savedBookmarkItems,
  searchCoverageNote
} from '@hooks/domain/workshop/bookmarks/workshopBookmarkBrowserView';

const NOW = new Date(2026, 10, 5, 12);
const DAY = 86_400_000;

const row = (bookmarkId: string, label: string, content: string, createdAt: number): WorkshopBookmarkBrowserRow => ({
  bookmarkId,
  turnId: `turn-${bookmarkId}`,
  label,
  createdAt,
  speaker: 'Jill',
  identity: 'jill',
  message: { kind: 'reply', speaker: 'Jill', content, timestamp: createdAt - 1_000 }
});

const session = (sessionId: string, title: string, rows: WorkshopBookmarkBrowserRow[]): WorkshopBookmarkBrowserSession =>
  ({ sessionId, title, savedAt: '2026-11-01T10:00:00.000Z', bookmarks: rows });

describe('items, search and groupings', () => {
  const live = liveBookmarkItems([row('b1', 'The door', 'Alice opens the little door.', NOW.getTime() - 1_000)]);
  const saved = savedBookmarkItems([
    session('s2', 'Tea party', [row('b1', 'The hatter', 'The Hatter pours tea.', NOW.getTime() - 3 * DAY)]),
    session('s1', 'The garden', [row('b1', 'Roses', 'The gardeners paint the roses red.', NOW.getTime() - 30 * DAY)])
  ]);

  it('keys each item by its source, since bookmark ids repeat across sessions', () => {
    expect([...live, ...saved].map((item) => item.key)).toEqual(['live/b1', 's2/b1', 's1/b1']);
  });

  it('searches the label and the whole message, every word, case and accents aside', () => {
    expect(filterBookmarks([...live, ...saved], 'HATTER').map((item) => item.key)).toEqual(['s2/b1']);
    expect(filterBookmarks([...live, ...saved], 'paint red').map((item) => item.key)).toEqual(['s1/b1']);
    expect(filterBookmarks([...live, ...saved], 'littlé door').map((item) => item.key)).toEqual(['live/b1']);
    expect(filterBookmarks([...live, ...saved], '   ')).toHaveLength(3);
  });

  it('groups by the bookmark\'s own date, newest first', () => {
    expect(groupBookmarksByDate([...saved, ...live], NOW).map((group) => [group.label, group.items.map((item) => item.key)]))
      .toEqual([['Today', ['live/b1']], ['This week', ['s2/b1']], ['Earlier', ['s1/b1']]]);
  });

  it('groups by session in the order sessions arrived, naming this conversation', () => {
    expect(groupBookmarksBySession([...live, ...saved]).map((group) => group.label))
      .toEqual(['This conversation', 'Tea party', 'The garden']);
  });
});

describe('what a row and the status say', () => {
  it('shows a message\'s first three lines, clipped', () => {
    expect(bookmarkFirstLines('One.\n\nTwo.\nThree.\nFour.')).toBe('One. Two. Three.');
    expect(bookmarkFirstLines('x'.repeat(400))).toHaveLength(240);
    expect(bookmarkFirstLines(undefined)).toBe('');
  });

  it('says how much of the saved sessions the loaded pages cover', () => {
    expect(bookmarkCoverageLine({ read: 0, unreadable: 0, ambiguous: 0, remaining: 0, started: false })).toBeUndefined();
    expect(bookmarkCoverageLine({ read: 120, unreadable: 0, ambiguous: 0, remaining: 220, started: true }))
      .toBe('Bookmarks from 120 of 340 saved sessions.');
    expect(bookmarkCoverageLine({ read: 118, unreadable: 2, ambiguous: 0, remaining: 0, started: true }))
      .toBe('Bookmarks from 118 of 120 saved sessions · 2 couldn’t be read.');
    expect(bookmarkCoverageLine({ read: 3, unreadable: 0, ambiguous: 0, remaining: 0, started: true })).toBe('Bookmarks from all 3 saved sessions.');
    expect(bookmarkCoverageLine({ read: 0, unreadable: 0, ambiguous: 0, remaining: 0, started: true })).toBe('No saved sessions yet.');
  });

  it('says a search covers only what has loaded, while sessions remain', () => {
    const partial = { read: 25, unreadable: 0, ambiguous: 0, remaining: 40, started: true };
    expect(searchCoverageNote('alice', partial)).toBe('Searching the sessions loaded so far. 40 more sessions haven’t been read.');
    expect(searchCoverageNote('', partial)).toBeUndefined();
    expect(searchCoverageNote('alice', { ...partial, remaining: 0 })).toBeUndefined();
  });
});

describe('shared session ids (PR #216 F-01, F-03, F-04)', () => {
  it('marks every row of an ambiguous session, whichever page it came from', () => {
    const items = savedBookmarkItems([
      session('s2', 'Tea party', [row('b1', 'The hatter', 'Tea.', 1), row('b2', 'The cups', 'Cups.', 2)]),
      session('s1', 'The garden', [row('b1', 'Roses', 'Red.', 3)])
    ], new Set(['s2']));
    expect(items.map((item) => [item.key, item.ambiguous ?? false])).toEqual([['s2/b1', true], ['s2/b2', true], ['s1/b1', false]]);
  });

  it('says what the duplicate check covers only when it matters, and never claims uniqueness', () => {
    expect(duplicateCheckNote({ read: 25, unreadable: 0, ambiguous: 0, remaining: 10, started: true })).toBeUndefined();
    expect(duplicateCheckNote({ read: 25, unreadable: 1, ambiguous: 0, remaining: 0, started: true }))
      .toBe('Shared session ids are checked across the 25 sessions read; 1 couldn’t be read, so Preview and Open check again.');
    expect(duplicateCheckNote({ read: 24, unreadable: 0, ambiguous: 2, remaining: 0, started: true }))
      .toBe('2 saved files share their session id with another, so those bookmarks can’t be opened from here.');
    expect(bookmarkCoverageLine({ read: 24, unreadable: 0, ambiguous: 2, remaining: 0, started: true }))
      .toBe('Bookmarks from 24 of 26 saved sessions.');
  });
});
