/**
 * Passage Prose Stats Tool
 * Analyzes prose statistics: word count, sentences, pacing, etc.
 */

export interface ProseStatsInput {
  text: string;
}

export interface ProseStatsOutput {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  averageWordsPerSentence: number;
  averageSentencesPerParagraph: number;
  dialoguePercentage: number; // percent 0–100
  lexicalDensity: number;     // percent 0–100
  pacing: string;
  readabilityScore: number;
  // New extended metrics
  readingTime?: string; // human-readable summary (e.g., "5m")
  readingTimeMinutes?: number;
  readingTimeHours?: number;
  uniqueWordCount?: number;
  wordLengthDistribution?: {
    '1_to_3_letters': number; // percent 0–100
    '4_to_6_letters': number; // percent 0–100
    '7_plus_letters': number; // percent 0–100
  };
  stopwordRatio?: number; // percent 0–100
  hapaxPercent?: number;  // percent 0–100
  hapaxCount?: number;    // absolute count of words appearing once
  typeTokenRatio?: number; // percent 0–100
  readabilityGrade?: number;
}

export class PassageProseStats {
  analyze(input: ProseStatsInput): ProseStatsOutput {
    const text = input.text.trim();

    const wordCount = this.countWords(text);
    const sentenceCount = this.countSentences(text);
    const paragraphCount = this.countParagraphs(text);
    const dialoguePercentage = this.calculateDialoguePercentage(text);
    const lexicalDensity = this.calculateLexicalDensityPercent(text);
    const readabilityScore = this.calculateReadabilityScore(wordCount, sentenceCount);

    const averageWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
    const averageSentencesPerParagraph = paragraphCount > 0 ? sentenceCount / paragraphCount : 0;

    const pacing = this.determinePacing(averageWordsPerSentence);

    const uniqueWordCount = this.countUniqueWords(text);
    const wordLenDist = this.calculateWordLengthDistribution(text);
    const stopwordRatio = this.calculateStopwordRatioPercent(text);
    const hapaxPercent = this.calculateHapaxPercent(text);
    const hapaxCount = this.calculateHapaxCount(text);
    const typeTokenRatio = this.calculateTypeTokenRatioPercent(text);
    const readabilityGrade = this.calculateFKGLGrade(text, wordCount, sentenceCount);

    const readingTimeMinutes = this.estimateReadingTimeMinutes(wordCount);
    const readingTimeHours = readingTimeMinutes > 0 ? Math.round((readingTimeMinutes / 60) * 10) / 10 : 0;
    const readingTime = readingTimeMinutes > 0 ? `${Math.max(1, Math.round(readingTimeMinutes))}m` : undefined;

    return {
      wordCount,
      sentenceCount,
      paragraphCount,
      averageWordsPerSentence: Math.round(averageWordsPerSentence * 10) / 10,
      averageSentencesPerParagraph: Math.round(averageSentencesPerParagraph * 10) / 10,
      dialoguePercentage: Math.round(dialoguePercentage * 10) / 10,
      lexicalDensity: Math.round(lexicalDensity * 10) / 10,
      pacing,
      readabilityScore: Math.round(readabilityScore * 10) / 10,
      readingTime,
      readingTimeMinutes: Math.round(readingTimeMinutes * 10) / 10,
      readingTimeHours,
      uniqueWordCount,
      wordLengthDistribution: wordLenDist,
      stopwordRatio: Math.round(stopwordRatio * 10) / 10,
      hapaxPercent: Math.round(hapaxPercent * 10) / 10,
      hapaxCount,
      typeTokenRatio: Math.round(typeTokenRatio * 10) / 10,
      readabilityGrade: readabilityGrade !== undefined ? Math.round(readabilityGrade * 10) / 10 : undefined
    };
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  private countSentences(text: string): number {
    // Split on sentence-ending punctuation
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.length;
  }

  private countParagraphs(text: string): number {
    // Split on double newlines or more
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    return paragraphs.length;
  }

  private calculateDialoguePercentage(text: string): number {
    // Count words inside quotation marks
    const dialogueMatches = text.match(/"[^"]*"/g);
    if (!dialogueMatches) {
      return 0;
    }

    const dialogueText = dialogueMatches.join(' ');
    const dialogueWords = this.countWords(dialogueText);
    const totalWords = this.countWords(text);

    return totalWords > 0 ? (dialogueWords / totalWords) * 100 : 0;
  }

  private tokenizeWords(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^a-z']/g, ''))
      .filter(Boolean);
  }

  private countUniqueWords(text: string): number {
    const words = this.tokenizeWords(text);
    return new Set(words).size;
  }

  private calculateLexicalDensityPercent(text: string): number {
    // Lexical density as proportion of content words (non-stopwords)
    const words = this.tokenizeWords(text);
    if (words.length === 0) return 0;
    const stop = this.getStopwords();
    let content = 0;
    for (const w of words) if (!stop.has(w)) content++;
    return (content / words.length) * 100;
  }

  private calculateReadabilityScore(wordCount: number, sentenceCount: number): number {
    // Simplified Flesch Reading Ease approximation
    // Higher score = easier to read
    if (sentenceCount === 0) {
      return 0;
    }

    const avgWordsPerSentence = wordCount / sentenceCount;

    // Simplified formula (without syllable count)
    // Score ranges from 0-100
    const score = 100 - (avgWordsPerSentence * 2);

    return Math.max(0, Math.min(100, score));
  }

  private determinePacing(averageWordsPerSentence: number): string {
    if (averageWordsPerSentence < 10) {
      return 'Fast (short sentences)';
    } else if (averageWordsPerSentence < 20) {
      return 'Moderate';
    } else if (averageWordsPerSentence < 30) {
      return 'Slow (longer sentences)';
    } else {
      return 'Very slow (very long sentences)';
    }
  }

  private estimateReadingTimeMinutes(wordCount: number): number {
    const WPM = 240; // default average reading speed
    if (wordCount <= 0) return 0;
    return wordCount / WPM;
  }

  private calculateWordLengthDistribution(text: string): { '1_to_3_letters': number; '4_to_6_letters': number; '7_plus_letters': number } {
    const words = this.tokenizeWords(text).map(w => w.replace(/'/g, ''));
    const total = words.length || 1;
    let s1 = 0, s2 = 0, s3 = 0;
    for (const w of words) {
      const len = w.length;
      if (len <= 3) s1++;
      else if (len <= 6) s2++;
      else s3++;
    }
    return {
      '1_to_3_letters': (s1 / total) * 100,
      '4_to_6_letters': (s2 / total) * 100,
      '7_plus_letters': (s3 / total) * 100
    };
  }

  private calculateStopwordRatioPercent(text: string): number {
    const words = this.tokenizeWords(text);
    if (words.length === 0) return 0;
    const stop = this.getStopwords();
    let count = 0;
    for (const w of words) if (stop.has(w)) count++;
    return (count / words.length) * 100;
  }

  private calculateHapaxPercent(text: string): number {
    const words = this.tokenizeWords(text);
    if (words.length === 0) return 0;
    const freq = new Map<string, number>();
    for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
    let hapax = 0;
    for (const v of freq.values()) if (v === 1) hapax++;
    return (hapax / words.length) * 100;
  }

  private calculateHapaxCount(text: string): number {
    const words = this.tokenizeWords(text);
    if (words.length === 0) return 0;
    const freq = new Map<string, number>();
    for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
    let hapax = 0;
    for (const v of freq.values()) if (v === 1) hapax++;
    return hapax;
  }

  private calculateTypeTokenRatioPercent(text: string): number {
    const words = this.tokenizeWords(text);
    if (words.length === 0) return 0;
    const unique = new Set(words).size;
    return (unique / words.length) * 100;
  }

  private calculateFKGLGrade(text: string, wordCount: number, sentenceCount: number): number | undefined {
    if (wordCount === 0 || sentenceCount === 0) return undefined;
    const syllables = this.estimateSyllables(text);
    const WPS = wordCount / sentenceCount;
    const SPW = syllables / wordCount;
    const grade = 0.39 * WPS + 11.8 * SPW - 15.59;
    return Math.max(0, grade);
  }

  private estimateSyllables(text: string): number {
    // Lightweight heuristic syllable counter
    const words = this.tokenizeWords(text);
    let total = 0;
    for (let w of words) {
      let word = w.replace(/[^a-z]/g, '');
      if (!word) continue;
      // Remove silent 'e'
      word = word.replace(/e$/i, '');
      // Count vowel groups
      const matches = word.match(/[aeiouy]+/g);
      let syl = matches ? matches.length : 1;
      // 'le' ending adjustment
      if (/le$/.test(w) && w.length > 2) syl += 1;
      total += Math.max(1, syl);
    }
    return total;
  }

  private getStopwords(): Set<string> {
    // Compact English stopword list
    const arr = [
      'a','an','and','are','as','at','be','by','for','from','has','he','in','is','it','its','of','on','that','the','to','was','were','will','with','i','you','she','they','we','this','these','those','your','our','their','but','or','if','because','so','what','which','who','whom','where','when','how','why','not','no','nor','too','very','can','could','should','would','may','might','must','do','does','did','done','than','then','there','here','over','under','again','once'
    ];
    return new Set(arr);
  }
}
