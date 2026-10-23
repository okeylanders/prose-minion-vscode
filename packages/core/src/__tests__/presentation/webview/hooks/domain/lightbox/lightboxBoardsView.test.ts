/**
 * The saved boards in words (Slice 5A; Slice 5A.1; Slice 5A.2, epic decision
 * 46): the Boards menu's trigger and status, its five newest boards of every
 * chapter, and where boards are kept; the browser's rows (name, chapter,
 * when, lenses, stale, cost, models, on screen), its notes, its search over
 * names and chapter paths, and its groups by date and by chapter; and the
 * note above a board opened from a file. The rail's paging and head are gone
 * with the rail (Slice 5A.2).
 * Dates are pinned to UTC; names and model ids are made up.
 */

import type { LightboxBoardShelf, LightboxSavedBoardSummary } from '@messages';
import {
  LIGHTBOX_RECENT_BOARDS,
  buildLightboxBoardsBrowser,
  buildLightboxBoardsMenu,
  lightboxBoardRows,
  lightboxBoardsByChapter,
  lightboxBoardsByDate,
  lightboxModelsNote,
  lightboxSnapshotNotice,
  searchLightboxBoardRows
} from '@hooks/domain/lightbox/lightboxBoardsView';
import { LIGHTBOX_LENSES } from '@shared/constants/lightbox';

const UTC = { timeZone: 'UTC' };
const PROJECT = { kind: 'project', displayPath: 'prose-minion/boards', lastSaveFailed: false } as const;
const EVERY_LENS = LIGHTBOX_LENSES.map((lens) => lens.id);
const CHAPTER = { kind: 'file', displayPath: 'Drafts/alice-1.md' } as const;
const NAME = '3.2.1 - after the cut - model B';

const saved = (overrides: Partial<LightboxSavedBoardSummary>): LightboxSavedBoardSummary => ({
  fileId: 'drafts-alice-1-md-9b099095/2026-10-22T14-05-09-123Z.board.json',
  name: 'alice-1 - 10/22/2026 2:05 PM',
  savedAt: Date.parse('2026-10-22T14:05:09.123Z'),
  source: CHAPTER,
  wordCount: 508,
  lenses: [],
  staleLenses: [],
  onScreen: false,
  ...overrides
});
const shelf = (overrides: Partial<LightboxBoardShelf>): LightboxBoardShelf => ({ availability: PROJECT, boards: [], unreadable: 0, ...overrides });

