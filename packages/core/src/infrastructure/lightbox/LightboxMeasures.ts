/**
 * The Lightbox's measured set (ADR 2026-10-19 D5). Pure: it maps what the
 * existing measure tools returned into the board contract and places each
 * counted word and phrase in the paragraphs it occurs in.
 *
 * Nothing here counts by rules of its own. Counts come from
 * PassageProseStats, WordFrequency and StyleFlags, and each counted item is
 * placed using the same occurrences its count was taken over:
 * - **Top words and repeated phrases** re-tokenize each paragraph with the
 *   word-frequency tool's own tokenizer, so a word lights exactly the
 *   paragraphs whose tokens the count was taken over. A phrase that only
 *   occurs across a paragraph break counts in the tool but lights no
 *   paragraph.
 * - **Parts of speech** come from the tagger's occurrence stream (PR #148
 *   F-03): the same whole-text tagging and normalization the Metrics tab
 *   counts, with each tagged word's token located in the text. Counts and
 *   paragraphs are both taken from those occurrences, keyed by word and part
 *   of speech, so the noun "light" and the verb "light" light only their own
 *   paragraphs, and a possessive ("Alice's", "Alice’s") places the name the
 *   tagger counted. The counts equal the Metrics tab's; an occurrence whose
 *   token could not be located (none is known) would be left out of both
 *   its count and its paragraphs rather than counted without a place.
 * - **Sentences and the numbers** (Slice 4B): the longest and very short
 *   sentences from each paragraph's sentence lengths, and the figures that
 *   stand out against the preset and the writer's own average
 *   (`LightboxNumbers`), each counted by its one detector.
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
import type { WordFrequencyOptions } from '@services/shared/ToolOptionsProvider';
import type { ProseStatsOutput } from '@/tools/measure/passageProseStats';
import type { StyleFlagsOutput } from '@/tools/measure/styleFlags';
import {
  WORD_FREQUENCY_STOPWORDS,
  extractFrequencyWords,
  rankPartsOfSpeech,
  type NGramEntry,
  type PartOfSpeechList,
  type PartOfSpeechOccurrence,
  type WordFrequencyEntry,
  type WordFrequencyOutput
} from '@/tools/measure/wordFrequency';
import { LightboxParagraph, splitLightboxParagraphs } from '@/infrastructure/lightbox/LightboxParagraphs';
import {
  LIGHTBOX_BASELINE_NOTES,
  lightboxSentenceSummary,
  measureLightboxNumbers,
  type LightboxWriterAverages
} from '@/infrastructure/lightbox/LightboxNumbers';

/** How many of each list the board keeps. Presentation sizes, not prompt budgets. */
export const LIGHTBOX_MEASURED_SIZES = {
  topWords: 24,
  partOfSpeechWords: 6,
  bigrams: 8,
  trigrams: 6,
  /** How deep into the tool's n-gram ranking to look for content phrases. */
  ngramDepth: 120
} as const;

/**
 * Fixed word-frequency options, so every board has the same shape whatever
 * the Metrics tab's settings are: POS (with its occurrence stream, for
 * placement), n-grams and the stopword table on, content words only, every
 * word length kept, no hapax list (the board shows hapax as a count).
 */
export const LIGHTBOX_WORD_FREQUENCY_OPTIONS: WordFrequencyOptions = {
  topN: LIGHTBOX_MEASURED_SIZES.topWords,
  includeHapaxList: false,
  hapaxDisplayMax: 0,
  includeStopwordsTable: true,
  contentWordsOnly: true,
  posEnabled: true,
  includePosOccurrences: true,
  includeBigrams: true,
  includeTrigrams: true,
  enableLemmas: false,
  lengthHistogramMaxChars: 10,
  minCharacterLength: 1,
  ngramLimit: LIGHTBOX_MEASURED_SIZES.ngramDepth
};

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
  /** The text the tools measured; tagged words are located in it. */
  text: string;
  /** The writer's own average; absent where no baseline is measured. */
  writer?: LightboxWriterAverages;
}

/** Where each frequency token occurs, by paragraph. */
export class LightboxTermIndex {
  private readonly tokens: string[][];
  private readonly wordParagraphs = new Map<string, number[]>();

