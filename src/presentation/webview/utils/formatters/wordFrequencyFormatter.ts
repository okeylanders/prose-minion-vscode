/**
 * Word Frequency Formatter
 * Formats word frequency analysis including POS tagging, n-grams, and hapax lists
 */

import { buildMetricsLegend } from './helpers';

/**
 * Formats word frequency analysis as markdown
 * @param metrics Word frequency data
 * @returns Formatted markdown string
 */
export function formatWordFrequencyAsMarkdown(metrics: any): string {
  if (!metrics || (metrics.totalWords === undefined && metrics.uniqueWords === undefined)) {
    return '';
  }

  let markdown = '# 📈 Word Frequency Analysis\n\n';
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
    if (metrics.hapaxCount !== undefined) {
      const hpct = typeof metrics.hapaxPercent === 'number' ? ` (${metrics.hapaxPercent.toFixed(1)}%)` : '';
      markdown += `| 🌱 Hapax Count | **${metrics.hapaxCount.toLocaleString()}**${hpct} |\n`;
    }
    if (metrics.totalStopwordCount !== undefined) {
      markdown += `| 🧹 Stopword Tokens | **${metrics.totalStopwordCount.toLocaleString()}** |\n`;
    }
    if (metrics.totalWords && metrics.uniqueWords) {
      const diversity = ((metrics.uniqueWords / metrics.totalWords) * 100).toFixed(1);
      markdown += `| 🌈 Vocabulary Diversity | **${diversity}%** |\n`;
    }
    if (metrics.lexicalDensity !== undefined) {
      markdown += `| 🎨 Lexical Density | **${typeof metrics.lexicalDensity === 'number' ? metrics.lexicalDensity.toFixed(1) : metrics.lexicalDensity}%** |\n`;
    }
    markdown += '\n';
  }

  // Word Length Distribution Histogram (moved before Top Words for better context)
  if ((metrics.charLengthHistogram && metrics.charLengthHistogram.length > 0) || metrics.charLengthPercentages) {
    markdown += '## 📏 Word Length Distribution\n\n';
    if (metrics.charLengthHistogram && metrics.charLengthHistogram.length > 0) {
      metrics.charLengthHistogram.forEach((line: string) => {
        markdown += `${line}\n`;
      });
      markdown += '\n';
    } else if (metrics.charLengthPercentages) {
      // Build simple bars if only percentages were provided
      const entries = Object.entries(metrics.charLengthPercentages).map(([k, v]) => [Number(k), Number(v)]) as Array<[number, number]>;
      entries.sort((a, b) => a[0] - b[0]);
      const max = Math.max(...entries.map(([, v]) => v));
      const maxBlocks = 10;
      entries.forEach(([k, v]) => {
        const blocks = max > 0 ? Math.max(1, Math.round((v / max) * maxBlocks)) : 0;
        const bar = '█'.repeat(blocks);
        markdown += `${k} chars: ${bar} ${v.toFixed(1)}%\n`;
      });
      markdown += '\n';
    }
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

  // Top Lemmas (optional)
  if (metrics.topLemmaWords && Array.isArray(metrics.topLemmaWords) && metrics.topLemmaWords.length > 0) {
    markdown += '## 🔤 Top Lemmas\n\n';
    if (metrics.lemmasEnabled) {
      markdown += '_Lemma view enabled: groups common inflections (approximate)._\n\n';
    }
    markdown += '| Rank | Lemma | Count | % of Total |\n';
    markdown += '|:----:|:------|------:|-----------:|\n';

    metrics.topLemmaWords.forEach((item: { word: string; count: number; percentage?: number }, index: number) => {
      const rank = index + 1;
      const percentage = item.percentage !== undefined ? `${item.percentage}%` : '-';
      markdown += `| ${rank} | \`${item.word}\` | ${item.count} | ${percentage} |\n`;
    });
    markdown += '\n';
  }

  // Top Stopwords
  if (metrics.topStopwords && Array.isArray(metrics.topStopwords) && metrics.topStopwords.length > 0) {
    markdown += '## 🧹 Top Stopwords\n\n';
    markdown += '| Rank | Word | Count | % of Total |\n';
    markdown += '|:----:|:-----|------:|-----------:|\n';

    metrics.topStopwords.forEach((item: { word: string; count: number; percentage?: number }, index: number) => {
      const rank = index + 1;
      const percentage = item.percentage !== undefined ? `${item.percentage}%` : '-';
      markdown += `| ${rank} | \`${item.word}\` | ${item.count} | ${percentage} |\n`;
    });
    markdown += '\n';
  }

  // POS sections from new structure
  const pos = metrics.pos;
  const posUnavailable = pos && pos.mode === 'unavailable';

  // Top Verbs
  if ((pos && pos.topVerbs && pos.topVerbs.length > 0) || (metrics.topVerbs && Array.isArray(metrics.topVerbs) && metrics.topVerbs.length > 0) || posUnavailable) {
    markdown += '## 🎬 Top Verbs\n\n';
    if (posUnavailable) {
      markdown += '_POS tagging unavailable (tagger not initialized)._\n\n';
    }
    if (!posUnavailable) {
      const list = pos && pos.topVerbs ? pos.topVerbs : metrics.topVerbs;
      markdown += '| Rank | Verb | Count | % of Total |\n';
      markdown += '|:----:|:-----|------:|-----------:|\n';
      list.forEach((item: { word: string; count: number; percentage?: number }, index: number) => {
      const rank = index + 1;
      const percentage = item.percentage !== undefined ? `${item.percentage}%` : '-';
      markdown += `| ${rank} | \`${item.word}\` | ${item.count} | ${percentage} |\n`;
      });
      markdown += '\n';
    }
  }

  // Top Adjectives
  if ((pos && pos.topAdjectives && pos.topAdjectives.length > 0) || (metrics.topAdjectives && Array.isArray(metrics.topAdjectives) && metrics.topAdjectives.length > 0) || posUnavailable) {
    markdown += '## 🎨 Top Adjectives\n\n';
    if (posUnavailable) {
      markdown += '_POS tagging unavailable (tagger not initialized)._\n\n';
    }
    if (!posUnavailable) {
      const list = pos && pos.topAdjectives ? pos.topAdjectives : metrics.topAdjectives;
      markdown += '| Rank | Adjective | Count | % of Total |\n';
      markdown += '|:----:|:----------|------:|-----------:|\n';
      list.forEach((item: { word: string; count: number; percentage?: number }, index: number) => {
      const rank = index + 1;
      const percentage = item.percentage !== undefined ? `${item.percentage}%` : '-';
      markdown += `| ${rank} | \`${item.word}\` | ${item.count} | ${percentage} |\n`;
      });
      markdown += '\n';
    }
  }

  // Top Nouns
  if ((pos && pos.topNouns && pos.topNouns.length > 0) || (metrics.topNouns && Array.isArray(metrics.topNouns) && metrics.topNouns.length > 0) || posUnavailable) {
    markdown += '## 📦 Top Nouns\n\n';
    if (posUnavailable) {
      markdown += '_POS tagging unavailable (tagger not initialized)._\n\n';
    }
    if (!posUnavailable) {
      const list = pos && pos.topNouns ? pos.topNouns : metrics.topNouns;
      markdown += '| Rank | Noun | Count | % of Total |\n';
      markdown += '|:----:|:-----|------:|-----------:|\n';
      list.forEach((item: { word: string; count: number; percentage?: number }, index: number) => {
      const rank = index + 1;
      const percentage = item.percentage !== undefined ? `${item.percentage}%` : '-';
      markdown += `| ${rank} | \`${item.word}\` | ${item.count} | ${percentage} |\n`;
      });
      markdown += '\n';
    }
  }

  // Top Adverbs
  if ((pos && pos.topAdverbs && pos.topAdverbs.length > 0) || (metrics.topAdverbs && Array.isArray(metrics.topAdverbs) && metrics.topAdverbs.length > 0) || posUnavailable) {
    markdown += '## ⚡ Top Adverbs\n\n';
    if (posUnavailable) {
      markdown += '_POS tagging unavailable (tagger not initialized)._\n\n';
    }
    if (!posUnavailable) {
      const list = pos && pos.topAdverbs ? pos.topAdverbs : metrics.topAdverbs;
      markdown += '| Rank | Adverb | Count | % of Total |\n';
      markdown += '|:----:|:-------|------:|-----------:|\n';
      list.forEach((item: { word: string; count: number; percentage?: number }, index: number) => {
      const rank = index + 1;
      const percentage = item.percentage !== undefined ? `${item.percentage}%` : '-';
      markdown += `| ${rank} | \`${item.word}\` | ${item.count} | ${percentage} |\n`;
      });
      markdown += '\n';
    }
  }

  // N-grams
  if (metrics.bigrams && Array.isArray(metrics.bigrams) && metrics.bigrams.length > 0) {
    markdown += '## 🔗 Top Bigrams\n\n';
    markdown += '| Rank | Phrase | Count | % of Total |\n';
    markdown += '|:----:|:-------|------:|-----------:|\n';
    metrics.bigrams.forEach((item: { phrase: string; count: number; percentage?: number }, index: number) => {
      const rank = index + 1;
      const percentage = item.percentage !== undefined ? `${item.percentage}%` : '-';
      markdown += `| ${rank} | \`${item.phrase}\` | ${item.count} | ${percentage} |\n`;
    });
    markdown += '\n';
  }
  if (metrics.trigrams && Array.isArray(metrics.trigrams) && metrics.trigrams.length > 0) {
    markdown += '## 🔗 Top Trigrams\n\n';
    markdown += '| Rank | Phrase | Count | % of Total |\n';
    markdown += '|:----:|:-------|------:|-----------:|\n';
    metrics.trigrams.forEach((item: { phrase: string; count: number; percentage?: number }, index: number) => {
      const rank = index + 1;
      const percentage = item.percentage !== undefined ? `${item.percentage}%` : '-';
      markdown += `| ${rank} | \`${item.phrase}\` | ${item.count} | ${percentage} |\n`;
    });
    markdown += '\n';
  }

  // Hapax List (bottom)
  if (metrics.hapaxList && Array.isArray(metrics.hapaxList) && metrics.hapaxList.length > 0) {
    markdown += '## 🌱 Hapax List\n\n';
    const CAP = 300;
    const list = metrics.hapaxList;
    const display = list.slice(0, CAP);
    markdown += display.map((w: string) => `\`${w}\``).join(', ');
    if (list.length > CAP) {
      const more = list.length - CAP;
      markdown += `, (+ ${more.toLocaleString()} more)`;
    }
    markdown += '\n\n';
  }

  // Append detailed metrics guide at the very end
  markdown += buildMetricsLegend();

  return markdown;
}
