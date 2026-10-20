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
 * - **Current outcome (PR #148 F-02).** The last board adopted is current,
 *   and a refusal of a newer source is kept beside it until the writer
 *   dismisses it or a later board replaces it. A mount or reveal is served
 *   both, so a refusal produced before the webview was listening (an editor
 *   command opens the tab and refuses at once) is not lost, and a refusal
 *   never discards the board behind it.
 * - **Source requests (PR #148 F-01).** The service owns the writer's source
 *   intent, not the handler that happens to carry it. Each request (a
 *   selection, a seeded file, a re-read, or a file the picker returned) gets
 *   a ticket from `beginSourceRequest()` before any read or build is awaited,
 *   and the newest ticket supersedes every earlier one at once. A board is
 *   adopted, and a refusal published, only under the current ticket; anything
 *   finishing under an older one is `superseded` and dropped. Because the
 *   ticket lives here, one per extension session, a disposed panel's handler
 *   cannot outrank the replacement panel's newer request.
 * - **Outcomes are published, not returned to the caller.** Adoption and
 *   refusal notify `addOutcomeListener` subscribers; each Lightbox webview's
 *   handler subscribes and posts what it hears. The code path that started a
 *   request never posts its own result, so a request outliving its panel
 *   still lands in the panel that replaced it.
 *
 * - **Readings (Slice 2B).** A board's reading groups attach to its id:
 *   a run writes them through `updateReadings(boardId, …)`, and a rebuild
 *   of unchanged text keeps them, including any that landed while it was
 *   measuring. A rebuild of changed text is a new board (a new id), but the
 *   readings come along stale (D4, `LightboxStaleReadings`): each quote
 *   checked again against the new paragraphs and each count recounted. A change to the current board's readings is published as a
 *   `readings` outcome; one to a board that is no longer current updates
 *   that retained board silently, so a stale run never publishes over a
 *   newer board, and switching back to its source shows what it read.
 *
 * The source text never leaves this service except as the board's short
 * preview; the host-private re-read path and each retained board's
 * paragraph texts (what a reading run reads) are never posted.
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
import { LIGHTBOX_READING_GROUPS, emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import { countWords } from '@/utils/textUtils';
import { ListenerSet } from '@/utils/ListenerSet';
import type { ProseStatsService } from '@services/measurement/ProseStatsService';
import type { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import type { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { StandardsService } from '@services/resources/StandardsService';
import {
  buildLightboxRibbon,
  lightboxContentHash,
  measureLightboxParagraph,
  splitLightboxParagraphs
} from '@/infrastructure/lightbox/LightboxParagraphs';
import { carryLightboxReadings } from '@/infrastructure/lightbox/LightboxStaleReadings';
import {
  LIGHTBOX_WORD_FREQUENCY_OPTIONS,
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
  /** `carried`: the text changed, and the replaced board's readings came along, stale (D4). */
  | { kind: 'board'; board: LightboxBoard; reused: boolean; carried: boolean }
  | { kind: 'refused'; refusal: LightboxSourceRefusal }
  | { kind: 'superseded' };

/**
 * One source request. Minted by `beginSourceRequest()` when the writer's
 * choice becomes concrete; compared by identity, so it cannot be forged.
 */
export interface LightboxSourceTicket {
  /** Ascending per extension session; for logs. */
  readonly sequence: number;
}

/** A refusal before the service names it (`LightboxSourceRefusal.id` is host-minted). */
export type LightboxSourceRefusalDraft = Omit<LightboxSourceRefusal, 'id'>;

/** What the Lightbox shows: the latest board and any refusal not yet dismissed. */
export interface LightboxOutcome {
  board: LightboxBoard | null;
  refusal: LightboxSourceRefusal | null;
}

/** A change to what the Lightbox shows, published to every subscribed webview. */
export type LightboxOutcomeChange =
  /** A board was adopted; `refusal` is the one still standing beside it (none after a new source). */
  | { kind: 'board'; board: LightboxBoard; refusal: LightboxSourceRefusal | null }
  /** A source was refused; the board behind it is unchanged. */
  | { kind: 'refusal'; refusal: LightboxSourceRefusal }
  /**
   * The current board's readings changed (Slice 2B): one group settled
   * (`settled`), or a run started or stopped (the whole board).
   */
  | {
      kind: 'readings';
      board: LightboxBoard;
      refusal: LightboxSourceRefusal | null;
      settled?: { token: string; group: LightboxReadingGroup };
    };

/** What "Re-read file" needs to board the current source again. */
export interface LightboxRereadTarget {
  displayPath: string;
  rereadPath: string;
  sourceUri?: string;
}

export interface LightboxServiceOptions {
  now?: () => number;
  mintBoardId?: () => string;
  mintRefusalId?: () => string;
  /** Boards kept in memory (one per source, by `lightboxSourceKey`), least recently built first out. */
  retainedBoards?: number;
}

const PREVIEW_CHARACTERS = 360;
const DEFAULT_RETAINED_BOARDS = 12;

interface BoardEntry {
  board: LightboxBoard;
  rereadPath?: string;
  /** Host-private: the paragraph texts the board was measured from (index 0 is ¶1). */
  paragraphTexts: string[];
}

/** A retained board with the text a reading run reads. Host-private. */
export interface LightboxReadingSourceText {
  board: LightboxBoard;
  paragraphTexts: readonly string[];
}

export class LightboxService {
  private readonly entries = new Map<string, BoardEntry>();
  private currentKey?: string;
  /** The writer's latest source request; only it may adopt or refuse. */
  private currentTicket?: LightboxSourceTicket;
  private ticketCount = 0;
  /** The refusal of the latest request, until dismissed or replaced by a board. */
  private standingRefusal: LightboxSourceRefusal | null = null;
  private readonly outcomeListeners =
    new ListenerSet<[LightboxOutcomeChange]>('[LightboxService] Outcome listener');
  private readonly now: () => number;
  private readonly mintBoardId: () => string;
  private readonly mintRefusalId: () => string;
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
    this.mintRefusalId = options.mintRefusalId ?? randomUUID;
    this.retainedBoards = Math.max(1, options.retainedBoards ?? DEFAULT_RETAINED_BOARDS);
  }

  /**
   * Record the writer's newest source request and return its ticket. Call it
   * when the choice becomes concrete (a request arrives, the picker returns a
   * file, or an editor command has its file, before loading it: PR #152
   * F-01), before awaiting anything: it supersedes every earlier request.
   */
  beginSourceRequest(): LightboxSourceTicket {
    const ticket: LightboxSourceTicket = { sequence: ++this.ticketCount };
    this.currentTicket = ticket;
    return ticket;
  }

  /** Whether `ticket` is still the writer's latest source request. */
  isCurrentRequest(ticket: LightboxSourceTicket): boolean {
    return ticket === this.currentTicket;
  }

  /**
   * Board a resolved source under `ticket` and make it current, or refuse it.
   * A refusal leaves the current board as it was. Unchanged text keeps the
   * retained board's identity (`reused`). Without a ticket the call is a new
   * request of its own.
   */
  async buildBoard(
    input: LightboxSourceInput,
    ticket: LightboxSourceTicket = this.beginSourceRequest()
  ): Promise<LightboxBoardResult> {
    if (!this.isCurrentRequest(ticket)) {
      return { kind: 'superseded' };
    }
    const refusal = checkSource(input);
    if (refusal) {
      return this.refuseSource(ticket, refusal);
    }

    const key = lightboxSourceKey(input);
    const contentHash = lightboxContentHash(input.text);
    const retained = this.entries.get(key);
    const unchanged = retained?.board.source.contentHash === contentHash ? retained.board : undefined;
    const paragraphTexts = splitLightboxParagraphs(input.text).map((paragraph) => paragraph.text);

    let board = await this.assemble(input, contentHash, unchanged);
    if (!this.isCurrentRequest(ticket)) {
      return { kind: 'superseded' };
    }
    // A reading group may have landed on the retained board while this one
    // was measured; work from the latest readings, not the ones captured before.
    const latest = this.entries.get(key)?.board;
    let carried = false;
    if (unchanged && latest?.boardId === board.boardId) {
      board = { ...board, readings: latest.readings };
    } else if (!unchanged && latest && latest.readings.some((group) => group.status !== 'not-run')) {
      // The text changed (D4): its readings come along, stale and checked again.
      board = {
        ...board,
        readings: carryLightboxReadings(latest.readings, {
          readAgainst: latest.source.contentHash,
          paragraphs: paragraphTexts,
          averageWordsPerSentence: board.measured.headline.averageWordsPerSentence,
          columns: board.ribbon
        })
      };
      carried = true;
    }
    this.adopt(key, { board, rereadPath: input.rereadPath ?? retained?.rereadPath, paragraphTexts });
    // The newest request produced a board, so no refusal stands beside it.
    this.standingRefusal = null;
    this.outcomeListeners.emit({ kind: 'board', board, refusal: this.standingRefusal });
    return { kind: 'board', board, reused: unchanged !== undefined, carried };
  }

  /**
   * Refuse `ticket`'s source, unless a newer request has superseded it: name
   * the refusal, keep it as the standing one, and publish it. The current
   * board stays as it was.
   */
  refuseSource(
    ticket: LightboxSourceTicket,
    draft: LightboxSourceRefusalDraft
  ): Extract<LightboxBoardResult, { kind: 'refused' | 'superseded' }> {
    if (!this.isCurrentRequest(ticket)) {
      return { kind: 'superseded' };
    }
    const refusal: LightboxSourceRefusal = { ...draft, id: this.mintRefusalId() };
    this.standingRefusal = refusal;
    this.outcomeListeners.emit({ kind: 'refusal', refusal });
    return { kind: 'refused', refusal };
  }

  /** The latest board and any refusal the writer has not dismissed: what a mount or reveal shows. */
  currentOutcome(): LightboxOutcome {
    return { board: this.currentBoard() ?? null, refusal: this.standingRefusal };
  }

  /**
   * Forget the standing refusal if it is the one named. A dismissal that
   * arrives after a newer refusal names an older one and changes nothing.
   */
  dismissRefusal(refusalId: string): boolean {
    if (this.standingRefusal?.id !== refusalId) {
      return false;
    }
    this.standingRefusal = null;
    return true;
  }

  /**
   * Hear every adopted board and published refusal. Returns the unsubscribe
   * closure the caller must own (a handler releases it on dispose).
   */
  addOutcomeListener(listener: (change: LightboxOutcomeChange) => void): () => void {
    return this.outcomeListeners.add(listener);
  }

  currentBoard(): LightboxBoard | undefined {
    return this.currentKey ? this.entries.get(this.currentKey)?.board : undefined;
  }

  /** A retained board and its paragraph texts, by board id (Slice 2B readings). */
  readingSource(boardId: string): LightboxReadingSourceText | undefined {
    const entry = this.entryOf(boardId);
    return entry ? { board: entry.board, paragraphTexts: entry.paragraphTexts } : undefined;
  }

  /**
   * Replace a retained board's reading groups, and publish the change when
   * the board is the current one. `settled` names the group a run's call
   * just settled, under that run's token. Returns the updated board, or
   * undefined when no retained board has that id any more (its text changed
   * or it was evicted), in which case the update is dropped.
   */
  updateReadings(
    boardId: string,
    update: (readings: LightboxBoard['readings']) => LightboxBoard['readings'],
    settled?: { token: string; group: LightboxReadingGroup['group'] }
  ): LightboxBoard | undefined {
    const entry = this.entryOf(boardId);
    if (!entry) {
      return undefined;
    }
    entry.board = { ...entry.board, readings: update(entry.board.readings) };
    const board = entry.board;
    if (this.currentBoard()?.boardId === boardId) {
      const group = settled ? board.readings.find((candidate) => candidate.group === settled.group) : undefined;
      this.outcomeListeners.emit({
        kind: 'readings',
        board,
        refusal: this.standingRefusal,
        ...(settled && group ? { settled: { token: settled.token, group } } : {})
      });
    }
    return board;
  }

  private entryOf(boardId: string): BoardEntry | undefined {
    for (const entry of this.entries.values()) {
      if (entry.board.boardId === boardId) {
        return entry;
      }
    }
    return undefined;
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
      measured: buildLightboxMeasuredSet({ stats: enriched, frequency, flags, paragraphs, text: input.text }),
      readings: predecessor?.readings ?? LIGHTBOX_READING_GROUPS.map(emptyLightboxReadingGroup)
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

/** Why a resolved source cannot be boarded (D8), or undefined when it can. */
function checkSource(input: LightboxSourceInput): LightboxSourceRefusalDraft | undefined {
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

/**
 * Which source a board belongs to: its kind, its document and, for a
 * selection, its lines. The document is its URI, VS Code's canonical
 * `Uri.toString()` from both the editor command and the picker (a re-read
 * reuses the board's), so two workspace roots that each hold `chapter.md`
 * never share a board. The display path, which is workspace-relative and can
 * repeat across roots, is only the fallback for a source with no URI.
 * Computable from a resolved input and from a board's own `source` alike.
 */
export function lightboxSourceKey(
  source: Pick<LightboxSource, 'kind' | 'displayPath' | 'sourceUri' | 'startLine' | 'endLine'>
): string {
  const document = source.sourceUri ?? source.displayPath;
  return source.kind === 'selection'
    ? `selection:${document}:${source.startLine ?? ''}-${source.endLine ?? ''}`
    : `file:${document}`;
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
