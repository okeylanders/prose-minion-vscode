/**
 * Context domain handler
 * Handles context generation operations
 */

import { IProseAnalysisService } from '../../../domain/services/IProseAnalysisService';
import { ContextGenerationResult } from '../../../domain/models/ContextGeneration';
import {
  GenerateContextMessage,
  MessageType,
  TokenUsage,
  ErrorSource
} from '../../../shared/types/messages';
import { MessageRouter } from '../MessageRouter';

export class ContextHandler {
  constructor(
    private readonly service: IProseAnalysisService,
    private readonly sendStatus: (message: string, guideNames?: string) => void,
    private readonly sendContextResult: (result: ContextGenerationResult) => void,
    private readonly sendError: (source: ErrorSource, message: string, details?: string) => void,
    private readonly applyTokenUsage: (usage: TokenUsage) => void
  ) {}

  /**
   * Register message routes for context domain
   */
  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.GENERATE_CONTEXT, this.handleGenerateContext.bind(this));
  }

  async handleGenerateContext(message: GenerateContextMessage): Promise<void> {
    if (!message.excerpt.trim()) {
      this.sendError('context', 'Context assistant needs an excerpt to analyze.');
      return;
    }

    this.sendStatus('Gathering project resources for context...');
    await new Promise(resolve => setTimeout(resolve, 100));

    const result = await this.service.generateContext({
      excerpt: message.excerpt,
      existingContext: message.existingContext,
      sourceFileUri: message.sourceFileUri,
      requestedGroups: message.requestedGroups
    });

    this.sendContextResult(result);
    if ((result as any).usage) {
      this.applyTokenUsage((result as any).usage);
    }
  }
}
