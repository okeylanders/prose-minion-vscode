/**
 * What `resource.read` (a persona's capability) and the Read in reader (ADR
 * 2026-11-03 D4) share beside the lookup itself: the path rule, the
 * fingerprint and the byte cut. The lookup by `{ group, path }` is
 * `findConfiguredResource`, in `@/application/services/ConfiguredResourceLookup`
 * (ADR 2026-11-20 D3), which both resolve a pair through, so the reader can
 * never open a file a persona could not have read.
 */

import { createHash } from 'crypto';

/** The path rule, shared with the file-edit trailer (`@/utils/configuredResourcePath`). */
export { isSafeConfiguredResourcePath } from '@/utils/configuredResourcePath';

/**
 * The fingerprint of a configured file's whole text (ADR 2026-11-03 D4): the
 * SHA-256 of its UTF-8 bytes as the provider loaded it. `resource.read`
 * records it and the reader compares against it, so both hash the same way.
 */
export function configuredResourceFingerprint(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
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
