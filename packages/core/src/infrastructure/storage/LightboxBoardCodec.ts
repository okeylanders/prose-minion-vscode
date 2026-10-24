/**
 * LightboxBoardCodec — a saved Lightbox board, format 1 (ADR 2026-10-19 D12
 * and its addendum of 2026-10-22; Slice 5A; epic decision 32). Pure: no
 * host, no I/O. Separate from the Workshop session codec, as transcript
 * export is.
 *
 * ```jsonc
 * { "formatVersion": 1, "kind": "lightbox-board", "savedAt": "<ISO>",
 *   "board": { "boardId", "name"?, "rules", "sources": [ { …LightboxSource, "text" } ],
 *              "paragraphs": [ { "source": 0, "index", "start", "end", … } ],
 *              "ribbon", "measured", "readings" } }
 * ```
 *
 * - **The board whole.** Every tile kind (`LightboxBoardTileCodec`), every
 *   measured layer (`LightboxBoardMeasuredCodec`), and each group's withheld
 *   claims and blocks, frictions, quote checks and stale marks. Not a
 *   webview preference.
 * - **Per lens, where its reading came from (Slice 4J).** Optional, so a
 *   file saved before it reads unchanged: each lens's provenance (the run,
 *   model and time that read it, or, for a reading from before Slice 4J,
 *   only the model its group named: PR #170 F-02), dropped and counted when
 *   it does not read, and its earlier mark (a reading the latest call did
 *   not replace, with why), read whole like a stale mark, since a dropped
 *   one would show an earlier reading as the latest.
 * - **Sources are a list, each with its text.** Paragraph numbers stay the
 *   board's own, 1 to N, so no reading changes shape; each paragraph names
 *   its source and its offsets into that source's text. A source's
 *   paragraphs are the run of board paragraphs that name it. Each source's
 *   text is checked against its content hash.
 * - **The name (Slice 5A.1).** Optional, the writer's own words for the
 *   board (`lightboxBoardName`): absent, the board is unnamed. A name is not
 *   a measurement, so no rule id moves with it. One that is not a name as a
 *   board saves one (a hand-edited file) is left out and counted, as a
 *   dropped tile is: the board opens whole, unnamed (decision 32's
 *   writer-data rule: a board is never lost over its name).
 * - **Rule ids.** `board.rules` names the rules that measured it. Any
 *   well-formed id is read and kept: a board from another build keeps its
 *   ids, for Slice 5B to label. That includes the Opinion's citation basis:
 *   an Opinion cited under another rule loads stale, with the host's reason
 *   (`lightboxOpinionStanding`). A saved board only ever loses standing,
 *   never the board (the writer-data rule, epic decision 32).
 * - **Exact keys; drops counted.** A key the codec does not read fails its
 *   object, counted, never named. A tile or a group note that fails is
 *   dropped and counted; the measured layers, the paragraph model, a group's
 *   own fields and its stale marks decode whole or the board is invalid (a
 *   dropped stale mark would show a stale reading as current). Reasons are
 *   host-owned (`LIGHTBOX_BOARD_INVALID_REASONS`); the path a fault was found
 *   at is the schema's, for the log.
 * - **No migrations.** This is the first shape. A later format follows ADR
 *   2026-07-30's release rule, with `board-v1.json` as its authentic
 *   fixture. A file in another format is refused by its number.
 */

import type {
  LightboxBoard,
  LightboxEarlierLens,
  LightboxLensFriction,
  LightboxLensProvenance,
  LightboxLensQuoteChecks,
  LightboxMeasureRules,
  LightboxParagraphMetric,
  LightboxReadingGroup,
  LightboxReadingGroupId,
  LightboxReadingStatus,
  LightboxSource,
  LightboxSourceKind,
  LightboxStaleLens,
  LightboxWithheldBlock,
  LightboxWithheldClaim,
  TokenUsage
} from '@messages';
import { LIGHTBOX_READING_GROUPS } from '@shared/constants/lightbox';
import { isSavedLightboxBoardName } from '@shared/constants/lightboxBoardName';
import { lightboxContentHash } from '@/infrastructure/lightbox/LightboxParagraphs';
import {
  Decoder,
  LightboxBoardDecodeContext,
  LightboxBoardShapeError,
  bounded,
  droppable,
  finite,
  flag,
  leftOutIfInvalid,
  list,
  literal,
  never,
  object,
  oneOf,
  optional,
  text,
  whole
} from '@/infrastructure/storage/LightboxBoardSchema';
import { LIGHTBOX_PARAGRAPH_METRIC_SHAPE, lightboxMeasuredDecoder, lightboxRibbonDecoder } from '@/infrastructure/storage/LightboxBoardMeasuredCodec';
import {
  LIGHTBOX_BOARD_LENSES,
  LIGHTBOX_BOARD_TILE_KINDS,
  lightboxTileDecoder,
  lightboxWithheldQuoteDecoder
} from '@/infrastructure/storage/LightboxBoardTileCodec';

