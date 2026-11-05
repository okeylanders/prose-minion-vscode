/**
 * Context Resource Resolver - Infrastructure Layer
 * Discovers and loads workspace files for the context assistant.
 */

import { FileSystem, FileType, LogSink, SettingsStore, Workspace } from '@/platform';
import * as path from 'path';
import { ContextPathGroup } from '@shared/types';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';
import {
  ContextResourceCandidate,
  ContextResourceCandidateReader,
  ContextResourceContent,
  ContextResourceProviderFactory,
  ContextResourceProvider,
  ContextResourceSummary
} from '@/domain/models/ContextGeneration';

interface InternalContextResource {
  group: ContextPathGroup;
  path: string;
  label: string;
  sizeBytes: number;
  workspaceFolder?: string;
  absolutePath: string;
}

/**
 * The candidate read could not be completed (a search or a metadata read
 * failed). Its message names no pattern, path or host error (ADR 2026-11-05
 * D13).
 */
export class ContextCandidateReadIncomplete extends Error {
  constructor(readonly part: 'search' | 'metadata') {
    super(`The configured-resource candidate read is incomplete (${part}).`);
    this.name = 'ContextCandidateReadIncomplete';
  }
}

/**
 * Provides access to project reference materials based on user-configured glob patterns.
 */
export class ContextResourceResolver implements ContextResourceProviderFactory, ContextResourceCandidateReader {
  constructor(
    private readonly settings: SettingsStore,
    private readonly fileSystem: FileSystem,
    private readonly workspace: Workspace,
    private readonly outputChannel?: LogSink
  ) {}

