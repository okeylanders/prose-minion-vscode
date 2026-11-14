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
import { sliceUtf8 } from './WorkshopConfiguredResourceLookup';
import { neutralizeWorkshopResourceFence, WorkshopResourceReadOperation } from './WorkshopResourceRead';

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
  private readonly readOperation: WorkshopResourceReadOperation;

  constructor(
    private readonly providerFactory: ContextResourceProviderFactory,
    private readonly outputChannel: LogSink,
    private readonly turn: WorkshopResourceTurnContext
  ) {
    this.readOperation = new WorkshopResourceReadOperation({
      resources: () => this.resources(),
      load: async (resourcePath) => (await this.provider()).loadResources([resourcePath]),
      throwIfAborted: () => this.throwIfAborted(),
      rejected: (request, error) => this.rejected(request, error)
    });
  }

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
        return this.readOperation.run(request);
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

        const sliced = sliceUtf8(resource.content, fileByteLimit);
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

  private neutralizeFence(value: string): string {
    return neutralizeWorkshopResourceFence(value);
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
