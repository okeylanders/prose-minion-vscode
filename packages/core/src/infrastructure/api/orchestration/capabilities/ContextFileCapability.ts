import { LogSink, SettingsStore } from '@/platform';
import { ContextResourceContent, ContextResourceProvider } from '@/domain/models/ContextGeneration';
import { countWords, trimToWordLimit } from '@/utils/textUtils';
import { AgentCapability, CapabilityFulfillment } from '../AgentRunContracts';
import { ResourceReadRequest, ResourceReadXmlCodec, RESOURCE_READ_XML_INSTRUCTION } from '../ResourceReadXmlCodec';

const MAX_CONTEXT_WORDS = 50_000;

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
    if (catalog.length === 0) {
      return [userMessage, '## Available Project Resources\n\nNo configured project resources are available.', RESOURCE_READ_XML_INSTRUCTION].join('\n\n');
    }
    return [
      userMessage,
      '',
      '## Available Project Resources',
      '',
      ...catalog.map(item => `- \`${item.path}\` (${item.group}) — ${item.label}`),
      '',
      RESOURCE_READ_XML_INSTRUCTION
    ].join('\n');
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
    const loaded = await this.provider.loadResources([...new Set(requestedPaths)]);
    const delivered = new Set(loaded.map(item => item.path));
    const missing = requestedPaths.filter(path => !delivered.has(path));
    this.outputChannel?.appendLine(`[ContextFileCapability] Fulfilled ${loaded.length}/${requestedPaths.length} configured resource request(s).`);
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
