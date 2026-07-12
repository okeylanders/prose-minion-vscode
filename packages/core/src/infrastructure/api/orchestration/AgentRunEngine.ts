import { LogSink, SettingsStore } from '@/platform';
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
import { findExecutableMarkerIndex, ResourceReadInspection, ResourceReadRequest } from './ResourceReadXmlCodec';
import { TokenUsage } from '@shared/types';

export type StatusCallback = (message: string, tickerMessage?: string) => void;
export type TokenUsageCallback = (usage: TokenUsage) => void;

interface TerminationContext {
  readonly signal?: AbortSignal;
  dispose(): void;
}

interface TurnResult {
  readonly content: string;
  /** Sanitized content emitted incrementally for a capability-enabled turn. */
  readonly visibleContent?: string;
  readonly finishReason?: string;
  readonly usage?: TokenUsage;
  readonly cancelled: boolean;
  /** Candidate XML tool calls are withheld from visible streaming until validated. */
  readonly exactRequest?: ResourceReadRequest;
  /** A protocol-shaped response failed structural or allow-list validation. */
  readonly invalidRequest?: Extract<ResourceReadInspection, { kind: 'invalid' }>;
}

const TOOL_CALL_OPEN = '<prose-minion-tool-call';
/**
 * How long a narrated-intent opener is held before streaming resumes. Live
 * narrations before a call run one or two sentences; anything longer is a
 * genuine answer that merely opened with "Let me check…", and holding it
 * would silently defeat progressive streaming.
 */
