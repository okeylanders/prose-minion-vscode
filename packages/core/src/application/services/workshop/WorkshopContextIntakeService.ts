import {
  ContextResourceProvider,
  ContextResourceProviderFactory,
  ContextResourceSummary,
  DEFAULT_CONTEXT_GROUPS
} from '@/domain/models/ContextGeneration';
import { FileSystem, FileType, Workspace } from '@/platform';
import { WorkshopConfiguredResourceRef, WorkshopExcerptSource } from '@messages';
import { countWords, trimToWordLimit } from '@/utils/textUtils';
import { createHash } from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import * as path from 'path';

export interface WorkshopConfiguredResourceBounds {
  maxBytes: number;
  maxWords: number;
}

export interface WorkshopBoundedConfiguredResource {
  summary: ContextResourceSummary;
  text: string;
  words: number;
  sourceFingerprint: string;
  truncation?: { keptWords: number; totalWords: number };
}

export interface WorkshopBoundedText {
  text: string;
  words: number;
  truncation?: { keptWords: number; totalWords: number };
}

export interface WorkshopIntakeRefusal {
  reason: 'not-file' | 'too-large' | 'inspect-failed' | 'read-failed' | 'decode-failed' | 'empty';
  message: string;
  details?: string;
}

export interface WorkshopLoadedFile extends WorkshopBoundedText {
  sourceFingerprint: string;
}

export type WorkshopFileLoadResult =
  | { kind: 'loaded'; file: WorkshopLoadedFile }
  | { kind: 'refused'; refusal: WorkshopIntakeRefusal };

export interface WorkshopConfiguredResourceRefusal {
  message: string;
  details?: string;
}

export type WorkshopConfiguredSourceMatch =
  | { kind: 'manual'; source: WorkshopExcerptSource }
  | {
      kind: 'matched';
      source: WorkshopExcerptSource;
      configuredResource: WorkshopConfiguredResourceRef;
    }
  | { kind: 'unmatched'; source: WorkshopExcerptSource }
  | { kind: 'ambiguous'; source: WorkshopExcerptSource; matchCount: number }
  | { kind: 'uri-unreadable'; source: WorkshopExcerptSource; details: string }
  | { kind: 'catalog-unreadable'; source: WorkshopExcerptSource; details: string };

export type WorkshopExcerptRereadAuthorization =
  | {
      kind: 'authorized';
      fsPath: string;
      source: Extract<WorkshopExcerptSource, { kind: 'file' }>;
    }
  | { kind: 'refused'; message: string; details?: string };

interface WorkshopConfiguredSourceResolution {
  match: WorkshopConfiguredSourceMatch;
  pathMatch?: 'exact' | 'case-folded';
}

export type WorkshopConfiguredResourceLoadResult =
  | { kind: 'loaded'; resource: WorkshopBoundedConfiguredResource }
  | { kind: 'missing' }
  | { kind: 'too-large'; summary: ContextResourceSummary }
  | { kind: 'empty'; summary: ContextResourceSummary }
  | { kind: 'unreadable'; summary: ContextResourceSummary; details: string };

const isAbsolutePath = (filePath: string): boolean =>
  filePath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\');

const isPathWithinRoot = (root: string, candidate: string): boolean => {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  if (resolvedCandidate === resolvedRoot) {
    return true;
  }
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
};

const baseName = (filePath: string): string =>
  filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;

