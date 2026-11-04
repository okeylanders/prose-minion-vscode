/**
 * ProjectMemoryCodec — one Workshop project memory's file, format 1 (epic
 * 2026-11-04, Slice 1; the feature note's "The memory file"). Pure: no
 * host, no I/O.
 *
 * ```markdown
 * ---
 * format: 1
 * id: mem-7f3c2a
 * title: The Rabbit's watch runs backward
 * kind: canon
 * summary: From chapter 3 on, the White Rabbit's watch runs backward.
 * status: active
 * pinned: false
 * created: 2026-11-03T14:22:05Z
 * updated: 2026-11-03T14:22:05Z
 * origin: proposed
 * proposed-by: cliff
 * source-session: 6b0f3c9e-2c1d-4e8a-9a51-0d6f2b7c9e11
 * source-turns: t-0412, t-0415
 * supersedes:
 * ---
 *
 * The body: free Markdown.
 * ```
 *
 * - **Flat `key: value` lines, no YAML.** A line is a key, a colon and a
 *   value; space around either is ignored, and a blank line is skipped. A
 *   value is taken literally: no quotes, escapes or nesting, so a quoted
 *   title keeps its quotation marks. An indented line, a comment or a
 *   list item is malformed.
 * - **Closed keys** (`PROJECT_MEMORY_KEYS`). An unknown key, or one written
 *   twice, fails the file. Optional keys may be left out or left empty
 *   (`supersedes:`): `pinned` reads as `false`, a list as none.
 * - **Closed vocabularies** for `kind`, `status` and `origin`, and the
 *   bounds of `PROJECT_MEMORY_FIELD_CHARACTERS` and
 *   `PROJECT_MEMORY_LIST_ENTRIES`. No value holds a control character.
 * - **Provenance.** A proposed memory names its persona, session and at
 *   least one turn; a writer's memory names no persona. Turns need a
 *   session.
 * - **Hand edits read.** A byte-order mark, CRLF or CR line endings, extra
 *   space and missing optional keys are all read; leading blank lines and
 *   trailing white space of the body are not kept.
 * - **Fails closed, by name.** Every refusal is one of
 *   `PROJECT_MEMORY_INVALID_REASONS`, with the known key it was found at.
 *   Neither carries the file's text, so either may be logged.
 * - **Canonical encoding.** Every key, in `PROJECT_MEMORY_KEYS`' order, an
 *   empty optional as a bare `key:`, LF line endings, then a blank line and
 *   the body. A decoded memory encodes to the same memory again.
 */

import {
  PROJECT_MEMORY_FIELD_CHARACTERS,
  PROJECT_MEMORY_FORMAT,
  PROJECT_MEMORY_ID,
  PROJECT_MEMORY_KINDS,
  PROJECT_MEMORY_LIST_ENTRIES,
  PROJECT_MEMORY_ORIGINS,
  PROJECT_MEMORY_STATUSES,
  type ProjectMemory,
  type ProjectMemoryKind,
  type ProjectMemoryOrigin,
  type ProjectMemoryStatus
} from '@shared/types/projectMemory';

/** Every key format 1 reads, in the order it writes them. */
export const PROJECT_MEMORY_KEYS = [
  'format', 'id', 'title', 'kind', 'summary', 'status', 'pinned',
  'created', 'updated', 'origin', 'proposed-by',
  'source-session', 'source-turns', 'supersedes'
] as const;
export type ProjectMemoryKey = typeof PROJECT_MEMORY_KEYS[number];

const REQUIRED_KEYS: readonly ProjectMemoryKey[] = ['format', 'id', 'title', 'kind', 'summary', 'status', 'created', 'updated', 'origin'];

export const PROJECT_MEMORY_INVALID_REASONS = [
  /** The file does not open with a `---` line. */
  'no-frontmatter',
  /** No `---` line closes the frontmatter. */
  'unclosed-frontmatter',
  /** A frontmatter line is not `key: value`. */
  'malformed-line',
  'unknown-key',
  'duplicate-key',
  /** A required key is absent or empty. */
  'missing-key',
  /** `format` names a format this build does not read. */
  'unsupported-format',
  /** A value outside its vocabulary or shape. */
  'invalid-value',
  /** A value, a list or the body past its bound. */
  'too-long',
  /** A proposed memory without its persona, session or turns. */
  'proposal-without-provenance',
  /** A writer's memory naming a persona that proposed it. */
  'proposer-without-proposal',
  /** Source turns without the session they belong to. */
  'turns-without-session',
  'updated-before-created',
  'supersedes-itself'
] as const;
export type ProjectMemoryInvalidReason = typeof PROJECT_MEMORY_INVALID_REASONS[number];

export type ProjectMemoryDecodeResult =
  | { kind: 'memory'; memory: ProjectMemory }
  | { kind: 'invalid'; reason: ProjectMemoryInvalidReason; key?: ProjectMemoryKey };

