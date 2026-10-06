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
 * - a persona may be named by id or display label and becomes its id.
 *
 * Every rejection names its operation, so the persona capability can leave
 * a visible artifact for it, as the resource family does.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_PERSONA_CATALOG } from '@shared/constants/workshopPersonas';
import { isWorkshopToolId } from '@shared/constants/workshopTools';
import {
  WORKSHOP_RECALL_READ_DETAILS,
  WORKSHOP_RECALL_TODO_STATUS_FILTERS,
  type WorkshopRecallReadDetail,
  type WorkshopRecallTodoSourceId,
  type WorkshopRecallTodoStatusFilter,
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
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
/** One selection item: `N` or `N-M`, each a positive number of at most six digits. */
const TURN_ITEM = /^([1-9]\d{0,5})(?:\s*-\s*([1-9]\d{0,5}))?$/;
const RECENT = /^[1-9]\d{0,5}$/;

/**
 * `transcript.read` alone repeats fields: `<session>`, each with an
 * optional `turns`, and the `<detail>` and `<turns>` that followed hints
 * and continuations each bring along.
 */
const READ_REPEATABLE_FIELDS: readonly string[] = ['session', 'detail', 'turns'];

export const WORKSHOP_TRANSCRIPT_RECALL_FIELD_POLICY: WorkshopCapabilityXmlFieldPolicy = {
  repeatable: (operation, field) => operation === 'transcript.read' && READ_REPEATABLE_FIELDS.includes(field),
  attributes: (operation, field) => (operation === 'transcript.read' && field === 'session' ? ['turns'] : [])
};

export function isWorkshopTranscriptRecallOperation(operation: string | undefined): operation is TranscriptOperation {
  return operation === 'transcript.catalog' ||
    operation === 'transcript.search' ||
    operation === 'transcript.read' ||
    operation === 'transcript.todos';
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

  private recent(value: string): number {
    const recent = RECENT.test(value) ? Number(value) : Number.NaN;
    if (!(recent >= 1 && recent <= this.budgets.todoSessions)) {
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