describe('the browser\'s rows', () => {
  it('names each board, its chapter, when, its lenses, stale lenses and cost, and marks the one on screen', () => {
    const rows = lightboxBoardRows(shelf({
      boards: [
        saved({ fileId: 'b', name: NAME, savedAt: Date.parse('2026-10-22T15:10:00.000Z'), lenses: EVERY_LENS, staleLenses: ['headline', 'motif'], costUsd: 0.0712, onScreen: true }),
        saved({ fileId: 'c', source: { kind: 'selection', displayPath: 'Drafts/alice-2.md', startLine: 4, endLine: 30 }, lenses: ['steering'], costUsd: 0.004 }),
        saved({ fileId: 'd', lenses: ['headline', 'motif', 'tension'] }),
        saved({ fileId: 'a', source: { kind: 'selection', displayPath: 'Drafts/alice-2.md', startLine: 7, endLine: 7 } })
      ]
    }), UTC);

    expect(rows).toEqual([
      {
        fileId: 'b', name: NAME, chapter: 'Drafts/alice-1.md', chapterKey: 'file:Drafts/alice-1.md:-', savedAt: Date.parse('2026-10-22T15:10:00.000Z'),
        when: 'Oct 22, 2026, 3:10 PM', dateTime: '2026-10-22T15:10:00.000Z', lenses: 'Every lens read', stale: '2 stale', cost: '≈ $0.07', onScreen: true
      },
      {
        fileId: 'c', name: 'alice-1 - 10/22/2026 2:05 PM', chapter: 'Drafts/alice-2.md · lines 4–30', chapterKey: 'selection:Drafts/alice-2.md:4-30',
        savedAt: Date.parse('2026-10-22T14:05:09.123Z'), when: 'Oct 22, 2026, 2:05 PM', dateTime: '2026-10-22T14:05:09.123Z', lenses: '1 lens read', cost: 'under $0.01', onScreen: false
      },
      expect.objectContaining({ fileId: 'd', lenses: '3 lenses read', chapter: 'Drafts/alice-1.md' }),
      expect.objectContaining({ fileId: 'a', lenses: 'Measured only', chapter: 'Drafts/alice-2.md · line 7' })
    ]);
    expect(rows[2]).not.toHaveProperty('cost');
  });

  it('names the models that read a row, shortened and once each; a measured-only row has no model line', () => {
    const rows = lightboxBoardRows(shelf({
      boards: [saved({ fileId: 'b', lenses: EVERY_LENS, models: ['provider/model-v1', 'provider/model-b'] }), saved({ fileId: 'a' })]
    }), UTC);
    expect(rows[0]).toMatchObject({ models: 'Read by model-v1 and model-b', modelIds: 'provider/model-v1, provider/model-b' });
    expect(rows[1]).not.toHaveProperty('models');
  });

  it('writes the model line: one, two, more than two, the same name from two providers once, and a long name cut', () => {
    expect(lightboxModelsNote(undefined)).toBeUndefined();
    expect(lightboxModelsNote([])).toBeUndefined();
    expect(lightboxModelsNote(['provider/model-v1'])).toBe('Read by model-v1');
    expect(lightboxModelsNote(['model-v1'])).toBe('Read by model-v1');
    expect(lightboxModelsNote(['provider/model-v1', 'provider/model-b', 'other/model-c', 'other/model-d'])).toBe('Read by model-v1, model-b and 2 more');
    expect(lightboxModelsNote(['provider/model-v1', 'mirror/model-v1'])).toBe('Read by model-v1');
    expect(lightboxModelsNote([`provider/${'m'.repeat(40)}`])).toBe(`Read by ${'m'.repeat(31)}…`);
  });

  it('counts two models whose names begin alike as two, before cutting them for show (PR #164 N-02)', () => {
    const alike = 'a-model-whose-name-runs-to-31-ch';
    expect(lightboxModelsNote([`provider/${alike}-one`, `provider/${alike}-two`, 'provider/third-model', 'provider/fourth-model']))
      .toBe(`Read by ${alike.slice(0, 31)}…, ${alike.slice(0, 31)}… and 2 more`);
    expect(lightboxModelsNote([`provider/${alike}-one`, `mirror/${alike}-one`])).toBe(`Read by ${alike.slice(0, 31)}…`);
  });
});

describe('search and groups', () => {
  // Local times: the date groups are told in the local zone, as the Workshop's are, in any zone the tests run in.
  const at = (month: number, day: number, hour: number) => new Date(2026, month - 1, day, hour).getTime();
  const rows = lightboxBoardRows(shelf({
    boards: [
      saved({ fileId: 'today-2', name: 'Chapter 6 - draft three', savedAt: at(10, 23, 15), source: { kind: 'file', displayPath: 'Book/chapter-6.md' } }),
      saved({ fileId: 'today-1', name: NAME, savedAt: at(10, 23, 9) }),
      saved({ fileId: 'week', name: 'alice-1 - 10/20/2026 8:00 AM', savedAt: at(10, 20, 8) }),
      saved({ fileId: 'earlier', name: 'Chapter 6 - first pass', savedAt: at(9, 1, 8), source: { kind: 'file', displayPath: 'Book/chapter-6.md' } })
    ]
  }));

  it('searches names and chapter paths, every word, ignoring case; an empty search is every row', () => {
    expect(searchLightboxBoardRows(rows, '').map((row) => row.fileId)).toEqual(['today-2', 'today-1', 'week', 'earlier']);
    expect(searchLightboxBoardRows(rows, 'CHAPTER 6').map((row) => row.fileId)).toEqual(['today-2', 'earlier']);
    expect(searchLightboxBoardRows(rows, 'book/chapter').map((row) => row.fileId)).toEqual(['today-2', 'earlier']);
    expect(searchLightboxBoardRows(rows, 'alice model').map((row) => row.fileId)).toEqual(['today-1']);
    expect(searchLightboxBoardRows(rows, 'drafts/alice-1')).toHaveLength(2);
    expect(searchLightboxBoardRows(rows, 'nothing like this')).toEqual([]);
  });

  it('groups by date as the Workshop does: Today, This week, Earlier, newest first within each', () => {
    const groups = lightboxBoardsByDate(rows, new Date(at(10, 23, 18)));
    expect(groups.map((group) => [group.label, group.items.map((row) => row.fileId)])).toEqual([
      ['Today', ['today-2', 'today-1']],
      ['This week', ['week']],
      ['Earlier', ['earlier']]
    ]);
  });

  it('groups by chapter: each chapter once, in the order of its newest board', () => {
    expect(lightboxBoardsByChapter(rows).map((group) => [group.label, group.items.map((row) => row.fileId)])).toEqual([
      ['Book/chapter-6.md', ['today-2', 'earlier']],
      ['Drafts/alice-1.md', ['today-1', 'week']]
    ]);
  });
});

