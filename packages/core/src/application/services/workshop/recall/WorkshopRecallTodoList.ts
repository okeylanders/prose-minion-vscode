/**
 * Model-facing text for `transcript.todos` (ADR 2026-10-05 D5–D7): the
 * writer's to-do lists from saved sessions, grouped by session, newest
 * first. Pure: the caller supplies the service's data and the clock.
 *
 * - The body opens with the quoted-record framing line, as every recall
 *   body does, and states every bound the service disclosed.
 * - Pairing, as buildWorkshopTodoEvidence pairs a live room's tasks: a to-do
 *   is never shown without its status, source, and excerpt version. An item
 *   is one block, shown whole or not at all, and its text yields to its
 *   metadata.
 * - Every item names its own id beside its session id, the pair a later
 *   close-out needs. A finding's key and original text never reach here.
 * - The text never exceeds `todoCharacters`, whatever a saved file holds:
 *   every saved-file label is clipped (WorkshopRecallText), the header and
 *   footer have hard caps, and whole items are packed into what is left.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { WORKSHOP_TODO_BOUNDS } from '@/application/services/workshop/WorkshopSessionLimits';
import type {
  WorkshopRecallHeader,
  WorkshopRecallTodo,
  WorkshopRecallTodoSource
} from '@/application/services/workshop/recall/WorkshopRecallDocument';
import { WORKSHOP_RECALL_BLOCK_SEPARATOR } from '@/application/services/workshop/recall/WorkshopRecallReadWindow';
import { WorkshopRecallClock } from '@/application/services/workshop/recall/WorkshopRecallTime';
import {
  recallBlock,
  recallLabel,
  recallLabelList
} from '@/application/services/workshop/recall/WorkshopRecallText';
import {
  recallBody,
  recallCount,
  recallListingNote,
  recallMatchWords,
  recallQuoted,
  recallSavedAt,
  recallScopeLine,
  recallUnavailable,
  recallUnknownSession
} from '@/application/services/workshop/recall/WorkshopRecallCopy';
import type {
  WorkshopRecallTodosResult,
  WorkshopRecallTodoStatusFilter
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';

/** The framing line, the summary, and the filters; every filter at its bound is near 1,310. */
const TODO_HEADER_CHARACTERS = 1_500;
/** What was scanned, what was left out, and how to narrow. */
const TODO_FOOTER_CHARACTERS = 1_500;
/** One session's line; bounded labels keep it near 850. */
const TODO_SESSION_CHARACTERS = 1_000;
/** One item: its metadata line (near 900 at most) and its text, which yields. */
const TODO_ITEM_CHARACTERS = 1_500;
/** "- [" and "] " around the status, plus the newline before the metadata. */
const ITEM_FRAME_CHARACTERS = 64;

/**
 * The smallest supported `todoCharacters`: both caps, one session line, one
 * item, and their separators. At or above it, a list with any to-do shows
 * at least one whole. A smaller cap is a programming error.
 */
export const WORKSHOP_RECALL_MINIMUM_TODO_CHARACTERS =
  TODO_HEADER_CHARACTERS + TODO_FOOTER_CHARACTERS + TODO_SESSION_CHARACTERS + TODO_ITEM_CHARACTERS +
  2 * WORKSHOP_RECALL_BLOCK_SEPARATOR.length + 1;

export interface WorkshopRecallTodoListOptions {
  /** Epoch ms, for relative dates. */
  readonly now: number;
  /** The text's hard cap. Defaults to PROMPT_BUDGETS.workshopTranscriptRecall.todoCharacters. */
  readonly todoCharacters?: number;
}

export interface WorkshopRecallRenderedTodos {
  readonly content: string;
  /** Each to-do the text shows, with its session: what a later step may cite. */
  readonly shown: ReadonlyArray<{ readonly sessionId: string; readonly todoId: string }>;
  /** To-dos in the result that did not fit `todoCharacters`. */
  readonly notShownForSpace: number;
}

