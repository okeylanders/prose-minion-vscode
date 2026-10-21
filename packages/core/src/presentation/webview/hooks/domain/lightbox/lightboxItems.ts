/**
 * Lightbox board items (ADR 2026-10-19 D4): what can be hovered or pinned on
 * the board, and which paragraphs each one touches. Pure: no React, no
 * transport.
 *
 * An item is named by a small serializable reference, so the pinned item
 * survives a webview reload (it is a UI preference, D12) and still resolves
 * after the board is rebuilt from changed text, or quietly resolves to
 * nothing if the word is gone. Every count shown here was computed by the
 * host; the lanes only select paragraphs from the host's metrics. A reading
 * tile is named by its host-minted id, which is unique per run, so a pin
 * from an earlier reading resolves to nothing rather than to a newer one. A
 * spark the writer set aside is not an item until it is brought back.
 */

import type {
  LightboxBoard,
  LightboxCountedSupport,
  LightboxCountedTerm,
  LightboxNumberStatId,
  LightboxParagraphMetric,
  LightboxReadingTile,
  LightboxRegister
} from '@messages';
import {
  LIGHTBOX_TILE_KIND_LABELS,
  LIGHTBOX_TILE_REGISTER,
  formatLightboxFigure,
  isLightboxNumberStat,
  lightboxLensLabel
} from '@shared/constants/lightbox';
import { findLightboxTile, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { lightboxPressureCounts } from '@shared/constants/lightboxPlot';
import { lightboxIsSetAside } from '@hooks/domain/lightbox/lightboxSparks';
import { lightboxSectionsNote } from '@hooks/domain/lightbox/lightboxPlot';
import { lightboxObservationItem } from '@hooks/domain/lightbox/lightboxOpinion';
import {
  lightboxSteeringItem,
  lightboxSteeringRefKey,
  parseLightboxSteeringRef,
  type LightboxSteeringRef
} from '@hooks/domain/lightbox/lightboxSteering';

export type LightboxPartOfSpeech = 'nouns' | 'verbs' | 'adjectives' | 'adverbs';

/** The measured ribbon lanes (Sections: Slice 4C). Tension is read, and arrives with the readings. */
export type LightboxMeasuredLane = 'rhythm' | 'dialogue' | 'sections';

export type LightboxItemRef =
  | { kind: 'word'; word: string }
  | { kind: 'pos'; pos: LightboxPartOfSpeech; word: string }
  | { kind: 'phrase'; phrase: string }
  | { kind: 'lane'; lane: LightboxMeasuredLane }
  | { kind: 'paragraphs'; from: number; to: number }
  | { kind: 'reading'; tileId: string }
  /** A measured figure on the numbers tile (Slice 4B): it lights the paragraphs holding an instance. */
  | { kind: 'standout'; stat: LightboxNumberStatId }
  /** A measured section (Slice 4C), by its place on the board's Sections lane, from 1. */
  | { kind: 'section'; index: number }
  /** The Pressure lane (Slice 4C): where the threads read stand open, counted by code. */
  | { kind: 'pressure' }
  /** One of the Opinion's observations (Slice 4D), by the tile's host id and the observation's id: it lights what it cites. */
  | { kind: 'observation'; tileId: string; observation: string }
  /** A craft steering figure's measured counts, or one construction of them (Slice 4F): it lights the paragraphs holding them. */
  | LightboxSteeringRef;

export interface LightboxResolvedItem {
  ref: LightboxItemRef;
  register: LightboxRegister;
  /** Lens and kind, e.g. "Measure · Word". */
  where: string;
  title: string;
  claim: string;
  /** 1-based, ascending. */
  paragraphs: number[];
  /** Counted-by-code facts, e.g. "basement ×15". */
  support: string[];
  /** The reading behind a read or counted-read item. */
  reading?: LightboxReadingTile;
}

/**
 * The rhythm lane lights the paragraphs that "run long": words per sentence at
 * or above this multiple of the text's average.
 */
export const LIGHTBOX_LONG_RUN_FACTOR = 1.5;

const POS_LABELS: Record<LightboxPartOfSpeech, string> = {
  nouns: 'Noun',
  verbs: 'Verb',
  adjectives: 'Adjective',
  adverbs: 'Adverb'
};

const PARTS_OF_SPEECH: readonly LightboxPartOfSpeech[] = ['nouns', 'verbs', 'adjectives', 'adverbs'];

/** A stable identity for comparing references. */
export function lightboxItemKey(ref: LightboxItemRef): string {
  switch (ref.kind) {
    case 'word':
      return `word:${ref.word}`;
    case 'pos':
      return `pos:${ref.pos}:${ref.word}`;
    case 'phrase':
      return `phrase:${ref.phrase}`;
    case 'lane':
      return `lane:${ref.lane}`;
    case 'paragraphs':
      return `paragraphs:${ref.from}-${ref.to}`;
    case 'reading':
      return `reading:${ref.tileId}`;
    case 'standout':
      return `standout:${ref.stat}`;
    case 'section':
      return `section:${ref.index}`;
    case 'pressure':
      return 'pressure';
    case 'observation':
      return `observation:${ref.tileId}:${ref.observation}`;
    case 'steering':
      return lightboxSteeringRefKey(ref);
  }
}

export function sameLightboxItem(a: LightboxItemRef | null, b: LightboxItemRef | null): boolean {
  return a !== null && b !== null && lightboxItemKey(a) === lightboxItemKey(b);
}

/** Restore a persisted reference; anything malformed is no reference. */
export function parseLightboxItemRef(value: unknown): LightboxItemRef | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const text = (key: string): string | undefined =>
    typeof record[key] === 'string' && (record[key] as string).length > 0 ? (record[key] as string) : undefined;
  const index = (key: string): number | undefined =>
    Number.isInteger(record[key]) && (record[key] as number) >= 1 ? (record[key] as number) : undefined;

  switch (record.kind) {
    case 'word': {
      const word = text('word');
      return word ? { kind: 'word', word } : null;
    }
    case 'pos': {
      const word = text('word');
      const pos = PARTS_OF_SPEECH.find((candidate) => candidate === record.pos);
      return word && pos ? { kind: 'pos', pos, word } : null;
    }
    case 'phrase': {
      const phrase = text('phrase');
      return phrase ? { kind: 'phrase', phrase } : null;
    }
    case 'lane':
      return record.lane === 'rhythm' || record.lane === 'dialogue' || record.lane === 'sections'
        ? { kind: 'lane', lane: record.lane }
        : null;
    case 'section': {
      const sectionIndex = index('index');
      return sectionIndex !== undefined ? { kind: 'section', index: sectionIndex } : null;
    }
    case 'pressure':
      return { kind: 'pressure' };
    case 'paragraphs': {
      const from = index('from');
      const to = index('to');
      return from !== undefined && to !== undefined && from <= to ? { kind: 'paragraphs', from, to } : null;
    }
    case 'reading': {
      const tileId = text('tileId');
      return tileId ? { kind: 'reading', tileId } : null;
    }
    case 'standout':
      return isLightboxNumberStat(record.stat) ? { kind: 'standout', stat: record.stat } : null;
    case 'observation': {
      const tileId = text('tileId');
      const observation = text('observation');
      return tileId && observation && /^O[1-6]$/.test(observation) ? { kind: 'observation', tileId, observation } : null;
    }
    case 'steering':
      return parseLightboxSteeringRef(record);
    default:
      return null;
  }
}

