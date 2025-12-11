/**
 * AI Resource Orchestrator - Application Layer
 * Orchestrates multi-turn conversations with agent capabilities (guide access, etc.)
 */

import * as vscode from 'vscode';
import { OpenRouterClient, OpenRouterMessage } from '@providers/OpenRouterClient';
import { GuideRegistry } from '@/infrastructure/guides/GuideRegistry';
import { GuideLoader } from '@/tools/shared/guides';
import { ConversationManager } from './ConversationManager';
import { ResourceRequestParser } from '@parsers/ResourceRequestParser';
import { ContextResourceRequestParser } from '@parsers/ContextResourceRequestParser';
import { ContextResourceContent, ContextResourceProvider, ContextResourceSummary } from '@/domain/models/ContextGeneration';
import { TokenUsage } from '@shared/types';
import { countWords, trimToWordLimit } from '@/utils/textUtils';

/**
 * Callback for receiving streaming tokens
 */
export type StreamingTokenCallback = (token: string) => void;

export interface AIOptions {
  includeCraftGuides?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** When provided, enables streaming mode and calls this callback for each token */
  onToken?: StreamingTokenCallback;
}

export interface ExecutionResult {
  content: string;
  usedGuides: string[];  // Paths of guides that were actually used
  requestedResources?: string[];  // Context resources that were loaded during the run
  usage?: TokenUsage;
  finishReason?: string;
  /** True if the request was cancelled via AbortSignal - content contains partial response */
  cancelled?: boolean;
}

export type StatusCallback = (message: string, tickerMessage?: string) => void;
export type TokenUsageCallback = (usage: TokenUsage) => void;

interface TerminationContext {
  signal?: AbortSignal;
  dispose: () => void;
}

