/**
 * Metrics Formatter - Utility functions
 * Converts metrics JSON to readable markdown format
 */

interface StyleFlag {
  type: string;
  count: number;
  examples: string[];
}

interface MetricsData {
  flags?: StyleFlag[];
  summary?: string;
  [key: string]: any;
}

/**
 * Converts metrics JSON data to formatted markdown
 */
export function formatMetricsAsMarkdown(metrics: MetricsData): string {
  if (!metrics) {
    return '';
  }

  let markdown = '';

  // Handle basic word statistics first
  if (metrics.totalWords !== undefined || metrics.uniqueWords !== undefined) {
    markdown += '## Word Statistics\n\n';
    if (metrics.totalWords !== undefined) {
      markdown += `**Total Words:** ${metrics.totalWords}\n\n`;
    }
    if (metrics.uniqueWords !== undefined) {
      markdown += `**Unique Words:** ${metrics.uniqueWords}\n\n`;
    }
    if (metrics.totalWords && metrics.uniqueWords) {
      const diversity = ((metrics.uniqueWords / metrics.totalWords) * 100).toFixed(1);
      markdown += `**Vocabulary Diversity:** ${diversity}%\n\n`;
    }
  }

  // Handle style flags
  if (metrics.flags && Array.isArray(metrics.flags)) {
    markdown += '## Style Flags\n\n';

    metrics.flags.forEach((flag: StyleFlag) => {
      markdown += `### ${flag.type}\n`;
      markdown += `**Count:** ${flag.count}\n\n`;

      if (flag.examples && flag.examples.length > 0) {
        markdown += `**Examples:**\n`;
        flag.examples.forEach((example: string) => {
          markdown += `- ${example}\n`;
        });
        markdown += '\n';
      }
    });
  }

  // Handle summary
  if (metrics.summary) {
    markdown += '## Summary\n\n';
    markdown += `${metrics.summary}\n\n`;
  }

  // Handle prose statistics (word count, pacing, etc.)
  if (metrics.wordCount !== undefined) {
    markdown += '## Prose Statistics\n\n';

    const statsToShow = [
      { key: 'wordCount', label: 'Word Count' },
      { key: 'sentenceCount', label: 'Sentence Count' },
      { key: 'paragraphCount', label: 'Paragraph Count' },
      { key: 'averageWordsPerSentence', label: 'Average Words per Sentence' },
      { key: 'averageSentencesPerParagraph', label: 'Average Sentences per Paragraph' },
      { key: 'readingTime', label: 'Reading Time' },
      { key: 'pacing', label: 'Pacing' },
    ];

    statsToShow.forEach(({ key, label }) => {
      if (metrics[key] !== undefined) {
        markdown += `**${label}:** ${metrics[key]}\n\n`;
      }
    });
  }

  // Handle word frequency
  if (metrics.frequencies && Array.isArray(metrics.frequencies)) {
    markdown += '## Word Frequency\n\n';
    markdown += '| Word | Count |\n';
    markdown += '|------|-------|\n';

    metrics.frequencies.forEach((freq: { word: string; count: number }) => {
      markdown += `| ${freq.word} | ${freq.count} |\n`;
    });
    markdown += '\n';
  }

  // Handle topWords array (if frequencies wasn't already used)
  if (metrics.topWords && Array.isArray(metrics.topWords)) {
    markdown += '## Top Words\n\n';
    markdown += '| Word | Count | Percentage |\n';
    markdown += '|------|-------|------------|\n';

    metrics.topWords.forEach((item: { word: string; count: number; percentage?: number }) => {
      const percentage = item.percentage !== undefined ? `${item.percentage}%` : '-';
      markdown += `| ${item.word} | ${item.count} | ${percentage} |\n`;
    });
    markdown += '\n';
  }

  // Handle topVerbs array
  if (metrics.topVerbs && Array.isArray(metrics.topVerbs)) {
    markdown += '## Top Verbs\n\n';
    markdown += '| Verb | Count | Percentage |\n';
    markdown += '|------|-------|------------|\n';

    metrics.topVerbs.forEach((item: { word: string; count: number; percentage?: number }) => {
      const percentage = item.percentage !== undefined ? `${item.percentage}%` : '-';
      markdown += `| ${item.word} | ${item.count} | ${percentage} |\n`;
    });
    markdown += '\n';
  }

  // Handle topAdjectives array
  if (metrics.topAdjectives && Array.isArray(metrics.topAdjectives)) {
    markdown += '## Top Adjectives\n\n';
    markdown += '| Adjective | Count | Percentage |\n';
    markdown += '|-----------|-------|------------|\n';

    metrics.topAdjectives.forEach((item: { word: string; count: number; percentage?: number }) => {
      const percentage = item.percentage !== undefined ? `${item.percentage}%` : '-';
      markdown += `| ${item.word} | ${item.count} | ${percentage} |\n`;
    });
    markdown += '\n';
  }

  // Handle topNouns array
  if (metrics.topNouns && Array.isArray(metrics.topNouns)) {
    markdown += '## Top Nouns\n\n';
    markdown += '| Noun | Count | Percentage |\n';
    markdown += '|------|-------|------------|\n';

    metrics.topNouns.forEach((item: { word: string; count: number; percentage?: number }) => {
      const percentage = item.percentage !== undefined ? `${item.percentage}%` : '-';
      markdown += `| ${item.word} | ${item.count} | ${percentage} |\n`;
    });
    markdown += '\n';
  }

  // Handle topAdverbs array
  if (metrics.topAdverbs && Array.isArray(metrics.topAdverbs)) {
    markdown += '## Top Adverbs\n\n';
    markdown += '| Adverb | Count | Percentage |\n';
    markdown += '|--------|-------|------------|\n';

    metrics.topAdverbs.forEach((item: { word: string; count: number; percentage?: number }) => {
      const percentage = item.percentage !== undefined ? `${item.percentage}%` : '-';
      markdown += `| ${item.word} | ${item.count} | ${percentage} |\n`;
    });
    markdown += '\n';
  }

  // Handle any other properties that weren't specifically handled
  const handledKeys = ['flags', 'summary', 'wordCount', 'sentenceCount', 'paragraphCount',
                       'averageWordsPerSentence', 'averageSentencesPerParagraph',
                       'readingTime', 'pacing', 'frequencies', 'topWords', 'totalWords', 'uniqueWords',
                       'topVerbs', 'topAdjectives', 'topNouns', 'topAdverbs'];

  const otherKeys = Object.keys(metrics).filter(key => !handledKeys.includes(key));

  if (otherKeys.length > 0) {
    markdown += '## Additional Metrics\n\n';
    otherKeys.forEach(key => {
      const value = metrics[key];
      if (typeof value === 'object' && value !== null) {
        markdown += `**${key}:**\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n\n`;
      } else {
        markdown += `**${key}:** ${value}\n\n`;
      }
    });
  }

  return markdown || '## Metrics\n\nNo metrics data available.';
}

/**
 * Formats prose analysis results as markdown
 */
export function formatAnalysisAsMarkdown(analysis: string): string {
  // If the analysis already looks like markdown, return it as-is
  if (analysis.includes('#') || analysis.includes('**') || analysis.includes('- ')) {
    return analysis;
  }

  // Otherwise, format it as a simple markdown document
  return `## Analysis Result\n\n${analysis}`;
}
