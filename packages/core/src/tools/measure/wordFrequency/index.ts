/**
 * Word Frequency Tool
 * Enhanced analysis: top words, stopwords, hapax, POS via wink, n-grams, length histogram
 */

export interface WordFrequencyInput {
  text: string;
}

export interface WordFrequencyOptions {
  topN?: number; // default 100
  includeHapaxList?: boolean; // default true
  hapaxDisplayMax?: number; // default 300 (renderer cap; we still compute full list)
  includeStopwordsTable?: boolean; // default true
  contentWordsOnly?: boolean; // default true for Top Words
  posEnabled?: boolean; // default true
  includeBigrams?: boolean; // default true
  includeTrigrams?: boolean; // default true
  enableLemmas?: boolean; // default false (placeholder only)
  lengthHistogramMaxChars?: number; // default 10
  minCharacterLength?: number; // default 1 (filter words by minimum character count)
  ngramLimit?: number; // default 20 (how many top bigrams and trigrams to return)
  includePosOccurrences?: boolean; // default false (adds pos.occurrences: every counted tagged word, where it is)
}

/**
 * The function words Top Words leaves out, and the Lightbox's repeated-phrase
 * filter tests against (a phrase made only of these is not shown).
 */
export const WORD_FREQUENCY_STOPWORDS: ReadonlySet<string> = new Set<string>([
  'a','an','and','are','as','at','be','by','for','from','has','he','in','is','it','its','of','on','that','the','to','was','were','will','with','i','you','she','they','we','this','these','those','your','our','their','but','or','if','because','so','what','which','who','whom','where','when','how','why','not','no','nor','too','very','can','could','should','would','may','might','must','do','does','did','done','than','then','there','here','over','under','again','once'
]);

/**
 * The tool's tokenizer, exported so callers that place counted words in the
 * text (the Lightbox's paragraph lookups) split it exactly as the counts did.
 * Expects lowercased text, as `analyze` passes it.
 */
