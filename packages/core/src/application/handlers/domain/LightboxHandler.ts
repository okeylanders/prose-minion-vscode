/**
 * Lightbox domain handler (ADR 2026-10-19 D10). The thirteenth domain in every
 * MessageHandler, composed like its siblings: injected services and ports,
 * nothing constructed here.
 *
 * It owns the `LIGHTBOX_*` routes and never sends a `WORKSHOP_*` message: the
 * Lightbox's source is its own, not the Workshop's excerpt. Sources resolve
 * through the shared TextSourceResolver, which keeps file reads inside an
 * open workspace folder; the file picker is the existing ShellService seam
 * the Workshop's "Pin from file…" uses.
 *
 * Logs name paths, counts and refusal reasons. They never carry the writer's
 * text.
 */

import { fileURLToPath } from 'node:url';
import { LogSink, ShellService } from '@/platform';
import {
  isTextSourceValidationError,
  TextSourceResolver
} from '@/infrastructure/text/TextSourceResolver';
import type {
  LightboxBoardResult,
  LightboxService,
  LightboxSourceInput
} from '@/infrastructure/lightbox/LightboxService';
import {
  LightboxBoard,
  LightboxBoardMessage,
  LightboxPickSourceFileMessage,
  LightboxRefreshSourceMessage,
  LightboxRequestBoardMessage,
  LightboxSetSourceMessage,
  LightboxSourceRefusal,
  LightboxSourceRefusedMessage,
  MessageType
} from '@messages';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { MessageRouter } from '@handlers/MessageRouter';

const SOURCE = 'extension.lightbox';

/** The parts of the picker port this handler uses. */
type LightboxFilePicker = Pick<ShellService, 'pickFile'>;

