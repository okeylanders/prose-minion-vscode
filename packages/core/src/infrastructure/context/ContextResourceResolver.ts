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
import { distinctContextGroupFiles, hostFileIdentity } from '@/infrastructure/context/ContextGroupFiles';
import {
  contextResourceKey,
  contextResourceLabel,
  isContextResourceFile,
  normalizeContextPattern
} from '@/infrastructure/context/ContextResourcePaths';

type MatchMode = 'browse' | 'browse-counts' | 'authoritative' | 'check';

/** Patterns to check, per group, in the order they are written (ADR 2026-11-19 D22). */
export type ContextPatternsByGroup = Partial<Record<ContextPathGroup, readonly string[]>>;

/** One supported file a pattern matched. `key` identifies it across groups (root and case-folded path). */
export interface ContextPatternMatchFile {
  readonly key: string;
  /**
   * The file's host identity (`hostFileIdentity`), the same one a group's
   * listing gives (ADR 2026-11-20 S43): what a narrowed group is intersected
   * by. Host-side only, never shown or logged.
   */
  readonly identity: string;
  readonly workspaceFolder: string;
  readonly relativePath: string;
  /** The root's name, present only when several roots are open. */
  readonly rootName?: string;
}

export type ContextPatternMatch =
  | { readonly pattern: string; readonly status: 'matched'; readonly files: readonly ContextPatternMatchFile[] }
  | { readonly pattern: string; readonly status: 'unmatched' | 'incomplete' };

