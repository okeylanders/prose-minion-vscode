/**
 * Dictionary domain handler
 * Handles dictionary lookup operations
 *
 * SPRINT 05 REFACTOR: Now injects DictionaryService directly (facade removed)
 */

import * as vscode from 'vscode';
import { DictionaryService } from '@services/dictionary/DictionaryService';
import {
  LookupDictionaryMessage,
  FastGenerateDictionaryMessage,
  MessageType,
  ErrorSource,
  DictionaryResultMessage,
  FastGenerateDictionaryResultMessage,
  StatusMessage,
  ErrorMessage
} from '@messages';
import { MessageRouter } from '../MessageRouter';

export class DictionaryHandler {
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
  }

  // Helper methods (domain owns its message lifecycle)

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

  // Message handlers

  async handleLookupDictionary(message: LookupDictionaryMessage): Promise<void> {
    try {
      const { word, contextText } = message.payload;

      if (!word.trim()) {
        this.sendError('dictionary', 'Dictionary lookup requires a word to search');
        return;
      }

      this.sendStatus(`Generating dictionary entry for "${word}"...`);
      const result = await this.dictionaryService.lookupWord(word, contextText);
      this.sendDictionaryResult(result.content, result.toolName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('dictionary', 'Failed to lookup dictionary entry', msg);
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