export class LightboxHandler {
  constructor(
    private readonly lightboxService: LightboxService,
    private readonly textSourceResolver: TextSourceResolver,
    private readonly shell: LightboxFilePicker,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {}

  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.LIGHTBOX_REQUEST_BOARD, this.handleRequestBoard.bind(this));
    router.register(MessageType.LIGHTBOX_SET_SOURCE, this.handleSetSource.bind(this));
    router.register(MessageType.LIGHTBOX_PICK_SOURCE_FILE, this.handlePickSourceFile.bind(this));
    router.register(MessageType.LIGHTBOX_REFRESH_SOURCE, this.handleRefreshSource.bind(this));
  }

  /** Mount and reveal: answer with the current board, or `null` before the first one. */
  async handleRequestBoard(_message: LightboxRequestBoardMessage): Promise<void> {
    this.postBoard(this.lightboxService.currentBoard() ?? null);
  }

  /**
   * A selection (with `text`) or a workspace file (by its `file:` URI). The
   * editor commands send this through the panel's own handler.
   */
  async handleSetSource(message: LightboxSetSourceMessage): Promise<void> {
    const payload = message.payload ?? {};
    const displayPath = payload.relativePath?.trim() || 'Selection';

    if (typeof payload.text === 'string') {
      await this.board({
        kind: 'selection',
        text: payload.text,
        displayPath,
        sourceUri: payload.sourceUri,
        startLine: payload.startLine,
        endLine: payload.endLine
      });
      return;
    }

    const filePath = fileSystemPathOf(payload.sourceUri);
    if (!filePath) {
      this.refuse({
        reason: 'unreadable',
        message: 'Only a saved file can be boarded this way.',
        displayPath,
        suggestion: 'Save the file first, or select a passage and open the selection in the Lightbox.'
      });
      return;
    }
    await this.boardFile(filePath, payload.sourceUri);
  }

  /** "Choose file": the host picker is the input; dismissing it is not an error. */
  async handlePickSourceFile(_message: LightboxPickSourceFileMessage): Promise<void> {
    const picked = await this.shell.pickFile({
      title: 'Open a file in the Lightbox',
      openLabel: 'Open',
      // eslint-disable-next-line @typescript-eslint/naming-convention -- dialog filter keys are display names.
      filters: { 'Text files': ['md', 'markdown', 'txt'], 'All files': ['*'] }
    });
    if (!picked) {
      return;
    }
    await this.boardFile(picked.fsPath, picked.uri);
  }

  /** "Re-read file": board the current file-backed source again. */
  async handleRefreshSource(_message: LightboxRefreshSourceMessage): Promise<void> {
    const target = this.lightboxService.currentRereadTarget();
    if (!target) {
      this.refuse({
        reason: 'not-refreshable',
        message: 'There is no file to re-read.',
        suggestion: 'Choose a file, or send a new selection.'
      });
      return;
    }
    await this.boardFile(target.rereadPath, target.sourceUri);
  }

  private async boardFile(filePath: string, sourceUri: string | undefined): Promise<void> {
    let resolved: { text: string; displayPath: string };
    try {
      const source = await this.textSourceResolver.resolve({ mode: 'activeFile', pathText: filePath });
      resolved = {
        text: source.text,
        displayPath: source.displayPath ?? source.relativePaths[0] ?? filePath
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[LightboxHandler] Could not read a source file: ${detail}`);
      this.refuse({
        reason: 'unreadable',
        message: readFailureMessage(detail),
        suggestion: 'Choose a text or Markdown file inside an open workspace folder.'
      });
      return;
    }

    await this.board({
      kind: 'file',
      text: resolved.text,
      displayPath: resolved.displayPath,
      sourceUri,
      rereadPath: filePath
    });
  }

  private async board(input: LightboxSourceInput): Promise<void> {
    let result: LightboxBoardResult;
    try {
      result = await this.lightboxService.buildBoard(input);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[LightboxHandler] Board failed for ${input.displayPath}: ${detail}`);
      this.refuse({
        reason: 'unreadable',
        message: 'The board could not be built from that source.',
        displayPath: input.displayPath
      });
      return;
    }

    switch (result.kind) {
      case 'refused':
        this.refuse(result.refusal);
        return;
      case 'superseded':
        this.outputChannel.appendLine(
          `[LightboxHandler] Dropped a board for ${input.displayPath}: a newer source arrived first`
        );
        return;
      case 'board': {
        const { source } = result.board;
        this.outputChannel.appendLine(
          `[LightboxHandler] Board ${result.reused ? 'unchanged' : 'built'} for ${source.displayPath}: ` +
            `${source.wordCount} words, ${source.paragraphCount} paragraphs`
        );
        this.postBoard(result.board);
        return;
      }
    }
  }

  private refuse(refusal: LightboxSourceRefusal): void {
    this.outputChannel.appendLine(
      `[LightboxHandler] Source refused (${refusal.reason})` +
        (refusal.displayPath ? ` for ${refusal.displayPath}` : '') +
        (refusal.wordCount !== undefined ? `: ${refusal.wordCount} words` : '')
    );
    const message: LightboxSourceRefusedMessage = {
      type: MessageType.LIGHTBOX_SOURCE_REFUSED,
      source: SOURCE,
      payload: { refusal },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private postBoard(board: LightboxBoard | null): void {
    const message: LightboxBoardMessage = {
      type: MessageType.LIGHTBOX_BOARD,
      source: SOURCE,
      payload: { board },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }
}

/** The resolver's validation failures, in the Lightbox's words; anything else stays generic. */
function readFailureMessage(detail: string): string {
  if (!isTextSourceValidationError(detail)) {
    return 'Could not read that file.';
  }
  if (detail.startsWith('Text source path must be inside an open workspace folder.')) {
    return 'The Lightbox reads files inside an open workspace folder.';
  }
  if (detail.startsWith('Active file not found.')) {
    return 'That file could not be found.';
  }
  return detail;
}

/** The local path behind a `file:` URI, or undefined for any other scheme. */
function fileSystemPathOf(sourceUri: string | undefined): string | undefined {
  if (!sourceUri || !sourceUri.startsWith('file:')) {
    return undefined;
  }
  try {
    return fileURLToPath(sourceUri);
  } catch {
    return undefined;
  }
}
