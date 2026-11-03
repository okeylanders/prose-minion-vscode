/**
 * The Read in reader's transport (ADR 2026-11-03 D4): ask the host for a
 * read-in file's current text by `{ group, path }`, and ask it to open the
 * file beside the Workshop.
 *
 * One request is pending at a time. A reply is taken only while it matches
 * the pair the reader is waiting for, so a late answer for a row the writer
 * already closed never paints into the sheet. Nothing here is persisted: the
 * file on disk is the truth, read again each time.
 */

import * as React from 'react';
import {
  ConfiguredResourceRef,
  MessageType,
  WorkshopReadInResourceContentMessage
} from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';

export interface WorkshopReadInContentState {
  group: string;
  path: string;
  /** Undefined until the host answers, or when it refused. */
  content?: string;
  truncated?: boolean;
  error?: string;
  canOpenInEditor: boolean;
}

export interface WorkshopReadInState {
  readInContent: WorkshopReadInContentState | null;
}

export interface WorkshopReadInActions {
  requestReadInResource: (ref: ConfiguredResourceRef) => void;
  openReadInResource: (ref: ConfiguredResourceRef) => void;
  clearReadInContent: () => void;
  handleReadInResourceContent: (message: WorkshopReadInResourceContentMessage) => void;
}

export interface WorkshopReadInPersistence {
  // The file on disk owns the content; nothing is kept in webview state.
}

export type UseWorkshopReadInReturn = WorkshopReadInState &
  WorkshopReadInActions & {
    persistedState: WorkshopReadInPersistence;
  };

const SOURCE = 'webview.workshop.read-in';

export function useWorkshopReadIn(): UseWorkshopReadInReturn {
  const vscode = useVSCodeApi();
  const [readInContent, setReadInContent] = React.useState<WorkshopReadInContentState | null>(null);

  const post = React.useCallback(
    (type: MessageType, payload: ConfiguredResourceRef) => {
      vscode.postMessage({ type, source: SOURCE, payload, timestamp: Date.now() });
    },
    [vscode]
  );

  const requestReadInResource = React.useCallback((ref: ConfiguredResourceRef) => {
    setReadInContent({ group: ref.group, path: ref.path, canOpenInEditor: false });
    post(MessageType.WORKSHOP_REQUEST_READ_IN_RESOURCE, { group: ref.group, path: ref.path });
  }, [post]);

  const openReadInResource = React.useCallback((ref: ConfiguredResourceRef) => {
    post(MessageType.WORKSHOP_OPEN_READ_IN_RESOURCE, { group: ref.group, path: ref.path });
  }, [post]);

  const clearReadInContent = React.useCallback(() => setReadInContent(null), []);

  const handleReadInResourceContent = React.useCallback(
    (message: WorkshopReadInResourceContentMessage) => {
      const { group, path, content, truncated, error, canOpenInEditor } = message.payload;
      setReadInContent((current) =>
        current?.group === group && current.path === path
          ? { group, path, content, truncated, error, canOpenInEditor }
          : current
      );
    },
    []
  );

  return {
    readInContent,
    requestReadInResource,
    openReadInResource,
    clearReadInContent,
    handleReadInResourceContent,
    persistedState: {}
  };
}
