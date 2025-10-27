/**
 * Analysis domain handler
 * Handles dialogue and prose analysis operations
 */

import * as vscode from 'vscode';
import { IProseAnalysisService } from '../../../domain/services/IProseAnalysisService';
import {
  AnalyzeDialogueMessage,
  AnalyzeProseMessage,
  TokenUsage
} from '../../../shared/types/messages';

export class AnalysisHandler {
  constructor(
    private readonly service: IProseAnalysisService,
    private readonly sendStatus: (message: string, guideNames?: string) => void,
    private readonly sendAnalysisResult: (result: string, toolName: string, usedGuides?: string[]) => void,
    private readonly sendError: (message: string, details?: string) => void,
    private readonly applyTokenUsage: (usage: TokenUsage) => void
  ) {}

  async handleAnalyzeDialogue(message: AnalyzeDialogueMessage): Promise<void> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const includeCraftGuides = config.get<boolean>('includeCraftGuides') ?? true;

    const loadingMessage = includeCraftGuides
      ? 'Loading prompts and craft guides...'
      : 'Loading prompts...';

    this.sendStatus(loadingMessage);
    await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay to ensure UI updates

    this.sendStatus('Analyzing dialogue with AI...');
    const result = await this.service.analyzeDialogue(
      message.text,
      message.contextText,
      message.sourceFileUri
    );
    this.sendAnalysisResult(result.content, result.toolName, result.usedGuides);
    if ((result as any).usage) {
      this.applyTokenUsage((result as any).usage);
    }
  }

  async handleAnalyzeProse(message: AnalyzeProseMessage): Promise<void> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const includeCraftGuides = config.get<boolean>('includeCraftGuides') ?? true;

    const loadingMessage = includeCraftGuides
      ? 'Loading prompts and craft guides...'
      : 'Loading prompts...';

    this.sendStatus(loadingMessage);
    await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay to ensure UI updates

    this.sendStatus('Analyzing prose with AI...');
    const result = await this.service.analyzeProse(
      message.text,
      message.contextText,
      message.sourceFileUri
    );
    this.sendAnalysisResult(result.content, result.toolName, result.usedGuides);
    if ((result as any).usage) {
      this.applyTokenUsage((result as any).usage);
    }
  }
}
