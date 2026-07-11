import { LogSink, SettingsStore } from '@/platform';
import { ContextResourceContent, ContextResourceProvider, ContextResourceSummary } from '@/domain/models/ContextGeneration';
import { countWords, trimToWordLimit } from '@/utils/textUtils';
import { AgentCapability, CapabilityFulfillment } from '../AgentRunContracts';
import { ResourceReadRequest, ResourceReadXmlCodec, RESOURCE_READ_XML_INSTRUCTION } from '../ResourceReadXmlCodec';

const MAX_CONTEXT_WORDS = 50_000;
const MAX_CATALOG_ITEMS = 100;

export class ContextFileCapability implements AgentCapability {
  readonly catalog = 'projectContext' as const;
  private readonly requestCodec = new ResourceReadXmlCodec();
  private allowedPaths = new Set<string>();

  constructor(
    private readonly provider: ContextResourceProvider,
    private readonly settings: SettingsStore,
    private readonly outputChannel?: LogSink
  ) {}

  async appendCatalog(userMessage: string): Promise<string> {
    const catalog = this.provider.listResources();
    this.allowedPaths = new Set(catalog.map(item => item.path));
    return [userMessage, this.formatCatalog(catalog), RESOURCE_READ_XML_INSTRUCTION].join('\n\n');
  }

  parseExactRequest(candidate: string): ResourceReadRequest | undefined {
    const request = this.requestCodec.parseExactRequest(candidate);
    return request && request.paths.every(path => this.allowedPaths.has(path))
      ? request
      : undefined;
  }

  async fulfill(requestedPaths: readonly string[]): Promise<CapabilityFulfillment> {
    const rejected = requestedPaths.filter(path => !this.allowedPaths.has(path));
    if (rejected.length > 0) {
      return {
        evidence: 'The resource request was rejected because it included a path outside the displayed project-resource catalog. Continue without additional resources.',
        deliveredPaths: [],
        artifacts: []
      };
    }
    const requested = [...new Set(requestedPaths)];
    const requestedSet = new Set(requested);
    const loaded = (await this.provider.loadResources(requested))
      .filter(item => requestedSet.has(item.path) && this.allowedPaths.has(item.path));
    const delivered = new Set(loaded.map(item => item.path));
    const missing = requestedPaths.filter(path => !delivered.has(path));
    this.outputChannel?.appendLine(`[ContextFileCapability] Fulfilled ${loaded.length}/${requested.length} configured resource request(s).`);
    return {
      evidence: this.buildEvidence(loaded, missing),
      deliveredPaths: loaded.map(item => item.path),
      artifacts: loaded.map(item => ({
        catalog: this.catalog,
        path: item.path,
        label: item.label,
        category: item.group,
        size: item.content.length,
        reason: 'Requested configured project resource'
      }))
    };
  }

  stripToolCalls(content: string): string {
    return this.requestCodec.stripExactRequest(content);
  }

  statusMessage(): string {
    return 'Loading project reference files...';
  }

  limitInstruction(): string {
    return 'You have reached the project-resource request limit. Produce the context briefing now using only evidence already received.';
  }

  private formatCatalog(catalog: readonly ContextResourceSummary[]): string {
    if (catalog.length === 0) {
      return '## Available Project Resources\n\nNo project references matched the configured path patterns. Continue using the excerpt and your knowledge of genre conventions.';
    }

    const ordered = catalog
      .map((item, index) => ({ item, index }))
      .sort((a, b) => this.catalogOrder(a.item, a.index) - this.catalogOrder(b.item, b.index))
      .map(({ item }) => item);
    const lines = [
      '## Available Project Resources',
      '',
      '**IMPORTANT**: Items in `[projectBrief]` are your story bible/overview. Request ALL of them on your first turn.',
      '',
      'Use the exact path values when requesting files.',
      ''
    ];

    for (const summary of ordered.slice(0, MAX_CATALOG_ITEMS)) {
      const workspacePrefix = summary.workspaceFolder ? ` (workspace: ${summary.workspaceFolder})` : '';
      const labelSuffix = summary.label && summary.label.toLowerCase() !== summary.path.toLowerCase()
        ? ` — ${summary.label}`
        : '';
      lines.push(`- [${summary.group}] \`${summary.path}\`${labelSuffix}${workspacePrefix}`);
    }

    if (ordered.length > MAX_CATALOG_ITEMS) {
      lines.push('', `...and ${ordered.length - MAX_CATALOG_ITEMS} additional resource(s) not listed to save tokens.`);
    }

    return lines.join('\n');
  }

  private catalogOrder(item: ContextResourceSummary, originalIndex: number): number {
    return item.group === 'projectBrief' ? originalIndex - 1_000 : originalIndex;
  }

  private buildEvidence(resources: readonly ContextResourceContent[], missing: readonly string[]): string {
    if (resources.length === 0) {
      return `No configured project resources matched the request${missing.length ? ` (${missing.join(', ')})` : ''}. Please continue without them.`;
    }
    const combined = resources.map(item => item.content).join('\n\n');
    const applyTrimming = this.settings.get<boolean>('proseMinion', 'applyContextWindowTrimming', true);
    const trimmed = applyTrimming && countWords(combined) > MAX_CONTEXT_WORDS
      ? trimToWordLimit(combined, MAX_CONTEXT_WORDS).trimmed
      : undefined;
    if (trimmed) {
      return ['Here are the requested project resources (combined evidence was trimmed to fit the context window):', '', '```markdown', trimmed, '```'].join('\n');
    }
    return [
      'Here are the requested project resources:',
      '',
      ...resources.flatMap(item => [
        `### Resource: ${item.path}`,
        `Group: ${item.group}`,
        item.workspaceFolder ? `Workspace Folder: ${item.workspaceFolder}` : undefined,
        '',
        '```markdown',
        item.content.trim(),
        '```',
        ''
      ].filter((line): line is string => line !== undefined)),
      ...(missing.length ? [`The following requested paths could not be located: ${missing.join(', ')}.`] : []),
      'Please incorporate these references into the context summary.'
    ].join('\n');
  }
}
