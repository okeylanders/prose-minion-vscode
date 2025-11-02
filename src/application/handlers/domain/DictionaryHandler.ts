/**
 * Dictionary domain handler
 * Handles dictionary lookup operations
 */

import * as vscode from 'vscode';
import { IProseAnalysisService } from '../../../domain/services/IProseAnalysisService';
import {
  LookupDictionaryMessage,
  MessageType,
  TokenUsage,
  ErrorSource,
  DictionaryResultMessage,
  StatusMessage,
  ErrorMessage
} from '../../../shared/types/messages';
import { MessageRouter } from '../MessageRouter';

export class DictionaryHandler {
  constructor(
    private readonly service: IProseAnalysisService,
    private readonly postMessage: (message: any) => Promise<void>,
    private readonly applyTokenUsageCallback: (usage: TokenUsage) => void
  ) {}

  /**
   * Register message routes for dictionary domain
   */
  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.LOOKUP_DICTIONARY, this.handleLookupDictionary.bind(this));
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
      const result = await this.service.lookupDictionary(word, contextText);
      this.sendDictionaryResult(result.content, result.toolName);
      if ((result as any).usage) {
        this.applyTokenUsage((result as any).usage);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('dictionary', 'Failed to lookup dictionary entry', msg);
    }
  }
}
