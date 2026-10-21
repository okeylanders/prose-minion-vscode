/**
 * The run line (ADR 2026-10-19 D6, D8): the press states its calls and cost
 * first, warns when book-sized, refuses when too large, counts groups back
 * while reading, and afterwards counts the quotes checked and withheld.
 */
import type { LightboxBoard, LightboxReadingGroup, LightboxReadingGroupId } from '@messages';
import { emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import {
  buildLightboxRunLine,
  formatLightboxCost,
  lightboxCallsNote,
  lightboxRereadAvailability,
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
    const activeRun = { boardId: board.boardId, token: 'run-1', groups: ['A', 'B', 'C'] as LightboxReadingGroupId[] };
    expect(line(board, { activeRun })).toEqual({
      status: 'running',
      note: 'Reading… 1 of 3 lens groups back',
      stopToken: 'run-1'
    });
    // Before the host names the run there is nothing to stop, and only the groups visibly running are counted.
    expect(line(board)).toEqual({ status: 'running', note: 'Reading… 0 of 2 lens groups back' });
    expect(line(makeBoard(8), { awaitingStart: true })).toEqual({ status: 'running', note: 'Starting…' });
  });

  describe('everything on the line is the board\'s own (PR #149 F-03)', () => {
    const running = (board: LightboxBoard) => withGroups(board, [
      readGroup('A'),
      { ...emptyLightboxReadingGroup('B'), status: 'running', pending: ['characters', 'voice'] },
      emptyLightboxReadingGroup('C')
    ]);

    it('treats another board\'s estimate as none: nothing priced, nothing to press', () => {
      const view = line(makeBoard(8), { estimate: makeEstimate({ boardId: 'board-other' }) });
      expect(view).toMatchObject({ status: 'estimating', action: { disabled: true, cost: '' } });
    });

    it('offers Stop only for the board\'s own run, never from another board\'s run or progress', () => {
      const board = running(makeBoard(8));
      const otherRun = { boardId: 'board-other', token: 'run-other', groups: ['B'] as LightboxReadingGroupId[] };
      const otherProgress = {
        boardId: 'board-other', token: 'run-other', phase: 'streaming' as const, groups: ['B'] as LightboxReadingGroupId[], groupsBack: 0, outputCharacters: 9
      };
      expect(line(board, { activeRun: otherRun, progress: otherProgress }).stopToken).toBeUndefined();
      const ownRun = { boardId: board.boardId, token: 'run-own', groups: ['B'] as LightboxReadingGroupId[] };
      expect(line(board, { activeRun: ownRun, progress: otherProgress })).toEqual({
        status: 'running',
        note: 'Reading… 0 of 1 lens group back',
        stopToken: 'run-own'
      });
    });
  });

  it('counts quotes checked and withheld once everything landed, and offers a re-read', () => {
    const view = line(makeReadBoard({ paraphraseOne: true }));
    expect(view.status).toBe('done');
    // Six calls: groups A–E and the Opinion (Slice 4D).
    expect(view.note).toMatch(/^\d+ quotes checked · 1 withheld · 6 calls$/);
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

  it('offers a tile\'s re-read only when its lens is on and its own call is priced and fits (PR #149 F-08)', () => {
    const base = { estimate: makeEstimate(), lens: 'motif' as const, lensesOff: [], providerPaused: false, running: false };
    expect(lightboxRereadAvailability(base)).toEqual({ note: '1 call · est. $0.01' });
    expect(lightboxRereadAvailability({ ...base, lensesOff: ['motif'] })).toEqual({
      reason: 'The Theme & motif lens is off. Turn it on in the rail to re-read this tile.'
    });
    expect(lightboxRereadAvailability({ ...base, estimate: undefined })).toEqual({ reason: 'Estimating the cost…' });
    expect(lightboxRereadAvailability({ ...base, lens: 'voice' })).toEqual({
      reason: 'This tile cannot be re-read until the board is estimated.'
    });
    const tight = makeEstimate();
    tight.rereads = [{ ...tight.rereads[0], fit: 'too-large', inputTokens: 40_000 }];
    expect(lightboxRereadAvailability({ ...base, estimate: tight })).toEqual({
      reason: 'Re-reading this tile would send about 40,000 tokens and reserve 8,000 for the reply, ' +
        'more than provider/model-v1\'s 200,000-token window allows.'
    });
    expect(lightboxRereadAvailability({ ...base, running: true }).reason).toMatch(/^A reading is running/);
    expect(lightboxRereadAvailability({ ...base, providerPaused: true }).reason).toMatch(/^Add an OpenRouter API key/);
  });

  it('formats costs and a tile\'s re-read', () => {
    expect(formatLightboxCost(0.0412)).toBe('$0.04');
    expect(formatLightboxCost(0.001)).toBe('< $0.01');
    expect(lightboxCallsNote([])).toBe('measure only · free');
    expect(lightboxRereadNote(makeEstimate(), 'motif')).toBe('1 call · est. $0.01');
    expect(lightboxRereadNote(makeEstimate(), 'voice')).toBeUndefined();
  });
});
