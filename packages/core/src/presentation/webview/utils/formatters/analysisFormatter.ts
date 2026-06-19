/**
 * Analysis Result Formatter
 * Formats prose analysis results (dialogue microbeat, prose assistant)
 */

/**
 * Formats prose analysis results as markdown
 * @param analysis Analysis result text
 * @returns Formatted markdown string
 */
export function formatAnalysisAsMarkdown(analysis: string): string {
  // If the analysis already looks like markdown, return it as-is
  if (analysis.includes('#') || analysis.includes('**') || analysis.includes('- ')) {
    return analysis;
  }

  // Otherwise, format it as a simple markdown document
  return `## Analysis Result\n\n${analysis}`;
}
