import type { TokenUsage } from './messages/tokenUsage';
import type {
  WorkshopPersonaId,
  WorkshopTodoStatus,
  WorkshopToolId
} from '@messages';
import type { ContextPathGroup } from './context';
import type { ProjectMemoryKind } from './projectMemory';

/**
 * The closed operation list. The union, the persisted codec's allowlist, and
 * every exhaustive switch derive from it, so adding an operation here is the
 * one edit that widens all of them (and forgetting a switch case fails to
 * compile instead of failing a writer's save).
 */
export const WORKSHOP_CAPABILITY_OPERATIONS = [
  'dictionary.lookup',
  'dictionary.full-entry',
  'analysis.run',
  'resource.catalog',
  'resource.search',
  'resource.read',
  'transcript.catalog',
  'transcript.search',
  'transcript.read',
  'transcript.todos',
  'transcript.bookmarks',
  'memory.catalog',
  'memory.search',
  'memory.read'
] as const;

export type WorkshopCapabilityOperation = typeof WORKSHOP_CAPABILITY_OPERATIONS[number];

export const isWorkshopCapabilityOperation = (value: unknown): value is WorkshopCapabilityOperation =>
  typeof value === 'string' &&
  (WORKSHOP_CAPABILITY_OPERATIONS as readonly string[]).includes(value);

/**
 * A capability family owns its operations' writer-facing name, evidence
 * framing, and rejected-request handling. Every consumer switches on the
 * family exhaustively, so an operation without one fails to compile instead
 * of borrowing another family's name through an implicit "otherwise".
 */
export type WorkshopCapabilityFamily = 'dictionary' | 'analysis' | 'resource' | 'transcript' | 'memory';

export function workshopCapabilityFamily(
  operation: WorkshopCapabilityOperation
): WorkshopCapabilityFamily {
  switch (operation) {
    case 'dictionary.lookup':
    case 'dictionary.full-entry':
      return 'dictionary';
    case 'analysis.run':
      return 'analysis';
    case 'resource.catalog':
    case 'resource.search':
    case 'resource.read':
      return 'resource';
    case 'transcript.catalog':
    case 'transcript.search':
    case 'transcript.read':
    case 'transcript.todos':
    case 'transcript.bookmarks':
      return 'transcript';
    case 'memory.catalog':
    case 'memory.search':
    case 'memory.read':
      return 'memory';
    default: {
      const unhandled: never = operation;
      throw new Error(`Unhandled Workshop capability operation: ${String(unhandled)}`);
    }
  }
}

/**
 * How much of each turn a session-recall read shows (ADR 2026-10-05 D10).
 * `discussion` collapses each tool report to one line and keeps everything
 * else whole; `full` shows it all.
 */
export const WORKSHOP_RECALL_READ_DETAILS = ['full', 'discussion'] as const;
export type WorkshopRecallReadDetail = (typeof WORKSHOP_RECALL_READ_DETAILS)[number];

/** `<status>` on `transcript.todos` (D7). `open` includes stale to-dos, each marked. */
export type WorkshopRecallTodoStatusFilter = WorkshopTodoStatus | 'all';
export const WORKSHOP_RECALL_TODO_STATUS_FILTERS =
  ['open', 'completed', 'dismissed', 'all'] as const satisfies readonly WorkshopRecallTodoStatusFilter[];

/** `<source>` on `transcript.todos`: a tool id or a persona id. The two closed lists share no id. */
export type WorkshopRecallTodoSourceId = WorkshopToolId | WorkshopPersonaId;

/**
 * `<scope>` on `transcript.bookmarks` (ADR 2026-11-05 D2): the open room
 * only, saved sessions only, or both, the open room first.
 */
export const WORKSHOP_RECALL_BOOKMARK_SCOPES = ['current', 'saved', 'all'] as const;
export type WorkshopRecallBookmarkScope = (typeof WORKSHOP_RECALL_BOOKMARK_SCOPES)[number];

/**
 * `<speaker>` on `transcript.bookmarks`: who said the bookmarked turn. Tool
 * ids, persona ids and `writer` share no word.
 */
