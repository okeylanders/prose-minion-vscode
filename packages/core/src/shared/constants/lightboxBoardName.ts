/**
 * A saved board's name (Slice 5A.1; epic decision 33): the writer's own
 * words for a board, such as "3.2.1 - after the cut - model B", to record the
 * chapter version and the model that read it. Optional: a board without one
 * is unnamed, and shows as it always has.
 *
 * One rule, shared by the codec, the host's rename route and the rail's
 * field, so a name the rail accepts is one the file keeps:
 * - trimmed; empty means unnamed;
 * - one line: no control character (a tab or a line break among them) and
 *   no line or paragraph separator;
 * - at most `LIGHTBOX_BOARD_NAME_CHARACTERS` characters, counted as the
 *   field's own `maxLength` counts them (UTF-16 code units).
 *
 * A name is writer text, treated as source text is: never in a log, and
 * never in the webview's saved state.
 *
 * Slice 5A.2 (epic decision 46): a board the writer has not named takes a
 * default name when it is first saved, from its source and the time
 * (`lightboxDefaultBoardName`), and the writer can rename it.
 */

/** The longest name a board may have: room for a chapter version, a note and a model's nickname. */
export const LIGHTBOX_BOARD_NAME_CHARACTERS = 120;

export type LightboxBoardNameFault = 'too-long' | 'not-one-line';

export type LightboxBoardNameCheck =
  | { kind: 'named'; name: string }
  | { kind: 'unnamed' }
  | { kind: 'invalid'; fault: LightboxBoardNameFault };

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the faults' kebab-case words. */
/** What the rail says when a name is refused. */
export const LIGHTBOX_BOARD_NAME_FAULTS: Readonly<Record<LightboxBoardNameFault, string>> = {
  'too-long': `A board's name is at most ${LIGHTBOX_BOARD_NAME_CHARACTERS} characters.`,
  'not-one-line': 'A board\'s name is one line, with no tabs or line breaks.'
};
/* eslint-enable @typescript-eslint/naming-convention */

const NOT_ONE_LINE = /[\p{Cc}\u2028\u2029]/u;

/** A name as the writer typed it, checked: the name it becomes, unnamed, or why it is refused. */
export function checkLightboxBoardName(value: string): LightboxBoardNameCheck {
  const name = value.trim();
  if (name.length === 0) {
    return { kind: 'unnamed' };
  }
  if (NOT_ONE_LINE.test(name)) {
    return { kind: 'invalid', fault: 'not-one-line' };
  }
  if (name.length > LIGHTBOX_BOARD_NAME_CHARACTERS) {
    return { kind: 'invalid', fault: 'too-long' };
  }
  return { kind: 'named', name };
}

/** Whether `value` is a name exactly as a board saves one: not empty, already trimmed, one line, within the limit. */
export function isSavedLightboxBoardName(value: string): boolean {
  const check = checkLightboxBoardName(value);
  return check.kind === 'named' && check.name === value;
}

/** What a board's default name says of its source: a file or a selection, by its workspace-relative path. */
export interface LightboxBoardNameSource {
  kind: 'file' | 'selection';
  displayPath: string;
  startLine?: number;
  endLine?: number;
}

/**
 * The source as a default name calls it (Slice 5A.2): the file's name
 * without its folder or extension ("Drafts/Chapter 6.md" is "Chapter 6");
 * a selection adds its lines as the source panel shows them ("Chapter 6 ·
 * lines 12–40"). One line, whatever the path holds.
 */
export function lightboxBoardSourceLabel(source: LightboxBoardNameSource): string {
  const file = source.displayPath.split(/[\\/]/).filter(Boolean).at(-1) ?? '';
  const base = (file.replace(/\.[^.]+$/, '') || file).replace(/[\p{Cc}\u2028\u2029]+/gu, ' ').replace(/\s+/g, ' ').trim() || 'Untitled';
  if (source.kind !== 'selection' || source.startLine === undefined) {
    return base;
  }
  return source.endLine !== undefined && source.endLine !== source.startLine
    ? `${base} · lines ${source.startLine}–${source.endLine}`
    : `${base} · line ${source.startLine}`;
}

/**
 * A board's name when it is first saved and the writer has not named it
 * (Slice 5A.2, epic decision 46): "<source> - <M/D/YYYY h:mm AM/PM>", as
 * "Chapter 6 - 10/23/2026 9:08 AM", in `timeZone` (the host's own when
 * absent; tests pin one). A saved name by the rule above: one line, and the
 * source's part cut, with an ellipsis, so the whole stays within
 * `LIGHTBOX_BOARD_NAME_CHARACTERS`. A file saved before names existed shows
 * this from its own `savedAt`, and is not rewritten for it.
 */
export function lightboxDefaultBoardName(source: LightboxBoardNameSource, savedAt: number | Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    ...(timeZone ? { timeZone } : {})
  }).formatToParts(new Date(savedAt));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? '';
  const when = ` - ${part('month')}/${part('day')}/${part('year')} ${part('hour')}:${part('minute')} ${part('dayPeriod').toUpperCase()}`;
  const label = lightboxBoardSourceLabel(source);
  const room = LIGHTBOX_BOARD_NAME_CHARACTERS - when.length;
  return `${label.length > room ? `${label.slice(0, room - 1).trimEnd()}…` : label}${when}`;
}