  async createProvider(groups: ContextPathGroup[]): Promise<ContextResourceProvider> {
    const resources = await this.collectResources(groups);
    const summaries = resources.map(resource => this.toSummary(resource));
    const resourceMap = new Map<string, InternalContextResource>();

    for (const resource of resources) {
      const key = this.normalizeKey(resource.path);
      if (!resourceMap.has(key)) {
        resourceMap.set(key, resource);
      }
    }

    return {
      listResources: () => [...summaries],
      loadResources: async (paths: string[]): Promise<ContextResourceContent[]> => {
        const contents: ContextResourceContent[] = [];

        for (const requestedPath of paths) {
          const normalizedKey = this.normalizeKey(requestedPath);
          const resource = resourceMap.get(normalizedKey);

          if (!resource) {
            this.outputChannel?.appendLine(
              '[ContextResourceResolver] Resource request did not match the configured catalog; ' +
              `catalogSize=${resourceMap.size}.`
            );
            continue;
          }

          try {
            const raw = await this.fileSystem.readFile(resource.absolutePath);
            const content = Buffer.from(raw).toString('utf8');

            contents.push({
              group: resource.group,
              path: resource.path,
              label: resource.label,
              sizeBytes: resource.sizeBytes,
              absolutePath: resource.absolutePath,
              workspaceFolder: resource.workspaceFolder,
              content
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.outputChannel?.appendLine(
              `[ContextResourceResolver] Failed to read resource ${resource.path}: ${message}`
            );
          }
        }

        return contents;
      }
    };
  }

  /**
   * Every match, kept (ADR 2026-11-05 D4.1): each group, root and relative
   * path a supported file matches, with no first-root-wins dedupe. The same
   * containment and symbolic-link checks admit each one.
   *
   * **Authoritative, so it fails closed** (PR #229 F-01): a write proves a
   * target unique, and its class, from this read, so a search that fails for
   * any group, root or pattern, or a match whose metadata cannot be read,
   * rejects the whole read rather than returning part of it. It logs counts
   * only, never a pattern, path or host message (N-01). The catalog
   * (`createProvider`) keeps its tolerant, best-effort walk for browsing.
   */
  async listCandidates(groups: ContextPathGroup[]): Promise<ContextResourceCandidate[]> {
    const candidates: ContextResourceCandidate[] = [];
    let excluded = 0;
    await this.forEachMatch(groups, 'authoritative', (group, folder, match, sizeBytes) => {
      if (this.isSupportedFile(match)) {
        candidates.push({
          group,
          relativePath: path.relative(folder.path, match).replace(/\\/g, '/'),
          workspaceFolderPath: folder.path,
          absolutePath: match,
          sizeBytes
        });
      }
    }, () => {
      excluded += 1;
    });
    this.outputChannel?.appendLine(
      `[ContextResourceResolver] Candidate read: ${candidates.length} candidate(s), ${excluded} excluded match(es).`
    );
    return candidates;
  }

  /**
   * Every contained, symlink-free match, in group → root → pattern order.
   * `browse` (the catalog) logs and skips a failed search or an unreadable
   * match; `authoritative` (the candidate read) rejects on either, logging
   * nothing that names a pattern or path.
   */
  private async forEachMatch(
    groups: ContextPathGroup[],
    mode: 'browse' | 'authoritative',
    visit: (group: ContextPathGroup, folder: { path: string; name: string }, match: string, sizeBytes: number) => void,
    exclude: () => void = () => undefined
  ): Promise<boolean> {
    const workspaceFolders = this.workspace.workspaceFolders();
    if (workspaceFolders.length === 0) {
      if (mode === 'browse') {
        this.outputChannel?.appendLine('[ContextResourceResolver] No workspace folders found.');
      }
      return false;
    }

    for (const group of groups) {
      const patterns = this.getPatternsForGroup(group);
      if (patterns.length === 0) {
        continue;
      }

      for (const workspaceFolder of workspaceFolders) {
        for (const pattern of patterns) {
          const normalizedPattern = this.normalizePattern(pattern);
          if (!normalizedPattern) {
            continue;
          }

          const excludePattern = '{**/node_modules/**,**/.git/**,**/.svn/**,**/.hg/**,**/dist/**,**/out/**}';

          let matches: string[] = [];
          try {
            matches = await this.workspace.findFiles(workspaceFolder.path, normalizedPattern, excludePattern);
          } catch (error) {
            if (mode === 'authoritative') {
              throw new ContextCandidateReadIncomplete('search');
            }
            const message = error instanceof Error ? error.message : String(error);
            this.outputChannel?.appendLine(
              `[ContextResourceResolver] Error searching with pattern "${normalizedPattern}": ${message}`
            );
            continue;
          }

          for (const match of matches) {
            if (mode === 'browse') {
              const sizeBytes = await this.safeWorkspaceResourceSize(workspaceFolder.path, match);
              if (sizeBytes !== undefined) {
                visit(group, workspaceFolder, match, sizeBytes);
              }
              continue;
            }
            const inspected = await this.inspectWorkspaceResource(workspaceFolder.path, match);
            if (inspected.kind === 'unreadable') {
              throw new ContextCandidateReadIncomplete('metadata');
            }
            if (inspected.kind === 'ok') {
              visit(group, workspaceFolder, match, inspected.sizeBytes);
            } else {
              exclude();
            }
          }
        }
      }
    }
    return true;
  }

  private async collectResources(groups: ContextPathGroup[]): Promise<InternalContextResource[]> {
    const resources: InternalContextResource[] = [];
    const seenPaths = new Set<string>();

    const searched = await this.forEachMatch(groups, 'browse', (group, workspaceFolder, match, sizeBytes) => {
      const relativePath = path.relative(workspaceFolder.path, match).replace(/\\/g, '/');
      const normalizedKey = this.normalizeKey(relativePath);

      if (seenPaths.has(normalizedKey)) {
        return;
      }

      if (!this.isSupportedFile(match)) {
        return;
      }

      seenPaths.add(normalizedKey);

      resources.push({
        group,
        path: relativePath,
        label: this.deriveLabel(match),
        sizeBytes,
        workspaceFolder: workspaceFolder.name,
        absolutePath: match
      });
    });
    if (!searched) {
      return [];
    }

    // Sort results for stable ordering: group -> path
    resources.sort((a, b) => {
      if (a.group !== b.group) {
        return a.group.localeCompare(b.group);
      }
      return a.path.localeCompare(b.path);
    });

    this.outputChannel?.appendLine(
      `[ContextResourceResolver] Indexed ${resources.length} context resource(s) across ${groups.length} group(s).`
    );

    return resources;
  }

  private toSummary(resource: InternalContextResource): ContextResourceSummary {
    return {
      group: resource.group,
      path: resource.path,
      label: resource.label,
      sizeBytes: resource.sizeBytes,
      absolutePath: resource.absolutePath,
      workspaceFolder: resource.workspaceFolder
    };
  }

  private getPatternsForGroup(group: ContextPathGroup): string[] {
    const rawValue = this.settings.get<string>('proseMinion', `contextPaths.${group}`) || '';

    return rawValue
      .split(',')
      .map(pattern => pattern.trim())
      .filter(pattern => pattern.length > 0);
  }

  private normalizePattern(pattern: string): string {
    let normalized = pattern.trim();
    if (!normalized) {
      return '';
    }

    if (normalized.startsWith('./')) {
      normalized = normalized.slice(2);
    }

    normalized = normalized.replace(/^\/+/, '');
    normalized = normalized.replace(/^workspace:/i, '');

    // If the pattern doesn't contain a wildcard or directory separator, treat it as a filename
    if (!/[\*\?\[]/.test(normalized) && !normalized.includes('/')) {
      return `**/${normalized}`;
    }

    return normalized;
  }

  private normalizeKey(pathValue: string): string {
    return pathValue.trim().replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
  }

  private isSupportedFile(filePath: string): boolean {
    const extension = path.extname(filePath).toLowerCase();
    return extension === '.md' || extension === '.txt';
  }

  /**
   * `findFiles` is still an outer adapter result, not a trust boundary. Reject
   * lexical escapes and any symlink in the workspace-relative ancestor chain
   * before a model-visible key can enter the configured catalog.
   */
  private async safeWorkspaceResourceSize(root: string, candidate: string): Promise<number | undefined> {
    const inspected = await this.inspectWorkspaceResource(root, candidate);
    const relativePath = path.relative(root, candidate).replace(/\\/g, '/');
    switch (inspected.kind) {
      case 'ok':
        return inspected.sizeBytes;
      case 'outside':
        this.outputChannel?.appendLine(
          '[ContextResourceResolver] Skipped a configured-resource match outside its workspace root.'
        );
        return undefined;
      case 'link':
        this.outputChannel?.appendLine(`[ContextResourceResolver] Skipped symbolic-link resource: ${relativePath}`);
        return undefined;
      case 'unreadable':
        this.outputChannel?.appendLine(`[ContextResourceResolver] Skipped unreadable configured resource: ${relativePath}`);
        return undefined;
    }
  }

  /** The catalog's containment and symbolic-link checks, as a verdict: no logging, so each walk says what it may. */
  private async inspectWorkspaceResource(
    root: string,
    candidate: string
  ): Promise<{ kind: 'ok'; sizeBytes: number } | { kind: 'outside' | 'link' | 'unreadable' }> {
    if (!isPathWithinRoot(root, candidate)) {
      return { kind: 'outside' };
    }
    let currentPath = root;
    let sizeBytes = 0;
    for (const segment of path.relative(root, candidate).split(path.sep).filter(Boolean)) {
      currentPath = path.join(currentPath, segment);
      try {
        const stat = await this.fileSystem.stat(currentPath);
        sizeBytes = stat.size;
        if ((stat.type & FileType.SymbolicLink) !== 0) {
          return { kind: 'link' };
        }
      } catch {
        return { kind: 'unreadable' };
      }
    }
    return { kind: 'ok', sizeBytes };
  }

  private deriveLabel(filePath: string): string {
    const basename = path.basename(filePath, path.extname(filePath));
    return basename
      .replace(/[-_]+/g, ' ')
      .split(' ')
      .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }
}