/** What a reference means on this board, or undefined when the board no longer has it. */
export function resolveLightboxItem(
  board: LightboxBoard,
  ref: LightboxItemRef
): LightboxResolvedItem | undefined {
  switch (ref.kind) {
    case 'word': {
      const term = board.measured.topWords.find((candidate) => candidate.term === ref.word);
      return term ? termItem(ref, term, 'Word') : undefined;
    }
    case 'pos': {
      const term = board.measured.partsOfSpeech[ref.pos].find((candidate) => candidate.term === ref.word);
      return term ? termItem(ref, term, POS_LABELS[ref.pos]) : undefined;
    }
    case 'phrase': {
      const { bigrams, trigrams } = board.measured.phrases;
      const term = [...bigrams, ...trigrams].find((candidate) => candidate.term === ref.phrase);
      return term ? termItem(ref, term, 'Repeated phrase', `“${term.term}”`) : undefined;
    }
    case 'lane':
      return ref.lane === 'rhythm' ? rhythmLane(board) : ref.lane === 'dialogue' ? dialogueLane(board) : sectionsLane(board);
    case 'section':
      return sectionItem(board, ref.index);
    case 'pressure':
      return pressureItem(board);
    case 'paragraphs':
      return paragraphsItem(board, ref);
    case 'reading': {
      const tile = findLightboxTile(board, ref.tileId);
      return tile && !lightboxIsSetAside(tile) ? readingItem(ref, tile) : undefined;
    }
    case 'standout':
      return standoutItem(board, ref);
    case 'steering':
      return lightboxSteeringItem(board, ref);
    case 'observation': {
      const observation = lightboxObservationItem(board, ref.tileId, ref.observation);
      return observation
        ? {
            ref,
            register: 'read',
            where: `Opinion · Observation ${ref.observation}`,
            title: observation.text,
            // What it stands on, by the board's own names; nothing here is counted.
            claim: `Cites ${observation.cites.join('; ')}.`,
            paragraphs: observation.paragraphs,
            support: [],
            reading: observation.tile
          }
        : undefined;
    }
  }
}

