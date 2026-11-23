/**
 * Which file a `history.*` call reads (ADR 2026-11-19 D11): only a file a
 * persona can already read, never a free path.
 *
 * - **The excerpt's file,** authorized exactly as "Re-read from file"
 *   authorizes it (`authorizeExcerptReread`: inside an open workspace
 *   folder, or an exact configured resource, with no symbolic link). A
 *   selection excerpt names its document the same way. A pasted excerpt
 *   has no file, and is refused in words.
 * - **A configured file,** named by group and path through
 *   `resolveConfiguredResource`, the rule `resource.read` uses: the file
 *   the group's authoritative listing names, through its browse entry (ADR
 *   2026-11-20 S50).
 *
 * The host path a file resolves to is host-side only: it reaches the
 * platform's ports, never a result, a card or a log.
 */

import type { WorkshopExcerpt } from '@messages';
import type { ContextResourceSummary } from '@/domain/models/ContextGeneration';
import type { WorkshopHistoryFile } from '@shared/types/workshopCapabilities';
import type { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import { resolveConfiguredResource, type ConfiguredResourceGroupFiles } from '@/application/services/ConfiguredResourceLookup';

/** The room's excerpt file, as the history family may read it. */
export type WorkshopHistoryExcerptFile =
  | { readonly kind: 'file'; readonly fsPath: string; readonly relativePath: string }
  | { readonly kind: 'none' }
  | { readonly kind: 'pasted' }
  | { readonly kind: 'unreadable' };

export interface WorkshopHistoryExcerptPort {
  excerptFile(): Promise<WorkshopHistoryExcerptFile>;
}

/** The excerpt port over the live session and the intake's own authorization. Built in `extension.ts`. */
export function workshopHistoryExcerptFile(
  session: { getExcerpt(): WorkshopExcerpt | undefined },
  intake: Pick<WorkshopContextIntakeService, 'authorizeExcerptReread'>
): WorkshopHistoryExcerptPort {
  return {
    excerptFile: async () => {
      const source = session.getExcerpt()?.source;
      if (!source) {
        return { kind: 'none' };
      }
      if (source.kind === 'manual') {
        return { kind: 'pasted' };
      }
      try {
        const authorization = await intake.authorizeExcerptReread({
          kind: 'file',
          sourceUri: source.sourceUri,
          relativePath: source.relativePath
        });
        return authorization.kind === 'authorized'
          ? { kind: 'file', fsPath: authorization.fsPath, relativePath: source.relativePath }
          : { kind: 'unreadable' };
      } catch {
        return { kind: 'unreadable' };
      }
    }
  };
}

/** A resolved file: where the host reads it, and how a result names it. */
export interface WorkshopHistoryResolvedFile {
  readonly kind: 'resolved';
  /** HOST-SIDE ONLY. */
  readonly fsPath: string;
  readonly label: string;
  /** The file as a written call names it: the excerpt, or the canonical configured path. */
  readonly callFile: WorkshopHistoryFile;
  /** The saved file's size, when the catalog knows it. */
  readonly sizeBytes?: number;
}

export type WorkshopHistoryFileFault =
  | 'no-excerpt'
  | 'pasted-excerpt'
  | 'excerpt-unreadable'
  | 'not-configured'
  | 'ambiguous-path';

export type WorkshopHistoryFileResolution =
  | WorkshopHistoryResolvedFile
  | { readonly kind: 'fault'; readonly fault: WorkshopHistoryFileFault };

export async function resolveWorkshopHistoryFile(
  file: WorkshopHistoryFile,
  excerpt: WorkshopHistoryExcerptPort,
  resources: () => Promise<readonly ContextResourceSummary[]>,
  groupFiles: ConfiguredResourceGroupFiles
): Promise<WorkshopHistoryFileResolution> {
  if (file.kind === 'excerpt') {
    const found = await excerpt.excerptFile();
    switch (found.kind) {
      case 'file':
        return { kind: 'resolved', fsPath: found.fsPath, label: found.relativePath, callFile: file };
      case 'none':
        return { kind: 'fault', fault: 'no-excerpt' };
      case 'pasted':
        return { kind: 'fault', fault: 'pasted-excerpt' };
      case 'unreadable':
        return { kind: 'fault', fault: 'excerpt-unreadable' };
      default:
        return assertNever(found);
    }
  }
  const lookup = await resolveConfiguredResource(await resources(), file.group, file.path, groupFiles);
  switch (lookup.kind) {
    case 'found':
      return {
        kind: 'resolved',
        fsPath: lookup.resource.absolutePath,
        label: lookup.resource.path,
        callFile: { kind: 'configured', group: lookup.resource.group, path: lookup.resource.path },
        sizeBytes: lookup.resource.sizeBytes
      };
    case 'missing':
      return { kind: 'fault', fault: 'not-configured' };
    case 'ambiguous':
      return { kind: 'fault', fault: 'ambiguous-path' };
    default:
      return assertNever(lookup);
  }
}

/** Why a file could not be named, in host words. */
export function workshopHistoryFileFaultLine(fault: WorkshopHistoryFileFault): string {
  switch (fault) {
    case 'no-excerpt':
      return 'This room has no excerpt, so <group>excerpt</group> names no file. Name a configured file by group and path.';
    case 'pasted-excerpt':
      return 'The room\'s excerpt was pasted, so it has no file and no history. Name a configured file by group and path.';
    case 'excerpt-unreadable':
      return 'The excerpt\'s file can no longer be read from the project, so its history cannot be read.';
    case 'not-configured':
      return 'The path is not one of the configured project files in that group. Take paths from resource.catalog, exactly as it lists them.';
    case 'ambiguous-path':
      return 'The path matches more than one configured file when letter case is ignored. Write it exactly as resource.catalog lists it.';
    default:
      return assertNever(fault);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled history file value: ${JSON.stringify(value)}`);
}