export type WorkshopRecallBookmarkSpeakerId = WorkshopToolId | WorkshopPersonaId | 'writer';

/**
 * A bookmark named with the session that holds it (ADR 2026-11-05 D2, PR
 * #214 F-07): bookmark ids are unique only within one session.
 * `current@{liveSessionId}/{bookmarkId}` names the open room, and only
 * while that room is open; `{sessionId}/{bookmarkId}` names a saved one.
 */
export type WorkshopRecallBookmarkRef =
  | { source: 'current'; liveSessionId: string; bookmarkId: string }
  | { source: 'saved'; sessionId: string; bookmarkId: string };

/** The ref as rows show it and `<bookmark>` takes it. */
export function formatWorkshopRecallBookmarkRef(ref: WorkshopRecallBookmarkRef): string {
  return ref.source === 'current'
    ? `current@${ref.liveSessionId}/${ref.bookmarkId}`
    : `${ref.sessionId}/${ref.bookmarkId}`;
}

/**
 * The metadata key a capability result carries when its body must never
 * be published to the room (ADR 2026-11-05 D7, PR #214 F-05). Its value is
 * the reason, by id; the room's audience policy reads it.
 */
export const WORKSHOP_CAPABILITY_PUBLICATION_WITHHELD = 'publicationWithheld';

export type WorkshopAnalysisInputMode = 'inherit' | 'prepend' | 'replace' | 'omit';

export interface WorkshopAnalysisInputSelection {
  mode: WorkshopAnalysisInputMode;
  text?: string;
}

export interface WorkshopAnalysisInputProvenance {
  mode: WorkshopAnalysisInputMode;
  material: string;
  chosenBy: string;
  words: number;
  truncation?: string;
}

/** One file a `resource.read` names: a configured group and a path in it (ADR 2026-11-14 D4). */
export interface WorkshopResourceReadFile {
  group: ContextPathGroup;
  path: string;
}

export type WorkshopCapabilityRequest =
  | {
      capability: 'dictionary.lookup';
      word: string;
      context: string;
      purpose: string;
    }
  | {
      capability: 'dictionary.full-entry';
      word: string;
      context: string;
      purpose: string;
    }
  | {
      capability: 'analysis.run';
      toolId: WorkshopToolId;
      excerpt: WorkshopAnalysisInputSelection;
      context: WorkshopAnalysisInputSelection;
    }
  | {
      capability: 'resource.catalog';
      group?: ContextPathGroup;
    }
  | {
      capability: 'resource.search';
      query: string;
      group?: ContextPathGroup;
    }
  | {
      capability: 'resource.read';
      /** One to `readPaths`, distinct by group and case-folded path, in the order asked. */
      files: WorkshopResourceReadFile[];
      /** Only beside exactly one file. */
      startLine?: number;
      endLine?: number;
    }
  | WorkshopTranscriptRecallRequest
  | WorkshopProjectMemoryRequest;

/**
 * `<status>` on `memory.search` (ADR 2026-11-04 D1): `active` by default;
 * superseded is derived (D4), never stored.
 */
export const WORKSHOP_MEMORY_SEARCH_STATUSES = ['active', 'superseded', 'archived', 'all'] as const;
export type WorkshopMemorySearchStatus = (typeof WORKSHOP_MEMORY_SEARCH_STATUSES)[number];

/**
 * Project memory's read-only requests (ADR 2026-11-04 D1), as the codec
 * validated them: every id has the `mem-` shape and every bound holds.
 * Whether an id names a memory is the library's question, asked of its
 * listing, never of a path.
 */
export type WorkshopProjectMemoryRequest =
  | { capability: 'memory.catalog'; kind?: ProjectMemoryKind }
  | { capability: 'memory.search'; query: string; status?: WorkshopMemorySearchStatus }
  | {
      capability: 'memory.read';
      /** One to `readMemories`, distinct, in the order asked. */
      memories: string[];
    };

/** Inclusive, 1-based positions in a saved session's turn ledger: "turn N". */
export interface WorkshopTranscriptTurnRange {
  from: number;
  to: number;
}

