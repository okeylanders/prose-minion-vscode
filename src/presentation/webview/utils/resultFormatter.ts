/**
 * Result Formatter - Utility functions
 * Converts result data (metrics, search, analysis) to readable markdown format
 * Handles formatting for Metrics, Search, and Analysis tabs
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
 * Builds a metrics legend explaining Vocabulary Diversity and Lexical Density
 */
function buildMetricsLegend(): string {
  return `---

## 📖 Metrics Guide

### 🌈 Vocabulary Diversity

**Formula:** (Unique Words / Total Words) × 100

**What it measures:** Word repetition rate. Higher diversity means more varied vocabulary with fewer repeated words.

**Typical ranges:**
- **Short passages** (< 1,000 words): 30-60% — High diversity expected with minimal repetition
- **Medium passages** (1,000-10,000 words): 15-30% — Natural repetition emerges across scenes/chapters
- **Long works** (10,000+ words): 5-15% — Function words and key terms naturally repeat across the narrative

**Interpretation:**
- **Higher diversity:** More varied vocabulary, potentially more descriptive or technical
- **Lower diversity:** More repetition, potentially more focused or conversational
- **Natural variation:** Dialogue tends to have lower diversity than narrative prose

### 🎨 Lexical Density

**Formula:** (Content Words / Total Words) × 100

**What it measures:** Information richness. Content words (nouns, verbs, adjectives, adverbs) carry meaning, while function words (articles, prepositions, conjunctions) provide grammatical structure.

**Typical ranges:**
- **Conversation/Dialogue**: 40-50% — Natural speech uses more function words
- **Fiction Narrative**: 50-60% — Balanced blend of description and flow
- **Academic/Technical**: 60-80% — Dense with information-carrying words

**Interpretation:**
- **Higher density:** More information-packed, potentially more formal or descriptive
- **Lower density:** More conversational flow, easier to read, more dialogue-heavy
- **Natural variation:** Action scenes often have lower density, while descriptive passages have higher density

`;
}

/**
 * Converts metrics JSON data to formatted markdown
 */
