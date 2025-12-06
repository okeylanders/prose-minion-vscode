/**
 * Context domain handler
 * Handles context generation operations with streaming support
 *
 * SPRINT 05 REFACTOR: Now injects ContextAssistantService directly (facade removed)
 * SPRINT 03 (Sub-Epic 4): Added streaming + cancellation support
 */

import * as vscode from 'vscode';
import { ContextAssistantService } from '@services/analysis/ContextAssistantService';
import { ContextGenerationResult } from '@/domain/models/ContextGeneration';
import {
  GenerateContextMessage,
  StreamStartedMessage,
  CancelContextRequestMessage,
  MessageType,
  TokenUsage,
  ErrorSource,
  ContextResultMessage,
  StatusMessage,
  ErrorMessage,
  StreamStartedPayload,
  StreamChunkMessage,
  StreamCompleteMessage
} from '@messages';
import { MessageRouter } from '../MessageRouter';

// Generate unique request IDs
let requestIdCounter = 0;
const generateRequestId = () => `context-${Date.now()}-${++requestIdCounter}`;

export class ContextHandler {
  // Track active abort controllers by request ID for cancellation
  private activeRequests = new Map<string, AbortController>();

  constructor(
    private readonly contextAssistantService: ContextAssistantService,
    private readonly postMessage: (message: any) => Promise<void>
  ) {}

  /**
   * Register message routes for context domain
   */
  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.GENERATE_CONTEXT, this.handleGenerateContext.bind(this));
    router.register(MessageType.CANCEL_CONTEXT_REQUEST, this.handleCancelRequest.bind(this));
  }

  /**
   * Handle cancel request for streaming operations
   */
  async handleCancelRequest(message: CancelContextRequestMessage): Promise<void> {
    const { requestId, domain } = message.payload;

    // Only handle context domain cancellations
    if (domain !== 'context') return;

    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      this.sendStatus('Context generation cancelled');
    }
  }

  // Helper methods (domain owns its message lifecycle)

  /**
   * Send stream started message so UI can enable cancel immediately
   */
  private sendStreamStarted(payload: StreamStartedPayload): void {
    const message: StreamStartedMessage = {
      type: MessageType.STREAM_STARTED,
      source: 'extension.context',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private sendContextResult(result: ContextGenerationResult): void {
    const message: ContextResultMessage = {
      type: MessageType.CONTEXT_RESULT,
      source: 'extension.context',
      payload: {
        result: result.content,
        toolName: result.toolName,
        requestedResources: result.requestedResources
      },
      timestamp: Date.now()
    };
    void this.postMessage(message);
    this.sendStatus('');
  }

  private sendStatus(message: string, tickerMessage?: string): void {
    const statusMessage: StatusMessage = {
      type: MessageType.STATUS,
      source: 'extension.context',
      payload: {
        message,
        tickerMessage
      },
      timestamp: Date.now()
    };
    void this.postMessage(statusMessage);
  }

  private sendError(source: ErrorSource, message: string, details?: string): void {
    const errorMessage: ErrorMessage = {
      type: MessageType.ERROR,
      source: 'extension.context',
      payload: {
        source,
        message,
        details
      },
      timestamp: Date.now()
    };
    void this.postMessage(errorMessage);
  }

  /**
   * Send a streaming token chunk to webview
   */
  private sendStreamChunk(requestId: string, token: string): void {
    const message: StreamChunkMessage = {
      type: MessageType.STREAM_CHUNK,
      source: 'extension.context',
      payload: {
        requestId,
        domain: 'context',
        token
      },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  /**
   * Send stream complete message to webview
   */
  private sendStreamComplete(
    requestId: string,
    content: string,
    cancelled: boolean = false,
    usage?: TokenUsage,
    truncated: boolean = false
  ): void {
    const message: StreamCompleteMessage = {
      type: MessageType.STREAM_COMPLETE,
      source: 'extension.context',
      payload: {
        requestId,
        domain: 'context',
        content,
        cancelled,
        usage,
        truncated
      },
      timestamp: Date.now()
    };
    void this.postMessage(message);
    this.sendStatus('');
  }

  // Message handlers

  async handleGenerateContext(message: GenerateContextMessage): Promise<void> {
    const { excerpt, existingContext, sourceFileUri, requestedGroups } = message.payload;

    if (!excerpt.trim()) {
      this.sendError('context', 'Context assistant needs an excerpt to analyze.');
      return;
    }

    const requestId = generateRequestId();
    const controller = new AbortController();
    this.activeRequests.set(requestId, controller);
    this.sendStreamStarted({ requestId, domain: 'context' });

    try {
      this.sendStatus('Streaming context generation...');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Use streaming context generation
      const result = await this.contextAssistantService.generateContext(
        {
          excerpt,
          existingContext,
          sourceFileUri,
          requestedGroups
        },
        {
          signal: controller.signal,
          onToken: (token: string) => {
            this.sendStreamChunk(requestId, token);
          }
        }
      );

      // Check if cancelled
      const cancelled = controller.signal.aborted;
      // TODO: Implement finishReason tracking in ContextGenerationResult to detect truncation
      this.sendStreamComplete(requestId, result.content, cancelled, result.usage, false);

      // Also send context result for backward compatibility
      if (!cancelled) {
        this.sendContextResult(result);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      if (error instanceof Error && error.name === 'AbortError') {
        this.sendStreamComplete(requestId, '', true);
        this.sendStatus('Context generation cancelled');
      } else {
        this.sendError('context', 'Failed to generate context', msg);
      }
    } finally {
      this.activeRequests.delete(requestId);
    }
  }
}