const FENCE = /^---[ \t]*$/;
const LINE = /^([a-z][a-z0-9-]*)[ \t]*:([^\n]*)$/;
// eslint-disable-next-line no-control-regex -- control characters are what it refuses.
const CONTROL = /[\u0000-\u001f\u007f\u2028\u2029]/;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const PERSONA = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SESSION = /^[A-Za-z0-9][A-Za-z0-9-]{0,127}$/;
const TURN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

class Invalid extends Error {
  constructor(readonly reason: ProjectMemoryInvalidReason, readonly key?: ProjectMemoryKey) {
    super(reason);
  }
}

/** Read one memory file's text. */
export function decodeProjectMemory(text: string): ProjectMemoryDecodeResult {
  try {
    return { kind: 'memory', memory: decode(text) };
  } catch (error) {
    if (error instanceof Invalid) {
      return error.key ? { kind: 'invalid', reason: error.reason, key: error.key } : { kind: 'invalid', reason: error.reason };
    }
    throw error;
  }
}

/** Write one memory file's text, canonically. The caller checks it reads back (`decodeProjectMemory`) before writing it. */
export function encodeProjectMemory(memory: ProjectMemory): string {
  /* eslint-disable @typescript-eslint/naming-convention -- keyed by format 1's kebab-case keys. */
  const values: Record<ProjectMemoryKey, string> = {
    format: String(PROJECT_MEMORY_FORMAT),
    id: memory.id,
    title: memory.title,
    kind: memory.kind,
    summary: memory.summary,
    status: memory.status,
    pinned: memory.pinned ? 'true' : 'false',
    created: memory.created,
    updated: memory.updated,
    origin: memory.origin,
    'proposed-by': memory.proposedBy ?? '',
    'source-session': memory.sourceSession ?? '',
    'source-turns': memory.sourceTurns.join(', '),
    supersedes: memory.supersedes.join(', ')
  };
  /* eslint-enable @typescript-eslint/naming-convention */
  const lines = PROJECT_MEMORY_KEYS.map((key) => (values[key] === '' ? `${key}:` : `${key}: ${values[key]}`));
  const body = memory.body.length > 0 ? `\n${memory.body}\n` : '';
  return `---\n${lines.join('\n')}\n---\n${body}`;
}

function decode(text: string): ProjectMemory {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  if (!FENCE.test(lines[0] ?? '')) {
    throw new Invalid('no-frontmatter');
  }
  const close = lines.findIndex((line, index) => index > 0 && FENCE.test(line));
  if (close < 0) {
    throw new Invalid('unclosed-frontmatter');
  }
  const fields = readFields(lines.slice(1, close));
  for (const key of REQUIRED_KEYS) {
    if (!fields.has(key)) {
      throw new Invalid('missing-key', key);
    }
  }
  const format = required(fields, 'format');
  if (!/^\d+$/.test(format)) {
    throw new Invalid('invalid-value', 'format');
  }
  if (Number(format) !== PROJECT_MEMORY_FORMAT) {
    throw new Invalid('unsupported-format', 'format');
  }
  const id = matching(fields, 'id', PROJECT_MEMORY_ID);
  const memory: ProjectMemory = {
    id,
    title: line(fields, 'title', PROJECT_MEMORY_FIELD_CHARACTERS.title),
    kind: oneOf<ProjectMemoryKind>(fields, 'kind', PROJECT_MEMORY_KINDS),
    summary: line(fields, 'summary', PROJECT_MEMORY_FIELD_CHARACTERS.summary),
    status: oneOf<ProjectMemoryStatus>(fields, 'status', PROJECT_MEMORY_STATUSES),
    pinned: flag(fields, 'pinned'),
    created: time(fields, 'created'),
    updated: time(fields, 'updated'),
    origin: oneOf<ProjectMemoryOrigin>(fields, 'origin', PROJECT_MEMORY_ORIGINS),
    ...optional('proposedBy', fields.has('proposed-by') ? matching(fields, 'proposed-by', PERSONA) : undefined),
    ...optional('sourceSession', fields.has('source-session') ? matching(fields, 'source-session', SESSION) : undefined),
    sourceTurns: list(fields, 'source-turns', TURN, PROJECT_MEMORY_LIST_ENTRIES.sourceTurns),
    supersedes: list(fields, 'supersedes', PROJECT_MEMORY_ID, PROJECT_MEMORY_LIST_ENTRIES.supersedes),
    body: readBody(lines.slice(close + 1))
  };
  checkProvenance(memory);
  if (Date.parse(memory.updated) < Date.parse(memory.created)) {
    throw new Invalid('updated-before-created', 'updated');
  }
  if (memory.supersedes.includes(memory.id)) {
    throw new Invalid('supersedes-itself', 'supersedes');
  }
  return memory;
}

