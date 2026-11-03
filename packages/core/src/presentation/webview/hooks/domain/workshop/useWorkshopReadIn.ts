/**
 * The Read in reader's transport (ADR 2026-11-03 D4): ask the host for a
 * read-in file's current text by `{ group, path }`, and ask it to open the
 * file beside the Workshop.
 *
 * One request is pending at a time, under a request id this hook mints. A
 * reply is taken only when it answers that request: the pair names a file,
 * not a request, so a late answer to an earlier opening of the same file
 * (Close, then reopen; or A → B → A) never paints into the sheet (PR #186
 * F-01). Clearing drops the pending id. Nothing here is persisted: the file
 * on disk is the truth, read again each time.
 */

import * as React from 'react';
import {
  ConfiguredResourceRef,
  MessageType,
  WorkshopReadInResourceContentMessage
} from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';

export interface WorkshopReadInContentState {
  /** The request this state belongs to. */
  requestId: string;
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
  // This webview's prefix, so a reloaded webview never takes an answer meant
  // for the one before it.
  const ids = React.useRef({ prefix: `ws-readin-${Math.random().toString(36).slice(2, 10)}`, count: 0 });

  const post = React.useCallback(
    (type: MessageType, payload: ConfiguredResourceRef & { requestId?: string }) => {
      vscode.postMessage({ type, source: SOURCE, payload, timestamp: Date.now() });
    },
    [vscode]
  );

  const requestReadInResource = React.useCallback((ref: ConfiguredResourceRef) => {
    ids.current.count += 1;
    const requestId = `${ids.current.prefix}-${ids.current.count}`;
    setReadInContent({ requestId, group: ref.group, path: ref.path, canOpenInEditor: false });
    post(MessageType.WORKSHOP_REQUEST_READ_IN_RESOURCE, { requestId, group: ref.group, path: ref.path });
  }, [post]);

  const openReadInResource = React.useCallback((ref: ConfiguredResourceRef) => {
    post(MessageType.WORKSHOP_OPEN_READ_IN_RESOURCE, { group: ref.group, path: ref.path });
  }, [post]);

  const clearReadInContent = React.useCallback(() => setReadInContent(null), []);

  const handleReadInResourceContent = React.useCallback(
    (message: WorkshopReadInResourceContentMessage) => {
      const { requestId, group, path, content, truncated, error, canOpenInEditor } = message.payload;
      setReadInContent((current) =>
        current !== null
          && current.requestId === requestId
          && current.group === group
          && current.path === path
          && current.content === undefined
          && current.error === undefined
          ? { requestId, group, path, content, truncated, error, canOpenInEditor }
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