  constructor(paragraphs: readonly LightboxParagraph[]) {
    this.tokens = paragraphs.map((paragraph) => extractFrequencyWords(paragraph.text.toLowerCase()));
    this.tokens.forEach((tokens, offset) => {
      for (const token of new Set(tokens)) {
        addParagraph(this.wordParagraphs, token, offset + 1);
      }
    });
  }

  /** Paragraphs holding the word as a whole token, ascending. */
  paragraphsOfWord(word: string): number[] {
    return [...(this.wordParagraphs.get(word) ?? [])];
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

/**
 * The parts-of-speech lists, counted and placed from the tagger's occurrences
 * (see the module comment). Each occurrence's offset is into the lowercased
 * text the tool tagged; lowercasing never adds or removes whitespace, so that
 * text splits into the same paragraphs, numbered alike.
 */
export function placeLightboxPartsOfSpeech(
  frequency: Pick<WordFrequencyOutput, 'pos' | 'totalWords'>,
  text: string
): LightboxPartsOfSpeech {
  const occurrences = frequency.pos?.mode === 'tagger' ? frequency.pos.occurrences : undefined;
  if (!occurrences) {
    return { available: false, nouns: [], verbs: [], adjectives: [], adverbs: [] };
  }
  const paragraphAt = paragraphLocator(splitLightboxParagraphs(text.toLowerCase()));
  const placed: Array<PartOfSpeechOccurrence & { paragraph: number }> = [];
  for (const occurrence of occurrences) {
    const paragraph = occurrence.offset === undefined ? undefined : paragraphAt(occurrence.offset);
    if (paragraph !== undefined) {
      placed.push({ ...occurrence, paragraph });
    }
  }

  const where = new Map<string, number[]>();
  for (const { list, word, paragraph } of placed) {
    addParagraph(where, `${list}:${word}`, paragraph);
  }
  const ranked = rankPartsOfSpeech(placed, frequency.totalWords, LIGHTBOX_WORD_FREQUENCY_OPTIONS.minCharacterLength);
  const terms = (list: PartOfSpeechList): LightboxCountedTerm[] =>
    ranked[list].slice(0, LIGHTBOX_MEASURED_SIZES.partOfSpeechWords).map((entry) => ({
      term: entry.word,
      count: entry.count,
      percentage: entry.percentage,
      paragraphs: [...(where.get(`${list}:${entry.word}`) ?? [])]
    }));
  return {
    available: true,
    nouns: terms('nouns'),
    verbs: terms('verbs'),
    adjectives: terms('adjectives'),
    adverbs: terms('adverbs')
  };
}

/** The paragraph whose trimmed span holds `offset`, by binary search. */
function paragraphLocator(paragraphs: readonly LightboxParagraph[]): (offset: number) => number | undefined {
  return (offset) => {
    let low = 0;
    let high = paragraphs.length - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const paragraph = paragraphs[middle];
      if (offset < paragraph.start) {
        high = middle - 1;
      } else if (offset >= paragraph.end) {
        low = middle + 1;
      } else {
        return paragraph.index;
      }
    }
    return undefined;
  };
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

  const standards = standardsComparison(inputs.stats);
  return {
    headline: headlineStats(inputs.stats),
    standards,
    topWords: words(inputs.frequency.topWords, LIGHTBOX_MEASURED_SIZES.topWords, (word) => index.paragraphsOfWord(word)),
    partsOfSpeech: placeLightboxPartsOfSpeech(inputs.frequency, inputs.text),
    phrases: {
      bigrams: phrases(inputs.frequency.bigrams, LIGHTBOX_MEASURED_SIZES.bigrams),
      trigrams: phrases(inputs.frequency.trigrams, LIGHTBOX_MEASURED_SIZES.trigrams)
    },
    styleFlags: inputs.flags.flags.map((flag): LightboxStyleFlag => ({
      type: flag.type,
      count: flag.count,
      examples: [...flag.examples]
    })),
    sentences: lightboxSentenceSummary(inputs.paragraphs.map((paragraph) => paragraph.text)),
    numbers: measureLightboxNumbers({
      text: inputs.text,
      paragraphs: inputs.paragraphs.map((paragraph) => paragraph.text),
      standards: standards?.items,
      averageWordsPerSentence: inputs.stats.averageWordsPerSentence,
      writer: inputs.writer ?? { summary: { kind: 'absent', note: LIGHTBOX_BASELINE_NOTES.notMeasured } }
    })
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
