/**
 * Implementation of IProseAnalysisService
 * Integrates all tools
 *
 * SPRINT 01 REFACTOR: Now uses ResourceLoaderService, AIResourceManager, StandardsService, and ToolOptionsProvider
 * SPRINT 02 REFACTOR: Now uses measurement service wrappers (ProseStatsService, StyleFlagsService, WordFrequencyService)
 * SPRINT 03 REFACTOR: Now uses analysis service wrappers (AssistantToolService, DictionaryService, ContextAssistantService)
 * SPRINT 04 REFACTOR: Now uses search service wrapper (WordSearchService)
 * This is temporary - ProseAnalysisService will be deleted in Sprint 05
 */

import * as vscode from 'vscode';
import { IProseAnalysisService } from '../../domain/services/IProseAnalysisService';
import { AnalysisResult, MetricsResult, AnalysisResultFactory } from '../../domain/models/AnalysisResult';
import {
  ContextGenerationRequest,
  ContextGenerationResult
} from '../../domain/models/ContextGeneration';
import { StatusCallback } from '../../application/services/AIResourceOrchestrator';
import { ModelScope } from '../../shared/types';

// SPRINT 01: Import resource services
import { ResourceLoaderService } from './services/resources/ResourceLoaderService';
import { AIResourceManager } from './services/resources/AIResourceManager';
import { StandardsService } from './services/resources/StandardsService';
import { ToolOptionsProvider } from './services/shared/ToolOptionsProvider';

// SPRINT 02: Import measurement services
import { ProseStatsService } from './services/measurement/ProseStatsService';
import { StyleFlagsService } from './services/measurement/StyleFlagsService';
import { WordFrequencyService } from './services/measurement/WordFrequencyService';

// SPRINT 03: Import analysis services
import { AssistantToolService } from './services/analysis/AssistantToolService';
import { DictionaryService } from './services/dictionary/DictionaryService';
import { ContextAssistantService } from './services/analysis/ContextAssistantService';

// SPRINT 04: Import search service
import { WordSearchService } from './services/search/WordSearchService';

export class ProseAnalysisService implements IProseAnalysisService {
  // SPRINT 02: Measurement services (replaced tool instances)
  private proseStatsService: ProseStatsService;
  private styleFlagsService: StyleFlagsService;
  private wordFrequencyService: WordFrequencyService;

  // SPRINT 03: Analysis services (replaced tool instances)
  private assistantToolService: AssistantToolService;
  private dictionaryService: DictionaryService;
  private contextAssistantService: ContextAssistantService;

  // SPRINT 04: Search service (replaced search logic)
  private wordSearchService: WordSearchService;

  constructor(
    // SPRINT 01: Resource services
    private readonly resourceLoader: ResourceLoaderService,
    private readonly aiResourceManager: AIResourceManager,
    private readonly standardsService: StandardsService,
    private readonly toolOptions: ToolOptionsProvider,
    // SPRINT 02: Measurement services
    proseStatsService: ProseStatsService,
    styleFlagsService: StyleFlagsService,
    wordFrequencyService: WordFrequencyService,
    // SPRINT 03: Analysis services
    assistantToolService: AssistantToolService,
    dictionaryService: DictionaryService,
    contextAssistantService: ContextAssistantService,
    // SPRINT 04: Search service
    wordSearchService: WordSearchService,
    private readonly extensionUri?: vscode.Uri,
    private readonly outputChannel?: vscode.OutputChannel
  ) {
    // SPRINT 02: Store injected measurement services
    this.proseStatsService = proseStatsService;
    this.styleFlagsService = styleFlagsService;
    this.wordFrequencyService = wordFrequencyService;

    // SPRINT 03: Store injected analysis services
    this.assistantToolService = assistantToolService;
    this.dictionaryService = dictionaryService;
    this.contextAssistantService = contextAssistantService;

    // SPRINT 04: Store injected search service
    this.wordSearchService = wordSearchService;
  }


  /**
   * Set the status callback for guide loading notifications
   * This should be called by the MessageHandler to receive status updates
   */
  setStatusCallback(callback: StatusCallback): void {
    // SPRINT 01: Delegate to AIResourceManager
    this.aiResourceManager.setStatusCallback(callback);
  }

