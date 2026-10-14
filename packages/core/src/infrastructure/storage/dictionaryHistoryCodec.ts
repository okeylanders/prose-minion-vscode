/**
 * Pure codec for `prose-minion/history/dictionary.json` (ADR 2026-10-14, D4).
 *
 * The file is writer data, so decoding is defensive in two tiers. A file the
 * codec cannot trust as a whole (bad JSON, an unknown `formatVersion`, no
 * entry list) is `invalid`, and the store sets it aside rather than overwrite
 * it. A single malformed entry is dropped and counted while its valid
 * neighbors survive, so one hand-edit cannot cost the writer the whole history.
 *
 * This is not a Workshop session codec; the Workshop codec-evolution ADR does
 * not govern it. A later change to the file's meaning bumps `formatVersion`
 * and adds an explicit migration here.
 */

import type {
  DictionaryHistoryEntry,
  DictionaryHistorySummary,
  DictionaryLookupMode,
  DictionaryLookupRequest
} from '@messages';
import { DICTIONARY_HISTORY_CONTEXT_PREVIEW_CHARS } from '@shared/constants/dictionaryHistory';

export const DICTIONARY_HISTORY_FORMAT_VERSION = 1 as const;

export interface DictionaryHistoryFileV1 {
  formatVersion: typeof DICTIONARY_HISTORY_FORMAT_VERSION;
  /** Newest first. */
  entries: DictionaryHistoryEntry[];
}

export type DictionaryHistoryDecodeResult =
  | { kind: 'ok'; entries: DictionaryHistoryEntry[]; dropped: number }
  | { kind: 'invalid'; reason: string };

const LOOKUP_MODES: ReadonlySet<DictionaryLookupMode> = new Set<DictionaryLookupMode>(['standard', 'fast']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string';

export function decodeDictionaryHistoryFile(text: string): DictionaryHistoryDecodeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { kind: 'invalid', reason: `the file is not valid JSON (${message})` };
  }
  if (!isRecord(parsed)) {
    return { kind: 'invalid', reason: 'the file is not a JSON object' };
  }
  if (parsed.formatVersion !== DICTIONARY_HISTORY_FORMAT_VERSION) {
    return { kind: 'invalid', reason: `unknown formatVersion ${JSON.stringify(parsed.formatVersion) ?? 'undefined'}` };
  }
  if (!Array.isArray(parsed.entries)) {
    return { kind: 'invalid', reason: 'entries is not a list' };
  }

  const entries: DictionaryHistoryEntry[] = [];
  const seenIds = new Set<string>();
  let dropped = 0;
  for (const candidate of parsed.entries) {
    const entry = decodeEntry(candidate);
    // Ids address entries for load and delete, so the first (newest) wins.
    if (!entry || seenIds.has(entry.id)) {
      dropped += 1;
      continue;
    }
    seenIds.add(entry.id);
    entries.push(entry);
  }
  return { kind: 'ok', entries, dropped };
}

export function encodeDictionaryHistoryFile(entries: readonly DictionaryHistoryEntry[]): string {
  const file: DictionaryHistoryFileV1 = {
    formatVersion: DICTIONARY_HISTORY_FORMAT_VERSION,
    entries: entries.map(copyDictionaryHistoryEntry)
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function toDictionaryHistorySummary(entry: DictionaryHistoryEntry): DictionaryHistorySummary {
  const { request } = entry;
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    word: request.word,
    contextPreview: previewContext(request.context),
    includeEncyclopedia: request.includeEncyclopedia,
    includePalettes: request.includePalettes,
    mode: request.mode,
    ...(entry.modelId !== undefined ? { modelId: entry.modelId } : {}),
    ...(request.relativePath !== undefined ? { relativePath: request.relativePath } : {})
  };
}

/**
 * A detached copy with only the contract's fields, and no `undefined`-valued
 * optional keys, so callers can never mutate the store's state through it.
 */
export function copyDictionaryHistoryEntry(entry: DictionaryHistoryEntry): DictionaryHistoryEntry {
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    request: copyRequest(entry.request),
    ...(entry.modelId !== undefined ? { modelId: entry.modelId } : {}),
    toolName: entry.toolName,
    result: entry.result
  };
}

function copyRequest(request: DictionaryLookupRequest): DictionaryLookupRequest {
  return {
    word: request.word,
    context: request.context,
    includeEncyclopedia: request.includeEncyclopedia,
    includePalettes: request.includePalettes,
    mode: request.mode,
    ...(request.sourceUri !== undefined ? { sourceUri: request.sourceUri } : {}),
    ...(request.relativePath !== undefined ? { relativePath: request.relativePath } : {})
  };
}

function decodeEntry(value: unknown): DictionaryHistoryEntry | undefined {
  if (!isRecord(value)) {return undefined;}
  const request = decodeRequest(value.request);
  if (
    !request
    || typeof value.id !== 'string' || value.id.length === 0
    || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))
    || !isOptionalString(value.modelId)
    || typeof value.toolName !== 'string'
    || typeof value.result !== 'string'
  ) {
    return undefined;
  }
  return copyDictionaryHistoryEntry({
    id: value.id,
    createdAt: value.createdAt,
    request,
    modelId: value.modelId,
    toolName: value.toolName,
    result: value.result
  });
}

function decodeRequest(value: unknown): DictionaryLookupRequest | undefined {
  if (!isRecord(value)) {return undefined;}
  const { word, context, includeEncyclopedia, includePalettes, mode, sourceUri, relativePath } = value;
  if (
    typeof word !== 'string' || word.trim().length === 0
    || typeof context !== 'string'
    || typeof includeEncyclopedia !== 'boolean'
    || typeof includePalettes !== 'boolean'
    || typeof mode !== 'string' || !LOOKUP_MODES.has(mode as DictionaryLookupMode)
    || !isOptionalString(sourceUri)
    || !isOptionalString(relativePath)
  ) {
    return undefined;
  }
  return copyRequest({
    word,
    context,
    includeEncyclopedia,
    includePalettes,
    mode: mode as DictionaryLookupMode,
    sourceUri,
    relativePath
  });
}

/** Collapse whitespace and cut at the preview bound, counting code points so no emoji is split. */
function previewContext(context: string): string {
  const collapsed = context.replace(/\s+/g, ' ').trim();
  const characters = Array.from(collapsed);
  if (characters.length <= DICTIONARY_HISTORY_CONTEXT_PREVIEW_CHARS) {
    return collapsed;
  }
  return `${characters.slice(0, DICTIONARY_HISTORY_CONTEXT_PREVIEW_CHARS).join('').trimEnd()}…`;
}
