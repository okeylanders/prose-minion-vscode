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