export type ContextPatternMatches = Partial<Record<ContextPathGroup, readonly ContextPatternMatch[]>>;

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

  /**
   * The same tolerant catalog, but its diagnostics carry counts only: no
   * pattern, path or host message (ADR 2026-11-05 D13; PR #229 N-01). For
   * lookups a file edit's staging or Apply reaches, such as the excerpt's
   * authorization. What the catalog lists is unchanged.
   */
  countsOnly(): ContextResourceProviderFactory {
    return { createProvider: (groups) => this.createProvider(groups, 'counts') };
  }

  async createProvider(groups: ContextPathGroup[], diagnostics: 'detailed' | 'counts' = 'detailed'): Promise<ContextResourceProvider> {
    const resources = await this.collectResources(groups, diagnostics);
    const summaries = resources.map(resource => this.toSummary(resource));
    const resourceMap = new Map<string, InternalContextResource>();

    for (const resource of resources) {
      const key = contextResourceKey(resource.path);
      if (!resourceMap.has(key)) {
        resourceMap.set(key, resource);
      }
    }

    return {
      listResources: () => [...summaries],
      loadResources: async (paths: string[]): Promise<ContextResourceContent[]> => {
        const contents: ContextResourceContent[] = [];

        for (const requestedPath of paths) {
          const normalizedKey = contextResourceKey(requestedPath);
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
            this.outputChannel?.appendLine(diagnostics === 'counts'
              ? '[ContextResourceResolver] Failed to read a configured resource.'
              : `[ContextResourceResolver] Failed to read resource ${resource.path}: ${message}`);
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
  async listCandidates(groups: ContextPathGroup[], patternsFor?: (group: ContextPathGroup) => readonly string[]): Promise<ContextResourceCandidate[]> {
    const candidates: ContextResourceCandidate[] = [];
    let excluded = 0;
    await this.forEachMatch(groups, 'authoritative', (group, folder, match, sizeBytes) => {
      if (isContextResourceFile(match)) {
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
    }, patternsFor);
    this.outputChannel?.appendLine(
      `[ContextResourceResolver] Candidate read: ${candidates.length} candidate(s), ${excluded} excluded match(es).`
    );
    return candidates;
  }

  /**
   * Every file of each group, root-aware, for a search (ADR 2026-11-20 D3a):
   * the authoritative candidate read, each file once per group it is in. A
   * failed scan rejects, never returning fewer files.
   */
  async listGroupFiles(groups: ContextPathGroup[]): Promise<ContextResourceCandidate[]> {
    return distinctContextGroupFiles(await this.listCandidates(groups));
  }

  /** The same authoritative walk over writer-typed patterns (D3): the caller has refused unsafe forms first. */
  async listPatternFiles(patterns: readonly string[]): Promise<ContextResourceCandidate[]> {
    return distinctContextGroupFiles(await this.listCandidates(['general'], () => patterns));
  }

  /** The workspace folders open now, the roots every listing here walks: a listing names a file's folder only when several are. */
  openWorkspaceFolders(): readonly { readonly path: string; readonly name: string }[] {
    return this.workspace.workspaceFolders();
  }

  /**
   * What the given patterns would match (ADR 2026-11-19 D22, D22a): the
   * catalog's own walk (normalization, roots, exclusions, the `.md`/`.txt`
   * rule, containment and the symbolic-link refusal), with the patterns
   * passed in rather than read from settings. Per group, one outcome per
   * pattern, in the order given: `matched` with its files, `unmatched` (every
   * search completed and found no supported file), or `incomplete` (a search
   * failed, or a match's metadata could not be read). An incomplete pattern
   * is never read as zero matches. `undefined` when no folder is open.
   *
   * Counts-only: it logs a count line, never a pattern, path or host message.
   * The settings path is untouched.
   */
  async matchPatterns(patternsByGroup: ContextPatternsByGroup): Promise<ContextPatternMatches | undefined> {
    const groups = (Object.keys(patternsByGroup) as ContextPathGroup[])
      .filter((group) => (patternsByGroup[group]?.length ?? 0) > 0);
    const tallies = new Map<ContextPathGroup, Map<string, { files: Map<string, ContextPatternMatchFile>; incomplete: boolean }>>();
    for (const group of groups) {
      tallies.set(group, new Map((patternsByGroup[group] ?? []).map((pattern) => [pattern, { files: new Map(), incomplete: false }])));
    }
    let failed = 0;
    let excluded = 0;
    const roots = this.workspace.workspaceFolders().length;
    const searched = await this.forEachMatch(groups, 'check', (group, folder, match, _sizeBytes, pattern) => {
      if (!isContextResourceFile(match)) {
        return;
      }
      const relativePath = path.relative(folder.path, match).replace(/\\/g, '/');
      const key = `${folder.path}\u0000${contextResourceKey(relativePath)}`;
      tallies.get(group)?.get(pattern)?.files.set(key, {
        key,
        identity: hostFileIdentity(match),
        workspaceFolder: folder.name,
        relativePath,
        ...(roots > 1 ? { rootName: folder.name } : {})
      });
    }, () => {
      excluded += 1;
    }, (group) => patternsByGroup[group] ?? [], (group, pattern) => {
      failed += 1;
      const tally = tallies.get(group)?.get(pattern);
      if (tally) {
        tally.incomplete = true;
      }
    });
    if (!searched) {
      return undefined;
    }
    const result: ContextPatternMatches = {};
    let matched = 0;
    for (const group of groups) {
      result[group] = (patternsByGroup[group] ?? []).map((pattern): ContextPatternMatch => {
        const tally = tallies.get(group)?.get(pattern);
        if (!tally || tally.incomplete) {
          return { pattern, status: 'incomplete' };
        }
        if (tally.files.size === 0) {
          return { pattern, status: 'unmatched' };
        }
        matched += tally.files.size;
        return { pattern, status: 'matched', files: [...tally.files.values()] };
      });
    }
    this.outputChannel?.appendLine(
      `[ContextResourceResolver] Pattern check: ${matched} match(es), ${excluded} excluded match(es), ${failed} incomplete read(s).`
    );
    return result;
  }

  /**
   * Every contained, symlink-free match, in group → root → pattern order.
   * `browse` (the catalog) logs and skips a failed search or an unreadable
   * match; `authoritative` (the candidate read) rejects on either, logging
   * nothing that names a pattern or path.
   */
  private async forEachMatch(
    groups: ContextPathGroup[],
    mode: MatchMode,
    visit: (group: ContextPathGroup, folder: { path: string; name: string }, match: string, sizeBytes: number, pattern: string) => void,
    exclude: () => void = () => undefined,
    patternsFor: (group: ContextPathGroup) => readonly string[] = (group) => this.getPatternsForGroup(group),
    incomplete: (group: ContextPathGroup, pattern: string) => void = () => undefined
  ): Promise<boolean> {
    const workspaceFolders = this.workspace.workspaceFolders();
    if (workspaceFolders.length === 0) {
      if (mode === 'browse') {
        this.outputChannel?.appendLine('[ContextResourceResolver] No workspace folders found.');
      }
      return false;
    }

    for (const group of groups) {
      const patterns = patternsFor(group);
      if (patterns.length === 0) {
        continue;
      }

      for (const workspaceFolder of workspaceFolders) {
        for (const pattern of patterns) {
          const normalizedPattern = normalizeContextPattern(pattern);
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
            if (mode === 'check') {
              incomplete(group, pattern);
              continue;
            }
            if (mode === 'browse-counts') {
              this.outputChannel?.appendLine('[ContextResourceResolver] A configured-resource search failed.');
              continue;
            }
            const message = error instanceof Error ? error.message : String(error);
            this.outputChannel?.appendLine(
              `[ContextResourceResolver] Error searching with pattern "${normalizedPattern}": ${message}`
            );
            continue;
          }

          for (const match of matches) {
            if (mode === 'browse' || mode === 'browse-counts') {
              const sizeBytes = await this.safeWorkspaceResourceSize(workspaceFolder.path, match, mode === 'browse');
              if (sizeBytes !== undefined) {
                visit(group, workspaceFolder, match, sizeBytes, pattern);
              }
              continue;
            }
            const inspected = await this.inspectWorkspaceResource(workspaceFolder.path, match);
            if (inspected.kind === 'unreadable') {
              if (mode === 'check') {
                incomplete(group, pattern);
                continue;
              }
              throw new ContextCandidateReadIncomplete('metadata');
            }
            if (inspected.kind === 'ok') {
              visit(group, workspaceFolder, match, inspected.sizeBytes, pattern);
            } else {
              exclude();
            }
          }
        }
      }
    }
    return true;
  }

  private async collectResources(groups: ContextPathGroup[], diagnostics: 'detailed' | 'counts'): Promise<InternalContextResource[]> {
    const resources: InternalContextResource[] = [];
    const seenPaths = new Set<string>();

    const searched = await this.forEachMatch(groups, diagnostics === 'counts' ? 'browse-counts' : 'browse', (group, workspaceFolder, match, sizeBytes) => {
      const relativePath = path.relative(workspaceFolder.path, match).replace(/\\/g, '/');
      const normalizedKey = contextResourceKey(relativePath);

      if (seenPaths.has(normalizedKey)) {
        return;
      }

      if (!isContextResourceFile(match)) {
        return;
      }

      seenPaths.add(normalizedKey);

      resources.push({
        group,
        path: relativePath,
        label: contextResourceLabel(match),
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

  /**
   * `findFiles` is still an outer adapter result, not a trust boundary. Reject
   * lexical escapes and any symlink in the workspace-relative ancestor chain
   * before a model-visible key can enter the configured catalog.
   */
  private async safeWorkspaceResourceSize(root: string, candidate: string, detailed = true): Promise<number | undefined> {
    const inspected = await this.inspectWorkspaceResource(root, candidate);
    const relativePath = path.relative(root, candidate).replace(/\\/g, '/');
    if (!detailed && inspected.kind !== 'ok') {
      this.outputChannel?.appendLine('[ContextResourceResolver] Skipped a configured-resource match.');
      return undefined;
    }
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
}
