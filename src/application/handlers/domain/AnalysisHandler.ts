/**
 * Analysis domain handler
 * Handles dialogue and prose analysis operations with streaming support
 *
 * SPRINT 05 REFACTOR: Now injects AssistantToolService directly (facade removed)
 * SPRINT 03 (Sub-Epic 4): Added streaming + cancellation support
 */

import * as vscode from 'vscode';
import { AssistantToolService } from '@services/analysis/AssistantToolService';
import {
  AnalyzeDialogueMessage,
  AnalyzeProseMessage,
  AnalysisResultMessage,
  CancelRequestMessage,
  StatusMessage,
  ErrorMessage,
  ErrorSource,
  MessageType,
  StreamChunkMessage,
  StreamCompleteMessage
} from '@messages';
import { MessageRouter } from '../MessageRouter';

// Generate unique request IDs
let requestIdCounter = 0;
const generateRequestId = (type: string) => `${type}-${Date.now()}-${++requestIdCounter}`;

export class AnalysisHandler {
  // Track active abort controllers by request ID for cancellation
  private activeRequests = new Map<string, AbortController>();

  constructor(
    private readonly assistantToolService: AssistantToolService,
    private readonly postMessage: (message: any) => Promise<void>
  ) {
    // Inject status emitter for guide loading notifications
    this.assistantToolService.setStatusEmitter((message, progress, tickerMessage) => {
      this.sendStatus(message, progress, tickerMessage);
    });
  }

  /**
   * Register message routes for analysis domain
   */
  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.ANALYZE_DIALOGUE, this.handleAnalyzeDialogue.bind(this));
    router.register(MessageType.ANALYZE_PROSE, this.handleAnalyzeProse.bind(this));
    router.register(MessageType.CANCEL_REQUEST, this.handleCancelRequest.bind(this));
  }

  /**
   * Handle cancel request for streaming operations
   */
  async handleCancelRequest(message: CancelRequestMessage): Promise<void> {
    const { requestId, domain } = message.payload;

    // Only handle analysis domain cancellations
    if (domain !== 'analysis') return;

    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      this.sendStatus('Analysis cancelled');
    }
  }

  // Helper methods (domain owns its message lifecycle)

  private sendAnalysisResult(result: string, toolName: string, usedGuides?: string[]): void {
    const message: AnalysisResultMessage = {
      type: MessageType.ANALYSIS_RESULT,
      source: 'extension.analysis',
      payload: {
        result,
        toolName,
        usedGuides
      },
      timestamp: Date.now()
    };
    void this.postMessage(message);
    this.sendStatus('');
  }

  private sendStatus(
    message: string,
    progress?: { current: number; total: number },
    tickerMessage?: string
  ): void {
    const statusMessage: StatusMessage = {
      type: MessageType.STATUS,
      source: 'extension.analysis',
      payload: {
        message,
        progress,
        tickerMessage
      },
      timestamp: Date.now()
    };
    void this.postMessage(statusMessage);
  }

  private sendError(source: ErrorSource, message: string, details?: string): void {
    const errorMessage: ErrorMessage = {
      type: MessageType.ERROR,
      source: 'extension.analysis',
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
      source: 'extension.analysis',
      payload: {
        requestId,
        domain: 'analysis',
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
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number; costUsd?: number }
  ): void {
    const message: StreamCompleteMessage = {
      type: MessageType.STREAM_COMPLETE,
      source: 'extension.analysis',
      payload: {
        requestId,
        domain: 'analysis',
        content,
        cancelled,
        usage
      },
      timestamp: Date.now()
    };
    void this.postMessage(message);
    this.sendStatus('');
  }

  // Message handlers

  async handleAnalyzeDialogue(message: AnalyzeDialogueMessage): Promise<void> {
    const { text, contextText, sourceFileUri, focus } = message.payload;

    if (!text.trim()) {
      this.sendError('analysis.dialogue', 'Dialogue analysis requires text to analyze');
      return;
    }

    const requestId = generateRequestId('dialogue');
    const controller = new AbortController();
    this.activeRequests.set(requestId, controller);

    try {
      const config = vscode.workspace.getConfiguration('proseMinion');
      const includeCraftGuides = config.get<boolean>('includeCraftGuides') ?? true;

      const loadingMessage = includeCraftGuides
        ? 'Loading prompts and craft guides...'
        : 'Loading prompts...';

      this.sendStatus(loadingMessage);
      await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay to ensure UI updates

      this.sendStatus('Streaming dialogue analysis...');

      // Use streaming analysis
      const result = await this.assistantToolService.analyzeDialogue(
        text,
        contextText,
        sourceFileUri,
        focus,
        {
          signal: controller.signal,
          onToken: (token: string) => {
            this.sendStreamChunk(requestId, token);
          }
        }
      );

      // Check if cancelled
      const cancelled = controller.signal.aborted;
      this.sendStreamComplete(requestId, result.content, cancelled, result.usage);

      // Also send analysis result for backward compatibility
      if (!cancelled) {
        this.sendAnalysisResult(result.content, result.toolName, result.usedGuides);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      if (error instanceof Error && error.name === 'AbortError') {
        this.sendStreamComplete(requestId, '', true);
        this.sendStatus('Dialogue analysis cancelled');
      } else {
        this.sendError('analysis.dialogue', 'Failed to analyze dialogue', msg);
      }
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  async handleAnalyzeProse(message: AnalyzeProseMessage): Promise<void> {
    const { text, contextText, sourceFileUri } = message.payload;

    if (!text.trim()) {
      this.sendError('analysis.prose', 'Prose analysis requires text to analyze');
      return;
    }

    const requestId = generateRequestId('prose');
    const controller = new AbortController();
    this.activeRequests.set(requestId, controller);

    try {
      const config = vscode.workspace.getConfiguration('proseMinion');
      const includeCraftGuides = config.get<boolean>('includeCraftGuides') ?? true;

      const loadingMessage = includeCraftGuides
        ? 'Loading prompts and craft guides...'
        : 'Loading prompts...';

      this.sendStatus(loadingMessage);
      await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay to ensure UI updates

      this.sendStatus('Streaming prose analysis...');

      // Use streaming analysis
      const result = await this.assistantToolService.analyzeProse(
        text,
        contextText,
        sourceFileUri,
        {
          signal: controller.signal,
          onToken: (token: string) => {
            this.sendStreamChunk(requestId, token);
          }
        }
      );

      // Check if cancelled
      const cancelled = controller.signal.aborted;
      this.sendStreamComplete(requestId, result.content, cancelled, result.usage);

      // Also send analysis result for backward compatibility
      if (!cancelled) {
        this.sendAnalysisResult(result.content, result.toolName, result.usedGuides);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      if (error instanceof Error && error.name === 'AbortError') {
        this.sendStreamComplete(requestId, '', true);
        this.sendStatus('Prose analysis cancelled');
      } else {
        this.sendError('analysis.prose', 'Failed to analyze prose', msg);
      }
    } finally {
      this.activeRequests.delete(requestId);
    }
  }
}
