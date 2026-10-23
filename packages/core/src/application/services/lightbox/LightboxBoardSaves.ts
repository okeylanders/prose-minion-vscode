/**
 * LightboxBoardSaves — when a Lightbox board is saved, and where (ADR
 * 2026-10-19 D12 addendum; Slice 5A, epic decision 27; Slice 5A.2, epic
 * decision 41). Built by `LightboxBoardLibrary` over the same service and
 * store, and reached only through it. Split from the library in Slice 5A.2.
 *
 * - **One file per board (decision 41, amending decision 27).** A board's
 *   first save writes its file; every later save of the same board (more
 *   readings, a re-read lens, a stopped run) rewrites that file in place,
 *   through the store's claim. "Read the current text" builds a new board,
 *   so it gets a new file: that is where a version ends.
 * - **Only a file this window knows.** The board records the revision of
 *   its file it last read or wrote. A save rewrites the file only while it
 *   still holds those bytes; a file another window changed since, one gone,
 *   one held by another window, one with a part left out, or a rewrite that
 *   failed, leaves the file as it is and saves the board to a new file, in
 *   the same turn of the store's queue. No reading is lost and nothing
 *   unreadable is written over.
 * - **The name (decision 41).** A board the writer has not named takes its
 *   default name ("Chapter 6 - 10/23/2026 9:08 AM") when its first file is
 *   written. A save in place writes the board's name; a board with none
 *   keeps the name its file shows.
 * - **The board on screen (PR #163 F-01).** Every adoption moves the reload
 *   pointer at once: to the file that already holds the board, writing
 *   nothing, or, for a board no file holds yet, to the file its save
 *   commits, or the newest one holding its text (a measured board saves
 *   once per text, `onlyIfNewText`).
 *
 * Logs carry file ids and outcomes, never the writer's text or a name.
 */

import type { LightboxBoard } from '@messages';
import type { LogSink } from '@/platform';
import { lightboxDefaultBoardName } from '@shared/constants/lightboxBoardName';
import type { LightboxSavableBoard, LightboxService } from '@/infrastructure/lightbox/LightboxService';
import { lightboxBoardFileOf, type LightboxBoardFile } from '@/infrastructure/storage/LightboxBoardCodec';
import type { LightboxBoardStore } from '@/infrastructure/storage/LightboxBoardStore';

const LOG = '[LightboxBoardLibrary]';

export interface LightboxBoardSavePorts {
  service: Pick<LightboxService, 'currentBoard' | 'markSaved' | 'savable'>;
  store: Pick<LightboxBoardStore, 'rememberOnScreen' | 'save'>;
  outputChannel: LogSink;
  /** The rail hears a committed save, or a failed one (the library's shelf push). */
  announce: () => void;
  /** The zone a default name's time is told in; the host's own when absent (tests pin one). */
  timeZone?: string;
}

export class LightboxBoardSaves {
  constructor(private readonly ports: LightboxBoardSavePorts) {}

  /** A run on `boardId` ended having landed readings: save the board as it stands, in its own file. */
  async saveAfterRun(boardId: string): Promise<void> {
    const savable = this.ports.service.savable(boardId);
    if (!savable) {
      this.ports.outputChannel.appendLine(`${LOG} Nothing saved after a run: its board is gone`);
      return;
    }
    await this.save(savable, false);
  }

  /**
   * A board adopted is on screen (PR #163 F-01). A file already holds it:
   * the reload pointer moves there, and nothing is written. A board measured
   * from text no saved board of its source holds saves itself, once; the
   * pointer follows that save, or the newest file holding its text.
   * Synchronous, from the adoption itself, so it is the newest choice's.
   */
  onScreen(board: LightboxBoard): void {
    const savable = this.ports.service.savable(board.boardId);
    if (!savable) {
      return;
    }
    if (savable.savedFileId) {
      this.pointAt(board, savable.savedFileId);
    } else if (savable.origin.kind === 'built') {
      void this.save(savable, true);
    }
  }

  private async save(captured: LightboxSavableBoard, onlyIfNewText: boolean): Promise<void> {
    const { service, store, outputChannel, timeZone } = this.ports;
    const { boardId } = captured.board;
    // The board as it stands at the save's turn: a later save of it has its later readings.
    const latest = () => service.savable(boardId) ?? captured;
    let result: Awaited<ReturnType<LightboxBoardSavePorts['store']['save']>>;
    try {
      result = await store.save(() => {
        const { board, text, name } = latest();
        return { board, text, ...(name !== undefined ? { name } : {}) };
      }, {
        onlyIfNewText,
        // The file that holds the board, found at this save's turn, at the revision this window knows (decision 41).
        inPlace: {
          holding: () => {
            const { savedFileId, savedRevision } = latest();
            return savedFileId ? { fileId: savedFileId, boardId, revision: savedRevision ?? '' } : undefined;
          },
          update: (file, savedAt) => savedInPlace(file, latest(), savedAt, timeZone)
        },
        defaultName: (savedAt) => lightboxDefaultBoardName(captured.board.source, savedAt, timeZone),
        onCommitted: (fileId, committed) => {
          service.markSaved(boardId, fileId, committed);
          this.pointAt(captured.board, fileId);
          this.ports.announce();
        }
      });
    } catch (error) {
      outputChannel.appendLine(`${LOG} A board could not be saved: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    if (result.kind === 'held') {
      // A saved board already holds this text: a reload reopens that one while this board is on screen.
      this.pointAt(captured.board, result.fileId);
    } else if (result.kind === 'failed') {
      this.ports.announce();
    }
  }

  pointAt(board: LightboxBoard, fileId: string): void {
    if (this.ports.service.currentBoard()?.boardId === board.boardId) {
      this.ports.store.rememberOnScreen(fileId);
    }
  }
}

/**
 * The file a save in place writes (Slice 5A.2): the board as it stands, its
 * text, the save's time, and its name; a board with no name keeps the name
 * its file shows (the file's own, or the default its source and its time
 * give), so a save never changes the name a writer sees.
 */
export function savedInPlace(file: LightboxBoardFile, board: LightboxSavableBoard, savedAt: Date, timeZone?: string): LightboxBoardFile {
  const shown = file.board.name ?? lightboxDefaultBoardName(file.board.sources[0], Date.parse(file.savedAt), timeZone);
  return lightboxBoardFileOf({ board: board.board, text: board.text, savedAt, name: board.name ?? shown });
}
