/**
 * useStartupNotice — the Workshop's six-page beta notice (Sprint 14 §5).
 *
 * The webview never decides visibility on its own: it asks the host on mount,
 * the host answers from per-machine GlobalStateStore against the current
 * notice version, and dismissal is only RECORDED when the writer checks
 * "Don't show again" (a plain dismiss closes locally and sends nothing, so
 * the box returns next launch — mirroring the approved comp's semantics).
 */
import * as React from 'react';
import { MessageType, StartupNoticeDataMessage } from '@messages';
import { useVSCodeApi } from '../useVSCodeApi';

export interface StartupNoticeState {
  noticeOpen: boolean;
}

export interface StartupNoticeActions {
  requestStartupNotice: () => void;
  handleStartupNoticeData: (message: StartupNoticeDataMessage) => void;
  /** Close the notice; record the dismissal host-side only when asked to. */
  dismissStartupNotice: (dontShowAgain: boolean) => void;
}

/**
 * Intentionally empty: visibility is host-owned truth (GlobalStateStore), so
 * persisting it webview-side could only disagree with the host. The empty
 * `persistedState` keeps the tripartite hook shape every sibling honors.
 */
export type StartupNoticePersistence = Record<string, never>;

export type UseStartupNoticeReturn = StartupNoticeState & StartupNoticeActions & {
  persistedState: StartupNoticePersistence;
};

export function useStartupNotice(): UseStartupNoticeReturn {
  const vscode = useVSCodeApi();

  const [noticeOpen, setNoticeOpen] = React.useState(false);
  /** The host-declared content version, echoed back on a recorded dismissal. */
  const noticeVersionRef = React.useRef<string | null>(null);

  const requestStartupNotice = React.useCallback(() => {
    vscode.postMessage({
      type: MessageType.REQUEST_STARTUP_NOTICE,
      source: 'webview.workshop',
      payload: {},
      timestamp: Date.now()
    });
  }, [vscode]);

  const handleStartupNoticeData = React.useCallback((message: StartupNoticeDataMessage) => {
    noticeVersionRef.current = message.payload.noticeVersion;
    setNoticeOpen(message.payload.shouldShow);
  }, []);

  const dismissStartupNotice = React.useCallback(
    (dontShowAgain: boolean) => {
      setNoticeOpen(false);
      if (dontShowAgain && noticeVersionRef.current !== null) {
        vscode.postMessage({
          type: MessageType.DISMISS_STARTUP_NOTICE,
          source: 'webview.workshop',
          payload: { noticeVersion: noticeVersionRef.current },
          timestamp: Date.now()
        });
      }
    },
    [vscode]
  );

  return {
    noticeOpen,
    requestStartupNotice,
    handleStartupNoticeData,
    dismissStartupNotice,
    persistedState: {}
  };
}
