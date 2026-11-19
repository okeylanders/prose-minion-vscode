/**
 * A persona's to-do changes in the persisted session (ADR 2026-11-19 D8,
 * D9): `closedBy` on a stored to-do and `todoStatusChanges` on a turn.
 * Both are optional and additive: a session without them reads and writes
 * exactly as before, with no `schemaVersion` bump and no normalization (ADR
 * 2026-07-30). Forward only: an older build's strict reader rejects a
 * session that holds either key. Called from the session shape file.
 *
 * When present each is exact:
 * - `closedBy`: a known persona, its label, the room's id and title, the
 *   turn, the time and an optional one-line note within `noteCharacters`;
 * - `todoStatusChanges`: on a host or guest reply only, one to
 *   `changesPerReply` rows, each naming its session, its title, the to-do,
 *   its text within the to-do's own bound, a status a persona may set,
 *   `previous: open`, an optional note, its state, its write's
 *   `operationId` (D8a), and a `reason` exactly when it is `refused`. `elsewhere` is the webview's and is never stored.
 */

import { isWorkshopPersonaId } from '@shared/constants/workshopPersonas';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  WORKSHOP_TODO_STATUS_CHANGE_STATES,
  WORKSHOP_TODO_STATUS_SETTABLE,
  WORKSHOP_TODO_STATUS_WRITE_REFUSALS
} from '@shared/types/messages/workshop/todoStatus';
import { WORKSHOP_TODO_BOUNDS } from '@/application/services/workshop/WorkshopSessionLimits';
import {
  boundedArrayAt,
  boundedStringAt,
  enumAt,
  exactObject,
  numberAt,
  optionalBoundedStringAt,
  shapeError
} from '@/application/services/workshop/persistedValidation';

/** A session title's bound here: the store's own title rule is stricter. */
const TITLE_CHARACTERS = 500;
/** An id's bound: a session's, a to-do's or a turn's. */
const ID_CHARACTERS = 200;

/** Strict structure of a stored to-do's `closedBy`. */
export function assertWorkshopTodoClosedByShape(value: unknown, path: string): void {
  const closedBy = exactObject(value, path, ['personaId', 'personaLabel', 'sessionId', 'sessionTitle', 'turnId', 'at', 'operationId'], ['note']);
  if (!isWorkshopPersonaId(closedBy.personaId)) {
    shapeError(`${path}.personaId`, 'known Workshop persona id');
  }
  boundedStringAt(closedBy.personaLabel, `${path}.personaLabel`, TITLE_CHARACTERS, false);
  boundedStringAt(closedBy.sessionId, `${path}.sessionId`, ID_CHARACTERS, false);
  boundedStringAt(closedBy.sessionTitle, `${path}.sessionTitle`, TITLE_CHARACTERS);
  boundedStringAt(closedBy.turnId, `${path}.turnId`, ID_CHARACTERS, false);
  numberAt(closedBy.at, `${path}.at`);
  boundedStringAt(closedBy.operationId, `${path}.operationId`, ID_CHARACTERS, false);
  optionalBoundedStringAt(closedBy.note, `${path}.note`, PROMPT_BUDGETS.workshopTodoStatus.noteCharacters, false);
}

/** Strict structure of a turn's `todoStatusChanges`; refused on any turn but a host or guest reply. */
export function assertWorkshopTodoStatusChangesShape(
  value: unknown,
  path: string,
  turn: { readonly role?: unknown; readonly participant?: unknown }
): void {
  if (turn.role !== 'assistant' || (turn.participant !== 'host' && turn.participant !== 'guest')) {
    shapeError(path, 'receipt rows on a persona reply');
  }
  boundedArrayAt(value, path, 1, PROMPT_BUDGETS.workshopTodoStatus.changesPerReply, 'to-do changes');
  value.forEach((item, index) => assertRow(item, `${path}[${index}]`));
}

function assertRow(value: unknown, path: string): void {
  const row = exactObject(
    value,
    path,
    ['session', 'sessionTitle', 'todoId', 'todoText', 'status', 'previous', 'state', 'operationId'],
    ['note', 'reason', 'roomSessionId']
  );
  boundedStringAt(row.session, `${path}.session`, ID_CHARACTERS, false);
  boundedStringAt(row.sessionTitle, `${path}.sessionTitle`, TITLE_CHARACTERS);
  boundedStringAt(row.todoId, `${path}.todoId`, ID_CHARACTERS, false);
  boundedStringAt(row.todoText, `${path}.todoText`, WORKSHOP_TODO_BOUNDS.textCharacters);
  enumAt(row.status, `${path}.status`, WORKSHOP_TODO_STATUS_SETTABLE);
  enumAt(row.previous, `${path}.previous`, ['open']);
  optionalBoundedStringAt(row.note, `${path}.note`, PROMPT_BUDGETS.workshopTodoStatus.noteCharacters, false);
  enumAt(row.state, `${path}.state`, WORKSHOP_TODO_STATUS_CHANGE_STATES);
  boundedStringAt(row.operationId, `${path}.operationId`, ID_CHARACTERS, false);
  if (row.state === 'refused') {
    enumAt(row.reason, `${path}.reason`, WORKSHOP_TODO_STATUS_WRITE_REFUSALS);
  } else if (row.reason !== undefined) {
    shapeError(`${path}.reason`, 'a reason on a refused row only');
  }
  optionalBoundedStringAt(row.roomSessionId, `${path}.roomSessionId`, ID_CHARACTERS, false);
}
