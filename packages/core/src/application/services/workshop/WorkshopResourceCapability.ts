/** Bounded, allowlisted project-resource operations for one Workshop host turn. */

import {
  ContextResourceContent,
  ContextResourceProvider,
  ContextResourceProviderFactory,
  ContextResourceSummary,
  DEFAULT_CONTEXT_GROUPS
} from '@/domain/models/ContextGeneration';
import { LogSink } from '@/platform';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { ContextPathGroup, WorkshopPersonaId } from '@shared/types';
import {
  WorkshopCapabilityRequest,
  WorkshopCapabilityResult
} from '@shared/types/workshopCapabilities';
import { WorkshopResourceGroupAvailability } from './WorkshopCapabilityXmlCodec';

type ResourceRequest = Extract<WorkshopCapabilityRequest, {
  capability: 'resource.catalog' | 'resource.search' | 'resource.read';
}>;

interface ResourceSearchMatch {
  readonly group: ContextPathGroup;
  readonly path: string;
  readonly label: string;
  readonly source: 'catalog' | 'content';
  readonly line?: number;
  readonly context: string;
}

const CATALOG_SEARCH_STOP_WORDS = new Set([
  'a', 'about', 'an', 'and', 'chapter', 'chapters', 'character', 'characters',
  'file', 'files', 'for', 'guide', 'guides', 'info', 'information', 'location',
  'locations', 'md', 'note', 'notes', 'or', 'profile', 'profiles', 'project',
  'scene', 'scenes', 'sheet', 'sheets', 'the', 'txt'
]);

export interface WorkshopResourceTurnContext {
  readonly requestId: string;
  readonly personaId: WorkshopPersonaId;
  readonly signal: AbortSignal;
}

export class WorkshopResourceCapability {
  private providerPromise?: Promise<ContextResourceProvider>;

  constructor(
    private readonly providerFactory: ContextResourceProviderFactory,
    private readonly outputChannel: LogSink,
    private readonly turn: WorkshopResourceTurnContext
  ) {}

  async availability(): Promise<WorkshopResourceGroupAvailability[]> {
    const resources = await this.resources();
    const counts = new Map<ContextPathGroup, number>();
    for (const resource of resources) {
      counts.set(resource.group, (counts.get(resource.group) ?? 0) + 1);
    }
    return DEFAULT_CONTEXT_GROUPS
      .filter(group => counts.has(group))
      .map(group => ({ group, fileCount: counts.get(group)! }));
  }

  async fulfill(request: ResourceRequest): Promise<WorkshopCapabilityResult> {
    this.throwIfAborted();
    switch (request.capability) {
      case 'resource.catalog':
        return this.catalog(request);
      case 'resource.search':
        return this.search(request);
      case 'resource.read':
        return this.read(request);
      default:
        return this.assertNever(request);
    }
  }

  private async catalog(
    request: Extract<ResourceRequest, { capability: 'resource.catalog' }>
  ): Promise<WorkshopCapabilityResult> {
    const budgets = PROMPT_BUDGETS.workshopResource;
    const resources = (await this.resources())
      .filter(resource => !request.group || resource.group === request.group);
    const displayed = resources.slice(0, budgets.catalogItems);
    const truncated = displayed.length < resources.length;
    const groupLabel = request.group ?? 'all configured groups';
    const content = displayed.length === 0
      ? `No configured project resources are available for ${groupLabel}.`
      : [
          `## Project resource catalog · ${groupLabel}`,
          '',
          ...displayed.map(resource => this.formatCatalogEntry(resource)),
          ...(truncated
            ? ['', `Catalog limited to ${budgets.catalogItems} of ${resources.length} matching files.`]
            : [])
        ].join('\n');

    return {
      capability: request.capability,
      status: 'success',
      requestSummary: request.group ? `${request.group} catalog` : 'configured resource catalog',
      content,
      metadata: {
        group: request.group ?? 'all',
        fileCount: displayed.length,
        matchingFiles: resources.length,
        truncated
      }
    };
  }

