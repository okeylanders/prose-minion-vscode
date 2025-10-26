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
    this.wordFrequency = new WordFrequency((msg: string) => this.outputChannel?.appendLine(msg));

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
        const per = await this.computePerFileStats(files);
        const chapterWordCounts = per.map(p => p.stats.wordCount);
        const chapterCount = chapterWordCounts.length;
        const totalWords = chapterWordCounts.reduce((a, b) => a + b, 0);
        const avgChapterLength = chapterCount > 0 ? Math.round(totalWords / chapterCount) : 0;
        (stats as any).chapterCount = chapterCount;
        (stats as any).averageChapterLength = avgChapterLength;
        (stats as any).perChapterStats = per;
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

  private async computePerFileStats(relativePaths: string[]): Promise<Array<{ path: string; stats: any }>> {
    const results: Array<{ path: string; stats: any }> = [];
    for (const rel of relativePaths) {
      try {
        const uri = await this.findUriByRelativePath(rel);
        if (!uri) continue;
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(raw).toString('utf8');
        const s = this.proseStats.analyze({ text });
        results.push({ path: rel, stats: s });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.outputChannel?.appendLine(`[ProseAnalysisService] Per-file stats failed for ${rel}: ${msg}`);
      }
    }
    return results;
  }

  private simpleWordCount(text: string): number {
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }

  async measureWordSearch(
    _text: string,
    files?: string[],
    _sourceMode?: string,
    options?: {
      wordsOrPhrases: string[];
      contextWords: number;
      clusterWindow: number;
      minClusterSize: number;
      caseSensitive?: boolean;
    }
  ) {
    try {
      const cfg = vscode.workspace.getConfiguration('proseMinion');
      const defaults = {
        contextWords: cfg.get<number>('wordSearch.contextWords') ?? 7,
        clusterWindow: cfg.get<number>('wordSearch.clusterWindow') ?? 150,
        minClusterSize: cfg.get<number>('wordSearch.minClusterSize') ?? 3,
        caseSensitive: cfg.get<boolean>('wordSearch.caseSensitive') ?? false,
        defaultTargets: cfg.get<string>('wordSearch.defaultTargets') ?? 'just'
      };

      const targetsInput = options?.wordsOrPhrases && options.wordsOrPhrases.length > 0
        ? options.wordsOrPhrases
        : (defaults.defaultTargets ? [defaults.defaultTargets] : []);

      const caseSensitive = options?.caseSensitive ?? defaults.caseSensitive;
      const contextWords = Number.isFinite(options?.contextWords) ? Math.max(0, Math.floor(options!.contextWords)) : defaults.contextWords;
      const clusterWindow = Number.isFinite(options?.clusterWindow) ? Math.max(1, Math.floor(options!.clusterWindow)) : defaults.clusterWindow;
      const minClusterSize = Number.isFinite(options?.minClusterSize) ? Math.max(2, Math.floor(options!.minClusterSize)) : defaults.minClusterSize;

      const normalizedTargets = prepareTargets(targetsInput, caseSensitive);

      const report: any = {
        scannedFiles: [],
        options: { caseSensitive, contextWords, clusterWindow, minClusterSize },
        targets: [] as any[]
      };

      const relFiles = Array.isArray(files) ? files : [];
      for (const rel of relFiles) {
        const uri = await this.findUriByRelativePath(rel);
        const absolutePath = uri?.fsPath ?? rel;
        report.scannedFiles.push({ absolute: absolutePath, relative: rel });
      }

      if (relFiles.length === 0 || normalizedTargets.length === 0) {
        return AnalysisResultFactory.createMetricsResult('word_search', {
          ...report,
          note: normalizedTargets.length === 0 ? 'No valid targets provided.' : 'No files selected.'
        });
      }

      for (const target of normalizedTargets) {
        const perFile: any[] = [];
        const allDistances: number[] = [];
        let totalOccurrences = 0;

        for (const rel of relFiles) {
          const uri = await this.findUriByRelativePath(rel);
          if (!uri) continue;
          const raw = await vscode.workspace.fs.readFile(uri);
          const content = Buffer.from(raw).toString('utf8');
          const tokens = tokenizeContent(content, caseSensitive);
          if (tokens.length === 0) continue;
          const lineIndex = buildLineIndex(content);
          const occurrences = findOccurrences(content, tokens, target, { contextWords, lineIndex });
          if (occurrences.length === 0) continue;

          const distances = computeDistances(occurrences, target.tokenLength);
          if (distances.length > 0) allDistances.push(...distances);

          const clusters = detectClusters(occurrences, { clusterWindow, minClusterSize, tokens, content, contextWords });

          totalOccurrences += occurrences.length;
          perFile.push({
            file: uri.fsPath,
            relative: rel,
            count: occurrences.length,
            averageGap: average(distances),
            occurrences: occurrences.map((occ, idx) => ({ index: idx + 1, line: occ.line, snippet: occ.snippet })),
            clusters: clusters.map(c => ({ count: c.count, spanWords: c.spanWords, startLine: c.startLine, endLine: c.endLine, snippet: c.snippet }))
          });
        }

        perFile.sort((a, b) => a.relative.localeCompare(b.relative));
        report.targets.push({
          target: target.label,
          normalized: target.normalizedTokens.join(' '),
          totalOccurrences,
          overallAverageGap: average(allDistances),
          filesWithMatches: perFile.length,
          perFile
        });
      }

      return AnalysisResultFactory.createMetricsResult('word_search', report);
    } catch (error) {
      return AnalysisResultFactory.createMetricsResult('word_search', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
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
      const config = vscode.workspace.getConfiguration('proseMinion');
      const wfOptions = {
        topN: config.get<number>('wordFrequency.topN') ?? 100,
        includeHapaxList: config.get<boolean>('wordFrequency.includeHapaxList') ?? true,
        hapaxDisplayMax: config.get<number>('wordFrequency.hapaxDisplayMax') ?? 300,
        includeStopwordsTable: config.get<boolean>('wordFrequency.includeStopwordsTable') ?? true,
        contentWordsOnly: config.get<boolean>('wordFrequency.contentWordsOnly') ?? true,
        posEnabled: config.get<boolean>('wordFrequency.posEnabled') ?? true,
        includeBigrams: config.get<boolean>('wordFrequency.includeBigrams') ?? true,
        includeTrigrams: config.get<boolean>('wordFrequency.includeTrigrams') ?? true,
        enableLemmas: config.get<boolean>('wordFrequency.enableLemmas') ?? false,
        lengthHistogramMaxChars: config.get<number>('wordFrequency.lengthHistogramMaxChars') ?? 10,
      } as const;

      const frequency = this.wordFrequency.analyze({ text }, wfOptions);
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

// --- Local deterministic word search helpers (ported from example-code) ---
function makeWordPattern() {
  return /[A-Za-z0-9']+/g;
}

function prepareTargets(values: string[], caseSensitive: boolean) {
  const prepared: Array<{ label: string; normalizedTokens: string[]; tokenLength: number }> = [];
  for (const raw of values) {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) continue;
    const tokenMatches = trimmed.match(makeWordPattern());
    if (!tokenMatches || tokenMatches.length === 0) continue;
    const normalizedTokens = tokenMatches.map((t) => (caseSensitive ? t : t.toLowerCase()));
    prepared.push({ label: trimmed, normalizedTokens, tokenLength: normalizedTokens.length });
  }
  return prepared;
}

function tokenizeContent(content: string, caseSensitive: boolean) {
  const tokens: Array<{ raw: string; normalized: string; start: number; end: number; index: number }> = [];
  const pattern = makeWordPattern();
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = pattern.exec(content)) !== null) {
    const word = match[0];
    tokens.push({
      raw: word,
      normalized: caseSensitive ? word : word.toLowerCase(),
      start: match.index,
      end: match.index + word.length,
      index: idx
    });
    idx += 1;
  }
  return tokens;
}

function buildLineIndex(content: string) {
  const lineBreaks: number[] = [];
  let idx = content.indexOf('\n');
  while (idx !== -1) {
    lineBreaks.push(idx);
    idx = content.indexOf('\n', idx + 1);
  }
  return lineBreaks;
}

function findLineNumber(lineIndex: number[], position: number) {
  if (!lineIndex || lineIndex.length === 0) return 1;
  let low = 0;
  let high = lineIndex.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (lineIndex[mid] >= position) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low + 1;
}

function extractSnippet(content: string, tokens: any[], opts: { startTokenIndex: number; endTokenIndex: number; highlights: Array<{ start: number; end: number }>; }) {
  if (tokens.length === 0) return '';
  const boundedStart = Math.max(0, opts.startTokenIndex);
  const boundedEnd = Math.min(tokens.length - 1, opts.endTokenIndex);
  const charStart = tokens[boundedStart]?.start ?? 0;
  const charEnd = tokens[boundedEnd]?.end ?? Math.min(content.length, charStart + 120);
  if (charStart >= charEnd) return '';

  const sortedHighlights = (opts.highlights || [])
    .map((r) => ({ start: Math.max(charStart, r.start), end: Math.min(charEnd, r.end) }))
    .filter((r) => r.start < r.end)
    .sort((a, b) => a.start - b.start);

  const parts: string[] = [];
  let cursor = charStart;
  for (const range of sortedHighlights) {
    if (range.start > cursor) parts.push(content.slice(cursor, range.start));
    parts.push(`**${content.slice(range.start, range.end)}**`);
    cursor = range.end;
  }
  if (cursor < charEnd) parts.push(content.slice(cursor, charEnd));

  const prefix = boundedStart > 0 ? '…' : '';
  const suffix = boundedEnd < tokens.length - 1 ? '…' : '';
  return `${prefix}${parts.join('')}${suffix}`.replace(/\s+/g, ' ').trim();
}

function findOccurrences(content: string, tokens: any[], target: any, { contextWords, lineIndex }: { contextWords: number; lineIndex: number[] }) {
  const occurrences: Array<{ tokenStart: number; tokenEnd: number; charStart: number; charEnd: number; line: number; snippet: string }> = [];
  const tokenLimit = target.tokenLength;
  if (tokenLimit === 0 || tokens.length < tokenLimit) return occurrences;

  for (let i = 0; i <= tokens.length - tokenLimit; i += 1) {
    let match = true;
    for (let j = 0; j < tokenLimit; j += 1) {
      if (tokens[i + j].normalized !== target.normalizedTokens[j]) { match = false; break; }
    }
    if (!match) continue;

    const startToken = tokens[i];
    const endToken = tokens[i + tokenLimit - 1];
    const contextStartToken = Math.max(0, i - contextWords);
    const contextEndToken = Math.min(tokens.length - 1, i + tokenLimit - 1 + contextWords);
    const snippet = extractSnippet(content, tokens, {
      startTokenIndex: contextStartToken,
      endTokenIndex: contextEndToken,
      highlights: [{ start: startToken.start, end: endToken.end }]
    });

    occurrences.push({
      tokenStart: startToken.index,
      tokenEnd: endToken.index,
      charStart: startToken.start,
      charEnd: endToken.end,
      line: findLineNumber(lineIndex, startToken.start),
      snippet
    });
  }
  return occurrences;
}

function computeDistances(occurrences: any[], tokenLength: number) {
  if (!occurrences || occurrences.length < 2) return [] as number[];
  const distances: number[] = [];
  for (let i = 0; i < occurrences.length - 1; i += 1) {
    const current = occurrences[i];
    const next = occurrences[i + 1];
    const gap = next.tokenStart - current.tokenStart - tokenLength;
    if (gap >= 0) distances.push(gap);
  }
  return distances;
}

function detectClusters(occurrences: any[], { clusterWindow, minClusterSize, tokens, content, contextWords }: any) {
  if (!occurrences || occurrences.length < minClusterSize) return [];
  const clustersByStart = new Map<number, any>();

  let start = 0;
  for (let end = 0; end < occurrences.length; end += 1) {
    while (start < end && occurrences[end].tokenStart - occurrences[start].tokenStart > clusterWindow) {
      start += 1;
    }
    const count = end - start + 1;
    if (count >= minClusterSize) {
      const existing = clustersByStart.get(start);
      if (!existing || end > existing.endIndex) {
        const startOccurrence = occurrences[start];
        const endOccurrence = occurrences[end];
        const contextStartToken = Math.max(0, startOccurrence.tokenStart - Math.max(contextWords * 2, 8));
        const contextEndToken = Math.min(tokens.length - 1, endOccurrence.tokenEnd + Math.max(contextWords * 2, 8));
        const highlightRanges = [] as Array<{ start: number; end: number }>;
        for (let idx = start; idx <= end; idx += 1) {
          highlightRanges.push({ start: occurrences[idx].charStart, end: occurrences[idx].charEnd });
        }
        const snippet = extractSnippet(content, tokens, { startTokenIndex: contextStartToken, endTokenIndex: contextEndToken, highlights: highlightRanges });
        clustersByStart.set(start, {
          startIndex: start,
          endIndex: end,
          count,
          spanWords: occurrences[end].tokenStart - occurrences[start].tokenStart,
          startLine: startOccurrence.line,
          endLine: endOccurrence.line,
          snippet
        });
      }
    }
  }
  return Array.from(clustersByStart.values()).sort((a, b) => a.startIndex - b.startIndex);
}

function average(values: number[]) {
  if (!values || values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return Number.isFinite(sum) ? sum / values.length : null;
}
