/**
 * LightboxBoardLibrary — when Lightbox boards are saved, and how a saved one
 * comes back (ADR 2026-10-19 D12 addendum; Slice 5A; epic decisions 27–31).
 * Built once at the composition root and carried in `CoreServices`, over the
 * one LightboxService, LightboxBoardStore and reading runner. Handlers call
 * it; it constructs nothing.
 *
 * - **Saves (decision 27).** A run that landed readings saves its board as
 *   it stands (`saveAfterRun`). A board measured from new text saves itself
 *   once, unless a saved board of its source already holds that text. Every
 *   save is a new file and nothing is pruned. A committed save records the
 *   file that holds the board (`markSaved`), and the reload pointer follows
 *   the board on screen.
 * - **Open is a snapshot (decision 29).** The board exactly as saved, under
 *   a source ticket taken before anything is awaited: a newer source wins
 *   over it, and it wins over an older one (PR #148 F-01). It is refused at
 *   once while a run reads the board it would replace, and checked again,
 *   with nothing awaited, at the adoption.
 * - **Restore (decision 30).** The first mount of a session in which no
 *   source was chosen reopens the last board on screen, under its own ticket.
 *   A restore that fails is logged; the writer asked for nothing, so nothing
 *   is refused.
 * - **The shelf.** The rail's listing for a board's source, newest first,
 *   and, for a snapshot, whether its file still holds the text it was read
 *   from. Read live; the listing is the last thing awaited, so answers leave
 *   in the store's order.
 *
 * Logs carry file ids, counts and reasons; never the writer's text.
 */

