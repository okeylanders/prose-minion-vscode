/**
 * UI domain handler
 * Handles UI interactions like selections and guide files
 */

import * as vscode from 'vscode';
import {
  OpenGuideFileMessage,
  RequestSelectionMessage,
  SelectionDataMessage,
  MessageType
} from '../../../shared/types/messages';

export class UIHandler {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly postMessage: (message: any) => void,
    private readonly sendStatus: (message: string, guideNames?: string) => void,
    private readonly sendError: (message: string, details?: string) => void
  ) {}

  async handleOpenGuideFile(message: OpenGuideFileMessage): Promise<void> {
    try {
      this.outputChannel.appendLine(`[UIHandler] Opening guide file: ${message.guidePath}`);

      // Construct the full URI to the guide file
      const guideUri = vscode.Uri.joinPath(
        this.extensionUri,
        'resources',
        'craft-guides',
        message.guidePath
      );

      this.outputChannel.appendLine(`[UIHandler] Full path: ${guideUri.fsPath}`);

      // Check if file exists first
      try {
        await vscode.workspace.fs.stat(guideUri);
      } catch (statError) {
        const errorMsg = `Guide file not found: ${guideUri.fsPath}`;
        this.outputChannel.appendLine(`[UIHandler] ERROR: ${errorMsg}`);
        this.sendError('Guide file not found', errorMsg);
        return;
      }

      // Open the file in the editor
      const document = await vscode.workspace.openTextDocument(guideUri);
      await vscode.window.showTextDocument(document, {
        preview: false,  // Open in permanent editor tab
        viewColumn: vscode.ViewColumn.Beside  // Open alongside current editor
      });

      this.outputChannel.appendLine(`[UIHandler] Successfully opened guide: ${message.guidePath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[UIHandler] ERROR opening guide: ${message.guidePath} - ${errorMsg}`);
      this.sendError(
        'Failed to open guide file',
        errorMsg
      );
    }
  }

  async handleSelectionRequest(message: RequestSelectionMessage): Promise<void> {
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
      target: message.target,
      content,
      sourceUri,
      relativePath,
      timestamp: Date.now()
    };

    this.postMessage(selectionMessage);
  }
}
