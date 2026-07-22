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
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  ErrorMessage,
  StatusMessage,
  StreamChunkMessage,
  StreamCompleteMessage,
  StreamStartedMessage,
  WorkshopConfiguredResourceRef,
  WorkshopContextAttachmentSnapshot,
  WorkshopContextCatalogEntry,
  WorkshopContextCatalogMessage,
  WorkshopContextSearchResultsMessage,
  WorkshopContextSearchResultsPayload,
  WorkshopConversationBehavior,
  WorkshopExcerptSnapshot,
  WorkshopExcerptSource,
  WorkshopMessageAttachmentSnapshot,
  WorkshopChatTarget,
  WorkshopPersonaId,
  WorkshopPersonaGuestSnapshot,
  WorkshopSessionStateMessage,
  WorkshopToolSidecarSnapshot,
  WorkshopToolId,
  WorkshopTodoAction,
  WorkshopTodoItem,
  WorkshopTurn,
  WorkshopTurnMessage,
  coerceWorkshopConversationBehavior
} from '@messages';
import { LabeledContextBudgetSnapshot } from '@messages';

/** The one live-run tracker (PR #67 review #8). */
interface LiveRun {
  requestId: string;
  /** 'streaming' = wire open; 'settled' = complete, awaiting the assistant turn. */
  phase: 'streaming' | 'settled';
}

