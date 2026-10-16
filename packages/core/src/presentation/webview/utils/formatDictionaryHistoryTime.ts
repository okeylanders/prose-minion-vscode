/**
 * When a Dictionary history lookup ran, as the popup rows and the "From
 * history" meta line show it (ADR 2026-10-14): `Today 14:02`,
 * `Yesterday 09:15`, `Oct 12, 09:15` within the current year, and
 * `Oct 12 2025, 09:15` before it.
 *
 * Absolute rather than relative ("3h ago") because a history row is a record
 * the writer scans for a particular lookup, and a relative label would drift
 * while the popup stays open. Local time on a 24-hour clock. The month names
 * are fixed here rather than taken from `Intl`, so the label reads the same on
 * every machine and in every test run.
 *
 * Pure: the caller supplies `now`. An unparseable timestamp returns `''`.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const twoDigits = (value: number): string => String(value).padStart(2, '0');

const isSameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const formatDictionaryHistoryTime = (iso: string, now: Date): string => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) {
    return '';
  }

  const clock = `${twoDigits(at.getHours())}:${twoDigits(at.getMinutes())}`;
  if (isSameLocalDay(at, now)) {
    return `Today ${clock}`;
  }

  // Built from calendar fields so month ends, year ends, and DST shifts all
  // land on the right day; subtracting 24 hours would not.
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (isSameLocalDay(at, yesterday)) {
    return `Yesterday ${clock}`;
  }

  const monthDay = `${MONTHS[at.getMonth()]} ${at.getDate()}`;
  if (at.getFullYear() === now.getFullYear()) {
    return `${monthDay}, ${clock}`;
  }
  return `${monthDay} ${at.getFullYear()}, ${clock}`;
};
