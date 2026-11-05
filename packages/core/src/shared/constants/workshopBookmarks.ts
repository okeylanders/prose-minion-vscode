/**
 * A bookmark's label (ADR 2026-11-03 D5): the writer's own words for a
 * bubble they mean to come back to. Optional: a bookmark without one shows
 * the host's deterministic default.
 *
 * One rule, shared by the codec, the host's rename route and the rail's
 * rename field, so a label the rail accepts is one the session keeps:
 * - trimmed; empty means "use the default";
 * - one line: no control character (a tab or a line break among them) and
 *   no line or paragraph separator;
 * - at most `WORKSHOP_BOOKMARK_LABEL_CHARACTERS` characters, counted as a
 *   field's `maxLength` counts them (UTF-16 code units).
 *
 * A label is writer text: never in a log.
 */

import { WORKSHOP_BOOKMARK_LABEL_CHARACTERS } from '@messages';
import type { WorkshopTurn } from '@messages';

export type WorkshopBookmarkLabelFault = 'too-long' | 'not-one-line';

export type WorkshopBookmarkLabelCheck =
  | { kind: 'named'; label: string }
  | { kind: 'default' }
  | { kind: 'invalid'; fault: WorkshopBookmarkLabelFault };

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the faults' kebab-case words. */
/** What the writer is told when a label is refused. */
export const WORKSHOP_BOOKMARK_LABEL_FAULTS: Readonly<Record<WorkshopBookmarkLabelFault, string>> = {
  'too-long': `A bookmark's name is at most ${WORKSHOP_BOOKMARK_LABEL_CHARACTERS} characters.`,
  'not-one-line': 'A bookmark\'s name is one line, with no tabs or line breaks.'
};
/* eslint-enable @typescript-eslint/naming-convention */

const NOT_ONE_LINE = /[\p{Cc}\u2028\u2029]/u;

/** A label as the writer typed it, checked: the label it becomes, the default, or why it is refused. */
export function checkWorkshopBookmarkLabel(value: string | null): WorkshopBookmarkLabelCheck {
  const label = (value ?? '').trim();
  if (label.length === 0) {
    return { kind: 'default' };
  }
  if (NOT_ONE_LINE.test(label)) {
    return { kind: 'invalid', fault: 'not-one-line' };
  }
  if (label.length > WORKSHOP_BOOKMARK_LABEL_CHARACTERS) {
    return { kind: 'invalid', fault: 'too-long' };
  }
  return { kind: 'named', label };
}

/** Whether `value` is a label exactly as a session stores one: not empty, already trimmed, one line, within the limit. */
export function isStoredWorkshopBookmarkLabel(value: string): boolean {
  const check = checkWorkshopBookmarkLabel(value);
  return check.kind === 'named' && check.label === value;
}

/** The turn facts eligibility reads; the bubble and the host's ledger pass the same turn. */
export type WorkshopBookmarkTurnFacts = Pick<WorkshopTurn, 'role' | 'kind' | 'participant'>;

/**
 * Which turns may carry a bookmark (ADR 2026-11-03 D5): one rule, read by the
 * host's ledger (the authority, which refuses anything else) and by the
 * bubble (which offers the toggle only where the host would accept it).
 *
 * Eligible: agent replies (host, guest, tool, including tool reports and
 * capability cards) and the writer's messages. Refused: dividers, session and
 * standing-directive markers, and the writer's direct tool-run requests.
 */
export function isWorkshopBookmarkableTurn(turn: WorkshopBookmarkTurnFacts): boolean {
  if (turn.kind === 'divider' || turn.participant === 'session' || turn.role === 'system') {
    return false;
  }
  if (turn.role === 'assistant') {
    return turn.participant === 'host' || turn.participant === 'guest' || turn.participant === 'tool';
  }
  return turn.role === 'user' && turn.participant === 'writer' && turn.kind === 'message';
}
