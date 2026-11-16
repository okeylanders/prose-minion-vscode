/**
 * How one `resource.read` spends its bytes (ADR 2026-11-14 D2a, D5): fair
 * shares of the limit by each file's selected window, then whole lines
 * within each share. Pure.
 *
 * - A line is never cut. A file whose first selected line is longer than
 *   its share delivers nothing: its outcome is `line-too-long`.
 * - A file that stops before its selected window's end is `truncated`.
 * - A file that needs less than an equal share leaves the rest to the
 *   others (reads/WorkshopReadShares).
 */

import { allocateWorkshopReadShares } from '@/application/services/workshop/reads/WorkshopReadShares';
import type {
  WorkshopResourceFaultedFile,
  WorkshopResourcePreparedFile,
  WorkshopResourceReadyFile
} from './WorkshopResourceReadFiles';

/** What set a read's byte limit; reported in metadata and, when it cut the read, in the text. */
export type WorkshopResourceReadLimitSource = 'read-budget' | 'per-turn-total' | 'context-window';

export interface WorkshopResourceReadLimit {
  readonly bytes: number;
  readonly by: WorkshopResourceReadLimitSource;
}

export interface WorkshopResourceDeliveredFile {
  readonly kind: 'read';
  readonly file: WorkshopResourceReadyFile;
  readonly share: number;
  /** The last line delivered, 1-based and inclusive. */
  readonly endLine: number;
  /** The delivered lines' UTF-8 bytes, joined by LF. */
  readonly bytes: number;
  /** Stopped before the selected window's end. */
  readonly truncated: boolean;
}

export interface WorkshopResourceLongLineFile {
  readonly kind: 'line-too-long';
  readonly file: WorkshopResourceReadyFile;
  readonly share: number;
  /** The line that did not fit: the selected window's first. */
  readonly line: number;
  readonly lineBytes: number;
}

export type WorkshopResourcePlannedFile =
  | WorkshopResourceDeliveredFile
  | WorkshopResourceLongLineFile
  | { readonly kind: 'fault'; readonly file: WorkshopResourceFaultedFile };

export interface WorkshopResourceReadPlan {
  readonly limit: WorkshopResourceReadLimit;
  /** One entry per file named, in the order named. */
  readonly files: readonly WorkshopResourcePlannedFile[];
  /** All delivered files' bytes together. */
  readonly deliveredBytes: number;
  /** The limit cut a file short or kept a line out. */
  readonly limited: boolean;
}

/**
 * The least a read of these files needs: `minimumBytes` for each file that
 * can be read, or the file's whole selected window when that is smaller.
 * When a limit holds it, every share that falls short of its file's window
 * is at least `minimumBytes`.
 */
export function workshopResourceReadMinimumBytes(
  files: readonly WorkshopResourcePreparedFile[],
  minimumBytes: number
): number {
  return files.reduce((total, file) => total + (file.kind === 'ready' ? Math.min(file.windowBytes, minimumBytes) : 0), 0);
}

export function planWorkshopResourceRead(
  files: readonly WorkshopResourcePreparedFile[],
  limit: WorkshopResourceReadLimit
): WorkshopResourceReadPlan {
  const ready = files.flatMap(file => (file.kind === 'ready' ? [file] : []));
  const shares = allocateWorkshopReadShares(limit.bytes, ready.map(file => file.windowBytes));
  const shareOf = new Map(ready.map((file, index) => [file, shares[index]]));
  const planned = files.map((file): WorkshopResourcePlannedFile =>
    file.kind === 'ready' ? packWholeLines(file, shareOf.get(file)!) : { kind: 'fault', file });
  return {
    limit,
    files: planned,
    deliveredBytes: planned.reduce((total, file) => total + (file.kind === 'read' ? file.bytes : 0), 0),
    limited: planned.some(file => file.kind === 'line-too-long' || (file.kind === 'read' && file.truncated))
  };
}

/** As many whole lines of the selected window as the share holds, from its first. */
function packWholeLines(file: WorkshopResourceReadyFile, share: number): WorkshopResourceDeliveredFile | WorkshopResourceLongLineFile {
  let bytes = 0;
  let count = 0;
  for (const lineBytes of file.lineBytes) {
    const next = bytes + lineBytes + (count > 0 ? 1 : 0);
    if (next > share) {
      break;
    }
    bytes = next;
    count += 1;
  }
  if (count === 0) {
    return { kind: 'line-too-long', file, share, line: file.startLine, lineBytes: file.lineBytes[0] };
  }
  const endLine = file.startLine + count - 1;
  return { kind: 'read', file, share, endLine, bytes, truncated: endLine < file.selectedEndLine };
}
