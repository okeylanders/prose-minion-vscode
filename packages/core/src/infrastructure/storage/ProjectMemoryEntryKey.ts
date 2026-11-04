/**
 * The memory manager's opaque row identity (ADR 2026-11-04 D10; PR #192
 * F-02), on the Lightbox's precedent (`LightboxFileKey`): a session-keyed
 * HMAC, so a key is stable while the extension session lasts, equal for
 * the same row, and of no use for recovering a path or guessing one.
 *
 * A row is a file *and what the host listed it as*. A set-aside copy is
 * listed under the name of the standing file beside it (PR #194 F-02), so
 * a key covers the row's kind as well as its contained path: the two rows
 * never share a key. Open file resolves a key against the current listing
 * and refuses one it doesn't find there (stale, forged, or another
 * workspace's); it never reads a path from the webview.
 */

import { createHmac, randomBytes } from 'node:crypto';

/** Drawn once per extension session; never posted or logged. */
const SESSION_SECRET = randomBytes(32);

/** 128 bits of the digest. */
const KEY_HEX_LENGTH = 32;

/** What a manager row is: a memory, another file needing attention (unreadable or conflicting), or a set-aside copy. */
export type ProjectMemoryEntryKind = 'memory' | 'file' | 'set-aside';

export function projectMemoryEntryKey(kind: ProjectMemoryEntryKind, absolutePath: string): string {
  return createHmac('sha256', SESSION_SECRET).update(`${kind}\u0000${absolutePath}`, 'utf8').digest('hex').slice(0, KEY_HEX_LENGTH);
}

/** A key's shape: anything else is refused before any listing. */
export const PROJECT_MEMORY_ENTRY_KEY = /^[0-9a-f]{32}$/;
