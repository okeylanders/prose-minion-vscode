/**
 * The files one `resource.read` names, resolved (ADR 2026-11-14 D6): each is
 * either ready to read, with its lines and the window the request selects,
 * or carries its own outcome, in the words a one-path read has always used.
 * One bad path never fails the others.
 */

import type {
  ContextResourceContent,
  ContextResourceSummary
} from '@/domain/models/ContextGeneration';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { ContextPathGroup } from '@shared/types';
import type { WorkshopResourceReadFile } from '@shared/types/workshopCapabilities';
import {
  configuredResourceFingerprint,
  findConfiguredResource
} from './WorkshopConfiguredResourceLookup';

/** Why a named file was not read at all. `line-too-long` is the packing's, not this module's. */
export type WorkshopResourceFileFault =
  | 'missing'
  | 'ambiguous'
  | 'too-large'
  | 'unreadable'
  | 'start-past-end';

export interface WorkshopResourceReadyFile {
  readonly kind: 'ready';
  readonly group: ContextPathGroup;
  /** The canonical configured path. */
  readonly path: string;
  readonly label: string;
  readonly workspaceFolder?: string;
  /** Every line of the file, split at LF or CRLF. */
  readonly lines: readonly string[];
  readonly totalLines: number;
  /** The whole file's UTF-8 bytes, its lines joined by LF. */
  readonly totalBytes: number;
  /** The selected window, 1-based and inclusive. */
  readonly startLine: number;
  readonly selectedEndLine: number;
  /** Each selected line's UTF-8 bytes, from `startLine`. */
  readonly lineBytes: readonly number[];
  /** The selected window's UTF-8 bytes, its lines joined by LF: what this file needs of a read. */
  readonly windowBytes: number;
  /** SHA-256 of the whole file as loaded. Host-private. */
  readonly fingerprint: string;
}

export interface WorkshopResourceFaultedFile {
  readonly kind: 'fault';
  readonly group: ContextPathGroup;
  /** The canonical configured path when the lookup found one; else the path as named. */
  readonly path: string;
  readonly fault: WorkshopResourceFileFault;
  /** Why, in the read's own words. */
  readonly error: string;
  /** What a one-path read reports beside the error. */
  readonly metadata: Readonly<Record<string, unknown>>;
}

export type WorkshopResourcePreparedFile = WorkshopResourceReadyFile | WorkshopResourceFaultedFile;

export interface WorkshopResourceFileSource {
  resources(): Promise<ContextResourceSummary[]>;
  load(resourcePath: string): Promise<ContextResourceContent[]>;
  throwIfAborted(): void;
}

/** Resolve each named file, in the order named. Lines are honored only by a one-file read. */
export async function prepareWorkshopResourceFiles(
  source: WorkshopResourceFileSource,
  files: readonly WorkshopResourceReadFile[],
  lines: { readonly startLine?: number; readonly endLine?: number }
): Promise<WorkshopResourcePreparedFile[]> {
  const resources = await source.resources();
  const prepared: WorkshopResourcePreparedFile[] = [];
  for (const file of files) {
    prepared.push(await prepareFile(source, resources, file, lines));
    source.throwIfAborted();
  }
  return prepared;
}

async function prepareFile(
  source: WorkshopResourceFileSource,
  resources: readonly ContextResourceSummary[],
  file: WorkshopResourceReadFile,
  lines: { readonly startLine?: number; readonly endLine?: number }
): Promise<WorkshopResourcePreparedFile> {
  const budgets = PROMPT_BUDGETS.workshopResource;
  const lookup = findConfiguredResource(resources, file.group, file.path);
  if (lookup.kind === 'ambiguous') {
    return fault(file, 'ambiguous',
      'The requested path matches more than one configured resource when letter case is ignored.', {});
  }
  if (lookup.kind === 'missing') {
    return fault(file, 'missing',
      'The requested path is not one of the configured project resources in that group.', {});
  }
  const resource = lookup.resource;
  if (resource.sizeBytes > budgets.readSourceBytes) {
    return fault(resource, 'too-large',
      `The configured project resource exceeds the ${budgets.readSourceBytes}-byte source-read ceiling.`,
      { sourceBytes: resource.sizeBytes, sourceByteCeiling: budgets.readSourceBytes });
  }

  const loaded = (await source.load(resource.path)).find(item =>
    item.group === resource.group && item.path.toLowerCase() === resource.path.toLowerCase()
  );
  source.throwIfAborted();
  if (!loaded) {
    return fault(resource, 'unreadable', 'The configured project resource could not be read.', {});
  }
  const loadedBytes = Buffer.byteLength(loaded.content, 'utf8');
  if (loadedBytes > budgets.readSourceBytes) {
    return fault(loaded, 'too-large',
      `The configured project resource changed beyond the ${budgets.readSourceBytes}-byte source-read ceiling.`,
      { workspaceFolder: loaded.workspaceFolder, sourceBytes: loadedBytes, sourceByteCeiling: budgets.readSourceBytes });
  }

  const allLines = loaded.content.split(/\r?\n/);
  const totalLines = allLines.length;
  const startLine = lines.startLine ?? 1;
  if (startLine > totalLines) {
    return fault(loaded, 'start-past-end',
      `The requested start line ${startLine} is beyond the file's ${totalLines} lines.`,
      { workspaceFolder: loaded.workspaceFolder, startLine, totalLines });
  }
  const selectedEndLine = Math.min(lines.endLine ?? startLine + budgets.readDefaultLines - 1, totalLines);
  const lineBytes = allLines.slice(startLine - 1, selectedEndLine).map(line => Buffer.byteLength(line, 'utf8'));
  return {
    kind: 'ready',
    group: loaded.group,
    path: loaded.path,
    label: loaded.label,
    workspaceFolder: loaded.workspaceFolder,
    lines: allLines,
    totalLines,
    totalBytes: Buffer.byteLength(allLines.join('\n'), 'utf8'),
    startLine,
    selectedEndLine,
    lineBytes,
    windowBytes: joinedBytes(lineBytes),
    fingerprint: configuredResourceFingerprint(loaded.content)
  };
}

/** The bytes of lines joined by LF. */
export function joinedBytes(lineBytes: readonly number[]): number {
  return lineBytes.reduce((total, bytes) => total + bytes, 0) + Math.max(0, lineBytes.length - 1);
}

function fault(
  file: { readonly group: ContextPathGroup; readonly path: string },
  kind: WorkshopResourceFileFault,
  error: string,
  metadata: Readonly<Record<string, unknown>>
): WorkshopResourceFaultedFile {
  return { kind: 'fault', group: file.group, path: file.path, fault: kind, error, metadata: { group: file.group, path: file.path, ...metadata } };
}