/** One session a `transcript.read` names, with its own ranges; none means from turn 1. */
export interface WorkshopTranscriptReadSession {
  sessionId: string;
  turns?: WorkshopTranscriptTurnRange[];
}

/**
 * `transcript.todos` (D6). `<recent>` and `<session>` are exclusive, so the
 * type cannot hold both.
 */
export type WorkshopTranscriptTodosRequest = {
  capability: 'transcript.todos';
  status?: WorkshopRecallTodoStatusFilter;
  match?: string;
  source?: WorkshopRecallTodoSourceId;
  personaId?: WorkshopPersonaId;
} & (
  | { recent?: number; sessionId?: undefined }
  | { sessionId: string; recent?: undefined }
);

/**
 * `transcript.bookmarks` (ADR 2026-11-05 D2): a list, or one bookmark's
 * message in windows. `<recent>` and `<session>` are exclusive, and with
 * `current` scope neither, nor `<match>` or `<persona>`, is allowed; the
 * codec refuses each, and the type holds what is left. Dates are
 * `YYYY-MM-DD` calendar days, `since` at most `until`.
 */
export type WorkshopTranscriptBookmarksRequest =
  | {
      capability: 'transcript.bookmarks';
      bookmark: WorkshopRecallBookmarkRef;
      /** A character offset in the bookmarked message. */
      from?: number;
    }
  | ({
      capability: 'transcript.bookmarks';
      bookmark?: undefined;
      scope?: WorkshopRecallBookmarkScope;
      match?: string;
      personaId?: WorkshopPersonaId;
      query?: string;
      speaker?: WorkshopRecallBookmarkSpeakerId;
      since?: string;
      until?: string;
    } & (
      | { recent?: number; sessionIds?: undefined }
      | { sessionIds: string[]; recent?: undefined }
    ));

/**
 * Session recall's requests (ADR 2026-10-05 §1, D6, D8–D10), as the codec
 * validated them: every id has a safe shape, every persona is an id, and
 * every bound the prompt budgets set holds.
 */
export type WorkshopTranscriptRecallRequest =
  | {
      capability: 'transcript.catalog';
      personaId?: WorkshopPersonaId;
      match?: string;
    }
  | {
      capability: 'transcript.search';
      query: string;
      sessionId?: string;
      personaId?: WorkshopPersonaId;
    }
  | {
      capability: 'transcript.read';
      /** One to `readSessions`, distinct, in the order asked. */
      sessions: WorkshopTranscriptReadSession[];
      detail?: WorkshopRecallReadDetail;
    }
  | WorkshopTranscriptTodosRequest
  | WorkshopTranscriptBookmarksRequest;

export type WorkshopCapabilityStatus =
  | 'success'
  | 'partial'
  | 'failed'
  | 'cancelled'
  | 'rejected';

export interface WorkshopCapabilityResult {
  capability: WorkshopCapabilityOperation;
  status: WorkshopCapabilityStatus;
  requestSummary: string;
  content?: string;
  metadata?: Record<string, unknown>;
  usage?: TokenUsage;
  error?: string;
}

/**
 * The conversation owner on whose behalf a capability ran
 * (ADR 2026-07-24 §2). Persisted on the turn: who invoked a capability is a
 * historical fact, and once guests are invokers ownership is unrecoverable
 * from the record unless it is stored. Whether an owner implies privacy stays
 * a computed policy (13D's `audience()`), never a stored classification.
 */
export type WorkshopCapabilityPrincipal =
  | { kind: 'host' }
  | { kind: 'personaGuest'; personaId: WorkshopPersonaId };

/** Reload-safe provenance rendered with a completed capability artifact. */
export interface WorkshopCapabilityArtifactDetails {
  operation: WorkshopCapabilityOperation;
  status: WorkshopCapabilityStatus;
  requestSummary: string;
  requestedByPersonaId: WorkshopPersonaId;
  invokedBy: WorkshopCapabilityPrincipal;
  /**
   * Final participant reply that transactionally published this evidence to
   * the room. Absent means private, including all pre-13D artifacts.
   */
  publishedWithTurnId?: string;
  metadata?: Record<string, unknown>;
}
