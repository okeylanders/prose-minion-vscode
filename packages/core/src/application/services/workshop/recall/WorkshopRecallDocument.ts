/**
 * A saved Workshop session as session recall sees it (ADR 2026-10-05 §3).
 *
 * The header is session metadata a reader may see: title, dates, host,
 * participants, scope, the excerpt LABEL, and context-attachment LABELS.
 * It never carries the summary `preview`, which can be a capability
 * artifact's evidence body (runway F6), nor `excerptIdentity`.
 *
 * Entries are the visible transcript projection, turn by turn, each tagged
 * with its 1-based ledger position ("turn N"). Positions skip where the
 * projection omits a turn, so they survive projection-rule changes. A
 * position is a per-read address; the turn id is the durable identity.
 *
 * To-dos are the writer's list (D5): what the sidebar shows, each with its
 * source turn's position and its staleness against the session's final
 * excerpt version. A finding's key and original text, and a writer edit's
 * original wording, are never copied in.
 *
 * Pure: the caller supplies an already-decoded session.
 */

import type {
  WorkshopPersonaId,
  WorkshopSessionScope,
  WorkshopTodoPriority,
  WorkshopTodoStatus,
  WorkshopToolId
} from '@messages';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopStoredTodoItemV1 } from '@/application/services/workshop/WorkshopSessionStateV1';
import {
  projectWorkshopTranscriptTurn,
  WorkshopTranscriptEntry
} from '@/application/services/workshop/transcript/WorkshopTranscript';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';

export interface WorkshopRecallHeader {
  readonly sessionId: string;
  readonly title: string;
  /** When the session was last saved: `savedAt`, else its last activity. */
  readonly savedAt: string;
  readonly startedAt: string;
  /** The session's own IANA timezone; day headers and times use it. */
  readonly timezone: string;
  readonly hostPersonaId: WorkshopPersonaId;
  readonly host: string;
  readonly participantPersonaIds: readonly WorkshopPersonaId[];
  readonly participants: readonly string[];
  /** Absent on sessions saved before scope existed. */
  readonly scope?: WorkshopSessionScope;
  readonly excerptLabel?: string;
  /** Labels only: attachment bodies never leave the session. */
  readonly contextLabels: readonly string[];
  /** Ledger length: the last position "turn N" can name. */
  readonly turnCount: number;
  /** The excerpt version the session ended on; a to-do promoted on another is stale. */
  readonly excerptVersion: number;
  /** Open to-dos, stale ones included (D7), unlike the sidebar's count. */
  readonly openTodos: number;
  readonly completedTodos: number;
}

export interface WorkshopRecallEntry {
  /** 1-based ledger position. */
  readonly position: number;
  readonly turnId: string;
  readonly entry: WorkshopTranscriptEntry;
  /** Normalized words of the entry's visible text (and a tool reply's speaker), one space apart. */
  readonly searchText: string;
}

/** Where a to-do came from: the participant, never the finding itself (D5). */
export type WorkshopRecallTodoSource =
  | { readonly kind: 'tool_report'; readonly label: string; readonly toolId: WorkshopToolId }
  | {
      readonly kind: 'host_turn';
      readonly label: string;
      readonly personaId: WorkshopPersonaId;
      /** The host proposed it while synthesizing a tool report. */
      readonly reportDerived: boolean;
    }
  | { readonly kind: 'guest_turn'; readonly label: string; readonly personaId: WorkshopPersonaId };

/** One item of the writer's to-do list, as the sidebar holds it, plus what recall derives. */
export interface WorkshopRecallTodo {
  readonly id: string;
  /** The writer's current wording. */
  readonly text: string;
  readonly status: WorkshopTodoStatus;
  readonly priority?: WorkshopTodoPriority;
  readonly source: WorkshopRecallTodoSource;
  /** The turn it was promoted from. */
  readonly turnId: string;
  /**
   * That turn's 1-based ledger position ("turn N"). The codec refuses a
   * to-do whose turn is gone, so this is absent only for a session that
   * never passed it.
   */
  readonly position?: number;
  /** The excerpt version it was promoted on. */
  readonly excerptVersion: number;
  /** Promoted on another excerpt version than the session ended on (WorkshopTodoLedger's rule). */
  readonly stale: boolean;
  /** Epoch ms. */
  readonly createdAt: number;
}

export interface WorkshopRecallDocument {
  readonly header: WorkshopRecallHeader;
  /** The session version this document was built from (cache validation). */
  readonly updatedAt: string;
  readonly entries: readonly WorkshopRecallEntry[];
  /** The writer's to-do list, in the session's own order. */
  readonly todos: readonly WorkshopRecallTodo[];
  /**
   * An upper bound on the text this document retains, in UTF-16 code units
   * (cache bounding): every string it holds, citation URLs and labels
   * included, not only the text search reads.
   */
  readonly characters: number;
}

/** One word of visible text: where it sits, and the form search compares. */
export interface WorkshopRecallWord {
  readonly start: number;
  readonly end: number;
  readonly normalized: string;
}