const workspaceRelativeSegments = (displayPath: string): string[] | undefined => {
  if (
    displayPath.length === 0
    || displayPath.startsWith('External file: ')
    || displayPath.includes('\0')
    || isAbsolutePath(displayPath)
  ) {
    return undefined;
  }
  const segments = displayPath.split(/[\\/]/);
  return segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')
    ? undefined
    : segments;
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kib = bytes / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KiB`;
  }
  return `${(kib / 1024).toFixed(1)} MiB`;
};

const boundText = (
  content: string,
  maxWords: number,
  knownTotalWords?: number
): WorkshopBoundedText => {
  const measuredWords = countWords(content);
  const totalWords = knownTotalWords ?? measuredWords;
  if (totalWords <= maxWords && measuredWords <= maxWords) {
    return { text: content, words: measuredWords };
  }
  const trimmed = trimToWordLimit(content, maxWords);
  return {
    text: trimmed.trimmed,
    words: trimmed.trimmedWords,
    truncation: { keptWords: trimmed.trimmedWords, totalWords }
  };
};

/**
 * Per-interaction configured-resource catalog. It deliberately snapshots fresh
 * provider metadata: the workspace has no invalidation port, so a cross-click
 * cache would serve stale paths, sizes, or symlink checks after writer edits.
 */
export class WorkshopContextIntakeCatalog {
  private readonly entriesByKey = new Map<string, ContextResourceSummary>();

  constructor(
    private readonly provider: ContextResourceProvider
  ) {
    for (const entry of provider.listResources()) {
      this.entriesByKey.set(this.key(entry), entry);
    }
  }

  entries(): ContextResourceSummary[] {
    return [...this.entriesByKey.values()];
  }

  find(ref: WorkshopConfiguredResourceRef): ContextResourceSummary | undefined {
    return this.entriesByKey.get(this.key(ref));
  }

  async load(
    ref: WorkshopConfiguredResourceRef,
    bounds: WorkshopConfiguredResourceBounds
  ): Promise<WorkshopConfiguredResourceLoadResult> {
    const summary = this.find(ref);
    if (!summary) {
      return { kind: 'missing' };
    }
    if (summary.sizeBytes > bounds.maxBytes) {
      return { kind: 'too-large', summary };
    }

    let content: string | undefined;
    try {
      content = (await this.provider.loadResources([summary.path]))
        .find((entry) => entry.group === summary.group && entry.path === summary.path)
        ?.content;
    } catch (error) {
      return {
        kind: 'unreadable',
        summary,
        details: error instanceof Error ? error.message : String(error)
      };
    }
    if (!content || content.trim().length === 0) {
      return { kind: 'empty', summary };
    }

    const sourceFingerprint = createHash('sha256').update(content).digest('hex');
    const bounded = boundText(content, bounds.maxWords);
    if (!bounded.truncation) {
      return {
        kind: 'loaded',
        resource: { summary, text: bounded.text, words: bounded.words, sourceFingerprint }
      };
    }
    return {
      kind: 'loaded',
      resource: {
        summary,
        text: bounded.text,
        words: bounded.words,
        sourceFingerprint,
        truncation: bounded.truncation
      }
    };
  }

  private key(ref: WorkshopConfiguredResourceRef): string {
    return `${ref.group}\u0000${ref.path}`;
  }
}

/** Application seam for Workshop's configured-resource intake flows. */
export class WorkshopContextIntakeService {
  constructor(
    private readonly providerFactory: ContextResourceProviderFactory,
    private readonly fileSystem: FileSystem,
    private readonly workspace: Workspace
  ) {}

  async openCatalog(): Promise<WorkshopContextIntakeCatalog> {
    const provider = await this.providerFactory.createProvider([...DEFAULT_CONTEXT_GROUPS]);
    return new WorkshopContextIntakeCatalog(provider);
  }

  toDisplayPath(filePath: string): string {
    const relativePath = this.workspace.asRelativePath(filePath);
    if (relativePath === filePath || isAbsolutePath(relativePath)) {
      return `External file: ${baseName(filePath)}`;
    }
    return relativePath;
  }

  boundText(content: string, maxWords: number, knownTotalWords?: number): WorkshopBoundedText {
    return boundText(content, maxWords, knownTotalWords);
  }

  async loadFile(
    fsPath: string,
    displayPath: string,
    bounds: WorkshopConfiguredResourceBounds,
    use: 'attach' | 'pin'
  ): Promise<WorkshopFileLoadResult> {
    try {
      const stat = await this.fileSystem.stat(fsPath);
      if (stat.type !== FileType.File) {
        return {
          kind: 'refused',
          refusal: {
            reason: 'not-file',
            message: 'The selected path is not a file.',
            details: displayPath
          }
        };
      }
      if (stat.size > bounds.maxBytes) {
        return {
          kind: 'refused',
          refusal: {
            reason: 'too-large',
            message: `That file is too large to ${use} safely (max ${formatBytes(bounds.maxBytes)}).`,
            details: `${displayPath} is ${formatBytes(stat.size)}`
          }
        };
      }
    } catch (error) {
      return {
        kind: 'refused',
        refusal: {
          reason: 'inspect-failed',
          message: 'Could not inspect the selected file.',
          details: `${displayPath}: ${error instanceof Error ? error.message : String(error)}`
        }
      };
    }

    let raw: Uint8Array;
    try {
      raw = await this.fileSystem.readFile(fsPath);
    } catch (error) {
      return {
        kind: 'refused',
        refusal: {
          reason: 'read-failed',
          message: 'Could not read the selected file.',
          details: `${displayPath}: ${error instanceof Error ? error.message : String(error)}`
        }
      };
    }

    let content: string;
    try {
      content = Buffer.from(raw).toString('utf8');
    } catch (error) {
      return {
        kind: 'refused',
        refusal: {
          reason: 'decode-failed',
          // Context intake historically grouped decode failures with reads.
          message: use === 'pin'
            ? 'Could not decode the selected file as UTF-8.'
            : 'Could not read the selected file.',
          details: `${displayPath}: ${error instanceof Error ? error.message : String(error)}`
        }
      };
    }

    if (content.trim().length === 0) {
      return {
        kind: 'refused',
        refusal: {
          reason: 'empty',
          message: `That file is empty — nothing to ${use}.`,
          details: displayPath
        }
      };
    }

    return {
      kind: 'loaded',
      file: {
        ...boundText(content, bounds.maxWords),
        sourceFingerprint: createHash('sha256').update(raw).digest('hex')
      }
    };
  }

  describeConfiguredResourceFailure(
    result: WorkshopConfiguredResourceLoadResult,
    action: string,
    maxBytes: number
  ): WorkshopConfiguredResourceRefusal | undefined {
    switch (result.kind) {
      case 'loaded':
        return undefined;
      case 'missing':
        return { message: 'That resource is no longer in the configured catalog.' };
      case 'too-large':
        return {
          message: `That file is too large to ${action} safely (max ${formatBytes(maxBytes)}).`,
          details: `${result.summary.path} is ${formatBytes(result.summary.sizeBytes)}`
        };
      case 'empty':
        return {
          message: `That resource is empty — nothing to ${action}.`,
          details: result.summary.path
        };
      case 'unreadable':
        return {
          message: `Could not read the selected resource to ${action}.`,
          details: `${result.summary.path}: ${result.details}`
        };
    }
  }

  reportConfiguredResourceLoadFailure(
    result: WorkshopConfiguredResourceLoadResult,
    action: string,
    maxBytes: number,
    reportError: (message: string, details?: string) => void
  ): result is Extract<WorkshopConfiguredResourceLoadResult, { kind: 'loaded' }> {
    const refusal = this.describeConfiguredResourceFailure(result, action, maxBytes);
    if (!refusal) {
      return true;
    }
    reportError(refusal.message, refusal.details);
    return false;
  }

  /**
   * Re-derive authority for a persisted file source before any direct disk
   * read. An explicit picker may initially admit an external file, but a later
   * webview replay is trusted only when the current host proves the path is in
   * an open workspace or exactly names a fresh configured-catalog resource.
   */
  async authorizeExcerptReread(
    source: Extract<WorkshopExcerptSource, { kind: 'file' }>
  ): Promise<WorkshopExcerptRereadAuthorization> {
    let fsPath: string;
    try {
      fsPath = path.normalize(fileURLToPath(source.sourceUri));
    } catch (error) {
      return {
        kind: 'refused',
        message: 'The excerpt’s source location is no longer readable.',
        details: error instanceof Error ? error.message : String(error)
      };
    }

    const resolution = await this.resolveConfiguredSource(source);
    const workspaceRoot = this.workspace.workspaceFolders()
      .find((folder) => isPathWithinRoot(folder.path, fsPath));
    if (workspaceRoot) {
      const refusal = await this.validateWorkspaceRereadPath(workspaceRoot.path, fsPath, source);
      if (refusal) {
        return refusal;
      }
      return {
        kind: 'authorized',
        fsPath,
        source: resolution.match.source as Extract<WorkshopExcerptSource, { kind: 'file' }>
      };
    }

    // Windows paths are case-insensitive by platform convention. On every
    // other host, only the exact catalog path can authorize an external read.
    if (
      resolution.match.kind === 'matched' &&
      (resolution.pathMatch === 'exact' ||
        (process.platform === 'win32' && resolution.pathMatch === 'case-folded'))
    ) {
      return {
        kind: 'authorized',
        fsPath,
        source: resolution.match.source as Extract<WorkshopExcerptSource, { kind: 'file' }>
      };
    }

    const workspaceRecovery = await this.recoverWorkspaceExcerptSource(source);
    if (workspaceRecovery) {
      return workspaceRecovery;
    }

    return {
      kind: 'refused',
      message: 'That excerpt source is outside the approved workspace and configured-resource boundaries.',
      details: source.relativePath
    };
  }

  /**
   * Recover a workspace file after its persisted absolute URI became stale
   * (for example, when a saved session is opened on another computer).
   * `relativePath` proposes the target but never authorizes it: recovery is
   * available only with one open root, lexical containment, and the same
   * no-symbolic-link filesystem proof used by an unchanged absolute URI.
   */
  private async recoverWorkspaceExcerptSource(
    source: Extract<WorkshopExcerptSource, { kind: 'file' }>
  ): Promise<WorkshopExcerptRereadAuthorization | undefined> {
    const segments = workspaceRelativeSegments(source.relativePath);
    if (!segments) {
      return undefined;
    }
    const workspaceFolders = this.workspace.workspaceFolders();
    if (workspaceFolders.length === 0) {
      return undefined;
    }
    if (workspaceFolders.length > 1) {
      return {
        kind: 'refused',
        message: 'The excerpt source cannot be safely reconnected while more than one workspace folder is open.',
        details: source.relativePath
      };
    }

    const root = workspaceFolders[0].path;
    const candidate = path.resolve(root, ...segments);
    if (!isPathWithinRoot(root, candidate)) {
      return undefined;
    }
    const refusal = await this.validateWorkspaceRereadPath(root, candidate, source);
    if (refusal) {
      return refusal;
    }

    const reboundSource: Extract<WorkshopExcerptSource, { kind: 'file' }> = {
      kind: 'file',
      sourceUri: pathToFileURL(candidate).toString(),
      relativePath: source.relativePath
    };
    const reboundResolution = await this.resolveConfiguredSource(reboundSource);
    return {
      kind: 'authorized',
      fsPath: candidate,
      source: reboundResolution.match.source as Extract<WorkshopExcerptSource, { kind: 'file' }>
    };
  }

  async matchConfiguredSource(source: WorkshopExcerptSource): Promise<WorkshopConfiguredSourceMatch> {
    return (await this.resolveConfiguredSource(source)).match;
  }

  private async resolveConfiguredSource(
    source: WorkshopExcerptSource
  ): Promise<WorkshopConfiguredSourceResolution> {
    if (source.kind === 'manual') {
      return { match: { kind: 'manual', source } };
    }
    const unstamped: Extract<WorkshopExcerptSource, { kind: 'editor-selection' | 'file' }> =
      source.kind === 'file'
        ? { kind: 'file', sourceUri: source.sourceUri, relativePath: source.relativePath }
        : {
            kind: 'editor-selection',
            sourceUri: source.sourceUri,
            relativePath: source.relativePath,
            ...(source.startLine !== undefined && source.endLine !== undefined
              ? { startLine: source.startLine, endLine: source.endLine }
              : {})
          };
    let fsPath: string;
    try {
      fsPath = path.normalize(fileURLToPath(source.sourceUri));
    } catch (error) {
      return {
        match: {
          kind: 'uri-unreadable',
          source: unstamped,
          details: error instanceof Error ? error.message : String(error)
        }
      };
    }
    let summaries: ContextResourceSummary[];
    try {
      summaries = (await this.openCatalog()).entries();
    } catch (error) {
      return {
        match: {
          kind: 'catalog-unreadable',
          source: unstamped,
          details: error instanceof Error ? error.message : String(error)
        }
      };
    }
    const exact = summaries.filter((summary) => path.normalize(summary.absolutePath) === fsPath);
    const matches = exact.length > 0
      ? exact
      : summaries.filter(
          (summary) => path.normalize(summary.absolutePath).toLowerCase() === fsPath.toLowerCase()
        );
    if (matches.length === 0) {
      return { match: { kind: 'unmatched', source: unstamped } };
    }
    if (matches.length > 1) {
      return {
        match: { kind: 'ambiguous', source: unstamped, matchCount: matches.length }
      };
    }
    const summary = matches[0];
    const configuredResource = { group: summary.group, path: summary.path };
    return {
      pathMatch: exact.length > 0 ? 'exact' : 'case-folded',
      match: {
        kind: 'matched',
        configuredResource,
        source: {
          ...unstamped,
          configuredResource
        }
      }
    };
  }

  private async validateWorkspaceRereadPath(
    root: string,
    candidate: string,
    source: Extract<WorkshopExcerptSource, { kind: 'file' }>
  ): Promise<Extract<WorkshopExcerptRereadAuthorization, { kind: 'refused' }> | undefined> {
    const relativePath = path.relative(root, candidate);
    let currentPath = root;
    for (const segment of relativePath.split(path.sep).filter(Boolean)) {
      currentPath = path.join(currentPath, segment);
      try {
        const stat = await this.fileSystem.stat(currentPath);
        if ((stat.type & FileType.SymbolicLink) !== 0) {
          return {
            kind: 'refused',
            message: 'The excerpt source cannot be re-read through a symbolic link.',
            details: source.relativePath
          };
        }
      } catch (error) {
        return {
          kind: 'refused',
          message: 'Could not verify the excerpt source before re-reading it.',
          details: `${source.relativePath}: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
    return undefined;
  }
}
