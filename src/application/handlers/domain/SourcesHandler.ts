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
  MessageType,
  ErrorSource,
  ErrorMessage
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

  // Helper methods (domain owns its message lifecycle)

  private sendError(source: ErrorSource, message: string, details?: string): void {
    const errorMessage: ErrorMessage = {
      type: MessageType.ERROR,
      source: 'extension.sources',
      payload: {
        source,
        message,
        details
      },
      timestamp: Date.now()
    };
    void this.postMessage(errorMessage);
  }

  async handleRequestActiveFile(message: RequestActiveFileMessage): Promise<void> {
    try {
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
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('sources.active_file', 'Failed to get active file', msg);
    }
  }

  async handleRequestManuscriptGlobs(message: RequestManuscriptGlobsMessage): Promise<void> {
    try {
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
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('sources.manuscript_globs', 'Failed to get manuscript globs', msg);
    }
  }

  async handleRequestChapterGlobs(message: RequestChapterGlobsMessage): Promise<void> {
    try {
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
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('sources.chapter_globs', 'Failed to get chapter globs', msg);
    }
  }
}