export function renderWorkshopRecallTodos(
  result: WorkshopRecallTodosResult,
  options: WorkshopRecallTodoListOptions
): WorkshopRecallRenderedTodos {
  if (!result.available) {
    return { content: recallUnavailable(result), shown: [], notShownForSpace: 0 };
  }
  if (result.outcome === 'unknown-session') {
    return { content: recallUnknownSession(result), shown: [], notShownForSpace: 0 };
  }
  const cap = options.todoCharacters ?? PROMPT_BUDGETS.workshopTranscriptRecall.todoCharacters;
  if (cap < WORKSHOP_RECALL_MINIMUM_TODO_CHARACTERS) {
    throw new RangeError(
      `A session-recall to-do list needs at least ${WORKSHOP_RECALL_MINIMUM_TODO_CHARACTERS} characters; got ${cap}.`
    );
  }
  const header = recallBlock(recallBody(headerLines(result)), TODO_HEADER_CHARACTERS, '[filters shortened]');
  // header + (separator + session block)… + separator + footer, the footer reserved at its cap.
  let room = cap - header.length - WORKSHOP_RECALL_BLOCK_SEPARATOR.length - TODO_FOOTER_CHARACTERS;
  const blocks: string[] = [];
  const shown: Array<{ sessionId: string; todoId: string }> = [];
  const total = result.sessions.reduce((sum, session) => sum + session.todos.length, 0);
  let firstCut: string | undefined;
  for (const session of result.sessions) {
    const lines = [sessionLine(session.header, options.now)];
    let used = WORKSHOP_RECALL_BLOCK_SEPARATOR.length + lines[0].length;
    for (const todo of session.todos) {
      const item = itemBlock(todo, session.header);
      if (used + 1 + item.length > room) {
        firstCut = session.header.sessionId;
        break;
      }
      lines.push(item);
      used += 1 + item.length;
      shown.push({ sessionId: session.header.sessionId, todoId: todo.id });
    }
    if (lines.length > 1) {
      blocks.push(lines.join('\n'));
      room -= used;
    }
    if (firstCut !== undefined) {
      break;
    }
  }
  const notShownForSpace = total - shown.length;
  const footer = recallBlock(
    footerLines(result, notShownForSpace, firstCut).join('\n'),
    TODO_FOOTER_CHARACTERS,
    '[footer shortened]'
  );
  return {
    content: [header, ...blocks, footer].join(WORKSHOP_RECALL_BLOCK_SEPARATOR),
    shown,
    notShownForSpace
  };
}

type Listed = Extract<WorkshopRecallTodosResult, { outcome: 'todos' }>;

function headerLines(result: Listed): string[] {
  const what = statusWords(result.status);
  const summary = result.sessions.length > 0
    ? `${capitalized(what)} from ${recallCount(result.sessions.length, 'session')}, newest first.`
    : `No ${what} to show.`;
  const filters = [
    ...(result.sessionId !== undefined ? [`session ${recallLabel(result.sessionId)}`] : []),
    ...(result.recent !== undefined ? [`the ${recallCount(result.recent, 'most recent session')}`] : []),
    ...(result.personaId ? [`sessions that include ${workshopPersonaLabel(result.personaId)}`] : []),
    ...(result.match ? [recallMatchWords(result.match)] : []),
    ...(result.source ? [`from source ${recallLabel(result.source)}`] : [])
  ];
  return [summary, ...(filters.length > 0 ? [`Filters: ${filters.join('; ')}.`] : [])];
}

function statusWords(status: WorkshopRecallTodoStatusFilter): string {
  switch (status) {
    case 'open':
      return 'open to-dos (stale ones marked)';
    case 'completed':
      return 'completed to-dos';
    case 'dismissed':
      return 'dismissed to-dos';
    case 'all':
      return 'to-dos of every status (stale ones marked)';
    default:
      return assertNever(status);
  }
}

/** “Title” · id … · saved … · excerpt … · 3 open, 1 completed */
function sessionLine(header: WorkshopRecallHeader, now: number): string {
  const line = [
    `${recallQuoted(header.title)} · id ${recallLabel(header.sessionId)}`,
    `saved ${recallSavedAt(header.savedAt, header.timezone, now)}`,
    ...recallScopeLine(header.scope, header.excerptLabel),
    `${header.openTodos} open, ${header.completedTodos} completed`
  ].join(' · ');
  return recallLabel(line, TODO_SESSION_CHARACTERS);
}

/**
 * One item: status, priority, and staleness with the text, then the
 * metadata it is never shown without. The metadata is built first; the text
 * takes what is left of the item's cap, at most a to-do's own 500.
 */
