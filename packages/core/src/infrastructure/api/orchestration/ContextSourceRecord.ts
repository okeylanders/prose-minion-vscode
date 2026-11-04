/**
 * A manifest row as the host stores it (Workshop Wayfinding ADR 2026-11-03 D4).
 *
 * `ContextSourceEntry` is the display-safe row the webview receives. The host
 * keeps one more field beside it, `sourceFingerprint`, the SHA-256 of a file's
 * text when `resource.read` read it. It answers "has this file changed since?"
 * and is never projected: the webview learns only the answer, the way the
 * excerpt's fingerprint stays out of `WorkshopExcerptSnapshot`.
 *
 * Every provenance field is written only when it is present (D9), so a row
 * stored before Slice 3 reads and writes byte for byte as it was.
 */

import type { ContextSourceEntry, ContextSourceLineRange } from '@shared/types';

export interface StoredContextSourceEntry extends ContextSourceEntry {
  /** SHA-256 (lowercase hex) of the file's text when it was read. Host-private. */
  sourceFingerprint?: string;
}

const SOURCE_FINGERPRINT = /^[a-f0-9]{64}$/;

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

/** True for a pair of positive integer lines with `start ≤ end`. */
export function isContextSourceLineRange(value: unknown): value is ContextSourceLineRange {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  const range = value as Record<string, unknown>;
  return keys.length === 2
    && isPositiveInteger(range.start)
    && isPositiveInteger(range.end)
    && range.start <= range.end;
}

/** True for a SHA-256 digest as the host writes it: 64 lowercase hex characters. */
export function isContextSourceFingerprint(value: unknown): value is string {
  return typeof value === 'string' && SOURCE_FINGERPRINT.test(value);
}

/**
 * Names the first provenance field that is present but malformed, or returns
 * undefined. Absent fields are always valid: they are optional on read (D9).
 */
export function contextSourceProvenanceFault(source: {
  readonly turnId?: unknown;
  readonly lineRange?: unknown;
  readonly sourceFingerprint?: unknown;
}): 'turnId' | 'lineRange' | 'sourceFingerprint' | undefined {
  if (source.turnId !== undefined && (typeof source.turnId !== 'string' || source.turnId.length === 0)) {
    return 'turnId';
  }
  if (source.lineRange !== undefined && !isContextSourceLineRange(source.lineRange)) {
    return 'lineRange';
  }
  if (source.sourceFingerprint !== undefined && !isContextSourceFingerprint(source.sourceFingerprint)) {
    return 'sourceFingerprint';
  }
  return undefined;
}

/** A deep copy that keeps every field the row holds, the fingerprint included. */
export function cloneStoredContextSource<T extends StoredContextSourceEntry>(entry: T): T {
  return {
    ...entry,
    configuredResource: entry.configuredResource ? { ...entry.configuredResource } : undefined,
    ...(entry.lineRange ? { lineRange: { ...entry.lineRange } } : {})
  };
}

/** The row as the webview may see it: the fingerprint never leaves the host. */
export function projectContextSource(entry: StoredContextSourceEntry): ContextSourceEntry {
  const { sourceFingerprint: _hostPrivate, ...row } = cloneStoredContextSource(entry);
  return row;
}

/**
 * How the reader names the row it opened: the file and when it was delivered.
 * A manifest row has no id of its own, so two rows can share both; the newest
 * one wins, as the reader shows the latest reading.
 */
export interface ContextSourceReadIdentity {
  readonly group: string;
  readonly path: string;
  readonly deliveredAt: number;
}

/** The newest `resource` row naming that file at that delivery time, if any. */
export function findContextSourceRead<T extends StoredContextSourceEntry>(
  rows: readonly T[],
  identity: ContextSourceReadIdentity
): T | undefined {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (
      row.kind === 'resource'
      && row.deliveredAt === identity.deliveredAt
      && row.configuredResource?.group === identity.group
      && row.configuredResource.path === identity.path
    ) {
      return row;
    }
  }
  return undefined;
}
