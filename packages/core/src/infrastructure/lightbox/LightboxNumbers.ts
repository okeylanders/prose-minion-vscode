/**
 * What stands out in the numbers (ADR 2026-10-19 D5, D7 addendum; Slice
 * 4B). Pure: no host, no I/O, no model.
 *
 * Six figures, each counted by one detector, the same detector that places
 * its instances in paragraphs and checks a reading's quotes
 * (`LightboxNumberInstances`):
 * - sentence length and dialogue share, by the prose-stats rules the
 *   Metrics tab and the publishing-standards comparison use;
 * - passive voice, adverbs and intensifiers by Style Flags' exported
 *   detectors, and being verbs by `tools/measure/beingVerbs`, as rates per
 *   1,000 words, counted paragraph by paragraph (so no match spans a
 *   paragraph break).
 *
 * A figure **stands out** when the writer's preset puts it outside its range
 * (the board's existing comparison), or when it is at least
 * `LIGHTBOX_STANDOUT_RATIO` times, or at most its inverse of, the writer's
 * own average (`LightboxWriterBaseline`), with enough material on both
 * sides. A word pattern stands out only above its average: a pattern rarer
 * than usual has no instance to quote, so the board shows it but does not
 * ask how it is used.
 */

import type {
  LightboxNumberRange,
  LightboxNumberRow,
  LightboxNumberStandout,
  LightboxNumberStatId,
  LightboxNumbersMeasure,
  LightboxSentenceSummary,
  LightboxStandardsItem,
  LightboxWriterBaselineSummary
} from '@messages';
import { countDialogueWords, findDialogueSpans } from '@/utils/dialogueSpans';
import { countWords } from '@/utils/textUtils';
import { countProseSentences, proseSentenceSpans } from '@/tools/measure/passageProseStats';
import { findAdverbs, findFillerWords, findPassiveVoice } from '@/tools/measure/styleFlags';
import { findBeingVerbs } from '@/tools/measure/beingVerbs';
import { lightboxSentenceWords } from '@/infrastructure/lightbox/LightboxParagraphs';
import { LIGHTBOX_NUMBER_STAT_LABELS } from '@shared/constants/lightbox';

/** How far from the writer's average a figure must be to stand out: this many times, or its inverse. */
export const LIGHTBOX_STANDOUT_RATIO = 1.5;
/** A word pattern needs this many instances in the chapter to stand out against an average. */
export const LIGHTBOX_STANDOUT_MINIMUM_INSTANCES = 3;
/** A chapter shorter than this is not compared with the writer's average (rates are too noisy). */
export const LIGHTBOX_STANDOUT_MINIMUM_WORDS = 300;
/** The writer's average needs at least this many words of their other text. */
export const LIGHTBOX_BASELINE_MINIMUM_WORDS = 2_000;
/** A sentence under this many words counts as very short in the rhythm summary. */
export const LIGHTBOX_VERY_SHORT_SENTENCE_WORDS = 6;

/** Why a board has no average of the writer's own: host words, shown on the numbers tile. */
export const LIGHTBOX_BASELINE_NOTES = {
  noFiles: 'No chapter or manuscript files are configured in your project, so there is no average of your own to compare with.',
  unreadable: 'Your configured project folders could not be read, so there is no average of your own to compare with.',
  nothingRead: 'None of your chapter or manuscript files could be read, so there is no average of your own to compare with.',
  notMeasured: 'An average of your own is not measured here.'
} as const;

/** The word patterns, each with its detector. */
/* eslint-disable @typescript-eslint/naming-convention -- keyed by the figures' kebab-case protocol ids. */
export const LIGHTBOX_NUMBER_PATTERNS = {
  'passive-voice': findPassiveVoice,
  'being-verbs': findBeingVerbs,
  adverbs: findAdverbs,
  intensifiers: findFillerWords
} as const satisfies Record<string, (text: string) => Array<{ start: number; end: number; text: string }>>;

/* eslint-enable @typescript-eslint/naming-convention */

export type LightboxNumberPatternId = keyof typeof LIGHTBOX_NUMBER_PATTERNS;

const PATTERN_IDS = Object.keys(LIGHTBOX_NUMBER_PATTERNS) as LightboxNumberPatternId[];

/** The figures, in display order, with their host words (labels from `LIGHTBOX_NUMBER_STAT_LABELS`). */
export const LIGHTBOX_NUMBER_STATS: ReadonlyArray<{ stat: LightboxNumberStatId; label: string; unit: string; noun: string }> = ([
  { stat: 'sentence-length', unit: 'words per sentence', noun: 'sentences' },
  { stat: 'dialogue', unit: '% of words', noun: 'dialogue' },
  { stat: 'passive-voice', unit: 'per 1,000 words', noun: 'passive constructions' },
  { stat: 'being-verbs', unit: 'per 1,000 words', noun: 'being verbs' },
  { stat: 'adverbs', unit: 'per 1,000 words', noun: '-ly words' },
  { stat: 'intensifiers', unit: 'per 1,000 words', noun: 'intensifiers and fillers' }
] as const).map((entry) => ({ ...entry, label: LIGHTBOX_NUMBER_STAT_LABELS[entry.stat] }));