export interface WorkshopState {
  /** True once the first host snapshot has arrived (gate for "empty" UI). */
  sessionReady: boolean;
  excerpt: WorkshopExcerptSnapshot | null;
  contextAttachments: WorkshopContextAttachmentSnapshot[];
  /** Staged one-shot attachments for the writer's next message (Phase 6B). */
  pendingMessageAttachments: WorkshopMessageAttachmentSnapshot[];
  contextPending: boolean;
  /** Configured resource catalog for the Context Selector; null until requested. */
  contextCatalog: WorkshopContextCatalogEntry[] | null;
  /** Latest content-search results for the Context Selector, if any. */
  contextSearch: WorkshopContextSearchResultsPayload | null;
  /** True while the Context wizard streams under 'workshop-context'. */
  wizardRunning: boolean;
  turns: WorkshopTurn[];
  /**
   * Turns held host-side but not present in this webview (a bounded snapshot
   * window bit on reload of a marathon thread). 0 in normal operation.
   */
  hiddenTurns: number;
  /** True when the permanent host has started its retained conversation. */
  hasHostConversation: boolean;
  /** Selected permanent host; restored from the host snapshot on reload. */
  selectedPersonaId: WorkshopPersonaId;
  /** Explicit direct-tool mode, or ordinary host routing. */
  chatTarget: WorkshopChatTarget;
  /**
   * The room's COMMITTED conversation behavior (ADR 2026-07-20 §3) — host
   * truth mirrored from the session snapshot, never a webview draft. The
   * composer chip and modal read this; edits live in modal-local draft state
   * until the host round-trips the applied object.
   */
  conversationBehavior: WorkshopConversationBehavior;
  /** Public metadata for the latest retained sidecar per tool. */
  toolSidecars: WorkshopToolSidecarSnapshot[];
  /** Explicitly invited persona guests, including disposed history markers. */
  personaGuests: WorkshopPersonaGuestSnapshot[];
  contextBudget?: LabeledContextBudgetSnapshot;
  todos: WorkshopTodoItem[];
  /** True when the composer can message the host or selected direct sidecar. */
  canMessage: boolean;
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
  pinExcerpt: (text: string, source?: WorkshopExcerptSource) => void;
  pinFromFile: () => void;
  rereadExcerpt: () => void;
  addContextText: (text: string) => void;
  addContextFile: () => void;
  removeContextAttachment: (id: string) => void;
  requestContextCatalog: () => void;
  searchContextResources: (query: string) => void;
  clearContextSearch: () => void;
  addContextResources: (items: WorkshopConfiguredResourceRef[]) => void;
  attachMessageResources: (items: WorkshopConfiguredResourceRef[]) => void;
  attachMessageFile: () => void;
  removeMessageAttachment: (id: string) => void;
  setExcerptResource: (item: WorkshopConfiguredResourceRef) => void;
  runContextWizard: () => void;
  cancelContextWizard: () => void;
  handleContextCatalog: (message: WorkshopContextCatalogMessage) => void;
  handleContextSearchResults: (message: WorkshopContextSearchResultsMessage) => void;
  runTool: (toolId: WorkshopToolId) => void;
  quickAction: (toolId: WorkshopToolId, reportTurnId: string, label: string) => void;
  sendMessage: (text: string) => void;
  selectPersona: (personaId: WorkshopPersonaId) => void;
  inviteGuest: (personaId: WorkshopPersonaId, openingMessage: string) => void;
  dismissGuest: (personaId: WorkshopPersonaId) => void;
  setChatTarget: (target: WorkshopChatTarget) => void;
  setConversationBehavior: (behavior: WorkshopConversationBehavior) => void;
  todoAction: (action: WorkshopTodoAction) => void;
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
  const [excerpt, setExcerpt] = React.useState<WorkshopExcerptSnapshot | null>(null);
  const [contextAttachments, setContextAttachments] = React.useState<WorkshopContextAttachmentSnapshot[]>([]);
  const [pendingMessageAttachments, setPendingMessageAttachments] = React.useState<WorkshopMessageAttachmentSnapshot[]>([]);
  const [contextPending, setContextPending] = React.useState(false);
  const [contextCatalog, setContextCatalog] = React.useState<WorkshopContextCatalogEntry[] | null>(null);
  const [wizardRun, setWizardRun] = React.useState<string | null>(null);
  const [contextSearch, setContextSearch] = React.useState<WorkshopContextSearchResultsPayload | null>(null);
  const [turns, setTurns] = React.useState<WorkshopTurn[]>([]);
  const [totalTurns, setTotalTurns] = React.useState(0);
  const [hasHostConversation, setHasHostConversation] = React.useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = React.useState<WorkshopPersonaId>('jill');
  const [chatTarget, setChatTargetState] = React.useState<WorkshopChatTarget>({ kind: 'host' });
  const [conversationBehavior, setConversationBehaviorState] =
    React.useState<WorkshopConversationBehavior>({ ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR });
  const [toolSidecars, setToolSidecars] = React.useState<WorkshopToolSidecarSnapshot[]>([]);
  const [personaGuests, setPersonaGuests] = React.useState<WorkshopPersonaGuestSnapshot[]>([]);
  const [contextBudget, setContextBudget] = React.useState<LabeledContextBudgetSnapshot | undefined>();
  const [todos, setTodos] = React.useState<WorkshopTodoItem[]>([]);
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
    (text: string, source?: WorkshopExcerptSource) => {
      post(MessageType.WORKSHOP_SET_EXCERPT, { text, source });
    },
    [post]
  );

  const pinFromFile = React.useCallback(() => {
    post(MessageType.WORKSHOP_PICK_EXCERPT_FILE, {});
  }, [post]);

  const rereadExcerpt = React.useCallback(() => {
    post(MessageType.WORKSHOP_REREAD_EXCERPT, {});
  }, [post]);

  const addContextText = React.useCallback((text: string) => {
    post(MessageType.WORKSHOP_ADD_CONTEXT_TEXT, { text });
  }, [post]);

  const addContextFile = React.useCallback(() => {
    post(MessageType.WORKSHOP_ADD_CONTEXT_FILE, {});
  }, [post]);

  const removeContextAttachment = React.useCallback((id: string) => {
    post(MessageType.WORKSHOP_REMOVE_CONTEXT_ATTACHMENT, { id });
  }, [post]);

  const requestContextCatalog = React.useCallback(() => {
    post(MessageType.WORKSHOP_REQUEST_CONTEXT_CATALOG, {});
  }, [post]);

  const searchContextResources = React.useCallback((query: string) => {
    post(MessageType.WORKSHOP_SEARCH_CONTEXT_RESOURCES, { query });
  }, [post]);

  const clearContextSearch = React.useCallback(() => {
    setContextSearch(null);
  }, []);

  const addContextResources = React.useCallback((items: WorkshopConfiguredResourceRef[]) => {
    if (items.length > 0) {
      post(MessageType.WORKSHOP_ADD_CONTEXT_RESOURCES, { items });
    }
  }, [post]);

  const setExcerptResource = React.useCallback((item: WorkshopConfiguredResourceRef) => {
    post(MessageType.WORKSHOP_SET_EXCERPT_RESOURCE, item);
  }, [post]);

  const attachMessageResources = React.useCallback((items: WorkshopConfiguredResourceRef[]) => {
    if (items.length > 0) {
      post(MessageType.WORKSHOP_ATTACH_MESSAGE_RESOURCES, { items });
    }
  }, [post]);

  const attachMessageFile = React.useCallback(() => {
    post(MessageType.WORKSHOP_ATTACH_MESSAGE_FILE, {});
  }, [post]);

  const removeMessageAttachment = React.useCallback((id: string) => {
    post(MessageType.WORKSHOP_REMOVE_MESSAGE_ATTACHMENT, { id });
  }, [post]);

  const runContextWizard = React.useCallback(() => {
    post(MessageType.WORKSHOP_RUN_CONTEXT_WIZARD, {});
  }, [post]);

  const cancelContextWizard = React.useCallback(() => {
    if (wizardRun) {
      vscode.postMessage(
        createCancelRequestMessage('workshop-context', wizardRun, 'webview.workshop.context')
      );
    }
  }, [vscode, wizardRun]);

  const handleContextCatalog = React.useCallback((message: WorkshopContextCatalogMessage) => {
    setContextCatalog(message.payload.entries);
  }, []);

  const handleContextSearchResults = React.useCallback((message: WorkshopContextSearchResultsMessage) => {
    setContextSearch(message.payload);
  }, []);

  const runTool = React.useCallback(
    (toolId: WorkshopToolId) => {
      setErrorMessage('');
      post(MessageType.WORKSHOP_RUN_TOOL, { toolId });
    },
    [post]
  );

  const quickAction = React.useCallback(
    (toolId: WorkshopToolId, reportTurnId: string, label: string) => {
      setErrorMessage('');
      post(MessageType.WORKSHOP_QUICK_ACTION, { toolId, reportTurnId, label });
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

  const inviteGuest = React.useCallback(
    (personaId: WorkshopPersonaId, openingMessage: string) => {
      setErrorMessage('');
      post(MessageType.WORKSHOP_INVITE_GUEST, { personaId, openingMessage });
    },
    [post]
  );

  const dismissGuest = React.useCallback(
    (personaId: WorkshopPersonaId) => {
      setErrorMessage('');
      post(MessageType.WORKSHOP_DISMISS_GUEST, { personaId });
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

  // Deliberately NO optimistic local update (ADR 2026-07-20 §11): the chip
  // shows the committed value only, so while the handler assembles/validates
  // the system-message replacement batch the old mode stays visible. The new
  // object arrives with the next WORKSHOP_SESSION_STATE.
  const setConversationBehavior = React.useCallback(
    (behavior: WorkshopConversationBehavior) => {
      setErrorMessage('');
      post(MessageType.WORKSHOP_SET_CONVERSATION_BEHAVIOR, { behavior });
    },
    [post]
  );

  const todoAction = React.useCallback(
    (action: WorkshopTodoAction) => {
      setErrorMessage('');
      post(MessageType.WORKSHOP_TODO_ACTION, action);
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
      setContextAttachments(session.contextAttachments ?? []);
      setPendingMessageAttachments(session.pendingMessageAttachments ?? []);
      setContextPending(session.pendingHostUpdate?.context ?? false);
      setTotalTurns(session.totalTurns);
      setHasHostConversation(session.participants.host.hasConversation);
      setSelectedPersonaId(session.participants.host.personaId);
      setChatTargetState(session.participants.chatTarget);
      // Fail-closed hydration (ADR 2026-07-20 §3): an unprovable object
      // degrades to the COMPLETE approved default, never a per-field blend.
      setConversationBehaviorState(coerceWorkshopConversationBehavior(session.conversationBehavior));
      setToolSidecars(session.participants.toolSidecars);
      setPersonaGuests(session.participants.personaGuests);
      setContextBudget(session.contextBudget);
      setTodos(session.todos);
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
      if (domain === 'workshop-context') {
        setWizardRun(requestId);
        return;
      }
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
      if (domain === 'workshop-context') {
        setWizardRun((current) => (current === requestId ? null : current));
        return;
      }
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
  const isPersonaSelectionLocked = hasHostConversation || isRunning;

  return {
    // State
    sessionReady,
    excerpt,
    contextAttachments,
    pendingMessageAttachments,
    contextPending,
    contextCatalog,
    contextSearch,
    wizardRunning: wizardRun !== null,
    turns,
    hiddenTurns,
    hasHostConversation,
    selectedPersonaId,
    chatTarget,
    conversationBehavior,
    toolSidecars,
    personaGuests,
    contextBudget,
    todos,
    canMessage,
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
    rereadExcerpt,
    addContextText,
    addContextFile,
    removeContextAttachment,
    requestContextCatalog,
    searchContextResources,
    clearContextSearch,
    addContextResources,
    attachMessageResources,
    attachMessageFile,
    removeMessageAttachment,
    setExcerptResource,
    runContextWizard,
    cancelContextWizard,
    handleContextCatalog,
    handleContextSearchResults,
    runTool,
    quickAction,
    sendMessage,
    selectPersona,
    inviteGuest,
    dismissGuest,
    setChatTarget,
    setConversationBehavior,
    todoAction,
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
