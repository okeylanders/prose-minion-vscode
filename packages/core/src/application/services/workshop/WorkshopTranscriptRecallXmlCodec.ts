/**
 * Request validation for session recall's `transcript.*` calls (ADR
 * 2026-10-05 §1, D6, D8–D10). The recall service throws on a request it
 * would have to repair, so every bound is enforced here first, whatever a
 * model writes:
 *
 * - a query, a `<match>`, a session id, and a turn selection each have a
 *   length ceiling from PROMPT_BUDGETS.workshopTranscriptRecall;
 * - session ids have a conservative shape and are never paths; whether one
 *   names a saved session is the service's question, asked of its listing;
 * - a turn selection is at most `turnRanges` items of `N` or `N-M`, each
 *   number at most six digits;
 * - a read names one to `readSessions` distinct sessions, each with its own
 *   optional `turns="…"`; a sibling `<turns>` is accepted only beside
 *   exactly one session that carries none (otherwise which session it
 *   meant is ambiguous);
 * - continuations and collapsed-report hints must work followed together
 *   exactly as written, and each carries its own `<detail>` (and, from a
 *   one-session read, its own `<turns>`). So a read may repeat `<detail>`
 *   when every copy agrees, and repeat the sibling `<turns>`, whose ranges
 *   merge under the same `turnRanges` cap;
 * - a persona may be named by id or display label and becomes its id;
 * - `transcript.bookmarks` (ADR 2026-11-05 D2) either lists, with `<scope>`,
 *   up to `bookmarkSessionsNamed` distinct `<session>`s or a `<recent>` (not
 *   both, and neither, nor `<match>` or `<persona>`, with `current` scope),
 *   and the filters `<query>`, `<speaker>`, `<since>` and `<until>`; or reads
 *   one `<bookmark>` by its qualified ref, with only `<from>` beside it.
 *   Dates are real `YYYY-MM-DD` days, `since` no later than `until`.
 *
 * Every rejection names its operation, so the persona capability can leave
 * a visible artifact for it, as the resource family does.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_PERSONA_CATALOG } from '@shared/constants/workshopPersonas';
import { isWorkshopToolId } from '@shared/constants/workshopTools';
import {
  WORKSHOP_RECALL_BOOKMARK_SCOPES,
  WORKSHOP_RECALL_READ_DETAILS,
  WORKSHOP_RECALL_TODO_STATUS_FILTERS,
  type WorkshopRecallBookmarkScope,
  type WorkshopRecallBookmarkSpeakerId,
  type WorkshopRecallReadDetail,
  type WorkshopRecallTodoSourceId,
  type WorkshopRecallTodoStatusFilter,
  type WorkshopRecallBookmarkRef as WorkshopTranscriptBookmarkRef,
  type WorkshopTranscriptBookmarksRequest,
  type WorkshopTranscriptReadSession,
  type WorkshopTranscriptRecallRequest,
  type WorkshopTranscriptTodosRequest,
  type WorkshopTranscriptTurnRange
} from '@shared/types/workshopCapabilities';
import type { WorkshopPersonaId } from '@messages';
import type {
  WorkshopCapabilityXmlCall,
  WorkshopCapabilityXmlField,
  WorkshopCapabilityXmlFieldPolicy
} from '@/application/services/workshop/WorkshopCapabilityXmlDocument';
import type { WorkshopCapabilityRejectionReason } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import {
  parseWorkshopRecallBookmarkRef,
  WORKSHOP_RECALL_SESSION_ID
} from '@/application/services/workshop/recall/WorkshopRecallBookmarkRef';

type TranscriptOperation = WorkshopTranscriptRecallRequest['capability'];

export interface WorkshopTranscriptRecallRejection {
  readonly kind: 'invalid';
  readonly reason: WorkshopCapabilityRejectionReason;
  readonly field?: string;
  readonly operation: TranscriptOperation;
}

export type WorkshopTranscriptRecallInspection =
  | { readonly kind: 'request'; readonly request: WorkshopTranscriptRecallRequest }
  | WorkshopTranscriptRecallRejection;

/** Session ids are UUIDs today; this admits any id-like name and never a path. */
const SESSION_ID = WORKSHOP_RECALL_SESSION_ID;
/** One selection item: `N` or `N-M`, each a positive number of at most six digits. */
const TURN_ITEM = /^([1-9]\d{0,5})(?:\s*-\s*([1-9]\d{0,5}))?$/;
const RECENT = /^[1-9]\d{0,5}$/;
/** A character offset: zero, or a positive number of at most six digits. */
const OFFSET = /^(?:0|[1-9]\d{0,5})$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** What `<scope>current</scope>` refuses: they choose saved sessions. */
const SAVED_SESSION_CHOOSERS: readonly string[] = ['recent', 'session', 'match', 'persona'];

