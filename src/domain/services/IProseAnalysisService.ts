/**
 * Interface for prose analysis service ( Prose Excerpt Assistant, Dictionary, Measure/Metrics )
 * Following Dependency Inversion Principle - domain defines the contract
 */

import { AnalysisResult, MetricsResult } from '../models/AnalysisResult';
import { ContextGenerationRequest, ContextGenerationResult } from '../models/ContextGeneration';

export interface IProseAnalysisService {
  /**
   * Analyze dialogue and provide microbeat suggestions
   */
  analyzeDialogue(text: string, contextText?: string, sourceFileUri?: string, focus?: 'dialogue' | 'microbeats' | 'both'): Promise<AnalysisResult>;

  /**
   * General prose assistance
   */
  analyzeProse(text: string, contextText?: string, sourceFileUri?: string): Promise<AnalysisResult>;

  /**
   * Measure prose statistics (word count, pacing, etc.)
   */
  measureProseStats(text: string, files?: string[], sourceMode?: string): Promise<MetricsResult>;

  /**
   * Analyze style flags and patterns
   */
  measureStyleFlags(text: string): Promise<MetricsResult>;

  /**
   * Measure word frequency
   */
  measureWordFrequency(text: string): Promise<MetricsResult>;

  /**
   * Search for words/phrases with context and clusters across scope
   */
  measureWordSearch(
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
  ): Promise<MetricsResult>;

  /**
   * Generate a dictionary entry for a word using AI
   */
  lookupDictionary(word: string, contextText?: string): Promise<AnalysisResult>;

  /**
   * Generate contextual briefing material to accompany an excerpt
   */
  generateContext(request: ContextGenerationRequest): Promise<ContextGenerationResult>;
}