export function formatMetricsAsMarkdown(metrics: MetricsData): string {
  if (!metrics) {
    return '';
  }

  let markdown = '';

  // Word Search (shape detection: scannedFiles + targets with perFile occurrences)
  if (
    Array.isArray((metrics as any).scannedFiles) &&
    Array.isArray((metrics as any).targets)
  ) {
    const report: any = metrics;
    markdown += '# 🔎 Word Search\n\n';

    const targetList = (report.targets || []).map((t: any) => `\`${t.target}\``).join(', ') || '—';
    const scannedFiles = report.scannedFiles || [];
    const options = report.options || {};

    // Criteria section
    markdown += '## Criteria\n\n';
    markdown += `- Targets: ${targetList}\n`;
    markdown += `- Case sensitive: ${options.caseSensitive ? 'yes' : 'no'}\n`;
    markdown += `- Context window: ${options.contextWords ?? 7} words | Cluster window: ${options.clusterWindow ?? 150} (min ${options.minClusterSize ?? 3} hits)\n`;

    if (report.note) {
      markdown += `\n_${report.note}_\n`;
    }

    // Calculate aggregate totals across all targets
    const allTargets = report.targets || [];
    const totalOccurrences = allTargets.reduce((sum: number, t: any) => sum + (t.totalOccurrences ?? 0), 0);
    const totalFilesWithMatches = allTargets.reduce((sum: number, t: any) => sum + (t.filesWithMatches ?? 0), 0);

    // Calculate weighted average gap across all targets
    let totalHits = 0;
    let weightedGapSum = 0;
    for (const target of allTargets) {
      const hits = target.totalOccurrences ?? 0;
      const gap = target.overallAverageGap ?? 0;
      if (hits > 0 && Number.isFinite(gap)) {
        totalHits += hits;
        weightedGapSum += gap * hits;
      }
    }
    const overallAverageGap = totalHits > 0 ? weightedGapSum / totalHits : null;

    // Results section
    markdown += '\n## Results\n\n';
    markdown += `Total occurrences: ${totalOccurrences} across ${totalFilesWithMatches} file(s)\n`;
    if (overallAverageGap !== null) {
      markdown += `Average gap between hits: ${formatGap(overallAverageGap)}\n`;
    }

    // Summary table
    markdown += '\n### Summary\n\n';
    markdown += '| File | Word | Hits | Cluster Count |\n';
    markdown += '|:-----|:-----|-----:|--------------:|\n';

    for (const target of report.targets || []) {
      if (target.perFile && target.perFile.length > 0) {
        for (const file of target.perFile) {
          const fileName = file.relative || file.file || '—';
          const word = target.target || '—';
          const hits = file.count ?? 0;
          const clusterCount = file.clusters?.length ?? 0;
          markdown += `| ${fileName} | \`${word}\` | ${hits} | ${clusterCount} |\n`;
        }
      }
    }
    markdown += '\n';

    for (const target of report.targets || []) {
      // markdown += `\n### Target "${target.target}"\n\n`;

      if (!target.perFile?.length) {
        markdown += '_No matches found in the scanned markdown files._\n';
        continue;
      }

      for (const file of target.perFile) {
        markdown += `\n#### ${file.relative}\n`;
        const gapText = file.averageGap != null ? ` (avg gap ${formatGap(file.averageGap)})` : '';
        markdown += `Hits: ${file.count}${gapText}\n`;

        if (file.occurrences?.length) {
          markdown += '\n| # | Line | Context |\n';
          markdown += '| - | - | - |\n';
          for (const occ of file.occurrences) {
            const snippet = escapePipes((occ.snippet || '').trim()) || '—';
            markdown += `| ${occ.index} | ${occ.line} | ${snippet} |\n`;
          }
        } else {
          markdown += '\n(No individual occurrences captured.)\n';
        }

        if (file.clusters?.length) {
          markdown += '\nClusters detected:\n';
          for (const cluster of file.clusters) {
            const span = cluster.spanWords ?? 0;
            const range = cluster.startLine === cluster.endLine ? `line ${cluster.startLine}` : `lines ${cluster.startLine}–${cluster.endLine}`;
            const snippet = escapePipes((cluster.snippet || '').trim()) || '—';
            markdown += `- ${cluster.count} hits within ${span} words near ${range}: ${snippet}\n`;
          }
        } else {
          markdown += '\nNo clusters above the configured threshold.\n';
        }
      }
    }
    return markdown;
  }

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

    // Simple legend for basic metrics
    markdown += '### Legend\n\n';
    markdown += '- **Word Count**: Total tokens split by whitespace.\n';
    markdown += '- **Sentence Count**: Heuristic split on . ! ?\n';
    markdown += '- **Paragraph Count**: Blocks split by blank lines.\n';
    markdown += '- **Avg Words per Sentence**: Average words per sentence.\n';
    markdown += '- **Avg Sentences per Paragraph**: Average sentences per paragraph.\n';
    markdown += '- **Dialogue Percentage**: % of tokens inside quotes.\n';
    markdown += '- **Stopword Ratio**: % tokens in a common English stopword list.\n';
    markdown += '- **Hapax %**: % tokens occurring exactly once; Hapax Count is absolute count.\n';
    markdown += '- **Type-Token Ratio**: Unique/total tokens × 100.\n';
    markdown += '- **Readability Score**: Simplified Flesch Reading Ease (0–100, higher is easier).\n';
    markdown += '- **Readability Grade (FKGL)**: Flesch–Kincaid Grade Level (approximate grade).\n';
    markdown += '\n';

    // Detailed metrics guide at the very bottom
    markdown += buildMetricsLegend();
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

    // Append metrics legend
    markdown += buildMetricsLegend();
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

// --- Local helpers for Word Search rendering ---
function formatGap(value: any): string {
  if (value == null || Number.isNaN(value)) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const s = n.toFixed(1);
  return `${s} word${s === '1.0' ? '' : 's'}`;
}

function escapePipes(text: string): string {
  return (text || '').replace(/\|/g, '\\|');
}
