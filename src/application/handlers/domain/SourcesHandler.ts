/**
 * Sources domain handler
 * Handles file and glob request operations
 */

import * as vscode from 'vscode';
import {
  RequestActiveFileMessage,
  RequestManuscriptGlobsMessage,
  RequestChapterGlobsMessage,
  MessageType
} from '../../../shared/types/messages';

export class SourcesHandler {
  constructor(
    private readonly postMessage: (message: any) => void
  ) {}

  async handleRequestActiveFile(message: RequestActiveFileMessage): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const relativePath = editor ? vscode.workspace.asRelativePath(editor.document.uri, false) : undefined;
    const msg = {
      type: MessageType.ACTIVE_FILE,
      relativePath,
      sourceUri: editor?.document.uri.toString(),
      timestamp: Date.now()
    } as const;
    this.postMessage(msg);
  }

  async handleRequestManuscriptGlobs(message: RequestManuscriptGlobsMessage): Promise<void> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const globs = config.get<string>('contextPaths.manuscript') || '';
    const msg = {
      type: MessageType.MANUSCRIPT_GLOBS,
      globs,
      timestamp: Date.now()
    } as const;
    this.postMessage(msg);
  }

  async handleRequestChapterGlobs(message: RequestChapterGlobsMessage): Promise<void> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const globs = config.get<string>('contextPaths.chapters') || '';
    const msg = {
      type: MessageType.CHAPTER_GLOBS,
      globs,
      timestamp: Date.now()
    } as const;
    this.postMessage(msg);
  }
}