describe('the Boards menu', () => {
  it('names the board on screen, says it is saved, and lists the five newest boards of every chapter', () => {
    const many = Array.from({ length: 7 }, (_, index) => saved({
      fileId: `f${index}`, name: `board ${index}`, savedAt: Date.parse('2026-10-22T14:05:00.000Z') - index * 60_000, onScreen: index === 3
    }));
    const view = buildLightboxBoardsMenu(shelf({ name: 'board 3', boards: many }), CHAPTER, UTC);

    expect(LIGHTBOX_RECENT_BOARDS).toBe(5);
    expect(view).toMatchObject({ label: 'board 3', status: { state: 'saved', text: 'Saved' }, canRename: true });
    expect(view.recent.map((row) => row.fileId)).toEqual(['f0', 'f1', 'f2', 'f3', 'f4']);
    expect(view.availability).toBeUndefined();
  });

  it('says the name is not saved when the board\'s name is not the one its file holds (PR #167 F-03)', () => {
    const view = buildLightboxBoardsMenu(shelf({ name: NAME, boards: [saved({ onScreen: true })] }), CHAPTER, UTC);
    expect(view).toMatchObject({ label: NAME, status: { state: 'error', text: 'Name not saved' } });
    expect(buildLightboxBoardsMenu(shelf({ name: NAME, boards: [saved({ onScreen: true, name: NAME })] }), CHAPTER, UTC).status)
      .toEqual({ state: 'saved', text: 'Saved' });
  });

  it('names a board no file holds yet by its chapter\'s file name, not saved yet', () => {
    expect(buildLightboxBoardsMenu(shelf({ boards: [saved({})] }), CHAPTER, UTC)).toMatchObject({
      label: 'alice-1', status: { state: 'session', text: 'Not saved yet' }
    });
  });

  it('says when the last save failed, and when boards are kept for the session only, and why', () => {
    expect(buildLightboxBoardsMenu(shelf({ availability: { ...PROJECT, lastSaveFailed: true } }), CHAPTER, UTC)).toMatchObject({
      status: { state: 'error', text: 'Save failed' },
      availability: 'The last save could not be written (the output log says why). Until one is, this board is kept for this session only.'
    });
    expect(buildLightboxBoardsMenu(shelf({ name: NAME, availability: { kind: 'session', reason: 'no-workspace' } }), CHAPTER, UTC)).toEqual({
      label: NAME,
      status: { state: 'session', text: 'This session only' },
      recent: [],
      canRename: true,
      availability: 'Boards are kept for this session only: no folder is open. Open one folder to save them.'
    });
    expect(buildLightboxBoardsMenu(shelf({ availability: { kind: 'session', reason: 'multi-root' } }), CHAPTER, UTC).availability)
      .toBe('Boards are kept for this session only: several folders are open. Open one folder to save them.');
  });

  it('with no board on screen: "Boards", no status and no rename, and still the newest boards', () => {
    expect(buildLightboxBoardsMenu(shelf({ boards: [saved({})] }), null, UTC)).toMatchObject({
      label: 'Boards', canRename: false, recent: [expect.objectContaining({ fileId: saved({}).fileId })]
    });
    expect(buildLightboxBoardsMenu(shelf({}), null, UTC).status).toBeUndefined();
    expect(buildLightboxBoardsMenu(null, CHAPTER, UTC)).toEqual({ label: 'alice-1', recent: [], canRename: false });
  });
});