export const LIGHTBOX_BOARD_FORMAT_VERSION = 1;
export const LIGHTBOX_BOARD_FILE_KIND = 'lightbox-board';

/** A source as a saved board holds it: the board's source, with its own text. */
export interface LightboxSavedSource extends LightboxSource {
  text: string;
}

/** A paragraph as a saved board holds it: its metrics, and which source (by index) it stands in. */
export interface LightboxSavedParagraph extends LightboxParagraphMetric {
  source: number;
}

export interface LightboxSavedBoard {
  boardId: string;
  /** The writer's name for the board (Slice 5A.1); absent, it is unnamed. */
  name?: string;
  rules: LightboxMeasureRules;
  sources: LightboxSavedSource[];
  paragraphs: LightboxSavedParagraph[];
  ribbon: LightboxBoard['ribbon'];
  measured: LightboxBoard['measured'];
  readings: LightboxReadingGroup[];
}

export interface LightboxBoardFile {
  formatVersion: typeof LIGHTBOX_BOARD_FORMAT_VERSION;
  kind: typeof LIGHTBOX_BOARD_FILE_KIND;
  /** ISO 8601, when the file was written. */
  savedAt: string;
  board: LightboxSavedBoard;
}

export type LightboxBoardInvalidReason = 'not-json' | 'not-a-board' | 'format' | 'unknown-field' | 'shape' | 'text';

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the reasons' kebab-case words. */
/** Host words for each reason a file is not read. */
export const LIGHTBOX_BOARD_INVALID_REASONS: Readonly<Record<LightboxBoardInvalidReason, string>> = {
  'not-json': 'It is not readable JSON.',
  'not-a-board': 'It is not a saved Lightbox board.',
  format: 'It was saved in a board format this version does not read.',
  'unknown-field': 'It holds fields this version does not read.',
  shape: 'Its contents do not have a saved board\'s shape.',
  text: 'Its saved text does not match the text its board was measured from.'
};
/* eslint-enable @typescript-eslint/naming-convention */

export type LightboxBoardDecoded =
  | {
      kind: 'board';
      file: LightboxBoardFile;
      /** Tiles and group notes that did not decode, left out. */
      dropped: number;
      /** Where (the schema's paths, at most ten), for the log. */
      droppedAt: string[];
    }
  | {
      kind: 'invalid';
      reason: LightboxBoardInvalidReason;
      /** The schema's path to the fault, for the log; never a key from the file. */
      at?: string;
      /** The file's own format number, when it named another. */
      formatVersion?: number;
    };

/* eslint-disable @typescript-eslint/naming-convention -- vocabularies keyed by their protocol words. */
const SOURCE_KINDS: Readonly<Record<LightboxSourceKind, true>> = { file: true, selection: true };
const GROUPS: Readonly<Record<LightboxReadingGroupId, true>> = { A: true, B: true, C: true, D: true, E: true, F: true, G: true };
/** A saved board holds no reading in flight: a board is saved only once its runs have ended. */
const SAVED_STATUSES: Readonly<Record<Exclude<LightboxReadingStatus, 'running'>, true>> = {
  'not-run': true, ok: true, failed: true, cancelled: true
};
/* eslint-enable @typescript-eslint/naming-convention */

/** A rule id: lower-case words and digits joined by hyphens. */
const ruleId: Decoder<string> = (value, at, context) => {
  const read = bounded(80)(value, at, context);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(read)) {
    throw new LightboxBoardShapeError(at, 'a rule id');
  }
  return read;
};

/** A board's name, exactly as a board saves one (`lightboxBoardName`). */
const boardName: Decoder<string> = (value, at, context) => {
  const read = text(value, at, context);
  if (!isSavedLightboxBoardName(read)) {
    throw new LightboxBoardShapeError(at, 'a board name');
  }
  return read;
};

const lens = oneOf(LIGHTBOX_BOARD_LENSES);
const tileKind = oneOf(LIGHTBOX_BOARD_TILE_KINDS);

/** An ISO 8601 time, as a reading's landing is recorded (Slice 4J). */
const instant: Decoder<string> = (value, at, context) => {
  const read = bounded(40)(value, at, context);
  if (!Number.isFinite(Date.parse(read))) {
    throw new LightboxBoardShapeError(at, 'a time');
  }
  return read;
};

/**
 * A lens's provenance (Slice 4J): a landing's run, model and time, or (a
 * reading from a board read before Slice 4J, PR #170 F-02) only the model
 * its group named, or nothing. A run without its time, or a time without
 * its run, is no shape a board writes.
 */