const NARRATION_HOLD_CHARS = 300;
const isProtocolPreambleOnly = (content: string): boolean =>
  /^\s*(?:```(?:xml)?|<\?xml\s+[^?]*\?>)?\s*$/i.test(content);
const isNarratedResourceIntent = (content: string): boolean =>
  /^(?:i\s+(?:need|want|will|must|should|have)\b[\s\S]{0,120}\b(?:access|load|read|request|pull|consult|check|review|use)\b|let me\s+(?:access|load|read|request|pull|consult|check|review)\b)/i
    .test(content.trimStart());

/**
 * A visibility guard, not an XML parser. The shared SAX codec remains the
 * only authority that decides whether a whole response is executable. This
 * guard holds a short suffix so protocol markup cannot leak when it arrives
 * across streaming chunks, while ordinary prose keeps flowing immediately.
 */
class ToolCallStreamVisibilityGuard {
  private pending = '';
  private visible = '';
  private blocked = false;
  private withheld = '';

  consume(token: string): string {
    if (this.blocked) {
      this.withheld += token;
      return '';
    }
    this.pending += token;
    // Backtick-quoted markers are mentions, not calls, and keep streaming as
    // ordinary text; only an executable marker starts withholding.
    const toolCallIndex = findExecutableMarkerIndex(this.pending);
    if (toolCallIndex !== -1) {
      const safe = this.pending.slice(0, toolCallIndex);
      // A common invalid response copies the illustrative XML inside a
      // Markdown fence. Do not leave that fence as the user's entire answer;
      // withholding it lets the engine request a final prose recovery.
      const visibleSafe = isProtocolPreambleOnly(safe) || isNarratedResourceIntent(safe) ? '' : safe;
      this.visible += visibleSafe;
      this.withheld = (visibleSafe ? '' : safe) + this.pending.slice(toolCallIndex);
      this.pending = '';
      this.blocked = true;
      return visibleSafe;
    }

    // Some models narrate their lookup decision before emitting the XML call.
    // Hold that short planning preamble so it can be discarded if a call
    // follows, while ordinary analysis prose keeps streaming as before.
    if (this.pending.length <= NARRATION_HOLD_CHARS && isNarratedResourceIntent(this.pending)) {
      return '';
    }

    // Retain one char beyond a full marker so a preceding backtick stays
    // available for the mention check above.
    const safeLength = Math.max(0, this.pending.length - TOOL_CALL_OPEN.length);
    const safe = this.pending.slice(0, safeLength);
    this.pending = this.pending.slice(safeLength);
    this.visible += safe;
    return safe;
  }

  finish(): string {
    if (this.blocked) {
      return '';
    }
    const safe = this.pending;
    this.pending = '';
    this.visible += safe;
    return safe;
  }

  /**
   * Everything withheld since the marker. Called only when the completed
   * turn classified as ordinary prose ('none'), so an answer that turned out
   * to merely resemble the protocol is restored rather than truncated.
   */
  flushWithheld(): string {
    const flushed = this.withheld;
    this.withheld = '';
    if (flushed) {
      this.visible += flushed;
      this.blocked = false;
    }
    return flushed;
  }

  get content(): string {
    return this.visible;
  }
}

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
    private tokenUsageCallback?: TokenUsageCallback,
    private readonly settings?: SettingsStore
  ) {
    this.conversationCleanupInterval = setInterval(() => {
      this.conversationManager.clearOldConversations(300000);
    }, 300000);
  }

  /** Swap the transport model without disturbing retained conversation state. */
  setModel(model: string): void {
    this.openRouterClient.setModel(model);
  }

  getModel(): string {
    return this.openRouterClient.getModel();
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

      // The one shared turn-bookkeeping sequence: append the model's turn,
      // append the host instruction/evidence, run the next turn, accumulate
      // usage. Correction turns, capability rounds, and forced-final turns
      // all go through here so the sequence cannot drift apart.
      const runInstructedTurn = async (previous: TurnResult, instruction: string): Promise<TurnResult> => {
        this.conversationManager.addMessage(conversationId, { role: 'assistant', content: previous.content });
        this.conversationManager.addMessage(conversationId, { role: 'user', content: instruction });
        const next = await this.executeTurn(
          this.conversationManager.getMessages(conversationId),
          runOptions,
          capability
        );
        totalUsage = this.addUsage(totalUsage, next.usage);
        return next;
      };

      const recoverInvalidRequest = async (last: TurnResult): Promise<TurnResult> => {
        const rejection = last.invalidRequest;
        if (!capability || last.cancelled || !rejection) {
          return last;
        }
        this.outputChannel?.appendLine(`[AgentRunEngine] ${request.policy.id} is giving the model one correction turn after a rejected resource request.`);
        const recovered = await runInstructedTurn(last, capability.invalidRequestInstruction(rejection));
        if (recovered.invalidRequest) {
          const fallback = 'The assistant could not produce a usable final response after its resource request was rejected. Please try again.';
          this.outputChannel?.appendLine(`[AgentRunEngine] ${request.policy.id} repeated an invalid resource request after its correction turn.`);
          runOptions.onToken?.(fallback);
          return { ...recovered, content: fallback, visibleContent: fallback, invalidRequest: undefined };
        }
        return recovered;
      };

      let last = await this.executeTurn(
        this.conversationManager.getMessages(conversationId),
        runOptions,
        capability
      );
      totalUsage = this.addUsage(totalUsage, last.usage);
      last = await recoverInvalidRequest(last);
      let rounds = 0;

      while (!last.cancelled && capability && last.exactRequest && rounds < request.policy.maxCapabilityRounds) {
        const requestedPaths = last.exactRequest.paths;
        rounds += 1;
        this.statusCallback?.(
          capability.statusMessage(requestedPaths),
          capability.statusTicker?.(requestedPaths)
        );
        const fulfillment = await capability.fulfill(requestedPaths);
        this.outputChannel?.appendLine(
          `[AgentRunEngine] Delivered ${fulfillment.deliveredPaths.length}/${requestedPaths.length} ${capability.catalog} resource(s) ` +
          `as ${fulfillment.evidence.length} chars of evidence: ${fulfillment.deliveredPaths.join(', ') || 'none'}`
        );
        artifacts.push(...fulfillment.artifacts);
        if (capability.catalog === 'guides') usedGuides.push(...fulfillment.deliveredPaths);
        if (capability.catalog === 'projectContext') requestedResources.push(...fulfillment.deliveredPaths);
        last = await runInstructedTurn(last, fulfillment.evidence);
        last = await recoverInvalidRequest(last);
      }

      if (!last.cancelled && capability && last.exactRequest && request.policy.onCapabilityLimit === 'forceFinalResponse') {
        this.outputChannel?.appendLine(`[AgentRunEngine] ${request.policy.id} reached ${request.policy.maxCapabilityRounds} capability rounds; forcing final response.`);
        last = await runInstructedTurn(last, capability.limitInstruction());
        if (this.needsForcedFinalRetry(last)) {
          this.outputChannel?.appendLine(`[AgentRunEngine] ${request.policy.id} returned another tool call during its forced final turn; retrying once without resources.`);
          last = await runInstructedTurn(last, capability.limitInstruction());
        }
        last = await recoverInvalidRequest(last);
        if (this.needsForcedFinalRetry(last)) {
          const fallback = 'The assistant exhausted its resource-request limit without returning a final response. Please try again.';
          this.outputChannel?.appendLine(`[AgentRunEngine] ${request.policy.id} did not produce final prose after the forced-final retry.`);
          runOptions.onToken?.(fallback);
          last = { ...last, content: fallback, visibleContent: fallback, exactRequest: undefined, invalidRequest: undefined };
        }
      }

      let visibleContent = this.toVisibleContent(last.content, last.finishReason, capability, last.visibleContent);
      const cancelled = last.cancelled || this.isAborted(runOptions.signal);
      if (!visibleContent && !cancelled) {
        visibleContent = 'The assistant returned no usable final response. Please try again.';
        runOptions.onToken?.(visibleContent);
        this.outputChannel?.appendLine(`[AgentRunEngine] ${request.policy.id} completed with no visible final prose.`);
      }
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
        const inspection = capability?.inspectRequest(response.content);
        this.logCapabilityInspection(capability, inspection, response.content);
        return {
          content: response.content,
          finishReason: response.finishReason,
          usage: response.usage,
          cancelled: this.isAborted(options.signal),
          exactRequest: inspection?.kind === 'request' ? inspection.request : undefined,
          invalidRequest: inspection?.kind === 'invalid' ? inspection : undefined
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
    const visibilityGuard = capability ? new ToolCallStreamVisibilityGuard() : undefined;

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
        if (visibilityGuard) {
          const safe = visibilityGuard.consume(chunk.token);
          if (safe) {
            options.onToken(safe);
          }
          continue;
        }
        // Deliberately a different mechanism from ToolCallStreamVisibilityGuard:
        // capability-less turns (e.g. retained continuation) have no protocol
        // to enforce, so this only smooths the stream — an angle-bracket
        // opener buffers until validation, then the full content is revealed.
        // The guard, by contrast, gates capability turns and never reveals
        // executable protocol markup.
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
    const inspection = capability?.inspectRequest(content);
    this.logCapabilityInspection(capability, inspection, content);
    const exactRequest = inspection?.kind === 'request' ? inspection.request : undefined;
    const invalidRequest = inspection?.kind === 'invalid' ? inspection : undefined;
    if (visibilityGuard && inspection?.kind === 'none') {
      // The guard withheld from the first marker-like sequence, but the
      // completed turn is ordinary prose that mentions the protocol —
      // restore the answer instead of truncating it.
      const flushed = visibilityGuard.flushWithheld();
      if (flushed) {
        options.onToken(flushed);
      }
    }
    const trailingVisibleContent = visibilityGuard?.finish();
    if (trailingVisibleContent) {
      options.onToken(trailingVisibleContent);
    }
    if (!capability && classification === 'candidate' && !exactRequest) {
      // Candidate XML is buffered until exact validation. A malformed request
      // is not executable and its protocol markup never reaches visible chat.
      const safe = this.stripAllToolCalls(content, capability);
      if (safe) options.onToken(safe);
    }
    return {
      content,
      visibleContent: visibilityGuard?.content,
      finishReason,
      usage,
      cancelled,
      exactRequest,
      invalidRequest
    };
  }

  private toVisibleContent(
    content: string,
    finishReason?: string,
    capability?: AgentCapability,
    streamedVisibleContent?: string
  ): string {
    const cleaned = (streamedVisibleContent ?? this.stripAllToolCalls(content, capability))
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return `${cleaned}${finishReason === 'length' ? '\n\n---\n\n⚠️ Response truncated. Increase Max Tokens in settings.' : ''}`;
  }

  private stripAllToolCalls(content: string, capability?: AgentCapability): string {
    const capabilityClean = capability ? capability.stripToolCalls(content) : content;
    return capabilityClean.replace(/\n{3,}/g, '\n\n').trim();
  }

  private needsForcedFinalRetry(last: TurnResult): boolean {
    return Boolean(!last.cancelled && last.exactRequest);
  }

  private logCapabilityInspection(
    capability: AgentCapability | undefined,
    inspection: ResourceReadInspection | undefined,
    content: string
  ): void {
    if (!capability || !inspection || inspection.kind === 'none') return;
    if (inspection.kind === 'request') {
      this.outputChannel?.appendLine(
        `[AgentRunEngine] Accepted ${capability.catalog} resource request for ${inspection.request.paths.length} path(s): ${inspection.request.paths.join(', ')}`
      );
      return;
    }

    const pathCounts = inspection.pathCount === undefined
      ? ''
      : `; paths=${inspection.pathCount}; allowlisted=${inspection.allowlistedPathCount ?? 'unknown'}`;
    this.outputChannel?.appendLine(
      `[AgentRunEngine] Rejected ${capability.catalog} resource request: reason=${inspection.reason}${pathCounts}.`
    );
    // The full dump may quote the writer's manuscript, and Output channels
    // get pasted into public bug reports — so it is opt-in, not always-on.
    if (!this.settings?.get<boolean>('proseMinion', 'debugLogging', false)) {
      this.outputChannel?.appendLine(
        '[AgentRunEngine] Enable the proseMinion.debugLogging setting to log full rejected responses (may contain manuscript text).'
      );
      return;
    }
    this.outputChannel?.appendLine(
      `[AgentRunEngine] BEGIN REJECTED RESOURCE RESPONSE (${content.length} chars; may contain quoted user text)`
    );
    this.outputChannel?.appendLine(content);
    this.outputChannel?.appendLine('[AgentRunEngine] END REJECTED RESOURCE RESPONSE');
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
