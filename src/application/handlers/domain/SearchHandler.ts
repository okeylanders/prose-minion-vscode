/**
 * Search domain handler
 * Handles word search operations
 */

import * as vscode from 'vscode';
import { IProseAnalysisService } from '../../../domain/services/IProseAnalysisService';
import {
  RunWordSearchMessage,
  MessageType,
  ErrorSource,
  SearchResultMessage,
  ErrorMessage
} from '../../../shared/types/messages';
import { MessageRouter } from '../MessageRouter';

export class SearchHandler {
  constructor(
    private readonly service: IProseAnalysisService,
    private readonly postMessage: (message: any) => Promise<void>,
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  /**
   * Register message routes for search domain
   */
  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.RUN_WORD_SEARCH, this.handleMeasureWordSearch.bind(this));
  }

  // Helper methods (domain owns its message lifecycle)

  private sendSearchResult(result: any, toolName: string): void {
    const message: SearchResultMessage = {
      type: MessageType.SEARCH_RESULT,
      source: 'extension.search',
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
      source: 'extension.search',
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

  async handleMeasureWordSearch(message: RunWordSearchMessage): Promise<void> {
    try {
      const { text, source, options } = message.payload;

      const resolved = await this.resolveRichTextForMetrics({ text, source });

      const searchOptions = options || {};
      const result = await this.service.measureWordSearch(
        resolved.text,
        resolved.paths,
        resolved.mode,
        searchOptions as any
      );
      this.sendSearchResult(result.metrics, result.toolName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('search', 'Invalid selection or path', msg);
    }
  }

  private async resolveRichTextForMetrics(payload: { text?: string; source?: any }): Promise<{ text: string; paths?: string[]; mode?: string }> {
    if (!payload.source) {
      const t = (payload.text ?? '').trim();
      if (!t) {
        throw new Error('No text provided for search.');
      }
      return { text: t };
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
