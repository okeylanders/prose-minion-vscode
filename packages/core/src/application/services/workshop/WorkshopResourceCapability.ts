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
  /** Paths become readable only after this turn's catalog/search exposed them. */
  private readonly allowedReads = new Set<string>();

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
    displayed.forEach(resource => this.allowedReads.add(this.resourceKey(resource)));
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

    if (catalogMatches.length > 0) {
      const displayed = catalogMatches.slice(0, budgets.searchMatches);
      displayed.forEach(resource => this.allowedReads.add(this.resourceKey(resource)));
      const truncated = displayed.length < catalogMatches.length;
      const matches: ResourceSearchMatch[] = displayed.map(resource => ({
        group: resource.group,
        path: resource.path,
        label: resource.label,
        source: 'catalog',
        context: `Matched configured path or label term(s): ${catalogTerms.join(', ')}`
      }));
      return {
        capability: request.capability,
        status: truncated ? 'partial' : 'success',
        requestSummary: request.group
          ? `“${request.query}” in ${request.group}`
          : `“${request.query}” across configured resources`,
        content: this.formatSearchContent(request, matches, truncated),
        metadata: {
          group: request.group ?? 'all',
          searchMode: 'catalog',
          catalogEntriesScanned: matchingResources.length,
          filesScanned: 0,
          configuredFiles: matchingResources.length,
          bytesScanned: 0,
          matchCount: matches.length,
          truncated
        }
      };
    }

    const catalog = matchingResources.slice(0, budgets.searchFiles);
    const loaded = await this.provider().then(provider =>
      provider.loadResources(catalog.map(resource => resource.path))
    );
    this.throwIfAborted();

    const loadedByKey = new Map(
      loaded.map(resource => [this.resourceKey(resource), resource] as const)
    );

    const query = request.query.toLowerCase();
    const matches: ResourceSearchMatch[] = [];
    let bytesScanned = 0;
    let filesScanned = 0;
    let inputTruncated = false;

    for (const catalogEntry of catalog) {
      if (matches.length >= budgets.searchMatches || bytesScanned >= budgets.searchTotalBytes) {
        break;
      }
      this.throwIfAborted();
      const resource = loadedByKey.get(this.resourceKey(catalogEntry));
      if (!resource) continue;

      const remainingBytes = budgets.searchTotalBytes - bytesScanned;
      const fileByteLimit = Math.min(budgets.searchFileBytes, remainingBytes);
      const sliced = this.sliceUtf8(resource.content, fileByteLimit);
      bytesScanned += sliced.bytes;
      filesScanned += 1;
      inputTruncated ||= sliced.truncated;
      const lines = sliced.content.split(/\r?\n/);

      for (let index = 0; index < lines.length; index += 1) {
        if (!lines[index].toLowerCase().includes(query)) continue;
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
        this.allowedReads.add(this.resourceKey(resource));
        if (matches.length >= budgets.searchMatches) break;
      }
    }

    const omittedFiles = Math.max(0, matchingResources.length - filesScanned);
    const truncated = inputTruncated || omittedFiles > 0 || matches.length >= budgets.searchMatches;
    const content = matches.length === 0
      ? `No configured project-resource matches were found for “${request.query}”${request.group ? ` in ${request.group}` : ''}.`
      : this.formatSearchContent(request, matches, truncated);

    return {
      capability: request.capability,
      status: filesScanned < matchingResources.length ? 'partial' : 'success',
      requestSummary: request.group
        ? `“${request.query}” in ${request.group}`
        : `“${request.query}” across configured resources`,
      content,
      metadata: {
        group: request.group ?? 'all',
        searchMode: 'content',
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
    const resource = catalog.find(item =>
      item.group === request.group && item.path === request.path
    );
    if (!resource || !this.allowedReads.has(this.resourceKey(request))) {
      return this.rejected(
        request,
        'The requested path was not returned by this turn\'s configured resource catalog or search evidence.'
      );
    }

    const loaded = (await this.provider().then(provider => provider.loadResources([request.path])))
      .find(item => item.path === request.path && item.group === request.group);
    this.throwIfAborted();
    if (!loaded) {
      return {
        capability: request.capability,
        status: 'failed',
        requestSummary: request.path,
        error: 'The configured project resource could not be read.',
        metadata: { group: request.group, path: request.path }
      };
    }

    const sliced = this.sliceUtf8(loaded.content, PROMPT_BUDGETS.workshopResource.readBytes);
    const content = [
      `## Project resource · ${loaded.label}`,
      `Group: ${loaded.group}`,
      `Path: ${loaded.path}`,
      loaded.workspaceFolder ? `Workspace: ${loaded.workspaceFolder}` : undefined,
      sliced.truncated
        ? `Read head slice: ${sliced.bytes} of ${sliced.totalBytes} UTF-8 bytes.`
        : `Read size: ${sliced.totalBytes} UTF-8 bytes.`,
      '',
      '```markdown',
      this.neutralizeFence(sliced.content.trim()),
      '```'
    ].filter((line): line is string => line !== undefined).join('\n');

    return {
      capability: request.capability,
      status: 'success',
      requestSummary: request.path,
      content,
      metadata: {
        group: loaded.group,
        path: loaded.path,
        workspaceFolder: loaded.workspaceFolder,
        bytes: sliced.bytes,
        totalBytes: sliced.totalBytes,
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
    return `${resource.group}\0${resource.path}`;
  }

  private sliceUtf8(
    content: string,
    maxBytes: number
  ): { content: string; bytes: number; totalBytes: number; truncated: boolean } {
    const encoded = Buffer.from(content, 'utf8');
    if (encoded.length <= maxBytes) {
      return { content, bytes: encoded.length, totalBytes: encoded.length, truncated: false };
    }
    const sliced = encoded.subarray(0, maxBytes).toString('utf8').replace(/\uFFFD$/, '');
    return {
      content: sliced,
      bytes: Buffer.byteLength(sliced, 'utf8'),
      totalBytes: encoded.length,
      truncated: true
    };
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
