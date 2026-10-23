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
 *   measuring, except number usages whose figure no longer stands out the
 *   way it did when read (PR #155 F-01). A rebuild of changed text is a new board (a new id), but the
 *   readings come along stale (D4, `LightboxStaleReadings`): each quote
 *   checked again against the new paragraphs and each count recounted. A change to the current board's readings is published as a
 *   `readings` outcome; one to a board that is no longer current updates
 *   that retained board silently, so a stale run never publishes over a
 *   newer board, and switching back to its source shows what it read.
 *
 * - **The writer's own average (Slice 4B).** Measured with the board, by
 *   `LightboxWriterBaseline` over the writer's other chapters (this source
 *   left out), so the board's numbers are fixed with the board.
 * - **Saved boards (Slice 5A).** A board opened from its file, or restored
 *   after a reload, is adopted by `adoptSaved` under a source ticket, exactly
 *   as saved, with its name (Slice 5A.1). `LightboxBoardLibrary` decides when
 *   a board is saved and records the file that holds it (`markSaved`) and
 *   its name (`nameBoard`); this service never touches the disk.
 *
 * The source text never leaves this service except as the board's short
 * preview and, from Slice 4E, the passages the inspector asks for by board
 * id (`passageSource`, cut by `LightboxPassageHandler`); the host-private
 * re-read path and each retained board's paragraph texts (what a reading run
 * reads) are never posted.
 */