function itemBlock(todo: WorkshopRecallTodo, header: WorkshopRecallHeader): string {
  const clock = new WorkshopRecallClock(header.timezone);
  const metadata = [
    `  id ${recallLabel(todo.id)} in session ${recallLabel(header.sessionId)}`,
    `from ${recallLabel(todo.source.label)} (${sourceWords(todo.source)})`,
    todo.position !== undefined ? `turn ${todo.position}` : 'source turn not in this session',
    `excerpt v${todo.excerptVersion}${todo.stale ? ` (session ended on v${header.excerptVersion})` : ''}`,
    `created ${createdOn(clock, todo.createdAt)}`
  ].join(' · ');
  const marks = [todo.status, ...(todo.priority ? [todo.priority] : []), ...(todo.stale ? ['stale'] : [])];
  const textRoom = Math.min(
    WORKSHOP_TODO_BOUNDS.textCharacters,
    TODO_ITEM_CHARACTERS - ITEM_FRAME_CHARACTERS - metadata.length
  );
  return `- [${marks.join(' · ')}] ${recallLabel(todo.text, textRoom)}\n${metadata}`;
}

function sourceWords(source: WorkshopRecallTodoSource): string {
  switch (source.kind) {
    case 'tool_report':
      return `tool ${source.toolId}, tool report`;
    case 'host_turn':
      return `persona ${source.personaId}, host turn${source.reportDerived ? ', report-derived' : ''}`;
    case 'guest_turn':
      return `persona ${source.personaId}, guest turn`;
    default:
      return assertNever(source);
  }
}

/** A saved file can hold any number; an impossible date is said so, not thrown. */
function createdOn(clock: WorkshopRecallClock, at: number): string {
  return Number.isFinite(new Date(at).getTime()) ? clock.date(at) : 'an unknown date';
}

function footerLines(result: Listed, notShownForSpace: number, firstCut: string | undefined): string[] {
  const { bounds } = result;
  const notScanned = [
    ...(bounds.notScannedBySessionLimit > 0
      ? [`${bounds.notScannedBySessionLimit} older past ${result.recent !== undefined
        ? `<recent>${result.recent}</recent>`
        : `the ${bounds.sessionLimit}-session limit`}`]
      : []),
    ...(bounds.notScannedByByteBudget > 0 ? [`${bounds.notScannedByByteBudget} past this call's reading budget`] : [])
  ];
  const byStatus = (['open', 'completed', 'dismissed'] as const)
    .filter((status) => bounds.notShownByStatus[status] > 0)
    .map((status) => `${bounds.notShownByStatus[status]} ${status}`);
  const narrow = notShownForSpace > 0 || bounds.omittedByItemLimit > 0 || notScanned.length > 0;
  return [
    `Scanned ${bounds.sessionsScanned} of ${recallCount(bounds.corpusSessions, 'saved session')}` +
      `${result.match || result.personaId || result.sessionId !== undefined ? ' the filters admitted' : ''}; ` +
      'the current session is never listed.',
    ...(notScanned.length > 0 ? [`Not scanned: ${notScanned.join('; ')}.`] : []),
    ...(bounds.unreadableSessions > 0
      ? [`${recallCount(bounds.unreadableSessions, 'session')} could not be read and ${bounds.unreadableSessions === 1 ? 'was' : 'were'} skipped.`]
      : []),
    ...recallListingNote(bounds.listingTruncated),
    ...(bounds.sessionsWithoutMatchingTodos > 0
      ? [`${recallCount(bounds.sessionsWithoutMatchingTodos, 'scanned session')} had no to-do matching the filters.`]
      : []),
    ...(byStatus.length > 0 ? [`${listed(byStatus)} to-dos not shown (status: ${result.status}).`] : []),
    ...(bounds.notShownBySource > 0
      ? [`${recallCount(bounds.notShownBySource, 'to-do')} from other sources not shown (source: ${recallLabel(result.source ?? '')}).`]
      : []),
    ...(bounds.omittedByItemLimit > 0
      ? [`${recallCount(bounds.omittedByItemLimit, 'more to-do')} past the ${PROMPT_BUDGETS.workshopTranscriptRecall.todoItems}-item limit.`]
      : []),
    ...(notShownForSpace > 0 ? [`${recallCount(notShownForSpace, 'more to-do')} did not fit in this listing.`] : []),
    ...(narrow
      ? ['Narrow the list with <session>, <recent>, <match>, <source>, or <status>' +
        (firstCut ? `, for example <session>${recallLabel(firstCut)}</session>.` : '.')]
      : [])
  ];
}

/** "a", "a and b", "a, b and c" */
function listed(parts: readonly string[]): string {
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function capitalized(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled session-recall value: ${JSON.stringify(value)}`);
}
