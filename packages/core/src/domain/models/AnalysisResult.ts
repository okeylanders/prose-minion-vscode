/**
 * Domain model for analysis results
 * Represents the output from prose analysis tools ( Prose Excerpt Assistant )
 */

import type { UrlCitation } from '@shared/types/citations';

export interface AnalysisResult {
  readonly toolName: string;
  readonly content: string;
  readonly timestamp: Date;
  readonly usedGuides?: string[];  // Array of guide paths that were used
  /** Display-safe configured-resource paths delivered to the run (Sprint 12 Phase 6). */
  readonly requestedResources?: string[];
  readonly usage?: TokenUsage;
  readonly finishReason?: string;
  /** Retained conversation id, when the run asked for continuation (Workshop multi-turn). */
  readonly conversationId?: string;
  readonly citations?: UrlCitation[];
}

export interface MetricsResult {
  readonly toolName: string;
  readonly metrics: Record<string, any>;
  readonly timestamp: Date;
}

export class AnalysisResultFactory {
  static createAnalysisResult(toolName: string, content: string, usedGuides?: string[], usage?: TokenUsage, finishReason?: string, conversationId?: string, requestedResources?: string[], citations?: UrlCitation[]): AnalysisResult {
    return {
      toolName,
      content,
      timestamp: new Date(),
      usedGuides,
      requestedResources,
      usage,
      finishReason,
      conversationId,
      citations
    };
  }

  static createMetricsResult(toolName: string, metrics: Record<string, any>): MetricsResult {
    return {
      toolName,
      metrics,
      timestamp: new Date()
    };
  }
}
import { TokenUsage } from '@shared/types';
