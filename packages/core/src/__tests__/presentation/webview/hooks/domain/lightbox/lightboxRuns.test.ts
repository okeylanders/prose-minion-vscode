/**
 * Runs per board and token (PR #149 F-03): a message changes only the board
 * it names, and only under that board's run; Stop is built from the board's
 * own run.
 */
import type { LightboxReadingGroupId, LightboxRunProgress } from '@messages';
import {
  NO_LIGHTBOX_RUNS,
  applyLightboxRunProgress,
  lightboxCancelOf,
  pruneLightboxRuns,
  withLightboxBoardRun
} from '@hooks/domain/lightbox/lightboxRuns';

const progress = (
  boardId: string,
  phase: LightboxRunProgress['phase'],
  token?: string,
  groups: LightboxReadingGroupId[] = ['A', 'B', 'C']
): LightboxRunProgress => ({ boardId, phase, ...(token ? { token } : {}), groups, groupsBack: 0, outputCharacters: 0 });

const apply = (...messages: LightboxRunProgress[]) => messages.reduce(applyLightboxRunProgress, NO_LIGHTBOX_RUNS);

describe('runs per board and token (PR #149 F-03)', () => {
  it('names a board\'s run when it starts, and follows its own progress', () => {
    const runs = apply(progress('B', 'started', 'run-B'), { ...progress('B', 'streaming', 'run-B'), outputCharacters: 1_200 });
    expect(runs.B.run).toEqual({ boardId: 'B', token: 'run-B', groups: ['A', 'B', 'C'] });
    expect(runs.B.progress?.outputCharacters).toBe(1_200);
  });

  it('keeps one board\'s run when another board\'s run finishes or streams', () => {
    const runs = apply(
      progress('A', 'started', 'run-A'),
      progress('B', 'started', 'run-B'),
      progress('A', 'streaming', 'run-A'),
      progress('A', 'finished', 'run-A')
    );
    expect(runs.B.run?.token).toBe('run-B');
    expect(runs.B.progress?.phase).toBe('started');
    expect(runs.A.run).toBeUndefined();
  });

  it('ignores late progress after a Stop, and after a new run replaced the old one', () => {
    const stopped = apply(progress('B', 'started', 'run-1'), progress('B', 'cancelled', 'run-1'), progress('B', 'streaming', 'run-1'));
    expect(stopped.B).toEqual({ progress: progress('B', 'cancelled', 'run-1') });

    const replaced = apply(
      progress('B', 'started', 'run-1'),
      progress('B', 'cancelled', 'run-1'),
      progress('B', 'started', 'run-2'),
      progress('B', 'streaming', 'run-1'),
      progress('B', 'finished', 'run-1')
    );
    expect(replaced.B.run?.token).toBe('run-2');
    expect(replaced.B.progress?.token).toBe('run-2');
  });

  it('keeps the run through a refused press on the same board', () => {
    const runs = apply(progress('B', 'started', 'run-B'), { ...progress('B', 'refused', undefined, []), message: 'Already being read.' });
    expect(runs.B.run?.token).toBe('run-B');
    expect(runs.B.progress?.phase).toBe('refused');
  });

  it('takes a current estimate reply as the host\'s word on the board\'s run', () => {
    const runs = apply(progress('B', 'started', 'run-B'), progress('B', 'streaming', 'run-B'));
    expect(withLightboxBoardRun(runs, 'B', { boardId: 'B', token: 'run-B', groups: ['A'] })).toBe(runs);
    expect(withLightboxBoardRun(runs, 'B', undefined).B.run).toBeUndefined();
    expect(withLightboxBoardRun(runs, 'B', { boardId: 'B', token: 'run-C', groups: ['C'] }).B).toEqual({
      run: { boardId: 'B', token: 'run-C', groups: ['C'] }
    });
  });

  it('builds Stop from the board\'s own run only', () => {
    const runs = apply(progress('A', 'started', 'run-A'), progress('B', 'started', 'run-B'));
    expect(lightboxCancelOf(runs, 'B', 'run-B')).toEqual({ boardId: 'B', token: 'run-B' });
    expect(lightboxCancelOf(runs, 'B', 'run-A')).toBeUndefined();
    expect(lightboxCancelOf(runs, undefined, 'run-B')).toBeUndefined();
  });

  it('forgets boards with nothing in flight, except the one on screen', () => {
    const runs = apply(progress('A', 'started', 'run-A'), progress('A', 'finished', 'run-A'), progress('B', 'started', 'run-B'));
    expect(Object.keys(pruneLightboxRuns(runs, 'C'))).toEqual(['B']);
    expect(Object.keys(pruneLightboxRuns(runs, 'A')).sort()).toEqual(['A', 'B']);
  });
});
