/**
 * LightboxBoardEdits — what changes a saved board in place rather than
 * saving a new file (Slice 5A.1; ADR 2026-10-19 D12 addendum; epic
 * decisions 33 and 35). Built by `LightboxBoardLibrary` over the same
 * service and store, and reached only through it.
 *
 * - **A name belongs to the board** (decision 33): its retained id and that
 *   board's saves. Naming the board on screen, or the file that holds it,
 *   names the retained board, so its later saves carry the name, and
 *   rewrites that file in place. Naming any other file rewrites only that
 *   file. Session-only, the name is the in-memory board's. A name is checked
 *   by the one rule (`lightboxBoardName`).
 * - **The file and the name are found at the rewrite's turn.** The store's
 *   queue runs the rewrite after every save queued before it has committed
 *   and named the file that holds the board; the rewrite then writes the
 *   board's name as it is then. So the last rename wins, and a save racing a
 *   rename never leaves the newest file without the name.
 * - **A spark set aside saves at once** (decision 35): the file that holds
 *   the board takes that one spark's mark in place, and no new file is
 *   written. Only the spark the writer acted on changes in the file, read
 *   as it is at the rewrite's turn (PR #164 F-03): another window's board,
 *   opened before this one set a different spark aside, never takes that
 *   mark back. A board no file holds yet, or one kept for the session only,
 *   takes its marks with its next save, as before.
 * - **The board follows its own file (Slice 5A.2).** A rename or a spark's
 *   mark on the file that holds a board keeps that board's record of the
 *   file's revision current, when the board knew the file it rewrote, so
 *   its next save can still rewrite the file in place. Naming a saved file
 *   from the browser names whichever board this window keeps in it, on
 *   screen or not.
 *
 * Logs carry file ids and outcomes, never the writer's text or a name.
 */