const provenanceEntry: Decoder<LightboxLensProvenance> = (value, at, context) => {
  const read = object<LightboxLensProvenance>({ lens, run: optional(bounded(200)), model: optional(text), at: optional(instant) })(value, at, context);
  if ((read.run === undefined) !== (read.at === undefined)) {
    throw new LightboxBoardShapeError(at, 'a run and its time together');
  }
  return read;
};

const usage = object<TokenUsage>({
  promptTokens: whole,
  completionTokens: whole,
  totalTokens: whole,
  requestCount: optional(whole),
  costUsd: optional(finite),
  isEstimate: optional(flag),
  cachedTokens: optional(whole),
  cacheWriteTokens: optional(whole)
});

const group = object<LightboxReadingGroup>({
  group: oneOf(GROUPS),
  status: oneOf(SAVED_STATUSES),
  lenses: list(lens),
  pending: optional(never('absent: a saved board holds no reading in flight')),
  model: optional(text),
  usage: optional(usage),
  tiles: droppable(lightboxTileDecoder),
  withheldBlocks: droppable(object<LightboxWithheldBlock>({ kind: tileKind, lens, reason: text })),
  withheldClaims: droppable(object<LightboxWithheldClaim>({
    kind: tileKind, lens, title: text, reason: text, quotes: list(lightboxWithheldQuoteDecoder)
  })),
  frictions: droppable(object<LightboxLensFriction>({
    lens,
    friction: text,
    setAside: optional(list(object<NonNullable<LightboxLensFriction['setAside']>[number]>({ title: text, reason: text })))
  })),
  quoteChecks: droppable(object<LightboxLensQuoteChecks>({ lens, checked: whole, withheld: whole })),
  error: optional(text),
  // Whole: a stale mark dropped would show a stale reading as current.
  staleLenses: optional(list(object<LightboxStaleLens>({ lens, readAgainst: text }))),
  // Slice 4J: where each lens's reading came from (droppable), and which are earlier ones (whole, as a stale mark is).
  provenance: optional(droppable(provenanceEntry)),
  earlierLenses: optional(list(object<LightboxEarlierLens>({ lens, reason: text })))
});

const savedSource = object<LightboxSavedSource>({
  kind: oneOf(SOURCE_KINDS),
  displayPath: text,
  sourceUri: optional(text),
  startLine: optional(whole),
  endLine: optional(whole),
  contentHash: text,
  wordCount: whole,
  paragraphCount: whole,
  capturedAt: whole,
  preview: text,
  text
});

const fileDecoder: Decoder<LightboxBoardFile> = object<LightboxBoardFile>({
  formatVersion: literal(LIGHTBOX_BOARD_FORMAT_VERSION),
  kind: literal(LIGHTBOX_BOARD_FILE_KIND),
  savedAt: text,
  board: object<LightboxSavedBoard>({
    boardId: bounded(200),
    // Writer data: a name that does not read is left out and counted, never the board.
    name: leftOutIfInvalid(boardName),
    rules: object<LightboxMeasureRules>({ paragraphs: ruleId, sentences: ruleId, dialogue: ruleId, beingVerbs: ruleId, opinionBasis: ruleId }),
    sources: list(savedSource),
    paragraphs: list(object<LightboxSavedParagraph>({ source: whole, ...LIGHTBOX_PARAGRAPH_METRIC_SHAPE })),
    ribbon: lightboxRibbonDecoder,
    measured: lightboxMeasuredDecoder,
    readings: list(group)
  })
});

/** Read a saved board's file. Never throws. */
export function decodeLightboxBoardFile(json: string): LightboxBoardDecoded {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { kind: 'invalid', reason: 'not-json' };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw) || (raw as Record<string, unknown>).kind !== LIGHTBOX_BOARD_FILE_KIND) {
    return { kind: 'invalid', reason: 'not-a-board' };
  }
  const version = (raw as Record<string, unknown>).formatVersion;
  if (version !== LIGHTBOX_BOARD_FORMAT_VERSION) {
    return { kind: 'invalid', reason: 'format', ...(Number.isSafeInteger(version) ? { formatVersion: version as number } : {}) };
  }
  // The paragraph count every measured address is held to, known before any address is read.
  const rawParagraphs = ((raw as { board?: { paragraphs?: unknown } }).board)?.paragraphs;
  const context: LightboxBoardDecodeContext = { paragraphs: Array.isArray(rawParagraphs) ? rawParagraphs.length : 0, dropped: { count: 0, at: [] } };
  let file: LightboxBoardFile;
  try {
    file = fileDecoder(raw, 'file', context);
  } catch (error) {
    if (error instanceof LightboxBoardShapeError) {
      return { kind: 'invalid', reason: error.fault === 'unknown-field' ? 'unknown-field' : 'shape', at: error.at };
    }
    throw error;
  }
  if (!Number.isFinite(Date.parse(file.savedAt))) {
    return { kind: 'invalid', reason: 'shape', at: 'file.savedAt' };
  }
  const fault = integrityFault(file.board);
  if (fault) {
    return { kind: 'invalid', ...fault };
  }
  return { kind: 'board', file, dropped: context.dropped.count, droppedAt: [...context.dropped.at] };
}

