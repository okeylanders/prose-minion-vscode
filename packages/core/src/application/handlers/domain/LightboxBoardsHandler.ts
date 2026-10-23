/**
 * Lightbox saved boards (Slice 5A; ADR 2026-10-19 D12 addendum): the fourth
 * Lightbox handler, beside `LightboxHandler`, `LightboxReadingHandler` and
 * `LightboxPassageHandler`, composed like them in `MessageHandler`. It holds
 * nothing of its own: the composition root's `LightboxBoardLibrary` decides
 * what is saved, opened and deleted.
 *
 * - `LIGHTBOX_REQUEST_BOARDS` asks for the shelf of the board on screen. One
 *   that names no board (a mount) first lets the library restore the last
 *   board on screen (epic decision 30).
 * - `LIGHTBOX_OPEN_BOARD` opens a saved board by the host's file id. The
 *   board arrives through the service's outcome, as `LIGHTBOX_BOARD`, in
 *   every Lightbox webview; this handler answers with the shelf of the board
 *   then on screen and any notice.
 * - `LIGHTBOX_DELETE_BOARD` deletes one, after the rail's confirm step.
 * - `LIGHTBOX_RENAME_BOARD` (Slice 5A.1) names a saved file in place, or the
 *   board on screen and the file that holds it; the name is the writer's
 *   words, so it is never logged.
 * - `LIGHTBOX_OPEN_BOARD_FILE` (Slice 5A.2) shows the system picker for a
 *   board file and opens the one the writer picks; dismissing it changes
 *   nothing. A delete or a rename from the browser may come with no board
 *   on screen (`boardId: null`).
 *
 * Every answer is `LIGHTBOX_BOARDS`, echoing its request's id. From this
 * webview's first board message on, each adoption and each committed save
 * is pushed with `requestId: null`. A shelf built across a newer adoption of
 * its board (a snapshot keeps the board's id, PR #163 F-02), or observed
 * before a shelf of its board this webview was already sent (readings,
 * saves and deletes keep the adoption, PR #163 F-05), is never posted: a
 * push is dropped, since whatever made it outdated sent its own, and an
 * answer is built again. A request with no id is ignored, as the passage
 * handler's are. Logs carry file ids and counts, never text.
 */

import type { LogSink, ShellService } from '@/platform';
import {
  LightboxBoardsMessage,
  LightboxDeleteBoardMessage,
  LightboxOpenBoardFileMessage,
  LightboxOpenBoardMessage,
  LightboxRenameBoardMessage,
  LightboxRequestBoardsMessage,
  MessageType
} from '@messages';
import { LIGHTBOX_PASSAGE_BOUNDS } from '@shared/constants/lightboxPassages';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { MessageRouter } from '@handlers/MessageRouter';
import type { LightboxBoardLibrary } from '@/application/services/lightbox/LightboxBoardLibrary';

const SOURCE = 'extension.lightbox';
const LOG = '[LightboxBoardsHandler]';
/** A file id is a slug folder and a timestamped name; anything longer is not one of the host's. */
const FILE_ID_CHARACTERS = 160;

export type LightboxBoardLibraryPort = Pick<
  LightboxBoardLibrary,
  'addShelfListener' | 'describesCurrent' | 'open' | 'openFile' | 'remove' | 'rename' | 'restore' | 'shelf'
>;
/** The host's file picker, for "Open a board file…" (Slice 5A.2). */
export type LightboxBoardFilePicker = Pick<ShellService, 'pickFile'>;
type ShelfAnswer = Awaited<ReturnType<LightboxBoardLibraryPort['shelf']>>;
/** An answer is built again at most this many times while its board keeps changing. */
const ANSWER_ATTEMPTS = 3;

export class LightboxBoardsHandler {
  private unsubscribe?: () => void;
  private disposed = false;
  /** The newest observation of each board this webview was sent (PR #163 F-05). */
  private readonly sent = new Map<string | null, number>();