export function lightboxNumberLabel(stat: LightboxNumberStatId): string {
  return LIGHTBOX_NUMBER_STAT_LABELS[stat];
}

/** A text's counts, by the rules above: what a chapter and each baseline file are measured into. */
export interface LightboxFigureCounts {
  words: number;
  sentences: number;
  dialogueWords: number;
  patterns: Record<LightboxNumberPatternId, number>;
}

export function emptyLightboxFigureCounts(): LightboxFigureCounts {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- keyed by the figures' kebab-case protocol ids.
  return { words: 0, sentences: 0, dialogueWords: 0, patterns: { 'passive-voice': 0, 'being-verbs': 0, adverbs: 0, intensifiers: 0 } };
}

/** Count one text: words, sentences and dialogue over the whole of it; patterns paragraph by paragraph. */
export function countLightboxFigures(text: string, paragraphs: readonly string[]): LightboxFigureCounts {
  const counts = emptyLightboxFigureCounts();
  counts.words = countWords(text);
  counts.sentences = countProseSentences(text.trim());
  counts.dialogueWords = countDialogueWords(text);
  for (const id of PATTERN_IDS) {
    counts.patterns[id] = paragraphs.reduce((sum, paragraph) => sum + LIGHTBOX_NUMBER_PATTERNS[id](paragraph).length, 0);
  }
  return counts;
}

/** Add `more` into `into`. */
export function addLightboxFigureCounts(into: LightboxFigureCounts, more: LightboxFigureCounts): void {
  into.words += more.words;
  into.sentences += more.sentences;
  into.dialogueWords += more.dialogueWords;
  for (const id of PATTERN_IDS) {
    into.patterns[id] += more.patterns[id];
  }
}

/** A figure's value from counts: a mean, a percentage, or a rate per 1,000 words; one decimal. */
export function lightboxFigureValue(stat: LightboxNumberStatId, counts: LightboxFigureCounts): number {
  const value = stat === 'sentence-length'
    ? (counts.sentences > 0 ? counts.words / counts.sentences : 0)
    : stat === 'dialogue'
      ? (counts.words > 0 ? (counts.dialogueWords / counts.words) * 100 : 0)
      : (counts.words > 0 ? (counts.patterns[stat] / counts.words) * 1000 : 0);
  return round(value, 1);
}

/** The writer's own average, as the baseline service measured it. */
export interface LightboxWriterAverages {
  summary: LightboxWriterBaselineSummary;
  /** Present only with `summary.kind === 'measured'`. */
  counts?: LightboxFigureCounts;
}

export interface LightboxNumbersInput {
  /** The text as measured, and its paragraphs (index 0 is ¶1). */
  text: string;
  paragraphs: readonly string[];
  /** The board's standards comparison items (absent without a genre preset). */
  standards?: readonly LightboxStandardsItem[];
  /** The headline's mean sentence length (whole-text rule), the figure the preset compares. */
  averageWordsPerSentence: number;
  writer: LightboxWriterAverages;
}

const STANDARDS_KEYS: Partial<Record<LightboxNumberStatId, string>> = {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- keyed by the figures' kebab-case protocol ids.
  'sentence-length': 'avg_words_per_sentence',
  dialogue: 'dialogue_percentage'
};

/** Every figure, with what stands out. */
export function measureLightboxNumbers(input: LightboxNumbersInput): LightboxNumbersMeasure {
  const counts = countLightboxFigures(input.text, input.paragraphs);
  const writerCounts = input.writer.summary.kind === 'measured' && input.writer.counts &&
    input.writer.counts.words >= LIGHTBOX_BASELINE_MINIMUM_WORDS ? input.writer.counts : undefined;
  const rows = LIGHTBOX_NUMBER_STATS.map(({ stat, label, unit }) => {
    const value = stat === 'sentence-length' ? round(input.averageWordsPerSentence, 1) : lightboxFigureValue(stat, counts);
    const range = rangeOf(input.standards?.find((item) => item.key === STANDARDS_KEYS[stat]));
    const writer = writerCounts ? writerAverage(value, lightboxFigureValue(stat, writerCounts)) : undefined;
    const standout = standoutOf(stat, value, counts, range, writer);
    return { stat, label, unit, value, ...(range ? { range } : {}), ...(writer ? { writer } : {}), ...(standout ? { standout } : {}),
      ...lightboxNumberInstances(stat, input.paragraphs, standout) };
  });
  return { rows, baseline: baselineSummary(input.writer.summary, writerCounts !== undefined) };
}

/**
 * The longest and the very short sentences, paragraph by paragraph, by the
 * prose-stats splitter and word rule. A span with no letter in it (a closing
 * quotation mark or bracket the splitter leaves after an end mark) is no
 * sentence a reader reads, so it is not counted as very short.
 */
