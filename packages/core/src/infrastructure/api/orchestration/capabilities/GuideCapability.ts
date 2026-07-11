import { LogSink, SettingsStore } from '@/platform';
import { GuideRegistry } from '@/infrastructure/guides/GuideRegistry';
import { GuideLoader } from '@/tools/shared/guides';
import { countWords, trimToWordLimit } from '@/utils/textUtils';
import { AgentCapability, CapabilityFulfillment } from '../AgentRunContracts';
import { createResourceReadXmlInstruction, ResourceReadInspection, ResourceReadXmlCodec } from '../ResourceReadXmlCodec';

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
    return [
      userMessage,
      this.guideRegistry.formatGuideListForPrompt(available),
      createResourceReadXmlInstruction(available[0]?.path)
    ].join('\n\n');
  }

  inspectRequest(candidate: string): ResourceReadInspection {
    const inspection = this.requestCodec.inspect(candidate);
    if (inspection.kind !== 'request') {
      return inspection;
    }

    const allowlistedPathCount = inspection.request.paths
      .filter(path => this.allowedPaths.has(path)).length;
    return allowlistedPathCount === inspection.request.paths.length
      ? inspection
      : {
          kind: 'invalid',
          reason: 'path-not-allowlisted',
          pathCount: inspection.request.paths.length,
          allowlistedPathCount
        };
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

  statusTicker(requestedPaths: readonly string[]): string {
    return requestedPaths
      .map(path => path.split('/').pop() ?? path)
      .map(filename => filename.replace(/\.md$/i, ''))
      .map(filename => filename
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '))
      .join(', ');
  }

  invalidRequestInstruction(rejection: Extract<ResourceReadInspection, { kind: 'invalid' }>): string {
    const correction = rejection.reason === 'path-not-allowlisted'
      ? 'One or more path values did not exactly match a complete opaque key in the displayed craft-guide catalog.'
      : `The resource request did not match the required bare XML envelope (${rejection.reason}).`;
    return `${correction} No guides were loaded. Because you attempted a resource request, resubmit the intended request now as one bare XML document using only complete catalog keys. Do not narrate the request, use a Markdown fence, or provide the final response yet; wait for the requested guide evidence.`;
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
