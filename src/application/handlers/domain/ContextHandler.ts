/**
 * Context domain handler
 * Handles context generation operations
 *
 * SPRINT 05 REFACTOR: Now injects ContextAssistantService directly (facade removed)
 */

import * as vscode from 'vscode';
import { ContextAssistantService } from '../../../infrastructure/api/services/analysis/ContextAssistantService';
import { ContextGenerationResult } from '../../../domain/models/ContextGeneration';
import {
  GenerateContextMessage,
  MessageType,
  TokenUsage,
  ErrorSource,
  ContextResultMessage,
  StatusMessage,
  ErrorMessage
} from '../../../shared/types/messages';
import { MessageRouter } from '../MessageRouter';

export class ContextHandler {
  constructor(
    private readonly contextAssistantService: ContextAssistantService,
    private readonly postMessage: (message: any) => Promise<void>,
    private readonly applyTokenUsageCallback: (usage: TokenUsage) => void
  ) {}

  /**
   * Register message routes for context domain
   */
  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.GENERATE_CONTEXT, this.handleGenerateContext.bind(this));
  }

  // Helper methods (domain owns its message lifecycle)

  private sendContextResult(result: ContextGenerationResult): void {
    const message: ContextResultMessage = {
      type: MessageType.CONTEXT_RESULT,
      source: 'extension.context',
      payload: {
        result: result.content,
        toolName: result.toolName,
        requestedResources: result.requestedResources
      },
      timestamp: Date.now()
    };
    void this.postMessage(message);
    this.sendStatus('');
  }

  private sendStatus(message: string, guideNames?: string): void {
    const statusMessage: StatusMessage = {
      type: MessageType.STATUS,
      source: 'extension.context',
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
      source: 'extension.context',
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

  async handleGenerateContext(message: GenerateContextMessage): Promise<void> {
    try {
      const { excerpt, existingContext, sourceFileUri, requestedGroups } = message.payload;

      if (!excerpt.trim()) {
        this.sendError('context', 'Context assistant needs an excerpt to analyze.');
        return;
      }

      this.sendStatus('Gathering project resources for context...');
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await this.contextAssistantService.generateContext({
        excerpt,
        existingContext,
        sourceFileUri,
        requestedGroups
      });

      this.sendContextResult(result);
      if ((result as any).usage) {
        this.applyTokenUsage((result as any).usage);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('context', 'Failed to generate context', msg);
    }
  }
}
