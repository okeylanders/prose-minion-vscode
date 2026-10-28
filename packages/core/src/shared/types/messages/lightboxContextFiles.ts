/**
 * Lightbox context files (ADR 2026-10-19 D9): project files that inform
 * readings and are never searched for quotes. Moved from
 * `lightboxReadings.ts` (Slice 4B) so that module keeps within its size as
 * the reading kinds grow; consumers import from `@messages` as before.
 */

import { MessageEnvelope, MessageType } from './base';

/** A project file that informs readings. It is never searched for quotes. */
export interface LightboxContextFile {
  /** Host-minted. */
  id: string;
  displayPath: string;
  wordCount: number;
  /**
   * The file's opaque identity (`LightboxProjectCatalogEntry.fileKey`), so the
   * project picker marks attached only the very file on the shelf (PR #154 F-02).
   */
  fileKey: string;
}

/** "Add context file": the host's file picker is the input. Zero payload. */
export interface LightboxAddContextFilesMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.LIGHTBOX_ADD_CONTEXT_FILES;
}

export interface LightboxRemoveContextFilePayload {
  id: string;
}

export interface LightboxRemoveContextFileMessage extends MessageEnvelope<LightboxRemoveContextFilePayload> {
  type: MessageType.LIGHTBOX_REMOVE_CONTEXT_FILE;
}

export interface LightboxContextFilesPayload {
  files: LightboxContextFile[];
  totalWords: number;
  /** `PROMPT_BUDGETS.contextFiles.words`. */
  ceilingWords: number;
  /** Writer-facing, when an add was refused. */
  notice?: string;
}

export interface LightboxContextFilesMessage extends MessageEnvelope<LightboxContextFilesPayload> {
  type: MessageType.LIGHTBOX_CONTEXT_FILES;
}
