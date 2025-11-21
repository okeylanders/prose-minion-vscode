/**
 * Dictionary domain handler
 * Handles dictionary lookup operations
 *
 * SPRINT 05 REFACTOR: Now injects DictionaryService directly (facade removed)
 */

import * as vscode from 'vscode';
import { DictionaryService } from '../../../infrastructure/api/services/dictionary/DictionaryService';
import {
  LookupDictionaryMessage,
  FastGenerateDictionaryMessage,
  MessageType,
  TokenUsage,
  ErrorSource,
  DictionaryResultMessage,
  FastGenerateDictionaryResultMessage,
  DictionaryGenerationProgressMessage,
  StatusMessage,
  ErrorMessage
} from '../../../shared/types/messages';
import { MessageRouter } from '../MessageRouter';

export class DictionaryHandler {
  constructor(
    private readonly dictionaryService: DictionaryService,
    private readonly postMessage: (message: any) => Promise<void>,
    private readonly applyTokenUsageCallback: (usage: TokenUsage) => void
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

  private sendStatus(message: string, guideNames?: string): void {
    const statusMessage: StatusMessage = {
      type: MessageType.STATUS,
      source: 'extension.dictionary',
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

  private applyTokenUsage(usage: TokenUsage): void {
    // Delegate to MessageHandler's centralized token tracking
    this.applyTokenUsageCallback(usage);
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
      if ((result as any).usage) {
        this.applyTokenUsage((result as any).usage);
      }
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

      // Progress callback to send updates to webview
      const onProgress = (progress: {
        word: string;
        completedBlocks: string[];
        totalBlocks: number;
      }): void => {
        this.sendProgress(progress.word, progress.completedBlocks, progress.totalBlocks);
      };

      // Generate parallel dictionary
      const result = await this.dictionaryService.generateParallelDictionary(
        word,
        context,
        onProgress
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

  /**
   * Send generation progress update to webview
   */
  private sendProgress(word: string, completedBlocks: string[], totalBlocks: number): void {
    const message: DictionaryGenerationProgressMessage = {
      type: MessageType.DICTIONARY_GENERATION_PROGRESS,
      source: 'extension.dictionary',
      payload: {
        word,
        completedBlocks,
        totalBlocks
      },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }
}
