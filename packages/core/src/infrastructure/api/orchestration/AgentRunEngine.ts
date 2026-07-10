import { LogSink } from '@/platform';
import { OpenRouterClient, OpenRouterMessage } from '@providers/OpenRouterClient';
import { ConversationManager, ConversationNotFoundError } from './ConversationManager';
import {
  AgentCapability,
  AgentRunOptions,
  ExecutionResult,
  InitialRunRequest,
  ResourceArtifact,
  StreamingTokenCallback
} from './AgentRunContracts';
import { TokenUsage } from '@shared/types';

export type StatusCallback = (message: string, tickerMessage?: string) => void;
export type TokenUsageCallback = (usage: TokenUsage) => void;

interface TerminationContext {
  readonly signal?: AbortSignal;
  dispose(): void;
}

interface TurnResult {
  readonly content: string;
  readonly finishReason?: string;
  readonly usage?: TokenUsage;
  readonly cancelled: boolean;
  /** Candidate directives are withheld from visible streaming until validated. */
  readonly exactDirective?: readonly string[];
}

const ANY_CAPABILITY_DIRECTIVE = /<(?:guide-request|context-request)\s+path=\[.*?\]\s*\/>/gis;

/**
 * The single internal initial-run engine. It owns transport, cancellation,
 * retention, bounded capability rounds, output visibility, token accounting,
 * and cleanup. Capability adapters own resource-specific protocol and I/O.
 */
