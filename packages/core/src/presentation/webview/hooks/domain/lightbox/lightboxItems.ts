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
 * from an earlier reading resolves to nothing rather than to a newer one.
 */

import type {
  LightboxBoard,
  LightboxCountedSupport,
  LightboxCountedTerm,
  LightboxParagraphMetric,
  LightboxReadingTile,
  LightboxRegister
} from '@messages';
import {
  LIGHTBOX_TILE_KIND_LABELS,
  LIGHTBOX_TILE_REGISTER,
  lightboxLensLabel
} from '@shared/constants/lightbox';
import { findLightboxTile } from '@hooks/domain/lightbox/lightboxReadings';

export type LightboxPartOfSpeech = 'nouns' | 'verbs' | 'adjectives' | 'adverbs';

/** The measured ribbon lanes. Tension is read, and arrives with the readings. */
export type LightboxMeasuredLane = 'rhythm' | 'dialogue';

export type LightboxItemRef =
  | { kind: 'word'; word: string }
  | { kind: 'pos'; pos: LightboxPartOfSpeech; word: string }
  | { kind: 'phrase'; phrase: string }
  | { kind: 'lane'; lane: LightboxMeasuredLane }
  | { kind: 'paragraphs'; from: number; to: number }
  | { kind: 'reading'; tileId: string };

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
      return record.lane === 'rhythm' || record.lane === 'dialogue'
        ? { kind: 'lane', lane: record.lane }
        : null;
    case 'paragraphs': {
      const from = index('from');
      const to = index('to');
      return from !== undefined && to !== undefined && from <= to ? { kind: 'paragraphs', from, to } : null;
    }
    case 'reading': {
      const tileId = text('tileId');
      return tileId ? { kind: 'reading', tileId } : null;
    }
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
      return ref.lane === 'rhythm' ? rhythmLane(board) : dialogueLane(board);
    case 'paragraphs':
      return paragraphsItem(board, ref);
    case 'reading': {
      const tile = findLightboxTile(board, ref.tileId);
      return tile ? readingItem(ref, tile) : undefined;
    }
  }
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
      if (tile.paragraphs.includes(index)) {
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
