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
  dialoguePercentage: number;
  lexicalDensity: number;
  pacing: string;
  readabilityScore: number;
}

export class PassageProseStats {
  analyze(input: ProseStatsInput): ProseStatsOutput {
    const text = input.text.trim();

    const wordCount = this.countWords(text);
    const sentenceCount = this.countSentences(text);
    const paragraphCount = this.countParagraphs(text);
    const dialoguePercentage = this.calculateDialoguePercentage(text);
    const lexicalDensity = this.calculateLexicalDensity(text);
    const readabilityScore = this.calculateReadabilityScore(wordCount, sentenceCount);

    const averageWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
    const averageSentencesPerParagraph = paragraphCount > 0 ? sentenceCount / paragraphCount : 0;

    const pacing = this.determinePacing(averageWordsPerSentence);

    return {
      wordCount,
      sentenceCount,
      paragraphCount,
      averageWordsPerSentence: Math.round(averageWordsPerSentence * 10) / 10,
      averageSentencesPerParagraph: Math.round(averageSentencesPerParagraph * 10) / 10,
      dialoguePercentage: Math.round(dialoguePercentage * 10) / 10,
      lexicalDensity: Math.round(lexicalDensity * 100) / 100,
      pacing,
      readabilityScore: Math.round(readabilityScore * 10) / 10
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

  private calculateLexicalDensity(text: string): number {
    // Lexical density = unique words / total words
    const words = text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 0)
      .map(word => word.replace(/[^a-z]/g, ''));

    const uniqueWords = new Set(words);
    return words.length > 0 ? uniqueWords.size / words.length : 0;
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
}
