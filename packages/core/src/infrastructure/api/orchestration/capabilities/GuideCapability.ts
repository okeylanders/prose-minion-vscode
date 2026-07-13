import { LogSink, SettingsStore } from '@/platform';
import { GuideRegistry } from '@/infrastructure/guides/GuideRegistry';
import { GuideLoader } from '@/tools/shared/guides';
import { countWords, trimToWordLimit } from '@/utils/textUtils';
import { AgentCapability, CapabilityFulfillment } from '../AgentRunContracts';
import {
  createResourceReadXmlInstruction,
  ResourceReadInspection,
  ResourceReadRequest,
  summarizeResourceReadRequest
} from '../ResourceReadXmlCodec';
import { ResourceRequestGate } from './ResourceRequestGate';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

export class GuideCapability implements AgentCapability<
  ResourceReadRequest,
  Extract<ResourceReadInspection, { kind: 'invalid' }>
> {
  readonly catalog = 'guides' as const;
  private readonly gate = new ResourceRequestGate({
    catalogLabel: 'craft-guide',
    nothingLoaded: 'No guides were loaded.',
    finalArtifactLabel: 'the final response',
    evidenceLabel: 'guide'
  });

  constructor(
    private readonly guideRegistry: GuideRegistry,
    private readonly guideLoader: GuideLoader,
    private readonly settings: SettingsStore,
    private readonly outputChannel?: LogSink
  ) {}

  async appendContract(userMessage: string): Promise<string> {
    const available = await this.guideRegistry.listAvailableGuides();
    this.gate.setAllowedPaths(available.map(guide => guide.path));
    return [
      userMessage,
      this.guideRegistry.formatGuideListForPrompt(available),
      createResourceReadXmlInstruction(available[0]?.path)
    ].join('\n\n');
  }

  inspectRequest(candidate: string): ResourceReadInspection {
    return this.gate.inspect(candidate);
  }

  async fulfill(request: ResourceReadRequest): Promise<CapabilityFulfillment> {
    const requestedPaths = request.paths;
    const available = await this.guideRegistry.listAvailableGuides();
    const allowed = new Map(available.map(guide => [guide.path, guide]));
    const rejected = requestedPaths.filter(path => !this.gate.allows(path));
    if (rejected.length > 0) {
      return {
        evidence: 'The resource request was rejected because it included a path outside the displayed craft-guide catalog. Continue without additional resources.',
        deliveredItems: [],
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
        // A load failure joins the unavailable list so the model (and thus
        // the writer's briefing) knows this guide dropped out — a dev-only
        // log line would let it vanish silently.
        unavailable.push(path);
        this.outputChannel?.appendLine(`[GuideCapability] Failed to load ${path}: ${String(error)}`);
      }
    }

    const evidence = this.buildEvidence(loaded, unavailable);
    return {
      evidence,
      deliveredItems: loaded.map(item => item.path),
      artifacts: loaded.map(item => {
        const guide = allowed.get(item.path)!;
        return {
          catalog: this.catalog,
          id: item.path,
          label: guide.displayName,
          category: guide.category,
          size: item.content.length,
          reason: 'Requested craft guide'
        };
      })
    };
  }

  stripToolCalls(content: string): string {
    return this.gate.stripToolCalls(content);
  }

  statusMessage(): string {
    return 'Loading requested craft guides...';
  }

  statusTicker(request: ResourceReadRequest): string {
    const requestedPaths = request.paths;
    return requestedPaths
      .map(path => path.split('/').pop() ?? path)
      .map(filename => filename.replace(/\.md$/i, ''))
      .map(filename => filename
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '))
      .join(', ');
  }

  requestLogSummary(request: ResourceReadRequest): string {
    return summarizeResourceReadRequest(request);
  }

  invalidRequestInstruction(rejection: Extract<ResourceReadInspection, { kind: 'invalid' }>): string {
    return this.gate.invalidRequestInstruction(rejection);
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
    const trimmed = applyTrimming && countWords(combined) > PROMPT_BUDGETS.guides.words
      ? trimToWordLimit(combined, PROMPT_BUDGETS.guides.words).trimmed
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
