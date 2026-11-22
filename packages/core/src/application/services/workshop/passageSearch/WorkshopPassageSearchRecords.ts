/**
 * A passage search's three fields on a persisted turn (ADR 2026-11-20 D17,
 * D18, D19a): each optional, additive and exact, with no `schemaVersion`
 * bump (ADR 2026-07-30). Forward only: an older build's strict reader
 * refuses a session that holds one.
 *
 * - **`passageSearchRequest`** on a host or guest reply: the question, 1 to
 *   `scopes` places and, once the writer cancelled, `answer`. The host's
 *   derived `view` is never stored, so a saved one is refused.
 * - **`passageSearchResults`** on the writer-role turn a delivery records.
 * - **`passageSearchDelivery`** on a host or guest reply: the receipt, ids
 *   and counts only.
 *
 * Every closed word is checked against the list its type is made from, so
 * a new one does not compile until this codec reads it. The bounds are the
 * frame's own (`PROMPT_BUDGETS.workshopPassageSearch`) and the engine's.
 *
 * The session's writes live here too, so the session service calls one
 * function for each: the reply's stamp in its commit, the request turn's
 * mark, and the writer's Cancel.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { CONTEXT_PATH_GROUPS } from '@shared/types';
import {
  WORKSHOP_PASSAGE_SEARCH_ENDINGS,
  type WorkshopPassageSearchDelivery,
  type WorkshopPassageSearchRequest,
  type WorkshopTurn
} from '@messages';
import { isSafeConfiguredResourcePath } from '@/utils/configuredResourcePath';
import {
  boundedArrayAt,
  boundedStringAt,
  booleanAt,
  enumAt,
  exactObject,
  numberAt,
  shapeError
} from '@/application/services/workshop/persistedValidation';

const BOUNDS = PROMPT_BUDGETS.workshopPassageSearch;
/** The longest turn id a field names; the ledger mints short ones. */
const TURN_ID_CHARACTERS = 256;
/** A line break or any other control character: a question is one line. */
const NOT_ONE_LINE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;

/** What a reply's commit stamps on it: the card it carried, and the receipt of a delivery it answered. */
export interface WorkshopPassageSearchReplyCommit {
  readonly request?: WorkshopPassageSearchRequest;
  readonly delivery?: WorkshopPassageSearchDelivery;
}

function countAt(value: unknown, path: string): number {
  numberAt(value, path);
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    shapeError(path, 'a whole number');
  }
  return value as number;
}

function turnIdAt(value: unknown, path: string): void {
  boundedStringAt(value, path, TURN_ID_CHARACTERS, false);
}

const isPersonaReply = (turn: Record<string, unknown>): boolean =>
  turn.role === 'assistant' && (turn.participant === 'host' || turn.participant === 'guest');

/** Strict structure of a turn's passage-search fields, and that its turn may carry them. */
export function assertWorkshopPassageSearchShapes(turn: Record<string, unknown>, path: string): void {
  if (turn.passageSearchRequest !== undefined) {
    const at = `${path}.passageSearchRequest`;
    if (!isPersonaReply(turn)) {
      shapeError(at, 'a card on a persona reply');
    }
    const request = exactObject(turn.passageSearchRequest, at, ['question', 'scopes'], ['answer']);
    boundedStringAt(request.question, `${at}.question`, BOUNDS.questionCharacters, false);
    if (NOT_ONE_LINE.test(request.question as string)) {
      shapeError(`${at}.question`, 'one line');
    }
    boundedArrayAt(request.scopes, `${at}.scopes`, 1, BOUNDS.scopes, 'places');
    request.scopes.forEach((item, index) => assertScope(item, `${at}.scopes[${index}]`));
    if (request.answer !== undefined) {
      enumAt(request.answer, `${at}.answer`, ['cancelled']);
    }
  }
  if (turn.passageSearchResults !== undefined) {
    const at = `${path}.passageSearchResults`;
    if (turn.role !== 'user' || turn.participant !== 'writer') {
      shapeError(at, 'a writer turn');
    }
    turnIdAt(exactObject(turn.passageSearchResults, at, ['cardTurnId']).cardTurnId, `${at}.cardTurnId`);
  }
  if (turn.passageSearchDelivery !== undefined) {
    const at = `${path}.passageSearchDelivery`;
    if (!isPersonaReply(turn)) {
      shapeError(at, 'a receipt on a persona reply');
    }
    const delivery = exactObject(turn.passageSearchDelivery, at,
      ['cardTurnId', 'instances', 'files', 'labels', 'dropped', 'calls', 'ended', 'organized', 'shown']);
    turnIdAt(delivery.cardTurnId, `${at}.cardTurnId`);
    const instances = countAt(delivery.instances, `${at}.instances`);
    for (const key of ['files', 'labels', 'dropped'] as const) {
      countAt(delivery[key], `${at}.${key}`);
    }
    // `cancelled` is additive: a receipt from before it was kept apart holds none.
    const calls = exactObject(delivery.calls, `${at}.calls`, ['planned', 'answered', 'failed', 'cut', 'unsent'], ['cancelled']);
    for (const key of ['planned', 'answered', 'failed', 'cut', 'unsent'] as const) {
      countAt(calls[key], `${at}.calls.${key}`);
    }
    if (calls.cancelled !== undefined) {
      countAt(calls.cancelled, `${at}.calls.cancelled`);
    }
    enumAt(delivery.ended, `${at}.ended`, WORKSHOP_PASSAGE_SEARCH_ENDINGS);
    booleanAt(delivery.organized, `${at}.organized`);
    if (countAt(delivery.shown, `${at}.shown`) > instances) {
      shapeError(`${at}.shown`, 'at most the instances found');
    }
  }
}

