/**
 * Time in session-recall text: a saved session's own timezone, and the room
 * frames' elapsed-time words. Recall keeps its own copy of those words
 * because it may not import the room-frame renderer (runway F11).
 */

/**
 * Dates and times in one session's timezone, assembled from parts so the
 * text does not drift with the ICU version (newer ICU puts a narrow
 * no-break space before "PM").
 */
export class WorkshopRecallClock {
  private readonly dateFormat: Intl.DateTimeFormat;
  private readonly timeFormat: Intl.DateTimeFormat;
  private readonly dayFormat: Intl.DateTimeFormat;

  constructor(timeZone: string) {
    this.dateFormat = new Intl.DateTimeFormat('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone
    });
    this.timeFormat = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone
    });
    this.dayFormat = new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone
    });
  }

  /** "Thursday, October 1, 2026" */
  date(at: number): string {
    const part = parts(this.dateFormat, at);
    return `${part.weekday}, ${part.month} ${part.day}, ${part.year}`;
  }

  /** "2:14 PM" */
  time(at: number): string {
    const part = parts(this.timeFormat, at);
    return `${part.hour}:${part.minute} ${part.dayPeriod}`;
  }

  /** A calendar-day key in this timezone. */
  day(at: number): string {
    const part = parts(this.dayFormat, at);
    return `${part.year}-${part.month}-${part.day}`;
  }
}

function parts(format: Intl.DateTimeFormat, at: number): Partial<Record<Intl.DateTimeFormatPartTypes, string>> {
  return Object.fromEntries(format.formatToParts(at).map((part) => [part.type, part.value]));
}

/** The room frames' elapsed-time vocabulary ("3 hours", "2 days"). */
export function workshopRecallDuration(milliseconds: number): string {
  const clamped = Math.max(0, milliseconds);
  if (clamped < 60_000) {
    return 'less than a minute';
  }
  if (clamped < 60 * 60_000) {
    return plural(Math.max(1, Math.round(clamped / 60_000)), 'minute');
  }
  if (clamped < 24 * 60 * 60_000) {
    return plural(Math.max(1, Math.round(clamped / (60 * 60_000))), 'hour');
  }
  return plural(Math.max(1, Math.round(clamped / (24 * 60 * 60_000))), 'day');
}

function plural(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? '' : 's'}`;
}
