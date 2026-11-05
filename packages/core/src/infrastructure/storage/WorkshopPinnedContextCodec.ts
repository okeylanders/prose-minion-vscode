/**
 * WorkshopPinnedContextCodec: `prose-minion/pinned-context.json`, format 1
 * (ADR 2026-11-04 D5, D6; epic Slice 1). Pure: bytes in, a list or a
 * refusal out, and a list in, bytes out.
 *
 * ```json
 * {
 *   "format": 1,
 *   "files": [
 *     { "path": "Characters/alice.md" }
 *   ]
 * }
 * ```
 *
 * - **Strict, and whole.** Keys are exact and `format` must be `1`. A file
 *   that breaks any rule is refused as a whole with one reason
 *   (`WorkshopPinnedContextRefusal`); one bad entry is never dropped and the
 *   rest kept, since a silent drop would unpin a file for the writer.
 * - **Paths** keep `workshopPinnedContextPathFault`'s rule, and each appears
 *   once by `workshopPinnedContextPathKey` (case-folded on Windows: the
 *   platform is passed in).
 * - **At most `WORKSHOP_PINNED_CONTEXT_FILES` entries,** in at most
 *   `WORKSHOP_PINNED_CONTEXT_FILE_BYTES` bytes, checked before decoding;
 *   a list that would encode past it is never written.
 * - **Stable bytes.** Two-space indent, `format` first, a trailing newline,
 *   so a hand edit diffs cleanly. A leading byte-order mark (a Windows
 *   editor's) is read past, and never written.
 *
 * A change that cannot read `__tests__/fixtures/pinned-context-v1.json` is
 * a new format (ADR 2026-07-30).
 */

import {
  WORKSHOP_PINNED_CONTEXT_FILE_BYTES,
  WORKSHOP_PINNED_CONTEXT_FILES,
  WORKSHOP_PINNED_CONTEXT_FORMAT,
  workshopPinnedContextPathFault,
  workshopPinnedContextPathKey,
  type WorkshopPinnedContextList,
  type WorkshopPinnedContextPathPlatform,
  type WorkshopPinnedContextRefusal
} from '@shared/types/workshopPinnedContext';

export type WorkshopPinnedContextDecoded =
  | { ok: true; list: WorkshopPinnedContextList }
  /** `entry` is the zero-based index of the entry at fault, when one is. */
  | { ok: false; reason: WorkshopPinnedContextRefusal; entry?: number };

/** A list ready to write: its bytes, and the list as they read back. */
export type WorkshopPinnedContextPrepared =
  | { ok: true; list: WorkshopPinnedContextList; bytes: Uint8Array }
  | { ok: false; reason: WorkshopPinnedContextRefusal; entry?: number };

const ROOT_KEYS = new Set(['format', 'files']);
const ENTRY_KEYS = new Set(['path']);
const BYTE_ORDER_MARK = '﻿';
const encoder = new TextEncoder();

/** Read a pinned-context file, or say why it is unreadable as a whole. */
export function decodeWorkshopPinnedContext(
  bytes: Uint8Array | string,
  platform: WorkshopPinnedContextPathPlatform
): WorkshopPinnedContextDecoded {
  // Over the bound is refused before anything is decoded (a string counts its UTF-8 bytes).
  const byteLength = typeof bytes === 'string' ? encoder.encode(bytes).byteLength : bytes.byteLength;
  if (byteLength > WORKSHOP_PINNED_CONTEXT_FILE_BYTES) {
    return { ok: false, reason: 'too-large' };
  }
  let text: string;
  try {
    text = typeof bytes === 'string' ? bytes : new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return { ok: false, reason: 'json' };
  }
  if (text.startsWith(BYTE_ORDER_MARK)) {
    text = text.slice(BYTE_ORDER_MARK.length);
  }
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'json' };
  }
  if (!isPlainObject(root)) {
    return { ok: false, reason: 'format' };
  }
  if (root.format !== WORKSHOP_PINNED_CONTEXT_FORMAT) {
    return { ok: false, reason: 'format' };
  }
  if (Object.keys(root).some((key) => !ROOT_KEYS.has(key))) {
    return { ok: false, reason: 'unknown-key' };
  }
  const files = root.files;
  if (!Array.isArray(files)) {
    return { ok: false, reason: 'format' };
  }
  if (files.length > WORKSHOP_PINNED_CONTEXT_FILES) {
    return { ok: false, reason: 'too-many' };
  }
  const seen = new Set<string>();
  const entries: { path: string }[] = [];
  for (let index = 0; index < files.length; index++) {
    const entry: unknown = files[index];
    if (!isPlainObject(entry)) {
      return { ok: false, reason: 'format', entry: index };
    }
    if (Object.keys(entry).some((key) => !ENTRY_KEYS.has(key))) {
      return { ok: false, reason: 'unknown-key', entry: index };
    }
    const entryPath = entry.path;
    if (typeof entryPath !== 'string' || workshopPinnedContextPathFault(entryPath) !== undefined) {
      return { ok: false, reason: 'path', entry: index };
    }
    const key = workshopPinnedContextPathKey(entryPath, platform);
    if (seen.has(key)) {
      return { ok: false, reason: 'duplicate', entry: index };
    }
    seen.add(key);
    entries.push({ path: entryPath });
  }
  return { ok: true, list: { files: entries } };
}

/** The list as format 1's stable text, field by field, so nothing a caller added rides along. Not checked: see `prepareWorkshopPinnedContext`. */
export function encodeWorkshopPinnedContext(list: WorkshopPinnedContextList): string {
  const document = {
    format: WORKSHOP_PINNED_CONTEXT_FORMAT,
    files: list.files.map((entry) => ({ path: entry.path }))
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}

/** Encode `list` and read it back: only a list that reads back as written is ever written. */
export function prepareWorkshopPinnedContext(
  list: WorkshopPinnedContextList,
  platform: WorkshopPinnedContextPathPlatform
): WorkshopPinnedContextPrepared {
  const bytes = encoder.encode(encodeWorkshopPinnedContext(list));
  const decoded = decodeWorkshopPinnedContext(bytes, platform);
  return decoded.ok ? { ok: true, list: decoded.list, bytes } : decoded;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