export class AgentRunEngine {
  private readonly conversationCleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly openRouterClient: OpenRouterClient,
    private readonly conversationManager: ConversationManager,
    private statusCallback?: StatusCallback,
    private readonly outputChannel?: LogSink,
    private tokenUsageCallback?: TokenUsageCallback
  ) {
    this.conversationCleanupInterval = setInterval(() => {
      this.conversationManager.clearOldConversations(300000);
    }, 300000);
  }

  async runInitial(request: InitialRunRequest): Promise<ExecutionResult> {
    const options = request.options ?? {};
    const capability = this.validateCapability(request);
    const termination = this.createTerminationContext(options);
    const runOptions = { ...options, signal: termination.signal ?? options.signal };
    const conversationId = this.conversationManager.startConversation(request.toolName, request.systemMessage);
    const retainedRequested = request.policy.retention === 'retain';
    let retained = false;
    const artifacts: ResourceArtifact[] = [];
    const usedGuides: string[] = [];
    const requestedResources: string[] = [];
    let totalUsage: TokenUsage | undefined;

    if (retainedRequested) this.conversationManager.pinConversation(conversationId);
    this.outputChannel?.appendLine(
      `[AgentRunEngine] Starting ${request.policy.id} run for ${request.toolName} ` +
      `(catalog: ${request.policy.resourceCatalog}, retention: ${request.policy.retention})`
    );

    try {
      const firstUserMessage = capability
        ? await capability.appendCatalog(request.userMessage)
        : request.userMessage;
      this.conversationManager.addMessage(conversationId, { role: 'user', content: firstUserMessage });

      let last = await this.executeTurn(
        this.conversationManager.getMessages(conversationId),
        runOptions,
        capability
      );
      totalUsage = this.addUsage(totalUsage, last.usage);
      let rounds = 0;

      while (!last.cancelled && capability && last.exactDirective && rounds < request.policy.maxCapabilityRounds) {
        const requestedPaths = last.exactDirective;
        rounds += 1;
        this.statusCallback?.(capability.statusMessage(requestedPaths));
        this.conversationManager.addMessage(conversationId, { role: 'assistant', content: last.content });
        const fulfillment = await capability.fulfill(requestedPaths);
        artifacts.push(...fulfillment.artifacts);
        if (capability.catalog === 'guides') usedGuides.push(...fulfillment.deliveredPaths);
        if (capability.catalog === 'projectContext') requestedResources.push(...fulfillment.deliveredPaths);
        this.conversationManager.addMessage(conversationId, { role: 'user', content: fulfillment.evidence });
        last = await this.executeTurn(
          this.conversationManager.getMessages(conversationId),
          runOptions,
          capability
        );
        totalUsage = this.addUsage(totalUsage, last.usage);
      }

      if (!last.cancelled && capability && last.exactDirective && request.policy.onCapabilityLimit === 'forceFinalResponse') {
        this.outputChannel?.appendLine(`[AgentRunEngine] ${request.policy.id} reached ${request.policy.maxCapabilityRounds} capability rounds; forcing final response.`);
        this.conversationManager.addMessage(conversationId, { role: 'assistant', content: last.content });
        this.conversationManager.addMessage(conversationId, { role: 'user', content: capability.limitInstruction() });
        last = await this.executeTurn(
          this.conversationManager.getMessages(conversationId),
          runOptions,
          capability
        );
        totalUsage = this.addUsage(totalUsage, last.usage);
      }

      const visibleContent = this.toVisibleContent(last.content, last.finishReason, capability);
      const cancelled = last.cancelled || this.isAborted(runOptions.signal);
      if (retainedRequested && !cancelled) {
        this.conversationManager.addMessage(conversationId, { role: 'assistant', content: visibleContent });
        retained = true;
        this.outputChannel?.appendLine(`[AgentRunEngine] Retained conversation ${conversationId} for ${request.toolName}.`);
      }

      return {
        content: visibleContent,
        usedGuides: [...new Set(usedGuides)],
        requestedResources: [...new Set(requestedResources)],
        artifacts,
        usage: totalUsage,
        finishReason: last.finishReason,
        cancelled,
        conversationId: retained ? conversationId : undefined
      };
    } finally {
      termination.dispose();
      if (!retained) this.conversationManager.deleteConversation(conversationId);
    }
  }

  /**
   * Retained continuation deliberately remains a history operation. It does
   * not advertise catalogs, trigger capabilities, or enter initial-run loops.
   */
  async continueConversation(
    conversationId: string,
    userMessage: string,
    options: AgentRunOptions = {}
  ): Promise<ExecutionResult> {
    if (!this.conversationManager.hasConversation(conversationId)) {
      throw new ConversationNotFoundError(conversationId);
    }
    const termination = this.createTerminationContext(options);
    const runOptions = { ...options, signal: termination.signal ?? options.signal };
    const userTurn: OpenRouterMessage = { role: 'user', content: userMessage };
    try {
      const result = await this.executeTurn(
        [...this.conversationManager.getMessages(conversationId), userTurn],
        runOptions
      );
      const visibleContent = this.toVisibleContent(result.content, result.finishReason);
      const cancelled = result.cancelled || this.isAborted(runOptions.signal);
      if (!cancelled) {
        this.conversationManager.addMessage(conversationId, userTurn);
        this.conversationManager.addMessage(conversationId, { role: 'assistant', content: visibleContent });
        this.outputChannel?.appendLine(`[AgentRunEngine] Continued conversation ${conversationId}.`);
      }
      return {
        content: visibleContent,
        usedGuides: [],
        requestedResources: [],
        artifacts: [],
        usage: result.usage,
        finishReason: result.finishReason,
        cancelled,
        conversationId
      };
    } finally {
      termination.dispose();
    }
  }

  discardConversation(conversationId: string): void {
    this.conversationManager.deleteConversation(conversationId);
  }

  setStatusCallback(callback?: StatusCallback): void {
    this.statusCallback = callback;
  }

  setTokenUsageCallback(callback?: TokenUsageCallback): void {
    this.tokenUsageCallback = callback;
  }

  dispose(): void {
    clearInterval(this.conversationCleanupInterval);
  }

  private validateCapability(request: InitialRunRequest): AgentCapability | undefined {
    if (request.policy.resourceCatalog === 'none') {
      if (request.capability) throw new Error(`Run policy ${request.policy.id} forbids a capability adapter.`);
      return undefined;
    }
    if (!request.capability || request.capability.catalog !== request.policy.resourceCatalog) {
      throw new Error(`Run policy ${request.policy.id} requires the ${request.policy.resourceCatalog} capability adapter.`);
    }
    return request.capability;
  }

  private async executeTurn(
    messages: OpenRouterMessage[],
    options: AgentRunOptions,
    capability?: AgentCapability
  ): Promise<TurnResult> {
    if (!options.onToken) {
      try {
        const response = await this.openRouterClient.createChatCompletion(messages, {
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          signal: options.signal
        });
        this.emitUsage(response.usage);
        return {
          content: response.content,
          finishReason: response.finishReason,
          usage: response.usage,
          cancelled: this.isAborted(options.signal),
          exactDirective: capability?.parseExactDirective(response.content)
        };
      } catch (error) {
        if (this.isAbortError(error)) {
          return { content: '', cancelled: true };
        }
        throw error;
      }
    }

    let content = '';
    let usage: TokenUsage | undefined;
    let finishReason: string | undefined;
    let cancelled = false;
    let classification: 'undecided' | 'text' | 'candidate' = 'undecided';

    try {
      for await (const chunk of this.openRouterClient.createStreamingChatCompletion(messages, {
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        signal: options.signal
      })) {
        if (chunk.done) {
          usage = chunk.usage;
          finishReason = chunk.finishReason ?? finishReason;
          continue;
        }
        if (!chunk.token) continue;
        content += chunk.token;
        if (classification === 'undecided') {
          const firstNonWhitespace = content.match(/\S/)?.[0];
          if (!firstNonWhitespace) continue;
          classification = firstNonWhitespace === '<' ? 'candidate' : 'text';
          if (classification === 'text') options.onToken(content);
          continue;
        }
        if (classification === 'text') options.onToken(chunk.token);
      }
    } catch (error) {
      if (this.isAbortError(error)) {
        cancelled = true;
      } else {
        throw error;
      }
    }

    this.emitUsage(usage);
    const exactDirective = capability?.parseExactDirective(content);
    if (classification === 'candidate' && !exactDirective) {
      // A malformed or accidental directive is never streamed raw. Reveal any
      // remaining prose only after protocol stripping has completed.
      const safe = this.stripAllDirectives(content, capability);
      if (safe) options.onToken(safe);
    }
    return { content, finishReason, usage, cancelled, exactDirective };
  }

  private toVisibleContent(content: string, finishReason?: string, capability?: AgentCapability): string {
    const cleaned = this.stripAllDirectives(content, capability);
    return `${cleaned}${finishReason === 'length' ? '\n\n---\n\n⚠️ Response truncated. Increase Max Tokens in settings.' : ''}`;
  }

  private stripAllDirectives(content: string, capability?: AgentCapability): string {
    const capabilityClean = capability ? capability.stripDirectives(content) : content;
    return capabilityClean.replace(ANY_CAPABILITY_DIRECTIVE, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  private addUsage(total: TokenUsage | undefined, usage: TokenUsage | undefined): TokenUsage | undefined {
    if (!usage) return total;
    if (!total) return { ...usage };
    return {
      promptTokens: total.promptTokens + usage.promptTokens,
      completionTokens: total.completionTokens + usage.completionTokens,
      totalTokens: total.totalTokens + usage.totalTokens,
      costUsd: typeof total.costUsd === 'number' || typeof usage.costUsd === 'number'
        ? (total.costUsd ?? 0) + (usage.costUsd ?? 0)
        : undefined
    };
  }

  private emitUsage(usage?: TokenUsage): void {
    if (usage) this.tokenUsageCallback?.(usage);
  }

  private createTerminationContext(options: AgentRunOptions): TerminationContext {
    if (!options.timeoutMs && !options.signal) return { dispose: () => {} };
    const controller = new AbortController();
    let timeout: NodeJS.Timeout | undefined;
    const abort = (reason: unknown) => {
      if (!controller.signal.aborted) controller.abort(reason instanceof Error ? reason : new Error(String(reason ?? 'Aborted')));
    };
    const listener = () => abort(options.signal?.reason ?? new Error('Aborted'));
    if (options.signal) {
      if (options.signal.aborted) listener();
      else options.signal.addEventListener('abort', listener, { once: true });
    }
    if (options.timeoutMs) timeout = setTimeout(() => abort(new Error(`Request timed out after ${options.timeoutMs}ms`)), options.timeoutMs);
    return {
      signal: controller.signal,
      dispose: () => {
        if (timeout) clearTimeout(timeout);
        options.signal?.removeEventListener('abort', listener);
      }
    };
  }

  private isAborted(signal?: AbortSignal): boolean {
    return signal?.aborted ?? false;
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
  }
}
