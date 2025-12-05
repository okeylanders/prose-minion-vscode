/**
 * UI domain handler
 * Handles UI interactions like selections and guide files
 */

import * as vscode from 'vscode';
import {
  OpenGuideFileMessage,
  OpenDocsFileMessage,
  OpenResourceMessage,
  RequestSelectionMessage,
  SelectionDataMessage,
  MessageType,
  ErrorSource,
  ErrorMessage,
  StatusMessage,
  WebviewErrorMessage
} from '@messages';

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
    router.register(MessageType.OPEN_DOCS_FILE, this.handleOpenDocsFile.bind(this));
    router.register(MessageType.OPEN_RESOURCE, this.handleOpenResource.bind(this));
    router.register(MessageType.REQUEST_SELECTION, this.handleSelectionRequest.bind(this));
    router.register(MessageType.WEBVIEW_ERROR, this.handleWebviewError.bind(this));
    router.register(MessageType.TAB_CHANGED, async () => {}); // No-op handler for tab changes
  }

  // Helper methods (domain owns its message lifecycle)

  private sendStatus(message: string, tickerMessage?: string): void {
    const statusMessage: StatusMessage = {
      type: MessageType.STATUS,
      source: 'extension.ui',
      payload: {
        message,
        tickerMessage
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
  }

  // Message handlers

  /**
   * Handle webview error reports - log to output channel for debugging
   */
  private async handleWebviewError(message: WebviewErrorMessage): Promise<void> {
    this.outputChannel.appendLine(`[WEBVIEW ERROR] ${message.payload.message}`);
    if (message.payload.details) {
      this.outputChannel.appendLine(`  Details: ${message.payload.details}`);
    }
  }

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

      // Smart column selection: reuse existing text editor column if available,
      // otherwise open beside webview (which creates column 2)
      const targetColumn = vscode.window.visibleTextEditors.length > 0
        ? vscode.ViewColumn.Two  // Reuse second column if any editors exist
        : vscode.ViewColumn.Beside;  // Create beside webview on first open

      await vscode.window.showTextDocument(document, {
        preview: false,  // Open in permanent editor tab
        viewColumn: targetColumn
      });

      this.outputChannel.appendLine(`[UIHandler] Successfully opened guide: ${guidePath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.sendError(
        'ui.guide',
        'Failed to open guide file',
        errorMsg
      );
    }
  }

  async handleOpenDocsFile(message: OpenDocsFileMessage): Promise<void> {
    try {
      const { docsPath } = message.payload;
      this.outputChannel.appendLine(`[UIHandler] Opening docs file: ${docsPath}`);

      // Construct the full URI to the docs file
      const docsUri = vscode.Uri.joinPath(
        this.extensionUri,
        'docs',
        docsPath
      );

      this.outputChannel.appendLine(`[UIHandler] Full path: ${docsUri.fsPath}`);

      // Check if file exists first
      try {
        await vscode.workspace.fs.stat(docsUri);
      } catch (statError) {
        const errorMsg = `Docs file not found: ${docsUri.fsPath}`;
        this.outputChannel.appendLine(`[UIHandler] ERROR: ${errorMsg}`);
        this.sendError('ui.docs', 'Docs file not found', errorMsg);
        return;
      }

      // Open the file in the editor
      const document = await vscode.workspace.openTextDocument(docsUri);

      // Smart column selection: reuse existing text editor column if available,
      // otherwise open beside webview (which creates column 2)
      const targetColumn = vscode.window.visibleTextEditors.length > 0
        ? vscode.ViewColumn.Two  // Reuse second column if any editors exist
        : vscode.ViewColumn.Beside;  // Create beside webview on first open

      await vscode.window.showTextDocument(document, {
        preview: false,  // Open in permanent editor tab
        viewColumn: targetColumn
      });

      this.outputChannel.appendLine(`[UIHandler] Successfully opened docs: ${docsPath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.sendError(
        'ui.docs',
        'Failed to open docs file',
        errorMsg
      );
    }
  }

  async handleOpenResource(message: OpenResourceMessage): Promise<void> {
    try {
      const { path } = message.payload;
      this.outputChannel.appendLine(`[UIHandler] Opening resource: ${path}`);

      // Get workspace root
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
      if (!workspaceRoot) {
        const errorMsg = 'No workspace folder open';
        this.outputChannel.appendLine(`[UIHandler] ERROR: ${errorMsg}`);
        this.sendError('ui.resource', errorMsg);
        return;
      }

      // Construct workspace-relative path
      const resourceUri = vscode.Uri.joinPath(workspaceRoot, path);
      this.outputChannel.appendLine(`[UIHandler] Full path: ${resourceUri.fsPath}`);

      // Check if file exists first
      try {
        await vscode.workspace.fs.stat(resourceUri);
      } catch (statError) {
        const errorMsg = `Resource not found: ${path}`;
        this.outputChannel.appendLine(`[UIHandler] ERROR: ${errorMsg}`);
        this.sendError('ui.resource', 'Resource not found', errorMsg);
        return;
      }

      // Open the file in the editor
      const document = await vscode.workspace.openTextDocument(resourceUri);

      // Smart column selection: reuse existing text editor column if available,
      // otherwise open beside webview (which creates column 2)
      const targetColumn = vscode.window.visibleTextEditors.length > 0
        ? vscode.ViewColumn.Two  // Reuse second column if any editors exist
        : vscode.ViewColumn.Beside;  // Create beside webview on first open

      await vscode.window.showTextDocument(document, {
        preview: false,  // Open in permanent editor tab
        viewColumn: targetColumn
      });

      this.outputChannel.appendLine(`[UIHandler] Successfully opened resource: ${path}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.sendError(
        'ui.resource',
        'Failed to open resource',
        errorMsg
      );
    }
  }

  async handleSelectionRequest(message: RequestSelectionMessage): Promise<void> {
    try {
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
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('ui.selection', 'Failed to get selection', msg);
    }
  }
}