/** A measured figure: what it is, against what, and the paragraphs holding an instance of it. */
function standoutItem(board: LightboxBoard, ref: Extract<LightboxItemRef, { kind: 'standout' }>): LightboxResolvedItem | undefined {
  const row = board.measured.numbers.rows.find((candidate) => candidate.stat === ref.stat);
  if (!row) {
    return undefined;
  }
  const against = [
    ...(row.writer ? [`your average ${formatLightboxFigure(row.writer.average)}`] : []),
    ...(row.range ? [`the preset's ${row.range.min ?? '…'}–${row.range.max ?? '…'}`] : [])
  ];
  return {
    ref,
    register: 'measured',
    where: 'Measure · The numbers',
    title: row.label,
    claim:
      `${formatLightboxFigure(row.value)} ${row.unit}` + (against.length > 0 ? `, against ${against.join(' and ')}` : '') + '. ' +
      (row.standout
        ? `It stands out ${row.standout.direction}; ${paragraphCountLabel(row.paragraphs.length)} hold ${row.instanceLabel}, lit here.`
        : 'It does not stand out.') +
      ' Counted by code; nothing here is a reading.',
    paragraphs: [...row.paragraphs],
    support: [`${formatLightboxFigure(row.value)} ${row.unit}`, ...(row.instances > 0 ? [`${row.instances} ${row.instanceLabel}`] : [])]
  };
}

/** The measured items whose paragraphs include `index`, for "Also in this paragraph". */
export function lightboxItemsTouching(board: LightboxBoard, index: number): LightboxResolvedItem[] {
  const touching: LightboxResolvedItem[] = [];
  for (const term of board.measured.topWords) {
    if (term.paragraphs.includes(index)) {
      touching.push(termItem({ kind: 'word', word: term.term }, term, 'Word'));
    }
  }
  for (const term of [...board.measured.phrases.bigrams, ...board.measured.phrases.trigrams]) {
    if (term.paragraphs.includes(index)) {
      touching.push(termItem({ kind: 'phrase', phrase: term.term }, term, 'Repeated phrase', `“${term.term}”`));
    }
  }
  for (const group of board.readings) {
    for (const tile of group.tiles) {
      if (tile.paragraphs.includes(index) && !lightboxIsSetAside(tile)) {
        touching.push(readingItem({ kind: 'reading', tileId: tile.id }, tile));
      }
    }
  }
  return touching;
}

