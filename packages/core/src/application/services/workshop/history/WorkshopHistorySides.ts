/**
 * The two sides of a `history.diff`, read within their bounds and decoded
 * by one policy (ADR 2026-11-19 D13; PR #287).
 *
 * - **Sized before fetched.** Each side's raw size is asked first: a
 *   commit's blob through the port's `size`, the saved file through the
 *   `FileSystem` port's `stat`. A side past `diffSourceBytes` refuses the
 *   diff before anything is fetched, and the other side is never read.
 *   The size is checked again after the read, for a file that changed (or
 *   a blob a repository's text conversion grew) in between.
 * - **One decoder for every side.** History arrives as raw bytes, like the
 *   saved file, and every side is decoded as strict UTF-8, a byte-order mark
 *   stripped. Invalid bytes refuse the diff in words; nothing is mixed with
 *   VS Code's own encoding detection.
 * - **A side where the file did not exist** is empty, and is never fetched.
 */

import type { FileHistory, FileHistoryCommit, FileHistoryUnavailableReason, FileSystem } from '@/platform';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

export interface WorkshopHistorySide {
  readonly text: string;
  /** The file did not exist at that commit: read as empty. */
  readonly absent?: boolean;
}

export type WorkshopHistorySidesRead =
  | { readonly kind: 'sides'; readonly older: WorkshopHistorySide; readonly newer: WorkshopHistorySide }
  | { readonly kind: 'unavailable'; readonly reason: FileHistoryUnavailableReason }
  | { readonly kind: 'too-large'; readonly field: 'from' | 'to' }
  | { readonly kind: 'not-utf8'; readonly field: 'from' | 'to' }
  | { readonly kind: 'current-unreadable' };

export interface WorkshopHistorySidePorts {
  readonly history: Pick<FileHistory, 'show' | 'size'>;
  readonly fileSystem: Pick<FileSystem, 'readFile' | 'stat'>;
}

type Fault = Exclude<WorkshopHistorySidesRead, { kind: 'sides' }>;
type Sized = { readonly kind: 'sized'; readonly bytes: number } | { readonly kind: 'absent' } | Fault;

/** Strict UTF-8, a byte-order mark stripped; undefined for bytes that are not UTF-8 text. */
export function decodeWorkshopHistoryText(bytes: Uint8Array): string | undefined {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

/** Read `from` and `to` (a commit, or the saved file when absent), sizing both before fetching either. */
export async function readWorkshopHistorySides(
  ports: WorkshopHistorySidePorts,
  fsPath: string,
  from: FileHistoryCommit,
  to: FileHistoryCommit | undefined,
  throwIfAborted: () => void
): Promise<WorkshopHistorySidesRead> {
  const limit = PROMPT_BUDGETS.workshopHistory.diffSourceBytes;
  const olderSize = await commitSize(ports, fsPath, from, 'from', limit);
  throwIfAborted();
  if (olderSize.kind !== 'sized' && olderSize.kind !== 'absent') {
    return olderSize;
  }
  const newerSize = to ? await commitSize(ports, fsPath, to, 'to', limit) : await savedSize(ports, fsPath, limit);
  throwIfAborted();
  if (newerSize.kind !== 'sized' && newerSize.kind !== 'absent') {
    return newerSize;
  }
  const older = await fetchSide(ports, fsPath, from, olderSize, 'from', limit);
  throwIfAborted();
  if ('kind' in older) {
    return older;
  }
  const newer = to ? await fetchSide(ports, fsPath, to, newerSize, 'to', limit) : await fetchSaved(ports, fsPath, limit);
  throwIfAborted();
  if ('kind' in newer) {
    return newer;
  }
  return { kind: 'sides', older, newer };
}

async function commitSize(
  ports: WorkshopHistorySidePorts,
  fsPath: string,
  commit: FileHistoryCommit,
  field: 'from' | 'to',
  limit: number
): Promise<Sized> {
  const size = await ports.history.size(fsPath, commit.id);
  switch (size.kind) {
    case 'size':
      return size.bytes > limit ? { kind: 'too-large', field } : { kind: 'sized', bytes: size.bytes };
    case 'absent':
      return { kind: 'absent' };
    case 'unavailable':
      return { kind: 'unavailable', reason: size.reason };
    default:
      return assertNever(size);
  }
}

async function savedSize(ports: WorkshopHistorySidePorts, fsPath: string, limit: number): Promise<Sized> {
  try {
    const stat = await ports.fileSystem.stat(fsPath);
    return stat.size > limit ? { kind: 'too-large', field: 'to' } : { kind: 'sized', bytes: stat.size };
  } catch {
    return { kind: 'current-unreadable' };
  }
}

async function fetchSide(
  ports: WorkshopHistorySidePorts,
  fsPath: string,
  commit: FileHistoryCommit,
  sized: Extract<Sized, { kind: 'sized' | 'absent' }>,
  field: 'from' | 'to',
  limit: number
): Promise<WorkshopHistorySide | Fault> {
  if (sized.kind === 'absent') {
    return { text: '', absent: true };
  }
  const shown = await ports.history.show(fsPath, commit.id);
  switch (shown.kind) {
    case 'bytes':
      return decoded(shown.bytes, field, limit);
    // Gone between sizing and reading: read as it now stands.
    case 'absent':
      return { text: '', absent: true };
    case 'unavailable':
      return { kind: 'unavailable', reason: shown.reason };
    default:
      return assertNever(shown);
  }
}

async function fetchSaved(ports: WorkshopHistorySidePorts, fsPath: string, limit: number): Promise<WorkshopHistorySide | Fault> {
  let bytes: Uint8Array;
  try {
    bytes = await ports.fileSystem.readFile(fsPath);
  } catch {
    return { kind: 'current-unreadable' };
  }
  return decoded(bytes, 'to', limit);
}

/** The post-read check, then the one decoder. */
function decoded(bytes: Uint8Array, field: 'from' | 'to', limit: number): WorkshopHistorySide | Fault {
  if (bytes.byteLength > limit) {
    return { kind: 'too-large', field };
  }
  const text = decodeWorkshopHistoryText(bytes);
  return text === undefined ? { kind: 'not-utf8', field } : { text };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled history side: ${JSON.stringify(value)}`);
}
