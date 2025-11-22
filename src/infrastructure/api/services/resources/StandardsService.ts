/**
 * StandardsService
 *
 * Single Responsibility: Publishing standards comparison and enrichment
 *
 * This service handles:
 * - Enriching prose stats with publishing standards comparison
 * - Genre lookup from PublishingStandardsRepository
 * - Building publishing format information
 */

import * as vscode from 'vscode';
import { PublishingStandardsRepository } from '@/infrastructure/standards/PublishingStandardsRepository';
import { StandardsComparisonService } from '@/application/services/StandardsComparisonService';
import { Genre } from '@/domain/models/PublishingStandards';

export class StandardsService {
  private standardsRepo?: PublishingStandardsRepository;
  private standardsComparer: StandardsComparisonService;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly outputChannel?: vscode.OutputChannel
  ) {
    this.standardsComparer = new StandardsComparisonService();
    this.loadStandards();
  }

  /**
   * Enrich prose stats with publishing standards comparison
   *
   * This method:
   * 1. Reads publishing standards preset from settings
   * 2. Finds the selected genre
   * 3. Compares stats against genre standards
   * 4. Builds publishing format information
   * 5. Returns enriched stats with comparison and publishing format
   *
   * @param stats - Base prose stats object
   * @returns Enriched stats with comparison and publishing format, or original stats if standards disabled
   */
  async enrichWithStandards(stats: any): Promise<any> {
    try {
      if (!this.standardsRepo) return stats;

      const config = vscode.workspace.getConfiguration('proseMinion');
      const preset = (config.get<string>('publishingStandards.preset') || 'none').trim().toLowerCase();

      if (preset === 'none') return stats;

      if (preset === 'manuscript') {
        // Manuscript format currently not deeply compared; may add in future
        return stats;
      }

      // Parse genre preset: 'genre:<key>' or direct key
      let selectedGenre: Genre | undefined;
      if (preset.startsWith('genre:')) {
        const key = preset.slice('genre:'.length).trim();
        selectedGenre = await this.standardsRepo.findGenre(key);
      } else {
        // Backward fallback: try direct key
        selectedGenre = await this.standardsRepo.findGenre(preset);
      }

      if (!selectedGenre) return stats;

      const pageSizeKey = (config.get<string>('publishingStandards.pageSizeKey') || '').trim();
      const comparer = this.standardsComparer;

      const items = [] as any[];
      const S = selectedGenre.literary_statistics;

      const push = (key: string, label: string, value: number | string | undefined, range?: any) => {
        const item = comparer.makeItem(key, label, value as any, range);
        if (item) items.push(item);
      };

      // Compare key metrics
      push('word_count', 'Word Count', stats.wordCount, selectedGenre.word_count_range);
      push('dialogue_percentage', 'Dialogue %', stats.dialoguePercentage, S.dialogue_percentage);
      push('lexical_density', 'Lexical Density %', stats.lexicalDensity, S.lexical_density);
      push('avg_words_per_sentence', 'Avg Words/Sentence', stats.averageWordsPerSentence, S.avg_words_per_sentence);
      push('avg_sentences_per_paragraph', 'Avg Sentences/Paragraph', stats.averageSentencesPerParagraph, S.avg_sentences_per_paragraph);
      push('unique_word_count', 'Unique Words', stats.uniqueWordCount, S.unique_word_count);

      // Word length distribution
      if (stats.wordLengthDistribution) {
        push('wlen_1_3', '1–3 Letter %', Math.round(stats.wordLengthDistribution['1_to_3_letters'] * 10) / 10, S.word_length_distribution['1_to_3_letters']);
        push('wlen_4_6', '4–6 Letter %', Math.round(stats.wordLengthDistribution['4_to_6_letters'] * 10) / 10, S.word_length_distribution['4_to_6_letters']);
        push('wlen_7_plus', '7+ Letter %', Math.round(stats.wordLengthDistribution['7_plus_letters'] * 10) / 10, S.word_length_distribution['7_plus_letters']);
      }

      // Chapter metrics (if available)
      if (stats.chapterCount !== undefined) {
        push('chapter_count', 'Chapter Count', stats.chapterCount, S.chapter_count as any);
      }
      if (stats.averageChapterLength !== undefined) {
        push('avg_chapter_length', 'Avg Chapter Length', stats.averageChapterLength, S.avg_chapter_length as any);
      }

      // Build publishing format
      const publishingFormat = this.standardsComparer.buildPublishingFormat(
        selectedGenre,
        stats.wordCount,
        pageSizeKey || undefined
      );

      return {
        ...stats,
        comparison: { items },
        publishingFormat
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.outputChannel?.appendLine(`[StandardsService] Standards enrichment failed: ${msg}`);
      return stats;
    }
  }

  /**
   * Find a genre by key in the PublishingStandardsRepository
   *
   * @param key - Genre key (e.g., 'literary_fiction', 'thriller')
   * @returns Genre object if found, undefined otherwise
   */
  async findGenre(key: string): Promise<Genre | undefined> {
    if (!this.standardsRepo) return undefined;
    return this.standardsRepo.findGenre(key);
  }

  /**
   * Load publishing standards repository
   *
   * This is called during construction to initialize the standards repository
   */
  private loadStandards(): void {
    try {
      this.standardsRepo = new PublishingStandardsRepository(this.extensionUri);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.outputChannel?.appendLine(`[StandardsService] Failed to load standards repository: ${msg}`);
    }
  }
}