function assertScope(value: unknown, path: string): void {
  const kind = (value as { kind?: unknown } | null)?.kind;
  enumAt(kind, `${path}.kind`, ['group', 'file', 'excerpt']);
  if (kind === 'excerpt') {
    exactObject(value, path, ['kind']);
    return;
  }
  const scope = exactObject(value, path, kind === 'file' ? ['kind', 'group', 'path'] : ['kind', 'group']);
  enumAt(scope.group, `${path}.group`, CONTEXT_PATH_GROUPS);
  if (kind === 'file') {
    boundedStringAt(scope.path, `${path}.path`, PROMPT_BUDGETS.workshopResource.pathCharacters, false);
    // A catalog key, never a free path: the rule a persona's own `<path>` is read by.
    if (!isSafeConfiguredResourcePath(scope.path as string)) {
      shapeError(`${path}.path`, 'a configured file path');
    }
  }
}

export function cloneWorkshopPassageSearchRequest(request: WorkshopPassageSearchRequest): WorkshopPassageSearchRequest {
  // The host's view is derived each time a turn is sent; it never enters the ledger.
  return {
    question: request.question,
    scopes: request.scopes.map((scope) => ({ ...scope })),
    ...(request.answer ? { answer: request.answer } : {})
  };
}

export function cloneWorkshopPassageSearchDelivery(delivery: WorkshopPassageSearchDelivery): WorkshopPassageSearchDelivery {
  return { ...delivery, calls: { ...delivery.calls } };
}

/** In the reply's own commit (D17, D19a): the card it carried, and the receipt when it answers a delivery. Persona replies only. */
export function stampWorkshopPassageSearchOnReply(turn: WorkshopTurn, persona: boolean, commit: WorkshopPassageSearchReplyCommit | undefined): void {
  if (!persona || !commit) {
    return;
  }
  if (commit.request) {
    turn.passageSearchRequest = cloneWorkshopPassageSearchRequest(commit.request);
  }
  if (commit.delivery) {
    turn.passageSearchDelivery = cloneWorkshopPassageSearchDelivery(commit.delivery);
  }
}

/** Mark the writer-role turn a results delivery recorded (D18). */
export function markWorkshopPassageSearchResultsTurn(turn: WorkshopTurn, cardTurnId: string): void {
  if (turn.role === 'user' && turn.participant === 'writer') {
    turn.passageSearchResults = { cardTurnId };
  }
}

/** The writer's Cancel (D20): stored on the card, once, and only while it holds no answer. */
export function cancelWorkshopPassageSearchOnTurn(turn: WorkshopTurn): void {
  if (turn.passageSearchRequest && !turn.passageSearchRequest.answer) {
    turn.passageSearchRequest = { ...cloneWorkshopPassageSearchRequest(turn.passageSearchRequest), answer: 'cancelled' };
  }
}
