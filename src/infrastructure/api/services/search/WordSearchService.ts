/**
 * WordSearchService
 *
 * Single Responsibility: Deterministic word search across text and files
 *
 * This service provides comprehensive word search capabilities:
 * - Single or multi-word target phrases
 * - Case-sensitive or case-insensitive matching
 * - Context extraction around matches
 * - Cluster detection (words appearing in proximity)
 * - Average gap calculation between occurrences
 * - Support for selection, file, and manuscript modes
 *
 * This wrapper:
 * - Centralizes all word search logic (no AI required)
 * - Handles tokenization and pattern matching
 * - Manages file I/O for multi-file search
 * - Provides clean interface for word search features
 */

import * as vscode from 'vscode';
import { ToolOptionsProvider } from '../shared/ToolOptionsProvider';
import { MetricsResult, AnalysisResultFactory } from '@/domain/models/AnalysisResult';

/**
 * Service wrapper for deterministic word search
 *
 * Provides word search capabilities:
 * - Target word/phrase matching with tokenization
 * - Context snippets around matches
 * - Cluster detection (words in proximity)
 * - Multi-file search with aggregation
 * - Line number tracking
 */
export class WordSearchService {
  constructor(
    private readonly toolOptions: ToolOptionsProvider,
    private readonly outputChannel?: vscode.OutputChannel
  ) {}

  /**
   * Search for target words/phrases across text or files
   *
   * @param text - Text content to search (used in selection mode)
   * @param files - File paths to search (used in file/manuscript modes)
   * @param sourceMode - Mode: 'selection', 'files', 'chapters', or 'manuscript'
   * @param options - Search options (targets, context, clustering)
   * @returns Metrics result with search report
   */
  async searchWords(
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
    try {
      // Get defaults from ToolOptionsProvider
      const defaults = this.toolOptions.getWordSearchOptions();

      const targetsInput = options?.wordsOrPhrases && options.wordsOrPhrases.length > 0
        ? options.wordsOrPhrases
        : [];

      const caseSensitive = options?.caseSensitive ?? defaults.caseSensitive;
      const contextWords = Number.isFinite(options?.contextWords) ? Math.max(0, Math.floor(options!.contextWords)) : defaults.contextWords;
      const clusterWindow = Number.isFinite(options?.clusterWindow) ? Math.max(1, Math.floor(options!.clusterWindow)) : defaults.clusterWindow;
      const minClusterSize = Number.isFinite(options?.minClusterSize) ? Math.max(2, Math.floor(options!.minClusterSize)) : defaults.minClusterSize;

      const normalizedTargets = WordSearchService.prepareTargets(targetsInput, caseSensitive);

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

          const tokens = WordSearchService.tokenizeContent(content, caseSensitive);
          if (tokens.length === 0) continue;
          const lineIndex = WordSearchService.buildLineIndex(content);
          const occurrences = WordSearchService.findOccurrences(content, tokens, target, { contextWords, lineIndex });
          if (occurrences.length === 0) continue;

          const distances = WordSearchService.computeDistances(occurrences, target.tokenLength);
          if (distances.length > 0) allDistances.push(...distances);

          const clusters = WordSearchService.detectClusters(occurrences, { clusterWindow, minClusterSize, tokens, content, contextWords });

          totalOccurrences += occurrences.length;
          perFile.push({
            file: filePath,
            relative: rel,
            count: occurrences.length,
            averageGap: WordSearchService.average(distances),
            occurrences: occurrences.map((occ, idx) => ({ index: idx + 1, line: occ.line, snippet: occ.snippet })),
            clusters: clusters.map(c => ({ count: c.count, spanWords: c.spanWords, startLine: c.startLine, endLine: c.endLine, snippet: c.snippet }))
          });
        }

        perFile.sort((a, b) => a.relative.localeCompare(b.relative));
        report.targets.push({
          target: target.label,
          normalized: target.normalizedTokens.join(' '),
          totalOccurrences,
          overallAverageGap: WordSearchService.average(allDistances),
          filesWithMatches: perFile.length,
          perFile
        });
      }

      return AnalysisResultFactory.createMetricsResult('word_search', report);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel?.appendLine(`[WordSearchService] Search error: ${message}`);

