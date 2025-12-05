/**
 * Dictionary domain handler
 * Handles dictionary lookup operations with streaming support
 *
 * SPRINT 05 REFACTOR: Now injects DictionaryService directly (facade removed)
 * SPRINT 03 (Sub-Epic 4): Added streaming + cancellation support
 */

import * as vscode from 'vscode';
import { DictionaryService } from '@services/dictionary/DictionaryService';
import {
  LookupDictionaryMessage,
  FastGenerateDictionaryMessage,
  StreamStartedMessage,
  CancelDictionaryRequestMessage,
  MessageType,
  ErrorSource,
  DictionaryResultMessage,
  FastGenerateDictionaryResultMessage,
  StatusMessage,
  ErrorMessage,
  StreamStartedPayload,
  StreamChunkMessage,
  StreamCompleteMessage
} from '@messages';
import { MessageRouter } from '../MessageRouter';

// Generate unique request IDs
let requestIdCounter = 0;
const generateRequestId = () => `dict-${Date.now()}-${++requestIdCounter}`;

export class DictionaryHandler {
  // Track active abort controllers by request ID for cancellation
  private activeRequests = new Map<string, AbortController>();

  constructor(
    private readonly dictionaryService: DictionaryService,
    private readonly postMessage: (message: any) => Promise<void>
  ) {}

  /**
   * Register message routes for dictionary domain
   */
  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.LOOKUP_DICTIONARY, this.handleLookupDictionary.bind(this));
    router.register(MessageType.FAST_GENERATE_DICTIONARY, this.handleFastGenerate.bind(this));
    router.register(MessageType.CANCEL_DICTIONARY_REQUEST, this.handleCancelRequest.bind(this));
  }

  /**
   * Handle cancel request for streaming operations
   */
  async handleCancelRequest(message: CancelDictionaryRequestMessage): Promise<void> {
    const { requestId, domain } = message.payload;

    // Only handle dictionary domain cancellations
    if (domain !== 'dictionary') return;

    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      this.sendStatus('Dictionary lookup cancelled');
    }
  }

  // Helper methods (domain owns its message lifecycle)

  /**
   * Send stream started message so UI can enable cancel immediately
   */
  private sendStreamStarted(payload: StreamStartedPayload): void {
    const message: StreamStartedMessage = {
      type: MessageType.STREAM_STARTED,
      source: 'extension.dictionary',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private sendDictionaryResult(result: string, toolName: string): void {
    const message: DictionaryResultMessage = {
      type: MessageType.DICTIONARY_RESULT,
      source: 'extension.dictionary',
      payload: {
        result,
        toolName
      },
      timestamp: Date.now()
    };
    void this.postMessage(message);
    this.sendStatus('');
  }

  private sendStatus(message: string, tickerMessage?: string): void {
    const statusMessage: StatusMessage = {
      type: MessageType.STATUS,
      source: 'extension.dictionary',
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
      source: 'extension.dictionary',
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
      source: 'extension.dictionary',
      payload: {
        requestId,
        domain: 'dictionary',
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
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number; costUsd?: number },
    truncated: boolean = false
  ): void {
    const message: StreamCompleteMessage = {
      type: MessageType.STREAM_COMPLETE,
      source: 'extension.dictionary',
      payload: {
        requestId,
        domain: 'dictionary',
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

  /**
   * Handle dictionary lookup with streaming support
   * Uses streaming API for progressive response display
   */
  async handleLookupDictionary(message: LookupDictionaryMessage): Promise<void> {
    const { word, contextText } = message.payload;

    if (!word.trim()) {
      this.sendError('dictionary', 'Dictionary lookup requires a word to search');
      return;
    }

    const requestId = generateRequestId();
    const controller = new AbortController();
    this.activeRequests.set(requestId, controller);
    this.sendStreamStarted({ requestId, domain: 'dictionary' });

    try {
      this.sendStatus(`Streaming dictionary entry for "${word}"...`);

      // Use streaming lookup
      const result = await this.dictionaryService.lookupWordStreaming(
        word,
        contextText,
        (token: string) => {
          // Send each token as a chunk
          this.sendStreamChunk(requestId, token);
        },
        controller.signal
      );

      // Send complete message (result.content has full content for non-streaming fallback)
      const cancelled = result.content === '(Cancelled)';
      this.sendStreamComplete(requestId, result.content, cancelled, result.usage, result.finishReason === 'length');

      // Also send dictionary result for backward compatibility
      if (!cancelled) {
        this.sendDictionaryResult(result.content, result.toolName);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      if (error instanceof Error && error.name === 'AbortError') {
        this.sendStreamComplete(requestId, '', true);
        this.sendStatus('Dictionary lookup cancelled');
      } else {
        this.sendError('dictionary', 'Failed to lookup dictionary entry', msg);
      }
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Handle fast (parallel) dictionary generation request
   */
  async handleFastGenerate(message: FastGenerateDictionaryMessage): Promise<void> {
    try {
      const { word, context } = message.payload;

      if (!word.trim()) {
        this.sendError('dictionary', 'Fast dictionary generation requires a word');
        return;
      }

      this.sendStatus(`🧪 Fast generating dictionary entry for "${word}"...`);

      // Generate parallel dictionary (progress sent via STATUS messages)
      const result = await this.dictionaryService.generateParallelDictionary(
        word,
        context
      );

      // Send result back to webview
      this.sendFastGenerateResult(result);
      this.sendStatus('');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('dictionary', 'Failed to generate dictionary entry', msg);
    }
  }

  /**
   * Send fast generate result to webview
   */
  private sendFastGenerateResult(result: {
    word: string;
    result: string;
    metadata: {
      totalDuration: number;
      blockDurations: Record<string, number>;
      partialFailures: string[];
      successCount: number;
      totalBlocks: number;
    };
  }): void {
    const message: FastGenerateDictionaryResultMessage = {
      type: MessageType.FAST_GENERATE_DICTIONARY_RESULT,
      source: 'extension.dictionary',
      payload: result,
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }
}
