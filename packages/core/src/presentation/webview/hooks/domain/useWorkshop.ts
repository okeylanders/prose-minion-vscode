/**
 * useWorkshop — Domain hook for the Workshop editor tab (ADR 2026-07-03,
 * Sprint 2 — session spine). Mirrors WorkshopHandler, the 12th domain.
 *
 * The hook RENDERS the session; it never owns it. Host-side
 * WorkshopSessionService is the aggregate of record: on mount the hook
 * requests a snapshot (reload-safe rehydration), WORKSHOP_TURN increments the
 * thread live, WORKSHOP_SESSION_STATE reconciles it wholesale, and streaming
 * chunks under `domain: 'workshop'` paint the in-flight run. Sprint 2 is
 * single-turn: running a tool starts a fresh turn; free-text follow-ups are
 * Sprint 3.
 */

import * as React from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import { useStreaming } from '../useStreaming';
import { MessageType } from '@shared/types';
import {
  ErrorMessage,
  StatusMessage,
  StreamChunkMessage,
  StreamCompleteMessage,
  StreamStartedMessage,
  WorkshopExcerpt,
  WorkshopSessionStateMessage,
  WorkshopToolId,
  WorkshopTurn,
  WorkshopTurnMessage
} from '@messages';

export interface WorkshopState {
  /** True once the first host snapshot has arrived (gate for "empty" UI). */
  sessionReady: boolean;
  excerpt: WorkshopExcerpt | null;
  turns: WorkshopTurn[];
  /** Tool of the in-flight run (host truth via session state / live events). */
  activeToolId: WorkshopToolId | null;
  /** True while a run is in flight (tool palette disables on this). */
  isRunning: boolean;
  statusMessage: string;
  tickerMessage: string;
  errorMessage: string;
  // Streaming state for the live turn
  isStreaming: boolean;
  isBuffering: boolean;
  streamingContent: string;
  streamingChunkCount: number;
  streamingElapsedMs: number;
  streamingInitialLatencyMs?: number;
  streamingChunksPerSecond: number;
  currentRequestId: string | null;
}

export interface WorkshopActions {
  pinExcerpt: (text: string, sourceUri?: string, relativePath?: string) => void;
  runTool: (toolId: WorkshopToolId) => void;
  resetSession: () => void;
  requestSession: () => void;
  clearError: () => void;
  handleSessionState: (message: WorkshopSessionStateMessage) => void;
  handleTurn: (message: WorkshopTurnMessage) => void;
  handleStreamStarted: (message: StreamStartedMessage) => void;
  handleStreamChunk: (message: StreamChunkMessage) => void;
  handleStreamComplete: (message: StreamCompleteMessage) => void;
  handleStatusMessage: (message: StatusMessage) => void;
  handleErrorMessage: (message: ErrorMessage) => void;
}

/**
 * Intentionally empty: the session IS host state (the sprint's core
 * invariant), so persisting turns webview-side would only shadow the
 * aggregate with a stale copy. The empty `persistedState` keeps the
 * tripartite hook shape every sibling hook honors.
 */
export type WorkshopPersistence = Record<string, never>;

export type UseWorkshopReturn = WorkshopState & WorkshopActions & {
  persistedState: WorkshopPersistence;
};

