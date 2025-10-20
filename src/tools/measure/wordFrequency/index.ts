/**
 * Word Frequency Tool
 * Analyzes word usage patterns and frequency
 */

export interface WordFrequencyInput {
  text: string;
}

export interface WordFrequencyEntry {
  word: string;
  count: number;
  percentage: number;
}

export interface WordFrequencyOutput {
  totalWords: number;
  uniqueWords: number;
  topWords: WordFrequencyEntry[];
  topVerbs: WordFrequencyEntry[];
  topAdjectives: WordFrequencyEntry[];
  topNouns: WordFrequencyEntry[];
}

export class WordFrequency {
  private readonly commonWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'was',
    'were', 'been', 'has', 'had', 'is', 'are', 'am'
  ]);

  analyze(input: WordFrequencyInput): WordFrequencyOutput {
    const text = input.text.toLowerCase();
    const words = this.extractWords(text);
    const wordCounts = this.countWords(words);

    const totalWords = words.length;
    const uniqueWords = Object.keys(wordCounts).length;

    // Get top words (excluding common words)
    const contentWords = Object.entries(wordCounts)
      .filter(([word]) => !this.commonWords.has(word))
      .sort((a, b) => b[1] - a[1]);

    const topWords = this.formatTopWords(contentWords, totalWords, 20);

    // Categorize by word type (simplified)
    const topVerbs = this.filterByPattern(contentWords, totalWords, /ed$|ing$/, 10);
    const topAdjectives = this.filterByPattern(contentWords, totalWords, /ly$|ful$|ous$|ive$/, 10);
    const topNouns = this.getTopNouns(contentWords, totalWords, 10);

    return {
      totalWords,
      uniqueWords,
      topWords,
      topVerbs,
      topAdjectives,
      topNouns
    };
  }

  private extractWords(text: string): string[] {
    return text
      .split(/\s+/)
      .map(word => word.replace(/[^a-z]/g, ''))
      .filter(word => word.length > 0);
  }

  private countWords(words: string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    words.forEach(word => {
      counts[word] = (counts[word] || 0) + 1;
    });
    return counts;
  }

  private formatTopWords(
    entries: Array<[string, number]>,
    totalWords: number,
    limit: number
  ): WordFrequencyEntry[] {
    return entries.slice(0, limit).map(([word, count]) => ({
      word,
      count,
      percentage: Math.round((count / totalWords) * 1000) / 10
    }));
  }

  private filterByPattern(
    entries: Array<[string, number]>,
    totalWords: number,
    pattern: RegExp,
    limit: number
  ): WordFrequencyEntry[] {
    const filtered = entries.filter(([word]) => pattern.test(word));
    return this.formatTopWords(filtered, totalWords, limit);
  }

  private getTopNouns(
    entries: Array<[string, number]>,
    totalWords: number,
    limit: number
  ): WordFrequencyEntry[] {
    // Simplified noun detection: words that don't end in typical verb/adjective patterns
    const filtered = entries.filter(([word]) => {
      return !(/ed$|ing$|ly$|ful$|ous$|ive$/).test(word) && word.length > 3;
    });
    return this.formatTopWords(filtered, totalWords, limit);
  }
}