function readingItem(ref: LightboxItemRef, tile: LightboxReadingTile): LightboxResolvedItem {
  return {
    ref,
    register: LIGHTBOX_TILE_REGISTER[tile.kind],
    where: `${lightboxLensLabel(tile.lens)} · ${LIGHTBOX_TILE_KIND_LABELS[tile.kind]}`,
    title: tile.title,
    claim: tile.claim,
    paragraphs: [...tile.paragraphs],
    support: tile.support.map(supportLabel),
    reading: tile
  };
}

/** "rabbit ×4", or a named term the chapter does not hold. */
export function supportLabel(term: LightboxCountedSupport): string {
  return term.count > 0 ? `${term.term} ×${term.count}` : `${term.term} · not in the chapter`;
}

function termItem(
  ref: LightboxItemRef,
  term: LightboxCountedTerm,
  kindLabel: string,
  title = term.term
): LightboxResolvedItem {
  const places = term.paragraphs.length;
  return {
    ref,
    register: 'measured',
    where: `Measure · ${kindLabel}`,
    title,
    claim:
      `Appears ${timesLabel(term.count)}` +
      (places > 0 ? ` across ${paragraphCountLabel(places)}` : '') +
      '. Counted by code; nothing here is a reading.',
    paragraphs: [...term.paragraphs],
    support: [`${term.term} ×${term.count}`, `${term.percentage}% of words`]
  };
}

/** The Sections lane (Slice 4C): what code found, lighting the paragraphs that open a section. */
function sectionsLane(board: LightboxBoard): LightboxResolvedItem {
  const measure = board.measured.sections;
  return {
    ref: { kind: 'lane', lane: 'sections' },
    register: 'measured',
    where: 'Measure · Lane',
    title: 'Sections',
    claim: `${lightboxSectionsNote(measure)} Detected by code from headings, scene breaks and chapter lines; nothing here is a reading.`,
    paragraphs: measure.sections.flatMap((section) => (section.marker !== undefined ? [section.marker] : [])),
    support: [
      `${measure.fired.headings.length} headings`,
      `${measure.fired['scene-breaks'].length} scene breaks`,
      `${measure.fired['chapter-lines'].length} chapter lines`
    ]
  };
}

/** One measured section: its paragraphs, and the marker that opens it. */
function sectionItem(board: LightboxBoard, index: number): LightboxResolvedItem | undefined {
  const section = board.measured.sections.sections[index - 1];
  if (!section) {
    return undefined;
  }
  const opened = section.marker !== undefined ? `opened in ¶${section.marker}` : 'before the first marker';
  return {
    ref: { kind: 'section', index },
    register: 'measured',
    where: 'Measure · Section',
    title: section.label,
    claim: `¶${section.from}–¶${section.to}, ${opened}. Found by code; nothing here is a reading.`,
    paragraphs: Array.from({ length: section.to - section.from + 1 }, (_unused, offset) => section.from + offset),
    support: [paragraphCountLabel(section.to - section.from + 1)]
  };
}

/** The Pressure lane: the paragraphs any drawn thread stands open across, and the host's counts. */
function pressureItem(board: LightboxBoard): LightboxResolvedItem | undefined {
  const threads = lightboxTilesOfKind(board, 'pressure-thread');
  if (threads.length === 0) {
    return undefined;
  }
  const counts = lightboxPressureCounts(threads);
  const open = new Set<number>();
  for (const thread of threads) {
    const end = thread.resolution ? thread.resolution.paragraph - 1 : thread.span.to;
    for (let index = thread.planted.paragraph; index <= end; index++) {
      open.add(index);
    }
  }
  return {
    ref: { kind: 'pressure' },
    register: 'counted-read',
    where: 'Pressure · Lane',
    title: 'Open threads',
    claim: `${counts.threads} threads · ${counts.resolved} resolved here · ${counts.carriedOut} carried out of the chapter · ` +
      `${counts.dormant} dormant. Counted by code from the threads read; lit where any stands open.`,
    paragraphs: [...open].sort((a, b) => a - b),
    support: [`${counts.threads} threads`, `${counts.carriedOut} carried out`]
  };
}

