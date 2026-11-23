/**
 * Made-up *Alice* history and a recording fake of the `FileHistory` port,
 * for the `history.*` tests (ADR 2026-11-19 D11–D17). Never a writer's
 * repository: made-up commits, made-up authors.
 */
import { createHash } from 'crypto';
import {
  fileHistoryCommitId,
  type FileHistory,
  type FileHistoryCommit,
  type FileHistoryCommitId,
  type FileHistoryUnavailableReason
} from '@/platform';
import type { ContextResourceSummary } from '@/domain/models/ContextGeneration';
import type { CapabilityContextWindow } from '@orchestration/AgentRunContracts';
import {
  WorkshopHistoryCapability,
  type WorkshopHistoryPorts
} from '@/application/services/workshop/history/WorkshopHistoryCapability';
import type { WorkshopHistoryExcerptFile } from '@/application/services/workshop/history/WorkshopHistoryFiles';
import { WorkshopHistoryDiffCache } from '@/application/services/workshop/history/WorkshopHistoryDiffCache';
import { NO_CONFIGURED_GROUP_FILES, type ConfiguredResourceGroupFiles } from '@/application/services/ConfiguredResourceLookup';

export const ALICE_PATH = 'Drafts/6.11.md';
export const ALICE_FS_PATH = '/projects/wonderland/Drafts/6.11.md';
export const EXCERPT_FS_PATH = '/projects/wonderland/Drafts/tea-party.md';

/** A full, made-up commit hash for `seed`. */
export function aliceHash(seed: string): FileHistoryCommitId {
  return fileHistoryCommitId(createHash('sha1').update(`alice:${seed}`).digest('hex'))!;
}

/** `count` commits, newest first: commit 0 is the newest. */
export function aliceCommits(count: number, author = 'Alice Liddell'): FileHistoryCommit[] {
  return Array.from({ length: count }, (_, index) => ({
    id: aliceHash(String(index)),
    authoredAt: new Date(Date.UTC(2026, 2, 1) - index * 86_400_000).toISOString(),
    author,
    subject: `Trim the tea party, pass ${count - index}`
  }));
}

export interface FakeHistoryOptions {
  readonly commits?: readonly FileHistoryCommit[];
  /** The file at each commit, as text (stored as UTF-8) or raw bytes; absent from the map means it did not exist there. */
  readonly texts?: ReadonlyMap<string, string | Uint8Array>;
  /** A blob size the host reports, when it should differ from the bytes (a text conversion, say). */
  readonly sizes?: ReadonlyMap<string, number>;
  readonly unavailable?: FileHistoryUnavailableReason;
}

export interface FakeHistory extends FileHistory {
  readonly logCalls: Array<{ fsPath: string; limit: number }>;
  readonly showCalls: Array<{ fsPath: string; commit: string }>;
  readonly sizeCalls: Array<{ fsPath: string; commit: string }>;
}

const bytesOf = (value: string | Uint8Array): Uint8Array =>
  typeof value === 'string' ? new TextEncoder().encode(value) : value;

export function fakeHistory(options: FakeHistoryOptions = {}): FakeHistory {
  const logCalls: FakeHistory['logCalls'] = [];
  const showCalls: FakeHistory['showCalls'] = [];
  const sizeCalls: FakeHistory['sizeCalls'] = [];
  return {
    logCalls,
    showCalls,
    sizeCalls,
    async log(fsPath, limit) {
      logCalls.push({ fsPath, limit });
      return options.unavailable
        ? { kind: 'unavailable', reason: options.unavailable }
        : { kind: 'log', commits: (options.commits ?? []).slice(0, limit) };
    },
    async show(fsPath, commit) {
      showCalls.push({ fsPath, commit });
      if (options.unavailable) {
        return { kind: 'unavailable', reason: options.unavailable };
      }
      const text = options.texts?.get(commit);
      return text === undefined ? { kind: 'absent' } : { kind: 'bytes', bytes: bytesOf(text) };
    },
    async size(fsPath, commit) {
      sizeCalls.push({ fsPath, commit });
      if (options.unavailable) {
        return { kind: 'unavailable', reason: options.unavailable };
      }
      const text = options.texts?.get(commit);
      return text === undefined ? { kind: 'absent' } : { kind: 'size', bytes: options.sizes?.get(commit) ?? bytesOf(text).byteLength };
    }
  };
}

export const aliceResource: ContextResourceSummary = {
  group: 'chapters',
  path: ALICE_PATH,
  label: '6.11',
  sizeBytes: 100,
  absolutePath: ALICE_FS_PATH
};

export interface HistoryHarnessOptions {
  readonly history?: FakeHistory;
  readonly saved?: string | Uint8Array;
  /** The saved file's size as `stat` reports it, when it should differ from the bytes read. */
  readonly savedSize?: number;
  readonly excerpt?: WorkshopHistoryExcerptFile;
  readonly resources?: readonly ContextResourceSummary[];
  /** Shared across harnesses to stand for one host's cache; a fresh one by default. */
  readonly diffs?: WorkshopHistoryDiffCache;
  /** The authoritative listing a missed pair is looked up in (ADR 2026-11-20 S50); none by default. */
  readonly groupFiles?: ConfiguredResourceGroupFiles;
}

/** The history sub-adapter over fakes, with its log lines and the turn's abort switch. */
export function historyCapability(options: HistoryHarnessOptions = {}) {
  const lines: string[] = [];
  const controller = new AbortController();
  const history = options.history ?? fakeHistory();
  const reads: string[] = [];
  const stats: string[] = [];
  const ports: WorkshopHistoryPorts = {
    history,
    fileSystem: {
      readFile: async (fsPath: string) => {
        reads.push(fsPath);
        if (options.saved === undefined) {
          throw new Error('ENOENT');
        }
        return bytesOf(options.saved);
      },
      stat: async (fsPath: string) => {
        stats.push(fsPath);
        if (options.saved === undefined) {
          throw new Error('ENOENT');
        }
        return { type: 1, ctime: 0, mtime: 0, size: options.savedSize ?? bytesOf(options.saved).byteLength };
      }
    },
    excerpt: { excerptFile: async () => options.excerpt ?? { kind: 'none' } },
    diffs: options.diffs ?? new WorkshopHistoryDiffCache()
  };
  const capability = new WorkshopHistoryCapability(
    ports,
    async () => options.resources ?? [aliceResource],
    { appendLine: (line: string) => { lines.push(line); }, clear: () => undefined, show: () => undefined },
    { requestId: 'host-request', personaId: 'jill', signal: controller.signal },
    options.groupFiles ?? NO_CONFIGURED_GROUP_FILES
  );
  return { capability, lines, controller, history, reads, stats };
}

/** A context window with `freeInputTokens` of room for evidence. */
export function windowWith(freeInputTokens: number): CapabilityContextWindow {
  return { contextLength: 200_000, requestTokens: 1_000, outputTokens: 4_000, headroomTokens: 1_000, freeInputTokens };
}

/** Paragraphs joined by blank lines. */
export const prose = (...paragraphs: string[]): string => paragraphs.join('\n\n');
