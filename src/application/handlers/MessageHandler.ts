/**
 * Message handler - Application layer
 * Routes messages from webview to appropriate domain services
 * Following Single Responsibility Principle
 */

import * as vscode from 'vscode';
import { IProseAnalysisService } from '../../domain/services/IProseAnalysisService';
import { ContextGenerationResult } from '../../domain/models/ContextGeneration';
import {
  WebviewToExtensionMessage,
  MessageType,
  AnalysisResultMessage,
  MetricsResultMessage,
  DictionaryResultMessage,
  ContextResultMessage,
  SearchResultMessage,
  ErrorMessage,
  StatusMessage,
  ModelScope,
  ModelDataMessage,
  ModelOption,
  ExtensionToWebviewMessage,
  ContextPathGroup,
  SaveResultSuccessMessage,
  SaveResultMetadata,
  SelectionTarget,
  SelectionDataMessage
} from '../../shared/types';
import { OpenRouterModels } from '../../infrastructure/api/OpenRouterModels';
import { PublishingStandardsRepository } from '../../infrastructure/standards/PublishingStandardsRepository';

interface ResultCache {
  analysis?: AnalysisResultMessage;
  dictionary?: DictionaryResultMessage;
  context?: ContextResultMessage;
  metrics?: MetricsResultMessage;
  search?: SearchResultMessage;
  status?: StatusMessage;
  error?: ErrorMessage;
}

const sharedResultCache: ResultCache = {};

