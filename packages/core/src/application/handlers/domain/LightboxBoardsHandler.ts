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
 *
 * Every answer is `LIGHTBOX_BOARDS`, echoing its request's id. From this
 * webview's first board message on, each adoption and each committed save
 * is pushed with `requestId: null`. A shelf built across a newer adoption of
 * its board (a snapshot keeps the board's id) is never posted: a push is
 * dropped, since the newer adoption pushes its own, and an answer is built
 * again (PR #163 F-02). A request with no id is ignored, as the passage
 * handler's are. Logs carry file ids and counts, never text.
 */

import type { LogSink } from '@/platform';
import {
  LightboxBoardsMessage,
  LightboxDeleteBoardMessage,
  LightboxOpenBoardMessage,
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

export type LightboxBoardLibraryPort = Pick<LightboxBoardLibrary, 'addShelfListener' | 'describesCurrent' | 'open' | 'remove' | 'restore' | 'shelf'>;
/** An answer is built again at most this many times while its board keeps being adopted anew. */
const ANSWER_ATTEMPTS = 3;

export class LightboxBoardsHandler {
  private unsubscribe?: () => void;
  private disposed = false;

  constructor(
    private readonly library: LightboxBoardLibraryPort,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {}

  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.LIGHTBOX_REQUEST_BOARDS, this.handleRequestBoards.bind(this));
    router.register(MessageType.LIGHTBOX_OPEN_BOARD, this.handleOpenBoard.bind(this));
    router.register(MessageType.LIGHTBOX_DELETE_BOARD, this.handleDeleteBoard.bind(this));
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

  async handleDeleteBoard(message: LightboxDeleteBoardMessage): Promise<void> {
    const payload = message.payload as Partial<LightboxDeleteBoardMessage['payload']> | undefined;
    const requestId = boundedName(payload?.requestId, LIGHTBOX_PASSAGE_BOUNDS.nameCharacters);
    const boardId = boundedName(payload?.boardId, LIGHTBOX_PASSAGE_BOUNDS.nameCharacters);
    const fileId = boundedName(payload?.fileId, FILE_ID_CHARACTERS);
    if (!requestId || !boardId || !fileId) {
      this.outputChannel.appendLine(`${LOG} A delete without its request id, board or file was ignored.`);
      return;
    }
    this.subscribe();
    const { notice } = await this.library.remove(fileId);
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
      let answer: Awaited<ReturnType<LightboxBoardLibraryPort['shelf']>>;
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
      if (!this.library.describesCurrent(answer)) {
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
          shelf: notice ? { ...answer.shelf, notice } : answer.shelf
        },
        timestamp: Date.now()
      };
      void this.postMessage(reply);
      return;
    }
  }
}

function boundedName(value: unknown, limit: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= limit ? value : undefined;
}
