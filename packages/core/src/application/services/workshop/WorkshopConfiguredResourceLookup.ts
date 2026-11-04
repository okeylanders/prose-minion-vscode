/**
 * The one rule for naming a configured project resource by `{ group, path }`.
 *
 * `resource.read` (a persona's capability) and the Read in reader (ADR
 * 2026-11-03 D4) both resolve a pair through these functions, so the reader
 * can never open a file a persona could not have read. Containment itself is
 * the provider's: a path resolves only when the provider's own listing holds
 * it, and that listing admits only files inside the configured groups.
 */

import type { ContextResourceSummary } from '@/domain/models/ContextGeneration';
import type { ContextPathGroup } from '@shared/types';
import * as path from 'path';

/**
 * A workspace-relative configured path: no absolute path (POSIX or Windows),
 * no URI scheme, no backslash or NUL, and no empty, `.` or `..` segment.
 */
export function isSafeConfiguredResourcePath(value: string): boolean {
  if (!value || value.includes('\\') || value.includes('\0')) {
    return false;
  }
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) {
    return false;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return false;
  }
  const segments = value.split('/');
  return segments.every(segment => segment.length > 0 && segment !== '.' && segment !== '..');
}

export type ConfiguredResourceLookup =
  | { kind: 'found'; resource: ContextResourceSummary }
  | { kind: 'missing' }
  | { kind: 'ambiguous' };

/**
 * Finds `{ group, path }` in the provider's listing: the exact path first,
 * then a path equal to it ignoring letter case, which must be unique.
 */
export function findConfiguredResource(
  resources: readonly ContextResourceSummary[],
  group: ContextPathGroup,
  resourcePath: string
): ConfiguredResourceLookup {
  const exact = resources.find(item => item.group === group && item.path === resourcePath);
  if (exact) {
    return { kind: 'found', resource: exact };
  }
  const folded = resourcePath.toLowerCase();
  const caseFolded = resources.filter(item =>
    item.group === group && item.path.toLowerCase() === folded
  );
  if (caseFolded.length > 1) {
    return { kind: 'ambiguous' };
  }
  return caseFolded.length === 1
    ? { kind: 'found', resource: caseFolded[0] }
    : { kind: 'missing' };
}

export interface Utf8Slice {
  content: string;
  bytes: number;
  totalBytes: number;
  truncated: boolean;
}

/** Cuts text to at most `maxBytes` UTF-8 bytes without splitting a character. */
export function sliceUtf8(content: string, maxBytes: number): Utf8Slice {
  const totalBytes = Buffer.byteLength(content, 'utf8');
  if (totalBytes <= maxBytes) {
    return { content, bytes: totalBytes, totalBytes, truncated: false };
  }
  const encoded = Buffer.from(content, 'utf8');
  const sliced = encoded.subarray(0, maxBytes).toString('utf8').replace(/�$/, '');
  return {
    content: sliced,
    bytes: Buffer.byteLength(sliced, 'utf8'),
    totalBytes,
    truncated: true
  };
}
