/**
 * useWorkshop — Domain hook for the Workshop editor tab (ADR 2026-07-03;
 * Sprint 2 session spine, Sprint 3 multi-turn). Mirrors WorkshopHandler, the
 * 12th domain.
 *
 * The hook RENDERS the session; it never owns it. Host-side
 * WorkshopSessionService is the aggregate of record: on mount the hook
 * requests a snapshot (reload-safe rehydration), WORKSHOP_TURN increments the
 * thread live, WORKSHOP_SESSION_STATE reconciles it, and streaming chunks
 * under `domain: 'workshop'` paint the in-flight run. Sprint 3 adds the
 * composer actions: sendMessage continues the retained conversation,
 * cancelRun aborts the in-flight stream, pinFromFile asks the host to seed
 * the excerpt from a file picker.
 *
 * Live-run identity is ONE concept (PR #67 review #8, Parker):
 * `{ requestId, phase }` — `phase: 'streaming'` while the wire is open,
 * `'settled'` in the window between STREAM_COMPLETE and the assistant turn
 * landing (the bubble keeps painting so the thread never flashes empty).
 * It lives in state (drives rendering) with a ref mirror updated through a
 * single setter, so message handlers read current values without stale
 * closures (StrictMode-safe). `currentRequestId` is DERIVED from it.
 */

import * as React from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import { useStreaming } from '../useStreaming';
import { MessageType } from '@shared/types';
import { createCancelRequestMessage } from '@shared/streamingCancelMessages';
import {
  ErrorMessage,
  StatusMessage,
  StreamChunkMessage,
  StreamCompleteMessage,
  StreamStartedMessage,
  WorkshopExcerpt,
  WorkshopChatTarget,
  WorkshopPersonaId,
  WorkshopSessionStateMessage,
  WorkshopToolId,
  WorkshopTurn,
  WorkshopTurnMessage
} from '@messages';

/** The one live-run tracker (PR #67 review #8). */
interface LiveRun {
  requestId: string;
  /** 'streaming' = wire open; 'settled' = complete, awaiting the assistant turn. */
  phase: 'streaming' | 'settled';
}

export interface WorkshopState {
  /** True once the first host snapshot has arrived (gate for "empty" UI). */
  sessionReady: boolean;
  excerpt: WorkshopExcerpt | null;
  turns: WorkshopTurn[];
  /**
   * Turns held host-side but not present in this webview (a bounded snapshot
   * window bit on reload of a marathon thread). 0 in normal operation.
   */
  hiddenTurns: number;
  /** True when the session holds a conversation a follow-up can continue. */
  hasConversation: boolean;
  /** True when the permanent host has started its retained conversation. */
  hasHostConversation: boolean;
  /** Selected permanent host; restored from the host snapshot on reload. */
  selectedPersonaId: WorkshopPersonaId;
  /** Explicit direct-tool mode, or ordinary host routing. */
  chatTarget: WorkshopChatTarget;
  /** True when the composer can message the host or selected direct sidecar. */
  canMessage: boolean;
  /** Legacy name retained for existing Workshop callers; equals canMessage. */
  canFollowUp: boolean;
  /** Host selection becomes immutable once a host run/conversation exists. */
  isPersonaSelectionLocked: boolean;
  /** Last selected tool/lens, retained after completion for reload restore. */
  selectedToolId: WorkshopToolId | null;
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
  pinFromFile: () => void;
  runTool: (toolId: WorkshopToolId) => void;
  quickAction: (toolId: WorkshopToolId, label: string) => void;
  sendMessage: (text: string) => void;
  selectPersona: (personaId: WorkshopPersonaId) => void;
  setChatTarget: (target: WorkshopChatTarget) => void;
  cancelRun: () => void;
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
  const [totalTurns, setTotalTurns] = React.useState(0);
  const [hasConversation, setHasConversation] = React.useState(false);
  const [hasHostConversation, setHasHostConversation] = React.useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = React.useState<WorkshopPersonaId>('jill');
  const [chatTarget, setChatTargetState] = React.useState<WorkshopChatTarget>({ kind: 'host' });
  const [selectedToolId, setSelectedToolId] = React.useState<WorkshopToolId | null>(null);
  const [activeToolId, setActiveToolId] = React.useState<WorkshopToolId | null>(null);
  const [statusMessage, setStatusMessage] = React.useState('');
  const [tickerMessage, setTickerMessage] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');

  // The single live-run tracker: state drives rendering, the ref mirror lets
  // handlers compare without stale closures (StrictMode double-invokes state
  // updaters, so comparisons stay OUT of them). One setter keeps the pair in
  // lockstep — there is exactly one write path.
  const [liveRun, setLiveRunState] = React.useState<LiveRun | null>(null);
  const liveRunRef = React.useRef<LiveRun | null>(null);
  const setLiveRun = React.useCallback((next: LiveRun | null) => {
    liveRunRef.current = next;
    setLiveRunState(next);
  }, []);

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

  const pinFromFile = React.useCallback(() => {
    post(MessageType.WORKSHOP_PICK_EXCERPT_FILE, {});
  }, [post]);

  const runTool = React.useCallback(
    (toolId: WorkshopToolId) => {
      setErrorMessage('');
      post(MessageType.WORKSHOP_RUN_TOOL, { toolId });
    },
    [post]
  );

  const quickAction = React.useCallback(
    (toolId: WorkshopToolId, label: string) => {
      setErrorMessage('');
      post(MessageType.WORKSHOP_QUICK_ACTION, { toolId, label });
    },
    [post]
  );