import * as path from 'node:path';
import type {
  LightboxBoard,
  LightboxBoardShelf,
  LightboxSavedBoardSummary,
  LightboxSnapshotFile,
  LightboxSnapshotState
} from '@messages';
import type { LogSink, Workspace } from '@/platform';
import { ListenerSet } from '@/utils/ListenerSet';
import { lightboxContentHash } from '@/infrastructure/lightbox/LightboxParagraphs';
import type { LightboxSavableBoard, LightboxService, LightboxSourceTicket } from '@/infrastructure/lightbox/LightboxService';
import type { LightboxReadingRunner } from '@/infrastructure/lightbox/LightboxReadingRunner';
import type { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';
import { lightboxBoardOfFile } from '@/infrastructure/storage/LightboxBoardCodec';
import type { LightboxBoardRead, LightboxBoardStore } from '@/infrastructure/storage/LightboxBoardStore';

const LOG = '[LightboxBoardLibrary]';

/** Writer-facing words for an open or a delete that did not happen. */
export const LIGHTBOX_BOARD_NOTICES = {
  reading: 'A run is reading this board. Stop it, or let it finish, before opening a saved board.',
  missing: 'That saved board is no longer in the boards folder.',
  unreadable: 'That saved board could not be read, so it was left as it is.',
  unavailable: 'Boards are kept for this session only, so there is no saved board to open or delete.',
  severalSources: 'That saved board holds more than one source, and this version opens boards of one source.',
  deleteUnreadable: 'That file could not be read as a board, so it was not deleted.',
  deleteFailed: 'That saved board could not be deleted. The output log says why.'
} as const;

const OPEN_SUGGESTION = 'Choose another saved board, or read the chapter again.';

export interface LightboxBoardLibraryPorts {
  service: Pick<
    LightboxService,
    | 'addOutcomeListener'
    | 'adoptSaved'
    | 'beginSourceRequest'
    | 'currentBoard'
    | 'currentSavable'
    | 'forgetSaved'
    | 'hasSourceRequests'
    | 'isCurrentRequest'
    | 'markSaved'
    | 'refuseSource'
    | 'retainedForSource'
    | 'savable'
  >;
  store: Pick<LightboxBoardStore, 'availability' | 'delete' | 'lastOnScreen' | 'list' | 'read' | 'rememberOnScreen' | 'save'>;
  runs: Pick<LightboxReadingRunner, 'activeRun'>;
  textSourceResolver: Pick<TextSourceResolver, 'resolve'>;
  workspace: Pick<Workspace, 'workspaceFolders'>;
  outputChannel: LogSink;
}

/** What an open or a delete left for the rail to say. */
export interface LightboxBoardAction {
  notice?: string;
}

/** The rail's shelf, naming the board it describes (`null`: none). */
export interface LightboxBoardShelfAnswer {
  boardId: string | null;
  shelf: LightboxBoardShelf;
}

export class LightboxBoardLibrary {
  private readonly shelfListeners: ListenerSet<[]>;
  private readonly unsubscribe: () => void;
  private restoring?: Promise<void>;

  constructor(private readonly ports: LightboxBoardLibraryPorts) {
    this.shelfListeners = new ListenerSet<[]>(`${LOG} Shelf listener`, ports.outputChannel);
    // A board measured from new text saves itself once (decision 27).
    this.unsubscribe = ports.service.addOutcomeListener((change) => {
      if (change.kind === 'board') {
        void this.saveMeasured(change.board);
      }
    });
  }

  /** Stop hearing the service (composition-root teardown). */
  dispose(): void {
    this.unsubscribe();
  }

  /** Hear each committed save, so a rail shows it. Returns the unsubscribe closure the caller must own. */
  addShelfListener(listener: () => void): () => void {
    return this.shelfListeners.add(listener);
  }

  /** A run on `boardId` ended having landed readings: save the board as it stands now. */
  async saveAfterRun(boardId: string): Promise<void> {
    const savable = this.ports.service.savable(boardId);
    if (!savable) {
      this.ports.outputChannel.appendLine(`${LOG} Nothing saved after a run: its board is gone`);
      return;
    }
    await this.save(savable, false);
  }

  /**
   * Reopen the last board on screen, once per session and only while no
   * source has been chosen. Concurrent mounts share the one attempt.
   */
  restore(): Promise<void> {
    if (!this.restoring) {
      this.restoring = this.ports.service.hasSourceRequests() ? Promise.resolve() : this.restoreOnce();
    }
    return this.restoring;
  }

  /** Open a saved board as the board on screen, exactly as saved. */
  async open(fileId: string): Promise<LightboxBoardAction> {
    const { service } = this.ports;
    if (this.reading(service.currentBoard())) {
      this.ports.outputChannel.appendLine(`${LOG} Open of ${fileId} refused: a run is reading the board on screen`);
      return { notice: LIGHTBOX_BOARD_NOTICES.reading };
    }
    // The writer's choice is concrete: the ticket comes before the read (PR #148 F-01).
    const ticket = service.beginSourceRequest();
    const read = await this.ports.store.read(fileId);
    return this.adopt(ticket, fileId, read, 'open');
  }

  /** Delete a saved board's file; the board on screen, if it came from it, stays as it is. */
  async remove(fileId: string): Promise<LightboxBoardAction> {
    const result = await this.ports.store.delete(fileId);
    switch (result.kind) {
      case 'deleted':
        this.ports.service.forgetSaved(fileId);
        return {};
      case 'missing':
        return {};
      case 'unreadable':
        return { notice: LIGHTBOX_BOARD_NOTICES.deleteUnreadable };
      case 'unavailable':
        return { notice: LIGHTBOX_BOARD_NOTICES.unavailable };
      case 'failed':
        return { notice: LIGHTBOX_BOARD_NOTICES.deleteFailed };
    }
  }

  /** The saved boards of `boardId`'s source (the board on screen when it is not retained), newest first. */
  async shelf(boardId: string | null): Promise<LightboxBoardShelfAnswer> {
    const { service, store } = this.ports;
    const savable = (boardId ? service.savable(boardId) : undefined) ?? service.currentSavable();
    if (!savable) {
      return { boardId: null, shelf: { availability: store.availability(), boards: [], unreadable: 0 } };
    }
    const snapshot = await this.snapshotState(savable);
    // The listing is the last thing awaited: answers leave in the store's order.
    const listing = await store.list(savable.board.source);
    const heldIn = service.savable(savable.board.boardId)?.savedFileId;
    const boards = listing.entries.map((entry): LightboxSavedBoardSummary => ({
      fileId: entry.fileId,
      savedAt: entry.savedAt,
      wordCount: entry.wordCount,
      lenses: entry.lenses,
      staleLenses: entry.staleLenses,
      ...(entry.costUsd !== undefined ? { costUsd: entry.costUsd } : {}),
      onScreen: entry.fileId === heldIn
    }));
    return {
      boardId: savable.board.boardId,
      shelf: {
        availability: store.availability(),
        boards,
        unreadable: listing.unreadable,
        ...(snapshot ? { snapshot } : {})
      }
    };
  }

  private async restoreOnce(): Promise<void> {
    const fileId = this.ports.store.lastOnScreen();
    if (!fileId) {
      return;
    }
    const ticket = this.ports.service.beginSourceRequest();
    const read = await this.ports.store.read(fileId);
    await this.adopt(ticket, fileId, read, 'restore');
  }

  /** Adopt a read file under `ticket`, with nothing awaited between the last check and the adoption. */
  private adopt(ticket: LightboxSourceTicket, fileId: string, read: LightboxBoardRead, mode: 'open' | 'restore'): LightboxBoardAction {
    const { service, outputChannel } = this.ports;
    if (!service.isCurrentRequest(ticket)) {
      outputChannel.appendLine(`${LOG} Dropped the ${mode} of ${fileId}: a newer source was chosen`);
      return {};
    }
    const fail = (message: string): LightboxBoardAction => {
      outputChannel.appendLine(`${LOG} Could not ${mode} ${fileId}: ${message}`);
      if (mode === 'open') {
        service.refuseSource(ticket, { reason: 'unreadable', message, suggestion: OPEN_SUGGESTION });
      }
      return {};
    };
    if (read.kind !== 'board') {
      return fail(read.kind === 'missing' ? LIGHTBOX_BOARD_NOTICES.missing
        : read.kind === 'unavailable' ? LIGHTBOX_BOARD_NOTICES.unavailable
          : LIGHTBOX_BOARD_NOTICES.unreadable);
    }
    const held = lightboxBoardOfFile(read.file);
    if (held.kind !== 'board') {
      return fail(LIGHTBOX_BOARD_NOTICES.severalSources);
    }
    // A run that began while the file was read keeps its board.
    if (this.reading(service.currentBoard()) || this.reading(service.retainedForSource(held.board.source))) {
      outputChannel.appendLine(`${LOG} The ${mode} of ${fileId} was refused: a run is reading the board it would replace`);
      return { notice: LIGHTBOX_BOARD_NOTICES.reading };
    }
    const adopted = service.adoptSaved({
      board: held.board,
      text: held.text,
      fileId,
      savedAt: Date.parse(read.file.savedAt),
      dropped: read.dropped,
      rereadPath: this.rereadPathOf(held.board)
    }, ticket);
    if (adopted.kind === 'superseded') {
      return {};
    }
    this.ports.store.rememberOnScreen(fileId);
    outputChannel.appendLine(
      `${LOG} ${mode === 'open' ? 'Opened' : 'Restored'} ${fileId}` +
        (read.dropped > 0 ? `; ${read.dropped} unreadable parts were left out` : '')
    );
    return {};
  }

  private reading(board: LightboxBoard | undefined): boolean {
    return board !== undefined && this.ports.runs.activeRun(board.boardId) !== undefined;
  }

  /** A board measured from text no saved board of its source holds saves itself, once. */
  private async saveMeasured(board: LightboxBoard): Promise<void> {
    const savable = this.ports.service.savable(board.boardId);
    if (!savable || savable.origin.kind !== 'built' || savable.savedFileId) {
      return;
    }
    await this.save(savable, true);
  }

  private async save(savable: LightboxSavableBoard, onlyIfNewText: boolean): Promise<void> {
    const { service, store, outputChannel } = this.ports;
    const { board, text } = savable;
    let result: Awaited<ReturnType<LightboxBoardLibraryPorts['store']['save']>>;
    try {
      result = await store.save({ board, text }, {
        onlyIfNewText,
        onCommitted: (fileId) => {
          service.markSaved(board.boardId, fileId);
          this.pointAt(board, fileId);
          this.shelfListeners.emit();
        }
      });
    } catch (error) {
      outputChannel.appendLine(`${LOG} A board could not be saved: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    if (result.kind === 'held') {
      // A saved board already holds this text: a reload reopens that one while this board is on screen.
      this.pointAt(board, result.fileId);
    } else if (result.kind === 'failed') {
      this.shelfListeners.emit();
    }
  }

  private pointAt(board: LightboxBoard, fileId: string): void {
    if (this.ports.service.currentBoard()?.boardId === board.boardId) {
      this.ports.store.rememberOnScreen(fileId);
    }
  }

  /** Whether a snapshot's file still holds the text it was read from; undefined for a board built now. */
  private async snapshotState(savable: LightboxSavableBoard): Promise<LightboxSnapshotState | undefined> {
    const { origin, board, rereadPath } = savable;
    if (origin.kind !== 'saved') {
      return undefined;
    }
    let file: LightboxSnapshotFile = 'none';
    if (board.source.kind === 'file') {
      file = 'unreadable';
      if (rereadPath) {
        try {
          const current = await this.ports.textSourceResolver.resolve({ mode: 'activeFile', pathText: rereadPath });
          file = lightboxContentHash(current.text) === board.source.contentHash ? 'same' : 'changed';
        } catch {
          this.ports.outputChannel.appendLine(`${LOG} Could not read ${board.source.displayPath} to compare a saved board`);
        }
      }
    }
    return { fileId: origin.fileId, savedAt: origin.savedAt, file, dropped: origin.dropped };
  }

  /** Where a saved file source is now: its workspace-relative path under the one open folder. */
  private rereadPathOf(board: LightboxBoard): string | undefined {
    const folders = this.ports.workspace.workspaceFolders();
    if (board.source.kind !== 'file' || folders.length !== 1) {
      return undefined;
    }
    const candidate = path.resolve(folders[0].path, board.source.displayPath);
    return isPathWithinRoot(folders[0].path, candidate) ? candidate : undefined;
  }
}
