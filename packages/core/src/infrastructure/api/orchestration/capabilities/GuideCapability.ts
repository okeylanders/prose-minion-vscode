import { LogSink, SettingsStore } from '@/platform';
import { GuideRegistry } from '@/infrastructure/guides/GuideRegistry';
import { GuideLoader } from '@/tools/shared/guides';
import { countWords, trimToWordLimit } from '@/utils/textUtils';
import { AgentCapability, CapabilityFulfillment } from '../AgentRunContracts';

const GUIDE_DIRECTIVE = /<guide-request\s+path=\[(.*?)\]\s*\/>/gi;
const MAX_GUIDE_WORDS = 50_000;

export class GuideCapability implements AgentCapability {
  readonly catalog = 'guides' as const;

  constructor(
    private readonly guideRegistry: GuideRegistry,
    private readonly guideLoader: GuideLoader,
    private readonly settings: SettingsStore,
    private readonly outputChannel?: LogSink
  ) {}

  async appendCatalog(userMessage: string): Promise<string> {
    const available = await this.guideRegistry.listAvailableGuides();
    return `${userMessage}\n\n${this.guideRegistry.formatGuideListForPrompt(available)}`;
  }

  parseExactDirective(candidate: string): readonly string[] | undefined {
    if (!this.isOnlyDirectives(candidate)) return undefined;
    const paths = this.parsePaths(candidate);
    return paths.length > 0 ? paths : undefined;
  }

  async fulfill(requestedPaths: readonly string[]): Promise<CapabilityFulfillment> {
    const available = await this.guideRegistry.listAvailableGuides();
    const allowed = new Map(available.map(guide => [guide.path, guide]));
    const requested = [...new Set(requestedPaths)].filter(path => allowed.has(path));
    const rejected = requestedPaths.filter(path => !allowed.has(path));
    const loaded: Array<{ path: string; content: string }> = [];

    for (const path of requested) {
      try {
        loaded.push({ path, content: await this.guideLoader.loadGuide(path) });
      } catch (error) {
        this.outputChannel?.appendLine(`[GuideCapability] Failed to load ${path}: ${String(error)}`);
      }
    }

    const evidence = this.buildEvidence(loaded, rejected);
    return {
      evidence,
      deliveredPaths: loaded.map(item => item.path),
      artifacts: loaded.map(item => {
        const guide = allowed.get(item.path)!;
        return {
          catalog: this.catalog,
          path: item.path,
          label: guide.displayName,
          category: guide.category,
          size: item.content.length,
          reason: 'Requested craft guide'
        };
      })
    };
  }

  stripDirectives(content: string): string {
    return content.replace(GUIDE_DIRECTIVE, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  statusMessage(): string {
    return 'Loading requested craft guides...';
  }

  limitInstruction(): string {
    return 'No more craft guides can be loaded. Please provide your response using the evidence already received.';
  }

  private isOnlyDirectives(candidate: string): boolean {
    GUIDE_DIRECTIVE.lastIndex = 0;
    const withoutDirectives = candidate.replace(GUIDE_DIRECTIVE, '').trim();
    GUIDE_DIRECTIVE.lastIndex = 0;
    return withoutDirectives.length === 0 && Array.from(candidate.matchAll(GUIDE_DIRECTIVE)).length > 0;
  }

  private parsePaths(candidate: string): string[] {
    GUIDE_DIRECTIVE.lastIndex = 0;
    const paths: string[] = [];
    for (const match of candidate.matchAll(GUIDE_DIRECTIVE)) {
      for (const path of match[1].matchAll(/["']([^"']+)["']/g)) {
        paths.push(path[1].trim());
      }
    }
    return [...new Set(paths)];
  }

  private buildEvidence(loaded: readonly { path: string; content: string }[], rejected: readonly string[]): string {
    if (loaded.length === 0) {
      return `No requested craft guides were available${rejected.length ? ` (${rejected.join(', ')})` : ''}. Please continue without them.`;
    }

    const combined = loaded.map(item => item.content).join('\n\n');
    const applyTrimming = this.settings.get<boolean>('proseMinion', 'applyContextWindowTrimming', true);
    const trimmed = applyTrimming && countWords(combined) > MAX_GUIDE_WORDS
      ? trimToWordLimit(combined, MAX_GUIDE_WORDS).trimmed
      : undefined;
    if (trimmed) {
      return ['Here are the requested craft guides (combined evidence was trimmed to fit the context window):', '', trimmed].join('\n');
    }
    return [
      'Here are the requested craft guides:',
      '',
      ...loaded.flatMap(item => [`## Guide: ${item.path}`, '', item.content, '', '---', '']),
      ...(rejected.length ? [`The following requested guides are unavailable: ${rejected.join(', ')}.`] : [])
    ].join('\n');
  }
}
