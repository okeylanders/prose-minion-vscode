/**
 * The run line (ADR 2026-10-19 D6, D8): the press states its calls and cost
 * first, warns when book-sized, refuses when too large, counts calls back
 * while analyzing, and afterwards counts the quotes checked and withheld.
 * Its three presses are the writer's words (Slice 4I, epic decision 41):
 * "Run AI analyses", "Finish" and "Re-analyze"; once a call has landed,
 * "Re-analyze all" stands beside "Finish" with its own cost and reason
 * (Slice 4M, epic decision 53).
 */
import type { LightboxBoard, LightboxReadingGroup, LightboxReadingGroupId } from '@messages';
import { emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import {
  buildLightboxRunLine,
  formatLightboxCost,
  lightboxCallsNote,
  lightboxRereadAvailability,
  lightboxRereadNote,
  lightboxRunLineReasons
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
      action: { label: 'Run AI analyses', scope: { mode: 'all' }, cost: '', disabled: true }
    });
  });

  it('states the call count and the estimated cost before the first press', () => {
    expect(line(makeBoard(8))).toEqual({
      status: 'idle',
      note: '3 calls · est. $0.04',
      action: { label: 'Run AI analyses', scope: { mode: 'all' }, cost: '3 calls · est. $0.04', disabled: false }
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

  it('needs an API key to analyze', () => {
    expect(line(makeBoard(8), { providerPaused: true }).action).toMatchObject({
      disabled: true,
      reason: 'Add an OpenRouter API key in Settings to run AI analyses.'
    });
  });

  it('is free and silent with every lens off', () => {
    expect(line(makeBoard(8), { estimate: makeEstimate({ groups: [], rereads: [] }) })).toEqual({
      status: 'none',
      note: 'measure only · free'
    });
  });

  it('counts the calls back while analyzing, and offers Stop once the host names the run', () => {
    const board = withGroups(makeBoard(8), [
      readGroup('A'),
      { ...emptyLightboxReadingGroup('B'), status: 'running', pending: ['characters', 'voice'] },
      { ...emptyLightboxReadingGroup('C'), status: 'running', pending: ['genre'] }
    ]);
    const activeRun = { boardId: board.boardId, token: 'run-1', groups: ['A', 'B', 'C'] as LightboxReadingGroupId[] };
    expect(line(board, { activeRun })).toEqual({
      status: 'running',
      note: 'Analyzing… 1 of 3 calls back',
      stopToken: 'run-1'
    });
    // Before the host names the run there is nothing to stop, and only the groups visibly running are counted.
    expect(line(board)).toEqual({ status: 'running', note: 'Analyzing… 0 of 2 calls back' });
    expect(line(makeBoard(8), { awaitingStart: true })).toEqual({ status: 'running', note: 'Starting…' });
  });

  it('says the Opinion is weighing the board when it runs last, or on its own (Slice 4I)', () => {
    const opinionOnly = withGroups(makeBoard(8), [
      readGroup('A'),
      { ...emptyLightboxReadingGroup('F'), status: 'running', pending: ['opinion'] }
    ]);
    const alone = { boardId: opinionOnly.boardId, token: 'run-f', groups: ['F'] as LightboxReadingGroupId[] };
    expect(line(opinionOnly, { activeRun: alone })).toEqual({
      status: 'running',
      note: 'Weighing the board for the Opinion… 0 of 1 call back',
      stopToken: 'run-f'
    });
    const last = { ...alone, groups: ['A', 'F'] as LightboxReadingGroupId[] };
    expect(line(opinionOnly, { activeRun: last }).note).toBe('Weighing the board for the Opinion… 1 of 2 calls back');
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
        note: 'Analyzing… 0 of 1 call back',
        stopToken: 'run-own'
      });
    });
  });

  it('counts quotes checked and withheld once everything landed, and offers Re-analyze alone', () => {
    const view = line(makeReadBoard({ paraphraseOne: true }));
    expect(view.status).toBe('done');
    // Six calls: groups A–E and the Opinion (Slice 4D).
    expect(view.note).toMatch(/^\d+ quotes checked · 1 withheld · 7 calls$/);
    expect(view.action).toMatchObject({ label: 'Re-analyze', scope: { mode: 'all' }, disabled: false });
    // Slice 4M: Re-analyze already runs every call; nothing stands beside it.
    expect(view.secondaryAction).toBeUndefined();
  });

  it('says how many lenses are stale after the chapter changed, and still offers Re-analyze (D4)', () => {
    const read = makeReadBoard();
    const board = withGroups(read, read.readings.map((group) => ({
      ...group,
      staleLenses: group.lenses.map((lens) => ({ lens, readAgainst: 'earlier-hash' }))
    })));
    const view = line(board);
    expect(view.note).toMatch(/ · \d+ lenses stale$/);
    expect(view.action).toMatchObject({ label: 'Re-analyze', scope: { mode: 'all' } });
  });

  it('after a stop, keeps the finished groups and offers Finish at its own cost, and Re-analyze all at every call\'s', () => {
    const board = withGroups(makeBoard(8), [
      readGroup('A'),
      { ...emptyLightboxReadingGroup('B'), status: 'cancelled', error: 'Stopped before this group came back.' },
      { ...emptyLightboxReadingGroup('C'), status: 'cancelled', error: 'Stopped before this group came back.' }
    ]);
    const view = line(board);
    expect(view.status).toBe('stopped');
    expect(view.note).toContain('stopped, finished groups kept');
    expect(view.action).toEqual({ label: 'Finish', scope: { mode: 'rest' }, cost: '2 calls · est. $0.03', disabled: false });
    expect(view.secondaryAction).toEqual({ label: 'Re-analyze all', scope: { mode: 'all' }, cost: '3 calls · est. $0.04', disabled: false });
  });

  it('offers Finish after one call ran on its own, priced for the calls not back yet (Slice 4I), and Re-analyze all beside it (Slice 4M)', () => {
    const board = withGroups(makeBoard(8), [emptyLightboxReadingGroup('A'), readGroup('B'), emptyLightboxReadingGroup('C')]);
    const view = line(board);
    expect(view.status).toBe('done');
    expect(view.action).toMatchObject({ label: 'Finish', scope: { mode: 'rest' }, cost: '2 calls · est. $0.03' });
    expect(view.secondaryAction).toMatchObject({ label: 'Re-analyze all', scope: { mode: 'all' }, cost: '3 calls · est. $0.04', disabled: false });
  });

  describe('Re-analyze all beside Finish (Slice 4M, epic decision 53)', () => {
    /** The writer's case: one call failed, the others landed. */
    const oneFailed = () => withGroups(makeBoard(8), [
      readGroup('A'),
      { ...emptyLightboxReadingGroup('B'), status: 'failed', error: 'The call failed before a reading came back. Press Finish or Analyze to try again.' },
      readGroup('C')
    ]);

    it('gives the Finish state both presses: Finish the failed call, or every call again', () => {
      const view = line(oneFailed());
      expect(view).toMatchObject({
        status: 'done',
        action: { label: 'Finish', scope: { mode: 'rest' }, cost: '1 call · est. $0.01', disabled: false },
        secondaryAction: { label: 'Re-analyze all', scope: { mode: 'all' }, cost: '3 calls · est. $0.04', disabled: false }
      });
      expect(lightboxRunLineReasons(view)).toEqual({ shown: [] });
    });

    it('gives idle, running and every-call-landed one press, or none', () => {
      expect(line(makeBoard(8)).secondaryAction).toBeUndefined();
      expect(line(makeBoard(8), { estimate: undefined }).secondaryAction).toBeUndefined();
      expect(line(makeBoard(8), { awaitingStart: true }).secondaryAction).toBeUndefined();
      expect(line(makeReadBoard()).secondaryAction).toBeUndefined();
    });

    it('gives Finish alone while no call has landed, since Finish then runs every call', () => {
      const stoppedAtOnce = withGroups(makeBoard(8), (['A', 'B', 'C'] as const).map((group) => ({
        ...emptyLightboxReadingGroup(group), status: 'cancelled' as const, error: 'Stopped before this group came back.'
      })));
      const view = line(stoppedAtOnce);
      expect(view.action).toMatchObject({ label: 'Finish', scope: { mode: 'rest' }, cost: '3 calls · est. $0.04' });
      expect(view.secondaryAction).toBeUndefined();
    });

    it('disables both without a key, with the one reason said once and each press described by it', () => {
      const view = line(oneFailed(), { providerPaused: true });
      const reason = 'Add an OpenRouter API key in Settings to run AI analyses.';
      expect(view.action).toMatchObject({ disabled: true, reason });
      expect(view.secondaryAction).toMatchObject({ disabled: true, reason });
      expect(lightboxRunLineReasons(view)).toEqual({
        shown: [{ id: 'pm-lb-run-reason', text: reason }],
        action: 'pm-lb-run-reason',
        secondaryAction: 'pm-lb-run-reason'
      });
    });

    it('disables only Re-analyze all when only a call that landed is too large, the host\'s reason led by its label', () => {
      // Call A landed before the window shrank; Finish makes only B.
      const estimate = makeEstimate({ fit: 'too-large', reason: 'Group A would send about 90,000 tokens…' });
      estimate.groups[0].fit = 'too-large';
      const view = line(oneFailed(), { estimate });
      expect(view.action).toEqual({ label: 'Finish', scope: { mode: 'rest' }, cost: '1 call · est. $0.01', disabled: false });
      expect(view.secondaryAction).toMatchObject({ disabled: true, reason: 'Group A would send about 90,000 tokens…' });
      expect(lightboxRunLineReasons(view)).toEqual({
        shown: [{ id: 'pm-lb-run-reason-all', text: 'Re-analyze all: Group A would send about 90,000 tokens…' }],
        secondaryAction: 'pm-lb-run-reason-all'
      });
    });

    it('names Finish\'s own call when it is too large and the host\'s reason names a call Finish does not make', () => {
      const estimate = makeEstimate({ fit: 'too-large', reason: 'Group A would send about 90,000 tokens…' });
      estimate.groups[0].fit = 'too-large';
      estimate.groups[1] = { ...estimate.groups[1], fit: 'too-large', inputTokens: 80_000 };
      const view = line(oneFailed(), { estimate });
      const own = 'Call B would send about 80,000 tokens and reserve 12,000 for the reply, more than ' +
        'provider/model-v1\'s 200,000-token window allows.';
      expect(view.action).toMatchObject({ disabled: true, reason: own });
      expect(view.secondaryAction).toMatchObject({ disabled: true, reason: 'Group A would send about 90,000 tokens…' });
      expect(lightboxRunLineReasons(view)).toEqual({
        shown: [
          { id: 'pm-lb-run-reason', text: `Finish: ${own}` },
          { id: 'pm-lb-run-reason-all', text: 'Re-analyze all: Group A would send about 90,000 tokens…' }
        ],
        action: 'pm-lb-run-reason',
        secondaryAction: 'pm-lb-run-reason-all'
      });
    });

    it('keeps the host\'s reason for Finish when Finish makes the call it names, said once for both', () => {
      const estimate = makeEstimate({ fit: 'too-large', reason: 'Group B would send about 80,000 tokens…' });
      estimate.groups[1].fit = 'too-large';
      const view = line(oneFailed(), { estimate });
      expect(view.action).toMatchObject({ disabled: true, reason: 'Group B would send about 80,000 tokens…' });
      expect(view.secondaryAction).toMatchObject({ disabled: true, reason: 'Group B would send about 80,000 tokens…' });
      expect(lightboxRunLineReasons(view).shown).toEqual([{ id: 'pm-lb-run-reason', text: 'Group B would send about 80,000 tokens…' }]);
    });

    it('says a single press\'s reason as it is, under the id the run line always used', () => {
      expect(lightboxRunLineReasons(line(makeBoard(8), { providerPaused: true }))).toEqual({
        shown: [{ id: 'pm-lb-run-reason', text: 'Add an OpenRouter API key in Settings to run AI analyses.' }],
        action: 'pm-lb-run-reason'
      });
    });
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
      reason: 'The Theme & motif lens is off. Turn it on in the rail to re-analyze this tile.'
    });
    expect(lightboxRereadAvailability({ ...base, estimate: undefined })).toEqual({ reason: 'Estimating the cost…' });
    expect(lightboxRereadAvailability({ ...base, lens: 'voice' })).toEqual({
      reason: 'This tile cannot be re-analyzed until the board is estimated.'
    });
    const tight = makeEstimate();
    tight.rereads = [{ ...tight.rereads[0], fit: 'too-large', inputTokens: 40_000 }];
    expect(lightboxRereadAvailability({ ...base, estimate: tight })).toEqual({
      reason: 'Re-analyzing this tile would send about 40,000 tokens and reserve 12,000 for the reply, ' +
        'more than provider/model-v1\'s 200,000-token window allows.'
    });
    expect(lightboxRereadAvailability({ ...base, running: true }).reason).toMatch(/^An analysis is running/);
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
