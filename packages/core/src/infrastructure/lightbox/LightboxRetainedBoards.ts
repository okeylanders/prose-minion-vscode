/**
 * The boards `LightboxService` keeps in memory (ADR 2026-10-19 D12): one per
 * source, the latest adopted current, least recently adopted first out.
 * Host-private: the text and the paragraph texts beside each board are never
 * posted. Moved out of the service (Slice 5A) as saved boards added to what
 * an entry holds. A board's name (Slice 5A.1) is kept beside it here, as the
 * writer gave it: it belongs to the board's id, so a re-read of unchanged
 * text keeps it, and every save of the board writes it.
 */

import type { LightboxBoard } from '@messages';
import type { LightboxPassageIndex } from '@/infrastructure/lightbox/LightboxPassageIndex';

/**
 * Where a retained board came from: built from its source now, or opened
 * from a saved file, exactly as saved (Slice 5A, epic decision 29).
 */
export type LightboxBoardOrigin =
  | { kind: 'built' }
  | {
      kind: 'saved';
      fileId: string;
      /** Epoch ms when the file was written. */
      savedAt: number;
      /** Parts the codec could not read and left out. */
      dropped: number;
    };

export interface LightboxRetainedBoard {
  board: LightboxBoard;
  /** The whole text it was measured from: what a save writes beside it. */
  text: string;
  /** The paragraph texts a reading run reads (index 0 is ¶1). */
  paragraphTexts: string[];
  /** The text it was measured from, for the inspector's passages (Slice 4E). */
  passages: LightboxPassageIndex;
  /** The absolute path a file source is re-read from. */
  rereadPath?: string;
  origin: LightboxBoardOrigin;
  /** The saved file that holds it: the one it was opened from, or last saved to (Slice 5A). */
  savedFileId?: string;
  /** The writer's name for the board (Slice 5A.1). Writer text: never logged. */
  name?: string;
  /**
   * This adoption's generation, ascending per session (PR #163 F-02). A
   * board keeps its id across saves and snapshots, so several adoptions can
   * share one; the generation tells them apart. Readings landing on the
   * adopted board keep it.
   */
  adoption: number;
}

/** A saved board to adopt as the board on screen, exactly as saved (Slice 5A, epic decision 29). */
export interface LightboxSavedAdoption {
  board: LightboxBoard;
  /** The text its file holds, which it was measured from. */
  text: string;
  fileId: string;
  savedAt: number;
  dropped: number;
  /** Where its file is now, for "Read the current text" and Bring's check; none for a selection. */
  rereadPath?: string;
  /** The name its file holds (Slice 5A.1). */
  name?: string;
}

/** A retained board as a save writes it, and where it came from. Host-private. */
export interface LightboxSavableBoard {
  board: LightboxBoard;
  text: string;
  origin: LightboxBoardOrigin;
  savedFileId?: string;
  rereadPath?: string;
  name?: string;
  /** It is the board on screen. */
  current: boolean;
}

export class LightboxRetainedBoards {
  private readonly entries = new Map<string, LightboxRetainedBoard>();
  private currentKey?: string;
  private adoptions = 0;

  constructor(private readonly limit: number) {}

  /** The latest adopted board, the one on screen. */
  current(): LightboxRetainedBoard | undefined {
    return this.currentKey ? this.entries.get(this.currentKey) : undefined;
  }

  /** The board kept for a source, by `lightboxSourceKey`. */
  bySource(key: string): LightboxRetainedBoard | undefined {
    return this.entries.get(key);
  }

  /** A retained board by its id. */
  byId(boardId: string): LightboxRetainedBoard | undefined {
    for (const entry of this.entries.values()) {
      if (entry.board.boardId === boardId) {
        return entry;
      }
    }
    return undefined;
  }

  /** A retained board as a save writes it. */
  savable(entry: LightboxRetainedBoard): LightboxSavableBoard {
    return {
      board: entry.board,
      text: entry.text,
      origin: entry.origin,
      savedFileId: entry.savedFileId,
      rereadPath: entry.rereadPath,
      ...(entry.name !== undefined ? { name: entry.name } : {}),
      current: this.current() === entry
    };
  }

  /** Name the board kept under `boardId`, or unname it (`undefined`). False when no board has that id. */
  nameBoard(boardId: string, name: string | undefined): boolean {
    const entry = this.byId(boardId);
    if (!entry) {
      return false;
    }
    entry.name = name;
    return true;
  }

  /**
   * Record that `fileId` is the file the board kept under `boardId` was last
   * saved to. A board's id stays only while its text does, and a saved board
   * is adopted only through the store's queue, after every save before it
   * has committed; so the latest commit names the latest saved state.
   */
  markSaved(boardId: string, fileId: string): boolean {
    const entry = this.byId(boardId);
    if (!entry) {
      return false;
    }
    entry.savedFileId = fileId;
    return true;
  }

  /** A saved file was deleted: no retained board is held in it any more. */
  forgetSaved(fileId: string): void {
    for (const entry of this.entries.values()) {
      if (entry.savedFileId === fileId) {
        entry.savedFileId = undefined;
      }
    }
  }

  /** Keep `entry` for its source and make it current, evicting the least recently adopted past the limit. */
  adopt(key: string, entry: Omit<LightboxRetainedBoard, 'adoption'>): void {
    // Map order is recency: re-insert on every use, evict from the front. The
    // adopted entry is the newest, so eviction never takes the current board.
    this.entries.delete(key);
    this.entries.set(key, { ...entry, adoption: ++this.adoptions });
    this.currentKey = key;
    while (this.entries.size > this.limit) {
      this.entries.delete(this.entries.keys().next().value as string);
    }
  }
}
