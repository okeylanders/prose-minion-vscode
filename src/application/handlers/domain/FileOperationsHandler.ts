/**
 * File Operations domain handler
 * Handles copy and save operations for results
 */

import * as vscode from 'vscode';
import {
  CopyResultMessage,
  SaveResultMessage,
  SaveResultSuccessMessage,
  SaveResultMetadata,
  MessageType,
  ErrorSource,
  ErrorMessage,
  StatusMessage
} from '../../../shared/types/messages';
import { MessageRouter } from '../MessageRouter';

export class FileOperationsHandler {
  constructor(
    private readonly postMessage: (message: any) => Promise<void>
  ) {}

  /**
   * Register message routes for file operations domain
   */
  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.COPY_RESULT, this.handleCopyResult.bind(this));
    router.register(MessageType.SAVE_RESULT, this.handleSaveResult.bind(this));
  }

  // Helper methods (domain owns its message lifecycle)

  private sendStatus(message: string, guideNames?: string): void {
    const statusMessage: StatusMessage = {
      type: MessageType.STATUS,
      source: 'extension.file_ops',
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
      source: 'extension.file_ops',
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

  async handleCopyResult(message: CopyResultMessage): Promise<void> {
    try {
      const { toolName, content } = message.payload;
      let text = content ?? '';
      if (toolName === 'prose_stats' && /^## Chapter Details/m.test(text)) {
        const answer = await vscode.window.showInformationMessage(
          'Include chapter-by-chapter breakdown in the copied report?',
          { modal: true },
          'Yes',
          'No'
        );
        if (answer === 'No') {
          text = this.stripChapterBreakdown(text);
        } else if (answer !== 'Yes') {
          // Dialog dismissed; keep default (include)
        }
      }

      await vscode.env.clipboard.writeText(text);
      this.sendStatus('Result copied to clipboard.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('file_ops.copy', 'Failed to copy result to clipboard', msg);
    }
  }

  async handleSaveResult(message: SaveResultMessage): Promise<void> {
    try {
      const { toolName, content, metadata } = message.payload;
      let text = content ?? '';
      if (toolName === 'prose_stats' && /^## Chapter Details/m.test(text)) {
        const answer = await vscode.window.showInformationMessage(
          'Include chapter-by-chapter breakdown in the saved report?',
          { modal: true },
          'Yes',
          'No'
        );
        if (answer === 'No') {
          text = this.stripChapterBreakdown(text);
        } else if (answer !== 'Yes') {
          // Dialog dismissed; keep default (include)
        }
      }

      const { relativePath: savedPath, fileUri } = await this.saveResultToFile(toolName, text, metadata);

      const successMessage: SaveResultSuccessMessage = {
        type: MessageType.SAVE_RESULT_SUCCESS,
        source: 'extension.file_ops',
        payload: {
          toolName,
          filePath: savedPath
        },
        timestamp: Date.now()
      };

      this.postMessage(successMessage);
      try {
        await vscode.window.showTextDocument(fileUri, { preview: false });
      } catch {
        // Silently ignore errors opening the file
      }
      this.sendStatus(`Saved result to ${savedPath}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('file_ops.save', 'Failed to save result', msg);
    }
  }

  private stripChapterBreakdown(markdown: string): string {
    // Remove the Chapter Details section from the markdown report only
    const sectionRegex = /^## Chapter Details[\s\S]*?(?=^# |\Z)/m;
    return markdown.replace(sectionRegex, '').trimEnd();
  }

  private async saveResultToFile(toolName: string, content: string, metadata?: SaveResultMetadata): Promise<{ relativePath: string; fileUri: vscode.Uri }> {
    if (!content || !content.trim()) {
      throw new Error('Result content is empty; nothing to save.');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('Open a workspace folder before saving results.');
    }

    const rootUri = workspaceFolder.uri;
    let targetDir: vscode.Uri;
    let fileName: string;
    let fileContent: string;

    if (toolName === 'dictionary_lookup') {
      const rawWord = metadata?.word?.trim() ?? 'entry';
      const sanitizedWord = this.sanitizeFileSegment(rawWord.toLowerCase()) || 'entry';
      targetDir = vscode.Uri.joinPath(rootUri, 'prose-minion', 'dictionary-entries');
      await vscode.workspace.fs.createDirectory(targetDir);
      fileName = `${sanitizedWord}.md`;
      fileContent = content.trim();
    } else if (toolName === 'prose_analysis' || toolName === 'dialogue_analysis') {
      targetDir = vscode.Uri.joinPath(rootUri, 'prose-minion', 'assistant');
      await vscode.workspace.fs.createDirectory(targetDir);

      const prefix = toolName === 'prose_analysis'
        ? 'excerpt-assistant-prose-'
        : 'excerpt-assistant-dialog-beats-';

      const nextCount = await this.getNextSequentialNumber(targetDir, prefix);
      fileName = `${prefix}${nextCount}.md`;

      const excerpt = metadata?.excerpt?.trim() ?? '';
      const context = metadata?.context?.trim() ?? '';
      const source = metadata?.relativePath || metadata?.sourceFileUri;

      const lines: string[] = ['# Excerpt', ''];
      lines.push(excerpt || '(No excerpt captured.)', '');

      if (source) {
        lines.push(`Source: ${source}`, '');
      }

      lines.push('# Context', '');
      lines.push(context || '(No context provided.)', '', '---', '', content.trim());

      fileContent = lines.join('\n');
    } else if (toolName === 'prose_stats' || toolName === 'style_flags' || toolName === 'word_frequency' || toolName === 'word_search' || toolName === 'category_search') {
      targetDir = vscode.Uri.joinPath(rootUri, 'prose-minion', 'reports');
      await vscode.workspace.fs.createDirectory(targetDir);
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const toolSlug = toolName.replace(/_/g, '-');
      fileName = `${toolSlug}-${stamp}.md`;
      fileContent = content.trim();
    } else {
      throw new Error(`Saving results for tool "${toolName}" is not supported yet.`);
    }

    const fileUri = vscode.Uri.joinPath(targetDir, fileName);
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(fileUri, encoder.encode(fileContent));

    return { relativePath: vscode.workspace.asRelativePath(fileUri), fileUri };
  }

  private async getNextSequentialNumber(directory: vscode.Uri, prefix: string): Promise<number> {
    let maxNumber = 0;

    const entries = await vscode.workspace.fs.readDirectory(directory);
    for (const [name, type] of entries) {
      if (type !== vscode.FileType.File) {
        continue;
      }

      if (!name.startsWith(prefix) || !name.endsWith('.md')) {
        continue;
      }

      const match = name.match(new RegExp(`${this.escapeRegExp(prefix)}(\\d+)\\.md$`));
      if (match) {
        const number = Number.parseInt(match[1], 10);
        if (!Number.isNaN(number)) {
          maxNumber = Math.max(maxNumber, number);
        }
      }
    }

    return maxNumber + 1;
  }

  private sanitizeFileSegment(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
