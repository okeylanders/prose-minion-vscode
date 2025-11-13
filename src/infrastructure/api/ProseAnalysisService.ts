/**
 * Implementation of IProseAnalysisService
 * Integrates all tools
 *
 * SPRINT 01 REFACTOR: Now uses ResourceLoaderService, AIResourceManager, StandardsService, and ToolOptionsProvider
 * This is temporary - ProseAnalysisService will be deleted in Sprint 05
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
import { DialogueMicrobeatAssistant } from '../../tools/assist/dialogueMicrobeatAssistant';
import { ProseAssistant } from '../../tools/assist/proseAssistant';
import { ContextAssistant } from '../../tools/assist/contextAssistant';
import { ContextResourceResolver } from '../context/ContextResourceResolver';
import { StatusCallback } from '../../application/services/AIResourceOrchestrator';
import { DictionaryUtility } from '../../tools/utility/dictionaryUtility';
import { ModelScope } from '../../shared/types';
import { ContextPathGroup } from '../../shared/types';
import { SecretStorageService } from '../secrets/SecretStorageService';

// SPRINT 01: Import resource services
import { ResourceLoaderService } from './services/resources/ResourceLoaderService';
import { AIResourceManager } from './services/resources/AIResourceManager';
import { StandardsService } from './services/resources/StandardsService';
import { ToolOptionsProvider } from './services/shared/ToolOptionsProvider';

// SPRINT 02: Import measurement services
import { ProseStatsService } from './services/measurement/ProseStatsService';
import { StyleFlagsService } from './services/measurement/StyleFlagsService';
import { WordFrequencyService } from './services/measurement/WordFrequencyService';

export class ProseAnalysisService implements IProseAnalysisService {
  // SPRINT 02: Measurement services (replaced tool instances)
  private proseStatsService: ProseStatsService;
  private styleFlagsService: StyleFlagsService;
  private wordFrequencyService: WordFrequencyService;

  private dialogueAssistant?: DialogueMicrobeatAssistant;
  private proseAssistant?: ProseAssistant;
  private dictionaryUtility?: DictionaryUtility;
  private contextAssistant?: ContextAssistant;
  private contextResourceResolver: ContextResourceResolver;

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
    private readonly extensionUri?: vscode.Uri,
    private readonly secretsService?: SecretStorageService,
    private readonly outputChannel?: vscode.OutputChannel
  ) {
    // SPRINT 02: Store injected measurement services
    this.proseStatsService = proseStatsService;
    this.styleFlagsService = styleFlagsService;
    this.wordFrequencyService = wordFrequencyService;

    // Initialize AI tools if API key is configured
    void this.initializeAITools();

    this.contextResourceResolver = new ContextResourceResolver(this.outputChannel);
  }

  private async initializeAITools(): Promise<void> {
    // SPRINT 01: Use AIResourceManager to initialize resources
    await this.aiResourceManager.initializeResources();

    // Get orchestrators from AIResourceManager
    const assistantOrchestrator = this.aiResourceManager.getOrchestrator('assistant');
    const dictionaryOrchestrator = this.aiResourceManager.getOrchestrator('dictionary');
    const contextOrchestrator = this.aiResourceManager.getOrchestrator('context');

    // Create tool instances if orchestrators are available
    if (assistantOrchestrator) {
      const promptLoader = this.resourceLoader.getPromptLoader();
      this.dialogueAssistant = new DialogueMicrobeatAssistant(
        assistantOrchestrator,
        promptLoader,
        this.outputChannel
      );
      this.proseAssistant = new ProseAssistant(
        assistantOrchestrator,
        promptLoader
      );
    } else {
      this.dialogueAssistant = undefined;
      this.proseAssistant = undefined;
    }

    if (dictionaryOrchestrator) {
      const promptLoader = this.resourceLoader.getPromptLoader();
      this.dictionaryUtility = new DictionaryUtility(dictionaryOrchestrator, promptLoader);
    } else {
      this.dictionaryUtility = undefined;
    }

    if (contextOrchestrator) {
      const promptLoader = this.resourceLoader.getPromptLoader();
      this.contextAssistant = new ContextAssistant(contextOrchestrator, promptLoader);
    } else {
      this.contextAssistant = undefined;
    }
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
    // Reinitialize tools with new orchestrators
    await this.initializeAITools();
  }

  /**
   * Expose the currently resolved models (with fallbacks applied)
   */
  getResolvedModelSelections(): Partial<Record<ModelScope, string>> {
    // SPRINT 01: Delegate to AIResourceManager
    return this.aiResourceManager.getResolvedModelSelections();
  }

  async analyzeDialogue(text: string, contextText?: string, sourceFileUri?: string, focus?: 'dialogue' | 'microbeats' | 'both'): Promise<AnalysisResult> {
    if (!this.dialogueAssistant) {
      return AnalysisResultFactory.createAnalysisResult(
        'dialogue_analysis',
        this.getApiKeyWarning()
      );
    }

    try {
      // SPRINT 01: Use ToolOptionsProvider
      const options = this.toolOptions.getOptions(focus);

      // Log analysis focus for transparency
      this.outputChannel?.appendLine(
        `[DialogueAnalysis] Focus: ${options.focus} | Craft Guides: ${options.includeCraftGuides ? 'enabled' : 'disabled'}`
      );

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
        executionResult.usedGuides,
        executionResult.usage
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
      // SPRINT 01: Use ToolOptionsProvider
      const options = this.toolOptions.getOptions();
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
        executionResult.usedGuides,
        executionResult.usage
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
    if (!this.dictionaryUtility) {
      return AnalysisResultFactory.createAnalysisResult(
        'dictionary_lookup',
        this.getApiKeyWarning()
      );
    }

    try {
      // SPRINT 01: Use ToolOptionsProvider
      const options = this.toolOptions.getOptions();
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
        executionResult.content,
        undefined,
        executionResult.usage
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

    // SPRINT 01: Use AIResourceManager to check resolved model
    const resolvedModel = this.aiResourceManager.getResolvedModel('context');
    if (!this.contextAssistant || resolvedModel !== contextModel) {
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

      // SPRINT 01: Use ToolOptionsProvider
      const toolOptions = this.toolOptions.getOptions();

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
        requestedResources: executionResult.requestedResources,
        usage: executionResult.usage
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
  ) {
    try {
      // SPRINT 01: Use ToolOptionsProvider for defaults
      const defaults = this.toolOptions.getWordSearchOptions();

      const targetsInput = options?.wordsOrPhrases && options.wordsOrPhrases.length > 0
        ? options.wordsOrPhrases
        : [];

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

      // FIX: When in selection mode, search the provided text instead of reading files
      // In selection mode, files[] contains metadata (where selection came from) but we use the text parameter
      const useTextMode = sourceMode === 'selection' && text && text.trim().length > 0;
      const relFiles = useTextMode ? ['[selected text]'] : (Array.isArray(files) ? files : []);

      if (!useTextMode) {
        // File mode: build scanned files list
        for (const rel of relFiles) {
          const uri = await this.findUriByRelativePath(rel);
          const absolutePath = uri?.fsPath ?? rel;
          report.scannedFiles.push({ absolute: absolutePath, relative: rel });
        }
      } else {
        // Text mode: single "file" entry for the selection
        report.scannedFiles.push({ absolute: '[selected text]', relative: '[selected text]' });
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
          // FIX: In text mode, use the provided text; otherwise read from file
          let content: string;
          let filePath: string;

          if (useTextMode) {
            content = text;
            filePath = '[selected text]';
          } else {
            const uri = await this.findUriByRelativePath(rel);
            if (!uri) continue;
            const raw = await vscode.workspace.fs.readFile(uri);
            content = Buffer.from(raw).toString('utf8');
            filePath = uri.fsPath;
          }

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
            file: filePath,
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

  private async createContextResourceProvider(groups: ContextPathGroup[]): Promise<ContextResourceProvider> {
    return await this.contextResourceResolver.createProvider(groups);
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

  private getApiKeyWarning(): string {
    return `⚠️ OpenRouter API key not configured

To use AI-powered analysis tools, you need to configure your OpenRouter API key:

1. Get an API key from https://openrouter.ai/
2. Click the ⚙️ gear icon at the top of the Prose Minion view
3. Enter your API key in the "OpenRouter API Key" field
4. Click Save
5. Select your preferred models for assistants and utilities

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
