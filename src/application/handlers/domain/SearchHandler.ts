/**
 * Search domain handler
 * Handles word search operations
 *
 * SPRINT 05 REFACTOR: Now injects WordSearchService directly (facade removed)
 */

import * as vscode from 'vscode';
import { WordSearchService } from '@services/search/WordSearchService';
import { CategorySearchService } from '@services/search/CategorySearchService';
import {
  RunWordSearchMessage,
  CategorySearchRequestMessage,
  CategorySearchResult,
  MessageType,
  ErrorSource,
  SearchResultMessage,
  CategorySearchResultMessage,
  ErrorMessage,
  TokenUsage,
  StatusMessage
} from '@messages';
import { MessageRouter } from '../MessageRouter';

export class SearchHandler {
  constructor(
    private readonly wordSearchService: WordSearchService,
    private readonly postMessage: (message: any) => Promise<void>,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly categorySearchService?: CategorySearchService,
    private readonly applyTokenUsageCallback?: (usage: TokenUsage) => void
  ) {}

  /**
   * Register message routes for search domain
   */
  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.RUN_WORD_SEARCH, this.handleMeasureWordSearch.bind(this));
    router.register(MessageType.CATEGORY_SEARCH_REQUEST, this.handleCategorySearchRequest.bind(this));
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

  private sendStatus(message: string, progress?: { current: number; total: number }, tickerMessage?: string): void {
    const status: StatusMessage = {
      type: MessageType.STATUS,
      source: 'extension.search',
      payload: { message, progress, tickerMessage },
      timestamp: Date.now()
    };
    void this.postMessage(status);
  }

  private sendCategorySearchResult(result: CategorySearchResult): void {
    const message: CategorySearchResultMessage = {
      type: MessageType.CATEGORY_SEARCH_RESULT,
      source: 'extension.search',
      payload: {
        result,
        toolName: 'category_search'
      },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  // Message handlers

  async handleMeasureWordSearch(message: RunWordSearchMessage): Promise<void> {
    try {
      const { text, source, options } = message.payload;

      const resolved = await this.resolveRichTextForMetrics({ text, source });

      const searchOptions = options || {};
      const result = await this.wordSearchService.searchWords(
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

  async handleCategorySearchRequest(message: CategorySearchRequestMessage): Promise<void> {
    try {
      if (!this.categorySearchService) {
        this.sendError('search', 'Category search not available', 'CategorySearchService not initialized');
        return;
      }

      const { query, source, options } = message.payload;

      if (!query || query.trim().length === 0) {
        this.sendError('search', 'Invalid query', 'Query cannot be empty');
        return;
      }

      const resolved = await this.resolveRichTextForMetrics({ source });

      const result = await this.categorySearchService.searchByCategory(
        query.trim(),
        resolved.text,
        resolved.paths,
        resolved.mode,
        options
      );

      // Apply token usage to global tracking
      if (result.tokensUsed && this.applyTokenUsageCallback) {
        this.applyTokenUsageCallback({
          promptTokens: result.tokensUsed.prompt,
          completionTokens: result.tokensUsed.completion,
          totalTokens: result.tokensUsed.total,
          costUsd: result.tokensUsed.costUsd
        });
      }

      this.sendCategorySearchResult(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[SearchHandler] Category search error: ${msg}`);
      this.sendError('search', 'Category search failed', msg);
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
    const { TextSourceResolver } = await import('@/infrastructure/text/TextSourceResolver');
    const resolver = new TextSourceResolver(this.outputChannel);
    const resolved = await resolver.resolve(payload.source);
    const text = (resolved.text ?? '').trim();
    if (!text) throw new Error('Resolved source contains no text.');
    const mode = payload.source?.mode;
    return { text, paths: resolved.relativePaths, mode };
  }
}
