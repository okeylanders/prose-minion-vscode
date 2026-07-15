/**
 * Context Resource Resolver - Infrastructure Layer
 * Discovers and loads workspace files for the context assistant.
 */

import { FileSystem, FileType, LogSink, SettingsStore, Workspace } from '@/platform';
import * as path from 'path';
import { ContextPathGroup } from '@shared/types';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';
import {
  ContextResourceContent,
  ContextResourceProviderFactory,
  ContextResourceProvider,
  ContextResourceSummary
} from '@/domain/models/ContextGeneration';

interface InternalContextResource {
  group: ContextPathGroup;
  path: string;
  label: string;
  workspaceFolder?: string;
  absolutePath: string;
}

/**
 * Provides access to project reference materials based on user-configured glob patterns.
 */
export class ContextResourceResolver implements ContextResourceProviderFactory {
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
              '[ContextResourceResolver] Resource request did not match the configured catalog.'
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

  private async collectResources(groups: ContextPathGroup[]): Promise<InternalContextResource[]> {
    const workspaceFolders = this.workspace.workspaceFolders();
    if (workspaceFolders.length === 0) {
      this.outputChannel?.appendLine('[ContextResourceResolver] No workspace folders found.');
      return [];
    }

    const resources: InternalContextResource[] = [];
    const seenPaths = new Set<string>();

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
            const message = error instanceof Error ? error.message : String(error);
            this.outputChannel?.appendLine(
              `[ContextResourceResolver] Error searching with pattern "${normalizedPattern}": ${message}`
            );
            continue;
          }

          for (const match of matches) {
            if (!await this.isSafeWorkspaceResource(workspaceFolder.path, match)) {
              continue;
            }

            const relativePath = path.relative(workspaceFolder.path, match).replace(/\\/g, '/');
            const normalizedKey = this.normalizeKey(relativePath);

            if (seenPaths.has(normalizedKey)) {
              continue;
            }

            if (!this.isSupportedFile(match)) {
              continue;
            }

            seenPaths.add(normalizedKey);

            resources.push({
              group,
              path: relativePath,
              label: this.deriveLabel(match),
              workspaceFolder: workspaceFolder.name,
              absolutePath: match
            });
          }
        }
      }
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
  private async isSafeWorkspaceResource(root: string, candidate: string): Promise<boolean> {
    if (!isPathWithinRoot(root, candidate)) {
      this.outputChannel?.appendLine(
        '[ContextResourceResolver] Skipped a configured-resource match outside its workspace root.'
      );
      return false;
    }

    const relativePath = path.relative(root, candidate);
    let currentPath = root;
    for (const segment of relativePath.split(path.sep).filter(Boolean)) {
      currentPath = path.join(currentPath, segment);
      try {
        const stat = await this.fileSystem.stat(currentPath);
        if ((stat.type & FileType.SymbolicLink) !== 0) {
          this.outputChannel?.appendLine(
            `[ContextResourceResolver] Skipped symbolic-link resource: ${relativePath.replace(/\\/g, '/')}`
          );
          return false;
        }
      } catch {
        this.outputChannel?.appendLine(
          `[ContextResourceResolver] Skipped unreadable configured resource: ${relativePath.replace(/\\/g, '/')}`
        );
        return false;
      }
    }
    return true;
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
