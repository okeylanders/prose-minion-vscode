/**
 * Dictionary lookup history messages (ADR 2026-10-14).
 *
 * The host owns the history (`DictionaryHistoryStore`) and the webview holds
 * only lightweight summaries plus a cursor. Result bodies are large and are
 * fetched one entry at a time, so the list message never carries them.
 */

import { MessageEnvelope, MessageType } from './base';

/** Standard is the streaming lookup; fast is the parallel ⚡ generation. */
export type DictionaryLookupMode = 'standard' | 'fast';

/** What the writer asked for: everything needed to reproduce the lookup. */
export interface DictionaryLookupRequest {
  /** As submitted (the tab has already normalized it to ≤ 6 words). */
  word: string;
  /** Trimmed extra context; `''` when none. */
  context: string;
  /** Resolved entry option, never undefined. */
  includeEncyclopedia: boolean;
  /** Resolved entry option, never undefined. */
  includePalettes: boolean;
  mode: DictionaryLookupMode;
  sourceUri?: string;
  relativePath?: string;
}

export interface DictionaryHistoryEntry {
  id: string;
  /** ISO-8601. */
  createdAt: string;
  request: DictionaryLookupRequest;
  /** The dictionary model resolved when the request started. */
  modelId?: string;
  /** `dictionary_lookup` or `dictionary_fast_generate`. */
  toolName: string;
  /** The Markdown exactly as the tab rendered it. */
  result: string;
}

/** One row of the history list: an entry without its result body. */
export interface DictionaryHistorySummary {
  id: string;
  createdAt: string;
  word: string;
  /** Whitespace-collapsed, at most 140 characters plus `…`; `''` when none. */
  contextPreview: string;
  includeEncyclopedia: boolean;
  includePalettes: boolean;
  mode: DictionaryLookupMode;
  modelId?: string;
  relativePath?: string;
}

/** Why the history lasts only for this session (ADR D7). */
export type DictionaryHistorySessionReason = 'no-workspace' | 'multi-root' | 'write-failed';

/** Where the history is kept, so the popup can say whether it survives a restart. */
export type DictionaryHistoryDurability =
  | { kind: 'project'; displayPath: string }
  | { kind: 'session'; reason: DictionaryHistorySessionReason };

// Webview → host

export type RequestDictionaryHistoryPayload = Record<string, never>;

export interface RequestDictionaryHistoryMessage
  extends MessageEnvelope<RequestDictionaryHistoryPayload> {
  type: MessageType.REQUEST_DICTIONARY_HISTORY;
}

export interface RequestDictionaryHistoryEntryPayload {
  id: string;
}

export interface RequestDictionaryHistoryEntryMessage
  extends MessageEnvelope<RequestDictionaryHistoryEntryPayload> {
  type: MessageType.REQUEST_DICTIONARY_HISTORY_ENTRY;
}

export interface DeleteDictionaryHistoryEntryPayload {
  id: string;
}

export interface DeleteDictionaryHistoryEntryMessage
  extends MessageEnvelope<DeleteDictionaryHistoryEntryPayload> {
  type: MessageType.DELETE_DICTIONARY_HISTORY_ENTRY;
}

export type ClearDictionaryHistoryPayload = Record<string, never>;

export interface ClearDictionaryHistoryMessage
  extends MessageEnvelope<ClearDictionaryHistoryPayload> {
  type: MessageType.CLEAR_DICTIONARY_HISTORY;
}

// Host → webview

export interface DictionaryHistoryPayload {
  /** Newest first. */
  entries: DictionaryHistorySummary[];
  durability: DictionaryHistoryDurability;
  /** The cap the store enforces; older entries are evicted beyond it. */
  limit: number;
}

export interface DictionaryHistoryMessage extends MessageEnvelope<DictionaryHistoryPayload> {
  type: MessageType.DICTIONARY_HISTORY;
}

export type DictionaryHistoryEntryPayload =
  | { status: 'found'; entry: DictionaryHistoryEntry }
  | { status: 'missing'; id: string };

export interface DictionaryHistoryEntryMessage
  extends MessageEnvelope<DictionaryHistoryEntryPayload> {
  type: MessageType.DICTIONARY_HISTORY_ENTRY;
}
