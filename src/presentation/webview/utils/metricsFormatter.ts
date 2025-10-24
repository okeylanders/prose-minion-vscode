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

  // Handle prose statistics (word count, pacing, etc.)
  if (metrics.wordCount !== undefined) {
    markdown += '# 📊 Prose Statistics\n\n';
    markdown += '---\n\n';

    const statsConfig = [
      { key: 'wordCount', label: '📝 Word Count', format: (v: any) => v.toLocaleString() },
      { key: 'sentenceCount', label: '📏 Sentence Count', format: (v: any) => v.toLocaleString() },
      { key: 'paragraphCount', label: '📑 Paragraph Count', format: (v: any) => v.toLocaleString() },
      { key: 'averageWordsPerSentence', label: '⚖️ Avg Words per Sentence', format: (v: any) => typeof v === 'number' ? v.toFixed(1) : v },
      { key: 'averageSentencesPerParagraph', label: '📐 Avg Sentences per Paragraph', format: (v: any) => typeof v === 'number' ? v.toFixed(1) : v },
      { key: 'readingTime', label: '⏱️ Reading Time', format: (v: any) => v },
      { key: 'pacing', label: '🎯 Pacing', format: (v: any) => v },
      { key: 'dialoguePercentage', label: '💬 Dialogue Percentage', format: (v: any) => typeof v === 'number' ? `${v.toFixed(1)}%` : v },
      { key: 'lexicalDensity', label: '🎨 Lexical Density', format: (v: any) => typeof v === 'number' ? `${v.toFixed(1)}%` : v },
      { key: 'stopwordRatio', label: '🧹 Stopword Ratio', format: (v: any) => typeof v === 'number' ? `${v.toFixed(1)}%` : v },
      { key: 'hapaxPercent', label: '🌱 Hapax %', format: (v: any) => typeof v === 'number' ? `${v.toFixed(1)}%` : v },
      { key: 'hapaxCount', label: '🌱 Hapax Count', format: (v: any) => v?.toLocaleString?.() ?? v },
      { key: 'typeTokenRatio', label: '🔀 Type-Token Ratio', format: (v: any) => typeof v === 'number' ? `${v.toFixed(1)}%` : v },
      { key: 'readabilityScore', label: '📖 Readability Score', format: (v: any) => typeof v === 'number' ? v.toFixed(1) : v },
      { key: 'readabilityGrade', label: '🎓 Readability Grade (FKGL)', format: (v: any) => typeof v === 'number' ? v.toFixed(1) : v },
      { key: 'uniqueWordCount', label: '🔎 Unique Words', format: (v: any) => v?.toLocaleString?.() ?? v },
      { key: 'readingTimeMinutes', label: '⏳ Reading Time (min)', format: (v: any) => typeof v === 'number' ? v.toFixed(1) : v },
    ];

    // Create a formatted table
    markdown += '| Metric | Value |\n';
    markdown += '|:-------|------:|\n';

    statsConfig.forEach(({ key, label, format }) => {
      if (metrics[key] !== undefined) {
        const value = format(metrics[key]);
        markdown += `| ${label} | **${value}** |\n`;
      }
    });

    markdown += '\n';
  }

  // Publishing Standards Comparison
  if (metrics.comparison && Array.isArray(metrics.comparison.items)) {
    markdown += '# 🧭 Publishing Standards Comparison\n\n';
    markdown += '---\n\n';
    markdown += '| Metric | Your Value | Standard | Status |\n';
    markdown += '|:------ | ----------:|:--------:|:------:|\n';
    const statusIcon = (s: string) => s === 'within' ? '✅' : s === 'below' ? '⬇️' : s === 'above' ? '⬆️' : '•';
    metrics.comparison.items.forEach((item: any) => {
      const standard = item.standard && (item.standard.min !== undefined || item.standard.max !== undefined)
        ? `min ${item.standard.min ?? '-'} / max ${item.standard.max ?? '-'}`
        : '-';
      markdown += `| ${item.label} | **${item.value}** | ${standard} | ${statusIcon(item.status)} |\n`;
    });
    markdown += '\n';
  }

  // Publishing Format section
  if (metrics.publishingFormat) {
    const pf = metrics.publishingFormat;
    const icon = pf.status === 'within' ? '✅' : pf.status === 'below' ? '⬇️' : pf.status === 'above' ? '⬆️' : '•';
    markdown += '# 🧾 Publishing Format\n\n';
    markdown += '---\n\n';
    markdown += '| Trim Size | Words/Page | Est. Pages | Page Range | Status |\n';
    markdown += '|:--------- | ----------:| ---------:|:----------:|:------:|\n';
    const range = pf.pageCountRange ? `min ${pf.pageCountRange.min ?? '-'} / max ${pf.pageCountRange.max ?? '-'}` : '-';
    markdown += `| ${pf.trimSize.label} (${pf.trimSize.width_inches}x${pf.trimSize.height_inches} in) | ${pf.wordsPerPage ?? '-'} | ${pf.estimatedPageCount ?? '-'} | ${range} | ${icon} |\n\n`;
  }

  // Chapter-by-Chapter Prose Statistics (no standards comparison)
  if (Array.isArray(metrics.perChapterStats) && metrics.perChapterStats.length > 0) {
    markdown += '# 📖 Chapter-by-Chapter Prose Statistics\n\n';
    markdown += '---\n\n';
    markdown += '| Chapter | Words | Sentences | Avg W/S | Dialogue % | Lexical % | FKGL |\n';
    markdown += '|:------- | -----:| ---------:| -------:| ----------:| ---------:| ----:|\n';
    metrics.perChapterStats.forEach((entry: any) => {
      const path = entry.path || '';
      const name = path.split(/\\|\//).pop() || path;
      const s = entry.stats || {};
      const row = [
        name,
        (s.wordCount ?? 0).toLocaleString(),
        (s.sentenceCount ?? 0).toLocaleString(),
        (typeof s.averageWordsPerSentence === 'number' ? s.averageWordsPerSentence.toFixed(1) : '-') ,
        (typeof s.dialoguePercentage === 'number' ? `${s.dialoguePercentage.toFixed(1)}%` : '-'),
        (typeof s.lexicalDensity === 'number' ? `${s.lexicalDensity.toFixed(1)}%` : '-'),
        (typeof s.readabilityGrade === 'number' ? s.readabilityGrade.toFixed(1) : '-')
      ];
      markdown += `| ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} | ${row[4]} | ${row[5]} | ${row[6]} |\n`;
    });
    markdown += '\n';
  }

  // Handle style flags
  if (metrics.flags && Array.isArray(metrics.flags)) {
    markdown += '# 🚩 Style Flags\n\n';
    markdown += '---\n\n';

    // Add summary if available
    if (metrics.summary) {
      markdown += `> **Summary:** ${metrics.summary}\n\n`;
    }

    // Map flag types to emoji icons
    const flagIcons: Record<string, string> = {
      'Adverbs (-ly words)': '🔤',
      'Passive Voice': '👻',
      'Weak Verbs': '💪',
      'Filler Words': '🗑️',
      'Repetitive Words': '🔄',
      'Clichés': '💭'
    };

    metrics.flags.forEach((flag: StyleFlag) => {
      const icon = flagIcons[flag.type] || '•';
      markdown += `## ${icon} ${flag.type}\n\n`;
      markdown += `**Count:** ${flag.count}\n\n`;

      if (flag.examples && flag.examples.length > 0) {
        markdown += `**Examples:**\n`;
        flag.examples.forEach((example: string) => {
          markdown += `- \`${example}\`\n`;
        });
        markdown += '\n';
      }
    });
  }

  // Handle word frequency analysis
  if (metrics.totalWords !== undefined || metrics.uniqueWords !== undefined) {
    markdown += '# 📈 Word Frequency Analysis\n\n';
    markdown += '---\n\n';

    // Overview statistics
    if (metrics.totalWords !== undefined || metrics.uniqueWords !== undefined) {
      markdown += '## 📚 Overview\n\n';
      markdown += '| Metric | Value |\n';
      markdown += '|:-------|------:|\n';

      if (metrics.totalWords !== undefined) {
        markdown += `| 📝 Total Words | **${metrics.totalWords.toLocaleString()}** |\n`;
      }
      if (metrics.uniqueWords !== undefined) {
        markdown += `| 🎯 Unique Words | **${metrics.uniqueWords.toLocaleString()}** |\n`;
      }
      if (metrics.totalWords && metrics.uniqueWords) {
        const diversity = ((metrics.uniqueWords / metrics.totalWords) * 100).toFixed(1);
        markdown += `| 🌈 Vocabulary Diversity | **${diversity}%** |\n`;
      }
      markdown += '\n';
    }

    // Top Words
    if (metrics.topWords && Array.isArray(metrics.topWords) && metrics.topWords.length > 0) {
      markdown += '## 🏆 Top Words\n\n';
      markdown += '| Rank | Word | Count | % of Total |\n';
      markdown += '|:----:|:-----|------:|-----------:|\n';

      metrics.topWords.forEach((item: { word: string; count: number; percentage?: number }, index: number) => {
        const rank = index + 1;
        const percentage = item.percentage !== undefined ? `${item.percentage}%` : '-';
        markdown += `| ${rank} | \`${item.word}\` | ${item.count} | ${percentage} |\n`;
      });
      markdown += '\n';
    }

    // Top Verbs
    if (metrics.topVerbs && Array.isArray(metrics.topVerbs) && metrics.topVerbs.length > 0) {
      markdown += '## 🎬 Top Verbs\n\n';
      markdown += '| Rank | Verb | Count | % of Total |\n';
      markdown += '|:----:|:-----|------:|-----------:|\n';

      metrics.topVerbs.forEach((item: { word: string; count: number; percentage?: number }, index: number) => {
        const rank = index + 1;
        const percentage = item.percentage !== undefined ? `${item.percentage}%` : '-';
        markdown += `| ${rank} | \`${item.word}\` | ${item.count} | ${percentage} |\n`;
      });
      markdown += '\n';
    }

    // Top Adjectives
    if (metrics.topAdjectives && Array.isArray(metrics.topAdjectives) && metrics.topAdjectives.length > 0) {
      markdown += '## 🎨 Top Adjectives\n\n';
      markdown += '| Rank | Adjective | Count | % of Total |\n';
      markdown += '|:----:|:----------|------:|-----------:|\n';

      metrics.topAdjectives.forEach((item: { word: string; count: number; percentage?: number }, index: number) => {
        const rank = index + 1;
        const percentage = item.percentage !== undefined ? `${item.percentage}%` : '-';
        markdown += `| ${rank} | \`${item.word}\` | ${item.count} | ${percentage} |\n`;
      });
      markdown += '\n';
    }

    // Top Nouns
    if (metrics.topNouns && Array.isArray(metrics.topNouns) && metrics.topNouns.length > 0) {
      markdown += '## 📦 Top Nouns\n\n';
      markdown += '| Rank | Noun | Count | % of Total |\n';
      markdown += '|:----:|:-----|------:|-----------:|\n';

      metrics.topNouns.forEach((item: { word: string; count: number; percentage?: number }, index: number) => {
        const rank = index + 1;
        const percentage = item.percentage !== undefined ? `${item.percentage}%` : '-';
        markdown += `| ${rank} | \`${item.word}\` | ${item.count} | ${percentage} |\n`;
      });
      markdown += '\n';
    }

    // Top Adverbs
    if (metrics.topAdverbs && Array.isArray(metrics.topAdverbs) && metrics.topAdverbs.length > 0) {
      markdown += '## ⚡ Top Adverbs\n\n';
      markdown += '| Rank | Adverb | Count | % of Total |\n';
      markdown += '|:----:|:-------|------:|-----------:|\n';

      metrics.topAdverbs.forEach((item: { word: string; count: number; percentage?: number }, index: number) => {
        const rank = index + 1;
        const percentage = item.percentage !== undefined ? `${item.percentage}%` : '-';
        markdown += `| ${rank} | \`${item.word}\` | ${item.count} | ${percentage} |\n`;
      });
      markdown += '\n';
    }
  }

  // Handle legacy word frequency format
  if (metrics.frequencies && Array.isArray(metrics.frequencies) && metrics.frequencies.length > 0) {
    markdown += '# 📈 Word Frequency\n\n';
    markdown += '---\n\n';
    markdown += '| Rank | Word | Count |\n';
    markdown += '|:----:|:-----|------:|\n';

    metrics.frequencies.forEach((freq: { word: string; count: number }, index: number) => {
      const rank = index + 1;
      markdown += `| ${rank} | \`${freq.word}\` | ${freq.count} |\n`;
    });
    markdown += '\n';
  }

  // Handle any other properties that weren't specifically handled
  const handledKeys = ['flags', 'summary', 'wordCount', 'sentenceCount', 'paragraphCount',
                       'averageWordsPerSentence', 'averageSentencesPerParagraph',
                       'readingTime', 'readingTimeMinutes', 'readingTimeHours', 'pacing', 'dialoguePercentage', 'lexicalDensity', 'readabilityScore', 'readabilityGrade', 'uniqueWordCount', 'stopwordRatio', 'hapaxPercent', 'hapaxCount', 'typeTokenRatio',
                       'frequencies', 'topWords', 'totalWords', 'uniqueWords',
                       'topVerbs', 'topAdjectives', 'topNouns', 'topAdverbs', 'comparison', 'publishingFormat', 'chapterCount', 'averageChapterLength', 'wordLengthDistribution', 'perChapterStats'];

  const otherKeys = Object.keys(metrics).filter(key => !handledKeys.includes(key));

  if (otherKeys.length > 0) {
    markdown += '# 📋 Additional Metrics\n\n';
    markdown += '---\n\n';
    otherKeys.forEach(key => {
      const value = metrics[key];
      if (typeof value === 'object' && value !== null) {
        markdown += `**${key}:**\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n\n`;
      } else {
        markdown += `**${key}:** ${value}\n\n`;
      }
    });
  }

  return markdown || '# 📊 Metrics\n\nNo metrics data available.';
}

/**
 * Formats prose analysis results as markdown ( Prose Excerpt Assistant )
 */
export function formatAnalysisAsMarkdown(analysis: string): string {
  // If the analysis already looks like markdown, return it as-is
  if (analysis.includes('#') || analysis.includes('**') || analysis.includes('- ')) {
    return analysis;
  }

  // Otherwise, format it as a simple markdown document
  return `## Analysis Result\n\n${analysis}`;
}