export class AIResourceOrchestrator {
  private readonly MAX_TURNS = 3; // Safety limit to prevent infinite loops
  private readonly conversationCleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly openRouterClient: OpenRouterClient,
    private readonly conversationManager: ConversationManager,
    private readonly guideRegistry: GuideRegistry,
    private readonly guideLoader: GuideLoader,
    private statusCallback?: StatusCallback,
    private readonly outputChannel?: vscode.OutputChannel,
    private tokenUsageCallback?: TokenUsageCallback
  ) {
    // Periodically clean up old conversations (every 5 minutes)
    this.conversationCleanupInterval = setInterval(() => {
      this.conversationManager.clearOldConversations(300000); // 5 minutes
    }, 300000);
  }

  private createTerminationContext(options: AIOptions): TerminationContext {
    if (!options.timeoutMs && !options.signal) {
      return { signal: undefined, dispose: () => {} };
    }

    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;
    let externalAbortListener: (() => void) | undefined;

    const abortWithReason = (reason: unknown) => {
      if (!controller.signal.aborted) {
        controller.abort(reason instanceof Error ? reason : new Error(String(reason ?? 'Aborted')));
      }
    };

    if (options.signal) {
      if (options.signal.aborted) {
        abortWithReason(options.signal.reason ?? new Error('Aborted'));
      } else {
        externalAbortListener = () => abortWithReason(options.signal?.reason ?? new Error('Aborted'));
        options.signal.addEventListener('abort', externalAbortListener, { once: true });
      }
    }

    if (options.timeoutMs) {
      timeoutId = setTimeout(
        () => abortWithReason(new Error(`Request timed out after ${options.timeoutMs}ms`)),
        options.timeoutMs
      );
    }

    return {
      signal: controller.signal,
      dispose: () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (externalAbortListener && options.signal) {
          options.signal.removeEventListener('abort', externalAbortListener);
        }
      }
    };
  }

  private withTerminationSignal(options: AIOptions, termination: TerminationContext): AIOptions {
    return {
      ...options,
      signal: termination.signal ?? options.signal
    };
  }

  /**
   * Execute an AI request with agent capabilities support
   * Handles multi-turn conversations for guide requests
   */
  async executeWithAgentCapabilities(
    toolName: string,
    systemMessage: string,
    userMessage: string,
    options: AIOptions = {}
  ): Promise<ExecutionResult> {
    this.outputChannel?.appendLine(
      `\n[AIResourceOrchestrator] Starting conversation for ${toolName} (model: ${this.openRouterClient.getModel()})`
    );
    const conversationId = this.conversationManager.startConversation(toolName, systemMessage);
    const usedGuides: string[] = [];
    const termination = this.createTerminationContext(options);
    const requestOptions = this.withTerminationSignal(options, termination);

    try {
      // Build first user message
      let firstUserMessage = userMessage;

      // Only include guide list if setting is enabled
      if (options.includeCraftGuides !== false) {
        const availableGuides = await this.guideRegistry.listAvailableGuides();
        const guideList = this.guideRegistry.formatGuideListForPrompt(availableGuides);
        firstUserMessage += `\n\n${guideList}`;
        this.outputChannel?.appendLine(`[AIResourceOrchestrator] Added ${availableGuides.length} guides to prompt`);

        // Log preview of the guide list format
        this.outputChannel?.appendLine(`[AIResourceOrchestrator] Guide list preview (first 800 chars):`);
        this.outputChannel?.appendLine(guideList.substring(0, 800));
        if (guideList.length > 800) {
          this.outputChannel?.appendLine('...');
        }
      }

      // Log preview of the complete user message
      this.outputChannel?.appendLine(`[AIResourceOrchestrator] User message length: ${firstUserMessage.length} chars`);
      this.outputChannel?.appendLine(`[AIResourceOrchestrator] User message preview (first 500 chars):`);
      this.outputChannel?.appendLine(firstUserMessage.substring(0, 500));
      this.outputChannel?.appendLine('...');

      // Turn 1: Initial request
      const isStreaming = !!options.onToken;
      this.outputChannel?.appendLine(`[AIResourceOrchestrator] Turn 1: Sending initial request to AI (streaming: ${isStreaming})`);
      this.conversationManager.addMessage(conversationId, {
        role: 'user',
        content: firstUserMessage
      });

      let messages = this.conversationManager.getMessages(conversationId);
      this.outputChannel?.appendLine(
        `[AIResourceOrchestrator] Calling OpenRouter API (${messages.length} messages in context) using model ${this.openRouterClient.getModel()}`
      );
      let totalUsage: TokenUsage | undefined;
      let last: { content: string; finishReason?: string; usage?: TokenUsage };

      if (isStreaming) {
        // Use streaming with resource request detection
        const streamResult = await this.executeStreamingTurnWithDetection(
          messages,
          requestOptions,
          options.onToken
        );
        last = streamResult;
        // Emit token usage
        if (streamResult.usage) {
          this.emitTokenUsage({ usage: streamResult.usage });
          totalUsage = { ...streamResult.usage };
        }
      } else {
        // Non-streaming path
        last = await this.openRouterClient.createChatCompletion(messages, {
          temperature: requestOptions.temperature,
          maxTokens: requestOptions.maxTokens,
          signal: requestOptions.signal
        });
        // Emit token usage to callback and accumulate
        const firstUsage = this.emitTokenUsage(last);
        if (firstUsage) {
          totalUsage = { ...firstUsage };
        }
      }
      this.outputChannel?.appendLine(`[AIResourceOrchestrator] Received response from AI (${last.content.length} chars)`);

      // Log preview of AI response to see what it's saying
      this.outputChannel?.appendLine(`[AIResourceOrchestrator] AI response preview (first 500 chars):`);
      this.outputChannel?.appendLine(last.content.substring(0, 500));
      this.outputChannel?.appendLine('...');

      // Only check for guide requests if guides are enabled
      if (options.includeCraftGuides !== false) {
        let turnCount = 1;

        while (turnCount < this.MAX_TURNS) {
          this.outputChannel?.appendLine(`[AIResourceOrchestrator] Checking for guide requests in response...`);
          const resourceRequest = ResourceRequestParser.parse(last.content);

          if (!resourceRequest.hasGuideRequest) {
            // No guide request - we're done
            this.outputChannel?.appendLine(`[AIResourceOrchestrator] No guide request found, conversation complete`);
            break;
          }

          this.outputChannel?.appendLine(`[AIResourceOrchestrator] AI requested ${resourceRequest.requestedGuides.length} guides:`);
          resourceRequest.requestedGuides.forEach((guide: string, index: number) => {
            this.outputChannel?.appendLine(`  ${index + 1}. ${guide}`);
          });

          // Notify UI that we're loading guides
          if (this.statusCallback && resourceRequest.requestedGuides.length > 0) {
            const tickerMessage = ResourceRequestParser.formatGuideNamesForStatus(
              resourceRequest.requestedGuides
            );
            this.statusCallback('Loading requested craft guides...', tickerMessage);
          }

          // Turn N: Fulfill guide request
          turnCount++;
          this.outputChannel?.appendLine(`[AIResourceOrchestrator] Turn ${turnCount}: Fulfilling guide request`);
          const nextTurn = await this.fulfillGuideRequest(
            conversationId,
            last.content,
            resourceRequest.requestedGuides,
            requestOptions
          );

          // Track which guides were used
          usedGuides.push(...resourceRequest.requestedGuides);

          // Emit token usage to callback and accumulate
          const turnUsage = this.emitTokenUsage(nextTurn);
          if (turnUsage) {
            if (!totalUsage) {
              totalUsage = { ...turnUsage };
            } else {
              totalUsage.promptTokens += turnUsage.promptTokens;
              totalUsage.completionTokens += turnUsage.completionTokens;
              totalUsage.totalTokens += turnUsage.totalTokens;
              if (typeof totalUsage.costUsd === 'number' || typeof turnUsage.costUsd === 'number') {
                totalUsage.costUsd = (totalUsage.costUsd || 0) + (turnUsage.costUsd || 0);
              }
            }
          }

          // Prepare for the next loop iteration
          last = nextTurn;
        }

        if (turnCount >= this.MAX_TURNS) {
          this.outputChannel?.appendLine(`[AIResourceOrchestrator] Conversation ${conversationId} reached max turns (${this.MAX_TURNS})`);
        }
      }

      // Clean up and return final response
      const cleanedResponse = ResourceRequestParser.stripResourceTags(last.content);
      const truncatedNote = this.appendTruncationNote(last.content, last.finishReason);
      this.outputChannel?.appendLine(`[AIResourceOrchestrator] Conversation complete. Used ${usedGuides.length} guides total\n`);

      return {
        content: cleanedResponse + truncatedNote,
        usedGuides,
        requestedResources: [],
        usage: totalUsage,
        finishReason: last.finishReason
      };
    } finally {
      // Clean up conversation after completion
      termination.dispose();
      this.conversationManager.deleteConversation(conversationId);
    }
  }

  /**
   * Execute an AI request without guide-handling capabilities
   * Suitable for single-turn interactions that only need system + user prompts
   *
   * When options.onToken is provided, enables streaming mode where tokens are
   * delivered progressively via the callback. This allows for real-time display
   * of AI responses and enables effective cancellation (server stops generating).
   */
  async executeWithoutCapabilities(
    toolName: string,
    systemMessage: string,
    userMessage: string,
    options: AIOptions = {}
  ): Promise<ExecutionResult> {
    const isStreaming = !!options.onToken;
    this.outputChannel?.appendLine(
      `\n[AIResourceOrchestrator] Starting single-turn request for ${toolName} (model: ${this.openRouterClient.getModel()}, streaming: ${isStreaming})`
    );
    const conversationId = this.conversationManager.startConversation(toolName, systemMessage);
    const termination = this.createTerminationContext(options);
    const requestOptions = this.withTerminationSignal(options, termination);

    try {
      this.conversationManager.addMessage(conversationId, {
        role: 'user',
        content: userMessage
      });

      const messages = this.conversationManager.getMessages(conversationId);
      this.outputChannel?.appendLine(
        `[AIResourceOrchestrator] Calling OpenRouter API (${messages.length} messages in context) using model ${this.openRouterClient.getModel()}`
      );

      // Use streaming when onToken callback is provided
      if (options.onToken) {
        let fullContent = '';
        let usage: TokenUsage | undefined;
        let finishReason: string | undefined;
        let cancelled = false;

        try {
          for await (const chunk of this.openRouterClient.createStreamingChatCompletion(messages, {
            temperature: requestOptions.temperature,
            maxTokens: requestOptions.maxTokens,
            signal: requestOptions.signal
          })) {
            if (chunk.done) {
              usage = chunk.usage;
              finishReason = chunk.finishReason ?? finishReason;
            } else if (chunk.token) {
              fullContent += chunk.token;
              options.onToken(chunk.token);
            }
          }
        } catch (error) {
          // Preserve partial content on cancellation
          if (error instanceof Error && error.name === 'AbortError') {
            cancelled = true;
            this.outputChannel?.appendLine(
              `[AIResourceOrchestrator] Streaming cancelled - preserving ${fullContent.length} chars of partial response`
            );
          } else {
            // Re-throw non-abort errors
            throw error;
          }
        }

        this.outputChannel?.appendLine(
          `[AIResourceOrchestrator] Streaming ${cancelled ? 'cancelled' : 'complete'} (${fullContent.length} chars)\n`
        );

        // Emit token usage to callback
        if (usage) {
          this.emitTokenUsage({ usage });
        }

        return {
          content: fullContent + this.appendTruncationNote(fullContent, finishReason),
          usedGuides: [],
          requestedResources: [],
          usage,
          finishReason,
          cancelled
        };
      }

      // Non-streaming path (original behavior)
      const response = await this.openRouterClient.createChatCompletion(messages, {
        temperature: requestOptions.temperature,
        maxTokens: requestOptions.maxTokens,
        signal: requestOptions.signal
      });
      this.outputChannel?.appendLine(`[AIResourceOrchestrator] Received response from AI (${response.content.length} chars)\n`);

      // Emit token usage to callback
      const usage = this.emitTokenUsage(response);
      const truncatedNote = this.appendTruncationNote(response.content, response.finishReason);

      return {
        content: response.content + truncatedNote,
        usedGuides: [],
        requestedResources: [],
        usage,
        finishReason: response.finishReason
      };
    } finally {
      termination.dispose();
      this.conversationManager.deleteConversation(conversationId);
    }
  }

  /**
   * Execute an AI request that can load workspace context resources on demand.
   * Supports up to 3 turns (2 resource request rounds) for the context assistant workflow.
   */
  async executeWithContextResources(
    toolName: string,
    systemMessage: string,
    userMessage: string,
    resourceProvider: ContextResourceProvider,
    resourceCatalog: ContextResourceSummary[],
    options: AIOptions = {}
  ): Promise<ExecutionResult> {
    this.outputChannel?.appendLine(
      `\n[AIResourceOrchestrator] Starting context conversation for ${toolName} (model: ${this.openRouterClient.getModel()})`
    );

    const conversationId = this.conversationManager.startConversation(toolName, systemMessage);
    const termination = this.createTerminationContext(options);
    const requestOptions = this.withTerminationSignal(options, termination);
    const deliveredResources: string[] = [];

    try {
      if (resourceCatalog.length > 0) {
        this.outputChannel?.appendLine(
          `[AIResourceOrchestrator] Context resource catalog (${resourceCatalog.length} entries):`
        );
        resourceCatalog.forEach((resource, index) => {
          this.outputChannel?.appendLine(
            `  ${index + 1}. [${resource.group}] ${resource.path}${
              resource.label && resource.label.toLowerCase() !== resource.path.toLowerCase()
                ? ` — ${resource.label}`
                : ''
            }`
          );
        });
      } else {
        this.outputChannel?.appendLine('[AIResourceOrchestrator] Context resource catalog is empty.');
      }

      // Turn 1: Initial request
      const isStreaming = !!options.onToken;
      this.outputChannel?.appendLine(`[AIResourceOrchestrator] Context Turn 1: Sending initial request to AI (streaming: ${isStreaming})`);
      this.conversationManager.addMessage(conversationId, {
        role: 'user',
        content: userMessage
      });

      let messages = this.conversationManager.getMessages(conversationId);
      let totalUsage: TokenUsage | undefined;
      let response: { content: string; finishReason?: string; usage?: TokenUsage };

      if (isStreaming) {
        // Use streaming with resource request detection
        const streamResult = await this.executeStreamingTurnWithDetection(
          messages,
          requestOptions,
          options.onToken
        );
        response = streamResult;
        // Emit token usage
        if (streamResult.usage) {
          this.emitTokenUsage({ usage: streamResult.usage });
          totalUsage = { ...streamResult.usage };
        }
      } else {
        // Non-streaming path
        response = await this.openRouterClient.createChatCompletion(messages, {
          temperature: requestOptions.temperature,
          maxTokens: requestOptions.maxTokens,
          signal: requestOptions.signal
        });
        // Emit token usage to callback and accumulate
        const firstUsage = this.emitTokenUsage(response);
        if (firstUsage) {
          totalUsage = { ...firstUsage };
        }
      }
      this.outputChannel?.appendLine(`[AIResourceOrchestrator] Turn 1 response received (${response.content.length} chars)`);

      // Support up to 2 resource request turns (MAX_TURNS = 3 total)
      let turnCount = 1;
      while (turnCount < this.MAX_TURNS) {
        const resourceRequest = ContextResourceRequestParser.parse(response.content);

        if (!resourceRequest.hasResourceRequest) {
          // No more resource requests - we're done
          this.outputChannel?.appendLine(`[AIResourceOrchestrator] No resource request found in turn ${turnCount}, conversation complete`);
          break;
        }

        if (resourceRequest.requestedPaths.length > 0) {
          this.outputChannel?.appendLine(`[AIResourceOrchestrator] Turn ${turnCount}: Context assistant requested ${resourceRequest.requestedPaths.length} resource(s):`);
          resourceRequest.requestedPaths.forEach((requestedPath: string, index: number) => {
            this.outputChannel?.appendLine(`  ${index + 1}. ${requestedPath}`);
          });
        } else {
          this.outputChannel?.appendLine(`[AIResourceOrchestrator] Turn ${turnCount}: Context assistant returned an empty context-request tag.`);
        }

        // Add the assistant's turn (with the request) to the conversation
        this.conversationManager.addMessage(conversationId, {
          role: 'assistant',
          content: response.content
        });

        if (this.statusCallback && resourceRequest.requestedPaths.length > 0) {
          this.statusCallback('Loading project reference files...');
        }

        // Load the requested resources
        const loadedResources = await resourceProvider.loadResources(resourceRequest.requestedPaths);
        deliveredResources.push(...loadedResources.map(resource => resource.path));

        if (loadedResources.length === 0) {
          this.outputChannel?.appendLine(`[AIResourceOrchestrator] Turn ${turnCount}: No project resources matched the AI request.`);
        } else {
          this.outputChannel?.appendLine(
            `[AIResourceOrchestrator] Turn ${turnCount}: Loaded ${loadedResources.length} project resource(s):`
          );
          loadedResources.forEach((resource, index) => {
            this.outputChannel?.appendLine(
              `  ${index + 1}. ${resource.path} (${resource.content.length} chars)`
            );
          });
        }

        // Build user message with loaded resources
        const userFollowUp = this.buildContextResourceMessage(loadedResources, resourceRequest.requestedPaths);
        this.conversationManager.addMessage(conversationId, {
          role: 'user',
          content: userFollowUp
        });

        // Call API again with updated conversation
        turnCount++;
        messages = this.conversationManager.getMessages(conversationId);

        // Use streaming if enabled
        let turnUsage: TokenUsage | undefined;
        if (isStreaming) {
          const streamResult = await this.executeStreamingTurnWithDetection(
            messages,
            requestOptions,
            options.onToken
          );
          response = streamResult;
          if (streamResult.usage) {
            this.emitTokenUsage({ usage: streamResult.usage });
            turnUsage = streamResult.usage;
          }
        } else {
          response = await this.openRouterClient.createChatCompletion(messages, {
            temperature: requestOptions.temperature,
            maxTokens: requestOptions.maxTokens,
            signal: requestOptions.signal
          });
          turnUsage = this.emitTokenUsage(response);
        }
        this.outputChannel?.appendLine(
          `[AIResourceOrchestrator] Turn ${turnCount} response received (${response.content.length} chars)`
        );

        // Accumulate token usage
        if (turnUsage) {
          if (!totalUsage) {
            totalUsage = { ...turnUsage };
          } else {
            totalUsage.promptTokens += turnUsage.promptTokens;
            totalUsage.completionTokens += turnUsage.completionTokens;
            totalUsage.totalTokens += turnUsage.totalTokens;
            if (typeof totalUsage.costUsd === 'number' || typeof turnUsage.costUsd === 'number') {
              totalUsage.costUsd = (totalUsage.costUsd || 0) + (turnUsage.costUsd || 0);
            }
          }
        }
      }

      if (turnCount >= this.MAX_TURNS) {
        this.outputChannel?.appendLine(`[AIResourceOrchestrator] Conversation reached max turns (${this.MAX_TURNS})`);

        // Check if final response is still a resource request - if so, force output
        const finalRequest = ContextResourceRequestParser.parse(response.content);
        if (finalRequest.hasResourceRequest) {
          this.outputChannel?.appendLine(`[AIResourceOrchestrator] Final turn was still a resource request - forcing output generation`);

          // Add the request to conversation and ask for output
          this.conversationManager.addMessage(conversationId, {
            role: 'assistant',
            content: response.content
          });
          this.conversationManager.addMessage(conversationId, {
            role: 'user',
            content: 'You have reached the maximum number of resource requests. Please produce your context briefing NOW using only the resources you have already received. Do not request any more files.'
          });

          messages = this.conversationManager.getMessages(conversationId);

          // Use streaming for forced output if enabled
          let finalUsage: TokenUsage | undefined;
          if (isStreaming) {
            const streamResult = await this.executeStreamingTurnWithDetection(
              messages,
              requestOptions,
              options.onToken
            );
            response = streamResult;
            if (streamResult.usage) {
              this.emitTokenUsage({ usage: streamResult.usage });
              finalUsage = streamResult.usage;
            }
          } else {
            response = await this.openRouterClient.createChatCompletion(messages, {
              temperature: requestOptions.temperature,
              maxTokens: requestOptions.maxTokens,
              signal: requestOptions.signal
            });
            finalUsage = this.emitTokenUsage(response);
          }
          this.outputChannel?.appendLine(
            `[AIResourceOrchestrator] Forced output response received (${response.content.length} chars)`
          );

          // Accumulate token usage
          if (finalUsage) {
            if (!totalUsage) {
              totalUsage = { ...finalUsage };
            } else {
              totalUsage.promptTokens += finalUsage.promptTokens;
              totalUsage.completionTokens += finalUsage.completionTokens;
              totalUsage.totalTokens += finalUsage.totalTokens;
              if (typeof totalUsage.costUsd === 'number' || typeof finalUsage.costUsd === 'number') {
                totalUsage.costUsd = (totalUsage.costUsd || 0) + (finalUsage.costUsd || 0);
              }
            }
          }
        }
      }

      // Clean up and return final response
      const cleanedResponse = ContextResourceRequestParser.stripRequestTags(response.content);
      const truncatedNote = this.appendTruncationNote(response.content, response.finishReason);

      return {
        content: cleanedResponse + truncatedNote,
        usedGuides: [],
        requestedResources: deliveredResources,
        usage: totalUsage,
        finishReason: response.finishReason
      };
    } finally {
      termination.dispose();
      this.conversationManager.deleteConversation(conversationId);
    }
  }

  /**
   * Execute a streaming turn with resource request detection.
   * Checks if response starts with '<' (resource request) vs text (final response).
   * Only forwards tokens to callback on final response turns.
   * Preserves partial content on cancellation.
   *
   * @returns Full content, usage, finish reason, whether this was a resource request, and cancellation status
   */
  private async executeStreamingTurnWithDetection(
    messages: OpenRouterMessage[],
    options: AIOptions,
    onFinalToken?: StreamingTokenCallback
  ): Promise<{ content: string; finishReason?: string; usage?: TokenUsage; isResourceRequest: boolean; cancelled?: boolean }> {
    let fullContent = '';
    let usage: TokenUsage | undefined;
    let finishReason: string | undefined;
    let isResourceRequest = false;
    let firstTokenChecked = false;
    let cancelled = false;

    try {
      for await (const chunk of this.openRouterClient.createStreamingChatCompletion(messages, {
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        signal: options.signal
      })) {
        if (chunk.done) {
          usage = chunk.usage;
          finishReason = chunk.finishReason ?? finishReason;
        } else if (chunk.token) {
          fullContent += chunk.token;

          // Check first non-empty token to detect resource requests
          if (!firstTokenChecked && chunk.token.trim()) {
            firstTokenChecked = true;
            // Resource requests start with '<guide-request' or '<context-request'
            isResourceRequest = chunk.token.trimStart().startsWith('<');
            this.outputChannel?.appendLine(
              `[AIResourceOrchestrator] First token detection: ${isResourceRequest ? 'resource request' : 'text response'}`
            );
          }

          // Only forward tokens to callback if this is a final text response
          if (!isResourceRequest && onFinalToken) {
            onFinalToken(chunk.token);
          }
        }
      }
    } catch (error) {
      // Preserve partial content on cancellation
      if (error instanceof Error && error.name === 'AbortError') {
        cancelled = true;
        this.outputChannel?.appendLine(
          `[AIResourceOrchestrator] Streaming turn cancelled - preserving ${fullContent.length} chars of partial response`
        );
      } else {
        // Re-throw non-abort errors
        throw error;
      }
    }

    return { content: fullContent, finishReason, usage, isResourceRequest, cancelled };
  }

  /**
   * Fulfill a guide request by loading guides and continuing the conversation
   * Supports streaming with resource request detection when onToken is provided
   */
  private async fulfillGuideRequest(
    conversationId: string,
    assistantResponse: string,
    requestedGuidePaths: string[],
    options: AIOptions
  ): Promise<{ content: string; finishReason?: string; usage?: TokenUsage }> {
    // Add assistant's response (with guide request) to conversation
    this.conversationManager.addMessage(conversationId, {
      role: 'assistant',
      content: assistantResponse
    });

    // Load the requested guides
    const loadedGuides = await this.loadRequestedGuides(requestedGuidePaths);

    // Build user message with loaded guides
    const userMessage = this.buildGuideResponseMessage(loadedGuides);

    // Add user message with guides to conversation
    this.conversationManager.addMessage(conversationId, {
      role: 'user',
      content: userMessage
    });

    // Call API again with updated conversation
    const messages = this.conversationManager.getMessages(conversationId);

    // Use streaming if onToken callback is provided
    if (options.onToken) {
      const streamResult = await this.executeStreamingTurnWithDetection(
        messages,
        options,
        options.onToken
      );
      return {
        content: streamResult.content,
        finishReason: streamResult.finishReason,
        usage: streamResult.usage
      };
    }

    // Non-streaming path
    return await this.openRouterClient.createChatCompletion(messages, {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      signal: options.signal
    });
  }

  /**
   * Load multiple guides by their paths
   */
  private async loadRequestedGuides(guidePaths: string[]): Promise<Map<string, string>> {
    const guides = new Map<string, string>();

    this.outputChannel?.appendLine(`[AIResourceOrchestrator] Loading ${guidePaths.length} requested guides...`);
    for (const path of guidePaths) {
      try {
        const content = await this.guideLoader.loadGuide(path);
        guides.set(path, content);
        this.outputChannel?.appendLine(`  ✓ Loaded: ${path} (${content.length} chars)`);
      } catch (error) {
        this.outputChannel?.appendLine(`  ✗ Failed to load: ${path} - ${error}`);
        guides.set(path, `[Guide not found: ${path}]`);
      }
    }

    return guides;
  }

  /**
   * Build the user message containing loaded guides
   * Applies context window trimming if enabled
   */
  private buildGuideResponseMessage(guides: Map<string, string>): string {
    const lines = ['Here are the requested craft guides:', ''];

    // Check if trimming is enabled
    const applyTrimming = vscode.workspace.getConfiguration('proseMinion')
      .get<boolean>('applyContextWindowTrimming', true);

    if (applyTrimming) {
      // For analysis agents: Limit total guide content to allow room for excerpt and context
      // Target: 75K total words (excerpt + context + guides)
      // Conservative guide limit: 50K words (leaves room for 25K of excerpt + context)
      const MAX_GUIDE_WORDS = 50000;

      // Combine all guide content
      const allGuideContent = Array.from(guides.values()).join('\n\n');
      const totalGuideWords = countWords(allGuideContent);

      if (totalGuideWords > MAX_GUIDE_WORDS) {
        this.outputChannel?.appendLine(
          `[Context Window Trim] Guides exceed limit (${totalGuideWords} words > ${MAX_GUIDE_WORDS} words)`
        );

        // Trim the combined guide content
        const trimResult = trimToWordLimit(allGuideContent, MAX_GUIDE_WORDS);

        this.outputChannel?.appendLine(
          `[Context Window Trim] Trimmed guides from ${trimResult.originalWords} to ${trimResult.trimmedWords} words`
        );

        // Use trimmed content instead
        lines.push(trimResult.trimmed);
        lines.push('', '---', '');
        lines.push('**Note**: Guide content was trimmed to fit context window limits.');

        return lines.join('\n');
      }
    }

    // No trimming needed or disabled - use full content
    for (const [path, content] of guides) {
      lines.push(`## Guide: ${path}`, '');
      lines.push(content);
      lines.push('', '---', '');
    }

    return lines.join('\n');
  }

  private buildContextResourceMessage(
    resources: ContextResourceContent[],
    requestedPaths: string[]
  ): string {
    if (resources.length === 0) {
      const missingList = requestedPaths.length > 0 ? requestedPaths.join(', ') : 'unknown paths';
      return `No project resources were found for the requested paths (${missingList}). Please continue without them.`;
    }

    const delivered = new Set(resources.map(resource => resource.path));
    const missing = requestedPaths.filter(path => !delivered.has(path));

    const lines: string[] = ['Here are the requested project resources:', ''];

    // Check if trimming is enabled
    const applyTrimming = vscode.workspace.getConfiguration('proseMinion')
      .get<boolean>('applyContextWindowTrimming', true);

    if (applyTrimming) {
      // For context agent: Limit total resource content
      // Target: 50K words total (conservative limit for 128K token context window)
      const MAX_CONTEXT_WORDS = 50000;

      // Combine all resource content to check total
      const allResourceContent = resources.map(r => r.content).join('\n\n');
      const totalWords = countWords(allResourceContent);

      if (totalWords > MAX_CONTEXT_WORDS) {
        this.outputChannel?.appendLine(
          `[Context Window Trim] Context resources exceed limit (${totalWords} words > ${MAX_CONTEXT_WORDS} words)`
        );

        // Trim the combined resource content
        const trimResult = trimToWordLimit(allResourceContent, MAX_CONTEXT_WORDS);

        this.outputChannel?.appendLine(
          `[Context Window Trim] Trimmed context from ${trimResult.originalWords} to ${trimResult.trimmedWords} words`
        );

        // Use trimmed content
        lines.push('```markdown');
        lines.push(trimResult.trimmed);
        lines.push('```', '');
        lines.push('');
        lines.push('**Note**: Context resources were trimmed to fit context window limits.');

        if (missing.length > 0) {
          lines.push('');
          lines.push('The following requested paths could not be located:', '');
          missing.forEach(path => lines.push(`- ${path}`));
        }

        lines.push('');
        lines.push('Please incorporate these references into the context summary.');

        return lines.join('\n');
      }
    }

    // No trimming needed or disabled - use full content
    for (const resource of resources) {
      lines.push(`### Resource: ${resource.path}`);
      lines.push(`Group: ${resource.group}`);
      if (resource.workspaceFolder) {
        lines.push(`Workspace Folder: ${resource.workspaceFolder}`);
      }
      lines.push('');
      lines.push('```markdown');
      lines.push(resource.content.trim());
      lines.push('```', '');
    }

    if (missing.length > 0) {
      lines.push('The following requested paths could not be located:', '');
      missing.forEach(path => lines.push(`- ${path}`));
      lines.push('');
    }

    lines.push('Please incorporate these references into the context summary.');

    return lines.join('\n');
  }

  /**
   * Update the status callback used for UI notifications
   */
  setStatusCallback(callback?: StatusCallback): void {
    this.statusCallback = callback;
  }

  /**
   * Update the token usage callback for centralized token tracking
   * When set, the orchestrator will call this callback after each API call
   * with accumulated token usage data
   */
  setTokenUsageCallback(callback?: TokenUsageCallback): void {
    this.tokenUsageCallback = callback;
  }

  /**
   * Emit token usage to the callback if set
   * Called after each API response to provide real-time token tracking
   */
  private emitTokenUsage(response: { usage?: TokenUsage }): TokenUsage | undefined {
    const usage = (response as any).usage as TokenUsage | undefined;
    if (usage && this.tokenUsageCallback) {
      this.tokenUsageCallback(usage);
    }
    return usage;
  }

  /**
   * Dispose of any timers held by the orchestrator
   */
  dispose(): void {
    clearInterval(this.conversationCleanupInterval);
  }

  private appendTruncationNote(content: string, finishReason?: string): string {
    if (finishReason === 'length') {
      return '\n\n---\n\n⚠️ Response truncated. Increase Max Tokens in settings.';
    }
    return '';
  }
}
