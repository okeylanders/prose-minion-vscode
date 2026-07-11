import { LogSink, SettingsStore } from '@/platform';
import { GuideRegistry } from '@/infrastructure/guides/GuideRegistry';
import { GuideLoader } from '@/tools/shared/guides';
import { countWords, trimToWordLimit } from '@/utils/textUtils';
import { AgentCapability, CapabilityFulfillment } from '../AgentRunContracts';
import { ResourceReadRequest, ResourceReadXmlCodec, RESOURCE_READ_XML_INSTRUCTION } from '../ResourceReadXmlCodec';

const MAX_GUIDE_WORDS = 50_000;

export class GuideCapability implements AgentCapability {
  readonly catalog = 'guides' as const;
  private readonly requestCodec = new ResourceReadXmlCodec();
  private allowedPaths = new Set<string>();

  constructor(
    private readonly guideRegistry: GuideRegistry,
    private readonly guideLoader: GuideLoader,
    private readonly settings: SettingsStore,
    private readonly outputChannel?: LogSink
  ) {}

  async appendCatalog(userMessage: string): Promise<string> {
    const available = await this.guideRegistry.listAvailableGuides();
    this.allowedPaths = new Set(available.map(guide => guide.path));
    return [userMessage, this.guideRegistry.formatGuideListForPrompt(available), RESOURCE_READ_XML_INSTRUCTION].join('\n\n');
  }

  parseExactRequest(candidate: string): ResourceReadRequest | undefined {
    const request = this.requestCodec.parseExactRequest(candidate);
    return request && request.paths.every(path => this.allowedPaths.has(path))
      ? request
      : undefined;
  }

  async fulfill(requestedPaths: readonly string[]): Promise<CapabilityFulfillment> {
    const available = await this.guideRegistry.listAvailableGuides();
    const allowed = new Map(available.map(guide => [guide.path, guide]));
    const rejected = requestedPaths.filter(path => !this.allowedPaths.has(path));
    if (rejected.length > 0) {
      return {
        evidence: 'The resource request was rejected because it included a path outside the displayed craft-guide catalog. Continue without additional resources.',
        deliveredPaths: [],
        artifacts: []
      };
    }
    const requested = [...new Set(requestedPaths)].filter(path => allowed.has(path));
    const unavailable = requestedPaths.filter(path => !allowed.has(path));
    const loaded: Array<{ path: string; content: string }> = [];

    for (const path of requested) {
      try {
        loaded.push({ path, content: await this.guideLoader.loadGuide(path) });
      } catch (error) {
        this.outputChannel?.appendLine(`[GuideCapability] Failed to load ${path}: ${String(error)}`);
      }
    }

    const evidence = this.buildEvidence(loaded, unavailable);
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

  stripToolCalls(content: string): string {
    return this.requestCodec.stripExactRequest(content);
  }

  statusMessage(): string {
    return 'Loading requested craft guides...';
  }

  limitInstruction(): string {
    return 'No more craft guides can be loaded. Please provide your response using the evidence already received.';
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
