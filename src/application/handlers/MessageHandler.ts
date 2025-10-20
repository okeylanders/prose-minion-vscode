/**
 * Message handler - Application layer
 * Routes messages from webview to appropriate domain services
 * Following Single Responsibility Principle
 */

import * as vscode from 'vscode';
import { IProseAnalysisService } from '../../domain/services/IProseAnalysisService';
import {
  WebviewToExtensionMessage,
  MessageType,
  AnalysisResultMessage,
  MetricsResultMessage,
  ErrorMessage
} from '../../shared/types';

export class MessageHandler {
  constructor(
    private readonly proseAnalysisService: IProseAnalysisService,
    private readonly webview: vscode.Webview
  ) {}

  async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
    try {
      switch (message.type) {
        case MessageType.ANALYZE_DIALOGUE:
          await this.handleAnalyzeDialogue(message.text);
          break;

        case MessageType.ANALYZE_PROSE:
          await this.handleAnalyzeProse(message.text);
          break;

        case MessageType.MEASURE_PROSE_STATS:
          await this.handleMeasureProseStats(message.text);
          break;

        case MessageType.MEASURE_STYLE_FLAGS:
          await this.handleMeasureStyleFlags(message.text);
          break;

        case MessageType.MEASURE_WORD_FREQUENCY:
          await this.handleMeasureWordFrequency(message.text);
          break;

        case MessageType.TAB_CHANGED:
          // Tab change is handled in UI, no action needed
          break;

        default:
          this.sendError('Unknown message type', 'Received unrecognized message');
      }
    } catch (error) {
      this.sendError(
        'Error processing request',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handleAnalyzeDialogue(text: string): Promise<void> {
    const result = await this.proseAnalysisService.analyzeDialogue(text);
    this.sendAnalysisResult(result.content, result.toolName);
  }

  private async handleAnalyzeProse(text: string): Promise<void> {
    const result = await this.proseAnalysisService.analyzeProse(text);
    this.sendAnalysisResult(result.content, result.toolName);
  }

  private async handleMeasureProseStats(text: string): Promise<void> {
    const result = await this.proseAnalysisService.measureProseStats(text);
    this.sendMetricsResult(result.metrics, result.toolName);
  }

  private async handleMeasureStyleFlags(text: string): Promise<void> {
    const result = await this.proseAnalysisService.measureStyleFlags(text);
    this.sendMetricsResult(result.metrics, result.toolName);
  }

  private async handleMeasureWordFrequency(text: string): Promise<void> {
    const result = await this.proseAnalysisService.measureWordFrequency(text);
    this.sendMetricsResult(result.metrics, result.toolName);
  }

  private sendAnalysisResult(result: string, toolName: string): void {
    const message: AnalysisResultMessage = {
      type: MessageType.ANALYSIS_RESULT,
      result,
      toolName,
      timestamp: Date.now()
    };
    this.webview.postMessage(message);
  }

  private sendMetricsResult(result: any, toolName: string): void {
    const message: MetricsResultMessage = {
      type: MessageType.METRICS_RESULT,
      result,
      toolName,
      timestamp: Date.now()
    };
    this.webview.postMessage(message);
  }

  private sendError(message: string, details?: string): void {
    const errorMessage: ErrorMessage = {
      type: MessageType.ERROR,
      message,
      details,
      timestamp: Date.now()
    };
    this.webview.postMessage(errorMessage);
  }
}