  const sendMessage = React.useCallback(
    (text: string) => {
      setErrorMessage('');
      post(MessageType.WORKSHOP_SEND_MESSAGE, { text });
    },
    [post]
  );

  const selectPersona = React.useCallback(
    (personaId: WorkshopPersonaId) => {
      setErrorMessage('');
      post(MessageType.WORKSHOP_SELECT_PERSONA, { personaId });
    },
    [post]
  );

  const setChatTarget = React.useCallback(
    (target: WorkshopChatTarget) => {
      setErrorMessage('');
      post(MessageType.WORKSHOP_SET_CHAT_TARGET, target);
    },
    [post]
  );

  const cancelRun = React.useCallback(() => {
    const requestId =
      liveRunRef.current?.phase === 'streaming' ? liveRunRef.current.requestId : null;
    if (requestId) {
      vscode.postMessage(createCancelRequestMessage('workshop', requestId, 'webview.workshop'));
    }
  }, [vscode]);

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
      setTotalTurns(session.totalTurns);
      setHasConversation(session.hasConversation);
      setHasHostConversation(session.participants.host.hasConversation);
      setSelectedPersonaId(session.participants.host.personaId);
      setChatTargetState(session.participants.chatTarget);
      setSelectedToolId(session.selectedToolId ?? null);
      setActiveToolId(session.activeToolId ?? null);
      setTurns((prev) => {
        if (session.truncatedTurns === 0) {
          // Complete snapshot — authoritative wholesale replace.
          return session.turns;
        }
        // Bounded snapshot (PR #67 review #12): the window carries only the
        // most recent turns. Never shrink a live thread — keep the older
        // turns this webview already holds, then reconcile the window.
        const windowIds = new Set(session.turns.map((t) => t.id));
        const older = prev.filter((t) => !windowIds.has(t.id));
        return [...older, ...session.turns];
      });

      const activeRequestId = session.activeRequestId ?? null;
      if (activeRequestId) {
        // A run is in flight (fresh snapshot mid-run, or reload mid-run).
        // Adopt it so incoming chunks attach; pre-reload chunks are gone, but
        // the completed turn arrives whole via WORKSHOP_TURN.
        if (liveRunRef.current?.requestId !== activeRequestId) {
          setLiveRun({ requestId: activeRequestId, phase: 'streaming' });
          streaming.startStreaming();
        }
      } else if (liveRunRef.current) {
        // No run in flight: this snapshot is authoritative — drop any live
        // bubble whose stream already ended (completion, error, or reset).
        setLiveRun(null);
        streaming.reset();
      }
    },
    [setLiveRun, streaming]
  );

  // totalTurns is deliberately NOT bumped here: a snapshot with the
  // authoritative count follows every host mutation, and a replay-cache dupe
  // must not inflate the hidden-turns math.
  const handleTurn = React.useCallback((message: WorkshopTurnMessage) => {
    const { turn } = message.payload;
    setTurns((prev) => (prev.some((t) => t.id === turn.id) ? prev : [...prev, turn]));
  }, []);

  const handleStreamStarted = React.useCallback(
    (message: StreamStartedMessage) => {
      const { domain, requestId } = message.payload;
      if (domain !== 'workshop') {return;}
      setLiveRun({ requestId, phase: 'streaming' });
      streaming.startStreaming();
    },
    [setLiveRun, streaming]
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
      if (liveRunRef.current?.requestId !== requestId) {return;}

      if (cancelled) {
        // Preempted, reset, or failed — nothing more is coming for this run.
        setLiveRun(null);
        streaming.reset();
      } else {
        // Keep the bubble (full buffer) until the assistant turn lands.
        setLiveRun({ requestId, phase: 'settled' });
        streaming.endStreaming();
      }
    },
    [setLiveRun, streaming]
  );

  // Once the assistant turn for the settled stream is in the thread, the live
  // bubble would double-render the same content — retire it. Deps are the
  // turns array + the STABLE reset callback, NOT the streaming object (fresh
  // every render): keying on the object made this fire on endStreaming's own
  // render and retire the bubble before the turn arrived — a visible
  // text → spinner → turn flicker (PR #67 review #16, Blake).
  const resetStreaming = streaming.reset;
  React.useEffect(() => {
    if (liveRunRef.current?.phase === 'settled') {
      setLiveRun(null);
      resetStreaming();
    }
  }, [turns, setLiveRun, resetStreaming]);

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

  // Derived (PR #67 review #8: one tracker, everything else computed).
  const currentRequestId = liveRun?.phase === 'streaming' ? liveRun.requestId : null;
  const isRunning = currentRequestId !== null || activeToolId !== null;
  const hiddenTurns = Math.max(0, totalTurns - turns.length);
  const canMessage = sessionReady && !!excerpt?.text.trim() && !isRunning;
  const canFollowUp = canMessage;
  const isPersonaSelectionLocked = hasHostConversation || isRunning;

  return {
    // State
    sessionReady,
    excerpt,
    turns,
    hiddenTurns,
    hasConversation,
    hasHostConversation,
    selectedPersonaId,
    chatTarget,
    canMessage,
    canFollowUp,
    isPersonaSelectionLocked,
    selectedToolId,
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
    pinFromFile,
    runTool,
    quickAction,
    sendMessage,
    selectPersona,
    setChatTarget,
    cancelRun,
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
