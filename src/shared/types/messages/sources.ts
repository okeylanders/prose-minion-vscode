/**
 * Sources domain messages
 * Active file, manuscript, and chapter glob requests
 */

import { BaseMessage, MessageType } from './base';

export interface RequestActiveFileMessage extends BaseMessage {
  type: MessageType.REQUEST_ACTIVE_FILE;
}

export interface ActiveFileMessage extends BaseMessage {
  type: MessageType.ACTIVE_FILE;
  relativePath?: string; // undefined if no active file
  sourceUri?: string;
}

export interface RequestManuscriptGlobsMessage extends BaseMessage {
  type: MessageType.REQUEST_MANUSCRIPT_GLOBS;
}

export interface ManuscriptGlobsMessage extends BaseMessage {
  type: MessageType.MANUSCRIPT_GLOBS;
  globs: string; // raw config string
}

export interface RequestChapterGlobsMessage extends BaseMessage {
  type: MessageType.REQUEST_CHAPTER_GLOBS;
}

export interface ChapterGlobsMessage extends BaseMessage {
  type: MessageType.CHAPTER_GLOBS;
  globs: string; // raw config string
}
