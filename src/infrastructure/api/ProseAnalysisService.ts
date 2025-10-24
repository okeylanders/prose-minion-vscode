/**
 * Implementation of IProseAnalysisService
 * Integrates all tools
 */

import * as vscode from 'vscode';
import { IProseAnalysisService } from '../../domain/services/IProseAnalysisService';
import { AnalysisResult, MetricsResult, AnalysisResultFactory } from '../../domain/models/AnalysisResult';
import {
  ContextGenerationRequest,
  ContextGenerationResult,
  ContextResourceProvider,
  DEFAULT_CONTEXT_GROUPS
} from '../../domain/models/ContextGeneration';
import { OpenRouterClient } from './OpenRouterClient';
import { PromptLoader } from '../../tools/shared/prompts';
import { GuideLoader } from '../../tools/shared/guides';
import { DialogueMicrobeatAssistant } from '../../tools/assist/dialogueMicrobeatAssistant';
import { ProseAssistant } from '../../tools/assist/proseAssistant';
import { ContextAssistant } from '../../tools/assist/contextAssistant';
import { ContextResourceResolver } from '../context/ContextResourceResolver';
import { PassageProseStats } from '../../tools/measure/passageProseStats';
import { StyleFlags } from '../../tools/measure/styleFlags';
import { WordFrequency } from '../../tools/measure/wordFrequency';
import { AIResourceOrchestrator, StatusCallback } from '../../application/services/AIResourceOrchestrator';
import { ConversationManager } from '../../application/services/ConversationManager';
import { GuideRegistry } from '../../infrastructure/guides/GuideRegistry';
import { DictionaryUtility } from '../../tools/utility/dictionaryUtility';
import { ModelScope } from '../../shared/types';
import { ContextPathGroup } from '../../shared/types';
import { PublishingStandardsRepository } from '../standards/PublishingStandardsRepository';
import { StandardsComparisonService } from '../../application/services/StandardsComparisonService';
import { Genre } from '../../domain/models/PublishingStandards';

interface AIResourceBundle {
  model: string;
  orchestrator: AIResourceOrchestrator;
}

export class ProseAnalysisService implements IProseAnalysisService {
  private proseStats: PassageProseStats;
  private styleFlags: StyleFlags;
  private wordFrequency: WordFrequency;

  private statusCallback?: StatusCallback;

  private promptLoader?: PromptLoader;
  private guideLoader?: GuideLoader;
  private guideRegistry?: GuideRegistry;
  private standardsRepo?: PublishingStandardsRepository;
  private standardsComparer = new StandardsComparisonService();

  private aiResources: Partial<Record<ModelScope, AIResourceBundle>> = {};
  private resolvedModels: Partial<Record<ModelScope, string>> = {};

  private dialogueAssistant?: DialogueMicrobeatAssistant;
  private proseAssistant?: ProseAssistant;
  private dictionaryUtility?: DictionaryUtility;
  private contextAssistant?: ContextAssistant;
  private contextResourceResolver: ContextResourceResolver;

  constructor(
    private readonly extensionUri?: vscode.Uri,
    private readonly outputChannel?: vscode.OutputChannel
  ) {
    // Initialize measurement tools (don't need API key)
    this.proseStats = new PassageProseStats();
    this.styleFlags = new StyleFlags();
    this.wordFrequency = new WordFrequency();

    // Initialize AI tools if API key is configured
    this.initializeAITools();

    this.contextResourceResolver = new ContextResourceResolver(this.outputChannel);

    if (this.extensionUri) {
      this.standardsRepo = new PublishingStandardsRepository(this.extensionUri, this.outputChannel);
    }
  }

  private async initializeAITools(): Promise<void> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const apiKey = config.get<string>('openRouterApiKey');

    this.disposeAIResources();

    if (!OpenRouterClient.isConfigured(apiKey)) {
      this.outputChannel?.appendLine('[ProseAnalysisService] OpenRouter API key not configured. AI tools disabled.');
      this.dialogueAssistant = undefined;
      this.proseAssistant = undefined;
      this.dictionaryUtility = undefined;
      this.contextAssistant = undefined;
      this.resolvedModels = {};
      return;
    }

    if (!this.extensionUri) {
      this.outputChannel?.appendLine('[ProseAnalysisService] Extension URI unavailable; cannot initialize AI tools.');
      return;
    }

    this.ensureSharedResources();

    const fallbackModel = config.get<string>('model') || 'z-ai/glm-4.6';
    const assistantModel = config.get<string>('assistantModel') || fallbackModel;
    const dictionaryModel = config.get<string>('dictionaryModel') || fallbackModel;
    const contextModel = config.get<string>('contextModel') || fallbackModel;

