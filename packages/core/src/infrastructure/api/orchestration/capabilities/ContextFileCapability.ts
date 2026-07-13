import { LogSink, SettingsStore } from '@/platform';
import { ContextResourceContent, ContextResourceProvider, ContextResourceSummary } from '@/domain/models/ContextGeneration';
import { countWords, trimToWordLimit } from '@/utils/textUtils';
import { AgentCapability, CapabilityFulfillment } from '../AgentRunContracts';
import {
  createResourceReadXmlInstruction,
  ResourceReadInspection,
  ResourceReadRequest
} from '../ResourceReadXmlCodec';
import { ResourceRequestGate } from './ResourceRequestGate';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

export class ContextFileCapability implements AgentCapability<
  ResourceReadRequest,
  Extract<ResourceReadInspection, { kind: 'invalid' }>
> {
  readonly catalog = 'projectContext' as const;
  private readonly gate = new ResourceRequestGate({
    catalogLabel: 'project-resource',
    nothingLoaded: 'No project files were loaded.',
    finalArtifactLabel: 'the context briefing',
    evidenceLabel: 'project'
  });

  constructor(
    private readonly provider: ContextResourceProvider,
    private readonly settings: SettingsStore,
    private readonly outputChannel?: LogSink
  ) {}

  async appendContract(userMessage: string): Promise<string> {
    const catalog = this.provider.listResources();
    const displayedCatalog = this.orderCatalog(catalog).slice(0, PROMPT_BUDGETS.contextFiles.catalogItems);
    this.gate.setAllowedPaths(displayedCatalog.map(item => item.path));
    return [
      userMessage,
      this.formatCatalog(catalog),
      createResourceReadXmlInstruction(displayedCatalog[0]?.path)
    ].join('\n\n');
  }

  inspectRequest(candidate: string): ResourceReadInspection {
    return this.gate.inspect(candidate);
  }

  async fulfill(request: ResourceReadRequest): Promise<CapabilityFulfillment> {
    const requestedPaths = request.paths;
    const rejected = requestedPaths.filter(path => !this.gate.allows(path));
    if (rejected.length > 0) {
      return {
        evidence: 'The resource request was rejected because it included a path outside the displayed project-resource catalog. Continue without additional resources.',
        deliveredItems: [],
        artifacts: []
      };
    }
    const requested = [...new Set(requestedPaths)];
    const requestedSet = new Set(requested);
    const loaded = (await this.provider.loadResources(requested))
      .filter(item => requestedSet.has(item.path) && this.gate.allows(item.path));
    const delivered = new Set(loaded.map(item => item.path));
    const missing = requestedPaths.filter(path => !delivered.has(path));
    this.outputChannel?.appendLine(`[ContextFileCapability] Fulfilled ${loaded.length}/${requested.length} configured resource request(s).`);
    return {
      evidence: this.buildEvidence(loaded, missing),
      deliveredItems: loaded.map(item => item.path),
      artifacts: loaded.map(item => ({
        catalog: this.catalog,
        id: item.path,
        label: item.label,
        category: item.group,
        size: item.content.length,
        reason: 'Requested configured project resource'
      }))
    };
  }

  stripToolCalls(content: string): string {
    return this.gate.stripToolCalls(content);
  }

  statusMessage(): string {
    return 'Loading project reference files...';
  }

  requestLogSummary(request: ResourceReadRequest): string {
    return `${request.paths.length} path(s): ${request.paths.join(', ')}`;
  }

  invalidRequestInstruction(rejection: Extract<ResourceReadInspection, { kind: 'invalid' }>): string {
    return this.gate.invalidRequestInstruction(rejection);
  }

  limitInstruction(): string {
    return 'You have reached the project-resource request limit. Produce the context briefing now using only evidence already received.';
  }

  private formatCatalog(catalog: readonly ContextResourceSummary[]): string {
    if (catalog.length === 0) {
      return '## Available Project Resources\n\nNo project references matched the configured path patterns. Continue using the excerpt and your knowledge of genre conventions.';
    }

    const ordered = this.orderCatalog(catalog);
    const lines = [
      '## Available Project Resources',
      '',
      '**IMPORTANT**: Displayed items in `[projectBrief]` are your story bible/overview. Request all displayed items that are relevant on your first turn.',
      '',
      'Each backticked path is one complete opaque key. Copy it exactly when requesting files.',
      ''
    ];

    for (const summary of ordered.slice(0, PROMPT_BUDGETS.contextFiles.catalogItems)) {
      const workspacePrefix = summary.workspaceFolder ? ` (workspace: ${summary.workspaceFolder})` : '';
      const labelSuffix = summary.label && summary.label.toLowerCase() !== summary.path.toLowerCase()
        ? ` — ${summary.label}`
        : '';
      lines.push(`- [${summary.group}] \`${summary.path}\`${labelSuffix}${workspacePrefix}`);
    }

    if (ordered.length > PROMPT_BUDGETS.contextFiles.catalogItems) {
      lines.push('', `...and ${ordered.length - PROMPT_BUDGETS.contextFiles.catalogItems} additional resource(s) not listed to save tokens.`);
    }

    return lines.join('\n');
  }

  private catalogOrder(item: ContextResourceSummary, originalIndex: number): number {
    return item.group === 'projectBrief' ? originalIndex - 1_000 : originalIndex;
  }

  private orderCatalog(catalog: readonly ContextResourceSummary[]): ContextResourceSummary[] {
    return catalog
      .map((item, index) => ({ item, index }))
      .sort((a, b) => this.catalogOrder(a.item, a.index) - this.catalogOrder(b.item, b.index))
      .map(({ item }) => item);
  }

  private buildEvidence(resources: readonly ContextResourceContent[], missing: readonly string[]): string {
    if (resources.length === 0) {
      return `No configured project resources matched the request${missing.length ? ` (${missing.join(', ')})` : ''}. Please continue without them.`;
    }
    const combined = resources.map(item => item.content).join('\n\n');
    const applyTrimming = this.settings.get<boolean>('proseMinion', 'applyContextWindowTrimming', true);
    const trimmed = applyTrimming && countWords(combined) > PROMPT_BUDGETS.contextFiles.words
      ? trimToWordLimit(combined, PROMPT_BUDGETS.contextFiles.words).trimmed
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
