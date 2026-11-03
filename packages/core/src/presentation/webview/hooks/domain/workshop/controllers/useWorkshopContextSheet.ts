/** Presentation owner for Workshop's shared Edit/Preview text-sheet workflow. */

import * as React from 'react';
import {
  ConfiguredResourceRef,
  WorkshopContextAttachmentSnapshot,
  WorkshopExcerptSnapshot,
  WorkshopExcerptSource,
  workshopExcerptSourcePath
} from '@messages';
import type {
  WorkshopAttachmentContentState
} from '@hooks/domain/workshop/useWorkshopRoom';
import type { WorkshopVerifiedExcerpt } from '@hooks/domain/useWorkshopExcerptVerify';
import type { WorkshopReadInContentState } from '@hooks/domain/workshop/useWorkshopReadIn';
import type { ContextSourceEntry } from '@shared/types';

/** What the sheet is being used for; drives kicker, copy, and affordances. */
export type WorkshopTextSheetMode =
  | { kind: 'excerpt'; retainedConversation: boolean }
  | { kind: 'context-new' }
  | { kind: 'context-text'; label: string }
  | { kind: 'context-wizard'; label: string }
  | { kind: 'context-file'; label: string; relativePath?: string }
  /**
   * A file a participant read on its own (ADR 2026-11-03 D4): read-only,
   * the file as it is now, never the participant's copy.
   */
  | {
      kind: 'read-in';
      label: string;
      group: ConfiguredResourceRef['group'];
      path: string;
      participantLabel: string;
      deliveredAt: number;
    };

export interface WorkshopTextSheetState {
  mode: WorkshopTextSheetMode;
  attachmentId?: string;
  seed?: string;
}

export interface UseWorkshopContextSheetOptions {
  hasHostConversation: boolean;
  excerpt: WorkshopExcerptSnapshot | null;
  attachmentContent: WorkshopAttachmentContentState | null;
  verifiedExcerpt: WorkshopVerifiedExcerpt | null;
  shelvedPassageIsUnrecoverable: boolean;
  clearAttachmentContent: () => void;
  requestContextAttachment: (id: string) => void;
  openContextAttachmentFile: (id: string) => void;
  pinExcerpt: (text: string, source?: WorkshopExcerptSource) => void;
  addContextText: (text: string) => void;
  updateContextText: (id: string, text: string) => void;
  openExcerptSelector: () => void;
  requestShelfReplacement: (resume: 'paste' | 'choose') => void;
  /** The Read in reader's transport (`useWorkshopReadIn`). */
  readInContent: WorkshopReadInContentState | null;
  requestReadInResource: (ref: ConfiguredResourceRef) => void;
  openReadInResource: (ref: ConfiguredResourceRef) => void;
  clearReadInContent: () => void;
  /**
   * Whose reading the reader belongs to: the room generation and the chat
   * target. When it changes, an open reader closes and its pending request
   * is dropped, so a late reply never lands in a room or for a participant
   * it wasn't asked in (PR #186 F-01).
   */
  readInScopeKey: string;
}

/** What the open sheet shows, whichever host round-trip feeds it. */
export interface WorkshopTextSheetBody {
  /** Undefined while the host is still answering, or when it refused. */
  value?: string;
  loading: boolean;
  error?: string;
  /** True when the host stopped the text at its read ceiling. */
  truncated?: boolean;
  canOpenInEditor: boolean;
}

export interface WorkshopContextSheetState {
  textSheet: WorkshopTextSheetState | null;
  sheetAttachment?: WorkshopAttachmentContentState;
  /** The open sheet's body, loading and error state; undefined with no sheet. */
  sheetBody?: WorkshopTextSheetBody;
  verifiedDisplay?: { text: string; note: string };
}