/**
 * `transcript.read` alone repeats fields: `<session>`, each with an
 * optional `turns`, and the `<detail>` and `<turns>` that followed hints
 * and continuations each bring along.
 */
const READ_REPEATABLE_FIELDS: readonly string[] = ['session', 'detail', 'turns'];

export const WORKSHOP_TRANSCRIPT_RECALL_FIELD_POLICY: WorkshopCapabilityXmlFieldPolicy = {
  repeatable: (operation, field) =>
    (operation === 'transcript.read' && READ_REPEATABLE_FIELDS.includes(field)) ||
    // A bookmark list may name several sessions (ADR 2026-11-05 D2).
    (operation === 'transcript.bookmarks' && field === 'session'),
  attributes: (operation, field) => (operation === 'transcript.read' && field === 'session' ? ['turns'] : [])
};

export function isWorkshopTranscriptRecallOperation(operation: string | undefined): operation is TranscriptOperation {
  return operation === 'transcript.catalog' ||
    operation === 'transcript.search' ||
    operation === 'transcript.read' ||
    operation === 'transcript.todos' ||
    operation === 'transcript.bookmarks';
}

export function inspectWorkshopTranscriptRecallCall(
  operation: TranscriptOperation,
  call: Pick<WorkshopCapabilityXmlCall, 'fields' | 'elements'>
): WorkshopTranscriptRecallInspection {
  const validator = new TranscriptRequestValidator(operation, call);
  switch (operation) {
    case 'transcript.catalog':
      return validator.catalog();
    case 'transcript.search':
      return validator.search();
    case 'transcript.read':
      return validator.read();
    case 'transcript.todos':
      return validator.todos();
    case 'transcript.bookmarks':
      return validator.bookmarks();
    default:
      return assertNever(operation);
  }
}

/** Thrown inside a validator to refuse the call; caught once, at the top. */
class Refusal extends Error {
  constructor(readonly reason: WorkshopCapabilityRejectionReason, readonly field?: string) {
    super(reason);
  }
}

class TranscriptRequestValidator {
  private readonly budgets = PROMPT_BUDGETS.workshopTranscriptRecall;

  constructor(
    private readonly operation: TranscriptOperation,
    private readonly call: Pick<WorkshopCapabilityXmlCall, 'fields' | 'elements'>
  ) {}

  catalog(): WorkshopTranscriptRecallInspection {
    return this.validated(['persona', 'match'], [], () => ({
      capability: 'transcript.catalog',
      ...this.optional('persona', (value) => ({ personaId: personaId(value) })),
      ...this.optional('match', (value) => ({ match: this.bounded(value, 'match', this.budgets.todoMatchCharacters) }))
    }));
  }

  search(): WorkshopTranscriptRecallInspection {
    return this.validated(['query', 'session', 'persona'], ['query'], () => ({
      capability: 'transcript.search',
      query: this.bounded(this.call.fields.get('query')!, 'query', this.budgets.queryCharacters),
      ...this.optional('session', (value) => ({ sessionId: this.sessionId(value) })),
      ...this.optional('persona', (value) => ({ personaId: personaId(value) }))
    }));
  }

