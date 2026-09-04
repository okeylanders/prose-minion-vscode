/** Presentation owner for Workshop's shared Edit/Preview text-sheet workflow. */

import * as React from 'react';
import {
  WorkshopContextAttachmentSnapshot,
  WorkshopExcerptSnapshot,
  WorkshopExcerptSource,
  workshopExcerptSourcePath
} from '@messages';
import type {
  WorkshopAttachmentContentState
} from '@hooks/domain/workshop/useWorkshopRoom';
import type { WorkshopVerifiedExcerpt } from '@hooks/domain/useWorkshopExcerptVerify';

/** What the sheet is being used for; drives kicker, copy, and affordances. */
export type WorkshopTextSheetMode =
  | { kind: 'excerpt'; retainedConversation: boolean }
  | { kind: 'context-new' }
  | { kind: 'context-text'; label: string }
  | { kind: 'context-wizard'; label: string }
  | { kind: 'context-file'; label: string; relativePath?: string };

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
}

export interface WorkshopContextSheetState {
  textSheet: WorkshopTextSheetState | null;
  sheetAttachment?: WorkshopAttachmentContentState;
  verifiedDisplay?: { text: string; note: string };
}

export interface WorkshopContextSheetActions {
  openPasteSheet: () => void;
  openAddTextSheet: () => void;
  openAttachmentSheet: (attachment: WorkshopContextAttachmentSnapshot) => void;
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
  requestShelfReplacement
}: UseWorkshopContextSheetOptions): UseWorkshopContextSheetReturn {
  const [textSheet, setTextSheet] = React.useState<WorkshopTextSheetState | null>(null);

  const closeTextSheet = React.useCallback(() => {
    setTextSheet(null);
    clearAttachmentContent();
  }, [clearAttachmentContent]);

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

  const applyTextSheet = React.useCallback((text: string) => {
    if (!textSheet) {
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
    if (textSheet?.attachmentId) {
      openContextAttachmentFile(textSheet.attachmentId);
    }
  }, [openContextAttachmentFile, textSheet]);

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
    verifiedDisplay,
    openPasteSheet,
    openAddTextSheet,
    openAttachmentSheet,
    addExcerptByPaste,
    addExcerptFromProject,
    applyTextSheet,
    openAttachmentInEditor,
    chooseExcerptFromSheet,
    closeTextSheet,
    persistedState: {}
  };
}
