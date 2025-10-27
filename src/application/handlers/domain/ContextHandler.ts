/**
 * Context domain handler
 * Handles context generation operations
 */

import { IProseAnalysisService } from '../../../domain/services/IProseAnalysisService';
import { ContextGenerationResult } from '../../../domain/models/ContextGeneration';
import {
  GenerateContextMessage,
  TokenUsage
} from '../../../shared/types/messages';

export class ContextHandler {
  constructor(
    private readonly service: IProseAnalysisService,
    private readonly sendStatus: (message: string, guideNames?: string) => void,
    private readonly sendContextResult: (result: ContextGenerationResult) => void,
    private readonly sendError: (message: string, details?: string) => void,
    private readonly applyTokenUsage: (usage: TokenUsage) => void
  ) {}

  async handleGenerateContext(message: GenerateContextMessage): Promise<void> {
    if (!message.excerpt.trim()) {
      this.sendError('Context assistant needs an excerpt to analyze.');
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
