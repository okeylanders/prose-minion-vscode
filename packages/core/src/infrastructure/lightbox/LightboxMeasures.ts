/**
 * The Lightbox's measured set (ADR 2026-10-19 D5). Pure: it maps what the
 * existing measure tools returned into the board contract and places each
 * counted word and phrase in the paragraphs it occurs in.
 *
 * Nothing here counts anew. Counts come from PassageProseStats,
 * WordFrequency and StyleFlags; placement re-tokenizes each paragraph with the
 * word-frequency tool's own tokenizer, so a word lights exactly the
 * paragraphs whose tokens the count was taken over. Two seams differ:
 * - the part-of-speech tagger splits hyphenated words ("rabbit-hole" is a
 *   "rabbit" and a "hole"), so a tagged word also matches the parts of a
 *   hyphenated token;
 * - a phrase that only occurs across a paragraph break counts in the tool but
 *   lights no paragraph.
 */

import type {
  LightboxCountedTerm,
  LightboxHeadlineStats,
  LightboxMeasuredSet,
  LightboxPartsOfSpeech,
  LightboxPublishingFormat,
  LightboxStandardsComparison,
  LightboxStyleFlag
} from '@messages';
import type { ComparisonItem, PublishingFormatSummary } from '@/application/services/StandardsComparisonService';
import type { ProseStatsOutput } from '@/tools/measure/passageProseStats';
import type { StyleFlagsOutput } from '@/tools/measure/styleFlags';
import {
  WORD_FREQUENCY_STOPWORDS,
  extractFrequencyWords,
  type NGramEntry,
  type WordFrequencyEntry,
  type WordFrequencyOutput
} from '@/tools/measure/wordFrequency';
import type { LightboxParagraph } from '@/infrastructure/lightbox/LightboxParagraphs';

/** How many of each list the board keeps. Presentation sizes, not prompt budgets. */
export const LIGHTBOX_MEASURED_SIZES = {
  topWords: 24,
  partOfSpeechWords: 6,
  bigrams: 8,
  trigrams: 6,
  /** How deep into the tool's n-gram ranking to look for content phrases. */
  ngramDepth: 120
} as const;

/** The prose-stats output after `StandardsService.enrichWithStandards`. */
export type LightboxEnrichedStats = ProseStatsOutput & {
  comparison?: { items: ComparisonItem[] };
  publishingFormat?: PublishingFormatSummary;
};

export interface LightboxMeasureInputs {
  stats: LightboxEnrichedStats;
  frequency: WordFrequencyOutput;
  flags: StyleFlagsOutput;
  paragraphs: readonly LightboxParagraph[];
}

/** Where each frequency token occurs, by paragraph. */
export class LightboxTermIndex {
  private readonly tokens: string[][];
  private readonly wordParagraphs = new Map<string, number[]>();
  private readonly partParagraphs = new Map<string, number[]>();

  constructor(paragraphs: readonly LightboxParagraph[]) {
    this.tokens = paragraphs.map((paragraph) => extractFrequencyWords(paragraph.text.toLowerCase()));
    this.tokens.forEach((tokens, offset) => {
      const index = offset + 1;
      const parts = new Set<string>();
      for (const token of new Set(tokens)) {
        addParagraph(this.wordParagraphs, token, index);
        parts.add(token);
        for (const part of token.split('-')) {
          parts.add(part);
        }
      }
      for (const part of parts) {
        addParagraph(this.partParagraphs, part, index);
      }
    });
  }

  /** Paragraphs holding the word as a whole token, ascending. */
  paragraphsOfWord(word: string): number[] {
    return [...(this.wordParagraphs.get(word) ?? [])];
  }

  /** Paragraphs holding the word whole or as part of a hyphenated token (tagged words). */
  paragraphsOfTaggedWord(word: string): number[] {
    return [...(this.partParagraphs.get(word) ?? [])];
  }

  /** Paragraphs holding the space-joined phrase as consecutive tokens, ascending. */
  paragraphsOfPhrase(phrase: string): number[] {
    const parts = phrase.split(' ').filter(Boolean);
    if (parts.length <= 1) {
      return this.paragraphsOfWord(parts[0] ?? '');
    }
    return (this.wordParagraphs.get(parts[0]) ?? []).filter((index) =>
      containsRun(this.tokens[index - 1], parts)
    );
  }
}

function addParagraph(map: Map<string, number[]>, key: string, index: number): void {
  if (key.length === 0) {
    return;
  }
  const list = map.get(key);
  if (!list) {
    map.set(key, [index]);
  } else if (list[list.length - 1] !== index) {
    list.push(index);
  }
}

function containsRun(tokens: readonly string[], parts: readonly string[]): boolean {
  for (let start = 0; start + parts.length <= tokens.length; start++) {
    if (parts.every((part, offset) => tokens[start + offset] === part)) {
      return true;
    }
  }
  return false;
}