  private async search(
    request: Extract<ResourceRequest, { capability: 'resource.search' }>
  ): Promise<WorkshopCapabilityResult> {
    const budgets = PROMPT_BUDGETS.workshopResource;
    const matchingResources = (await this.resources())
      .filter(resource => !request.group || resource.group === request.group);
    const catalogTerms = this.catalogSearchTerms(request.query);
    const catalogMatches = matchingResources.filter(resource => {
      const searchableTerms = new Set(
        `${resource.path}\n${resource.label}`.toLowerCase().match(/[\p{L}\p{N}_'-]+/gu) ?? []
      );
      return catalogTerms.some(term => searchableTerms.has(term));
    });
    const matches: ResourceSearchMatch[] = catalogMatches
      .slice(0, budgets.searchMatches)
      .map(resource => ({
        group: resource.group,
        path: resource.path,
        label: resource.label,
        source: 'catalog',
        context: `Matched configured path or label term(s): ${catalogTerms.join(', ')}`
      }));
    const query = request.query.toLowerCase();
    let bytesScanned = 0;
    let filesScanned = 0;
    let inputTruncated = false;
    let matchOverflow = catalogMatches.length > matches.length;
    const contentCatalog = matchingResources.slice(0, budgets.searchFiles);
    const contentSearchAttempted = !matchOverflow && contentCatalog.length > 0;

    if (!matchOverflow) {
      for (const catalogEntry of contentCatalog) {
        if (bytesScanned >= budgets.searchTotalBytes) {
          inputTruncated = true;
          break;
        }
        this.throwIfAborted();
        const remainingBytes = budgets.searchTotalBytes - bytesScanned;
        const fileByteLimit = Math.min(budgets.searchFileBytes, remainingBytes);
        if (catalogEntry.sizeBytes > fileByteLimit) {
          inputTruncated = true;
          continue;
        }

        const loaded = await this.provider().then(provider =>
          provider.loadResources([catalogEntry.path])
        );
        this.throwIfAborted();
        const resource = loaded.find(item =>
          this.resourceKey(item) === this.resourceKey(catalogEntry)
        );
        if (!resource) {
          inputTruncated = true;
          continue;
        }

        const sliced = this.sliceUtf8(resource.content, fileByteLimit);
        bytesScanned += sliced.bytes;
        filesScanned += 1;
        inputTruncated ||= sliced.truncated;
        const lines = sliced.content.split(/\r?\n/);

        for (let index = 0; index < lines.length; index += 1) {
          if (!lines[index].toLowerCase().includes(query)) continue;
          if (matches.length >= budgets.searchMatches) {
            matchOverflow = true;
            break;
          }
          const start = Math.max(0, index - budgets.searchContextLines);
          const end = Math.min(lines.length, index + budgets.searchContextLines + 1);
          matches.push({
            group: resource.group,
            path: resource.path,
            label: resource.label,
            source: 'content',
            line: index + 1,
            context: lines.slice(start, end).join('\n').trim()
          });
        }
        if (matchOverflow) break;
      }
    }

    const truncated = matchOverflow || inputTruncated || filesScanned < matchingResources.length;
    const noMatches = `No configured project-resource matches were found for “${request.query}”${request.group ? ` in ${request.group}` : ''}.`;
    const content = matches.length === 0
      ? truncated
        ? `${noMatches}\n\nSearch was bounded; one or more configured file contents were not fully scanned.`
        : noMatches
      : this.formatSearchContent(request, matches, truncated);
    const searchMode = catalogMatches.length === 0
      ? 'content'
      : contentSearchAttempted ? 'catalog+content' : 'catalog';

    return {
      capability: request.capability,
      status: truncated ? 'partial' : 'success',
      requestSummary: request.group
        ? `“${request.query}” in ${request.group}`
        : `“${request.query}” across configured resources`,
      content,
      metadata: {
        group: request.group ?? 'all',
        searchMode,
        catalogEntriesScanned: matchingResources.length,
        filesScanned,
        configuredFiles: matchingResources.length,
        bytesScanned,
        matchCount: matches.length,
        truncated
      }
    };
  }

  private async read(
    request: Extract<ResourceRequest, { capability: 'resource.read' }>
  ): Promise<WorkshopCapabilityResult> {
    const catalog = await this.resources();
    const exactResource = catalog.find(item =>
      item.group === request.group && item.path === request.path
    );
    const caseFoldedResources = exactResource ? [] : catalog.filter(item =>
      item.group === request.group &&
      this.normalizeResourcePath(item.path) === this.normalizeResourcePath(request.path)
    );
    if (caseFoldedResources.length > 1) {
      return this.rejected(
        request,
        'The requested path matches more than one configured resource when letter case is ignored.'
      );
    }
    const resource = exactResource ?? caseFoldedResources[0];
    if (!resource) {
      return this.rejected(
        request,
        'The requested path is not one of the configured project resources in that group.'
      );
    }

    const budgets = PROMPT_BUDGETS.workshopResource;
    if (resource.sizeBytes > budgets.readSourceBytes) {
      return {
        capability: request.capability,
        status: 'failed',
        requestSummary: resource.path,
        error: `The configured project resource exceeds the ${budgets.readSourceBytes}-byte source-read ceiling.`,
        metadata: {
          group: resource.group,
          path: resource.path,
          sourceBytes: resource.sizeBytes,
          sourceByteCeiling: budgets.readSourceBytes
        }
      };
    }

    const loaded = (await this.provider().then(provider => provider.loadResources([resource.path])))
      .find(item =>
        item.group === resource.group &&
        this.normalizeResourcePath(item.path) === this.normalizeResourcePath(resource.path)
      );
    this.throwIfAborted();
    if (!loaded) {
      return {
        capability: request.capability,
        status: 'failed',
        requestSummary: resource.path,
        error: 'The configured project resource could not be read.',
        metadata: { group: resource.group, path: resource.path }
      };
    }

    const loadedBytes = Buffer.byteLength(loaded.content, 'utf8');
    if (loadedBytes > budgets.readSourceBytes) {
      return {
        capability: request.capability,
        status: 'failed',
        requestSummary: resource.path,
        error: `The configured project resource changed beyond the ${budgets.readSourceBytes}-byte source-read ceiling.`,
        metadata: {
          group: loaded.group,
          path: loaded.path,
          workspaceFolder: loaded.workspaceFolder,
          sourceBytes: loadedBytes,
          sourceByteCeiling: budgets.readSourceBytes
        }
      };
    }

    const lines = loaded.content.split(/\r?\n/);
    const totalLines = lines.length;
    const startLine = request.startLine ?? 1;
    if (startLine > totalLines) {
      return {
        capability: request.capability,
        status: 'failed',
        requestSummary: resource.path,
        error: `The requested start line ${startLine} is beyond the file's ${totalLines} lines.`,
        metadata: {
          group: loaded.group,
          path: loaded.path,
          workspaceFolder: loaded.workspaceFolder,
          startLine,
          totalLines
        }
      };
    }
    const defaultEndLine = startLine + budgets.readDefaultLines - 1;
    const requestedEndLine = request.endLine ?? defaultEndLine;
    const selectedEndLine = Math.min(requestedEndLine, totalLines);
    const selectedContent = lines.slice(startLine - 1, selectedEndLine).join('\n');
    const sliced = this.sliceUtf8(selectedContent, budgets.readBytes);
    const returnedLineCount = sliced.truncated
      ? this.returnedLineCount(sliced.content)
      : selectedEndLine - startLine + 1;
    const endLine = Math.min(selectedEndLine, startLine + returnedLineCount - 1);
    const totalBytes = Buffer.byteLength(lines.join('\n'), 'utf8');
    const content = [
      `## Project resource · ${loaded.label}`,
      `Group: ${loaded.group}`,
      `Path: ${loaded.path}`,
      loaded.workspaceFolder ? `Workspace: ${loaded.workspaceFolder}` : undefined,
      `Lines: ${startLine}-${endLine} of ${totalLines}.`,
      sliced.truncated
        ? `Requested through line ${selectedEndLine}; stopped at the ${budgets.readBytes}-byte ceiling.`
        : request.endLine === undefined && selectedEndLine < totalLines
          ? `Default window: up to ${budgets.readDefaultLines} lines.`
          : `Read size: ${sliced.bytes} UTF-8 bytes.`,
      '',
      '```markdown',
      this.neutralizeFence(sliced.content),
      '```'
    ].filter((line): line is string => line !== undefined).join('\n');

    return {
      capability: request.capability,
      status: 'success',
      requestSummary: resource.path,
      content,
      metadata: {
        group: loaded.group,
        path: loaded.path,
        workspaceFolder: loaded.workspaceFolder,
        startLine,
        endLine,
        requestedEndLine: request.endLine,
        totalLines,
        defaultLineWindow: request.endLine === undefined,
        bytes: sliced.bytes,
        totalBytes,
        windowBytes: sliced.totalBytes,
        truncated: sliced.truncated
      }
    };
  }

  private async provider(): Promise<ContextResourceProvider> {
    this.providerPromise ??= this.providerFactory.createProvider(DEFAULT_CONTEXT_GROUPS);
    return this.providerPromise;
  }

  private async resources(): Promise<ContextResourceSummary[]> {
    const resources = (await this.provider()).listResources();
    this.throwIfAborted();
    return resources;
  }

  private formatCatalogEntry(resource: ContextResourceSummary): string {
    const workspace = resource.workspaceFolder ? ` · workspace: ${resource.workspaceFolder}` : '';
    return `- [${resource.group}] \`${resource.path}\` — ${resource.label}${workspace}`;
  }

  private catalogSearchTerms(query: string): string[] {
    return (query.toLowerCase().match(/[\p{L}\p{N}_'-]+/gu) ?? [])
      .filter(term => !CATALOG_SEARCH_STOP_WORDS.has(term));
  }

  private formatSearchContent(
    request: Extract<ResourceRequest, { capability: 'resource.search' }>,
    matches: readonly ResourceSearchMatch[],
    truncated: boolean
  ): string {
    return [
      `## Project resource search · “${request.query}”`,
      request.group ? `Group: ${request.group}` : 'Group: all configured groups',
      '',
      ...matches.flatMap(match => match.source === 'catalog'
        ? [
            `### [${match.group}] ${match.path} — ${match.label}`,
            match.context,
            ''
          ]
        : [
            `### [${match.group}] ${match.path}:${match.line} — ${match.label}`,
            '```text',
            this.neutralizeFence(match.context),
            '```',
            ''
          ]),
      ...(truncated
        ? ['Search results were bounded; additional configured matches may not have been shown.']
        : [])
    ].join('\n');
  }

  private resourceKey(resource: Pick<ContextResourceSummary, 'group' | 'path'>): string {
    return `${resource.group}\0${this.normalizeResourcePath(resource.path)}`;
  }

  private normalizeResourcePath(resourcePath: string): string {
    return resourcePath.toLowerCase();
  }

  private sliceUtf8(
    content: string,
    maxBytes: number
  ): { content: string; bytes: number; totalBytes: number; truncated: boolean } {
    const totalBytes = Buffer.byteLength(content, 'utf8');
    if (totalBytes <= maxBytes) {
      return { content, bytes: totalBytes, totalBytes, truncated: false };
    }
    const encoded = Buffer.from(content, 'utf8');
    const sliced = encoded.subarray(0, maxBytes).toString('utf8').replace(/\uFFFD$/, '');
    return {
      content: sliced,
      bytes: Buffer.byteLength(sliced, 'utf8'),
      totalBytes,
      truncated: true
    };
  }

  private returnedLineCount(content: string): number {
    if (content.length === 0) return 0;
    const newlines = content.match(/\n/g)?.length ?? 0;
    return newlines + (content.endsWith('\n') ? 0 : 1);
  }

  private neutralizeFence(value: string): string {
    return value.replace(/```/g, '`\u200B``');
  }

  private rejected(request: ResourceRequest, error: string): WorkshopCapabilityResult {
    this.outputChannel.appendLine(
      `[WorkshopResourceCapability] request=${this.turn.requestId} persona=${this.turn.personaId} ` +
      `capability=${request.capability} rejected=${error}`
    );
    return {
      capability: request.capability,
      status: 'rejected',
      requestSummary: request.capability === 'resource.read'
        ? request.path
        : request.capability === 'resource.search'
          ? request.query
          : request.group ?? 'all',
      error
    };
  }

  private throwIfAborted(): void {
    if (!this.turn.signal.aborted) return;
    const error = this.turn.signal.reason instanceof Error
      ? this.turn.signal.reason
      : new Error('Workshop resource capability cancelled');
    error.name = 'AbortError';
    throw error;
  }

  private assertNever(request: never): never {
    throw new Error(`Unhandled Workshop resource capability: ${JSON.stringify(request)}`);
  }
}