/** What the structure alone cannot say: the text, the offset table and the groups' order. */
function integrityFault(board: LightboxSavedBoard): { reason: LightboxBoardInvalidReason; at: string } | undefined {
  if (board.sources.length === 0) {
    return { reason: 'shape', at: 'file.board.sources' };
  }
  const textFault = board.sources.findIndex((source) => lightboxContentHash(source.text) !== source.contentHash);
  if (textFault >= 0) {
    return { reason: 'text', at: `file.board.sources[${textFault}].text` };
  }
  let previousSource = 0;
  for (const [position, saved] of board.paragraphs.entries()) {
    const at = `file.board.paragraphs[${position}]`;
    const source = board.sources[saved.source];
    if (saved.index !== position + 1 || !source || saved.source < previousSource || saved.start > saved.end || saved.end > source.text.length) {
      return { reason: 'shape', at };
    }
    previousSource = saved.source;
  }
  const counted = board.sources.findIndex((source, index) =>
    source.paragraphCount !== board.paragraphs.filter((saved) => saved.source === index).length);
  if (counted >= 0) {
    return { reason: 'shape', at: `file.board.sources[${counted}].paragraphCount` };
  }
  if (board.ribbon.some((column) => column.from > column.to)) {
    return { reason: 'shape', at: 'file.board.ribbon' };
  }
  if (board.readings.map((entry) => entry.group).join() !== LIGHTBOX_READING_GROUPS.join()) {
    return { reason: 'shape', at: 'file.board.readings' };
  }
  return undefined;
}

/**
 * A board and the text it was measured from, as format 1 writes them: one
 * source, every paragraph in it, and the board's name when it has one.
 * JSON with two-space indentation and a closing newline.
 */
export function encodeLightboxBoardFile(input: { board: LightboxBoard; text: string; savedAt: Date; name?: string }): string {
  return writeLightboxBoardFile(lightboxBoardFileOf(input));
}

/** The file format 1 writes for a board and its text, before it is written (a save in place builds on it, Slice 5A.2). */
export function lightboxBoardFileOf(input: { board: LightboxBoard; text: string; savedAt: Date; name?: string }): LightboxBoardFile {
  const { board, text: sourceText } = input;
  return namedLightboxBoardFile({
    formatVersion: LIGHTBOX_BOARD_FORMAT_VERSION,
    kind: LIGHTBOX_BOARD_FILE_KIND,
    savedAt: input.savedAt.toISOString(),
    board: {
      boardId: board.boardId,
      rules: board.rules,
      sources: [{ ...board.source, text: sourceText }],
      paragraphs: board.paragraphs.map((paragraph) => ({ source: 0, ...paragraph })),
      ribbon: board.ribbon,
      measured: board.measured,
      readings: board.readings
    }
  }, input.name);
}

/** A saved file as format 1 writes it, read or changed (a board renamed in place, Slice 5A.1). */
export function writeLightboxBoardFile(file: LightboxBoardFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** The file with its board named `name`, or unnamed for `undefined`; the name stands right after the board's id. */
export function namedLightboxBoardFile(file: LightboxBoardFile, name: string | undefined): LightboxBoardFile {
  const { boardId, name: _previous, ...rest } = file.board;
  return { ...file, board: { boardId, ...(name !== undefined ? { name } : {}), ...rest } };
}

export type LightboxBoardOfFile =
  | { kind: 'board'; board: LightboxBoard; text: string; name?: string }
  /** The file holds several sources; this build opens one-source boards only. */
  | { kind: 'several-sources'; sources: number };

/** The board a file holds, as the host keeps it: one source, its paragraphs, and their text. */
export function lightboxBoardOfFile(file: LightboxBoardFile): LightboxBoardOfFile {
  const { board } = file;
  if (board.sources.length !== 1) {
    return { kind: 'several-sources', sources: board.sources.length };
  }
  const { text: sourceText, ...source } = board.sources[0];
  return {
    kind: 'board',
    text: sourceText,
    ...(board.name !== undefined ? { name: board.name } : {}),
    board: {
      boardVersion: 1,
      boardId: board.boardId,
      rules: board.rules,
      source,
      paragraphs: board.paragraphs.map(({ source: _source, ...metric }) => metric),
      ribbon: board.ribbon,
      measured: board.measured,
      readings: board.readings
    }
  };
}
