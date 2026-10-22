/**
 * The saved board's measured layers (ADR 2026-10-19 D12 addendum; Slice
 * 5A): the paragraph model's metrics, the ribbon and the measured set, each
 * read whole. A measured layer is host-computed from the board's own text,
 * so a fault anywhere in it invalidates the board: dropping a part would
 * leave figures that no longer agree (a hapax list shorter than its count).
 * Paragraph addresses here are the board's own, 1 to its paragraph count.
 * Pure: no host, no I/O.
 */

import type {
  LightboxCountedTerm,
  LightboxHapaxWord,
  LightboxHeadlineStats,
  LightboxMeasuredSet,
  LightboxNumberRow,
  LightboxNumberStatId,
  LightboxNumbersMeasure,
  LightboxParagraphMetric,
  LightboxPartsOfSpeech,
  LightboxPublishingFormat,
  LightboxRibbonColumn,
  LightboxSection,
  LightboxSectionSignal,
  LightboxSectionsMeasure,
  LightboxSentenceSummary,
  LightboxStandardsComparison,
  LightboxStandardsItem,
  LightboxStandardsStatus,
  LightboxStandoutBasis,
  LightboxStandoutDirection,
  LightboxSteeringConstruction,
  LightboxSteeringCount,
  LightboxSteeringFigure,
  LightboxSteeringMeasure,
  LightboxSteeringStatId,
  LightboxStyleFlag,
  LightboxStyleFlagId,
  LightboxWriterBaselineSummary
} from '@messages';
import {
  Decoder,
  Shape,
  either,
  figureOrWord,
  finite,
  flag,
  keyed,
  list,
  literal,
  nullable,
  object,
  oneOf,
  optional,
  paragraph,
  text,
  whole
} from '@/infrastructure/storage/LightboxBoardSchema';

/* eslint-disable @typescript-eslint/naming-convention -- vocabularies keyed by their kebab-case protocol words. */
const STANDARDS_STATUSES: Readonly<Record<LightboxStandardsStatus, true>> = { below: true, within: true, above: true, 'n/a': true };
const RANGE_STATUSES: Readonly<Record<'below' | 'within' | 'above', true>> = { below: true, within: true, above: true };
const STYLE_FLAG_IDS: Readonly<Record<LightboxStyleFlagId, true>> = { adverbs: true, 'passive-voice': true, 'weak-verbs': true, 'filler-words': true };
const NUMBER_STATS: Readonly<Record<LightboxNumberStatId, true>> = {
  'sentence-length': true, dialogue: true, 'passive-voice': true, 'being-verbs': true, adverbs: true, intensifiers: true
};
const STEERING_STATS: Readonly<Record<LightboxSteeringStatId, true>> = { 'being-verbs': true, adverbs: true, intensifiers: true };
const DIRECTIONS: Readonly<Record<LightboxStandoutDirection, true>> = { above: true, below: true };
const BASES: Readonly<Record<LightboxStandoutBasis, true>> = { standards: true, writer: true };
const BASELINE_GROUPS: Readonly<Record<'chapters' | 'manuscript', true>> = { chapters: true, manuscript: true };
const SECTION_SIGNALS: Readonly<Record<LightboxSectionSignal, true>> = { headings: true, 'scene-breaks': true, 'chapter-lines': true };
const SIGNALS_OR_NONE: Readonly<Record<LightboxSectionSignal | 'none', true>> = { ...SECTION_SIGNALS, none: true };
const CONSTRUCTIONS: Readonly<Record<LightboxSteeringConstruction, true>> = {
  expletive: true, progressive: true, passive: true, adjective: true, 'dialogue-tag': true, 'before-adjective': true,
  'with-verb': true, 'before-adverb': true, generic: true, 'before-modifier': true, other: true
};
/* eslint-enable @typescript-eslint/naming-convention */

/** One paragraph's metrics as the board measured them; the codec adds the source it stands in. */
export const LIGHTBOX_PARAGRAPH_METRIC_SHAPE: Shape<LightboxParagraphMetric> = {
  index: paragraph,
  start: whole,
  end: whole,
  words: whole,
  sentences: whole,
  avgWordsPerSentence: finite,
  dialogueWords: whole,
  dialogueShare: finite,
  sentenceWords: list(whole)
};

export const lightboxRibbonDecoder: Decoder<LightboxRibbonColumn[]> = list(object<LightboxRibbonColumn>({
  from: paragraph,
  to: paragraph,
  avgWordsPerSentence: finite,
  dialogueShare: finite
}));

const countedTerm = object<LightboxCountedTerm>({ term: text, count: whole, percentage: finite, paragraphs: list(paragraph) });

