/**
 * Metrics domain handler
 * Handles prose statistics, style flags, and word frequency operations
 */

import * as vscode from 'vscode';
import { IProseAnalysisService } from '../../../domain/services/IProseAnalysisService';
import {
  MeasureProseStatsMessage,
  MeasureStyleFlagsMessage,
  MeasureWordFrequencyMessage,
  MessageType,
  ErrorSource,
  MetricsResultMessage,
  ErrorMessage
} from '../../../shared/types/messages';
import { MessageRouter } from '../MessageRouter';

export class MetricsHandler {
  constructor(
    private readonly service: IProseAnalysisService,
    private readonly postMessage: (message: any) => Promise<void>,
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  /**
   * Register message routes for metrics domain
   */
  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.MEASURE_PROSE_STATS, this.handleMeasureProseStats.bind(this));
    router.register(MessageType.MEASURE_STYLE_FLAGS, this.handleMeasureStyleFlags.bind(this));
    router.register(MessageType.MEASURE_WORD_FREQUENCY, this.handleMeasureWordFrequency.bind(this));
  }

  // Helper methods (domain owns its message lifecycle)

  private sendMetricsResult(result: any, toolName: string): void {
    const message: MetricsResultMessage = {
      type: MessageType.METRICS_RESULT,
      source: 'extension.metrics',
      payload: {
        result,
        toolName
      },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private sendError(source: ErrorSource, message: string, details?: string): void {
    const errorMessage: ErrorMessage = {
      type: MessageType.ERROR,
      source: 'extension.metrics',
      payload: {
        source,
        message,
        details
      },
      timestamp: Date.now()
    };
    void this.postMessage(errorMessage);
  }

  // Message handlers

  async handleMeasureProseStats(message: MeasureProseStatsMessage): Promise<void> {
    try {
      const resolved = await this.resolveRichTextForMetrics(message.payload);
      const result = await this.service.measureProseStats(resolved.text, resolved.paths, resolved.mode);
      this.sendMetricsResult(result.metrics, result.toolName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('metrics.prose_stats', 'Invalid selection or path', msg);
    }
  }

  async handleMeasureStyleFlags(message: MeasureStyleFlagsMessage): Promise<void> {
    try {
      const text = await this.resolveTextForMetrics(message.payload);
      const result = await this.service.measureStyleFlags(text);
      this.sendMetricsResult(result.metrics, result.toolName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('metrics.style_flags', 'Invalid selection or path', msg);
    }
  }

  async handleMeasureWordFrequency(message: MeasureWordFrequencyMessage): Promise<void> {
    try {
      const text = await this.resolveTextForMetrics(message.payload);
      const result = await this.service.measureWordFrequency(text);
      this.sendMetricsResult(result.metrics, result.toolName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('metrics.word_frequency', 'Invalid selection or path', msg);
    }
  }

  private async resolveTextForMetrics(payload: { text?: string; source?: any }): Promise<string> {
    // Backward compatibility: if source not provided, use text
    if (!payload.source) {
      const t = (payload.text ?? '').trim();
      if (!t) {
        throw new Error('No text provided for metrics.');
      }
      return t;
    }

    // Dynamically import to avoid cyclic deps and keep constructor lean
    const { TextSourceResolver } = await import('../../../infrastructure/text/TextSourceResolver');
    const resolver = new TextSourceResolver(this.outputChannel);
    const resolved = await resolver.resolve(payload.source);
    const text = (resolved.text ?? '').trim();
    if (!text) {
      throw new Error('Resolved source contains no text.');
    }
    return text;
  }

  private async resolveRichTextForMetrics(payload: { text?: string; source?: any }): Promise<{ text: string; paths?: string[]; mode?: string }> {
    if (!payload.source) {
      const text = await this.resolveTextForMetrics(payload);
      return { text };
    }
    const { TextSourceResolver } = await import('../../../infrastructure/text/TextSourceResolver');
    const resolver = new TextSourceResolver(this.outputChannel);
    const resolved = await resolver.resolve(payload.source);
    const text = (resolved.text ?? '').trim();
    if (!text) throw new Error('Resolved source contains no text.');
    const mode = payload.source?.mode;
    return { text, paths: resolved.relativePaths, mode };
  }
}
