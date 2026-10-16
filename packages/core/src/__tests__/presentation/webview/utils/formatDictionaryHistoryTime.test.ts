import { formatDictionaryHistoryTime } from '@utils/formatDictionaryHistoryTime';

/*
 * Every date is built with the local-time constructor and handed over as the
 * ISO string the host stores, so the expectations hold in any time zone.
 */
const isoAt = (...fields: [number, number, number, number, number]): string =>
  new Date(...fields).toISOString();

describe('formatDictionaryHistoryTime', () => {
  const NOW = new Date(2026, 9, 14, 18, 30);

  it('labels a lookup from earlier today with its clock time', () => {
    expect(formatDictionaryHistoryTime(isoAt(2026, 9, 14, 14, 2), NOW)).toBe('Today 14:02');
  });

  it('pads single-digit hours and minutes', () => {
    expect(formatDictionaryHistoryTime(isoAt(2026, 9, 14, 0, 5), NOW)).toBe('Today 00:05');
  });

  it('labels a lookup from the previous calendar day as yesterday', () => {
    expect(formatDictionaryHistoryTime(isoAt(2026, 9, 13, 9, 15), NOW)).toBe('Yesterday 09:15');
  });

  it('counts yesterday by calendar day, not by the last 24 hours', () => {
    const justAfterMidnight = new Date(2026, 9, 14, 0, 10);
    expect(formatDictionaryHistoryTime(isoAt(2026, 9, 13, 23, 50), justAfterMidnight)).toBe(
      'Yesterday 23:50'
    );
    expect(formatDictionaryHistoryTime(isoAt(2026, 9, 12, 23, 50), NOW)).toBe('Oct 12, 23:50');
  });

  it('finds yesterday across a month boundary and a year boundary', () => {
    expect(formatDictionaryHistoryTime(isoAt(2026, 9, 31, 22, 0), new Date(2026, 10, 1, 8, 0))).toBe(
      'Yesterday 22:00'
    );
    expect(formatDictionaryHistoryTime(isoAt(2025, 11, 31, 22, 10), new Date(2026, 0, 1, 9, 0))).toBe(
      'Yesterday 22:10'
    );
  });

  it('shows the month and day for an older lookup in the current year', () => {
    expect(formatDictionaryHistoryTime(isoAt(2026, 9, 12, 9, 15), NOW)).toBe('Oct 12, 09:15');
    expect(formatDictionaryHistoryTime(isoAt(2026, 0, 3, 17, 45), NOW)).toBe('Jan 3, 17:45');
  });

  it('adds the year for a lookup from an earlier year', () => {
    expect(formatDictionaryHistoryTime(isoAt(2025, 9, 12, 9, 15), NOW)).toBe('Oct 12 2025, 09:15');
  });

  it('measures every label against the now it is given, not the system clock', () => {
    const farFuture = new Date(2031, 2, 5, 12, 0);
    expect(formatDictionaryHistoryTime(isoAt(2031, 2, 5, 7, 30), farFuture)).toBe('Today 07:30');
    expect(formatDictionaryHistoryTime(isoAt(2026, 9, 14, 14, 2), farFuture)).toBe('Oct 14 2026, 14:02');
  });

  it('returns an empty string for a timestamp it cannot parse', () => {
    expect(formatDictionaryHistoryTime('not a timestamp', NOW)).toBe('');
    expect(formatDictionaryHistoryTime('', NOW)).toBe('');
    expect(formatDictionaryHistoryTime('2026-13-45T99:99:99Z', NOW)).toBe('');
  });
});
