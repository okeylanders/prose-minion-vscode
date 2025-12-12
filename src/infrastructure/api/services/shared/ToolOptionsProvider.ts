/**
 * ToolOptionsProvider
 *
 * Single Responsibility: Centralize configuration option retrieval for all tools
 *
 * This service provides a single source of truth for tool configuration options,
 * reading from VSCode settings with sensible defaults. This reduces code duplication
 * and makes configuration logic easier to test and maintain.
 */

import * as vscode from 'vscode';
import { AssistantFocus } from '@messages';

/**
 * Options for AI analysis tools (dialogue, prose, dictionary)
 */
export interface ToolOptions {
  includeCraftGuides: boolean;
  temperature: number;
  maxTokens: number;
  focus?: AssistantFocus;
}

/**
 * Options for word search tool
 */
export interface WordSearchOptions {
  contextWords: number;
  clusterWindow: number;
  minClusterSize: number;
  caseSensitive: boolean;
}

/**
 * Options for word frequency analysis tool
 */
export interface WordFrequencyOptions {
  topN: number;
  includeHapaxList: boolean;
  hapaxDisplayMax: number;
  includeStopwordsTable: boolean;
  contentWordsOnly: boolean;
  posEnabled: boolean;
  includeBigrams: boolean;
  includeTrigrams: boolean;
  enableLemmas: boolean;
  lengthHistogramMaxChars: number;
  minCharacterLength: number;
}

export class ToolOptionsProvider {
  /**
   * Get options for AI analysis tools (dialogue, prose, dictionary)
   *
   * @param focus - Optional focus for dialogue analysis (see AssistantFocus type)
   * @returns Tool options with defaults applied
   */
  getOptions(focus?: AssistantFocus): ToolOptions {
    const config = vscode.workspace.getConfiguration('proseMinion');
    return {
      includeCraftGuides: config.get<boolean>('includeCraftGuides') ?? true,
      temperature: config.get<number>('temperature') ?? 0.7,
      maxTokens: config.get<number>('maxTokens') ?? 10000,
      focus: focus ?? 'both'
    };
  }

  /**
   * Get options for word search tool
   *
   * @returns Word search options with defaults applied
   */
  getWordSearchOptions(): WordSearchOptions {
    const config = vscode.workspace.getConfiguration('proseMinion');
    return {
      contextWords: config.get<number>('wordSearch.contextWords') ?? 7,
      clusterWindow: config.get<number>('wordSearch.clusterWindow') ?? 150,
      minClusterSize: config.get<number>('wordSearch.minClusterSize') ?? 3,
      caseSensitive: config.get<boolean>('wordSearch.caseSensitive') ?? false
    };
  }

  /**
   * Get options for word frequency analysis tool
   *
   * @returns Word frequency options with defaults applied
   */
  getWordFrequencyOptions(): WordFrequencyOptions {
    const config = vscode.workspace.getConfiguration('proseMinion');
    return {
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
      minCharacterLength: config.get<number>('wordFrequency.minCharacterLength') ?? 1
    };
  }
}