export function buildWorkshopRecallDocument(
  session: WorkshopPersistedSessionV2
): WorkshopRecallDocument {
  const header = buildHeader(session);
  const entries: WorkshopRecallEntry[] = [];
  const positions = new Map<string, number>();
  session.workshop.turns.forEach((turn, index) => {
    positions.set(turn.id, index + 1);
    const entry = projectWorkshopTranscriptTurn(turn);
    if (entry) {
      const searchText = normalizeWorkshopRecallText(searchableText(entry));
      entries.push({ position: index + 1, turnId: turn.id, entry, searchText });
    }
  });
  const todos = session.workshop.todos.map((todo) => recallTodo(todo, positions, header.excerptVersion));
  // Serializing counts every retained string, including fields added later;
  // its quotes and keys only make the bound more conservative.
  const characters = JSON.stringify({ header, entries, todos }).length;
  return { header, updatedAt: session.updatedAt, entries, todos, characters };
}

/** Copies only what the writer sees in the sidebar, field by field (D5). */
function recallTodo(
  todo: WorkshopStoredTodoItemV1,
  positions: ReadonlyMap<string, number>,
  finalExcerptVersion: number
): WorkshopRecallTodo {
  const position = positions.get(todo.source.turnId);
  return {
    id: todo.id,
    text: todo.text,
    status: todo.status,
    ...(todo.priority ? { priority: todo.priority } : {}),
    source: recallTodoSource(todo.source),
    turnId: todo.source.turnId,
    ...(position !== undefined ? { position } : {}),
    excerptVersion: todo.source.excerptVersion,
    stale: todo.source.excerptVersion !== finalExcerptVersion,
    createdAt: todo.createdAt
  };
}

function recallTodoSource(source: WorkshopStoredTodoItemV1['source']): WorkshopRecallTodoSource {
  switch (source.kind) {
    case 'tool_report':
      return { kind: source.kind, label: source.participantLabel, toolId: source.toolId };
    case 'host_turn':
      return {
        kind: source.kind,
        label: source.participantLabel,
        personaId: source.personaId,
        reportDerived: source.upstreamReportTurnId !== undefined
      };
    case 'guest_turn':
      return { kind: source.kind, label: source.participantLabel, personaId: source.personaId };
    default:
      return assertNever(source);
  }
}

/**
 * The visible text search covers: what the thread shows, labels included,
 * without rendering chrome. Snippets are cut from this same string.
 */
export function workshopRecallEntryText(entry: WorkshopTranscriptEntry): string {
  switch (entry.kind) {
    case 'writer':
      return [
        entry.content,
        ...entry.attachmentLabels,
        ...(entry.widget ? [`${entry.widget.label} ${entry.widget.detail}`] : [])
      ].filter((part) => part.trim().length > 0).join('\n');
    case 'reply':
      return [entry.content, ...entry.sources.map((source) => source.label)].join('\n');
    case 'event':
      return entry.text;
    default:
      return assertNever(entry);
  }
}

/**
 * What search indexes: the visible text, plus a tool reply's speaker. A tool
 * report seldom names its own tool, so without it "cliche" finds only the
 * run's event line. Persona names stay out: they would match every reply a
 * persona wrote and flood any-term results. Snippets still come from the
 * visible text alone, so the speaker is never shown twice.
 */
function searchableText(entry: WorkshopTranscriptEntry): string {
  const text = workshopRecallEntryText(entry);
  return entry.kind === 'reply' && entry.participant === 'tool' ? `${entry.speaker}\n${text}` : text;
}

/**
 * Unicode words: letters, marks, and digits, with inner apostrophes kept
 * inside the word ("don't", "Jill's"). Normalization folds case,
 * diacritics, and compatibility forms, strips a possessive "'s", and drops
 * other apostrophes, so "café" finds "cafe", "dont" finds "don't", and
 * "keeper's" finds "keeper".
 */
export function workshopRecallWords(text: string): WorkshopRecallWord[] {
  const words: WorkshopRecallWord[] = [];
  for (const match of text.matchAll(WORD)) {
    const normalized = normalizeWord(match[0]);
    if (normalized) {
      words.push({ start: match.index, end: match.index + match[0].length, normalized });
    }
  }
  return words;
}

export function normalizeWorkshopRecallText(text: string): string {
  return workshopRecallWords(text).map((word) => word.normalized).join(' ');
}

const WORD = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu;

function normalizeWord(word: string): string {
  return word
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    // A possessive keeps its stem, so "keeper's" finds "keeper" and "keepers".
    .replace(/['’]s$/u, '')
    .replace(/['’\s]/g, '');
}

function buildHeader(session: WorkshopPersistedSessionV2): WorkshopRecallHeader {
  const { summary, workshop } = session;
  const scope = workshop.scope !== undefined ? workshop.scope : summary.scope;
  const participantPersonaIds = [...new Set(summary.participantPersonaIds)];
  return {
    sessionId: session.sessionId,
    title: session.title,
    savedAt: session.savedAt ?? session.updatedAt,
    startedAt: session.temporal.startedAt,
    timezone: session.temporal.timezone,
    hostPersonaId: summary.hostPersonaId,
    host: workshopPersonaLabel(summary.hostPersonaId),
    // A saved file may repeat a participant; the codec accepts that (PR 126 re-review F-01).
    participantPersonaIds,
    participants: participantPersonaIds.map(workshopPersonaLabel),
    ...(scope !== undefined ? { scope } : {}),
    ...(summary.excerptLabel ? { excerptLabel: summary.excerptLabel } : {}),
    contextLabels: workshop.contextAttachments.map((attachment) => attachment.label),
    turnCount: workshop.turns.length,
    excerptVersion: workshop.revisions.excerpt,
    openTodos: workshop.todos.filter((todo) => todo.status === 'open').length,
    completedTodos: workshop.todos.filter((todo) => todo.status === 'completed').length
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled session-recall value: ${JSON.stringify(value)}`);
}
