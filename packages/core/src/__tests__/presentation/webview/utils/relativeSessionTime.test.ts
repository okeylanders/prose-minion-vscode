import { relativeSessionTime } from '@utils/relativeSessionTime';

describe('relativeSessionTime', () => {
  const NOW = new Date('2026-07-23T15:00:00').getTime();

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('walks the label ladder from just now through hours', () => {
    expect(relativeSessionTime(NOW - 30_000)).toBe('just now');
    expect(relativeSessionTime(NOW - 5 * 60_000)).toBe('5m ago');
    expect(relativeSessionTime(NOW - 2 * 3_600_000)).toBe('2h ago');
  });

  it('labels yesterday with a clock time once past the hours window', () => {
    const yesterdayMorning = new Date('2026-07-22T09:00:00').getTime();
    expect(relativeSessionTime(yesterdayMorning)).toMatch(/^Yesterday · /);
  });

  it('includes the weekday for sessions within the last week', () => {
    const monday = new Date('2026-07-20T09:00:00').getTime();
    expect(relativeSessionTime(monday)).toBe('Mon · Jul 20');
  });

  it('drops the weekday for older sessions', () => {
    const older = new Date('2026-07-09T09:00:00').getTime();
    expect(relativeSessionTime(older)).toBe('Jul 9');
  });

  it('handles invalid timestamps', () => {
    expect(relativeSessionTime(Number.NaN)).toBe('Unknown time');
  });
});
