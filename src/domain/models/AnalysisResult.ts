/**
 * Domain model for analysis results
 * Represents the output from prose analysis tools
 */

export interface AnalysisResult {
  readonly toolName: string;
  readonly content: string;
  readonly timestamp: Date;
}

export interface MetricsResult {
  readonly toolName: string;
  readonly metrics: Record<string, any>;
  readonly timestamp: Date;
}

export class AnalysisResultFactory {
  static createAnalysisResult(toolName: string, content: string): AnalysisResult {
    return {
      toolName,
      content,
      timestamp: new Date()
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
