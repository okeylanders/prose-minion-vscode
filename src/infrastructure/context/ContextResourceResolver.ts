/**
 * Context Resource Resolver - Infrastructure Layer
 * Discovers and loads workspace files for the context assistant.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ContextPathGroup } from '../../shared/types';
import {
  ContextResourceContent,
  ContextResourceProvider,
  ContextResourceSummary
} from '../../domain/models/ContextGeneration';

interface InternalContextResource {
  group: ContextPathGroup;
  path: string;
  label: string;
  workspaceFolder?: string;
  uri: vscode.Uri;
}

/**
 * Provides access to project reference materials based on user-configured glob patterns.
 */
export class ContextResourceResolver {
  constructor(private readonly outputChannel?: vscode.OutputChannel) {}

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
            this.outputChannel?.appendLine(`[ContextResourceResolver] Resource not found for request: ${requestedPath}`);
            continue;
          }

          try {
            const raw = await vscode.workspace.fs.readFile(resource.uri);
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
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
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

          const includePattern = new vscode.RelativePattern(workspaceFolder, normalizedPattern);
          const excludePattern = '{**/node_modules/**,**/.git/**,**/.svn/**,**/.hg/**,**/dist/**,**/out/**}';

          let matches: vscode.Uri[] = [];
          try {
            matches = await vscode.workspace.findFiles(includePattern, excludePattern);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.outputChannel?.appendLine(
              `[ContextResourceResolver] Error searching with pattern "${normalizedPattern}": ${message}`
            );
            continue;
          }

          for (const match of matches) {
            const relativePath = vscode.workspace.asRelativePath(match, false);
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
              uri: match
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
    const config = vscode.workspace.getConfiguration('proseMinion');
    const rawValue = config.get<string>(`contextPaths.${group}`) || '';

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

  private isSupportedFile(uri: vscode.Uri): boolean {
    const extension = path.extname(uri.fsPath).toLowerCase();
    return extension === '.md' || extension === '.txt';
  }

  private deriveLabel(uri: vscode.Uri): string {
    const basename = path.basename(uri.fsPath, path.extname(uri.fsPath));
    return basename
      .replace(/[-_]+/g, ' ')
      .split(' ')
      .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }
}
