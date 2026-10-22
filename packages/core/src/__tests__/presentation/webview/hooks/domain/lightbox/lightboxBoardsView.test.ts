/**
 * The rail's Boards section in words (Slice 5A; epic decision 31): each
 * saved board's date and time, lenses, stale lenses and approximate cost;
 * the board on screen; where boards are kept; and what a board opened from
 * a file says about that file. Dates are pinned to UTC.
 */

import type { LightboxBoardShelf, LightboxSavedBoardSummary } from '@messages';
import { buildLightboxBoardsView } from '@hooks/domain/lightbox/lightboxBoardsView';
import { LIGHTBOX_LENSES } from '@shared/constants/lightbox';

const UTC = { timeZone: 'UTC' };
const PROJECT = { kind: 'project', displayPath: 'prose-minion/boards', lastSaveFailed: false } as const;
const EVERY_LENS = LIGHTBOX_LENSES.map((lens) => lens.id);

const saved = (overrides: Partial<LightboxSavedBoardSummary>): LightboxSavedBoardSummary => ({
  fileId: 'drafts-alice-1-md/2026-10-22T14-05-09-123Z.board.json',
  savedAt: Date.parse('2026-10-22T14:05:09.123Z'),
  wordCount: 508,
  lenses: [],
  staleLenses: [],
  onScreen: false,
  ...overrides
});
const shelf = (overrides: Partial<LightboxBoardShelf>): LightboxBoardShelf => ({ availability: PROJECT, boards: [], unreadable: 0, ...overrides });

describe('buildLightboxBoardsView', () => {
  it('lists each saved board with its date, lenses, stale lenses and cost, and marks the board on screen', () => {
    const view = buildLightboxBoardsView(shelf({
      boards: [
        saved({ fileId: 'b', savedAt: Date.parse('2026-10-22T15:10:00.000Z'), lenses: EVERY_LENS, staleLenses: ['headline', 'motif'], costUsd: 0.0712, onScreen: true }),
        saved({ fileId: 'c', savedAt: Date.parse('2026-10-22T14:30:00.000Z'), lenses: ['steering'], costUsd: 0.004 }),
        saved({ fileId: 'd', lenses: ['headline', 'motif', 'tension'] }),
        saved({ fileId: 'a' })
      ]
    }), true, UTC);

    expect(view.status).toBe('4 saved');
    expect(view.rows).toEqual([
      { fileId: 'b', when: 'Oct 22, 2026, 3:10 PM', dateTime: '2026-10-22T15:10:00.000Z', lenses: 'Every lens read', stale: '2 stale', cost: '≈ $0.07', onScreen: true },
      { fileId: 'c', when: 'Oct 22, 2026, 2:30 PM', dateTime: '2026-10-22T14:30:00.000Z', lenses: '1 lens read', cost: 'under $0.01', onScreen: false },
      { fileId: 'd', when: 'Oct 22, 2026, 2:05 PM', dateTime: '2026-10-22T14:05:09.123Z', lenses: '3 lenses read', onScreen: false },
      { fileId: 'a', when: 'Oct 22, 2026, 2:05 PM', dateTime: '2026-10-22T14:05:09.123Z', lenses: 'Measured only', onScreen: false }
    ]);
    expect(view.caption).toBe('Saved in prose-minion/boards, one file per save. Nothing is deleted unless you delete it.');
    expect(view.empty).toBeUndefined();
  });

  it('says what a board opened from a file means for that file', () => {
    const snapshot = { fileId: 'a', savedAt: Date.parse('2026-10-21T09:00:00.000Z'), dropped: 0 };
    const of = (file: 'same' | 'changed' | 'unreadable' | 'none', dropped = 0) =>
      buildLightboxBoardsView(shelf({ boards: [saved({})], snapshot: { ...snapshot, file, dropped } }), true, UTC).snapshot;

    expect(of('same')).toEqual({
      tone: 'quiet', opened: 'Opened from the board saved Oct 21, 2026, 9:00 AM.', file: 'The file still holds the text it was read from.', readCurrentText: false
    });
    expect(of('changed')).toEqual({
      tone: 'warn',
      opened: 'Opened from the board saved Oct 21, 2026, 9:00 AM.',
      file: 'The file has changed since. This board shows the text as it was saved, and holds back Bring until you read the current text.',
      readCurrentText: true
    });
    expect(of('unreadable')).toMatchObject({ tone: 'warn', file: 'The file could not be read to compare it with this board.', readCurrentText: false });
    expect(of('none')).toMatchObject({ tone: 'quiet', file: 'It was a selection, so there is no file to compare.', readCurrentText: false });
    expect(of('same', 1)?.dropped).toBe('1 part of it could not be read and was left out.');
    expect(of('same', 3)?.dropped).toBe('3 parts of it could not be read and were left out.');
  });

  it('says why boards are kept for the session only, with no list and no caption', () => {
    expect(buildLightboxBoardsView(shelf({ availability: { kind: 'session', reason: 'no-workspace' } }), true, UTC)).toEqual({
      status: 'this session',
      rows: [],
      availability: 'Boards are kept for this session only: no folder is open. Open one folder to save them.'
    });
    expect(buildLightboxBoardsView(shelf({ availability: { kind: 'session', reason: 'multi-root' } }), true, UTC).availability)
      .toBe('Boards are kept for this session only: several folders are open. Open one folder to save them.');
  });

  it('says when the last save failed, when there are none yet, and how many files could not be read', () => {
    const view = buildLightboxBoardsView(shelf({ availability: { ...PROJECT, lastSaveFailed: true }, unreadable: 2, notice: 'That saved board is no longer in the boards folder.' }), true, UTC);
    expect(view).toMatchObject({
      status: '0 saved',
      availability: 'The last save could not be written (the output log says why). Until one is, this board is kept for this session only.',
      empty: 'No saved boards of this source yet. A board saves itself when it is first measured, and after each reading.',
      unreadable: '2 files here could not be read as boards. They were left as they are.',
      notice: 'That saved board is no longer in the boards folder.'
    });
    expect(buildLightboxBoardsView(shelf({ boards: [saved({})], unreadable: 1 }), true, UTC).unreadable)
      .toBe('1 file here could not be read as a board. It was left as it is.');
  });

  it('waits for the host, and with no board on screen says where boards will show', () => {
    expect(buildLightboxBoardsView(null, true, UTC)).toEqual({ status: '…', rows: [], empty: 'Looking for saved boards…' });
    expect(buildLightboxBoardsView(shelf({ boards: [saved({})] }), false, UTC)).toEqual({
      status: 'none', rows: [], empty: 'Board a chapter, and the boards saved from it show here.'
    });
  });
});
