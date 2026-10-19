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
 * Source ownership (PR #148 F-01). Every source request takes a ticket from
 * the shared LightboxService the moment the writer's choice is concrete, and
 * before anything is awaited: a selection or seeded file when its request
 * arrives, a re-read when it is asked for, a picked file when the picker
 * returns it. Opening the picker is not a choice (the writer may dismiss it,
 * and a dismissal changes nothing). Reads and builds then run under that
 * ticket, and the service adopts or refuses only under the newest one.
 *
 * This handler never posts a request's result itself. It subscribes to the
 * service's outcomes the first time its webview sends any `LIGHTBOX_*`
 * message (so the sidebar and Workshop webviews, which never do, receive no
 * boards) and posts whatever the service publishes, whichever handler started
 * the request. A request that outlives its panel therefore lands in the panel
 * that replaced it, and a disposed handler, unsubscribed, posts nothing.
 *
 * Every mount and reveal is answered with the service's current outcome: the
 * latest board and any refusal the writer has not dismissed (PR #148 F-02).
 * A refusal produced before the webview was listening is therefore shown
 * when it asks, and `LIGHTBOX_DISMISS_REFUSAL` is what stops it returning.
 *
 * Logs name paths, counts and refusal reasons. They never carry the writer's
 * text.
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LogSink, ShellService } from '@/platform';
import {
  isTextSourceValidationError,
  TextSourceResolver
} from '@/infrastructure/text/TextSourceResolver';
import type {
  LightboxBoardResult,
  LightboxOutcome,
  LightboxOutcomeChange,
  LightboxService,
  LightboxSourceInput,
  LightboxSourceRefusalDraft,
  LightboxSourceTicket
} from '@/infrastructure/lightbox/LightboxService';
import {
  LightboxBoardMessage,
  LightboxDismissRefusalMessage,
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

/** A file to read: where to read it, its URI, and the name the writer sees. */
interface LightboxFileRequest {
  filePath: string;
  sourceUri: string | undefined;
  displayPath: string;
}

export class LightboxHandler {
  private unsubscribe?: () => void;
  private disposed = false;

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
    router.register(MessageType.LIGHTBOX_DISMISS_REFUSAL, this.handleDismissRefusal.bind(this));
  }

  /** Stop hearing the service's outcomes; a disposed handler posts nothing more. */
  dispose(): void {
    this.disposed = true;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  /** Mount and reveal: answer with the current outcome (the board, and any undismissed refusal). */
  async handleRequestBoard(_message: LightboxRequestBoardMessage): Promise<void> {
    this.subscribe();
    this.postBoard(this.lightboxService.currentOutcome());
  }

  /**
   * A selection (with `text`) or a workspace file (by its `file:` URI). The
   * editor commands send this through the panel's own handler.
   */
  async handleSetSource(message: LightboxSetSourceMessage): Promise<void> {
    this.subscribe();
    const ticket = this.lightboxService.beginSourceRequest();
    const payload = message.payload ?? {};
    const displayPath = payload.relativePath?.trim() || 'Selection';

    if (typeof payload.text === 'string') {
      await this.board(ticket, {
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
      this.refuse(ticket, {
        reason: 'unreadable',
        message: 'Only a saved file can be boarded this way.',
        displayPath,
        suggestion: 'Save the file first, or select a passage and open the selection in the Lightbox.'
      });
      return;
    }
    await this.boardFile(ticket, { filePath, sourceUri: payload.sourceUri, displayPath });
  }

  /**
   * "Choose file": the host picker is the input. The request is minted when
   * the picker returns a file, not when it opens: dismissing it changes
   * nothing, and a source sent while it was open is older than the file the
   * writer then picks.
   */
  async handlePickSourceFile(_message: LightboxPickSourceFileMessage): Promise<void> {
    this.subscribe();
    const picked = await this.shell.pickFile({
      title: 'Open a file in the Lightbox',
      openLabel: 'Open',
      // eslint-disable-next-line @typescript-eslint/naming-convention -- dialog filter keys are display names.
      filters: { 'Text files': ['md', 'markdown', 'txt'], 'All files': ['*'] }
    });
    if (!picked) {
      return;
    }
    const ticket = this.lightboxService.beginSourceRequest();
    await this.boardFile(ticket, {
      filePath: picked.fsPath,
      sourceUri: picked.uri,
      displayPath: path.basename(picked.fsPath) || picked.fsPath
    });
  }

  /** "Re-read file": board the current file-backed source again. */
  async handleRefreshSource(_message: LightboxRefreshSourceMessage): Promise<void> {
    this.subscribe();
    const ticket = this.lightboxService.beginSourceRequest();
    const target = this.lightboxService.currentRereadTarget();
    if (!target) {
      this.refuse(ticket, {
        reason: 'not-refreshable',
        message: 'There is no file to re-read.',
        suggestion: 'Choose a file, or send a new selection.'
      });
      return;
    }
    await this.boardFile(ticket, {
      filePath: target.rereadPath,
      sourceUri: target.sourceUri,
      displayPath: target.displayPath
    });
  }

  /** The writer dismissed a refusal; the host stops serving it. */
  async handleDismissRefusal(message: LightboxDismissRefusalMessage): Promise<void> {
    this.subscribe();
    const refusalId = message.payload?.refusalId;
    if (typeof refusalId === 'string' && this.lightboxService.dismissRefusal(refusalId)) {
      this.outputChannel.appendLine('[LightboxHandler] Refusal dismissed');
    }
  }

  /** Subscribe once, on this webview's first Lightbox message. */
  private subscribe(): void {
    if (this.unsubscribe || this.disposed) {
      return;
    }
    this.unsubscribe = this.lightboxService.addOutcomeListener((change) => this.publish(change));
  }

  private publish(change: LightboxOutcomeChange): void {
    switch (change.kind) {
      case 'board':
        this.postBoard({ board: change.board, refusal: change.refusal });
        return;
      case 'refusal':
        this.postRefusal(change.refusal);
        return;
    }
  }

  private async boardFile(ticket: LightboxSourceTicket, request: LightboxFileRequest): Promise<void> {
    let resolved: { text: string; displayPath: string };
    try {
      const source = await this.textSourceResolver.resolve({ mode: 'activeFile', pathText: request.filePath });
      resolved = {
        text: source.text,
        displayPath: source.displayPath ?? source.relativePaths[0] ?? request.displayPath
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[LightboxHandler] Could not read a source file: ${detail}`);
      this.refuse(ticket, {
        reason: 'unreadable',
        message: readFailureMessage(detail),
        displayPath: request.displayPath,
        suggestion: 'Choose a text or Markdown file inside an open workspace folder.'
      });
      return;
    }

    await this.board(ticket, {
      kind: 'file',
      text: resolved.text,
      displayPath: resolved.displayPath,
      sourceUri: request.sourceUri,
      rereadPath: request.filePath
    });
  }

  private async board(ticket: LightboxSourceTicket, input: LightboxSourceInput): Promise<void> {
    let result: LightboxBoardResult;
    try {
      result = await this.lightboxService.buildBoard(input, ticket);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[LightboxHandler] Board failed for ${input.displayPath}: ${detail}`);
      this.refuse(ticket, {
        reason: 'unreadable',
        message: 'The board could not be built from that source.',
        displayPath: input.displayPath
      });
      return;
    }
    this.logResult(result, input.displayPath);
  }

  /** Refuse `ticket`'s source; the service publishes it only if no newer request arrived. */
  private refuse(ticket: LightboxSourceTicket, refusal: LightboxSourceRefusalDraft): void {
    this.logResult(this.lightboxService.refuseSource(ticket, refusal), refusal.displayPath);
  }

  private logResult(result: LightboxBoardResult, displayPath: string | undefined): void {
    const where = displayPath ? ` for ${displayPath}` : '';
    switch (result.kind) {
      case 'board': {
        const { source } = result.board;
        this.outputChannel.appendLine(
          `[LightboxHandler] Board ${result.reused ? 'unchanged' : 'built'} for ${source.displayPath}: ` +
            `${source.wordCount} words, ${source.paragraphCount} paragraphs`
        );
        return;
      }
      case 'refused': {
        const { refusal } = result;
        this.outputChannel.appendLine(
          `[LightboxHandler] Source refused (${refusal.reason})${where}` +
            (refusal.wordCount !== undefined ? `: ${refusal.wordCount} words` : '')
        );
        return;
      }
      case 'superseded':
        this.outputChannel.appendLine(
          `[LightboxHandler] Dropped the outcome${where}: a newer source was chosen`
        );
        return;
    }
  }

  private postRefusal(refusal: LightboxSourceRefusal): void {
    const message: LightboxSourceRefusedMessage = {
      type: MessageType.LIGHTBOX_SOURCE_REFUSED,
      source: SOURCE,
      payload: { refusal },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private postBoard(outcome: LightboxOutcome): void {
    const message: LightboxBoardMessage = {
      type: MessageType.LIGHTBOX_BOARD,
      source: SOURCE,
      payload: { board: outcome.board, refusal: outcome.refusal },
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
