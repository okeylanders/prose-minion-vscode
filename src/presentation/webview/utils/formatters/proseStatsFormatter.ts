/**
 * Prose Statistics Formatter
 * Formats prose statistics, publishing standards comparisons, and chapter breakdowns
 */

import { buildMetricsLegend, escapePipes } from './helpers';

/**
 * Formats prose statistics as markdown
 * @param metrics Prose statistics data
 * @returns Formatted markdown string
 */
export function formatProseStatsAsMarkdown(metrics: any): string {
  if (!metrics || metrics.wordCount === undefined) {
    return '';
  }

  let markdown = '# 📊 Prose Statistics\n\n';
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
    { key: 'vocabularyDiversity', label: '🌈 Vocabulary Diversity', format: (v: any) => typeof v === 'number' ? `${v.toFixed(1)}%` : v },
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

  // Chapter Summary (simple chapter | words table) — shown before detailed per-chapter stats
  if (Array.isArray((metrics as any).perChapterStats) && (metrics as any).perChapterStats.length > 0) {
    const list: any[] = (metrics as any).perChapterStats;
    markdown += '## 📖 Chapter Summary\n\n';
    markdown += '| Chapter | Words |\n';
    markdown += '|:------- | -----:|\n';
    list.forEach((entry: any) => {
      const path = entry.path || '';
      const name = path.split(/\\|\//).pop() || path;
      const s = entry.stats || {};
      const words = (s.wordCount ?? 0).toLocaleString();
      markdown += `| ${name} | ${words} |\n`;
    });
    markdown += '\n';
  }

  // Chapter-by-Chapter Prose Statistics (no standards comparison)
  if (Array.isArray(metrics.perChapterStats) && metrics.perChapterStats.length > 0) {
    markdown += '# 📖 Chapter-by-Chapter Prose Statistics\n\n';
    markdown += '---\n\n';
    markdown += '| Chapter | Words | Sentences | Avg W/S | Dialogue % | Lexical % | Stopword % | FKGL |\n';
    markdown += '|:------- | -----:| ---------:| -------:| ----------:| ---------:| ----------:| ----:|\n';
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
        (typeof s.stopwordRatio === 'number' ? `${s.stopwordRatio.toFixed(1)}%` : '-'),
        (typeof s.readabilityGrade === 'number' ? s.readabilityGrade.toFixed(1) : '-')
      ];
      markdown += `| ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} | ${row[4]} | ${row[5]} | ${row[6]} | ${row[7]} |\n`;
    });
    markdown += '\n';
  }

  // Append detailed metrics guide at the very end
  markdown += buildMetricsLegend();

  return markdown;
}
