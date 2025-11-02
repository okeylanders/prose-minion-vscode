/**
 * Sources domain handler
 * Handles file and glob request operations
 */

import * as vscode from 'vscode';
import {
  RequestActiveFileMessage,
  RequestManuscriptGlobsMessage,
  RequestChapterGlobsMessage,
  ActiveFileMessage,
  ManuscriptGlobsMessage,
  ChapterGlobsMessage,
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
    const msg: ActiveFileMessage = {
      type: MessageType.ACTIVE_FILE,
      source: 'extension.sources',
      payload: {
        relativePath,
        sourceUri: editor?.document.uri.toString()
      },
      timestamp: Date.now()
    };
    this.postMessage(msg);
  }

  async handleRequestManuscriptGlobs(message: RequestManuscriptGlobsMessage): Promise<void> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const globs = config.get<string>('contextPaths.manuscript') || '';
    const msg: ManuscriptGlobsMessage = {
      type: MessageType.MANUSCRIPT_GLOBS,
      source: 'extension.sources',
      payload: {
        globs
      },
      timestamp: Date.now()
    };
    this.postMessage(msg);
  }

  async handleRequestChapterGlobs(message: RequestChapterGlobsMessage): Promise<void> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const globs = config.get<string>('contextPaths.chapters') || '';
    const msg: ChapterGlobsMessage = {
      type: MessageType.CHAPTER_GLOBS,
      source: 'extension.sources',
      payload: {
        globs
      },
      timestamp: Date.now()
    };
    this.postMessage(msg);
  }
}