export class MessageHandler {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly proseAnalysisService: IProseAnalysisService,
    private readonly webview: vscode.Webview,
    private readonly extensionUri: vscode.Uri,
    private readonly outputChannel: vscode.OutputChannel
  ) {
    // Set up status callback for guide loading notifications
    // Check if service has setStatusCallback method (ProseAnalysisService does)
    if ('setStatusCallback' in proseAnalysisService && typeof (proseAnalysisService as any).setStatusCallback === 'function') {
      (proseAnalysisService as any).setStatusCallback((message: string, guideNames?: string) => {
        this.sendStatus(message, guideNames);
      });
    }

    const configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
      if (
        event.affectsConfiguration('proseMinion.assistantModel') ||
        event.affectsConfiguration('proseMinion.dictionaryModel') ||
        event.affectsConfiguration('proseMinion.contextModel') ||
        event.affectsConfiguration('proseMinion.model')
      ) {
        void this.refreshServiceConfiguration();
        void this.sendModelData();
      }
    });

    this.disposables.push(configWatcher);

    this.flushCachedResults();
  }

  async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
    try {
      switch (message.type) {
        case MessageType.ANALYZE_DIALOGUE:
          await this.handleAnalyzeDialogue(message.text, message.contextText, message.sourceFileUri);
          break;

        case MessageType.ANALYZE_PROSE:
          await this.handleAnalyzeProse(message.text, message.contextText, message.sourceFileUri);
          break;

        case MessageType.LOOKUP_DICTIONARY:
          await this.handleLookupDictionary(message.word, message.contextText);
          break;

        case MessageType.GENERATE_CONTEXT:
          await this.handleGenerateContext(
            message.excerpt,
            message.existingContext,
            message.sourceFileUri,
            message.requestedGroups
          );
          break;

        case MessageType.COPY_RESULT:
          await this.handleCopyResult(message.content, message.toolName);
          break;

        case MessageType.SAVE_RESULT:
          await this.handleSaveResult(message.toolName, message.content, message.metadata);
          break;

        case MessageType.MEASURE_PROSE_STATS:
          await this.handleMeasureProseStats(message);
          break;

        case MessageType.MEASURE_STYLE_FLAGS:
          await this.handleMeasureStyleFlags(message);
          break;

        case MessageType.MEASURE_WORD_FREQUENCY:
          await this.handleMeasureWordFrequency(message);
          break;

        case MessageType.MEASURE_WORD_SEARCH:
          // Deprecated: legacy route via Metrics; keep for backward compatibility
          await this.handleMeasureWordSearch(message as any, /*asSearch*/ false);
          break;

        case MessageType.RUN_WORD_SEARCH:
          await this.handleMeasureWordSearch(message as any, /*asSearch*/ true);
          break;

        case MessageType.REQUEST_ACTIVE_FILE:
          await this.handleRequestActiveFile();
          break;

        case MessageType.REQUEST_MANUSCRIPT_GLOBS:
          await this.handleRequestManuscriptGlobs();
          break;

        case MessageType.REQUEST_CHAPTER_GLOBS:
          await this.handleRequestChapterGlobs();
          break;

        case MessageType.REQUEST_PUBLISHING_STANDARDS_DATA:
          await this.handleRequestPublishingStandardsData();
          break;

        case MessageType.SET_PUBLISHING_PRESET:
          await this.handleSetPublishingPreset(message.preset);
          break;

        case MessageType.SET_PUBLISHING_TRIM_SIZE:
          await this.handleSetPublishingTrim(message.pageSizeKey);
          break;

        case MessageType.TAB_CHANGED:
          // Tab change is handled in UI, no action needed
          break;

        case MessageType.OPEN_GUIDE_FILE:
          await this.handleOpenGuideFile(message.guidePath);
          break;

        case MessageType.REQUEST_MODEL_DATA:
          await this.sendModelData();
          break;

        case MessageType.SET_MODEL_SELECTION:
          await this.handleSetModelSelection(message.scope, message.modelId);
          break;

        case MessageType.REQUEST_SELECTION:
          await this.handleSelectionRequest(message.target);
          break;

        default:
          this.sendError('Unknown message type', 'Received unrecognized message');
      }
    } catch (error) {
      this.sendError(
        'Error processing request',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handleLookupDictionary(word: string, contextText?: string): Promise<void> {
    if (!word.trim()) {
      this.sendError('Dictionary lookup requires a word to search');
      return;
    }

    this.sendStatus('Preparing dictionary prompt...');
    await new Promise(resolve => setTimeout(resolve, 100));

    this.sendStatus(`Generating dictionary entry for "${word}"...`);
    const result = await this.proseAnalysisService.lookupDictionary(word, contextText);
    this.sendDictionaryResult(result.content, result.toolName);
  }

  private async handleGenerateContext(
    excerpt: string,
    existingContext?: string,
    sourceFileUri?: string,
    requestedGroups?: ContextPathGroup[]
  ): Promise<void> {
    if (!excerpt.trim()) {
      this.sendError('Context assistant needs an excerpt to analyze.');
      return;
    }

    this.sendStatus('Gathering project resources for context...');
    await new Promise(resolve => setTimeout(resolve, 100));

    const result = await this.proseAnalysisService.generateContext({
      excerpt,
      existingContext,
      sourceFileUri,
      requestedGroups
    });

    this.sendContextResult(result);
  }

  private async handleCopyResult(content: string, toolName: string): Promise<void> {
    try {
      let text = content ?? '';
      if (toolName === 'prose_stats' && /^## Chapter Details/m.test(text)) {
        const answer = await vscode.window.showInformationMessage(
          'Include chapter-by-chapter breakdown in the copied report?',
          { modal: true },
          'Yes',
          'No'
        );
        if (answer === 'No') {
          text = this.stripChapterBreakdown(text);
        } else if (answer !== 'Yes') {
          // Dialog dismissed; keep default (include)
        }
      }

      await vscode.env.clipboard.writeText(text);
      this.outputChannel.appendLine(`[MessageHandler] Copied ${toolName} result to clipboard (${content?.length ?? 0} chars).`);
      this.sendStatus('Result copied to clipboard.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.sendError('Failed to copy result to clipboard', message);
    }
  }

  private async handleSaveResult(toolName: string, content: string, metadata?: SaveResultMetadata): Promise<void> {
    try {
      let text = content ?? '';
      if (toolName === 'prose_stats' && /^## Chapter Details/m.test(text)) {
        const answer = await vscode.window.showInformationMessage(
          'Include chapter-by-chapter breakdown in the saved report?',
          { modal: true },
          'Yes',
          'No'
        );
        if (answer === 'No') {
          text = this.stripChapterBreakdown(text);
        } else if (answer !== 'Yes') {
          // Dialog dismissed; keep default (include)
        }
      }

      const savedPath = await this.saveResultToFile(toolName, text, metadata);
      this.outputChannel.appendLine(`[MessageHandler] Saved ${toolName} result to ${savedPath}`);

      const successMessage: SaveResultSuccessMessage = {
        type: MessageType.SAVE_RESULT_SUCCESS,
        toolName,
        filePath: savedPath,
        timestamp: Date.now()
      };

      void this.postMessage(successMessage);
      this.sendStatus(`Saved result to ${savedPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.sendError('Failed to save result', message);
    }
  }

  private stripChapterBreakdown(markdown: string): string {
    // Remove the Chapter Details section from the markdown report only
    const sectionRegex = /^## Chapter Details[\s\S]*?(?=^# |\Z)/m;
    return markdown.replace(sectionRegex, '').trimEnd();
  }

  private async handleSelectionRequest(target: SelectionTarget): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    let content: string | undefined;
    let sourceUri: string | undefined;
    let relativePath: string | undefined;

    if (editor && !editor.selection.isEmpty) {
      content = editor.document.getText(editor.selection);
      sourceUri = editor.document.uri.toString();
      relativePath = vscode.workspace.asRelativePath(editor.document.uri, false);
    } else {
      // Fallback to clipboard if no selection
      try {
        const clip = await vscode.env.clipboard.readText();
        content = clip?.trim() || undefined;
      } catch {
        // ignore
      }
    }

    if (!content) {
      this.sendStatus('Select some text in the editor first or copy text to the clipboard.');
      return;
    }

    const selectionMessage: SelectionDataMessage = {
      type: MessageType.SELECTION_DATA,
      target,
      content,
      sourceUri,
      relativePath,
      timestamp: Date.now()
    };

    void this.postMessage(selectionMessage);
  }

  private async handleAnalyzeDialogue(text: string, contextText?: string, sourceFileUri?: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const includeCraftGuides = config.get<boolean>('includeCraftGuides') ?? true;

    const loadingMessage = includeCraftGuides
      ? 'Loading prompts and craft guides...'
      : 'Loading prompts...';

    this.sendStatus(loadingMessage);
    await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay to ensure UI updates

    this.sendStatus('Analyzing dialogue with AI...');
    const result = await this.proseAnalysisService.analyzeDialogue(text, contextText, sourceFileUri);
    this.sendAnalysisResult(result.content, result.toolName, result.usedGuides);
  }

  private async handleAnalyzeProse(text: string, contextText?: string, sourceFileUri?: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const includeCraftGuides = config.get<boolean>('includeCraftGuides') ?? true;

    const loadingMessage = includeCraftGuides
      ? 'Loading prompts and craft guides...'
      : 'Loading prompts...';

    this.sendStatus(loadingMessage);
    await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay to ensure UI updates

    this.sendStatus('Analyzing prose with AI...');
    const result = await this.proseAnalysisService.analyzeProse(text, contextText, sourceFileUri);
    this.sendAnalysisResult(result.content, result.toolName, result.usedGuides);
  }

  private async handleMeasureProseStats(message: { text?: string; source?: any }): Promise<void> {
    try {
      const resolved = await this.resolveRichTextForMetrics(message);
      const result = await this.proseAnalysisService.measureProseStats(resolved.text, resolved.paths, resolved.mode);
      this.sendMetricsResult(result.metrics, result.toolName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('Invalid selection or path', msg);
    }
  }

  private async handleMeasureStyleFlags(message: { text?: string; source?: any }): Promise<void> {
    try {
      const text = await this.resolveTextForMetrics(message);
      const result = await this.proseAnalysisService.measureStyleFlags(text);
      this.sendMetricsResult(result.metrics, result.toolName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('Invalid selection or path', msg);
    }
  }

  private async handleMeasureWordFrequency(message: { text?: string; source?: any }): Promise<void> {
    try {
      const text = await this.resolveTextForMetrics(message);
      const result = await this.proseAnalysisService.measureWordFrequency(text);
      this.sendMetricsResult(result.metrics, result.toolName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('Invalid selection or path', msg);
    }
  }

  private async handleMeasureWordSearch(message: { text?: string; source?: any; options?: any }, asSearch: boolean): Promise<void> {
    try {
      const resolved = await this.resolveRichTextForMetrics(message);
      const options = message.options || {};
      const result = await this.proseAnalysisService.measureWordSearch(
        resolved.text,
        resolved.paths,
        resolved.mode,
        options
      );
      if (asSearch) {
        this.sendSearchResult(result.metrics, result.toolName);
      } else {
        this.sendMetricsResult(result.metrics, result.toolName);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('Invalid selection or path', msg);
    }
  }

  private async resolveTextForMetrics(message: { text?: string; source?: any }): Promise<string> {
    // Backward compatibility: if source not provided, use text
    if (!message.source) {
      const t = (message.text ?? '').trim();
      if (!t) {
        throw new Error('No text provided for metrics.');
      }
      return t;
    }

    // Dynamically import to avoid cyclic deps and keep constructor lean
    const { TextSourceResolver } = await import('../../infrastructure/text/TextSourceResolver');
    const resolver = new TextSourceResolver(this.outputChannel);
    const resolved = await resolver.resolve(message.source);
    const text = (resolved.text ?? '').trim();
    if (!text) {
      throw new Error('Resolved source contains no text.');
    }
    return text;
  }

  private async resolveRichTextForMetrics(message: { text?: string; source?: any }): Promise<{ text: string; paths?: string[]; mode?: string }> {
    if (!message.source) {
      const text = await this.resolveTextForMetrics(message);
      return { text };
    }
    const { TextSourceResolver } = await import('../../infrastructure/text/TextSourceResolver');
    const resolver = new TextSourceResolver(this.outputChannel);
    const resolved = await resolver.resolve(message.source);
    const text = (resolved.text ?? '').trim();
    if (!text) throw new Error('Resolved source contains no text.');
    const mode = message.source?.mode;
    return { text, paths: resolved.relativePaths, mode };
  }

  private async handleRequestActiveFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const relativePath = editor ? vscode.workspace.asRelativePath(editor.document.uri, false) : undefined;
    const message = {
      type: MessageType.ACTIVE_FILE,
      relativePath,
      sourceUri: editor?.document.uri.toString(),
      timestamp: Date.now()
    } as const;
    void this.postMessage(message);
  }

  private async handleRequestManuscriptGlobs(): Promise<void> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const globs = config.get<string>('contextPaths.manuscript') || '';
    const message = {
      type: MessageType.MANUSCRIPT_GLOBS,
      globs,
      timestamp: Date.now()
    } as const;
    void this.postMessage(message);
  }

  private async handleRequestChapterGlobs(): Promise<void> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const globs = config.get<string>('contextPaths.chapters') || '';
    const message = {
      type: MessageType.CHAPTER_GLOBS,
      globs,
      timestamp: Date.now()
    } as const;
    void this.postMessage(message);
  }

  private async handleRequestPublishingStandardsData(): Promise<void> {
    try {
      const repo = new PublishingStandardsRepository(this.extensionUri, this.outputChannel);
      const genres = await repo.getGenres();
      const config = vscode.workspace.getConfiguration('proseMinion');
      const preset = (config.get<string>('publishingStandards.preset') || 'none');
      const pageSizeKey = (config.get<string>('publishingStandards.pageSizeKey') || '');

      const payload = {
        type: MessageType.PUBLISHING_STANDARDS_DATA,
        preset,
        pageSizeKey,
        genres: genres.map(g => ({
          key: (g.slug || g.abbreviation || g.name),
          name: g.name,
          abbreviation: g.abbreviation,
          pageSizes: g.page_sizes.map(ps => ({
            key: ps.format || `${ps.width_inches}x${ps.height_inches}`,
            label: ps.format || `${ps.width_inches}x${ps.height_inches}`,
            width: ps.width_inches,
            height: ps.height_inches,
            common: ps.common
          }))
        })),
        timestamp: Date.now()
      } as const;

      void this.postMessage(payload);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('Failed to load publishing standards', msg);
    }
  }

  private async handleSetPublishingPreset(preset: string): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('proseMinion');
      await config.update('publishingStandards.preset', preset, true);
      await this.handleRequestPublishingStandardsData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('Failed to update publishing preset', msg);
    }
  }

  private async handleSetPublishingTrim(pageSizeKey?: string): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('proseMinion');
      await config.update('publishingStandards.pageSizeKey', pageSizeKey ?? '', true);
      await this.handleRequestPublishingStandardsData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('Failed to update trim size', msg);
    }
  }

  private sendAnalysisResult(result: string, toolName: string, usedGuides?: string[]): void {
    const message: AnalysisResultMessage = {
      type: MessageType.ANALYSIS_RESULT,
      result,
      toolName,
      usedGuides,
      timestamp: Date.now()
    };
    sharedResultCache.analysis = {
      ...message,
      usedGuides: message.usedGuides ? [...message.usedGuides] : undefined
    };
    sharedResultCache.error = undefined;
    void this.postMessage(message);
    this.sendStatus('');
  }

  private sendMetricsResult(result: any, toolName: string): void {
    const message: MetricsResultMessage = {
      type: MessageType.METRICS_RESULT,
      result,
      toolName,
      timestamp: Date.now()
    };
    sharedResultCache.metrics = {
      ...message
    };
    void this.postMessage(message);
  }

  private sendContextResult(result: ContextGenerationResult): void {
    const message: ContextResultMessage = {
      type: MessageType.CONTEXT_RESULT,
      result: result.content,
      toolName: result.toolName,
      requestedResources: result.requestedResources,
      timestamp: Date.now()
    };

    sharedResultCache.context = { ...message };
    sharedResultCache.error = undefined;
    void this.postMessage(message);
    this.sendStatus('');
  }

  private sendSearchResult(result: any, toolName: string): void {
    const message: SearchResultMessage = {
      type: MessageType.SEARCH_RESULT,
      result,
      toolName,
      timestamp: Date.now()
    };
    sharedResultCache.search = { ...message };
    void this.postMessage(message);
  }

  private async saveResultToFile(toolName: string, content: string, metadata?: SaveResultMetadata): Promise<string> {
    if (!content || !content.trim()) {
      throw new Error('Result content is empty; nothing to save.');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('Open a workspace folder before saving results.');
    }

    const rootUri = workspaceFolder.uri;
    let targetDir: vscode.Uri;
    let fileName: string;
    let fileContent: string;

    if (toolName === 'dictionary_lookup') {
      const rawWord = metadata?.word?.trim() ?? 'entry';
      const sanitizedWord = this.sanitizeFileSegment(rawWord.toLowerCase()) || 'entry';
      targetDir = vscode.Uri.joinPath(rootUri, 'prose-minion', 'dictionary-entries');
      await vscode.workspace.fs.createDirectory(targetDir);
      fileName = `${sanitizedWord}.md`;
      fileContent = content.trim();
    } else if (toolName === 'prose_analysis' || toolName === 'dialogue_analysis') {
      targetDir = vscode.Uri.joinPath(rootUri, 'prose-minion', 'assistant');
      await vscode.workspace.fs.createDirectory(targetDir);

      const prefix = toolName === 'prose_analysis'
        ? 'excerpt-assisstant-prose-'
        : 'excertp-assisstant-dialog-beats-';

      const nextCount = await this.getNextSequentialNumber(targetDir, prefix);
      fileName = `${prefix}${nextCount}.md`;

      const excerpt = metadata?.excerpt?.trim() ?? '';
      const context = metadata?.context?.trim() ?? '';
      const source = metadata?.relativePath || metadata?.sourceFileUri;

      const lines: string[] = ['# Excerpt', ''];
      lines.push(excerpt || '(No excerpt captured.)', '');

      if (source) {
        lines.push(`Source: ${source}`, '');
      }

      lines.push('# Context', '');
      lines.push(context || '(No context provided.)', '', '---', '', content.trim());

      fileContent = lines.join('\n');
    } else if (toolName === 'prose_stats') {
      targetDir = vscode.Uri.joinPath(rootUri, 'prose-minion', 'reports');
      await vscode.workspace.fs.createDirectory(targetDir);
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
      fileName = `prose-statistics-${stamp}.md`;
      fileContent = content.trim();
    } else {
      throw new Error(`Saving results for tool "${toolName}" is not supported yet.`);
    }

    const fileUri = vscode.Uri.joinPath(targetDir, fileName);
    if (!fileContent.endsWith('\n')) {
      fileContent += '\n';
    }
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(fileContent, 'utf8'));

    const document = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(document, { preview: false });

    return vscode.workspace.asRelativePath(fileUri, false);
  }

  private async getNextSequentialNumber(directory: vscode.Uri, prefix: string): Promise<number> {
    let maxNumber = 0;

    const entries = await vscode.workspace.fs.readDirectory(directory);
    for (const [name, type] of entries) {
      if (type !== vscode.FileType.File) {
        continue;
      }

      if (!name.startsWith(prefix) || !name.endsWith('.md')) {
        continue;
      }

      const match = name.match(new RegExp(`${this.escapeRegExp(prefix)}(\\d+)\\.md$`));
      if (match) {
        const number = Number.parseInt(match[1], 10);
        if (!Number.isNaN(number)) {
          maxNumber = Math.max(maxNumber, number);
        }
      }
    }

    return maxNumber + 1;
  }

  private sanitizeFileSegment(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private sendDictionaryResult(result: string, toolName: string): void {
    const message: DictionaryResultMessage = {
      type: MessageType.DICTIONARY_RESULT,
      result,
      toolName,
      timestamp: Date.now()
    };
    sharedResultCache.dictionary = {
      ...message
    };
    sharedResultCache.error = undefined;
    void this.postMessage(message);
    this.sendStatus('');
  }

  private sendError(message: string, details?: string): void {
    const errorMessage: ErrorMessage = {
      type: MessageType.ERROR,
      message,
      details,
      timestamp: Date.now()
    };
    sharedResultCache.error = { ...errorMessage };
    void this.postMessage(errorMessage);
  }

  private sendStatus(message: string, guideNames?: string): void {
    const statusMessage: StatusMessage = {
      type: MessageType.STATUS,
      message,
      guideNames,
      timestamp: Date.now()
    };
    sharedResultCache.status = { ...statusMessage };
    void this.postMessage(statusMessage);
  }

  private async handleSetModelSelection(scope: ModelScope, modelId: string): Promise<void> {
    try {
      const configKey = this.getConfigKeyForScope(scope);
      const config = vscode.workspace.getConfiguration('proseMinion');

      await config.update(configKey, modelId, vscode.ConfigurationTarget.Global);
      this.outputChannel.appendLine(
        `[MessageHandler] Updated ${scope} model selection to ${modelId}`
      );
      await this.refreshServiceConfiguration();
      await this.sendModelData();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[MessageHandler] Failed to update model selection for ${scope}: ${message}`
      );
      this.sendError('Failed to update model selection', message);
    }
  }

  private async sendModelData(): Promise<void> {
    try {
      const recommended = OpenRouterModels.getRecommendedModels();
      const options: ModelOption[] = recommended.map(model => ({
        id: model.id,
        label: model.name,
        description: model.description
      }));

      const selections = this.getEffectiveModelSelections();

      const seen = new Set(options.map(option => option.id));
      Object.values(selections).forEach(modelId => {
        if (modelId && !seen.has(modelId)) {
          options.push({
            id: modelId,
            label: modelId,
            description: 'Custom model (from settings)'
          });
          seen.add(modelId);
        }
      });

      const message: ModelDataMessage = {
        type: MessageType.MODEL_DATA,
        options,
        selections,
        timestamp: Date.now()
      };

      void this.postMessage(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[MessageHandler] Failed to load model data: ${message}`);
      this.sendError('Failed to load model list', message);
    }
  }

  private getEffectiveModelSelections(): Partial<Record<ModelScope, string>> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const fallback = config.get<string>('model') || 'z-ai/glm-4.6';

    const selections: Partial<Record<ModelScope, string>> = {
      assistant: config.get<string>('assistantModel') || fallback,
      dictionary: config.get<string>('dictionaryModel') || fallback,
      context: config.get<string>('contextModel') || fallback
    };

    if (
      'getResolvedModelSelections' in this.proseAnalysisService &&
      typeof (this.proseAnalysisService as any).getResolvedModelSelections === 'function'
    ) {
      try {
        const resolved = (this.proseAnalysisService as any).getResolvedModelSelections();
        return { ...selections, ...resolved };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.outputChannel.appendLine(
          `[MessageHandler] Unable to read resolved model selections: ${message}`
        );
      }
    }

    return selections;
  }

  private getConfigKeyForScope(scope: ModelScope): string {
    switch (scope) {
      case 'assistant':
        return 'assistantModel';
      case 'dictionary':
        return 'dictionaryModel';
      case 'context':
        return 'contextModel';
      default:
        const exhaustiveCheck: never = scope;
        throw new Error(`Unknown model scope: ${exhaustiveCheck}`);
    }
  }

  private async refreshServiceConfiguration(): Promise<void> {
    if (
      'refreshConfiguration' in this.proseAnalysisService &&
      typeof (this.proseAnalysisService as any).refreshConfiguration === 'function'
    ) {
      try {
        await (this.proseAnalysisService as any).refreshConfiguration();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.outputChannel.appendLine(
          `[MessageHandler] Failed to refresh service configuration: ${message}`
        );
      }
    }
  }

  private async handleOpenGuideFile(guidePath: string): Promise<void> {
    try {
      this.outputChannel.appendLine(`[MessageHandler] Opening guide file: ${guidePath}`);

      // Construct the full URI to the guide file
      const guideUri = vscode.Uri.joinPath(
        this.extensionUri,
        'resources',
        'craft-guides',
        guidePath
      );

      this.outputChannel.appendLine(`[MessageHandler] Full path: ${guideUri.fsPath}`);

      // Check if file exists first
      try {
        await vscode.workspace.fs.stat(guideUri);
      } catch (statError) {
        const errorMsg = `Guide file not found: ${guideUri.fsPath}`;
        this.outputChannel.appendLine(`[MessageHandler] ERROR: ${errorMsg}`);
        this.sendError('Guide file not found', errorMsg);
        return;
      }

      // Open the file in the editor
      const document = await vscode.workspace.openTextDocument(guideUri);
      await vscode.window.showTextDocument(document, {
        preview: false,  // Open in permanent editor tab
        viewColumn: vscode.ViewColumn.Beside  // Open alongside current editor
      });

      this.outputChannel.appendLine(`[MessageHandler] Successfully opened guide: ${guidePath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[MessageHandler] ERROR opening guide: ${guidePath} - ${errorMsg}`);
      this.sendError(
        'Failed to open guide file',
        errorMsg
      );
    }
  }

  // Expose flushing so the provider can replay cached results when the view becomes visible again
  flushCachedResults(): void {
    if (sharedResultCache.status) {
      void this.postMessage(sharedResultCache.status);
    }

    if (sharedResultCache.analysis) {
      void this.postMessage(sharedResultCache.analysis);
    }

    if (sharedResultCache.metrics) {
      void this.postMessage(sharedResultCache.metrics);
    }

    if (sharedResultCache.search) {
      void this.postMessage(sharedResultCache.search);
    }

    if (sharedResultCache.context) {
      void this.postMessage(sharedResultCache.context);
    }

    if (sharedResultCache.dictionary) {
      void this.postMessage(sharedResultCache.dictionary);
    }

    if (sharedResultCache.error) {
      void this.postMessage(sharedResultCache.error);
    }
  }

  private async postMessage(message: ExtensionToWebviewMessage): Promise<void> {
    try {
      await this.webview.postMessage(message);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[MessageHandler] Failed to post message (${message.type}): ${messageText}`
      );
    }
  }

  dispose(): void {
    // Clear status callback to avoid stale references
    if ('setStatusCallback' in this.proseAnalysisService && typeof (this.proseAnalysisService as any).setStatusCallback === 'function') {
      try {
        (this.proseAnalysisService as any).setStatusCallback(undefined);
      } catch {
        // noop
      }
    }
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();
      try {
        disposable?.dispose();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.outputChannel.appendLine(
          `[MessageHandler] Error disposing resource: ${message}`
        );
      }
    }
  }
}