export function lightboxSentenceSummary(paragraphs: readonly string[]): LightboxSentenceSummary {
  let longest: LightboxSentenceSummary['longest'] = null;
  let veryShort = 0;
  paragraphs.forEach((paragraph, index) => {
    for (const { start, end } of proseSentenceSpans(paragraph)) {
      const sentence = paragraph.slice(start, end);
      const words = countWords(sentence);
      if (!longest || words > longest.words) {
        longest = { words, paragraph: index + 1 };
      }
      veryShort += words < LIGHTBOX_VERY_SHORT_SENTENCE_WORDS && /\p{L}/u.test(sentence) ? 1 : 0;
    }
  });
  return { longest, veryShort, underWords: LIGHTBOX_VERY_SHORT_SENTENCE_WORDS };
}

/** A row's instances, their paragraphs and its most frequent words, by the row's own detector. */
function lightboxNumberInstances(
  stat: LightboxNumberStatId,
  paragraphs: readonly string[],
  standout: LightboxNumberStandout | undefined
): Pick<LightboxNumberRow, 'instances' | 'instanceLabel' | 'paragraphs' | 'top'> {
  const noun = LIGHTBOX_NUMBER_STATS.find((entry) => entry.stat === stat)?.noun ?? stat;
  const per = (count: (paragraph: string) => number, instanceLabel: string) => {
    const found = paragraphs.map(count);
    return {
      instances: found.reduce((sum, n) => sum + n, 0),
      instanceLabel,
      paragraphs: found.flatMap((n, index) => (n > 0 ? [index + 1] : []))
    };
  };
  if (stat === 'sentence-length') {
    const reference = standout?.reference;
    if (!standout || reference === undefined) {
      return { instances: 0, instanceLabel: 'sentences', paragraphs: [] };
    }
    const beyond = (words: number) => (standout.direction === 'above' ? words > reference : words < reference);
    return per(
      (paragraph) => lightboxSentenceWords(paragraph).filter(beyond).length,
      `sentences ${standout.direction === 'above' ? 'over' : 'under'} ${reference} words`
    );
  }
  if (stat === 'dialogue') {
    return standout?.direction === 'below'
      ? per((paragraph) => (findDialogueSpans(paragraph).length === 0 ? 1 : 0), 'paragraphs of narration only')
      : per((paragraph) => findDialogueSpans(paragraph).length, 'spans of dialogue');
  }
  const words = new Map<string, number>();
  const counted = per((paragraph) => {
    const matches = LIGHTBOX_NUMBER_PATTERNS[stat](paragraph);
    for (const match of matches) {
      const word = match.text.toLowerCase().replace(/\s+/g, ' ');
      words.set(word, (words.get(word) ?? 0) + 1);
    }
    return matches.length;
  }, noun);
  const top = [...words.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([term, count]) => ({ term, count }));
  return { ...counted, ...(top.length > 0 ? { top } : {}) };
}

function rangeOf(item: LightboxStandardsItem | undefined): LightboxNumberRange | undefined {
  if (!item?.standard || item.status === 'n/a') {
    return undefined;
  }
  return { ...item.standard, status: item.status };
}

function writerAverage(value: number, average: number): LightboxNumberRow['writer'] {
  return { average, ...(average > 0 ? { ratio: round(value / average, 2) } : {}) };
}

function standoutOf(
  stat: LightboxNumberStatId,
  value: number,
  counts: LightboxFigureCounts,
  range: LightboxNumberRange | undefined,
  writer: LightboxNumberRow['writer']
): LightboxNumberStandout | undefined {
  const pattern = stat !== 'sentence-length' && stat !== 'dialogue';
  const byStandards = range && range.status !== 'within' ? range.status : undefined;
  let byWriter: 'above' | 'below' | undefined;
  if (writer && counts.words >= LIGHTBOX_STANDOUT_MINIMUM_WORDS &&
    (!pattern || counts.patterns[stat as LightboxNumberPatternId] >= LIGHTBOX_STANDOUT_MINIMUM_INSTANCES)) {
    if (writer.average === 0) {
      byWriter = value > 0 ? 'above' : undefined;
    } else if (value >= writer.average * LIGHTBOX_STANDOUT_RATIO) {
      byWriter = 'above';
    } else if (!pattern && value <= writer.average / LIGHTBOX_STANDOUT_RATIO) {
      byWriter = 'below';
    }
  }
  const direction = byStandards ?? byWriter;
  if (!direction) {
    return undefined;
  }
  const against: LightboxNumberStandout['against'] = [];
  if (byStandards) {
    against.push('standards');
  }
  if (byWriter === direction) {
    against.push('writer');
  }
  if (stat !== 'sentence-length') {
    return { direction, against };
  }
  // In whole words: an instance is one sentence, and a sentence has a whole number of them.
  const bound = byStandards === 'above' ? range?.max : byStandards === 'below' ? range?.min : undefined;
  return { direction, against, reference: Math.round(bound ?? writer?.average ?? value) };
}

function baselineSummary(summary: LightboxWriterBaselineSummary, enough: boolean): LightboxWriterBaselineSummary {
  if (summary.kind === 'measured' && !enough) {
    return {
      kind: 'absent',
      note: `Your other chapters hold fewer than ${LIGHTBOX_BASELINE_MINIMUM_WORDS.toLocaleString('en-US')} words, too few for an average of your own.`
    };
  }
  return summary;
}

function round(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}