const headline = object<LightboxHeadlineStats>({
  wordCount: whole,
  sentenceCount: whole,
  paragraphCount: whole,
  averageWordsPerSentence: finite,
  averageSentencesPerParagraph: finite,
  dialoguePercentage: finite,
  lexicalDensity: finite,
  readabilityScore: finite,
  readabilityGrade: optional(finite),
  pacing: text,
  readingTimeMinutes: finite,
  uniqueWordCount: whole,
  hapaxCount: whole,
  hapaxPercent: finite,
  vocabularyDiversity: finite
});

const range = object<{ min?: number; max?: number }>({ min: optional(finite), max: optional(finite) });

const standards = object<LightboxStandardsComparison>({
  items: list(object<LightboxStandardsItem>({
    key: text,
    label: text,
    value: figureOrWord,
    standard: optional(range),
    status: oneOf(STANDARDS_STATUSES)
  })),
  publishingFormat: optional(object<LightboxPublishingFormat>({
    trimLabel: text,
    wordsPerPage: finite,
    estimatedPageCount: finite,
    pageCountRange: optional(range),
    status: oneOf(STANDARDS_STATUSES)
  }))
});

const partsOfSpeech = object<LightboxPartsOfSpeech>({
  available: flag,
  nouns: list(countedTerm),
  verbs: list(countedTerm),
  adjectives: list(countedTerm),
  adverbs: list(countedTerm)
});

const styleFlag = object<LightboxStyleFlag>({
  type: text,
  count: whole,
  examples: list(text),
  id: optional(oneOf(STYLE_FLAG_IDS)),
  paragraphs: list(paragraph)
});

const hapaxWord = object<LightboxHapaxWord>({ term: text, written: text, paragraph });

const sentences = object<LightboxSentenceSummary>({
  longest: nullable(object<{ words: number; paragraph: number }>({ words: whole, paragraph })),
  veryShort: whole,
  underWords: whole
});

const numberRow = object<LightboxNumberRow>({
  stat: oneOf(NUMBER_STATS),
  label: text,
  unit: text,
  value: finite,
  instances: whole,
  instanceLabel: text,
  paragraphs: list(paragraph),
  range: optional(object<NonNullable<LightboxNumberRow['range']>>({
    min: optional(finite),
    max: optional(finite),
    status: oneOf(RANGE_STATUSES)
  })),
  writer: optional(object<NonNullable<LightboxNumberRow['writer']>>({ average: finite, ratio: optional(finite) })),
  standout: optional(object<NonNullable<LightboxNumberRow['standout']>>({
    direction: oneOf(DIRECTIONS),
    against: list(oneOf(BASES)),
    reference: optional(finite)
  })),
  top: optional(list(object<{ term: string; count: number }>({ term: text, count: whole })))
});

type MeasuredBaseline = Extract<LightboxWriterBaselineSummary, { kind: 'measured' }>;
type AbsentBaseline = Extract<LightboxWriterBaselineSummary, { kind: 'absent' }>;

const baseline: Decoder<LightboxWriterBaselineSummary> = either<MeasuredBaseline, AbsentBaseline>('kind', {
  measured: object<MeasuredBaseline>({ kind: literal('measured'), group: oneOf(BASELINE_GROUPS), files: whole, words: whole, capped: flag }),
  absent: object<AbsentBaseline>({ kind: literal('absent'), note: text })
});

const numbers = object<LightboxNumbersMeasure>({ rows: list(numberRow), baseline });

const sections = object<LightboxSectionsMeasure>({
  signal: oneOf(SIGNALS_OR_NONE),
  level: optional(whole),
  sections: list(object<LightboxSection>({ from: paragraph, to: paragraph, label: text, marker: optional(paragraph) })),
  fired: keyed(SECTION_SIGNALS, list(paragraph))
});

const steering = object<LightboxSteeringMeasure>({
  figures: list(object<LightboxSteeringFigure>({
    stat: oneOf(STEERING_STATS),
    total: whole,
    rate: finite,
    narration: whole,
    dialogue: whole,
    constructions: list(object<LightboxSteeringCount>({ construction: oneOf(CONSTRUCTIONS), count: whole, paragraphs: list(paragraph) })),
    weakVerbs: optional(whole),
    inShortRuns: whole,
    paragraphs: list(paragraph)
  })),
  shortRun: object<LightboxSteeringMeasure['shortRun']>({ sentences: whole, maxWords: whole }),
  tagged: flag
});

/** The measured set, whole. */
export const lightboxMeasuredDecoder: Decoder<LightboxMeasuredSet> = object<LightboxMeasuredSet>({
  headline,
  standards: optional(standards),
  topWords: list(countedTerm),
  partsOfSpeech,
  phrases: object<LightboxMeasuredSet['phrases']>({ bigrams: list(countedTerm), trigrams: list(countedTerm) }),
  styleFlags: list(styleFlag),
  hapax: list(hapaxWord),
  sentences,
  numbers,
  sections,
  steering
});