import { randomUUID } from 'node:crypto';
import type {
  LightboxBoard,
  LightboxReadingGroup,
  LightboxSourceKind,
  LightboxSourceRefusal
} from '@messages';
import { ListenerSet } from '@/utils/ListenerSet';
import type { ProseStatsService } from '@services/measurement/ProseStatsService';
import type { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import type { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { StandardsService } from '@services/resources/StandardsService';
import { lightboxContentHash } from '@/infrastructure/lightbox/LightboxParagraphs';
import { carryLightboxReadings } from '@/infrastructure/lightbox/LightboxStaleReadings';
import { holdLightboxNumberUsages } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { checkLightboxSource } from '@/infrastructure/lightbox/LightboxSourceChecks';
import type { LightboxWriterBaseline } from '@/infrastructure/lightbox/LightboxWriterBaseline';
import type { LightboxPassageIndex } from '@/infrastructure/lightbox/LightboxPassageIndex';
import { lightboxSourceKey } from '@/infrastructure/lightbox/LightboxSourceKey';
import {
  assembleLightboxBoard,
  savedLightboxBoardParts,
  type LightboxBoardMeasurers
} from '@/infrastructure/lightbox/LightboxBoardAssembly';
import { LightboxRetainedBoards, type LightboxSavableBoard, type LightboxSavedAdoption, type LightboxSavedWrite } from '@/infrastructure/lightbox/LightboxRetainedBoards';

export type { LightboxBoardOrigin, LightboxSavableBoard, LightboxSavedAdoption, LightboxSavedWrite } from '@/infrastructure/lightbox/LightboxRetainedBoards';

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

const DEFAULT_RETAINED_BOARDS = 12;

/** A retained board with the text a reading run reads. Host-private. */
export interface LightboxReadingSourceText {
  board: LightboxBoard;
  paragraphTexts: readonly string[];
}

export class LightboxService {
  private readonly retained: LightboxRetainedBoards;
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
  private readonly measurers: LightboxBoardMeasurers;

  constructor(
    proseStatsService: Pick<ProseStatsService, 'analyze'>,
    wordFrequencyService: Pick<WordFrequencyService, 'analyze'>,
    styleFlagsService: Pick<StyleFlagsService, 'analyze'>,
    standardsService: Pick<StandardsService, 'enrichWithStandards'>,
    options: LightboxServiceOptions = {},
    /** The writer's own average for the numbers tile; without it the tile says none is measured. */
    writerBaseline?: Pick<LightboxWriterBaseline, 'measure'>
  ) {
    this.measurers = {
      proseStats: proseStatsService,
      wordFrequency: wordFrequencyService,
      styleFlags: styleFlagsService,
      standards: standardsService,
      writerBaseline
    };
    this.now = options.now ?? Date.now;
    this.mintBoardId = options.mintBoardId ?? randomUUID;
    this.mintRefusalId = options.mintRefusalId ?? randomUUID;
    this.retained = new LightboxRetainedBoards(Math.max(1, options.retainedBoards ?? DEFAULT_RETAINED_BOARDS));
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

  /** Whether any source request was made this session: a restore on mount yields to every one (Slice 5A). */
  hasSourceRequests(): boolean {
    return this.ticketCount > 0;
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
    const refusal = checkLightboxSource(input);
    if (refusal) {
      return this.refuseSource(ticket, refusal);
    }

    const key = lightboxSourceKey(input);
    const contentHash = lightboxContentHash(input.text);
    const retained = this.retained.bySource(key);
    const unchanged = retained?.board.source.contentHash === contentHash ? retained.board : undefined;

    const assembled = await assembleLightboxBoard(this.measurers, input, contentHash, unchanged, {
      capturedAt: this.now(),
      mintBoardId: this.mintBoardId
    });
    const { paragraphTexts } = assembled;
    let board = assembled.board;
    if (!this.isCurrentRequest(ticket)) {
      return { kind: 'superseded' };
    }
    // A reading group may have landed on the retained board while this one
    // was measured; work from the latest readings, not the ones captured before.
    const latest = this.retained.bySource(key)?.board;
    let carried = false;
    if (unchanged && latest?.boardId === board.boardId) {
      // Same text, measured again: a number usage stays only while its figure stands out the same way (PR #155 F-01).
      const before = latest.measured.numbers.rows;
      board = { ...board, readings: latest.readings.map((group) => holdLightboxNumberUsages(group, before, board.measured.numbers.rows)) };
    } else if (!unchanged && latest && latest.readings.some((group) => group.status !== 'not-run')) {
      // The text changed (D4): its readings come along, stale and checked again.
      board = {
        ...board,
        readings: carryLightboxReadings(latest.readings, {
          readAgainst: latest.source.contentHash,
          paragraphs: paragraphTexts,
          averageWordsPerSentence: board.measured.headline.averageWordsPerSentence,
          columns: board.ribbon,
          numbers: board.measured.numbers.rows,
          // The Opinion's measured citations are held to the rebuilt board's figures (Slice 4D).
          measured: board.measured
        })
      };
      carried = true;
    }
    // Readings taken from an earlier board keep the basis rule their Opinion was cited under (Slice 5A):
    // one saved under another rule stays stale, with its reason, until the Opinion is read again.
    const readFrom = carried || (unchanged && latest?.boardId === board.boardId) ? latest : unchanged;
    if (readFrom) {
      board = { ...board, rules: { ...board.rules, opinionBasis: readFrom.rules.opinionBasis } };
    }
    this.retained.adopt(key, {
      board,
      text: input.text,
      rereadPath: input.rereadPath ?? retained?.rereadPath,
      paragraphTexts,
      passages: assembled.passages,
      // Built now, under this build's rules. Unchanged text is still the board its file holds (Slice 5A), and keeps its name (5A.1).
      origin: { kind: 'built' },
      savedFileId: unchanged ? retained?.savedFileId : undefined,
      savedRevision: unchanged ? retained?.savedRevision : undefined,
      name: unchanged ? retained?.name : undefined
    });
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
    return this.retained.current()?.board;
  }

  /** A retained board and its paragraph texts, by board id (Slice 2B readings). */
  readingSource(boardId: string): LightboxReadingSourceText | undefined {
    const entry = this.retained.byId(boardId);
    return entry ? { board: entry.board, paragraphTexts: entry.paragraphTexts } : undefined;
  }

  /** A retained board and the text it was measured from, by board id (Slice 4E passages). */
  passageSource(boardId: string): { board: LightboxBoard; passages: LightboxPassageIndex } | undefined {
    const entry = this.retained.byId(boardId);
    return entry ? { board: entry.board, passages: entry.passages } : undefined;
  }

  /**
   * Replace a retained board's reading groups, and publish the change when
   * the board is the current one. `settled` names the group a run's call
   * just settled, under that run's token. Returns the updated board, or
   * undefined when no retained board has that id any more (its text changed
   * or it was evicted), in which case the update is dropped. `rules` moves
   * the rule ids the readings now stand under (group F citing under this
   * build's basis rule, Slice 5A); a change that moves one is published as
   * the whole board, which carries it.
   */
  updateReadings(
    boardId: string,
    /** Given the board as it stands, so a landing can be held to its current measurement (PR #155 F-01). */
    update: (readings: LightboxBoard['readings'], board: LightboxBoard) => LightboxBoard['readings'],
    settled?: { token: string; group: LightboxReadingGroup['group'] },
    rules?: Partial<LightboxBoard['rules']>
  ): LightboxBoard | undefined {
    const entry = this.retained.byId(boardId);
    if (!entry) {
      return undefined;
    }
    const before = entry.board;
    const ruled = { ...before.rules, ...rules };
    const rulesMoved = (Object.keys(ruled) as Array<keyof typeof ruled>).some((rule) => ruled[rule] !== before.rules[rule]);
    entry.board = { ...before, ...(rulesMoved ? { rules: ruled } : {}), readings: update(before.readings, before) };
    const board = entry.board;
    if (this.currentBoard()?.boardId === boardId) {
      const group = settled && !rulesMoved ? board.readings.find((candidate) => candidate.group === settled.group) : undefined;
      this.outcomeListeners.emit({
        kind: 'readings',
        board,
        refusal: this.standingRefusal,
        ...(settled && group ? { settled: { token: settled.token, group } } : {})
      });
    }
    return board;
  }

  /** The current source's re-read target, when it is a file. */
  currentRereadTarget(): LightboxRereadTarget | undefined {
    const entry = this.retained.current();
    if (!entry || entry.board.source.kind !== 'file' || !entry.rereadPath) {
      return undefined;
    }
    return {
      displayPath: entry.board.source.displayPath,
      rereadPath: entry.rereadPath,
      sourceUri: entry.board.source.sourceUri
    };
  }

  /**
   * Make a saved board current under `ticket`, exactly as saved: its
   * figures, readings and rules stay as the file holds them, and its
   * host-side parts are rebuilt from its own saved text (Slice 5A, epic
   * decision 29). It replaces the board kept for its source, as any newer
   * source does. Synchronous, so nothing lands between the check and the
   * adoption.
   */
  adoptSaved(saved: LightboxSavedAdoption, ticket: LightboxSourceTicket): Extract<LightboxBoardResult, { kind: 'board' | 'superseded' }> {
    if (!this.isCurrentRequest(ticket)) {
      return { kind: 'superseded' };
    }
    const { board, text, fileId, revision, savedAt, dropped, rereadPath, name } = saved;
    this.retained.adopt(lightboxSourceKey(board.source), {
      board,
      text,
      rereadPath,
      ...savedLightboxBoardParts(this.measurers.wordFrequency, board, text),
      origin: { kind: 'saved', fileId, savedAt, dropped },
      savedFileId: fileId,
      savedRevision: revision,
      name
    });
    this.standingRefusal = null;
    this.outcomeListeners.emit({ kind: 'board', board, refusal: null });
    return { kind: 'board', board, reused: false, carried: false };
  }

  /** A retained board as a save writes it, by id, and where it came from. Host-private. */
  savable(boardId: string): LightboxSavableBoard | undefined {
    const entry = this.retained.byId(boardId);
    return entry && this.retained.savable(entry);
  }

  /** The board on screen as a save writes it. Host-private. */
  currentSavable(): LightboxSavableBoard | undefined {
    const entry = this.retained.current();
    return entry && this.retained.savable(entry);
  }

  /**
   * The generation of the adoption kept under `boardId` (PR #163 F-02):
   * work that awaits captures it first and checks it after, since a newer
   * snapshot of the same board keeps the id. Undefined once none is kept.
   */
  adoptionOf(boardId: string): number | undefined {
    return this.retained.byId(boardId)?.adoption;
  }

  /** The retained board a board of `source` would replace, if any. */
  retainedForSource(source: LightboxBoard['source']): LightboxBoard | undefined {
    return this.retained.bySource(lightboxSourceKey(source))?.board;
  }

  /** Record the file the board kept under `boardId` was last saved to, or (`write.from`) a rewrite of it (Slice 5A.2). */
  markSaved(boardId: string, fileId: string, write?: LightboxSavedWrite): boolean {
    return this.retained.markSaved(boardId, fileId, write);
  }

  /** The id of the retained board a saved file holds, if any (Slice 5A.2). */
  boardOfFile(fileId: string): string | undefined {
    return this.retained.boardOfFile(fileId);
  }

  /** A saved file was deleted: no retained board is held in it any more. */
  forgetSaved(fileId: string): void {
    this.retained.forgetSaved(fileId);
  }

  /** Name the board kept under `boardId`, or unname it (Slice 5A.1). False when none is kept. */
  nameBoard(boardId: string, name: string | undefined): boolean {
    return this.retained.nameBoard(boardId, name);
  }
}