  constructor(
    private readonly library: LightboxBoardLibraryPort,
    private readonly picker: LightboxBoardFilePicker,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {}

  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.LIGHTBOX_REQUEST_BOARDS, this.handleRequestBoards.bind(this));
    router.register(MessageType.LIGHTBOX_OPEN_BOARD, this.handleOpenBoard.bind(this));
    router.register(MessageType.LIGHTBOX_DELETE_BOARD, this.handleDeleteBoard.bind(this));
    router.register(MessageType.LIGHTBOX_RENAME_BOARD, this.handleRenameBoard.bind(this));
    router.register(MessageType.LIGHTBOX_OPEN_BOARD_FILE, this.handleOpenBoardFile.bind(this));
  }

  /** Stop hearing saves; a disposed handler posts nothing more. */
  dispose(): void {
    this.disposed = true;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  async handleRequestBoards(message: LightboxRequestBoardsMessage): Promise<void> {
    const payload = message.payload as Partial<LightboxRequestBoardsMessage['payload']> | undefined;
    const requestId = boundedName(payload?.requestId, LIGHTBOX_PASSAGE_BOUNDS.nameCharacters);
    const boardId = payload?.boardId === null ? null : boundedName(payload?.boardId, LIGHTBOX_PASSAGE_BOUNDS.nameCharacters);
    if (!requestId || boardId === undefined) {
      this.outputChannel.appendLine(`${LOG} A boards request without its request id or board was ignored.`);
      return;
    }
    this.subscribe();
    if (boardId === null) {
      await this.library.restore();
    }
    await this.answer(requestId, boardId);
  }

  async handleOpenBoard(message: LightboxOpenBoardMessage): Promise<void> {
    const payload = message.payload as Partial<LightboxOpenBoardMessage['payload']> | undefined;
    const requestId = boundedName(payload?.requestId, LIGHTBOX_PASSAGE_BOUNDS.nameCharacters);
    const fileId = boundedName(payload?.fileId, FILE_ID_CHARACTERS);
    if (!requestId || !fileId) {
      this.outputChannel.appendLine(`${LOG} An open without its request id or file was ignored.`);
      return;
    }
    this.subscribe();
    const { notice } = await this.library.open(fileId);
    await this.answer(requestId, null, notice);
  }

  /**
   * "Open a board file…" (Slice 5A.2): the host's picker is the input. The
   * source request begins when the picker returns a file, not when it opens:
   * dismissing it changes nothing, and is answered with the shelf as it is.
   */
  async handleOpenBoardFile(message: LightboxOpenBoardFileMessage): Promise<void> {
    const payload = message.payload as Partial<LightboxOpenBoardFileMessage['payload']> | undefined;
    const requestId = boundedName(payload?.requestId, LIGHTBOX_PASSAGE_BOUNDS.nameCharacters);
    if (!requestId) {
      this.outputChannel.appendLine(`${LOG} An open of a board file without its request id was ignored.`);
      return;
    }
    this.subscribe();
    const picked = await this.picker.pickFile({
      title: 'Open a saved Lightbox board (*.board.json)',
      openLabel: 'Open board',
      // eslint-disable-next-line @typescript-eslint/naming-convention -- dialog filter keys are display names.
      filters: { 'Lightbox boards': ['json'], 'All files': ['*'] }
    });
    const { notice } = picked ? await this.library.openFile(picked.fsPath) : {};
    await this.answer(requestId, null, notice);
  }

  async handleDeleteBoard(message: LightboxDeleteBoardMessage): Promise<void> {
    const payload = message.payload as Partial<LightboxDeleteBoardMessage['payload']> | undefined;
    const requestId = boundedName(payload?.requestId, LIGHTBOX_PASSAGE_BOUNDS.nameCharacters);
    const boardId = payload?.boardId === null ? null : boundedName(payload?.boardId, LIGHTBOX_PASSAGE_BOUNDS.nameCharacters);
    const fileId = boundedName(payload?.fileId, FILE_ID_CHARACTERS);
    if (!requestId || boardId === undefined || !fileId) {
      this.outputChannel.appendLine(`${LOG} A delete without its request id, board or file was ignored.`);
      return;
    }
    this.subscribe();
    const { notice } = await this.library.remove(fileId);
    await this.answer(requestId, boardId, notice);
  }

  async handleRenameBoard(message: LightboxRenameBoardMessage): Promise<void> {
    const payload = message.payload as Partial<LightboxRenameBoardMessage['payload']> | undefined;
    const requestId = boundedName(payload?.requestId, LIGHTBOX_PASSAGE_BOUNDS.nameCharacters);
    const boardId = payload?.boardId === null ? null : boundedName(payload?.boardId, LIGHTBOX_PASSAGE_BOUNDS.nameCharacters);
    const fileId = payload?.fileId === null ? null : boundedName(payload?.fileId, FILE_ID_CHARACTERS);
    if (!requestId || boardId === undefined || fileId === undefined || typeof payload?.name !== 'string') {
      this.outputChannel.appendLine(`${LOG} A rename without its request id, board, file or name was ignored.`);
      return;
    }
    this.subscribe();
    // The adoption the name sheet was opened for (PR #167 F-02): a whole number, or none.
    const adoption = typeof payload.adoption === 'number' && Number.isSafeInteger(payload.adoption) ? payload.adoption : undefined;
    const { notice } = await this.library.rename({ boardId, fileId, name: payload.name, ...(adoption !== undefined ? { adoption } : {}) });
    await this.answer(requestId, boardId, notice);
  }

  /** Hear committed saves once, from this webview's first board message on. */
  private subscribe(): void {
    if (this.unsubscribe || this.disposed) {
      return;
    }
    this.unsubscribe = this.library.addShelfListener(() => {
      void this.answer(null, null);
    });
  }

  /** The shelf of `boardId` (the board on screen for `null`), under `requestId` (`null`: a push). */
  private async answer(requestId: string | null, boardId: string | null, notice?: string): Promise<void> {
    for (let attempt = 1; attempt <= ANSWER_ATTEMPTS; attempt++) {
      let answer: ShelfAnswer;
      try {
        answer = await this.library.shelf(boardId);
      } catch (error) {
        this.outputChannel.appendLine(`${LOG} The saved boards could not be listed: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      if (this.disposed) {
        return;
      }
      // Checked with nothing awaited before the post: an outdated shelf never leaves as current.
      if (this.outdated(answer)) {
        if (requestId === null) {
          return;
        }
        if (attempt < ANSWER_ATTEMPTS) {
          continue;
        }
        this.outputChannel.appendLine(`${LOG} The board kept changing while its shelf was listed; the request was left unanswered.`);
        return;
      }
      const reply: LightboxBoardsMessage = {
        type: MessageType.LIGHTBOX_BOARDS,
        source: SOURCE,
        payload: {
          requestId,
          boardId: answer.boardId,
          adoption: answer.adoption,
          observation: answer.observation,
          shelf: notice ? { ...answer.shelf, notice } : answer.shelf
        },
        timestamp: Date.now()
      };
      this.sent.set(answer.boardId, answer.observation);
      void this.postMessage(reply);
      return;
    }
  }

  /** Built across a newer adoption of its board, or observed before a shelf of its board this webview already has. */
  private outdated(answer: ShelfAnswer): boolean {
    return !this.library.describesCurrent(answer) || (this.sent.get(answer.boardId) ?? 0) > answer.observation;
  }
}

function boundedName(value: unknown, limit: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= limit ? value : undefined;
}
