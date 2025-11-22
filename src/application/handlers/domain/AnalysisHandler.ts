/**
 * Analysis domain handler
 * Handles dialogue and prose analysis operations
 *
 * SPRINT 05 REFACTOR: Now injects AssistantToolService directly (facade removed)
 */

import * as vscode from 'vscode';
import { AssistantToolService } from '@services/analysis/AssistantToolService';
import {
  AnalyzeDialogueMessage,
  AnalyzeProseMessage,
  AnalysisResultMessage,
  StatusMessage,
  ErrorMessage,
  TokenUsage,
  ErrorSource,
  MessageType
} from '@messages';
import { MessageRouter } from '../MessageRouter';

export class AnalysisHandler {
  constructor(
    private readonly assistantToolService: AssistantToolService,
    private readonly postMessage: (message: any) => Promise<void>,
    private readonly applyTokenUsageCallback: (usage: TokenUsage) => void
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

  private applyTokenUsage(usage: TokenUsage): void {
    // Delegate to MessageHandler's centralized token tracking
    this.applyTokenUsageCallback(usage);
  }

  // Message handlers

  async handleAnalyzeDialogue(message: AnalyzeDialogueMessage): Promise<void> {
    try {
      const { text, contextText, sourceFileUri, focus } = message.payload;
      const config = vscode.workspace.getConfiguration('proseMinion');
      const includeCraftGuides = config.get<boolean>('includeCraftGuides') ?? true;

      const loadingMessage = includeCraftGuides
        ? 'Loading prompts and craft guides...'
        : 'Loading prompts...';

      this.sendStatus(loadingMessage);
      await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay to ensure UI updates

      this.sendStatus('Analyzing dialogue with AI...');
      const result = await this.assistantToolService.analyzeDialogue(
        text,
        contextText,
        sourceFileUri,
        focus
      );
      this.sendAnalysisResult(result.content, result.toolName, result.usedGuides);
      if ((result as any).usage) {
        this.applyTokenUsage((result as any).usage);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('analysis.dialogue', 'Failed to analyze dialogue', msg);
    }
  }

  async handleAnalyzeProse(message: AnalyzeProseMessage): Promise<void> {
    try {
      const { text, contextText, sourceFileUri } = message.payload;
      const config = vscode.workspace.getConfiguration('proseMinion');
      const includeCraftGuides = config.get<boolean>('includeCraftGuides') ?? true;

      const loadingMessage = includeCraftGuides
        ? 'Loading prompts and craft guides...'
        : 'Loading prompts...';

      this.sendStatus(loadingMessage);
      await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay to ensure UI updates

      this.sendStatus('Analyzing prose with AI...');
      const result = await this.assistantToolService.analyzeProse(
        text,
        contextText,
        sourceFileUri
      );
      this.sendAnalysisResult(result.content, result.toolName, result.usedGuides);
      if ((result as any).usage) {
        this.applyTokenUsage((result as any).usage);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('analysis.prose', 'Failed to analyze prose', msg);
    }
  }
}
