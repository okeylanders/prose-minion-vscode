/**
 * Implementation of IProseAnalysisService
 * Integrates all prose analysis tools
 */

import * as vscode from 'vscode';
import { IProseAnalysisService } from '../../domain/services/IProseAnalysisService';
import { AnalysisResult, MetricsResult, AnalysisResultFactory } from '../../domain/models/AnalysisResult';
import { OpenRouterClient } from './OpenRouterClient';
import { PromptLoader } from '../../tools/shared/prompts';
import { GuideLoader } from '../../tools/shared/guides';
import { DialogueMicrobeatAssistant } from '../../tools/assist/dialogueMicrobeatAssistant';
import { ProseAssistant } from '../../tools/assist/proseAssistant';
import { PassageProseStats } from '../../tools/measure/passageProseStats';
import { StyleFlags } from '../../tools/measure/styleFlags';
import { WordFrequency } from '../../tools/measure/wordFrequency';

export class ProseAnalysisService implements IProseAnalysisService {
  private openRouterClient?: OpenRouterClient;
  private dialogueAssistant?: DialogueMicrobeatAssistant;
  private proseAssistant?: ProseAssistant;
  private proseStats: PassageProseStats;
  private styleFlags: StyleFlags;
  private wordFrequency: WordFrequency;

  constructor(private readonly extensionUri?: vscode.Uri) {
    // Initialize measurement tools (don't need API key)
    this.proseStats = new PassageProseStats();
    this.styleFlags = new StyleFlags();
    this.wordFrequency = new WordFrequency();

    // Initialize AI tools if API key is configured
    this.initializeAITools();
  }

  private async initializeAITools(): Promise<void> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const apiKey = config.get<string>('openRouterApiKey');
    const model = config.get<string>('model') || 'anthropic/claude-3.5-sonnet';

    if (OpenRouterClient.isConfigured(apiKey)) {
      this.openRouterClient = new OpenRouterClient(apiKey!, model);

      if (this.extensionUri) {
        const promptLoader = new PromptLoader(this.extensionUri);
        const guideLoader = new GuideLoader(this.extensionUri);

        this.dialogueAssistant = new DialogueMicrobeatAssistant(
          this.openRouterClient,
          promptLoader,
          guideLoader
        );

        this.proseAssistant = new ProseAssistant(
          this.openRouterClient,
          promptLoader,
          guideLoader
        );
      }
    }
  }

  private getToolOptions() {
    const config = vscode.workspace.getConfiguration('proseMinion');
    return {
      includeCraftGuides: config.get<boolean>('includeCraftGuides') ?? true,
      temperature: config.get<number>('temperature') ?? 0.7,
      maxTokens: config.get<number>('maxTokens') ?? 2000
    };
  }

  async analyzeDialogue(text: string): Promise<AnalysisResult> {
    if (!this.dialogueAssistant) {
      return AnalysisResultFactory.createAnalysisResult(
        'dialogue_analysis',
        this.getApiKeyWarning()
      );
    }

    try {
      const options = this.getToolOptions();
      const result = await this.dialogueAssistant.analyze({ text }, options);
      return AnalysisResultFactory.createAnalysisResult('dialogue_analysis', result);
    } catch (error) {
      return AnalysisResultFactory.createAnalysisResult(
        'dialogue_analysis',
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async analyzeProse(text: string): Promise<AnalysisResult> {
    if (!this.proseAssistant) {
      return AnalysisResultFactory.createAnalysisResult(
        'prose_analysis',
        this.getApiKeyWarning()
      );
    }

    try {
      const options = this.getToolOptions();
      const result = await this.proseAssistant.analyze({ text }, options);
      return AnalysisResultFactory.createAnalysisResult('prose_analysis', result);
    } catch (error) {
      return AnalysisResultFactory.createAnalysisResult(
        'prose_analysis',
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async measureProseStats(text: string): Promise<MetricsResult> {
    try {
      const stats = this.proseStats.analyze({ text });
      return AnalysisResultFactory.createMetricsResult('prose_stats', stats);
    } catch (error) {
      return AnalysisResultFactory.createMetricsResult('prose_stats', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async measureStyleFlags(text: string): Promise<MetricsResult> {
    try {
      const flags = this.styleFlags.analyze({ text });
      return AnalysisResultFactory.createMetricsResult('style_flags', flags);
    } catch (error) {
      return AnalysisResultFactory.createMetricsResult('style_flags', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async measureWordFrequency(text: string): Promise<MetricsResult> {
    try {
      const frequency = this.wordFrequency.analyze({ text });
      return AnalysisResultFactory.createMetricsResult('word_frequency', frequency);
    } catch (error) {
      return AnalysisResultFactory.createMetricsResult('word_frequency', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private getApiKeyWarning(): string {
    return `⚠️ OpenRouter API key not configured

To use AI-powered analysis tools, you need to configure your OpenRouter API key:

1. Get an API key from https://openrouter.ai/
2. Open VS Code Settings (Cmd+, or Ctrl+,)
3. Search for "Prose Minion"
4. Enter your API key in "OpenRouter API Key"

The measurement tools (Prose Statistics, Style Flags, Word Frequency) work without an API key.`;
  }
}
