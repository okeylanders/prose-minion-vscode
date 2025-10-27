/**
 * Search domain messages
 * Word search functionality
 */

import { BaseMessage, MessageType } from './base';
import { TextSourceSpec } from '../sources';

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

export interface RunWordSearchMessage extends BaseMessage {
  type: MessageType.RUN_WORD_SEARCH;
  text?: string;
  source?: TextSourceSpec;
  options: WordSearchOptions;
}

export interface SearchResultMessage extends BaseMessage {
  type: MessageType.SEARCH_RESULT;
  result: WordSearchResult;
  toolName: string; // typically 'word_search'
}