    const assistantResources = this.createAIResources(apiKey!, 'assistant', assistantModel);
    const dictionaryResources = this.createAIResources(apiKey!, 'dictionary', dictionaryModel);
    const contextResources = this.createAIResources(apiKey!, 'context', contextModel);

    this.aiResources = {
      assistant: assistantResources,
      dictionary: dictionaryResources,
      context: contextResources
    };

    if (assistantResources) {
      this.dialogueAssistant = new DialogueMicrobeatAssistant(
        assistantResources.orchestrator,
        this.promptLoader!
      );

      this.proseAssistant = new ProseAssistant(
        assistantResources.orchestrator,
        this.promptLoader!
      );
    } else {
      this.dialogueAssistant = undefined;
      this.proseAssistant = undefined;
    }

    this.dictionaryUtility = dictionaryResources
      ? new DictionaryUtility(dictionaryResources.orchestrator, this.promptLoader!)
      : undefined;

    this.contextAssistant = contextResources
      ? new ContextAssistant(contextResources.orchestrator, this.promptLoader!)
      : undefined;

    const callback = this.statusCallback;
    if (callback) {
      Object.values(this.aiResources).forEach(resource => resource?.orchestrator.setStatusCallback(callback));
    }

    this.resolvedModels = {
      assistant: assistantModel,
      dictionary: dictionaryModel,
      context: contextModel
    };
  }

  /**
   * Set the status callback for guide loading notifications
   * This should be called by the MessageHandler to receive status updates
   */
  setStatusCallback(callback: StatusCallback): void {
    this.statusCallback = callback;
    Object.values(this.aiResources).forEach(resource => resource?.orchestrator.setStatusCallback(callback));
  }

  /**
   * Reload model configuration and rebuild AI tool scaffolding
   */
  async refreshConfiguration(): Promise<void> {
    await this.initializeAITools();
  }

  /**
   * Expose the currently resolved models (with fallbacks applied)
   */
  getResolvedModelSelections(): Partial<Record<ModelScope, string>> {
    return { ...this.resolvedModels };
  }

  private disposeAIResources(): void {
    Object.values(this.aiResources).forEach(resource => resource?.orchestrator.dispose());
    this.aiResources = {};
    this.contextAssistant = undefined;
  }

  private ensureSharedResources(): void {
    if (!this.promptLoader) {
      this.promptLoader = new PromptLoader(this.extensionUri!);
    }

    if (!this.guideLoader) {
      this.guideLoader = new GuideLoader(this.extensionUri!);
    }

    if (!this.guideRegistry) {
      this.guideRegistry = new GuideRegistry(this.extensionUri!, this.outputChannel);
    }
  }

  private createAIResources(apiKey: string, scope: ModelScope, model: string): AIResourceBundle | undefined {
    if (!this.guideRegistry || !this.guideLoader) {
      return undefined;
    }

    try {
      const client = new OpenRouterClient(apiKey, model);
      const conversationManager = new ConversationManager();
      const orchestrator = new AIResourceOrchestrator(
        client,
        conversationManager,
        this.guideRegistry,
        this.guideLoader,
        this.statusCallback,
        this.outputChannel
      );

      this.outputChannel?.appendLine(
        `[ProseAnalysisService] Initialized ${scope} model: ${model}`
      );

      return {
        model,
        orchestrator
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel?.appendLine(
        `[ProseAnalysisService] Failed to initialize ${scope} model ${model}: ${message}`
      );
      return undefined;
    }
  }

  private getToolOptions() {
    const config = vscode.workspace.getConfiguration('proseMinion');
    return {
      includeCraftGuides: config.get<boolean>('includeCraftGuides') ?? true,
      temperature: config.get<number>('temperature') ?? 0.7,
      maxTokens: config.get<number>('maxTokens') ?? 10000
    };
  }

  async analyzeDialogue(text: string, contextText?: string, sourceFileUri?: string): Promise<AnalysisResult> {
    if (!this.dialogueAssistant) {
      return AnalysisResultFactory.createAnalysisResult(
        'dialogue_analysis',
        this.getApiKeyWarning()
      );
    }

    try {
      const options = this.getToolOptions();
      const executionResult = await this.dialogueAssistant.analyze(
        {
          text,
          contextText,
          sourceFileUri
        },
        options
      );
      return AnalysisResultFactory.createAnalysisResult(
        'dialogue_analysis',
        executionResult.content,
        executionResult.usedGuides
      );
    } catch (error) {
      return AnalysisResultFactory.createAnalysisResult(
        'dialogue_analysis',
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async analyzeProse(text: string, contextText?: string, sourceFileUri?: string): Promise<AnalysisResult> {
    if (!this.proseAssistant) {
      return AnalysisResultFactory.createAnalysisResult(
        'prose_analysis',
        this.getApiKeyWarning()
      );
    }

    try {
      const options = this.getToolOptions();
      const executionResult = await this.proseAssistant.analyze(
        {
          text,
          contextText,
          sourceFileUri
        },
        options
      );
      return AnalysisResultFactory.createAnalysisResult(
        'prose_analysis',
        executionResult.content,
        executionResult.usedGuides
      );
    } catch (error) {
      return AnalysisResultFactory.createAnalysisResult(
        'prose_analysis',
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async measureProseStats(text: string, files?: string[], sourceMode?: string): Promise<MetricsResult> {
    try {
      const stats = this.proseStats.analyze({ text });

      // Chapter aggregation (for multi-file modes)
      if (files && files.length > 0 && (sourceMode === 'manuscript' || sourceMode === 'chapters')) {
        const chapterWordCounts = await this.computeWordCountsForFiles(files);
        const chapterCount = chapterWordCounts.length;
        const totalWords = chapterWordCounts.reduce((a, b) => a + b, 0);
        const avgChapterLength = chapterCount > 0 ? Math.round(totalWords / chapterCount) : 0;
        (stats as any).chapterCount = chapterCount;
        (stats as any).averageChapterLength = avgChapterLength;
      }

      // Standards comparison (based on settings)
      const enriched = await this.enrichWithStandards(stats);
      return AnalysisResultFactory.createMetricsResult('prose_stats', enriched);
    } catch (error) {
      return AnalysisResultFactory.createMetricsResult('prose_stats', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async computeWordCountsForFiles(relativePaths: string[]): Promise<number[]> {
    const counts: number[] = [];
    for (const rel of relativePaths) {
      try {
        // Resolve URI from workspace
        const uri = await this.findUriByRelativePath(rel);
        if (!uri) continue;
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(raw).toString('utf8');
        counts.push(this.simpleWordCount(text));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.outputChannel?.appendLine(`[ProseAnalysisService] Failed counting words for ${rel}: ${msg}`);
      }
    }
    return counts;
  }

  private simpleWordCount(text: string): number {
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }

  private async findUriByRelativePath(relativePath: string): Promise<vscode.Uri | undefined> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const folder of folders) {
      const candidate = vscode.Uri.joinPath(folder.uri, relativePath);
      try {
        await vscode.workspace.fs.stat(candidate);
        return candidate;
      } catch {
        // continue
      }
    }
    return undefined;
  }

  private async enrichWithStandards(stats: any): Promise<any> {
    try {
      if (!this.standardsRepo) return stats;
      const config = vscode.workspace.getConfiguration('proseMinion');
      const preset = (config.get<string>('publishingStandards.preset') || 'none').trim().toLowerCase();
      if (preset === 'none') return stats;

      if (preset === 'manuscript') {
        // Manuscript format currently not deeply compared; may add in future
        return stats;
      }

      // genre:<key>
      let selectedGenre: Genre | undefined;
      if (preset.startsWith('genre:')) {
        const key = preset.slice('genre:'.length).trim();
        selectedGenre = await this.standardsRepo.findGenre(key);
      } else {
        // Backward fallback: try direct key
        selectedGenre = await this.standardsRepo.findGenre(preset);
      }
      if (!selectedGenre) return stats;

      const pageSizeKey = (config.get<string>('publishingStandards.pageSizeKey') || '').trim();
      const comparer = this.standardsComparer;

      const items = [] as any[];
      const S = selectedGenre.literary_statistics;

      const push = (key: string, label: string, value: number | string | undefined, range?: any) => {
        const item = comparer.makeItem(key, label, value as any, range);
        if (item) items.push(item);
      };

      push('word_count', 'Word Count', stats.wordCount, selectedGenre.word_count_range);
      push('dialogue_percentage', 'Dialogue %', stats.dialoguePercentage, S.dialogue_percentage);
      push('lexical_density', 'Lexical Density %', stats.lexicalDensity, S.lexical_density);
      push('avg_words_per_sentence', 'Avg Words/Sentence', stats.averageWordsPerSentence, S.avg_words_per_sentence);
      push('avg_sentences_per_paragraph', 'Avg Sentences/Paragraph', stats.averageSentencesPerParagraph, S.avg_sentences_per_paragraph);
      push('unique_word_count', 'Unique Words', stats.uniqueWordCount, S.unique_word_count);

      if (stats.wordLengthDistribution) {
        push('wlen_1_3', '1–3 Letter %', Math.round(stats.wordLengthDistribution['1_to_3_letters'] * 10) / 10, S.word_length_distribution['1_to_3_letters']);
        push('wlen_4_6', '4–6 Letter %', Math.round(stats.wordLengthDistribution['4_to_6_letters'] * 10) / 10, S.word_length_distribution['4_to_6_letters']);
        push('wlen_7_plus', '7+ Letter %', Math.round(stats.wordLengthDistribution['7_plus_letters'] * 10) / 10, S.word_length_distribution['7_plus_letters']);
      }

      if (stats.chapterCount !== undefined) {
        push('chapter_count', 'Chapter Count', stats.chapterCount, S.chapter_count as any);
      }
      if (stats.averageChapterLength !== undefined) {
        push('avg_chapter_length', 'Avg Chapter Length', stats.averageChapterLength, S.avg_chapter_length as any);
      }

      const publishingFormat = this.standardsComparer.buildPublishingFormat(selectedGenre, stats.wordCount, pageSizeKey || undefined);

      return {
        ...stats,
        comparison: { items },
        publishingFormat
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.outputChannel?.appendLine(`[ProseAnalysisService] Standards enrichment failed: ${msg}`);
      return stats;
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

  async lookupDictionary(word: string, contextText?: string): Promise<AnalysisResult> {
    if (!this.dictionaryUtility) {
      return AnalysisResultFactory.createAnalysisResult(
        'dictionary_lookup',
        this.getApiKeyWarning()
      );
    }

    try {
      const options = this.getToolOptions();
      const executionResult = await this.dictionaryUtility.lookup(
        {
          word,
          contextText
        },
        {
          temperature: options.temperature ?? 0.4,
          maxTokens: options.maxTokens
        }
      );

      return AnalysisResultFactory.createAnalysisResult(
        'dictionary_lookup',
        executionResult.content
      );
    } catch (error) {
      return AnalysisResultFactory.createAnalysisResult(
        'dictionary_lookup',
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async generateContext(request: ContextGenerationRequest): Promise<ContextGenerationResult> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const fallbackModel = config.get<string>('model') || 'z-ai/glm-4.6';
    const contextModel = config.get<string>('contextModel') || fallbackModel;

    if (!this.contextAssistant || this.resolvedModels.context !== contextModel) {
      await this.initializeAITools();
    }

    if (!this.contextAssistant) {
      return {
        toolName: 'context_assistant',
        content: this.getApiKeyWarning(),
        timestamp: new Date()
      };
    }

    try {
      const groups = (request.requestedGroups && request.requestedGroups.length > 0)
        ? request.requestedGroups
        : [...DEFAULT_CONTEXT_GROUPS];

      const resourceProvider = await this.createContextResourceProvider(groups);
      // Try to read the full source document if provided, to prime the model
      let sourceContent: string | undefined;
      if (request.sourceFileUri) {
        try {
          const uri = vscode.Uri.parse(request.sourceFileUri);
          const raw = await vscode.workspace.fs.readFile(uri);
          sourceContent = Buffer.from(raw).toString('utf8');
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.outputChannel?.appendLine(`[ProseAnalysisService] Failed to read source file for context: ${message}`);
        }
      }
      const toolOptions = this.getToolOptions();

      const executionResult = await this.contextAssistant.generate(
        {
          excerpt: request.excerpt,
          existingContext: request.existingContext,
          sourceFileUri: request.sourceFileUri,
          sourceContent,
          requestedGroups: groups
        },
        {
          resourceProvider,
          temperature: toolOptions.temperature,
          maxTokens: toolOptions.maxTokens
        }
      );

      return {
        toolName: 'context_assistant',
        content: executionResult.content,
        timestamp: new Date(),
        requestedResources: executionResult.requestedResources
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel?.appendLine(`[ProseAnalysisService] Context assistant error: ${message}`);
      return {
        toolName: 'context_assistant',
        content: `Error generating context: ${message}`,
        timestamp: new Date()
      };
    }
  }

  private async createContextResourceProvider(groups: ContextPathGroup[]): Promise<ContextResourceProvider> {
    return await this.contextResourceResolver.createProvider(groups);
  }

  private getApiKeyWarning(): string {
    return `⚠️ OpenRouter API key not configured

To use AI-powered analysis tools, you need to configure your OpenRouter API key:

1. Get an API key from https://openrouter.ai/
2. Open VS Code Settings (Cmd+, or Ctrl+,)
3. Search for "Prose Minion"
4. Enter your API key in "OpenRouter API Key"
5. Pick models for assistants and utilities under the Prose Minion settings

The measurement tools (Prose Statistics, Style Flags, Word Frequency) work without an API key.`;
  }
}
