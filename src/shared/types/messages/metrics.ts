/**
 * Metrics domain messages
 * Prose statistics, style flags, and word frequency analysis
 */

import { BaseMessage, MessageType } from './base';
import { TextSourceSpec } from '../sources';

export interface MeasureProseStatsMessage extends BaseMessage {
  type: MessageType.MEASURE_PROSE_STATS;
  text?: string;
  source?: TextSourceSpec;
}

export interface MeasureStyleFlagsMessage extends BaseMessage {
  type: MessageType.MEASURE_STYLE_FLAGS;
  text?: string;
  source?: TextSourceSpec;
}

export interface MeasureWordFrequencyMessage extends BaseMessage {
  type: MessageType.MEASURE_WORD_FREQUENCY;
  text?: string;
  source?: TextSourceSpec;
}

export type MetricsResultMessage =
  | (BaseMessage & { type: MessageType.METRICS_RESULT; toolName: 'prose_stats'; result: ProseStatsReport })
  | (BaseMessage & { type: MessageType.METRICS_RESULT; toolName: 'style_flags'; result: StyleFlagsReport })
  | (BaseMessage & { type: MessageType.METRICS_RESULT; toolName: 'word_frequency'; result: WordFrequencyReport })
  | (BaseMessage & { type: MessageType.METRICS_RESULT; toolName: string; result: unknown });

// Metrics payload contracts (subset of fields used by renderers)
export interface ProseStatsReport {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  averageWordsPerSentence: number;
  averageSentencesPerParagraph: number;
  dialoguePercentage: number;
  lexicalDensity: number;
  pacing: string;
  readabilityScore: number;
  readingTime?: string;
  readingTimeMinutes?: number;
  readingTimeHours?: number;
  uniqueWordCount?: number;
  wordLengthDistribution?: {
    '1_to_3_letters': number;
    '4_to_6_letters': number;
    '7_plus_letters': number;
  };
  stopwordRatio?: number;
  hapaxPercent?: number;
  hapaxCount?: number;
  typeTokenRatio?: number;
  readabilityGrade?: number;
  // Optional chapter stats when multi-file modes are used
  chapterCount?: number;
  averageChapterLength?: number;
  perChapterStats?: Array<{ path: string; stats: unknown }>;
}

export interface StyleFlagsReport {
  flags: Array<{ type: string; count: number; examples: string[] }>;
  summary: string;
}

export interface WordFrequencyReport {
  totalWords: number;
  uniqueWords: number;
  topWords: Array<{ word: string; count: number; percentage: number }>;
  topStopwords?: Array<{ word: string; count: number; percentage: number }>;
  totalStopwordCount?: number;
  hapaxCount?: number;
  hapaxPercent?: number;
  hapaxList?: string[];
  pos?: {
    mode: 'tagger' | 'unavailable';
    topNouns?: Array<{ word: string; count: number; percentage: number }>;
    topVerbs?: Array<{ word: string; count: number; percentage: number }>;
    topAdjectives?: Array<{ word: string; count: number; percentage: number }>;
    topAdverbs?: Array<{ word: string; count: number; percentage: number }>;
  };
  bigrams?: Array<{ phrase: string; count: number; percentage?: number }>;
  trigrams?: Array<{ phrase: string; count: number; percentage?: number }>;
  charLengthCounts: Record<number, number>;
  charLengthPercentages: Record<number, number>;
  charLengthHistogram?: string[];
  lemmasEnabled?: boolean;
  topLemmaWords?: Array<{ word: string; count: number; percentage: number }>;
}