export interface WorkshopContextSheetActions {
  openPasteSheet: () => void;
  openAddTextSheet: () => void;
  openAttachmentSheet: (attachment: WorkshopContextAttachmentSnapshot) => void;
  /** Opens a read-in row in the reader; a row with no configured file opens nothing. */
  openReadInSheet: (entry: ContextSourceEntry, participantLabel: string) => void;
  addExcerptByPaste: () => void;
  addExcerptFromProject: () => void;
  applyTextSheet: (text: string) => void;
  openAttachmentInEditor: () => void;
  chooseExcerptFromSheet: () => void;
  closeTextSheet: () => void;
}

export interface WorkshopContextSheetPersistence {
  // Host/session storage owns every durable value in this domain.
}

export type UseWorkshopContextSheetReturn = WorkshopContextSheetState &
  WorkshopContextSheetActions & {
    persistedState: WorkshopContextSheetPersistence;
  };

export function useWorkshopContextSheet({
  hasHostConversation,
  excerpt,
  attachmentContent,
  verifiedExcerpt,
  shelvedPassageIsUnrecoverable,
  clearAttachmentContent,
  requestContextAttachment,
  openContextAttachmentFile,
  pinExcerpt,
  addContextText,
  updateContextText,
  openExcerptSelector,
  requestShelfReplacement,
  readInContent,
  requestReadInResource,
  openReadInResource,
  clearReadInContent,
  readInScopeKey
}: UseWorkshopContextSheetOptions): UseWorkshopContextSheetReturn {
  const [textSheet, setTextSheet] = React.useState<WorkshopTextSheetState | null>(null);

  const closeTextSheet = React.useCallback(() => {
    setTextSheet(null);
    clearAttachmentContent();
    clearReadInContent();
  }, [clearAttachmentContent, clearReadInContent]);

  const scopeKeyRef = React.useRef(readInScopeKey);
  const closeReaderWhenScopeChanged = React.useCallback(() => {
    if (scopeKeyRef.current === readInScopeKey) {
      return;
    }
    scopeKeyRef.current = readInScopeKey;
    clearReadInContent();
    setTextSheet((current) => (current?.mode.kind === 'read-in' ? null : current));
  }, [clearReadInContent, readInScopeKey]);

  React.useEffect(() => {
    closeReaderWhenScopeChanged();
  }, [closeReaderWhenScopeChanged]);

  const openPasteSheet = React.useCallback(() => {
    setTextSheet({
      mode: { kind: 'excerpt', retainedConversation: hasHostConversation },
      seed: excerpt?.text ?? ''
    });
  }, [excerpt, hasHostConversation]);

  const addExcerptByPaste = React.useCallback(() => {
    if (shelvedPassageIsUnrecoverable) {
      requestShelfReplacement('paste');
      return;
    }
    openPasteSheet();
  }, [openPasteSheet, requestShelfReplacement, shelvedPassageIsUnrecoverable]);

  const addExcerptFromProject = React.useCallback(() => {
    if (shelvedPassageIsUnrecoverable) {
      requestShelfReplacement('choose');
      return;
    }
    openExcerptSelector();
  }, [openExcerptSelector, requestShelfReplacement, shelvedPassageIsUnrecoverable]);

  const openAddTextSheet = React.useCallback(() => {
    setTextSheet({ mode: { kind: 'context-new' }, seed: '' });
  }, []);

  const openAttachmentSheet = React.useCallback(
    (attachment: WorkshopContextAttachmentSnapshot) => {
      const mode: WorkshopTextSheetMode = attachment.kind === 'file'
        ? {
            kind: 'context-file',
            label: attachment.label,
            relativePath: attachment.relativePath
          }
        : attachment.origin === 'wizard'
          ? { kind: 'context-wizard', label: attachment.label }
          : { kind: 'context-text', label: attachment.label };
      if (attachment.content !== undefined) {
        setTextSheet({ mode, attachmentId: attachment.id, seed: attachment.content });
        return;
      }
      setTextSheet({ mode, attachmentId: attachment.id });
      requestContextAttachment(attachment.id);
    },
    [requestContextAttachment]
  );

  const openReadInSheet = React.useCallback(
    (entry: ContextSourceEntry, participantLabel: string) => {
      const resource = entry.configuredResource;
      if (entry.kind !== 'resource' || !resource) {
        return;
      }
      setTextSheet({
        mode: {
          kind: 'read-in',
          label: entry.label,
          group: resource.group,
          path: resource.path,
          participantLabel,
          deliveredAt: entry.deliveredAt
        }
      });
      requestReadInResource(resource);
    },
    [requestReadInResource]
  );

  const applyTextSheet = React.useCallback((text: string) => {
    // The reader is read-only: nothing it shows can be applied.
    if (!textSheet || textSheet.mode.kind === 'read-in') {
      return;
    }
    if (textSheet.mode.kind === 'excerpt') {
      // Verified provenance survives the move into the sheet: the claim
      // applies only while the applied text still equals what the host
      // verified against the editor selection.
      pinExcerpt(
        text,
        verifiedExcerpt !== null && text === verifiedExcerpt.text
          ? verifiedExcerpt.source
          : undefined
      );
    } else if (textSheet.attachmentId) {
      updateContextText(textSheet.attachmentId, text);
    } else {
      addContextText(text);
    }
    closeTextSheet();
  }, [
    addContextText,
    closeTextSheet,
    pinExcerpt,
    textSheet,
    updateContextText,
    verifiedExcerpt
  ]);

  const openAttachmentInEditor = React.useCallback(() => {
    if (textSheet?.mode.kind === 'read-in') {
      openReadInResource({ group: textSheet.mode.group, path: textSheet.mode.path });
      return;
    }
    if (textSheet?.attachmentId) {
      openContextAttachmentFile(textSheet.attachmentId);
    }
  }, [openContextAttachmentFile, openReadInResource, textSheet]);

  const chooseExcerptFromSheet = React.useCallback(() => {
    setTextSheet(null);
    openExcerptSelector();
  }, [openExcerptSelector]);

  // The fetched body, matched to the sheet that asked for it: a late reply for
  // a pill the writer already closed must never paint into the open sheet.
  const sheetAttachment = textSheet?.attachmentId !== undefined &&
    attachmentContent?.id === textSheet.attachmentId
    ? attachmentContent
    : undefined;

  const sheetBody = ((): WorkshopTextSheetBody | undefined => {
    if (!textSheet) {
      return undefined;
    }
    if (textSheet.mode.kind === 'read-in') {
      const { group, path } = textSheet.mode;
      // Matched to the row on screen, as attachments are by id.
      const reply = readInContent?.group === group && readInContent.path === path
        ? readInContent
        : undefined;
      return {
        value: reply?.content,
        loading: reply?.content === undefined && reply?.error === undefined,
        error: reply?.error,
        truncated: reply?.truncated,
        canOpenInEditor: reply?.canOpenInEditor ?? false
      };
    }
    return {
      value: textSheet.seed ?? sheetAttachment?.content,
      loading: textSheet.seed === undefined
        && sheetAttachment !== undefined
        && sheetAttachment.content === undefined
        && sheetAttachment.error === undefined,
      error: sheetAttachment?.error,
      canOpenInEditor: sheetAttachment?.canOpenInEditor ?? false
    };
  })();

  const verifiedDisplay = textSheet?.mode.kind === 'excerpt' &&
    verifiedExcerpt?.source.kind === 'editor-selection'
    ? (() => {
        const note = workshopExcerptSourcePath(verifiedExcerpt.source);
        return note ? { text: verifiedExcerpt.text, note } : undefined;
      })()
    : undefined;

  return {
    textSheet,
    sheetAttachment,
    sheetBody,
    verifiedDisplay,
    openPasteSheet,
    openAddTextSheet,
    openAttachmentSheet,
    openReadInSheet,
    addExcerptByPaste,
    addExcerptFromProject,
    applyTextSheet,
    openAttachmentInEditor,
    chooseExcerptFromSheet,
    closeTextSheet,
    persistedState: {}
  };
}
