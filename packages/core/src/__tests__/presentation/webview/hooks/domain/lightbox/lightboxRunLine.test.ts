/**
 * The run line (ADR 2026-10-19 D6, D8): the press states its calls and cost
 * first, warns when book-sized, refuses when too large, counts groups back
 * while reading, and afterwards counts the quotes checked and withheld.
 */
import type { LightboxBoard, LightboxReadingGroup } from '@messages';
import { emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import {
  buildLightboxRunLine,
  formatLightboxCost,
  lightboxCallsNote,
  lightboxRereadNote
} from '@hooks/domain/lightbox/lightboxRunLine';
import { makeBoard } from './lightboxBoardFixtures';
import { makeEstimate, makeReadBoard, readGroup } from './lightboxReadingBoardFixtures';

const line = (board: LightboxBoard, overrides: Partial<Parameters<typeof buildLightboxRunLine>[0]> = {}) =>
  buildLightboxRunLine({ board, estimate: makeEstimate(), awaitingStart: false, providerPaused: false, ...overrides });

const withGroups = (board: LightboxBoard, groups: LightboxReadingGroup[]): LightboxBoard => ({ ...board, readings: groups });

describe('the run line', () => {
  it('waits for the estimate with the button in place and disabled', () => {
    expect(line(makeBoard(8), { estimate: undefined })).toEqual({
      status: 'estimating',
      note: 'Estimating the cost…',
      action: { label: 'Read the chapter', scope: { mode: 'all' }, cost: '', disabled: true }
    });
  });

  it('states the call count and the estimated cost before the first press', () => {
    expect(line(makeBoard(8))).toEqual({
      status: 'idle',
      note: '3 calls · est. $0.04',
      action: { label: 'Read the chapter', scope: { mode: 'all' }, cost: '3 calls · est. $0.04', disabled: false }
    });
  });

  it('warns a book-sized text but still allows the press', () => {
    const view = line(makeBoard(8), { estimate: makeEstimate({ bookSized: true, sourceWords: 38_200 }) });
    expect(view.warning).toBe('Book-sized: 38,200 words');
    expect(view.action?.disabled).toBe(false);
  });

  it('disables the press with the host\'s reason when a call is too large', () => {
    const estimate = makeEstimate({ fit: 'too-large', reason: 'Group A would send about 90,000 tokens…' });
    estimate.groups[0].fit = 'too-large';
    const view = line(makeBoard(8), { estimate });
    expect(view.action).toMatchObject({ disabled: true, reason: 'Group A would send about 90,000 tokens…' });
  });

  it('says when the window is unknown or the cost unavailable, and still allows the press', () => {
    const estimate = makeEstimate();
    estimate.groups = estimate.groups.map((call) => ({ ...call, fit: 'unknown' as const, costUsd: undefined }));
    const view = line(makeBoard(8), { estimate });
    expect(view.note).toBe('3 calls · cost unavailable · model window unknown');
    expect(view.action?.disabled).toBe(false);
  });

  it('needs an API key to read', () => {
    expect(line(makeBoard(8), { providerPaused: true }).action).toMatchObject({
      disabled: true,
      reason: 'Add an OpenRouter API key in Settings to read the chapter.'
    });
  });

  it('is free and silent with every lens off', () => {
    expect(line(makeBoard(8), { estimate: makeEstimate({ groups: [], rereads: [] }) })).toEqual({
      status: 'none',
      note: 'measure only · free'
    });
  });

  it('counts the groups back while reading, and offers Stop once the host names the run', () => {
    const board = withGroups(makeBoard(8), [
      readGroup('A'),
      { ...emptyLightboxReadingGroup('B'), status: 'running', pending: ['characters', 'voice'] },
      { ...emptyLightboxReadingGroup('C'), status: 'running', pending: ['genre'] }
    ]);
    const progress = { boardId: board.boardId, token: 'run-1', phase: 'streaming' as const, groups: ['A', 'B', 'C'] as const, groupsBack: 1, outputCharacters: 2_000 };
    expect(line(board, { progress: { ...progress, groups: [...progress.groups] } })).toEqual({
      status: 'running',
      note: 'Reading… 1 of 3 lens groups back',
      stopToken: 'run-1'
    });
    expect(line(makeBoard(8), { awaitingStart: true })).toEqual({ status: 'running', note: 'Starting…' });
  });

  it('counts quotes checked and withheld once everything landed, and offers a re-read', () => {
    const view = line(makeReadBoard({ paraphraseOne: true }));
    expect(view.status).toBe('done');
    expect(view.note).toMatch(/^\d+ quotes checked · 1 withheld · 3 calls$/);
    expect(view.action).toMatchObject({ label: 'Re-read', scope: { mode: 'all' } });
  });

  it('says how many lenses are stale after the chapter changed, and still offers a re-read (D4)', () => {
    const read = makeReadBoard();
    const board = withGroups(read, read.readings.map((group) => ({
      ...group,
      staleLenses: group.lenses.map((lens) => ({ lens, readAgainst: 'earlier-hash' }))
    })));
    const view = line(board);
    expect(view.note).toMatch(/ · \d+ lenses stale$/);
    expect(view.action).toMatchObject({ label: 'Re-read', scope: { mode: 'all' } });
  });

  it('after a stop, keeps the finished groups and offers to read the rest at its own cost', () => {
    const board = withGroups(makeBoard(8), [
      readGroup('A'),
      { ...emptyLightboxReadingGroup('B'), status: 'cancelled', error: 'Stopped before this group came back.' },
      { ...emptyLightboxReadingGroup('C'), status: 'cancelled', error: 'Stopped before this group came back.' }
    ]);
    const view = line(board);
    expect(view.status).toBe('stopped');
    expect(view.note).toContain('stopped, finished groups kept');
    expect(view.action).toMatchObject({ label: 'Read the rest', scope: { mode: 'rest' }, cost: '2 calls · est. $0.03' });
  });

  it('shows a refusal for this board', () => {
    const view = line(makeBoard(8), {
      progress: { boardId: 'board-8', phase: 'refused', groups: [], groupsBack: 0, outputCharacters: 0, message: 'This board is already being read.' }
    });
    expect(view.notice).toBe('This board is already being read.');
  });

  it('formats costs and a tile\'s re-read', () => {
    expect(formatLightboxCost(0.0412)).toBe('$0.04');
    expect(formatLightboxCost(0.001)).toBe('< $0.01');
    expect(lightboxCallsNote([])).toBe('measure only · free');
    expect(lightboxRereadNote(makeEstimate(), 'motif')).toBe('1 call · est. $0.01');
    expect(lightboxRereadNote(makeEstimate(), 'voice')).toBeUndefined();
  });
});
