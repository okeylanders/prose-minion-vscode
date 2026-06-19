/**
 * ToolOptionsProvider
 *
 * Single Responsibility: Centralize configuration option retrieval for all tools
 *
 * This service provides a single source of truth for tool configuration options,
 * reading from VSCode settings with sensible defaults. This reduces code duplication
 * and makes configuration logic easier to test and maintain.
 */

import { SettingsStore } from '@/platform';
import { AssistantFocus } from '@messages';
import { WORD_SEARCH_DEFAULTS } from '@shared/constants/wordSearchDefaults';

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
  constructor(private readonly settings: SettingsStore) {}

  /**
   * Get options for AI analysis tools (dialogue, prose, dictionary)
   *
   * @param focus - Optional focus for dialogue analysis (see AssistantFocus type)
   * @returns Tool options with defaults applied
   */
  getOptions(focus?: AssistantFocus): ToolOptions {
    return {
      includeCraftGuides: this.settings.get<boolean>('proseMinion', 'includeCraftGuides') ?? true,
      temperature: this.settings.get<number>('proseMinion', 'temperature') ?? 0.7,
      maxTokens: this.settings.get<number>('proseMinion', 'maxTokens') ?? 10000,
      focus: focus ?? 'both'
    };
  }

  /**
   * Get options for word search tool
   *
   * @returns Word search options with defaults applied
   */
  getWordSearchOptions(): WordSearchOptions {
    return {
      contextWords: this.settings.get<number>('proseMinion', 'wordSearch.contextWords') ?? WORD_SEARCH_DEFAULTS.contextWords,
      clusterWindow: this.settings.get<number>('proseMinion', 'wordSearch.clusterWindow') ?? WORD_SEARCH_DEFAULTS.clusterWindow,
      minClusterSize: this.settings.get<number>('proseMinion', 'wordSearch.minClusterSize') ?? WORD_SEARCH_DEFAULTS.minClusterSize,
      caseSensitive: this.settings.get<boolean>('proseMinion', 'wordSearch.caseSensitive') ?? WORD_SEARCH_DEFAULTS.caseSensitive
    };
  }

  /**
   * Get options for word frequency analysis tool
   *
   * @returns Word frequency options with defaults applied
   */
  getWordFrequencyOptions(): WordFrequencyOptions {
    return {
      topN: this.settings.get<number>('proseMinion', 'wordFrequency.topN') ?? 100,
      includeHapaxList: this.settings.get<boolean>('proseMinion', 'wordFrequency.includeHapaxList') ?? true,
      hapaxDisplayMax: this.settings.get<number>('proseMinion', 'wordFrequency.hapaxDisplayMax') ?? 300,
      includeStopwordsTable: this.settings.get<boolean>('proseMinion', 'wordFrequency.includeStopwordsTable') ?? true,
      contentWordsOnly: this.settings.get<boolean>('proseMinion', 'wordFrequency.contentWordsOnly') ?? true,
      posEnabled: this.settings.get<boolean>('proseMinion', 'wordFrequency.posEnabled') ?? true,
      includeBigrams: this.settings.get<boolean>('proseMinion', 'wordFrequency.includeBigrams') ?? true,
      includeTrigrams: this.settings.get<boolean>('proseMinion', 'wordFrequency.includeTrigrams') ?? true,
      enableLemmas: this.settings.get<boolean>('proseMinion', 'wordFrequency.enableLemmas') ?? false,
      lengthHistogramMaxChars: this.settings.get<number>('proseMinion', 'wordFrequency.lengthHistogramMaxChars') ?? 10,
      minCharacterLength: this.settings.get<number>('proseMinion', 'wordFrequency.minCharacterLength') ?? 1
    };
  }
}
