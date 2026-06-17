/**
 * Search domain messages
 * Word search functionality
 */

import { MessageEnvelope, MessageType } from './base';
import { TextSourceSpec } from '../sources';

// ============================================================================
// Category Search Types
// ============================================================================

export type CategoryRelevance = 'broad' | 'focused' | 'specific' | 'synonym';
export type CategoryWordLimit = 20 | 50 | 75 | 100 | 250 | 350 | 500;
export type NGramMode = 'words' | 'bigrams' | 'trigrams';
export type MinOccurrences = 1 | 2 | 3 | 4 | 5;

export const CATEGORY_RELEVANCE_OPTIONS: readonly CategoryRelevance[] = ['broad', 'focused', 'specific', 'synonym'];
export const NGRAM_MODE_OPTIONS: readonly NGramMode[] = ['words', 'bigrams', 'trigrams'];
export const MIN_OCCURRENCES_OPTIONS: readonly MinOccurrences[] = [1, 2, 3, 4, 5];

export interface WordSearchOptions {
  wordsOrPhrases: string[];
  contextWords: number;
  clusterWindow: number;
  minClusterSize: number;
  caseSensitive?: boolean;
}

export interface WordSearchResult {
  scannedFiles: Array<{
    absolute: string;
    relative: string;
  }>;
  options: {
    caseSensitive: boolean;
    contextWords: number;
    clusterWindow: number;
    minClusterSize: number;
  };
  targets: Array<{
    target: string;
    normalized: string;
    totalOccurrences: number;
    overallAverageGap: number;
    filesWithMatches: number;
    perFile: Array<{
      file: string;
      relative: string;
      count: number;
      averageGap: number;
      occurrences: Array<{
        index: number;
        line: number;
        snippet: string;
      }>;
      clusters: Array<{
        count: number;
        spanWords: number;
        startLine: number;
        endLine: number;
        snippet: string;
      }>;
    }>;
  }>;
  note?: string;
  error?: string;
}

export interface RunWordSearchPayload {
  text?: string;
  source?: TextSourceSpec;
  options: WordSearchOptions;
}

export interface RunWordSearchMessage extends MessageEnvelope<RunWordSearchPayload> {
  type: MessageType.RUN_WORD_SEARCH;
}

export interface SearchResultPayload {
  result: WordSearchResult;
  toolName: string; // typically 'word_search'
}

export interface SearchResultMessage extends MessageEnvelope<SearchResultPayload> {
  type: MessageType.SEARCH_RESULT;
}

// Category Search (AI-powered semantic search)

export interface CategorySearchOptions {
  contextWords?: number;
  clusterWindow?: number;
  minClusterSize?: number;
  caseSensitive?: boolean;
  relevance?: CategoryRelevance;
  wordLimit?: CategoryWordLimit;
  /** N-gram mode: words (default), bigrams, or trigrams */
  ngramMode?: NGramMode;
  /** Minimum occurrences for bigrams/trigrams (default: 2) */
  minOccurrences?: MinOccurrences;
}

export interface CategorySearchRequestPayload {
  query: string;
  source: TextSourceSpec;
  options?: CategorySearchOptions;
}

export interface CategorySearchRequestMessage extends MessageEnvelope<CategorySearchRequestPayload> {
  type: MessageType.CATEGORY_SEARCH_REQUEST;
}

export interface CategorySearchResult {
  query: string;
  matchedWords: string[];
  wordSearchResult: WordSearchResult;
  timestamp: number;
  error?: string;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
    costUsd?: number;
  };
  /** Non-fatal issues encountered while processing batches */
  warnings?: string[];
  /** True when processing stopped early due to wordLimit */
  haltedEarly?: boolean;
  /** N-gram mode used for this search */
  ngramMode?: NGramMode;
}

export interface CategorySearchResultPayload {
  result: CategorySearchResult;
  toolName: string; // 'category_search'
}

export interface CategorySearchResultMessage extends MessageEnvelope<CategorySearchResultPayload> {
  type: MessageType.CATEGORY_SEARCH_RESULT;
}
