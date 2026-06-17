/**
 * Sources domain messages
 * Active file, manuscript, and chapter glob requests
 */

import { MessageEnvelope, MessageType } from './base';

export interface RequestActiveFileMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.REQUEST_ACTIVE_FILE;
}

export interface ActiveFilePayload {
  relativePath?: string; // undefined if no active file
  sourceUri?: string;
}

export interface ActiveFileMessage extends MessageEnvelope<ActiveFilePayload> {
  type: MessageType.ACTIVE_FILE;
}

export interface RequestManuscriptGlobsMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.REQUEST_MANUSCRIPT_GLOBS;
}

export interface ManuscriptGlobsPayload {
  globs: string; // raw config string
}

export interface ManuscriptGlobsMessage extends MessageEnvelope<ManuscriptGlobsPayload> {
  type: MessageType.MANUSCRIPT_GLOBS;
}

export interface RequestChapterGlobsMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.REQUEST_CHAPTER_GLOBS;
}

export interface ChapterGlobsPayload {
  globs: string; // raw config string
}

export interface ChapterGlobsMessage extends MessageEnvelope<ChapterGlobsPayload> {
  type: MessageType.CHAPTER_GLOBS;
}
