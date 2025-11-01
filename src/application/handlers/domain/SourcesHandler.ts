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
import { MessageRouter } from '../MessageRouter';

export class SourcesHandler {
  constructor(
    private readonly postMessage: (message: any) => void
  ) {}

  /**
   * Register message routes for sources domain
   */
  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.REQUEST_ACTIVE_FILE, this.handleRequestActiveFile.bind(this));
    router.register(MessageType.REQUEST_MANUSCRIPT_GLOBS, this.handleRequestManuscriptGlobs.bind(this));
    router.register(MessageType.REQUEST_CHAPTER_GLOBS, this.handleRequestChapterGlobs.bind(this));
  }

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