  /**
   * Reload model configuration and rebuild AI tool scaffolding
   */
  async refreshConfiguration(): Promise<void> {
    // SPRINT 01: Delegate to AIResourceManager
    await this.aiResourceManager.refreshConfiguration();

    // SPRINT 03: Delegate to analysis services to reinitialize their tools
    await this.assistantToolService.refreshConfiguration();
    await this.dictionaryService.refreshConfiguration();
    await this.contextAssistantService.refreshConfiguration();
  }

  /**
   * Expose the currently resolved models (with fallbacks applied)
   */
  getResolvedModelSelections(): Partial<Record<ModelScope, string>> {
    // SPRINT 01: Delegate to AIResourceManager
    return this.aiResourceManager.getResolvedModelSelections();
  }

  async analyzeDialogue(text: string, contextText?: string, sourceFileUri?: string, focus?: 'dialogue' | 'microbeats' | 'both'): Promise<AnalysisResult> {
    // SPRINT 03: Delegate to AssistantToolService
    return this.assistantToolService.analyzeDialogue(text, contextText, sourceFileUri, focus);
  }

  async analyzeProse(text: string, contextText?: string, sourceFileUri?: string): Promise<AnalysisResult> {
    // SPRINT 03: Delegate to AssistantToolService
    return this.assistantToolService.analyzeProse(text, contextText, sourceFileUri);
  }

  async measureProseStats(text: string, files?: string[], sourceMode?: string): Promise<MetricsResult> {
    try {
      // SPRINT 02: Use ProseStatsService instead of PassageProseStats tool
      const stats = this.proseStatsService.analyze({ text });

      // Chapter aggregation (for multi-file modes)
      // SPRINT 01: Use StandardsService for per-file stats computation
      // SPRINT 02: Pass ProseStatsService (implements ProseStatsAnalyzer interface)
      if (files && files.length > 0 && (sourceMode === 'manuscript' || sourceMode === 'chapters')) {
        const per = await this.standardsService.computePerFileStats(files, this.proseStatsService);
        const chapterWordCounts = per.map(p => p.stats.wordCount);
        const chapterCount = chapterWordCounts.length;
        const totalWords = chapterWordCounts.reduce((a, b) => a + b, 0);
        const avgChapterLength = chapterCount > 0 ? Math.round(totalWords / chapterCount) : 0;
        (stats as any).chapterCount = chapterCount;
        (stats as any).averageChapterLength = avgChapterLength;
        (stats as any).perChapterStats = per;
      }

      // Standards comparison (based on settings)
      // SPRINT 01: Use StandardsService for enrichment
      const enriched = await this.standardsService.enrichWithStandards(stats);
      return AnalysisResultFactory.createMetricsResult('prose_stats', enriched);
    } catch (error) {
      return AnalysisResultFactory.createMetricsResult('prose_stats', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async measureStyleFlags(text: string): Promise<MetricsResult> {
    try {
      // SPRINT 02: Use StyleFlagsService instead of StyleFlags tool
      const flags = this.styleFlagsService.analyze(text);
      return AnalysisResultFactory.createMetricsResult('style_flags', flags);
    } catch (error) {
      return AnalysisResultFactory.createMetricsResult('style_flags', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async measureWordFrequency(text: string): Promise<MetricsResult> {
    try {
      // SPRINT 02: Use WordFrequencyService instead of WordFrequency tool
      // Configuration is handled by the service (via ToolOptionsProvider)
      const frequency = this.wordFrequencyService.analyze(text);
      return AnalysisResultFactory.createMetricsResult('word_frequency', frequency);
    } catch (error) {
      return AnalysisResultFactory.createMetricsResult('word_frequency', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async lookupDictionary(word: string, contextText?: string): Promise<AnalysisResult> {
    // SPRINT 03: Delegate to DictionaryService
    return this.dictionaryService.lookupWord(word, contextText);
  }

  async generateContext(request: ContextGenerationRequest): Promise<ContextGenerationResult> {
    // SPRINT 03: Delegate to ContextAssistantService
    return this.contextAssistantService.generateContext(request);
  }

  async measureWordSearch(
    text: string,
    files?: string[],
    sourceMode?: string,
    options?: {
      wordsOrPhrases: string[];
      contextWords: number;
      clusterWindow: number;
      minClusterSize: number;
      caseSensitive?: boolean;
    }
  ): Promise<MetricsResult> {
    // SPRINT 04: Delegate to WordSearchService
    return this.wordSearchService.searchWords(text, files, sourceMode, options);
  }
}
