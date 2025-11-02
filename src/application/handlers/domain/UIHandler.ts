/**
 * UI domain handler
 * Handles UI interactions like selections and guide files
 */

import * as vscode from 'vscode';
import {
  OpenGuideFileMessage,
  RequestSelectionMessage,
  SelectionDataMessage,
  MessageType,
  ErrorSource,
  ErrorMessage,
  StatusMessage
} from '../../../shared/types/messages';

import { MessageRouter } from '../MessageRouter';

export class UIHandler {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly postMessage: (message: any) => Promise<void>,
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  /**
   * Register message routes for UI domain
   */
  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.OPEN_GUIDE_FILE, this.handleOpenGuideFile.bind(this));
    router.register(MessageType.REQUEST_SELECTION, this.handleSelectionRequest.bind(this));
    router.register(MessageType.TAB_CHANGED, async () => {}); // No-op handler for tab changes
  }

  // Helper methods (domain owns its message lifecycle)

  private sendStatus(message: string, guideNames?: string): void {
    const statusMessage: StatusMessage = {
      type: MessageType.STATUS,
      source: 'extension.ui',
      payload: {
        message,
        guideNames
      },
      timestamp: Date.now()
    };
    void this.postMessage(statusMessage);
  }

  private sendError(source: ErrorSource, message: string, details?: string): void {
    const errorMessage: ErrorMessage = {
      type: MessageType.ERROR,
      source: 'extension.ui',
      payload: {
        source,
        message,
        details
      },
      timestamp: Date.now()
    };
    void this.postMessage(errorMessage);
    this.outputChannel.appendLine(`[UIHandler] ERROR [${source}]: ${message}${details ? ` - ${details}` : ''}`);
  }

  // Message handlers

  async handleOpenGuideFile(message: OpenGuideFileMessage): Promise<void> {
    try {
      const { guidePath } = message.payload;
      this.outputChannel.appendLine(`[UIHandler] Opening guide file: ${guidePath}`);

      // Construct the full URI to the guide file
      const guideUri = vscode.Uri.joinPath(
        this.extensionUri,
        'resources',
        'craft-guides',
        guidePath
      );

      this.outputChannel.appendLine(`[UIHandler] Full path: ${guideUri.fsPath}`);

      // Check if file exists first
      try {
        await vscode.workspace.fs.stat(guideUri);
      } catch (statError) {
        const errorMsg = `Guide file not found: ${guideUri.fsPath}`;
        this.outputChannel.appendLine(`[UIHandler] ERROR: ${errorMsg}`);
        this.sendError('ui.guide', 'Guide file not found', errorMsg);
        return;
      }

      // Open the file in the editor
      const document = await vscode.workspace.openTextDocument(guideUri);
      await vscode.window.showTextDocument(document, {
        preview: false,  // Open in permanent editor tab
        viewColumn: vscode.ViewColumn.Beside  // Open alongside current editor
      });

      this.outputChannel.appendLine(`[UIHandler] Successfully opened guide: ${guidePath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const { guidePath } = message.payload;
      this.outputChannel.appendLine(`[UIHandler] ERROR opening guide: ${guidePath} - ${errorMsg}`);
      this.sendError(
        'ui.guide',
        'Failed to open guide file',
        errorMsg
      );
    }
  }

  async handleSelectionRequest(message: RequestSelectionMessage): Promise<void> {
    const { target } = message.payload;
    const editor = vscode.window.activeTextEditor;

    let content: string | undefined;
    let sourceUri: string | undefined;
    let relativePath: string | undefined;

    if (editor && !editor.selection.isEmpty) {
      content = editor.document.getText(editor.selection);
      sourceUri = editor.document.uri.toString();
      relativePath = vscode.workspace.asRelativePath(editor.document.uri, false);
    } else {
      // Fallback to clipboard if no selection
      try {
        const clip = await vscode.env.clipboard.readText();
        content = clip?.trim() || undefined;
      } catch {
        // ignore
      }
    }

    if (!content) {
      this.sendStatus('Select some text in the editor first or copy text to the clipboard.');
      return;
    }

    const selectionMessage: SelectionDataMessage = {
      type: MessageType.SELECTION_DATA,
      source: 'extension.ui',
      payload: {
        target,
        content,
        sourceUri,
        relativePath
      },
      timestamp: Date.now()
    };

    this.postMessage(selectionMessage);
  }
}
