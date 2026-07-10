import { LogSink, SettingsStore } from '@/platform';
import { ContextResourceContent, ContextResourceProvider } from '@/domain/models/ContextGeneration';
import { countWords, trimToWordLimit } from '@/utils/textUtils';
import { AgentCapability, CapabilityFulfillment } from '../AgentRunContracts';

const CONTEXT_DIRECTIVE = /<context-request\s+path=\[(.*?)\]\s*\/>/gi;
const MAX_CONTEXT_WORDS = 50_000;

export class ContextFileCapability implements AgentCapability {
  readonly catalog = 'projectContext' as const;

  constructor(
    private readonly provider: ContextResourceProvider,
    private readonly settings: SettingsStore,
    private readonly outputChannel?: LogSink
  ) {}

  async appendCatalog(userMessage: string): Promise<string> {
    const catalog = this.provider.listResources();
    if (catalog.length === 0) return `${userMessage}\n\n## Available Project Resources\n\nNo configured project resources are available.`;
    return [
      userMessage,
      '',
      '## Available Project Resources',
      '',
      ...catalog.map(item => `- \`${item.path}\` (${item.group}) — ${item.label}`)
    ].join('\n');
  }

  parseExactDirective(candidate: string): readonly string[] | undefined {
    if (!this.isOnlyDirectives(candidate)) return undefined;
    const paths = this.parsePaths(candidate);
    return paths.length > 0 ? paths : undefined;
  }

  async fulfill(requestedPaths: readonly string[]): Promise<CapabilityFulfillment> {
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

  stripDirectives(content: string): string {
    return content.replace(CONTEXT_DIRECTIVE, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  statusMessage(): string {
    return 'Loading project reference files...';
  }

  limitInstruction(): string {
    return 'You have reached the project-resource request limit. Produce the context briefing now using only evidence already received.';
  }

  private isOnlyDirectives(candidate: string): boolean {
    CONTEXT_DIRECTIVE.lastIndex = 0;
    const withoutDirectives = candidate.replace(CONTEXT_DIRECTIVE, '').trim();
    CONTEXT_DIRECTIVE.lastIndex = 0;
    return withoutDirectives.length === 0 && Array.from(candidate.matchAll(CONTEXT_DIRECTIVE)).length > 0;
  }

  private parsePaths(candidate: string): string[] {
    CONTEXT_DIRECTIVE.lastIndex = 0;
    const paths: string[] = [];
    for (const match of candidate.matchAll(CONTEXT_DIRECTIVE)) {
      for (const path of match[1].matchAll(/["']([^"']+)["']/g)) {
        paths.push(path[1].trim());
      }
    }
    return [...new Set(paths)];
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