import { LIGHTBOX_BOARD_NAME_FAULTS, checkLightboxBoardName } from '@shared/constants/lightboxBoardName';
import { setLightboxSparkDismissed } from '@/infrastructure/lightbox/LightboxSparkLane';
import type { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import { namedLightboxBoardFile } from '@/infrastructure/storage/LightboxBoardCodec';
import type {
  LightboxBoardReplaceResult,
  LightboxBoardReplaceTarget,
  LightboxBoardStore
} from '@/infrastructure/storage/LightboxBoardStore';
import type { LogSink } from '@/platform';
import { LIGHTBOX_BOARD_NOTICES, type LightboxBoardAction } from '@/application/services/lightbox/LightboxBoardNotices';

const LOG = '[LightboxBoardLibrary]';

/** A rename as the rail asks for it (`LightboxRenameBoardPayload` without its request id). */
export interface LightboxBoardRename {
  /** The board on screen; `null` when there is none (a rename from the browser, Slice 5A.2). */
  boardId: string | null;
  /** The saved file to rename; `null` names the board on screen. */
  fileId: string | null;
  /** The writer's words; empty unnames it. */
  name: string;
  /** The adoption the name sheet was opened for (PR #167 F-02); a board on screen since is not named. */
  adoption?: number | null;
}

export interface LightboxBoardEditPorts {
  service: Pick<LightboxService, 'adoptionOf' | 'boardOfFile' | 'markSaved' | 'nameBoard' | 'savable'>;
  store: Pick<LightboxBoardStore, 'replace'>;
  outputChannel: LogSink;
  /** The rail hears a change to the board on screen (the library's shelf push). */
  announce: () => void;
}

export class LightboxBoardEdits {
  constructor(private readonly ports: LightboxBoardEditPorts) {}

  /**
   * Name a board, rename it, or unname it. A name that is not one line, or
   * is too long, is refused with the rule's words.
   */
  async rename(request: LightboxBoardRename): Promise<LightboxBoardAction> {
    const { service, store, outputChannel } = this.ports;
    const check = checkLightboxBoardName(request.name);
    if (check.kind === 'invalid') {
      return { notice: LIGHTBOX_BOARD_NAME_FAULTS[check.fault] };
    }
    const name = check.kind === 'named' ? check.name : undefined;
    // A draft typed for one adoption of the board on screen is never given to another (PR #167 F-02).
    if (request.fileId === null && typeof request.adoption === 'number'
      && (request.boardId === null || service.adoptionOf(request.boardId) !== request.adoption)) {
      outputChannel.appendLine(`${LOG} A name for the board on screen was not given: another board is on screen now`);
      return { notice: LIGHTBOX_BOARD_NOTICES.boardChanged };
    }
    // The board the name is for: the one a named file holds here (Slice 5A.2), or the board on screen.
    const boardId = request.fileId !== null ? service.boardOfFile(request.fileId) : request.boardId;
    if (request.fileId !== null && boardId === undefined) {
      // A file that holds no board kept here: that file alone.
      const result = await store.replace({ fileId: request.fileId }, (file) =>
        (file.board.name === name ? undefined : namedLightboxBoardFile(file, name)), { renames: true });
      outputChannel.appendLine(`${LOG} Rename of ${request.fileId}: ${result.kind}`);
      return renameNotice(result, false);
    }
    const onScreen = request.fileId === null || boardId === request.boardId;
    if (!boardId || !service.savable(boardId) || !service.nameBoard(boardId, name)) {
      return { notice: LIGHTBOX_BOARD_NOTICES.boardGone };
    }
    const written = store.replace(() => this.holding(boardId), (file) => {
      // The board's name at the rewrite's turn; a board no longer kept changes nothing.
      const board = service.savable(boardId);
      return !board || file.board.name === board.name ? undefined : namedLightboxBoardFile(file, board.name);
    }, { renames: true, onCommitted: this.follow(boardId) });
    // Queued before the rail hears it, so the shelf it builds lists the file as rewritten.
    this.ports.announce();
    const result = await written;
    outputChannel.appendLine(`${LOG} Named ${onScreen ? 'the board on screen' : 'a board kept here'}; its file: ${result.kind}`);
    return renameNotice(result, onScreen);
  }

  /**
   * The spark `tileId` on `boardId` was set aside or brought back: the file
   * that holds the board takes that spark's mark, as the board has it at the
   * rewrite's turn, and nothing else. A spark set aside takes the order after
   * the file's own highest, so Undo in any window brings back the file's
   * latest first. The file is found at the rewrite's turn, so a save still
   * queued (a run that just ended) is the file marked; with none, the
   * board's next save carries the marks.
   */
  async keepSpark(boardId: string, tileId: string): Promise<void> {
    const { service, store, outputChannel } = this.ports;
    const result = await store.replace(() => this.holding(boardId), (file) => {
      const spark = service.savable(boardId)?.board.readings.flatMap((group) => group.tiles)
        .find((tile) => tile.id === tileId && tile.kind === 'spark');
      if (spark?.kind !== 'spark') {
        // A run replaced it since: the board's next save holds what it has.
        return undefined;
      }
      const marked = setLightboxSparkDismissed(file.board.readings, tileId, spark.dismissedOrder !== undefined);
      return marked.ok && marked.changed ? { ...file, board: { ...file.board, readings: marked.readings } } : undefined;
    }, { onCommitted: this.follow(boardId) });
    if (result.kind === 'unreadable' || result.kind === 'busy' || result.kind === 'failed') {
      outputChannel.appendLine(`${LOG} A spark's mark waits for the board's next save: its file was ${result.kind}`);
    }
  }

  /**
   * A rewrite of the file that holds `boardId` committed: the board knows the
   * bytes written when it knew the bytes rewritten (Slice 5A.2), so its next
   * save still rewrites the file in place; otherwise another window's change
   * is in the file, and that save writes a new one.
   */
  private follow(boardId: string): (committed: { fileId: string; from: string; revision: string }) => void {
    return ({ fileId, from, revision }) => {
      this.ports.service.markSaved(boardId, fileId, { from, revision });
    };
  }

  /** The file that holds the board kept under `boardId`, now, and that it must hold that board. */
  private holding(boardId: string): LightboxBoardReplaceTarget | undefined {
    const fileId = this.ports.service.savable(boardId)?.savedFileId;
    return fileId ? { fileId, boardId } : undefined;
  }
}

/** What the rail says after a rename's rewrite: nothing when it stands; `onScreen` when the board on screen took the name regardless. */
function renameNotice(result: LightboxBoardReplaceResult, onScreen: boolean): LightboxBoardAction {
  switch (result.kind) {
    case 'replaced':
    case 'unchanged':
    case 'withdrawn':
      return {};
    case 'session':
      return onScreen ? {} : { notice: LIGHTBOX_BOARD_NOTICES.unavailable };
    case 'missing':
      // On screen, a board no file holds (yet) keeps its name for its next save.
      return onScreen ? {} : { notice: LIGHTBOX_BOARD_NOTICES.missing };
    case 'busy':
      return { notice: onScreen ? LIGHTBOX_BOARD_NOTICES.nameKeptFailed : LIGHTBOX_BOARD_NOTICES.busy };
    case 'unreadable':
    case 'changed':
      return { notice: onScreen ? LIGHTBOX_BOARD_NOTICES.nameKeptUnreadable : LIGHTBOX_BOARD_NOTICES.unreadable };
    case 'failed':
      return { notice: onScreen ? LIGHTBOX_BOARD_NOTICES.nameKeptFailed : LIGHTBOX_BOARD_NOTICES.renameFailed };
  }
}