  read(): WorkshopTranscriptRecallInspection {
    return this.validated(['session', 'turns', 'detail'], ['session'], () => {
      const named = this.call.elements.filter((element) => element.name === 'session');
      if (named.length > this.budgets.readSessions) {
        throw new Refusal('too-many-sessions', 'session');
      }
      const seen = new Set<string>();
      const sessions = named.map((element): WorkshopTranscriptReadSession => {
        const sessionId = this.sessionId(element.value);
        if (seen.has(sessionId)) {
          throw new Refusal('duplicate-session', 'session');
        }
        seen.add(sessionId);
        const turns = element.attributes.turns;
        return turns === undefined ? { sessionId } : { sessionId, turns: this.turnSelection(turns) };
      });
      const siblings = this.values('turns');
      if (siblings.length > 0) {
        // `<turns>` belongs to a session only when exactly one is named, with no ranges of its own.
        if (sessions.length !== 1 || sessions[0].turns !== undefined) {
          throw new Refusal('ambiguous-turns', 'turns');
        }
        const turns = siblings.flatMap((sibling) => this.turnSelection(sibling));
        if (turns.length > this.budgets.turnRanges) {
          throw new Refusal('invalid-turn-selection', 'turns');
        }
        sessions[0] = { ...sessions[0], turns };
      }
      const details = [...new Set(this.values('detail').map(readDetail))];
      if (details.length > 1) {
        throw new Refusal('conflicting-detail', 'detail');
      }
      return {
        capability: 'transcript.read',
        sessions,
        ...(details.length === 1 ? { detail: details[0] } : {})
      };
    });
  }

  todos(): WorkshopTranscriptRecallInspection {
    return this.validated(['status', 'recent', 'session', 'match', 'source', 'persona'], [], () => {
      const session = this.call.fields.get('session');
      const recent = this.call.fields.get('recent');
      if (session !== undefined && recent !== undefined) {
        throw new Refusal('conflicting-session-selection', 'recent');
      }
      const filters = {
        capability: 'transcript.todos' as const,
        ...this.optional('status', (value) => ({ status: todoStatus(value) })),
        ...this.optional('match', (value) => ({ match: this.bounded(value, 'match', this.budgets.todoMatchCharacters) })),
        ...this.optional('source', (value) => ({ source: todoSource(value) })),
        ...this.optional('persona', (value) => ({ personaId: personaId(value) }))
      };
      const request: WorkshopTranscriptTodosRequest = session !== undefined
        ? { ...filters, sessionId: this.sessionId(session) }
        : { ...filters, ...(recent !== undefined ? { recent: this.recent(recent) } : {}) };
      return request;
    });
  }

