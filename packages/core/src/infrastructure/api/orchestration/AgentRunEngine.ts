import { LogSink, SettingsStore } from '@/platform';
import { OpenRouterClient, OpenRouterMessage } from '@providers/OpenRouterClient';
import {
  ConversationManager,
  ConversationNotFoundError,
  ConversationSystemMessageReplacement
} from './ConversationManager';
import {
  AgentCapabilityRejection,
  AgentRunOptions,
  AnyAgentCapability,
  CapabilityArtifact,
  CapabilityDeliveredSource,
  ContinuationRunRequest,
  ExecutionResult,
  InitialRunRequest,
  RunPolicy
} from './AgentRunContracts';
import { findExecutableMarkerIndex } from './ResourceReadXmlCodec';
import { wrapAgentFetchedArtifactEvidence } from '@/utils/workshopPromptFrames';
import {
  ContextBudgetSnapshot,
  ContextSourceEntry,
  InferenceRequestObservation,
  TokenUsage
} from '@shared/types';

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
  readonly observation?: InferenceRequestObservation;
  readonly cancelled: boolean;
  /** Candidate XML tool calls are withheld from visible streaming until validated. */
  readonly exactRequest?: unknown;
  /** A protocol-shaped response failed structural or allow-list validation. */
  readonly invalidRequest?: AgentCapabilityRejection;
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
const isNarratedCapabilityIntent = (content: string): boolean =>
  /^(?:i\s+(?:need|want|will|must|should|have)\b[\s\S]{0,120}\b(?:access|load|read|request|pull|consult|check|review|use|look\s+up|analy[sz]e|search)\b|let me\s+(?:access|load|read|request|pull|consult|check|review|look\s+up|analy[sz]e|search)\b)/i
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
      const visibleSafe = isProtocolPreambleOnly(safe) || isNarratedCapabilityIntent(safe) ? '' : safe;
      this.visible += visibleSafe;
      this.withheld = (visibleSafe ? '' : safe) + this.pending.slice(toolCallIndex);
      this.pending = '';
      this.blocked = true;
      return visibleSafe;
    }

    // Some models narrate their lookup decision before emitting the XML call.
    // Hold that short planning preamble so it can be discarded if a call
    // follows, while ordinary analysis prose keeps streaming as before.
    if (this.pending.length <= NARRATION_HOLD_CHARS && isNarratedCapabilityIntent(this.pending)) {
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
 * The single per-turn engine. It owns transport, cancellation, retention,
 * bounded capability/correction rounds, output visibility, token accounting,
 * and atomic history commits. Capability adapters own protocol and I/O.
 */
export class AgentRunEngine {
  private readonly conversationCleanupInterval: NodeJS.Timeout;
  /**
   * Conversation ids with an in-flight run, marked for the entire span in
   * which a run reads or commits history (ADR 2026-07-20). The between-run
   * system-message replacement seam consults this set, so a mode change can
   * never swap a system prompt out from under a run that already read it.
   */
  private readonly activeConversationIds = new Set<string>();

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
    const capability = this.validateCapability(request);
    const conversationId = this.conversationManager.startConversation(request.toolName, request.systemMessage);
    // Active from creation: the first turn is already committed to reading
    // and committing this conversation, so no between-run replacement may
    // interleave with it (ADR 2026-07-20).
    this.activeConversationIds.add(conversationId);
    const retainedRequested = request.policy.retention === 'retain';
    let retained = false;

    if (retainedRequested) this.conversationManager.pinConversation(conversationId);
    this.outputChannel?.appendLine(
      `[AgentRunEngine] Starting ${request.policy.id} run for ${request.toolName} ` +
      `(capability: ${request.policy.capabilityCatalog}, retention: ${request.policy.retention})`
    );

    try {
      const firstUserMessage = capability
        ? await capability.appendContract(request.userMessage)
        : request.userMessage;
      const result = await this.executeConversationTurn(
        conversationId,
        firstUserMessage,
        request.policy,
        capability,
        request.options ?? {}
      );
      retained = retainedRequested && !result.cancelled;
      if (retained) {
        this.outputChannel?.appendLine(`[AgentRunEngine] Retained conversation ${conversationId} for ${request.toolName}.`);
      }
      return { ...result, conversationId: retained ? conversationId : undefined };
    } finally {
      // Success, cancellation, and transport failure all settle through here,
      // so an id can never stay active after its run is over.
      this.activeConversationIds.delete(conversationId);
      if (!retained) this.conversationManager.deleteConversation(conversationId);
    }
  }

  /** Continue retained history through the same bounded per-turn engine. */
  async continueConversation(request: ContinuationRunRequest): Promise<ExecutionResult> {
    if (!this.conversationManager.hasConversation(request.conversationId)) {
      throw new ConversationNotFoundError(request.conversationId);
    }
    const capability = this.validateCapability(request);
    // Active before the first history read; released in the finally so that
    // cancellation and transport failure cannot leak the mark (ADR 2026-07-20).
    this.activeConversationIds.add(request.conversationId);
    try {
      const userMessage = capability?.appendTurnContract
        ? await capability.appendTurnContract(request.userMessage)
        : request.userMessage;
      const result = await this.executeConversationTurn(
        request.conversationId,
        userMessage,
        request.policy,
        capability,
        request.options ?? {}
      );
      if (!result.cancelled) {
        this.outputChannel?.appendLine(`[AgentRunEngine] Continued conversation ${request.conversationId}.`);
      }
      return { ...result, conversationId: request.conversationId };
    } finally {
      this.activeConversationIds.delete(request.conversationId);
    }
  }

  /**
   * Execute one initial or retained user turn against a working transcript.
   * Intermediate calls/evidence are committed together with final prose only
   * after success, so cancellation and transport failure leave history clean.
   */
  private async executeConversationTurn(
    conversationId: string,
    userMessage: string,
    policy: RunPolicy,
    capability: AnyAgentCapability | undefined,
    options: AgentRunOptions
  ): Promise<ExecutionResult> {
    const termination = this.createTerminationContext(options);
    const runOptions = { ...options, signal: termination.signal ?? options.signal };
    const history = this.conversationManager.getMessages(conversationId);
    const pendingMessages: OpenRouterMessage[] = [{ role: 'user', content: userMessage }];
    const artifacts: CapabilityArtifact[] = [];
    const usedGuides: string[] = [];
    const requestedResources: string[] = [];
    const collectedSources: ContextSourceEntry[] = [];
    let totalUsage: TokenUsage | undefined;
    let latestObservation: InferenceRequestObservation | undefined;
    let peakPromptTokens = 0;
    let correctionTurns = 0;

    const recordObservation = (observation?: InferenceRequestObservation): void => {
      if (!observation) return;
      latestObservation = observation;
      peakPromptTokens = Math.max(peakPromptTokens, observation.promptTokens);
    };

    const currentMessages = (): OpenRouterMessage[] => [...history, ...pendingMessages];
    const runInstructedTurn = async (
      previous: TurnResult,
      instruction: string
    ): Promise<TurnResult> => {
      pendingMessages.push(
        { role: 'assistant', content: previous.content },
        { role: 'user', content: instruction }
      );
      const next = await this.executeTurn(currentMessages(), runOptions, capability);
      recordObservation(next.observation);
      totalUsage = this.addUsage(totalUsage, next.usage);
      return next;
    };

    const recoverInvalidRequest = async (last: TurnResult): Promise<TurnResult> => {
      const rejection = last.invalidRequest;
      if (!capability || last.cancelled || !rejection) {
        return last;
      }
      artifacts.push(...(capability.handleInvalidRequest?.(rejection) ?? []));
      if (correctionTurns >= policy.maxCorrectionTurns) {
        const fallback = 'The assistant could not produce a usable final response after its capability request was rejected. Please try again.';
        this.outputChannel?.appendLine(
          `[AgentRunEngine] ${policy.id} exhausted ${policy.maxCorrectionTurns} correction turn(s).`
        );
        runOptions.onToken?.(fallback);
        return { ...last, content: fallback, visibleContent: fallback, invalidRequest: undefined };
      }
      correctionTurns += 1;
      this.outputChannel?.appendLine(
        `[AgentRunEngine] ${policy.id} correction turn ${correctionTurns}/${policy.maxCorrectionTurns} after a rejected capability request.`
      );
      const recovered = await runInstructedTurn(
        last,
        capability.invalidRequestInstruction(rejection)
      );
      return recovered.invalidRequest ? recoverInvalidRequest(recovered) : recovered;
    };

    try {
      let last = await this.executeTurn(currentMessages(), runOptions, capability);
      recordObservation(last.observation);
      totalUsage = this.addUsage(totalUsage, last.usage);
      last = await recoverInvalidRequest(last);
      let rounds = 0;

      while (!last.cancelled && capability && last.exactRequest && rounds < policy.maxCapabilityRounds) {
        const request = last.exactRequest;
        rounds += 1;
        this.statusCallback?.(
          capability.statusMessage(request),
          capability.statusTicker?.(request)
        );
        // Provider-measured cost attribution (Phase 7): the prompt-token
        // delta between this round's observation and the next one belongs
        // to the evidence delivered between them.
        const promptTokensBeforeEvidence = latestObservation?.promptTokens;
        const fulfillment = await capability.fulfill(request);
        totalUsage = this.addUsage(totalUsage, fulfillment.usage);
        artifacts.push(...fulfillment.artifacts);
        if (capability.catalog === 'guides') usedGuides.push(...fulfillment.deliveredItems);
        if (capability.catalog === 'projectContext') requestedResources.push(...fulfillment.deliveredItems);
        if (capability.catalog === 'workshopToolContext') {
          // The composite catalog delivers both kinds in one round; each
          // artifact already declares which side it came from.
          for (const artifact of fulfillment.artifacts) {
            (artifact.catalog === 'guides' ? usedGuides : requestedResources).push(artifact.id);
          }
        }
        // Retained-history evidence gets a stable `art-N` address at injection
        // (ADR 2026-07-18): the Phase 7 manifest and tombstone surgery target
        // stored entries by this id. Discarded runs need no address.
        const artifactId = policy.retention === 'retain'
          ? this.conversationManager.nextArtifactId(conversationId)
          : undefined;
        const evidence = artifactId
          ? wrapAgentFetchedArtifactEvidence(artifactId, fulfillment.evidence)
          : fulfillment.evidence;
        this.outputChannel?.appendLine(
          `[AgentRunEngine] Fulfilled ${capability.catalog} capability ${rounds}/${policy.maxCapabilityRounds} ` +
          `(${capability.requestLogSummary(request)}): ${fulfillment.evidence.length} evidence chars; ` +
          `delivered=${fulfillment.deliveredItems.join(', ') || 'none'}` +
          (artifactId ? `; artifactId=${artifactId}` : '')
        );
        last = await runInstructedTurn(last, evidence);
        if (policy.retention === 'retain' && fulfillment.deliveredSources?.length) {
          collectedSources.push(...this.toContextSourceEntries(
            fulfillment.deliveredSources,
            capability.catalog === 'workshopPersona' ? 'host' : 'tool',
            promptTokensBeforeEvidence,
            latestObservation?.promptTokens,
            artifactId
          ));
        }
        last = await recoverInvalidRequest(last);
      }

      if (!last.cancelled && capability && last.exactRequest && policy.onCapabilityLimit === 'forceFinalResponse') {
        artifacts.push(...(capability.handleCapabilityLimit?.(last.exactRequest) ?? []));
        this.outputChannel?.appendLine(
          `[AgentRunEngine] ${policy.id} reached ${policy.maxCapabilityRounds} capability rounds; forcing final response.`
        );
        last = await runInstructedTurn(last, capability.limitInstruction());
        if (this.needsForcedFinalRetry(last)) {
          this.outputChannel?.appendLine(
            `[AgentRunEngine] ${policy.id} returned another capability call during its forced-final turn; retrying once.`
          );
          last = await runInstructedTurn(last, capability.limitInstruction());
        }
        last = await recoverInvalidRequest(last);
        if (this.needsForcedFinalRetry(last)) {
          const fallback = 'The assistant exhausted its capability-call limit without returning a final response. Please try again.';
          this.outputChannel?.appendLine(
            `[AgentRunEngine] ${policy.id} did not produce final prose after the forced-final retry.`
          );
          runOptions.onToken?.(fallback);
          last = {
            ...last,
            content: fallback,
            visibleContent: fallback,
            exactRequest: undefined,
            invalidRequest: undefined
          };
        }
      }

      let visibleContent = this.toVisibleContent(
        last.content,
        last.finishReason,
        capability,
        last.visibleContent
      );
      const cancelled = last.cancelled || this.isAborted(runOptions.signal);
      if (!visibleContent && !cancelled) {
        visibleContent = 'The assistant returned no usable final response. Please try again.';
        runOptions.onToken?.(visibleContent);
        this.outputChannel?.appendLine(`[AgentRunEngine] ${policy.id} completed with no visible final prose.`);
      }
      if (!cancelled) {
        pendingMessages.push({ role: 'assistant', content: visibleContent });
        this.conversationManager.addMessages(conversationId, pendingMessages);
        if (collectedSources.length > 0) {
          // Manifest rows commit ONLY beside a committed turn (Phase 7):
          // cancellation and transport failure preserve the prior manifest.
          this.conversationManager.appendContextSources(conversationId, collectedSources);
          this.outputChannel?.appendLine(
            `[AgentRunEngine] Context sources committed for ${conversationId}: ` +
            collectedSources.map((entry) =>
              `${entry.kind}:${entry.label}${entry.promptTokensDelta !== undefined ? ` (+${entry.promptTokensDelta} prompt tokens)` : ' (size estimate)'}`
            ).join(', ')
          );
        }
        if (latestObservation && totalUsage) {
          const snapshot = this.toContextBudgetSnapshot(latestObservation, peakPromptTokens, totalUsage);
          this.conversationManager.setContextBudget(conversationId, snapshot);
          // One line per committed reading, so a moving gauge can be diagnosed
          // from the log: a different conversation id means a target switch,
          // the same id shrinking means the provider re-measured or compressed.
          this.outputChannel?.appendLine(
            `[AgentRunEngine] Context snapshot committed for ${conversationId}: ` +
            `context=${snapshot.contextTokens} (prompt ${snapshot.promptTokens} + completion ${snapshot.completionTokens}), ` +
            `model=${snapshot.modelId}, calls=${snapshot.callsThisTurn}, processed=${snapshot.turnProcessedTokens}, ` +
            `compression=${snapshot.contextCompression}`
          );
        }
      }

      return {
        content: visibleContent,
        usedGuides: [...new Set(usedGuides)],
        requestedResources: [...new Set(requestedResources)],
        artifacts,
        usage: totalUsage,
        finishReason: last.finishReason,
        cancelled
      };
    } finally {
      termination.dispose();
    }
  }

  discardConversation(conversationId: string): void {
    this.conversationManager.deleteConversation(conversationId);
  }

  /** True while a run is reading or committing this conversation's history. */
  isConversationActive(conversationId: string): boolean {
    return this.activeConversationIds.has(conversationId);
  }

  /**
   * Guarded between-run seam for the mode-change batch (ADR 2026-07-20). A
   * retained system message may be replaced atomically between runs but never
   * while a run is reading or committing that conversation, so any active
   * target rejects the whole batch here before the manager even validates it
   * — no conversation changes, active or idle.
   */
  replaceSystemMessagesBetweenRuns(replacements: readonly ConversationSystemMessageReplacement[]): void {
    const activeTargets = replacements
      .map(replacement => replacement.conversationId)
      .filter(conversationId => this.activeConversationIds.has(conversationId));
    if (activeTargets.length > 0) {
      throw new Error(
        `Cannot replace system messages while a run is active for conversation(s): ${[...new Set(activeTargets)].join(', ')}`
      );
    }
    this.conversationManager.replaceSystemMessages(replacements);
  }

  getConversationContextBudget(conversationId: string | undefined): ContextBudgetSnapshot | undefined {
    return this.conversationManager.getContextBudget(conversationId);
  }

  getConversationContextSources(conversationId: string | undefined): ContextSourceEntry[] {
    return this.conversationManager.getContextSources(conversationId);
  }

  /**
   * Attribute one capability round's provider-measured prompt-token delta to
   * the sources it delivered (Phase 7). A single-source round gets the exact
   * delta; multi-source rounds apportion by size share and stay estimates;
   * missing observations fall back to size-only rows.
   */
  private toContextSourceEntries(
    delivered: readonly CapabilityDeliveredSource[],
    origin: 'host' | 'tool',
    promptTokensBefore: number | undefined,
    promptTokensAfter: number | undefined,
    artifactId: string | undefined
  ): ContextSourceEntry[] {
    const roundDelta = promptTokensBefore !== undefined &&
      promptTokensAfter !== undefined &&
      promptTokensAfter > promptTokensBefore
      ? promptTokensAfter - promptTokensBefore
      : undefined;
    const totalChars = delivered.reduce((total, source) => total + source.sizeChars, 0);
    return delivered.map((source) => {
      const exact = roundDelta !== undefined && delivered.length === 1;
      const apportioned = roundDelta !== undefined && delivered.length > 1
        ? Math.round(roundDelta * (totalChars > 0 ? source.sizeChars / totalChars : 1 / delivered.length))
        : undefined;
      return {
        kind: source.kind,
        origin,
        label: source.label,
        configuredResource: source.configuredResource ? { ...source.configuredResource } : undefined,
        sizeChars: source.sizeChars,
        promptTokensDelta: exact ? roundDelta : apportioned,
        isEstimate: !exact,
        artifactId,
        deliveredAt: Date.now()
      };
    });
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

  private validateCapability(
    request: Pick<InitialRunRequest | ContinuationRunRequest, 'policy' | 'capability'>
  ): AnyAgentCapability | undefined {
    if (request.policy.capabilityCatalog === 'none') {
      if (request.capability) throw new Error(`Run policy ${request.policy.id} forbids a capability adapter.`);
      return undefined;
    }
    if (!request.capability || request.capability.catalog !== request.policy.capabilityCatalog) {
      throw new Error(
        `Run policy ${request.policy.id} requires the ${request.policy.capabilityCatalog} capability adapter.`
      );
    }
    return request.capability;
  }

  private async executeTurn(
    messages: OpenRouterMessage[],
    options: AgentRunOptions,
    capability?: AnyAgentCapability
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
          observation: response.observation,
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
    let observation: InferenceRequestObservation | undefined;
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
          usage = chunk.usage ?? usage;
          finishReason = chunk.finishReason ?? finishReason;
          observation = chunk.observation ?? observation;
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
      observation,
      cancelled,
      exactRequest,
      invalidRequest
    };
  }

  private toVisibleContent(
    content: string,
    finishReason?: string,
    capability?: AnyAgentCapability,
    streamedVisibleContent?: string
  ): string {
    const cleaned = (streamedVisibleContent ?? this.stripAllToolCalls(content, capability))
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return `${cleaned}${finishReason === 'length' ? '\n\n---\n\n⚠️ Response truncated. Increase Max Tokens in settings.' : ''}`;
  }

  private stripAllToolCalls(content: string, capability?: AnyAgentCapability): string {
    const capabilityClean = capability ? capability.stripToolCalls(content) : content;
    return capabilityClean.replace(/\n{3,}/g, '\n\n').trim();
  }

  private needsForcedFinalRetry(last: TurnResult): boolean {
    return Boolean(!last.cancelled && last.exactRequest);
  }

  private logCapabilityInspection(
    capability: AnyAgentCapability | undefined,
    inspection: ReturnType<AnyAgentCapability['inspectRequest']> | undefined,
    content: string
  ): void {
    if (!capability || !inspection || inspection.kind === 'none') return;
    const context = capability.inspectionLogContext?.();
    const attribution = context ? ` ${context}` : '';
    if (inspection.kind === 'request') {
      this.outputChannel?.appendLine(
        `[AgentRunEngine] Accepted ${capability.catalog} capability request${attribution}: ${capability.requestLogSummary(inspection.request)}`
      );
      return;
    }

    this.outputChannel?.appendLine(
      `[AgentRunEngine] Rejected ${capability.catalog} capability request${attribution}: reason=${inspection.reason}.`
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
      `[AgentRunEngine] BEGIN REJECTED CAPABILITY RESPONSE (${content.length} chars; may contain quoted user text)`
    );
    this.outputChannel?.appendLine(content);
    this.outputChannel?.appendLine('[AgentRunEngine] END REJECTED CAPABILITY RESPONSE');
  }

  private addUsage(total: TokenUsage | undefined, usage: TokenUsage | undefined): TokenUsage | undefined {
    if (!usage) return total;
    if (!total) return { ...usage, requestCount: usage.requestCount ?? 1 };
    return {
      promptTokens: total.promptTokens + usage.promptTokens,
      completionTokens: total.completionTokens + usage.completionTokens,
      totalTokens: total.totalTokens + usage.totalTokens,
      requestCount: (total.requestCount ?? 1) + (usage.requestCount ?? 1),
      costUsd: typeof total.costUsd === 'number' || typeof usage.costUsd === 'number'
        ? (total.costUsd ?? 0) + (usage.costUsd ?? 0)
        : undefined
    };
  }

  private emitUsage(usage?: TokenUsage): void {
    if (usage) this.tokenUsageCallback?.(usage);
  }

  private toContextBudgetSnapshot(
    observation: InferenceRequestObservation,
    peakPromptTokensThisTurn: number,
    turnUsage: TokenUsage
  ): ContextBudgetSnapshot {
    return {
      modelId: observation.modelId,
      contextTokens: observation.promptTokens + observation.completionTokens,
      promptTokens: observation.promptTokens,
      completionTokens: observation.completionTokens,
      peakPromptTokensThisTurn,
      requestedMaxOutputTokens: observation.requestedMaxOutputTokens,
      callsThisTurn: turnUsage.requestCount ?? 1,
      turnProcessedTokens: turnUsage.totalTokens,
      contextCompression: observation.contextCompression,
      measuredAt: observation.measuredAt
    };
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
