/**
 * Fakes for persona file edits: a candidate reader, a workspace with roots,
 * a file system that knows symbolic links, and the room's excerpt. Paths
 * and text are *Alice*.
 */
import { pathToFileURL } from 'url';
import type { ContextResourceCandidate } from '@/domain/models/ContextGeneration';
import type { FileEditExcerptPort } from '@/application/services/fileEdits/fileEditIdentity';
import { FileType, type FileStat } from '@/platform/FileSystem';
import type { LogSink } from '@/platform/LogSink';
import type { ContextPathGroup } from '@shared/types/context';

export const ROOT = '/workspace';

export function candidate(group: ContextPathGroup, relativePath: string, root = ROOT, overrides: Partial<ContextResourceCandidate> = {}): ContextResourceCandidate {
  return { group, relativePath, workspaceFolderPath: root, absolutePath: `${root}/${relativePath}`, sizeBytes: 100, ...overrides };
}

export const uriOf = (absolutePath: string) => pathToFileURL(absolutePath).toString();

export interface HostFakes {
  candidates: ContextResourceCandidate[];
  roots: string[];
  /** Absolute paths with a symbolic link on the way. */
  linked: Set<string>;
  files: Record<string, string>;
  excerpt?: { fsPath: string; relativePath: string };
  log: string[];
}

export function hostFakes(overrides: Partial<HostFakes> = {}): HostFakes {
  return { candidates: [], roots: [ROOT], linked: new Set(), files: {}, log: [], ...overrides };
}

export function ports(fakes: HostFakes) {
  const excerpt: FileEditExcerptPort = { currentDocument: async () => fakes.excerpt };
  const log: LogSink = { appendLine: (line) => fakes.log.push(line), show: () => undefined, clear: () => undefined };
  return {
    candidates: { listCandidates: async () => [...fakes.candidates] },
    excerpt,
    workspace: { workspaceFolders: () => fakes.roots.map((root) => ({ path: root, name: root })) },
    fileSystem: {
      stat: async (filePath: string): Promise<FileStat> => ({
        type: fakes.linked.has(filePath) ? FileType.SymbolicLink : FileType.File, size: 0, ctime: 0, mtime: 0
      }),
      readFile: async (filePath: string) => {
        if (!(filePath in fakes.files)) {
          throw new Error('missing');
        }
        return new TextEncoder().encode(fakes.files[filePath]);
      }
    },
    log
  };
}

/** Every log line, checked for the writer's text, a path or a URI. */
export function expectNoLeaks(log: readonly string[], ...secrets: string[]): void {
  for (const line of log) {
    expect(line).not.toMatch(/file:|\/workspace|\/elsewhere|\.md\b/);
    for (const secret of secrets) {
      expect(line).not.toContain(secret);
    }
  }
}