  /** A list, or one bookmark's message: `<bookmark>` takes only `<from>` beside it, since its ref names its source. */
  bookmarks(): WorkshopTranscriptRecallInspection {
    if (this.call.elements.some((element) => element.name === 'bookmark')) {
      return this.validated(['bookmark', 'from'], ['bookmark'], () => ({
        capability: 'transcript.bookmarks',
        bookmark: bookmarkRef(this.call.fields.get('bookmark')!),
        ...this.optional('from', (value) => ({ from: bookmarkFrom(value) }))
      }));
    }
    return this.validated(['scope', 'recent', 'session', 'match', 'persona', 'query', 'speaker', 'since', 'until'], [], () => {
      const scope = this.optional('scope', (value) => ({ scope: bookmarkScope(value) }));
      if ('scope' in scope && scope.scope === 'current') {
        const chooser = this.call.elements.find((element) => SAVED_SESSION_CHOOSERS.includes(element.name));
        if (chooser) {
          throw new Refusal('conflicting-scope', chooser.name);
        }
      }
      const sessions = this.values('session');
      const recent = this.call.fields.get('recent');
      if (sessions.length > 0 && recent !== undefined) {
        throw new Refusal('conflicting-session-selection', 'recent');
      }
      if (sessions.length > this.budgets.bookmarkSessionsNamed) {
        throw new Refusal('too-many-sessions', 'session');
      }
      const sessionIds = sessions.map((value) => this.sessionId(value));
      if (new Set(sessionIds).size < sessionIds.length) {
        throw new Refusal('duplicate-session', 'session');
      }
      const since = this.optional('since', (value) => ({ since: calendarDay(value, 'since') }));
      const until = this.optional('until', (value) => ({ until: calendarDay(value, 'until') }));
      if ('since' in since && 'until' in until && since.since > until.until) {
        throw new Refusal('invalid-date', 'until');
      }
      const filters = {
        capability: 'transcript.bookmarks' as const,
        ...scope,
        ...this.optional('match', (value) => ({ match: this.bounded(value, 'match', this.budgets.todoMatchCharacters) })),
        ...this.optional('persona', (value) => ({ personaId: personaId(value) })),
        ...this.optional('query', (value) => ({ query: this.bounded(value, 'query', this.budgets.bookmarkQueryCharacters) })),
        ...this.optional('speaker', (value) => ({ speaker: bookmarkSpeaker(value) })),
        ...since,
        ...until
      };
      const request: WorkshopTranscriptBookmarksRequest = sessionIds.length > 0
        ? { ...filters, sessionIds }
        : { ...filters, ...(recent !== undefined ? { recent: this.recent(recent, this.budgets.bookmarkSessions) } : {}) };
      return request;
    });
  }

  /**
   * Refuse unexpected, missing, or empty fields, then build the request;
   * a Refusal thrown while building becomes the call's rejection.
   */
  private validated(
    allowed: readonly string[],
    required: readonly string[],
    build: () => WorkshopTranscriptRecallRequest
  ): WorkshopTranscriptRecallInspection {
    const { elements } = this.call;
    const unexpected = elements.find((element) => !allowed.includes(element.name));
    if (unexpected) {
      return this.rejection('unexpected-field', unexpected.name);
    }
    const missing = required.find((field) => !elements.some((element) => element.name === field));
    if (missing) {
      return this.rejection('missing-field', missing);
    }
    const empty = elements.find((element: WorkshopCapabilityXmlField) => element.value.length === 0);
    if (empty) {
      return this.rejection('empty-field', empty.name);
    }
    try {
      return { kind: 'request', request: build() };
    } catch (error) {
      if (error instanceof Refusal) {
        return this.rejection(error.reason, error.field);
      }
      throw error;
    }
  }

  /** Every value a field was given, in document order. */
  private values(field: string): string[] {
    return this.call.elements.filter((element) => element.name === field).map((element) => element.value);
  }

  private optional<T>(field: string, read: (value: string) => T): T | Record<string, never> {
    const value = this.call.fields.get(field);
    return value === undefined ? {} : read(value);
  }

  private bounded(value: string, field: string, ceiling: number): string {
    if (value.length > ceiling) {
      throw new Refusal('oversized-input', field);
    }
    return value;
  }

  private sessionId(value: string): string {
    if (value.length > this.budgets.sessionIdCharacters) {
      throw new Refusal('oversized-input', 'session');
    }
    if (!SESSION_ID.test(value)) {
      throw new Refusal('invalid-session-id', 'session');
    }
    return value;
  }

  /** "38-46, 52": ascending order is the service's job; validity is this one's. */
  private turnSelection(value: string): WorkshopTranscriptTurnRange[] {
    if (value.length > this.budgets.turnSelectionCharacters) {
      throw new Refusal('oversized-input', 'turns');
    }
    const items = value.split(',').map((item) => item.trim());
    if (items.length > this.budgets.turnRanges) {
      throw new Refusal('invalid-turn-selection', 'turns');
    }
    return items.map((item) => {
      const match = TURN_ITEM.exec(item);
      if (!match) {
        throw new Refusal('invalid-turn-selection', 'turns');
      }
      const from = Number(match[1]);
      const to = match[2] === undefined ? from : Number(match[2]);
      if (to < from) {
        throw new Refusal('invalid-turn-selection', 'turns');
      }
      return { from, to };
    });
  }

