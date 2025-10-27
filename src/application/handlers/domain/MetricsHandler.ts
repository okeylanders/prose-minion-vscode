/**
 * Metrics domain handler
 * Handles prose statistics, style flags, and word frequency operations
 */

import * as vscode from 'vscode';
import { IProseAnalysisService } from '../../../domain/services/IProseAnalysisService';
import {
  MeasureProseStatsMessage,
  MeasureStyleFlagsMessage,
  MeasureWordFrequencyMessage
} from '../../../shared/types/messages';

export class MetricsHandler {
  constructor(
    private readonly service: IProseAnalysisService,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly sendMetricsResult: (result: any, toolName: string) => void,
    private readonly sendError: (message: string, details?: string) => void
  ) {}

  async handleMeasureProseStats(message: MeasureProseStatsMessage): Promise<void> {
    try {
      const resolved = await this.resolveRichTextForMetrics(message);
      const result = await this.service.measureProseStats(resolved.text, resolved.paths, resolved.mode);
      this.sendMetricsResult(result.metrics, result.toolName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('Invalid selection or path', msg);
    }
  }

  async handleMeasureStyleFlags(message: MeasureStyleFlagsMessage): Promise<void> {
    try {
      const text = await this.resolveTextForMetrics(message);
      const result = await this.service.measureStyleFlags(text);
      this.sendMetricsResult(result.metrics, result.toolName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('Invalid selection or path', msg);
    }
  }

  async handleMeasureWordFrequency(message: MeasureWordFrequencyMessage): Promise<void> {
    try {
      const text = await this.resolveTextForMetrics(message);
      const result = await this.service.measureWordFrequency(text);
      this.sendMetricsResult(result.metrics, result.toolName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('Invalid selection or path', msg);
    }
  }

  private async resolveTextForMetrics(message: { text?: string; source?: any }): Promise<string> {
    // Backward compatibility: if source not provided, use text
    if (!message.source) {
      const t = (message.text ?? '').trim();
      if (!t) {
        throw new Error('No text provided for metrics.');
      }
      return t;
    }

    // Dynamically import to avoid cyclic deps and keep constructor lean
    const { TextSourceResolver } = await import('../../../infrastructure/text/TextSourceResolver');
    const resolver = new TextSourceResolver(this.outputChannel);
    const resolved = await resolver.resolve(message.source);
    const text = (resolved.text ?? '').trim();
    if (!text) {
      throw new Error('Resolved source contains no text.');
    }
    return text;
  }

  private async resolveRichTextForMetrics(message: { text?: string; source?: any }): Promise<{ text: string; paths?: string[]; mode?: string }> {
    if (!message.source) {
      const text = await this.resolveTextForMetrics(message);
      return { text };
    }
    const { TextSourceResolver } = await import('../../../infrastructure/text/TextSourceResolver');
    const resolver = new TextSourceResolver(this.outputChannel);
    const resolved = await resolver.resolve(message.source);
    const text = (resolved.text ?? '').trim();
    if (!text) throw new Error('Resolved source contains no text.');
    const mode = message.source?.mode;
    return { text, paths: resolved.relativePaths, mode };
  }
}
