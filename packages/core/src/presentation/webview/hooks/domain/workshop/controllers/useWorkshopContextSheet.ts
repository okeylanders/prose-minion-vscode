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
import type {
  WorkshopReadInContentState,
  WorkshopReadInRequest
} from '@hooks/domain/workshop/useWorkshopReadIn';
import type { ContextSourceEntry } from '@shared/types';
import type { WorkshopTurnPreview } from '@messages';
import type { WorkshopTurnPreviewState } from '@hooks/domain/workshop/useWorkshopBookmarks';

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
      /** The card that recorded the read, when the row names one (Wayfinding D4). */
      turnId?: string;
    }
  /**
   * A turn outside the snapshot's window (ADR 2026-11-03 D6), read-only, as
   * the transcript projects it. Each opening is its own request, and so its
   * own sheet.
   */
  | { kind: 'turn-preview'; turnId: string; requestId: string; label?: string };

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
  requestReadInResource: (request: WorkshopReadInRequest) => void;
  openReadInResource: (ref: ConfiguredResourceRef) => void;
  clearReadInContent: () => void;
  /**
   * Whose reading the reader belongs to: the room generation and the chat
   * target. When it changes, an open reader closes and its pending request
   * is dropped, so a late reply never lands in a room or for a participant
   * it wasn't asked in (PR #186 F-01).
   */
  readInScopeKey: string;
  /** The turn preview's transport (`useWorkshopBookmarks`); closed by the same scope key. */
  turnPreview: WorkshopTurnPreviewState | null;
  requestTurnPreview: (turnId: string) => string;
  clearTurnPreview: () => void;
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
  /** The reader's provenance, from the host's correlated reply (Wayfinding D4). */
  lineRange?: { start: number; end: number };
  changedSinceRead?: boolean;
  /** The turn preview's projected turn, once answered (D6). */
  turnPreview?: WorkshopTurnPreview;
}

export interface WorkshopContextSheetState {
  textSheet: WorkshopTextSheetState | null;
  sheetAttachment?: WorkshopAttachmentContentState;
  /** The open sheet's body, loading and error state; undefined with no sheet. */
  sheetBody?: WorkshopTextSheetBody;
  /**
   * The sheet's lifetime: the sheet seeds its draft once per mount, so each
   * reader request is its own sheet, and a reader replaced in place never
   * keeps the earlier file's body (PR #186 F-02). Authoring modes share one
   * key and behave as before.
   */
  sheetKey?: string;
  verifiedDisplay?: { text: string; note: string };
}

export interface WorkshopContextSheetActions {
  openPasteSheet: () => void;
  openAddTextSheet: () => void;
  openAttachmentSheet: (attachment: WorkshopContextAttachmentSnapshot) => void;
  /** Opens a read-in row in the reader; a row with no configured file opens nothing. */
  openReadInSheet: (entry: ContextSourceEntry, participantLabel: string) => void;
  /** Opens a turn outside the window in the read-only preview, replacing any open sheet. */
  openTurnPreviewSheet: (turnId: string, label?: string) => void;
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

/**
 * The reader's content when it answers the row on screen: the same file, and
 * the same reading (delivery time), so provenance never comes from another row.
 */
const readInReplyFor = (
  content: WorkshopReadInContentState | null,
  mode: Extract<WorkshopTextSheetMode, { kind: 'read-in' }>
): WorkshopReadInContentState | undefined =>
  content !== null
    && content.group === mode.group
    && content.path === mode.path
    && content.deliveredAt === mode.deliveredAt
    ? content
    : undefined;

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
  readInScopeKey,
  turnPreview,
  requestTurnPreview,
  clearTurnPreview
}: UseWorkshopContextSheetOptions): UseWorkshopContextSheetReturn {
  const [textSheet, setTextSheet] = React.useState<WorkshopTextSheetState | null>(null);

  const closeTextSheet = React.useCallback(() => {
    setTextSheet(null);
    clearAttachmentContent();
    clearReadInContent();
    clearTurnPreview();
  }, [clearAttachmentContent, clearReadInContent, clearTurnPreview]);

  const scopeKeyRef = React.useRef(readInScopeKey);
  const closeReaderWhenScopeChanged = React.useCallback(() => {
    if (scopeKeyRef.current === readInScopeKey) {
      return;
    }
    scopeKeyRef.current = readInScopeKey;
    clearReadInContent();
    clearTurnPreview();
    setTextSheet((current) =>
      current?.mode.kind === 'read-in' || current?.mode.kind === 'turn-preview' ? null : current
    );
  }, [clearReadInContent, clearTurnPreview, readInScopeKey]);

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
          deliveredAt: entry.deliveredAt,
          ...(entry.turnId ? { turnId: entry.turnId } : {})
        }
      });
      // The delivery time names the row, so the host answers from its reading.
      requestReadInResource({ ...resource, deliveredAt: entry.deliveredAt });
    },
    [requestReadInResource]
  );

  const openTurnPreviewSheet = React.useCallback((turnId: string, label?: string) => {
    clearAttachmentContent();
    clearReadInContent();
    const requestId = requestTurnPreview(turnId);
    setTextSheet({ mode: { kind: 'turn-preview', turnId, requestId, ...(label ? { label } : {}) } });
  }, [clearAttachmentContent, clearReadInContent, requestTurnPreview]);

  const applyTextSheet = React.useCallback((text: string) => {
    // The reader and the preview are read-only: nothing they show can be applied.
    if (!textSheet || textSheet.mode.kind === 'read-in' || textSheet.mode.kind === 'turn-preview') {
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

  const sheetKey = ((): string | undefined => {
    if (!textSheet) {
      return undefined;
    }
    if (textSheet.mode.kind === 'turn-preview') {
      return `turn-preview:${textSheet.mode.requestId}`;
    }
    if (textSheet.mode.kind !== 'read-in') {
      return 'sheet';
    }
    const { group, path } = textSheet.mode;
    const current = readInReplyFor(readInContent, textSheet.mode)?.requestId ?? `${group}\u0000${path}`;
    return `read-in:${current}`;
  })();

  const sheetBody = ((): WorkshopTextSheetBody | undefined => {
    if (!textSheet) {
      return undefined;
    }
    if (textSheet.mode.kind === 'turn-preview') {
      // Matched to the opening on screen by its request id.
      const reply = turnPreview?.requestId === textSheet.mode.requestId ? turnPreview : undefined;
      return {
        value: reply?.turn?.content,
        loading: reply?.turn === undefined && reply?.error === undefined,
        error: reply?.error,
        canOpenInEditor: false,
        turnPreview: reply?.turn
      };
    }
    if (textSheet.mode.kind === 'read-in') {
      // Matched to the row on screen, as attachments are by id.
      const reply = readInReplyFor(readInContent, textSheet.mode);
      return {
        value: reply?.content,
        loading: reply?.content === undefined && reply?.error === undefined,
        error: reply?.error,
        truncated: reply?.truncated,
        canOpenInEditor: reply?.canOpenInEditor ?? false,
        lineRange: reply?.lineRange,
        changedSinceRead: reply?.changedSinceRead
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
    sheetKey,
    verifiedDisplay,
    openPasteSheet,
    openAddTextSheet,
    openAttachmentSheet,
    openReadInSheet,
    openTurnPreviewSheet,
    addExcerptByPaste,
    addExcerptFromProject,
    applyTextSheet,
    openAttachmentInEditor,
    chooseExcerptFromSheet,
    closeTextSheet,
    persistedState: {}
  };
}
