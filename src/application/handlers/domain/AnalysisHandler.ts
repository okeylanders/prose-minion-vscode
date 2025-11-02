/**
 * Analysis domain handler
 * Handles dialogue and prose analysis operations
 */

import * as vscode from 'vscode';
import { IProseAnalysisService } from '../../../domain/services/IProseAnalysisService';
import {
  AnalyzeDialogueMessage,
  AnalyzeProseMessage,
  AnalysisResultMessage,
  StatusMessage,
  ErrorMessage,
  TokenUsageUpdateMessage,
  TokenUsage,
  TokenUsageTotals,
  ErrorSource,
  MessageType
} from '../../../shared/types/messages';
import { MessageRouter } from '../MessageRouter';

export class AnalysisHandler {
  constructor(
    private readonly service: IProseAnalysisService,
    private readonly postMessage: (message: any) => Promise<void>,
    private readonly applyTokenUsageCallback: (usage: TokenUsage) => void,
    private readonly outputChannel: vscode.OutputChannel
  ) {}

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

  private sendStatus(message: string, guideNames?: string): void {
    const statusMessage: StatusMessage = {
      type: MessageType.STATUS,
      source: 'extension.analysis',
      payload: {
        message,
        guideNames
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
    this.outputChannel.appendLine(`[AnalysisHandler] ERROR [${source}]: ${message}${details ? ` - ${details}` : ''}`);
  }

  private applyTokenUsage(usage: TokenUsage): void {
    // Delegate to MessageHandler's centralized token tracking
    this.applyTokenUsageCallback(usage);
  }

  // Message handlers

  async handleAnalyzeDialogue(message: AnalyzeDialogueMessage): Promise<void> {
    const { text, contextText, sourceFileUri } = message.payload;
    const config = vscode.workspace.getConfiguration('proseMinion');
    const includeCraftGuides = config.get<boolean>('includeCraftGuides') ?? true;

    const loadingMessage = includeCraftGuides
      ? 'Loading prompts and craft guides...'
      : 'Loading prompts...';

    this.sendStatus(loadingMessage);
    await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay to ensure UI updates

    this.sendStatus('Analyzing dialogue with AI...');
    const result = await this.service.analyzeDialogue(
      text,
      contextText,
      sourceFileUri
    );
    this.sendAnalysisResult(result.content, result.toolName, result.usedGuides);
    if ((result as any).usage) {
      this.applyTokenUsage((result as any).usage);
    }
  }

  async handleAnalyzeProse(message: AnalyzeProseMessage): Promise<void> {
    const { text, contextText, sourceFileUri } = message.payload;
    const config = vscode.workspace.getConfiguration('proseMinion');
    const includeCraftGuides = config.get<boolean>('includeCraftGuides') ?? true;

    const loadingMessage = includeCraftGuides
      ? 'Loading prompts and craft guides...'
      : 'Loading prompts...';

    this.sendStatus(loadingMessage);
    await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay to ensure UI updates

    this.sendStatus('Analyzing prose with AI...');
    const result = await this.service.analyzeProse(
      text,
      contextText,
      sourceFileUri
    );
    this.sendAnalysisResult(result.content, result.toolName, result.usedGuides);
    if ((result as any).usage) {
      this.applyTokenUsage((result as any).usage);
    }
  }
}
