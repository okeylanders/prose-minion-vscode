/**
 * Tests for prose statistics formatter
 */

import { formatProseStatsAsMarkdown } from '../../../../../presentation/webview/utils/formatters/proseStatsFormatter';

describe('formatProseStatsAsMarkdown', () => {
  it('returns empty string for null/undefined input', () => {
    expect(formatProseStatsAsMarkdown(null)).toBe('');
    expect(formatProseStatsAsMarkdown(undefined)).toBe('');
  });

  it('returns empty string for invalid shape (missing wordCount)', () => {
    expect(formatProseStatsAsMarkdown({})).toBe('');
    expect(formatProseStatsAsMarkdown({ sentenceCount: 10 })).toBe('');
  });

  it('formats basic prose statistics', () => {
    const metrics = {
      wordCount: 1000,
      sentenceCount: 50,
      paragraphCount: 10,
      averageWordsPerSentence: 20.0,
      averageSentencesPerParagraph: 5.0,
      readingTime: '4 min',
      pacing: 'Moderate',
      dialoguePercentage: 35.5,
      lexicalDensity: 55.2,
      vocabularyDiversity: 45.8,
      stopwordRatio: 40.3,
      hapaxPercent: 25.1,
      hapaxCount: 251,
      typeTokenRatio: 45.8,
      readabilityScore: 65.5,
      readabilityGrade: 8.2,
      uniqueWordCount: 458
    };

    const markdown = formatProseStatsAsMarkdown(metrics);

    expect(markdown).toContain('# 📊 Prose Statistics');
    expect(markdown).toContain('| Metric | Value |');
    expect(markdown).toContain('📝 Word Count | **1,000**');
    expect(markdown).toContain('📏 Sentence Count | **50**');
    expect(markdown).toContain('⚖️ Avg Words per Sentence | **20.0**');
    expect(markdown).toContain('💬 Dialogue Percentage | **35.5%**');
    expect(markdown).toContain('## 📖 Metrics Guide'); // Legend appended
  });

  it('formats publishing standards comparison when present', () => {
    const metrics = {
      wordCount: 80000,
      comparison: {
        items: [
          {
            label: 'Word Count',
            value: '80,000',
            standard: { min: 70000, max: 90000 },
            status: 'within'
          },
          {
            label: 'Avg Words/Sentence',
            value: '25.0',
            standard: { min: 15, max: 20 },
            status: 'above'
          }
        ]
      }
    };

    const markdown = formatProseStatsAsMarkdown(metrics);

    expect(markdown).toContain('# 🧭 Publishing Standards Comparison');
    expect(markdown).toContain('Word Count');
    expect(markdown).toContain('80,000');
    expect(markdown).toContain('✅'); // within status
    expect(markdown).toContain('⬆️'); // above status
  });

  it('formats publishing format section when present', () => {
    const metrics = {
      wordCount: 80000,
      publishingFormat: {
        trimSize: {
          label: 'Trade Paperback',
          width_inches: 6,
          height_inches: 9
        },
        wordsPerPage: 250,
        estimatedPageCount: 320,
        pageCountRange: { min: 200, max: 400 },
        status: 'within'
      }
    };

    const markdown = formatProseStatsAsMarkdown(metrics);

    expect(markdown).toContain('# 🧾 Publishing Format');
    expect(markdown).toContain('Trade Paperback');
    expect(markdown).toContain('6x9 in');
    expect(markdown).toContain('250');
    expect(markdown).toContain('320');
    expect(markdown).toContain('✅');
  });

  it('formats chapter summary when present', () => {
    const metrics = {
      wordCount: 10000,
      perChapterStats: [
        {
          path: '/path/to/chapter1.md',
          stats: { wordCount: 5000 }
        },
        {
          path: '/path/to/chapter2.md',
          stats: { wordCount: 5000 }
        }
      ]
    };

    const markdown = formatProseStatsAsMarkdown(metrics);

    expect(markdown).toContain('## 📖 Chapter Summary');
    expect(markdown).toContain('chapter1.md');
    expect(markdown).toContain('chapter2.md');
    expect(markdown).toContain('5,000');
  });

  it('formats detailed chapter-by-chapter statistics', () => {
    const metrics = {
      wordCount: 5000,
      perChapterStats: [
        {
          path: 'chapter1.md',
          stats: {
            wordCount: 5000,
            sentenceCount: 250,
            averageWordsPerSentence: 20.0,
            dialoguePercentage: 40.5,
            lexicalDensity: 55.2,
            stopwordRatio: 38.9,
            readabilityGrade: 8.5
          }
        }
      ]
    };

    const markdown = formatProseStatsAsMarkdown(metrics);

    expect(markdown).toContain('# 📖 Chapter-by-Chapter Prose Statistics');
    expect(markdown).toContain('| Chapter | Words | Sentences | Avg W/S | Dialogue % | Lexical % | Stopword % | FKGL |');
    expect(markdown).toContain('chapter1.md');
    expect(markdown).toContain('5,000');
    expect(markdown).toContain('250');
    expect(markdown).toContain('20.0');
    expect(markdown).toContain('40.5%');
  });

  it('handles missing optional metrics gracefully', () => {
    const metrics = {
      wordCount: 1000,
      sentenceCount: 50
      // No other metrics
    };

    const markdown = formatProseStatsAsMarkdown(metrics);

    expect(markdown).toContain('# 📊 Prose Statistics');
    expect(markdown).toContain('📝 Word Count | **1,000**');
    expect(markdown).toContain('📏 Sentence Count | **50**');
    // Should not crash, should include legend
    expect(markdown).toContain('## 📖 Metrics Guide');
  });

  it('formats numeric values with proper precision', () => {
    const metrics = {
      wordCount: 1234,
      averageWordsPerSentence: 20.123456,
      dialoguePercentage: 35.678901
    };

    const markdown = formatProseStatsAsMarkdown(metrics);

    expect(markdown).toContain('**20.1**'); // 1 decimal place
    expect(markdown).toContain('**35.7%**'); // 1 decimal place for percentages
  });

  it('includes metrics legend at the end', () => {
    const metrics = {
      wordCount: 1000
    };

    const markdown = formatProseStatsAsMarkdown(metrics);

    expect(markdown).toContain('## 📖 Metrics Guide');
    expect(markdown).toContain('### 🌈 Vocabulary Diversity');
    expect(markdown).toContain('### 🎨 Lexical Density');
  });
});
