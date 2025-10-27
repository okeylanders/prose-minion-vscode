/**
 * Search domain handler
 * Handles word search operations
 */

import * as vscode from 'vscode';
import { IProseAnalysisService } from '../../../domain/services/IProseAnalysisService';
import { RunWordSearchMessage } from '../../../shared/types/messages';

export class SearchHandler {
  constructor(
    private readonly service: IProseAnalysisService,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly sendSearchResult: (result: any, toolName: string) => void,
    private readonly sendError: (message: string, details?: string) => void
  ) {}

  async handleMeasureWordSearch(message: RunWordSearchMessage): Promise<void> {
    try {
      // DEBUG: Log incoming message
      this.outputChannel.appendLine('[SearchHandler] RUN_WORD_SEARCH received:');
      this.outputChannel.appendLine(`  source.mode: ${message.source?.mode ?? 'NONE'}`);
      this.outputChannel.appendLine(`  source.pathText: ${message.source?.pathText ?? 'NONE'}`);
      this.outputChannel.appendLine(`  text field: ${message.text ? `"${message.text.substring(0, 50)}..."` : 'NONE'}`);

      const resolved = await this.resolveRichTextForMetrics(message);

      // DEBUG: Log what was resolved
      this.outputChannel.appendLine('[SearchHandler] Resolved to:');
      this.outputChannel.appendLine(`  mode: ${resolved.mode ?? 'NONE'}`);
      this.outputChannel.appendLine(`  text length: ${resolved.text.length} chars`);
      this.outputChannel.appendLine(`  text preview: "${resolved.text.substring(0, 100).replace(/\n/g, '\\n')}..."`);
      this.outputChannel.appendLine(`  paths: ${resolved.paths?.join(', ') ?? 'NONE'}`);

      const options = message.options || {};
      const result = await this.service.measureWordSearch(
        resolved.text,
        resolved.paths,
        resolved.mode,
        options as any
      );
      this.sendSearchResult(result.metrics, result.toolName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[SearchHandler] ERROR: ${msg}`);
      this.sendError('Invalid selection or path', msg);
    }
  }

  private async resolveRichTextForMetrics(message: { text?: string; source?: any }): Promise<{ text: string; paths?: string[]; mode?: string }> {
    if (!message.source) {
      const t = (message.text ?? '').trim();
      if (!t) {
        throw new Error('No text provided for search.');
      }
      return { text: t };
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