function rhythmLane(board: LightboxBoard): LightboxResolvedItem {
  const average = board.measured.headline.averageWordsPerSentence;
  const threshold = Math.round(average * LIGHTBOX_LONG_RUN_FACTOR * 10) / 10;
  const longRuns = board.paragraphs
    .filter((paragraph) => paragraph.sentences > 0 && average > 0 && paragraph.avgWordsPerSentence >= threshold)
    .map((paragraph) => paragraph.index);
  return {
    ref: { kind: 'lane', lane: 'rhythm' },
    register: 'measured',
    where: 'Measure · Lane',
    title: 'Sentence rhythm',
    claim:
      `Average words per sentence in each paragraph. The text averages ${average}; ` +
      (longRuns.length === 0
        ? `no paragraph runs at ${threshold} or longer.`
        : `${paragraphCountLabel(longRuns.length)} run at ${threshold} or longer, lit here.`),
    paragraphs: longRuns,
    support: [`avg ${average} words / sentence`, `pacing: ${board.measured.headline.pacing}`]
  };
}

function dialogueLane(board: LightboxBoard): LightboxResolvedItem {
  const withDialogue = board.paragraphs
    .filter((paragraph) => paragraph.dialogueWords > 0)
    .map((paragraph) => paragraph.index);
  const overall = board.measured.headline.dialoguePercentage;
  const standard = board.measured.standards?.items.find((item) => item.key === 'dialogue_percentage')?.standard;
  const range = standard && standard.min !== undefined && standard.max !== undefined
    ? `, against a standard of ${standard.min}–${standard.max}%`
    : '';
  return {
    ref: { kind: 'lane', lane: 'dialogue' },
    register: 'measured',
    where: 'Measure · Lane',
    title: 'Dialogue share',
    claim:
      `Share of each paragraph inside double quotation marks. ${withDialogue.length} of ` +
      `${board.paragraphs.length} paragraphs carry dialogue; ${overall}% overall${range}.`,
    paragraphs: withDialogue,
    support: [`${overall}% dialogue`, `${withDialogue.length} ¶ with dialogue`]
  };
}

function paragraphsItem(
  board: LightboxBoard,
  ref: Extract<LightboxItemRef, { kind: 'paragraphs' }>
): LightboxResolvedItem | undefined {
  const span = board.paragraphs.filter((paragraph) => paragraph.index >= ref.from && paragraph.index <= ref.to);
  if (span.length === 0) {
    return undefined;
  }
  const totals = pooled(span);
  const single = span.length === 1;
  return {
    ref,
    register: 'measured',
    where: single ? 'Chapter · Paragraph' : 'Chapter · Paragraphs',
    title: single ? `¶${ref.from}` : `¶${ref.from}–¶${ref.to}`,
    claim:
      `${totals.words.toLocaleString('en-US')} words in ${totals.sentences} ` +
      `${totals.sentences === 1 ? 'sentence' : 'sentences'} · ${totals.rhythm} words per sentence · ` +
      `${Math.round(totals.dialogueShare * 100)}% dialogue.`,
    paragraphs: span.map((paragraph) => paragraph.index),
    support: [`rhythm ${totals.rhythm}`, `dialogue ${Math.round(totals.dialogueShare * 100)}%`]
  };
}

function pooled(span: readonly LightboxParagraphMetric[]): {
  words: number;
  sentences: number;
  rhythm: number;
  dialogueShare: number;
} {
  const words = span.reduce((sum, paragraph) => sum + paragraph.words, 0);
  const sentences = span.reduce((sum, paragraph) => sum + paragraph.sentences, 0);
  const dialogueWords = span.reduce((sum, paragraph) => sum + paragraph.dialogueWords, 0);
  return {
    words,
    sentences,
    rhythm: sentences > 0 ? Math.round((words / sentences) * 10) / 10 : 0,
    dialogueShare: words > 0 ? dialogueWords / words : 0
  };
}

function timesLabel(count: number): string {
  return count === 1 ? 'once' : `${count.toLocaleString('en-US')} times`;
}

export function paragraphCountLabel(count: number): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'paragraph' : 'paragraphs'}`;
}