      return AnalysisResultFactory.createMetricsResult('word_search', {
        error: message
      });
    }
  }

  /**
   * Find URI by relative path within workspace folders
   *
   * @param relativePath - Relative path to resolve
   * @returns URI if found, undefined otherwise
   */
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

  // --- Deterministic word search helpers (static) ---

  /**
   * Create word pattern regex for tokenization
   */
  private static makeWordPattern(): RegExp {
    return /[A-Za-z0-9']+/g;
  }

  /**
   * Prepare target words/phrases for search
   *
   * Normalizes targets, tokenizes multi-word phrases, applies case sensitivity
   *
   * @param values - Raw target strings
   * @param caseSensitive - Whether to preserve case
   * @returns Prepared targets with normalized tokens
   */
  private static prepareTargets(values: string[], caseSensitive: boolean) {
    const prepared: Array<{ label: string; normalizedTokens: string[]; tokenLength: number }> = [];
    for (const raw of values) {
      const trimmed = String(raw ?? '').trim();
      if (!trimmed) continue;
      const tokenMatches = trimmed.match(WordSearchService.makeWordPattern());
      if (!tokenMatches || tokenMatches.length === 0) continue;
      const normalizedTokens = tokenMatches.map((t) => (caseSensitive ? t : t.toLowerCase()));
      prepared.push({ label: trimmed, normalizedTokens, tokenLength: normalizedTokens.length });
    }
    return prepared;
  }

  /**
   * Tokenize content into words with position tracking
   *
   * @param content - Text content to tokenize
   * @param caseSensitive - Whether to preserve case
   * @returns Token array with positions
   */
  private static tokenizeContent(content: string, caseSensitive: boolean) {
    const tokens: Array<{ raw: string; normalized: string; start: number; end: number; index: number }> = [];
    const pattern = WordSearchService.makeWordPattern();
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

  /**
   * Build line break index for line number calculation
   *
   * @param content - Text content
   * @returns Array of line break positions
   */
  private static buildLineIndex(content: string): number[] {
    const lineBreaks: number[] = [];
    let idx = content.indexOf('\n');
    while (idx !== -1) {
      lineBreaks.push(idx);
      idx = content.indexOf('\n', idx + 1);
    }
    return lineBreaks;
  }

  /**
   * Find line number for a character position
   *
   * Uses binary search on line break index
   *
   * @param lineIndex - Line break positions
   * @param position - Character position
   * @returns Line number (1-indexed)
   */
  private static findLineNumber(lineIndex: number[], position: number): number {
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

  /**
   * Extract snippet with highlighted matches
   *
   * @param content - Text content
   * @param tokens - Token array
   * @param opts - Snippet options (start/end tokens, highlights)
   * @returns Formatted snippet with markdown highlights
   */
  private static extractSnippet(
    content: string,
    tokens: any[],
    opts: {
      startTokenIndex: number;
      endTokenIndex: number;
      highlights: Array<{ start: number; end: number }>;
    }
  ): string {
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

  /**
   * Find all occurrences of target in tokenized content
   *
   * @param content - Text content
   * @param tokens - Token array
   * @param target - Prepared target
   * @param opts - Search options (context, line index)
   * @returns Array of occurrences with positions and snippets
   */
  private static findOccurrences(
    content: string,
    tokens: any[],
    target: any,
    { contextWords, lineIndex }: { contextWords: number; lineIndex: number[] }
  ) {
    const occurrences: Array<{ tokenStart: number; tokenEnd: number; charStart: number; charEnd: number; line: number; snippet: string }> = [];
    const tokenLimit = target.tokenLength;
    if (tokenLimit === 0 || tokens.length < tokenLimit) return occurrences;

    for (let i = 0; i <= tokens.length - tokenLimit; i += 1) {
      let match = true;
      for (let j = 0; j < tokenLimit; j += 1) {
        if (tokens[i + j].normalized !== target.normalizedTokens[j]) {
          match = false;
          break;
        }
      }
      if (!match) continue;

      const startToken = tokens[i];
      const endToken = tokens[i + tokenLimit - 1];
      const contextStartToken = Math.max(0, i - contextWords);
      const contextEndToken = Math.min(tokens.length - 1, i + tokenLimit - 1 + contextWords);
      const snippet = WordSearchService.extractSnippet(content, tokens, {
        startTokenIndex: contextStartToken,
        endTokenIndex: contextEndToken,
        highlights: [{ start: startToken.start, end: endToken.end }]
      });

      occurrences.push({
        tokenStart: startToken.index,
        tokenEnd: endToken.index,
        charStart: startToken.start,
        charEnd: endToken.end,
        line: WordSearchService.findLineNumber(lineIndex, startToken.start),
        snippet
      });
    }
    return occurrences;
  }

  /**
   * Compute distances (gaps) between consecutive occurrences
   *
   * @param occurrences - Occurrence array
   * @param tokenLength - Target token length
   * @returns Array of gap distances (in tokens)
   */
  private static computeDistances(occurrences: any[], tokenLength: number): number[] {
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

  /**
   * Detect clusters (occurrences in proximity)
   *
   * Uses sliding window to find groups of occurrences within clusterWindow tokens
   *
   * @param occurrences - Occurrence array
   * @param opts - Clustering options (window, min size, tokens, content, context)
   * @returns Array of detected clusters
   */
  private static detectClusters(
    occurrences: any[],
    { clusterWindow, minClusterSize, tokens, content, contextWords }: any
  ) {
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
          const snippet = WordSearchService.extractSnippet(content, tokens, {
            startTokenIndex: contextStartToken,
            endTokenIndex: contextEndToken,
            highlights: highlightRanges
          });
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

  /**
   * Calculate average of numeric values
   *
   * @param values - Numeric array
   * @returns Average or null if empty
   */
  private static average(values: number[]): number | null {
    if (!values || values.length === 0) return null;
    const sum = values.reduce((acc, v) => acc + v, 0);
    return Number.isFinite(sum) ? sum / values.length : null;
  }
}