export function extractFrequencyWords(text: string): string[] {
  return text
    .replace(/[—–]/g, ' ')  // Convert em-dash and en-dash to space first
    .split(/\s+/)
    .map(word => word.replace(/[^a-z'-]/g, ''))  // Keep hyphens and apostrophes
    .map(word => word.replace(/^'+|'+$/g, ''))   // Trim leading/trailing apostrophes
    .filter(word => word.length > 0);
}

export interface WordFrequencyEntry {
  word: string;
  count: number;
  percentage: number;
}

/** The part-of-speech lists the tool reports. */
export type PartOfSpeechList = 'nouns' | 'verbs' | 'adjectives' | 'adverbs';

/**
 * One word the tagger counted toward a part-of-speech list, in text order.
 * `word` is normalized exactly as the counts are (lowercase, letters and
 * apostrophes only).
 */
export interface PartOfSpeechOccurrence {
  word: string;
  list: PartOfSpeechList;
  /**
   * UTF-16 offset of the tagger's token in the text it tagged (the input,
   * lowercased). The tagger's tokens are verbatim, in-order slices of that
   * text, so each is found by scanning forward; `undefined` only if a token
   * could not be found there.
   */
  offset: number | undefined;
  /**
   * The token's length in UTF-16 units, so `[offset, offset + length)` is
   * the tagger's token itself, which can be part of a word ("n't" of
   * "don't"). The Lightbox lights it (Slice 4E).
   */
  length: number;
}

const PART_OF_SPEECH_TAGS: ReadonlyArray<[PartOfSpeechList, ReadonlySet<string>]> = [
  ['nouns', new Set(['NN', 'NNS', 'NNP', 'NNPS'])],
  ['verbs', new Set(['VB', 'VBD', 'VBG', 'VBN', 'VBP', 'VBZ'])],
  ['adjectives', new Set(['JJ', 'JJR', 'JJS'])],
  ['adverbs', new Set(['RB', 'RBR', 'RBS'])]
];

/** How many words each part-of-speech list reports. */
const PART_OF_SPEECH_LIST_SIZE = 25;

/**
 * Tag `text` (lowercase it first, as `analyze` does) with the offline
 * wink-pos-tagger and return every word counted toward a part-of-speech list,
 * in text order, with where its token is. `analyze` counts exactly these, so
 * a caller that needs to place POS words in the text reads the same stream
 * the counts came from. Throws when the tagger cannot load.
 */
export function tagPartsOfSpeech(text: string): PartOfSpeechOccurrence[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const winkPosTagger = require('wink-pos-tagger');
  const tagged: Array<{ value?: string; normal?: string; pos: string }> = winkPosTagger().tagSentence(text);
  const occurrences: PartOfSpeechOccurrence[] = [];
  let cursor = 0;
  for (const token of tagged) {
    const value = token.value ?? '';
    const found = value.length > 0 ? text.indexOf(value, cursor) : -1;
    if (found >= 0) {
      cursor = found + value.length;
    }
    const word = (token.value || token.normal || '').toLowerCase().replace(/[^a-z']/g, '');
    const list = PART_OF_SPEECH_TAGS.find(([, tags]) => tags.has(token.pos))?.[0];
    if (word && list) {
      occurrences.push({ word, list, offset: found >= 0 ? found : undefined, length: value.length });
    }
  }
  return occurrences;
}

/**
 * The tool's part-of-speech lists from tagged occurrences: per list, words of
 * at least `minCharacterLength` characters, most frequent first (ties keep
 * first-seen order), the top 25, with percentages of `totalWords`.
 */
export function rankPartsOfSpeech(
  occurrences: readonly Pick<PartOfSpeechOccurrence, 'word' | 'list'>[],
  totalWords: number,
  minCharacterLength: number
): Record<PartOfSpeechList, WordFrequencyEntry[]> {
  const counts: Record<PartOfSpeechList, Map<string, number>> = {
    nouns: new Map(),
    verbs: new Map(),
    adjectives: new Map(),
    adverbs: new Map()
  };
  for (const { word, list } of occurrences) {
    counts[list].set(word, (counts[list].get(word) || 0) + 1);
  }
  const rank = (map: Map<string, number>) => formatTopEntries(
    Array.from(map.entries())
      .filter(([w]) => w.length >= minCharacterLength)
      .sort((a, b) => b[1] - a[1]),
    totalWords,
    PART_OF_SPEECH_LIST_SIZE
  );
  return {
    nouns: rank(counts.nouns),
    verbs: rank(counts.verbs),
    adjectives: rank(counts.adjectives),
    adverbs: rank(counts.adverbs)
  };
}

function formatTopEntries(
  entries: Array<[string, number]>,
  total: number,
  limit: number
): WordFrequencyEntry[] {
  return entries.slice(0, limit).map(([word, count]) => ({
    word,
    count,
    percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0
  }));
}

export interface NGramEntry {
  phrase: string;
  count: number;
  percentage?: number;
}

  export interface WordFrequencyOutput {
  totalWords: number;
  uniqueWords: number;
  // Top words
  topWords: WordFrequencyEntry[];
  // Stopwords
  topStopwords?: WordFrequencyEntry[];
  totalStopwordCount?: number;
  // Lexical Density
  lexicalDensity?: number; // percent 0–100 (content words / total words)
  // Hapax
  hapaxCount?: number;
  hapaxPercent?: number;
  hapaxList?: string[];
  // POS tagging (wink)
  pos?: {
    mode: 'tagger' | 'unavailable';
    topNouns?: WordFrequencyEntry[];
    topVerbs?: WordFrequencyEntry[];
    topAdjectives?: WordFrequencyEntry[];
    topAdverbs?: WordFrequencyEntry[];
    /** Every counted tagged word, in text order (with `includePosOccurrences`). */
    occurrences?: PartOfSpeechOccurrence[];
  };
    // N-grams
    bigrams?: NGramEntry[];
    trigrams?: NGramEntry[];
    // Length histogram
    charLengthCounts: Record<number, number>;
    charLengthPercentages: Record<number, number>;
    charLengthHistogram?: string[];
    // Lemmas (optional)
    lemmasEnabled?: boolean;
    topLemmaWords?: WordFrequencyEntry[];
  }

export class WordFrequency {
  constructor(private readonly log?: (msg: string) => void) {}
  private readonly stopwords = WORD_FREQUENCY_STOPWORDS;

  /**
   * Extract unique words from text for use by other services (e.g., ContextSearchService)
   * @param text - The text to extract words from
   * @param options - Filtering options
   * @returns Sorted array of unique words (lowercase)
   */
  extractUniqueWords(
    text: string,
    options?: { minCharacterLength?: number; excludeStopwords?: boolean }
  ): string[] {
    const minLen = options?.minCharacterLength ?? 2;
    const excludeStopwords = options?.excludeStopwords ?? false;

    const words = this.extractWords(text.toLowerCase());
    const uniqueSet = new Set<string>();

    for (const word of words) {
      if (word.length < minLen) continue;
      if (excludeStopwords && this.stopwords.has(word)) continue;
      uniqueSet.add(word);
    }

    return Array.from(uniqueSet).sort();
  }

  analyze(input: WordFrequencyInput, options?: WordFrequencyOptions): WordFrequencyOutput {
    const opts: Required<WordFrequencyOptions> = {
      topN: options?.topN ?? 100,
      includeHapaxList: options?.includeHapaxList ?? true,
      hapaxDisplayMax: options?.hapaxDisplayMax ?? 300,
      includeStopwordsTable: options?.includeStopwordsTable ?? true,
      contentWordsOnly: options?.contentWordsOnly ?? true,
      posEnabled: options?.posEnabled ?? true,
      includeBigrams: options?.includeBigrams ?? true,
      includeTrigrams: options?.includeTrigrams ?? true,
      enableLemmas: options?.enableLemmas ?? false,
      lengthHistogramMaxChars: options?.lengthHistogramMaxChars ?? 10,
      minCharacterLength: options?.minCharacterLength ?? 1,
      ngramLimit: options?.ngramLimit ?? 20,
      includePosOccurrences: options?.includePosOccurrences ?? false
    };

    const text = input.text.toLowerCase();
    const words = this.extractWords(text);
    const totalWords = words.length;
    const wordCounts = this.countMap(words);
    const uniqueWords = wordCounts.size;

    // Top Words (content words optionally)
    const entries = Array.from(wordCounts.entries());
    const contentEntries = opts.contentWordsOnly
      ? entries.filter(([w]) => !this.stopwords.has(w))
      : entries;
    // FILTER FIRST (before sorting/limiting)
    const filteredContent = contentEntries.filter(([w]) => w.length >= opts.minCharacterLength);
    filteredContent.sort((a, b) => b[1] - a[1]);
    const topWords = this.formatTop(filteredContent, totalWords, opts.topN);

    // Stopwords table
    let topStopwords: WordFrequencyEntry[] | undefined;
    let totalStopwordCount: number | undefined;
    if (opts.includeStopwordsTable) {
      const stopEntries = entries.filter(([w]) => this.stopwords.has(w)).sort((a, b) => b[1] - a[1]);
      totalStopwordCount = stopEntries.reduce((acc, [, c]) => acc + c, 0);
      topStopwords = this.formatTop(stopEntries, totalWords, Math.min(25, stopEntries.length));
    }

    // Lexical Density (content words / total words × 100)
    const lexicalDensity = totalWords > 0 && totalStopwordCount !== undefined
      ? ((totalWords - totalStopwordCount) / totalWords) * 100
      : undefined;

    // Hapax (filter word pool first, then identify hapax from filtered set)
    let hapaxCount = 0;
    const hapaxListAll: string[] = [];
    for (const [w, c] of wordCounts.entries()) {
      if (c === 1 && w.length >= opts.minCharacterLength) {
        hapaxCount++;
        hapaxListAll.push(w);
      }
    }
    hapaxListAll.sort();
    const hapaxPercent = totalWords > 0 ? (hapaxCount / totalWords) * 100 : 0;
    const hapaxList = opts.includeHapaxList ? hapaxListAll : undefined;

    // Character length counts and percentages
    const charCounts: Record<number, number> = {};
    for (const w of words) {
      const len = w.replace(/'/g, '').length;
      if (len <= 0) continue;
      charCounts[len] = (charCounts[len] || 0) + 1;
    }
    const charPerc: Record<number, number> = {};
    for (const lenStr of Object.keys(charCounts)) {
      const len = Number(lenStr);
      charPerc[len] = totalWords > 0 ? (charCounts[len] / totalWords) * 100 : 0;
    }
    const histogram = this.buildLengthHistogram(charPerc, opts.lengthHistogramMaxChars);

    // POS via wink-pos-tagger: counted from the tagged-occurrence stream.
    let pos: WordFrequencyOutput['pos'] | undefined;
    if (opts.posEnabled) {
      try {
        const occurrences = tagPartsOfSpeech(text);
        const lists = rankPartsOfSpeech(occurrences, totalWords, opts.minCharacterLength);
        pos = {
          mode: 'tagger',
          topNouns: lists.nouns,
          topVerbs: lists.verbs,
          topAdjectives: lists.adjectives,
          topAdverbs: lists.adverbs,
          ...(opts.includePosOccurrences ? { occurrences } : {})
        };
      } catch (e: any) {
        const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
        this.log?.(`[WordFrequency] POS tagger initialization failed: ${msg}`);
        pos = { mode: 'unavailable' };
      }
    }

    // Lemmas (optional)
    let topLemmaWords: WordFrequencyEntry[] | undefined;
    if (opts.enableLemmas) {
      const lemmaCounts = new Map<string, number>();
      for (const [w, c] of entries) {
        // respect contentWordsOnly when building lemma view
        if (opts.contentWordsOnly && this.stopwords.has(w)) continue;
        const lemma = this.lemmatize(w);
        lemmaCounts.set(lemma, (lemmaCounts.get(lemma) || 0) + c);
      }
      // Filter before sorting/limiting
      const lemmaEntries = Array.from(lemmaCounts.entries())
        .filter(([lemma]) => lemma.length >= opts.minCharacterLength)
        .sort((a, b) => b[1] - a[1]);
      topLemmaWords = this.formatTop(lemmaEntries, totalWords, opts.topN);
    }

    // N-grams (filter by ALL component word lengths)
    let bigrams: NGramEntry[] | undefined;
    let trigrams: NGramEntry[] | undefined;
    if (opts.includeBigrams) {
      bigrams = this.computeNGrams(words, 2, totalWords, opts.ngramLimit, opts.minCharacterLength);
    }
    if (opts.includeTrigrams) {
      trigrams = this.computeNGrams(words, 3, totalWords, opts.ngramLimit, opts.minCharacterLength);
    }

    return {
      totalWords,
      uniqueWords,
      topWords,
      topStopwords,
      totalStopwordCount,
      lexicalDensity: lexicalDensity !== undefined ? Math.round(lexicalDensity * 10) / 10 : undefined,
      hapaxCount,
      hapaxPercent: Math.round(hapaxPercent * 10) / 10,
      hapaxList,
      pos,
      bigrams,
      trigrams,
      charLengthCounts: charCounts,
      charLengthPercentages: Object.fromEntries(Object.entries(charPerc).map(([k, v]) => [Number(k), Math.round(v * 10) / 10])) as Record<number, number>,
      charLengthHistogram: histogram,
      lemmasEnabled: opts.enableLemmas || undefined,
      topLemmaWords
    };
  }

  private extractWords(text: string): string[] {
    return extractFrequencyWords(text);
  }

  private countMap(arr: string[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const w of arr) m.set(w, (m.get(w) || 0) + 1);
    return m;
  }

  private formatTop(
    entries: Array<[string, number]>,
    total: number,
    limit: number
  ): WordFrequencyEntry[] {
    return formatTopEntries(entries, total, limit);
  }

  private computeNGrams(tokens: string[], n: number, totalWords: number, limit: number, minCharLength: number = 1): NGramEntry[] {
    const counts = new Map<string, number>();
    for (let i = 0; i <= tokens.length - n; i++) {
      const words = tokens.slice(i, i + n);
      // Filter: ALL component words must meet minimum character length
      if (words.every(w => w.length >= minCharLength)) {
        const phrase = words.join(' ');
        counts.set(phrase, (counts.get(phrase) || 0) + 1);
      }
    }
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit);
    return entries.map(([phrase, count]) => ({ phrase, count, percentage: totalWords > 0 ? Math.round((count / totalWords) * 1000) / 10 : 0 }));
  }

  private buildLengthHistogram(percentages: Record<number, number>, maxChars: number): string[] {
    const keys = Object.keys(percentages).map(Number).filter(k => k > 0 && k <= maxChars).sort((a, b) => a - b);
    if (keys.length === 0) return [];
    const maxPct = Math.max(...keys.map(k => percentages[k]));
    const maxBlocks = 10;
    const lines: string[] = [];
    for (const k of keys) {
      const pct = percentages[k];
      const blocks = maxPct > 0 ? Math.max(1, Math.round((pct / maxPct) * maxBlocks)) : 0;
      const bar = '█'.repeat(blocks);
      lines.push(`${k} chars: ${bar} ${pct.toFixed(1)}%`);
    }
    return lines;
  }

  // Very lightweight lemmatizer to group common inflections.
  // Not linguistically complete; intended for quick, offline grouping.
  private lemmatize(word: string): string {
    let w = word;
    // Plurals
    if (/ies$/.test(w) && w.length > 3) {
      return w.slice(0, -3) + 'y';
    }
    if (/(xes|zes|ches|shes|sses)$/.test(w)) {
      return w.slice(0, -2); // remove 'es'
    }
    if (/s$/.test(w) && !/ss$/.test(w)) {
      w = w.slice(0, -1);
    }
    // Verb participles/tense
    if (/ing$/.test(w) && w.length > 4) {
      w = w.slice(0, -3);
    } else if (/ed$/.test(w) && w.length > 3) {
      w = w.slice(0, -2);
    }
    // Comparative/superlative (basic)
    if (/est$/.test(w) && w.length > 4) {
      w = w.slice(0, -3);
    } else if (/er$/.test(w) && w.length > 3) {
      w = w.slice(0, -2);
    }
    return w;
  }
}