export const useWorkshop = (): UseWorkshopReturn => {
  const vscode = useVSCodeApi();
  const streaming = useStreaming();

  const [sessionReady, setSessionReady] = React.useState(false);
  const [excerpt, setExcerpt] = React.useState<WorkshopExcerpt | null>(null);
  const [turns, setTurns] = React.useState<WorkshopTurn[]>([]);
  const [activeToolId, setActiveToolId] = React.useState<WorkshopToolId | null>(null);
  const [currentRequestId, setCurrentRequestId] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState('');
  const [tickerMessage, setTickerMessage] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');

  // The streamed run whose bubble is still on screen. Survives STREAM_COMPLETE
  // until the assistant turn (or the post-error session state) lands, so the
  // thread never flashes empty between "stream done" and "turn arrived".
  const liveRunRef = React.useRef<{ requestId: string; settled: boolean } | null>(null);
  // Mirror of currentRequestId for handler logic — comparisons stay out of
  // state updaters (StrictMode double-invokes those; side effects there leak).
  const currentRequestIdRef = React.useRef<string | null>(null);

  const post = React.useCallback(
    (type: MessageType, payload: unknown) => {
      vscode.postMessage({
        type,
        source: 'webview.workshop',
        payload,
        timestamp: Date.now()
      });
    },
    [vscode]
  );

  // Actions (webview → extension)

  const pinExcerpt = React.useCallback(
    (text: string, sourceUri?: string, relativePath?: string) => {
      post(MessageType.WORKSHOP_SET_EXCERPT, { text, sourceUri, relativePath });
    },
    [post]
  );

  const runTool = React.useCallback(
    (toolId: WorkshopToolId) => {
      setErrorMessage('');
      post(MessageType.WORKSHOP_RUN_TOOL, { toolId });
    },
    [post]
  );

  const resetSession = React.useCallback(() => {
    setErrorMessage('');
    post(MessageType.WORKSHOP_RESET_SESSION, {});
  }, [post]);

  const requestSession = React.useCallback(() => {
    post(MessageType.WORKSHOP_REQUEST_SESSION, {});
  }, [post]);

  const clearError = React.useCallback(() => setErrorMessage(''), []);

  // Rehydration: ask the host for the session once on mount. A reload lands
  // here too — the reply rebuilds the whole thread (ADR reload-safety).
  React.useEffect(() => {
    requestSession();
  }, [requestSession]);

  // Message handlers (extension → webview)

  const handleSessionState = React.useCallback(
    (message: WorkshopSessionStateMessage) => {
      const { session } = message.payload;
      setSessionReady(true);
      setExcerpt(session.excerpt ?? null);
      setTurns(session.turns);
      setActiveToolId(session.activeToolId ?? null);

      const activeRequestId = session.activeRequestId ?? null;
      if (activeRequestId) {
        // A run is in flight (fresh snapshot mid-run, or reload mid-run).
        // Adopt it so incoming chunks attach; pre-reload chunks are gone, but
        // the completed turn arrives whole via WORKSHOP_TURN.
        if (currentRequestIdRef.current !== activeRequestId) {
          currentRequestIdRef.current = activeRequestId;
          liveRunRef.current = { requestId: activeRequestId, settled: false };
          setCurrentRequestId(activeRequestId);
          streaming.startStreaming();
        }
      } else {
        // No run in flight: this snapshot is authoritative — drop any live
        // bubble whose stream already ended (completion, error, or reset).
        currentRequestIdRef.current = null;
        setCurrentRequestId(null);
        if (liveRunRef.current) {
          liveRunRef.current = null;
          streaming.reset();
        }
      }
    },
    [streaming]
  );

  const handleTurn = React.useCallback((message: WorkshopTurnMessage) => {
    const { turn } = message.payload;
    setTurns((prev) => (prev.some((t) => t.id === turn.id) ? prev : [...prev, turn]));
  }, []);

  const handleStreamStarted = React.useCallback(
    (message: StreamStartedMessage) => {
      const { domain, requestId } = message.payload;
      if (domain !== 'workshop') {return;}
      currentRequestIdRef.current = requestId;
      liveRunRef.current = { requestId, settled: false };
      setCurrentRequestId(requestId);
      streaming.startStreaming();
    },
    [streaming]
  );

  const handleStreamChunk = React.useCallback(
    (message: StreamChunkMessage) => {
      const { domain, requestId, token } = message.payload;
      if (domain !== 'workshop') {return;}
      if (liveRunRef.current?.requestId !== requestId) {return;}
      streaming.appendToken(token);
    },
    [streaming]
  );

  const handleStreamComplete = React.useCallback(
    (message: StreamCompleteMessage) => {
      const { domain, requestId, cancelled } = message.payload;
      if (domain !== 'workshop') {return;}
      const liveRun = liveRunRef.current;
      if (liveRun?.requestId !== requestId) {return;}

      currentRequestIdRef.current = null;
      setCurrentRequestId(null);
      if (cancelled) {
        // Preempted, reset, or failed — nothing more is coming for this run.
        liveRunRef.current = null;
        streaming.reset();
      } else {
        // Keep the bubble (full buffer) until the assistant turn lands.
        liveRun.settled = true;
        streaming.endStreaming();
      }
    },
    [streaming]
  );

  // Once the assistant turn for the settled stream is in the thread, the live
  // bubble would double-render the same content — retire it.
  React.useEffect(() => {
    if (liveRunRef.current?.settled) {
      liveRunRef.current = null;
      streaming.reset();
    }
  }, [turns, streaming]);

  const handleStatusMessage = React.useCallback((message: StatusMessage) => {
    // Only this domain's status: the shared services also feed dictionary /
    // search progress to every webview, which is sidebar UI, not Workshop UI.
    if (message.source !== 'extension.workshop') {return;}
    setStatusMessage(message.payload.message);
    setTickerMessage(message.payload.tickerMessage || '');
  }, []);

  const handleErrorMessage = React.useCallback((message: ErrorMessage) => {
    const { source, message: text, details } = message.payload;
    if (typeof source !== 'string' || !source.startsWith('workshop')) {return;}
    setErrorMessage(details ? `${text} — ${details}` : text);
    setStatusMessage('');
    setTickerMessage('');
  }, []);

  const isRunning = currentRequestId !== null || activeToolId !== null;

  return {
    // State
    sessionReady,
    excerpt,
    turns,
    activeToolId,
    isRunning,
    statusMessage,
    tickerMessage,
    errorMessage,
    isStreaming: streaming.isStreaming,
    isBuffering: streaming.isBuffering,
    streamingContent: streaming.displayContent,
    streamingChunkCount: streaming.chunkCount,
    streamingElapsedMs: streaming.elapsedMs,
    streamingInitialLatencyMs: streaming.initialLatencyMs,
    streamingChunksPerSecond: streaming.chunksPerSecond,
    currentRequestId,

    // Actions
    pinExcerpt,
    runTool,
    resetSession,
    requestSession,
    clearError,
    handleSessionState,
    handleTurn,
    handleStreamStarted,
    handleStreamChunk,
    handleStreamComplete,
    handleStatusMessage,
    handleErrorMessage,

    // Persistence
    persistedState: {}
  };
};
