/**
 * Formatters barrel export
 * Central export point for all result formatters
 */

// Helper functions
export * from './helpers';

// Domain formatters
export * from './wordSearchFormatter';
export * from './proseStatsFormatter';
export * from './styleFlagsFormatter';
export * from './wordFrequencyFormatter';
export * from './categorySearchFormatter';
export * from './analysisFormatter';

// Re-export formatMetricsAsMarkdown as the main entry point for backward compatibility
// This function routes to the appropriate formatter based on the shape of the data
import { formatSearchResultAsMarkdown } from './wordSearchFormatter';
import { formatProseStatsAsMarkdown } from './proseStatsFormatter';
import { formatStyleFlagsAsMarkdown } from './styleFlagsFormatter';
import { formatWordFrequencyAsMarkdown } from './wordFrequencyFormatter';

interface MetricsData {
  flags?: any[];
  summary?: string;
  [key: string]: any;
}

/**
 * Main metrics formatter that routes to the appropriate domain formatter
 * @param metrics Metrics data (can be prose stats, style flags, or word frequency)
 * @returns Formatted markdown string
 */
export function formatMetricsAsMarkdown(metrics: MetricsData): string {
  if (!metrics) {
    return '';
  }

  // Word Search (shape detection: scannedFiles + targets with perFile occurrences)
  if (
    Array.isArray((metrics as any).scannedFiles) &&
    Array.isArray((metrics as any).targets)
  ) {
    return formatSearchResultAsMarkdown(metrics);
  }

  // Handle prose statistics (word count, pacing, etc.)
  if (metrics.wordCount !== undefined) {
    return formatProseStatsAsMarkdown(metrics);
  }

  // Handle style flags
  if (metrics.flags && Array.isArray(metrics.flags)) {
    return formatStyleFlagsAsMarkdown(metrics);
  }

  // Handle word frequency analysis
  if (metrics.totalWords !== undefined || metrics.uniqueWords !== undefined) {
    return formatWordFrequencyAsMarkdown(metrics);
  }

  // Handle legacy word frequency format
  if (metrics.frequencies && Array.isArray(metrics.frequencies) && metrics.frequencies.length > 0) {
    let markdown = '# 📈 Word Frequency\n\n';
    markdown += '---\n\n';
    markdown += '| Rank | Word | Count |\n';
    markdown += '|:----:|:-----|------:|\n';

    metrics.frequencies.forEach((freq: { word: string; count: number }, index: number) => {
      const rank = index + 1;
      markdown += `| ${rank} | \`${freq.word}\` | ${freq.count} |\n`;
    });
    markdown += '\n';
    return markdown;
  }

  // Handle any other properties that weren't specifically handled
  const handledKeys = ['flags', 'summary', 'wordCount', 'sentenceCount', 'paragraphCount',
                       'averageWordsPerSentence', 'averageSentencesPerParagraph',
                       'readingTime', 'readingTimeMinutes', 'readingTimeHours', 'pacing', 'dialoguePercentage', 'lexicalDensity', 'vocabularyDiversity', 'readabilityScore', 'readabilityGrade', 'uniqueWordCount', 'stopwordRatio', 'hapaxPercent', 'hapaxCount', 'typeTokenRatio',
                       'frequencies', 'topWords', 'totalWords', 'uniqueWords',
                       'topVerbs', 'topAdjectives', 'topNouns', 'topAdverbs',
                       'topStopwords', 'totalStopwordCount', 'hapaxList', 'pos', 'bigrams', 'trigrams', 'charLengthCounts', 'charLengthPercentages', 'charLengthHistogram', 'lemmasEnabled', 'topLemmaWords',
                       'comparison', 'publishingFormat', 'chapterCount', 'averageChapterLength', 'wordLengthDistribution', 'perChapterStats'];

  const otherKeys = Object.keys(metrics).filter(key => !handledKeys.includes(key));

  if (otherKeys.length > 0) {
    let markdown = '# 📋 Additional Metrics\n\n';
    markdown += '---\n\n';
    otherKeys.forEach(key => {
      const value = metrics[key];
      if (typeof value === 'object' && value !== null) {
        markdown += `**${key}:**\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n\n`;
      } else {
        markdown += `**${key}:** ${value}\n\n`;
      }
    });
    return markdown;
  }

  return '# 📊 Metrics\n\nNo metrics data available.';
}
