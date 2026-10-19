/**
 * LightboxService — builds and keeps Lightbox boards (ADR 2026-10-19 D4, D5,
 * D8, D12).
 *
 * Built once at the composition root and carried in `CoreServices`. A board
 * is assembled from the existing measurement services, called directly
 * (never through MetricsHandler), plus the paragraph model and the standards
 * enrichment. No model is called and nothing is written to disk.
 *
 * - **Ceiling (D8).** A source over `PROMPT_BUDGETS.lightbox.sourceWords` is
 *   refused with its word count and a suggestion before anything is measured.
 * - **Ephemeral boards (D12).** The latest board for each source stays in
 *   memory for the extension session, so a hidden or reloaded tab gets it
 *   back. Re-reading unchanged text keeps the board's identity (its id, and
 *   from Slice 2B its readings) but measures again, so a changed setting such
 *   as the publishing-standards preset still shows.
 * - **Current board.** The last board built is current; a reopened or
 *   reloaded tab is served it. A build that a newer request overtook while it
 *   awaited the standards enrichment is dropped as `superseded`: it is
 *   neither retained nor made current, so a slow older build can never
 *   replace a newer board.
 *
 * The source text never leaves this service except as the board's short
 * preview; the host-private re-read path is never posted.
 */

import { randomUUID } from 'node:crypto';
import type {
  LightboxBoard,
  LightboxReadingGroup,
  LightboxSource,
  LightboxSourceKind,
  LightboxSourceRefusal
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { LIGHTBOX_READING_GROUPS } from '@shared/constants/lightbox';
import { countWords } from '@/utils/textUtils';
import type { ProseStatsService } from '@services/measurement/ProseStatsService';
import type { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import type { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { WordFrequencyOptions } from '@services/shared/ToolOptionsProvider';
import type { StandardsService } from '@services/resources/StandardsService';
import {
  buildLightboxRibbon,
  lightboxContentHash,
  measureLightboxParagraph,
  splitLightboxParagraphs
} from '@/infrastructure/lightbox/LightboxParagraphs';
import {
  LIGHTBOX_MEASURED_SIZES,
  LightboxEnrichedStats,
  buildLightboxMeasuredSet
} from '@/infrastructure/lightbox/LightboxMeasures';

/** A source the handler has resolved to text. */
export interface LightboxSourceInput {
  kind: LightboxSourceKind;
  text: string;
  displayPath: string;
  sourceUri?: string;
  startLine?: number;
  endLine?: number;
  /** Host-private absolute path a file source is re-read from. Never posted. */
  rereadPath?: string;
}

export type LightboxBoardResult =
  | { kind: 'board'; board: LightboxBoard; reused: boolean }
  | { kind: 'refused'; refusal: LightboxSourceRefusal }
  | { kind: 'superseded' };

/** What "Re-read file" needs to board the current source again. */
export interface LightboxRereadTarget {
  displayPath: string;
  rereadPath: string;
  sourceUri?: string;
}

export interface LightboxServiceOptions {
  now?: () => number;
  mintBoardId?: () => string;
  /** Boards kept in memory, least recently built first out. */
  retainedBoards?: number;
}

/**
 * Fixed word-frequency options, so every board has the same shape whatever
 * the Metrics tab's settings are: POS, n-grams and the stopword table on,
 * content words only, no hapax list (the board shows hapax as a count).
 */
const LIGHTBOX_WORD_FREQUENCY_OPTIONS: WordFrequencyOptions = {
  topN: LIGHTBOX_MEASURED_SIZES.topWords,
  includeHapaxList: false,
  hapaxDisplayMax: 0,
  includeStopwordsTable: true,
  contentWordsOnly: true,
  posEnabled: true,
  includeBigrams: true,
  includeTrigrams: true,
  enableLemmas: false,
  lengthHistogramMaxChars: 10,
  minCharacterLength: 1,
  ngramLimit: LIGHTBOX_MEASURED_SIZES.ngramDepth
};

const PREVIEW_CHARACTERS = 360;
const DEFAULT_RETAINED_BOARDS = 12;

interface BoardEntry {
  board: LightboxBoard;
  rereadPath?: string;
}

export class LightboxService {
  private readonly entries = new Map<string, BoardEntry>();
  private currentKey?: string;
  /** Bumped by every build request; a build finishing under an older value is dropped. */
  private generation = 0;
  private readonly now: () => number;
  private readonly mintBoardId: () => string;
  private readonly retainedBoards: number;

  constructor(
    private readonly proseStatsService: Pick<ProseStatsService, 'analyze'>,
    private readonly wordFrequencyService: Pick<WordFrequencyService, 'analyze'>,
    private readonly styleFlagsService: Pick<StyleFlagsService, 'analyze'>,
    private readonly standardsService: Pick<StandardsService, 'enrichWithStandards'>,
    options: LightboxServiceOptions = {}
  ) {
    this.now = options.now ?? Date.now;
    this.mintBoardId = options.mintBoardId ?? randomUUID;
    this.retainedBoards = Math.max(1, options.retainedBoards ?? DEFAULT_RETAINED_BOARDS);
  }

  /**
   * Board a resolved source and make it current, or refuse it. A refusal
   * leaves the current board as it was. Unchanged text keeps the retained
   * board's identity (`reused`).
   */
  async buildBoard(input: LightboxSourceInput): Promise<LightboxBoardResult> {
    const generation = ++this.generation;
    const refusal = this.refuse(input);
    if (refusal) {
      return { kind: 'refused', refusal };
    }

    const key = lightboxSourceKey(input);
    const contentHash = lightboxContentHash(input.text);
    const retained = this.entries.get(key);
    const unchanged = retained?.board.source.contentHash === contentHash ? retained.board : undefined;

    const board = await this.assemble(input, contentHash, unchanged);
    if (generation !== this.generation) {
      return { kind: 'superseded' };
    }
    this.adopt(key, { board, rereadPath: input.rereadPath ?? retained?.rereadPath });
    return { kind: 'board', board, reused: unchanged !== undefined };
  }

  currentBoard(): LightboxBoard | undefined {
    return this.currentKey ? this.entries.get(this.currentKey)?.board : undefined;
  }

  /** The current source's re-read target, when it is a file. */
  currentRereadTarget(): LightboxRereadTarget | undefined {
    const entry = this.currentKey ? this.entries.get(this.currentKey) : undefined;
    if (!entry || entry.board.source.kind !== 'file' || !entry.rereadPath) {
      return undefined;
    }
    return {
      displayPath: entry.board.source.displayPath,
      rereadPath: entry.rereadPath,
      sourceUri: entry.board.source.sourceUri
    };
  }

  private refuse(input: LightboxSourceInput): LightboxSourceRefusal | undefined {
    if (input.text.trim().length === 0) {
      return {
        reason: 'empty',
        message: 'That source has no text to board.',
        displayPath: input.displayPath
      };
    }
    const ceilingWords = PROMPT_BUDGETS.lightbox.sourceWords;
    const wordCount = countWords(input.text);
    if (wordCount > ceilingWords) {
      return {
        reason: 'over-ceiling',
        message: `This source has ${wordCount.toLocaleString('en-US')} words. ` +
          `The Lightbox boards up to ${ceilingWords.toLocaleString('en-US')} words at a time.`,
        displayPath: input.displayPath,
        wordCount,
        ceilingWords,
        suggestion: 'Choose a single chapter, or select a passage and open the selection in the Lightbox.'
      };
    }
    return undefined;
  }

  /** Measure the text; an unchanged predecessor lends its id and readings. */
  private async assemble(
    input: LightboxSourceInput,
    contentHash: string,
    predecessor: LightboxBoard | undefined
  ): Promise<LightboxBoard> {
    const paragraphs = splitLightboxParagraphs(input.text);
    const metrics = paragraphs.map(measureLightboxParagraph);
    const stats = this.proseStatsService.analyze({ text: input.text });
    const enriched = (await this.standardsService.enrichWithStandards(stats)) as LightboxEnrichedStats;
    const frequency = this.wordFrequencyService.analyze(input.text, LIGHTBOX_WORD_FREQUENCY_OPTIONS);
    const flags = this.styleFlagsService.analyze(input.text);

    const source: LightboxSource = {
      kind: input.kind,
      displayPath: input.displayPath,
      sourceUri: input.sourceUri,
      startLine: input.startLine,
      endLine: input.endLine,
      contentHash,
      wordCount: countWords(input.text),
      paragraphCount: paragraphs.length,
      capturedAt: this.now(),
      preview: previewOf(input.text)
    };

    return {
      boardVersion: 0,
      boardId: predecessor?.boardId ?? this.mintBoardId(),
      source,
      paragraphs: metrics,
      ribbon: buildLightboxRibbon(metrics, PROMPT_BUDGETS.lightbox.ribbonColumns),
      measured: buildLightboxMeasuredSet({ stats: enriched, frequency, flags, paragraphs }),
      readings: predecessor?.readings ?? LIGHTBOX_READING_GROUPS.map((group): LightboxReadingGroup => ({
        group,
        status: 'not-run',
        tiles: [],
        withheldBlocks: []
      }))
    };
  }

  private adopt(key: string, entry: BoardEntry): void {
    // Map order is recency: re-insert on every use, evict from the front. The
    // adopted entry is the newest, so eviction never takes the current board.
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.currentKey = key;
    while (this.entries.size > this.retainedBoards) {
      this.entries.delete(this.entries.keys().next().value as string);
    }
  }
}

/** Which source a board belongs to: its kind, path and, for a selection, its lines. */
export function lightboxSourceKey(
  source: Pick<LightboxSource, 'kind' | 'displayPath' | 'startLine' | 'endLine'>
): string {
  return source.kind === 'selection'
    ? `selection:${source.displayPath}:${source.startLine ?? ''}-${source.endLine ?? ''}`
    : `file:${source.displayPath}`;
}

/** The opening of the text, cut at a word boundary. */
function previewOf(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= PREVIEW_CHARACTERS) {
    return trimmed;
  }
  const cut = trimmed.slice(0, PREVIEW_CHARACTERS);
  const lastSpace = cut.search(/\s\S*$/);
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