describe('the browser', () => {
  it('says what it cannot list, in order: where boards are kept, the host\'s notice, unreadable files and folders', () => {
    const view = buildLightboxBoardsBrowser(shelf({
      availability: { ...PROJECT, lastSaveFailed: true }, unreadable: 2, unreadableFolders: 1, notice: 'That saved board is no longer in the boards folder.'
    }), UTC);
    expect(view.notes).toEqual([
      { tone: 'warn', text: 'The last save could not be written (the output log says why). Until one is, this board is kept for this session only.' },
      { tone: 'alert', text: 'That saved board is no longer in the boards folder.' },
      { tone: 'quiet', text: '2 files in the boards folder could not be read as boards. They were left as they are.' },
      { tone: 'warn', text: '1 chapter\'s folder could not be read, so its boards are not listed. The output log says why.' }
    ]);
    expect(view.saving).toBe(true);
    expect(view.empty).toBe('No saved boards yet. A board saves itself when it is first measured, and again after each reading, in a file of its own.');
    expect(view.caption).toBe('Saved in prose-minion/boards, one file per board. "Read the current text" starts a new one. Nothing is deleted unless you delete it.');
    expect(buildLightboxBoardsBrowser(shelf({ unreadable: 1, unreadableFolders: 3 }), UTC).notes.map((note) => note.text)).toEqual([
      '1 file in the boards folder could not be read as a board. It was left as it is.',
      '3 chapters\' folders could not be read, so their boards are not listed. The output log says why.'
    ]);
  });

  it('says boards last only for the session, session-only', () => {
    const view = buildLightboxBoardsBrowser(shelf({ availability: { kind: 'session', reason: 'no-workspace' } }), UTC);
    expect(view).toMatchObject({
      saving: false,
      empty: 'Boards are kept for this session only, so there are none to open here.',
      caption: 'Open one folder, and boards save themselves there.',
      notes: [{ tone: 'warn', text: 'Boards are kept for this session only: no folder is open. Open one folder to save them.' }]
    });
  });

  it('waits for the host', () => {
    expect(buildLightboxBoardsBrowser(null, UTC)).toEqual({ rows: [], notes: [], saving: false, empty: 'Looking for saved boards…', caption: '' });
  });
});

describe('the note above a board opened from a file (decision 34; Slice 5A.2)', () => {
  const snapshot = { fileId: 'a', savedAt: Date.parse('2026-10-21T09:00:00.000Z'), dropped: 0 };
  const of = (overrides: Partial<NonNullable<LightboxBoardShelf['snapshot']>>) =>
    lightboxSnapshotNotice(shelf({ boards: [saved({ onScreen: true })], snapshot: { ...snapshot, file: 'same', ...overrides } }), UTC);

  it('offers Read the current text when the file changed', () => {
    expect(of({ file: 'changed' })).toEqual({
      tone: 'warn',
      opened: 'Opened from the board saved Oct 21, 2026, 9:00 AM.',
      file: 'The file has changed since. This board shows the text as it was saved, and holds back Bring until you read the current text.',
      readCurrentText: true
    });
  });

  it('says so when the chapter could not be compared, when parts were left out, and when the file is outside the boards folder', () => {
    expect(of({ file: 'unreadable' })).toMatchObject({
      tone: 'warn', file: 'Its chapter could not be read to compare it with this board, so Bring is held back.', readCurrentText: false
    });
    expect(of({ dropped: 1 })).toMatchObject({ tone: 'quiet', dropped: '1 part of it could not be read and was left out.' });
    expect(of({ dropped: 3 })?.dropped).toBe('3 parts of it could not be read and were left out.');
    // Opened from outside, and no file of the store holds it yet.
    expect(lightboxSnapshotNotice(shelf({ boards: [saved({})], snapshot: { ...snapshot, file: 'same', fileId: undefined, outside: true } }), UTC)).toMatchObject({
      tone: 'quiet',
      opened: 'Opened from a board file outside the boards folder, saved Oct 21, 2026, 9:00 AM. Its next save writes it there, as a file of its own.'
    });
  });

  it('says a board opened from outside is saved here once a file of its own is on screen, and keeps where it came from (PR #167 N-02)', () => {
    const view = lightboxSnapshotNotice(shelf({
      boards: [saved({ onScreen: true })],
      snapshot: { ...snapshot, fileId: undefined, outside: true, file: 'same' }
    }), UTC);
    expect(view).toMatchObject({
      tone: 'quiet',
      opened: 'Opened from a board file outside the boards folder, saved Oct 21, 2026, 9:00 AM. It is saved in the boards folder now, as a file of its own; the file it came from is as it was.'
    });
  });

  it('says nothing for an unchanged file or a selection, a board built now, or before the host answers', () => {
    expect(of({})).toBeUndefined();
    expect(of({ file: 'none' })).toBeUndefined();
    expect(lightboxSnapshotNotice(shelf({ boards: [saved({})] }), UTC)).toBeUndefined();
    expect(lightboxSnapshotNotice(null, UTC)).toBeUndefined();
  });
});
