/**
 * A window's LightboxBoardStore over a memory file system, for the store's
 * rewrite and claim tests (Slice 5A.1; PR #164 F-01, F-02). Two windows
 * share one file system and each has its own store, staging ids and clock,
 * so a test can hold one window mid-write while the other acts, or move a
 * window's clock past the claim lease.
 */
import * as path from 'node:path';
import type { LogSink } from '@/platform';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { createFakeWorkspace } from '@/__tests__/mocks/platform';
import { LightboxBoardStore, type LightboxBoardSaveResult } from '@/infrastructure/storage/LightboxBoardStore';
import { LIGHTBOX_BOARD_CLAIM_LEASE_MS } from '@/infrastructure/storage/LightboxBoardClaims';
import { decodeLightboxBoardFile, namedLightboxBoardFile, type LightboxBoardFile } from '@/infrastructure/storage/LightboxBoardCodec';

export const ROOT = '/workspace';
export const BOARDS = path.join(ROOT, 'prose-minion', 'boards');
/** When the store saves, and takes its claims: 2026-10-22T14:05:09.123Z. */
export const SAVED_AT = Date.parse('2026-10-22T14:05:09.123Z');
/** A moment past the lease: a claim taken at `SAVED_AT` is abandoned by then. */
export const PAST_LEASE = SAVED_AT + LIGHTBOX_BOARD_CLAIM_LEASE_MS + 1;

/** A window's store over `fileSystem`; its clock reads `clock.at`, and its staging ids start with `prefix`. */
export function storeHost(fileSystem = new MemoryFileSystem(), prefix = 's', lines: string[] = [], clock = { at: SAVED_AT }) {
  const workspace = createFakeWorkspace({ workspaceFolders: () => [{ path: ROOT, name: 'workspace' }] });
  const log = { appendLine: (line: string) => { lines.push(line); }, show: jest.fn(), clear: jest.fn() } as unknown as LogSink;
  let staged = 0;
  const store = new LightboxBoardStore(fileSystem, workspace, log, {
    now: () => new Date(clock.at),
    mintStagingId: () => `${prefix}${++staged}`
  });
  return { fileSystem, store, lines, clock };
}

export function fileIdOf(result: LightboxBoardSaveResult): string {
  if (result.kind !== 'saved') {
    throw new Error(`expected a save, got ${result.kind}`);
  }
  return result.fileId;
}

export const pathOf = (fileId: string) => path.join(BOARDS, fileId);
export const everyFile = (fileSystem: MemoryFileSystem) => [...fileSystem.files.keys()].map((file) => path.relative(BOARDS, file)).sort();
export const text = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes);

/** Whether `filePath` is a claim taken by the writer whose ids start with `writer`. */
export const claimBy = (writer: string) => (filePath: string) => new RegExp(`\\.claim-\\d{13}-${writer}\\d+$`).test(filePath);
/** A claim's path beside the saved file `fileId`, taken at `at` (epoch ms) by `id`. */
export const claimOf = (fileId: string, at: number, id: string) =>
  path.join(path.dirname(pathOf(fileId)), `.${path.basename(fileId)}.claim-${at}-${id}`);

/** The saved file `fileId`, decoded from disk. */
export function readSaved(fileSystem: MemoryFileSystem, fileId: string): LightboxBoardFile {
  const decoded = decodeLightboxBoardFile(text(fileSystem.files.get(pathOf(fileId))));
  if (decoded.kind !== 'board') {
    throw new Error(`${fileId} does not read`);
  }
  return decoded.file;
}

/** A rename's update: the file with `name` (or unnamed). */
export const named = (name: string | undefined) => (file: LightboxBoardFile) => namedLightboxBoardFile(file, name);