/** The frontmatter's fields, by key; an empty value is left out, as if the key were absent. */
function readFields(lines: readonly string[]): Map<ProjectMemoryKey, string> {
  const fields = new Map<ProjectMemoryKey, string>();
  const seen = new Set<string>();
  for (const raw of lines) {
    if (raw.trim() === '') {
      continue;
    }
    const match = LINE.exec(raw);
    if (!match) {
      throw new Invalid('malformed-line');
    }
    const [, name, rawValue] = match;
    if (!isKey(name)) {
      throw new Invalid('unknown-key');
    }
    if (seen.has(name)) {
      throw new Invalid('duplicate-key', name);
    }
    seen.add(name);
    const value = rawValue.replace(/^[ \t]+|[ \t]+$/g, '');
    if (CONTROL.test(value)) {
      throw new Invalid('invalid-value', name);
    }
    if (value !== '') {
      fields.set(name, value);
    }
  }
  return fields;
}

function readBody(lines: readonly string[]): string {
  const body = lines.join('\n').replace(/^(?:[ \t]*\n)+/, '').replace(/\s+$/, '');
  if (body.length > PROJECT_MEMORY_FIELD_CHARACTERS.body) {
    throw new Invalid('too-long');
  }
  return body;
}

function checkProvenance(memory: ProjectMemory): void {
  if (memory.origin === 'proposed') {
    if (memory.proposedBy === undefined) {
      throw new Invalid('proposal-without-provenance', 'proposed-by');
    }
    if (memory.sourceSession === undefined) {
      throw new Invalid('proposal-without-provenance', 'source-session');
    }
    if (memory.sourceTurns.length === 0) {
      throw new Invalid('proposal-without-provenance', 'source-turns');
    }
  } else if (memory.proposedBy !== undefined) {
    throw new Invalid('proposer-without-proposal', 'proposed-by');
  }
  if (memory.sourceTurns.length > 0 && memory.sourceSession === undefined) {
    throw new Invalid('turns-without-session', 'source-turns');
  }
}

function isKey(name: string): name is ProjectMemoryKey {
  return (PROJECT_MEMORY_KEYS as readonly string[]).includes(name);
}

function required(fields: ReadonlyMap<ProjectMemoryKey, string>, key: ProjectMemoryKey): string {
  const value = fields.get(key);
  if (value === undefined) {
    throw new Invalid('missing-key', key);
  }
  return value;
}

function matching(fields: ReadonlyMap<ProjectMemoryKey, string>, key: ProjectMemoryKey, pattern: RegExp): string {
  const value = required(fields, key);
  if (!pattern.test(value)) {
    throw new Invalid('invalid-value', key);
  }
  return value;
}

function line(fields: ReadonlyMap<ProjectMemoryKey, string>, key: ProjectMemoryKey, characters: number): string {
  const value = required(fields, key);
  if (value.length > characters) {
    throw new Invalid('too-long', key);
  }
  return value;
}

function oneOf<T extends string>(fields: ReadonlyMap<ProjectMemoryKey, string>, key: ProjectMemoryKey, vocabulary: readonly T[]): T {
  const value = required(fields, key);
  if (!(vocabulary as readonly string[]).includes(value)) {
    throw new Invalid('invalid-value', key);
  }
  return value as T;
}

function flag(fields: ReadonlyMap<ProjectMemoryKey, string>, key: ProjectMemoryKey): boolean {
  const value = fields.get(key);
  if (value === undefined || value === 'false') {
    return false;
  }
  if (value === 'true') {
    return true;
  }
  throw new Invalid('invalid-value', key);
}

/** An ISO 8601 UTC time that names a real moment (no 2026-02-30). */
function time(fields: ReadonlyMap<ProjectMemoryKey, string>, key: ProjectMemoryKey): string {
  const value = required(fields, key);
  const at = new Date(value);
  if (!TIME.test(value) || Number.isNaN(at.getTime()) || at.toISOString().slice(0, 19) !== value.slice(0, 19)) {
    throw new Invalid('invalid-value', key);
  }
  return value;
}

/** A comma-separated list: no empty entry, none twice, at most `entries`. */
function list(fields: ReadonlyMap<ProjectMemoryKey, string>, key: ProjectMemoryKey, pattern: RegExp, entries: number): string[] {
  const value = fields.get(key);
  if (value === undefined) {
    return [];
  }
  const items = value.split(',').map((item) => item.trim());
  if (items.some((item) => !pattern.test(item)) || new Set(items).size !== items.length) {
    throw new Invalid('invalid-value', key);
  }
  if (items.length > entries) {
    throw new Invalid('too-long', key);
  }
  return items;
}

function optional<K extends 'proposedBy' | 'sourceSession'>(key: K, value: string | undefined): Partial<Record<K, string>> {
  return value === undefined ? {} : ({ [key]: value } as Partial<Record<K, string>>);
}
