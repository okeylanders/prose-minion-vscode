/**
 * Dictionary domain handler
 * Handles dictionary lookup operations
 */

import { IProseAnalysisService } from '../../../domain/services/IProseAnalysisService';
import {
  LookupDictionaryMessage,
  TokenUsage
} from '../../../shared/types/messages';

export class DictionaryHandler {
  constructor(
    private readonly service: IProseAnalysisService,
    private readonly sendStatus: (message: string, guideNames?: string) => void,
    private readonly sendDictionaryResult: (result: string, toolName: string) => void,
    private readonly sendError: (message: string, details?: string) => void,
    private readonly applyTokenUsage: (usage: TokenUsage) => void
  ) {}

  async handleLookupDictionary(message: LookupDictionaryMessage): Promise<void> {
    if (!message.word.trim()) {
      this.sendError('Dictionary lookup requires a word to search');
      return;
    }

    this.sendStatus('Preparing dictionary prompt...');
    await new Promise(resolve => setTimeout(resolve, 100));

    this.sendStatus(`Generating dictionary entry for "${message.word}"...`);
    const result = await this.service.lookupDictionary(message.word, message.contextText);
    this.sendDictionaryResult(result.content, result.toolName);
    if ((result as any).usage) {
      this.applyTokenUsage((result as any).usage);
    }
  }
}
