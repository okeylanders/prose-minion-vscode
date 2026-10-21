/**
 * Lightbox passages (Slice 4E; ADR 2026-10-19 D4, D10, D12): the text the
 * board counted, as the inspector asks for it.
 *
 * The board carries counts and paragraph addresses, never paragraph text.
 * When the writer pins a paragraph, or a counted item, the inspector asks the
 * host for the text that item stands in:
 * - a paragraph range: each paragraph's whole text, with the instances of the
 *   term the writer came from (`via`) lit;
 * - a counted term: every sentence holding an instance of it, the instances
 *   lit.
 *
 * Every instance is found by the rule that made the term's count on the
 * board (`LightboxInstances`), so the instances lit equal the count shown.
 *
 * **Correlation.** The webview mints `requestId`; the host echoes it with
 * the board id and content hash it answered from, and the webview takes only
 * the reply it still waits for, about the board it shows. A reply for an
 * older board or other text is never shown as the current passage. Nothing
 * here is persisted: the text stays in the webview's memory while pinned.
 */

import { MessageEnvelope, MessageType } from './base';
import type { LightboxPartsOfSpeech, LightboxStyleFlagId } from './lightbox';

/** A part-of-speech list on the board. */
export type LightboxPassagePartOfSpeech = Exclude<keyof LightboxPartsOfSpeech, 'available'>;

/**
 * A counted item whose instances the host can find, named as the board
 * names it. The webview's item references use the same shapes.
 */
export type LightboxPassageTerm =
  /** A top word (`measured.topWords`). */
  | { kind: 'word'; word: string }
  /** A word on a part-of-speech list. */
  | { kind: 'pos'; pos: LightboxPassagePartOfSpeech; word: string }
  /** A repeated phrase (`measured.phrases`). */
  | { kind: 'phrase'; phrase: string }
  /** A word used once (`measured.hapax`), by its counted form. */
  | { kind: 'hapax'; word: string }
  /** A style flag that counts instances. */
  | { kind: 'flag'; flag: LightboxStyleFlagId };

/** What the inspector asks for. Paragraph numbers are 1-based and inclusive. */
export type LightboxPassageItem =
  /** The paragraphs' text; with `via`, that term's instances in them lit. */
  | { kind: 'paragraphs'; from: number; to: number; via?: LightboxPassageTerm }
  /** Every sentence holding an instance of the term. */
  | { kind: 'instances'; term: LightboxPassageTerm };

export interface LightboxRequestPassagePayload {
  /** Webview-minted; echoed on the reply. A request without one is ignored. */
  requestId: string;
  /** The board on screen, and the text it was built from. */
  boardId: string;
  contentHash: string;
  item: LightboxPassageItem;
}

export interface LightboxRequestPassageMessage extends MessageEnvelope<LightboxRequestPassagePayload> {
  type: MessageType.LIGHTBOX_REQUEST_PASSAGE;
}

/** A stretch of text as the chapter has it. */
export interface LightboxPassageSegment {
  text: string;
  /**
   * The instances this stretch is part of, numbered from 0 in text order;
   * absent when it is not lit. Two can share a stretch where a repeated
   * phrase overlaps itself ("had had had").
   */
  instances?: number[];
}

/** One paragraph's whole text. */
export interface LightboxPassageParagraph {
  index: number;
  segments: LightboxPassageSegment[];
}

/** One sentence: the paragraph's own sentence rule, numbered from 1 within it. */
export interface LightboxPassageSentence {
  paragraph: number;
  sentence: number;
  segments: LightboxPassageSegment[];
}

/**
 * One row of the sentences well: a sentence, or the consecutive sentences an
 * instance runs across (a phrase over a sentence or paragraph break).
 */
export interface LightboxPassageRow {
  sentences: LightboxPassageSentence[];
}

export interface LightboxParagraphsPassage {
  kind: 'paragraphs';
  /** The range's first paragraphs, up to `LIGHTBOX_PASSAGE_BOUNDS.paragraphs`. */
  paragraphs: LightboxPassageParagraph[];
  /** The range's paragraphs past the bound, not sent. */
  moreParagraphs: number;
  /** With `via`: how many of the term's instances touch the paragraphs sent, each lit. */
  lit?: number;
}

export interface LightboxInstancesPassage {
  kind: 'instances';
  /** Every instance found, by the rule that made the term's count. */
  instances: number;
  /** Distinct sentences holding one. */
  sentences: number;
  /** In text order, up to `LIGHTBOX_PASSAGE_BOUNDS.rows`. */
  rows: LightboxPassageRow[];
  /** What lies past the bound and was not sent. */
  more: { rows: number; sentences: number; instances: number };
}

/**
 * Why there is no passage.
 * - `changed`: the board named is no longer held, or holds other text.
 * - `not-on-board`: the paragraphs or the term are not on that board.
 */
export type LightboxPassageRefusal = 'changed' | 'not-on-board';

export interface LightboxRefusedPassage {
  kind: 'refused';
  reason: LightboxPassageRefusal;
}

export type LightboxPassage = LightboxParagraphsPassage | LightboxInstancesPassage | LightboxRefusedPassage;

export interface LightboxPassagePayload {
  requestId: string;
  /** What the request named, echoed, so the webview checks it is still the board on screen. */
  boardId: string;
  contentHash: string;
  passage: LightboxPassage;
}

export interface LightboxPassageMessage extends MessageEnvelope<LightboxPassagePayload> {
  type: MessageType.LIGHTBOX_PASSAGE;
}
