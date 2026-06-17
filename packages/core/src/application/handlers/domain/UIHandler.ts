/**
 * UI domain handler
 * Handles UI interactions like selections and guide files
 */

import * as path from 'path';
import { EditorContext, FileSystem, LogSink, ShellService, Workspace } from '@/platform';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';
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
    private readonly postMessage: (message: any) => Promise<void>,
    private readonly outputChannel: LogSink,
    private readonly fileSystem: FileSystem,
    private readonly workspace: Workspace,
    private readonly shell: ShellService,
    private readonly editor: EditorContext
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

      // Construct the full path to the guide file, contained within the guides dir.
      // guidePath is webview/AI-supplied — reject `..` traversal out of the root.
      const guidesRoot = path.join(this.workspace.extensionPath, 'resources', 'craft-guides');
      const guideFsPath = path.join(guidesRoot, guidePath);
      if (!isPathWithinRoot(guidesRoot, guideFsPath)) {
        this.outputChannel.appendLine(`[UIHandler] ERROR: guide path escapes root: ${guidePath}`);
        this.sendError('ui.guide', 'Invalid guide path', guidePath);
        return;
      }

      this.outputChannel.appendLine(`[UIHandler] Full path: ${guideFsPath}`);

      // Check if file exists first
      try {
        await this.fileSystem.stat(guideFsPath);
      } catch (statError) {
        const errorMsg = `Guide file not found: ${guideFsPath}`;
        this.outputChannel.appendLine(`[UIHandler] ERROR: ${errorMsg}`);
        this.sendError('ui.guide', 'Guide file not found', errorMsg);
        return;
      }

      // Open beside the webview (the adapter owns the reuse-column-2 logic).
      await this.shell.openFileInEditor(guideFsPath, { beside: true });

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

      // Construct the full path to the docs file, contained within the docs dir.
      // docsPath is webview/AI-supplied — reject `..` traversal out of the root.
      const docsRoot = path.join(this.workspace.extensionPath, 'docs');
      const docsFsPath = path.join(docsRoot, docsPath);
      if (!isPathWithinRoot(docsRoot, docsFsPath)) {
        this.outputChannel.appendLine(`[UIHandler] ERROR: docs path escapes root: ${docsPath}`);
        this.sendError('ui.docs', 'Invalid docs path', docsPath);
        return;
      }

      this.outputChannel.appendLine(`[UIHandler] Full path: ${docsFsPath}`);

      // Check if file exists first
      try {
        await this.fileSystem.stat(docsFsPath);
      } catch (statError) {
        const errorMsg = `Docs file not found: ${docsFsPath}`;
        this.outputChannel.appendLine(`[UIHandler] ERROR: ${errorMsg}`);
        this.sendError('ui.docs', 'Docs file not found', errorMsg);
        return;
      }

      // Open beside the webview (the adapter owns the reuse-column-2 logic).
      await this.shell.openFileInEditor(docsFsPath, { beside: true });

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
      // The payload field is a workspace-relative path (joined onto the root below).
      const { path: relativePath } = message.payload;
      this.outputChannel.appendLine(`[UIHandler] Opening resource: ${relativePath}`);

      // Get workspace root
      const workspaceRoot = this.workspace.workspaceFolders()[0]?.path;
      if (!workspaceRoot) {
        const errorMsg = 'No workspace folder open';
        this.outputChannel.appendLine(`[UIHandler] ERROR: ${errorMsg}`);
        this.sendError('ui.resource', errorMsg);
        return;
      }

      // Construct workspace-relative path, contained within the workspace root.
      // relativePath is webview/AI-supplied — reject `..` traversal out of the workspace.
      const resourceFsPath = path.join(workspaceRoot, relativePath);
      if (!isPathWithinRoot(workspaceRoot, resourceFsPath)) {
        this.outputChannel.appendLine(`[UIHandler] ERROR: resource path escapes workspace: ${relativePath}`);
        this.sendError('ui.resource', 'Invalid resource path', relativePath);
        return;
      }
      this.outputChannel.appendLine(`[UIHandler] Full path: ${resourceFsPath}`);

      // Check if file exists first
      try {
        await this.fileSystem.stat(resourceFsPath);
      } catch (statError) {
        const errorMsg = `Resource not found: ${relativePath}`;
        this.outputChannel.appendLine(`[UIHandler] ERROR: ${errorMsg}`);
        this.sendError('ui.resource', 'Resource not found', errorMsg);
        return;
      }

      // Open beside the webview (the adapter owns the reuse-column-2 logic).
      await this.shell.openFileInEditor(resourceFsPath, { beside: true });

      this.outputChannel.appendLine(`[UIHandler] Successfully opened resource: ${relativePath}`);
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
      const selection = this.editor.getActiveSelection();

      let content: string | undefined;
      let sourceUri: string | undefined;
      let relativePath: string | undefined;

      if (selection && !selection.isEmpty) {
        content = selection.text;
        sourceUri = selection.uriString;
        relativePath = selection.relativePath;
      } else {
        // Fallback to clipboard if no selection
        try {
          const clip = await this.shell.readClipboard();
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