  private recent(value: string, ceiling = this.budgets.todoSessions): number {
    const recent = RECENT.test(value) ? Number(value) : Number.NaN;
    if (!(recent >= 1 && recent <= ceiling)) {
      throw new Refusal('invalid-recent', 'recent');
    }
    return recent;
  }

  private rejection(reason: WorkshopCapabilityRejectionReason, field?: string): WorkshopTranscriptRecallRejection {
    return { kind: 'invalid', reason, operation: this.operation, ...(field !== undefined ? { field } : {}) };
  }
}

/** A persona named by id or display label, in any case and spacing. */
function personaId(value: string): WorkshopPersonaId {
  const wanted = value.replace(/\s+/g, ' ').trim().toLowerCase();
  const persona = WORKSHOP_PERSONA_CATALOG.find((candidate) =>
    candidate.id === wanted || candidate.label.toLowerCase() === wanted);
  if (!persona) {
    throw new Refusal('unknown-persona', 'persona');
  }
  return persona.id;
}

/** A tool id, as the to-do list shows it, or a persona by id or label. */
function todoSource(value: string): WorkshopRecallTodoSourceId {
  const wanted = value.trim().toLowerCase();
  if (isWorkshopToolId(wanted)) {
    return wanted;
  }
  try {
    return personaId(value);
  } catch {
    throw new Refusal('unknown-source', 'source');
  }
}

function todoStatus(value: string): WorkshopRecallTodoStatusFilter {
  const status = WORKSHOP_RECALL_TODO_STATUS_FILTERS.find((candidate) => candidate === value.toLowerCase());
  if (!status) {
    throw new Refusal('invalid-status', 'status');
  }
  return status;
}

function bookmarkScope(value: string): WorkshopRecallBookmarkScope {
  const scope = WORKSHOP_RECALL_BOOKMARK_SCOPES.find((candidate) => candidate === value.trim().toLowerCase());
  if (!scope) {
    throw new Refusal('invalid-scope', 'scope');
  }
  return scope;
}

/** `writer`, a tool id, or a persona by id or label. */
function bookmarkSpeaker(value: string): WorkshopRecallBookmarkSpeakerId {
  const wanted = value.trim().toLowerCase();
  if (wanted === 'writer') {
    return 'writer';
  }
  if (isWorkshopToolId(wanted)) {
    return wanted;
  }
  try {
    return personaId(value);
  } catch {
    throw new Refusal('unknown-speaker', 'speaker');
  }
}

/** A real calendar day, `YYYY-MM-DD`: `2026-02-30` is no day. */
function calendarDay(value: string, field: 'since' | 'until'): string {
  const match = DATE.exec(value.trim());
  const [year, month, day] = match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, 0, 0];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (!match || year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Refusal('invalid-date', field);
  }
  return match[0];
}

function bookmarkRef(value: string): WorkshopTranscriptBookmarkRef {
  const ref = parseWorkshopRecallBookmarkRef(value.trim());
  if (!ref) {
    throw new Refusal('invalid-bookmark-ref', 'bookmark');
  }
  return ref;
}

function bookmarkFrom(value: string): number {
  const from = OFFSET.test(value.trim()) ? Number(value.trim()) : Number.NaN;
  if (!(from >= 0 && from <= PROMPT_BUDGETS.workshopTranscriptRecall.bookmarkFromMax)) {
    throw new Refusal('invalid-from', 'from');
  }
  return from;
}

function readDetail(value: string): WorkshopRecallReadDetail {
  const detail = WORKSHOP_RECALL_READ_DETAILS.find((candidate) => candidate === value.toLowerCase());
  if (!detail) {
    throw new Refusal('invalid-detail', 'detail');
  }
  return detail;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled session-recall operation: ${String(value)}`);
}