export function buildLightboxMeasuredSet(inputs: LightboxMeasureInputs): LightboxMeasuredSet {
  const index = new LightboxTermIndex(inputs.paragraphs);
  const words = (
    entries: readonly WordFrequencyEntry[] | undefined,
    size: number,
    place: (word: string) => number[]
  ): LightboxCountedTerm[] =>
    (entries ?? []).slice(0, size).map((entry) => ({
      term: entry.word,
      count: entry.count,
      percentage: entry.percentage,
      paragraphs: place(entry.word)
    }));
  const tagged = (entries: readonly WordFrequencyEntry[] | undefined): LightboxCountedTerm[] =>
    words(entries, LIGHTBOX_MEASURED_SIZES.partOfSpeechWords, (word) => index.paragraphsOfTaggedWord(word));
  const phrases = (entries: readonly NGramEntry[] | undefined, size: number): LightboxCountedTerm[] =>
    (entries ?? [])
      .filter((entry) => entry.count >= 2 && hasContentWord(entry.phrase))
      .slice(0, size)
      .map((entry) => ({
        term: entry.phrase,
        count: entry.count,
        percentage: entry.percentage ?? 0,
        paragraphs: index.paragraphsOfPhrase(entry.phrase)
      }));

  const pos = inputs.frequency.pos;
  const partsOfSpeech: LightboxPartsOfSpeech = {
    available: pos?.mode === 'tagger',
    nouns: tagged(pos?.topNouns),
    verbs: tagged(pos?.topVerbs),
    adjectives: tagged(pos?.topAdjectives),
    adverbs: tagged(pos?.topAdverbs)
  };

  return {
    headline: headlineStats(inputs.stats),
    standards: standardsComparison(inputs.stats),
    topWords: words(inputs.frequency.topWords, LIGHTBOX_MEASURED_SIZES.topWords, (word) => index.paragraphsOfWord(word)),
    partsOfSpeech,
    phrases: {
      bigrams: phrases(inputs.frequency.bigrams, LIGHTBOX_MEASURED_SIZES.bigrams),
      trigrams: phrases(inputs.frequency.trigrams, LIGHTBOX_MEASURED_SIZES.trigrams)
    },
    styleFlags: inputs.flags.flags.map((flag): LightboxStyleFlag => ({
      type: flag.type,
      count: flag.count,
      examples: [...flag.examples]
    }))
  };
}

/** A repeated phrase is shown only if one of its words is not a stopword. */
function hasContentWord(phrase: string): boolean {
  return phrase.split(' ').some((word) => word.length > 0 && !WORD_FREQUENCY_STOPWORDS.has(word));
}

function headlineStats(stats: ProseStatsOutput): LightboxHeadlineStats {
  return {
    wordCount: stats.wordCount,
    sentenceCount: stats.sentenceCount,
    paragraphCount: stats.paragraphCount,
    averageWordsPerSentence: stats.averageWordsPerSentence,
    averageSentencesPerParagraph: stats.averageSentencesPerParagraph,
    dialoguePercentage: stats.dialoguePercentage,
    lexicalDensity: stats.lexicalDensity,
    readabilityScore: stats.readabilityScore,
    readabilityGrade: stats.readabilityGrade,
    pacing: stats.pacing,
    readingTimeMinutes: stats.readingTimeMinutes ?? 0,
    uniqueWordCount: stats.uniqueWordCount ?? 0,
    hapaxCount: stats.hapaxCount ?? 0,
    hapaxPercent: stats.hapaxPercent ?? 0,
    vocabularyDiversity: stats.vocabularyDiversity ?? 0
  };
}

function standardsComparison(stats: LightboxEnrichedStats): LightboxStandardsComparison | undefined {
  const items = stats.comparison?.items ?? [];
  const publishingFormat = publishingFormatOf(stats.publishingFormat);
  if (items.length === 0 && !publishingFormat) {
    return undefined;
  }
  return {
    items: items.map((item) => ({
      key: item.key,
      label: item.label,
      value: item.value,
      standard: item.standard ? { ...item.standard } : undefined,
      status: item.status
    })),
    publishingFormat
  };
}

function publishingFormatOf(format: PublishingFormatSummary | undefined): LightboxPublishingFormat | undefined {
  // A preset with no words-per-page figure reports NaN; there is nothing to show.
  if (!format || !Number.isFinite(format.wordsPerPage) || !Number.isFinite(format.estimatedPageCount)) {
    return undefined;
  }
  return {
    trimLabel: format.trimSize.label,
    wordsPerPage: format.wordsPerPage,
    estimatedPageCount: format.estimatedPageCount,
    pageCountRange: format.pageCountRange ? { ...format.pageCountRange } : undefined,
    status: format.status
  };
}
