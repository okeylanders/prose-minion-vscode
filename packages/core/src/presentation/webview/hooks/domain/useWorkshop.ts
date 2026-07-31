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
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS,
  ErrorMessage,
  StatusMessage,
  StreamChunkMessage,
  StreamCompleteMessage,
  StreamStartedMessage,
  WorkshopConfiguredResourceRef,
  WorkshopContextAttachmentContentMessage,
  WorkshopContextAttachmentSnapshot,
  WorkshopContextCatalogEntry,
  WorkshopContextCatalogMessage,
  WorkshopContextSearchResultsMessage,
  WorkshopContextSearchResultsPayload,
  WorkshopConversationDegradation,
  WorkshopConversationBehavior,
  WorkshopExcerptSnapshot,
  WorkshopExcerptSource,
  WorkshopMessageAttachmentSnapshot,
  WorkshopChatTarget,
  WorkshopPersonaId,
  WorkshopPersonaGuestSnapshot,
  WorkshopSessionSaveStatusMessage,
  WorkshopSessionActionResultMessage,
  WorkshopSessionAction,
  WorkshopSelectableSessionScope,
  WorkshopSessionScope,
  WorkshopSessionSummary,
  WorkshopSessionStateMessage,
  WorkshopSessionsDataMessage,
  WorkshopToolSidecarSnapshot,
  WorkshopToolId,
  WorkshopTodoAction,
  WorkshopTodoItem,
  WorkshopTurn,
  WorkshopTurnMessage,
  WorkshopWriterProfile,
  WorkshopWebResearchSettings,
  WorkshopWidgetConfigSummary,
  WorkshopStandingDirectiveSummary,
  WorkshopWidgetConfigDataMessage,
  WorkshopWidgetConfigSnapshot,
  WorkshopWidgetGeneratePayload,
  WorkshopWidgetGenerationProgressMessage,
  WorkshopWidgetGenerationProgressPayload,
  WorkshopWidgetMenuResultMessage,
  WorkshopWidgetMenuResultPayload,
  WorkshopWidgetActionResultMessage,
  WorkshopWidgetActionResultPayload,
  WorkshopCommitWidgetPayload,
  coerceWorkshopConversationBehavior,
  coerceWorkshopWriterProfile,
  coerceWorkshopWebResearchSettings
} from '@messages';
import { LabeledContextBudgetSnapshot } from '@messages';

/**
 * One attachment body, fetched on demand for the Edit/Preview sheet (Sprint 13A
 * §7). Attachment content is prompt-bearing host state under a shared 50,000-word
 * budget, so it deliberately does not ride every session snapshot.
 */
export interface WorkshopAttachmentContentState {
  id: string;
  content?: string;
  error?: string;
  canOpenInEditor: boolean;
}

/** The one live-run tracker (PR #67 review #8). */
interface LiveRun {
  requestId: string;
  /** 'streaming' = wire open; 'settled' = complete, awaiting the assistant turn. */
  phase: 'streaming' | 'settled';
}

export interface WorkshopState {
  /** True once the first host snapshot has arrived (gate for "empty" UI). */
  sessionReady: boolean;
  /** Persistence is host truth; a false value is an explicit workspace policy, never a silent fallback. */
  persistenceAvailable: boolean;
  persistenceUnavailableReason?: 'no-workspace' | 'multi-root';
  currentCheckpointProtected: boolean;
  /** Affected logical persona keys when a persisted archive used T2 recovery. */
  degradedConversationKeys: string[];
  degradedConversations: WorkshopConversationDegradation[];
  excerpt: WorkshopExcerptSnapshot | null;
  /**
   * Explicit session scope (Sprint 13A §1). EVERY surface keys off this —
   * center view, header meta, composer, rail — so nothing has to guess what
   * kind of room this is from whether `excerpt` happens to be set.
   */
  scope: WorkshopSessionScope;
  /** The passage set aside for an open conversation; re-pinnable, never deleted. */
  shelvedExcerpt: WorkshopExcerptSnapshot | null;
  /** True when a shelved passage still has to be withdrawn from the host. */
  /**
   * The scope lock (ADR 2026-07-25): true once ANY participant holds a
   * conversation. Every surface offering to change the session path must hide
   * that offer once this is true and point at a new session instead.
   */
  roomHasMemory: boolean;
  /** Attachment bodies fetched on demand for the Edit/Preview sheet. */
  attachmentContent: WorkshopAttachmentContentState | null;
  contextAttachments: WorkshopContextAttachmentSnapshot[];
  /** Staged one-shot attachments for the writer's next message (Phase 6B). */
  pendingMessageAttachments: WorkshopMessageAttachmentSnapshot[];
  /**
   * Persisted widget authoring configs by stable `wc-N` id (ADR 2026-07-22) —
   * host truth mirrored from the session snapshot; chips re-hydrate from it.
   */
  widgetConfigs: WorkshopWidgetConfigSummary[];
  /** Active host-owned prose directives for the standing rail. */
  standingDirectives: WorkshopStandingDirectiveSummary[];
  /** Full config fetched only when a committed widget chip is opened. */
  widgetConfigData: WorkshopWidgetConfigSnapshot | null;
  widgetConfigResponseId: string | null;
  widgetConfigError: string | null;
  /** Latest generate result; the modal drops results whose token is stale. */
  widgetMenuResult: WorkshopWidgetMenuResultPayload | null;
  /** Token-keyed live progress for the private pre-commit model call. */
  widgetGenerationProgress: WorkshopWidgetGenerationProgressPayload | null;
  /** Latest commit outcome; consumed by the open widget modal. */
  widgetActionResult: WorkshopWidgetActionResultPayload | null;
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
  /** Global profile mirrored beside, never inside, the host session snapshot. */
  writerProfile: WorkshopWriterProfile;
  webResearch: WorkshopWebResearchSettings;
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
  /** Browser data remains host-owned and is intentionally summary-only. */
  sessionsAvailable: boolean | null;
  sessionsUnavailableReason?: 'no-workspace' | 'multi-root';
  currentSessionSummary?: WorkshopSessionSummary;
  /** Stable active named-room identity; browser search results must not erase it. */
  activeNamedSessionSummary?: WorkshopSessionSummary;
  savedSessionSummaries: WorkshopSessionSummary[];
  sessionsTruncated: boolean;
  sessionsSearchTruncated: boolean;
  sessionsPending: boolean;
  sessionsError?: string;
  sessionSearchQuery: string;
  sessionActionPending?: WorkshopSessionAction;
  sessionActionResult?: WorkshopSessionActionResultMessage['payload'];
  sessionSaveStatus?: WorkshopSessionSaveStatusMessage['payload'];
}

export interface WorkshopActions {
  pinExcerpt: (text: string, source?: WorkshopExcerptSource) => void;
  pinFromFile: () => void;
  rereadExcerpt: () => void;
  addContextText: (text: string) => void;
  addContextFile: () => void;
  removeContextAttachment: (id: string) => void;
  updateContextText: (id: string, text: string) => void;
  requestContextAttachment: (id: string) => void;
  openContextAttachmentFile: (id: string) => void;
  clearAttachmentContent: () => void;
  setSessionScope: (scope: WorkshopSelectableSessionScope) => void;
  repinExcerpt: () => void;
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
  handleContextAttachmentContent: (message: WorkshopContextAttachmentContentMessage) => void;
  handleContextSearchResults: (message: WorkshopContextSearchResultsMessage) => void;
  runTool: (toolId: WorkshopToolId) => void;
  quickAction: (toolId: WorkshopToolId, reportTurnId: string, label: string) => void;
  sendMessage: (text: string) => void;
  selectPersona: (personaId: WorkshopPersonaId) => void;
  inviteGuest: (personaId: WorkshopPersonaId, openingMessage: string) => void;
  dismissGuest: (personaId: WorkshopPersonaId) => void;
  setChatTarget: (target: WorkshopChatTarget) => void;
  setConversationSettings: (
    behavior: WorkshopConversationBehavior,
    writerProfile: WorkshopWriterProfile,
    webResearch?: WorkshopWebResearchSettings
  ) => void;
  todoAction: (action: WorkshopTodoAction) => void;
  cancelRun: () => void;
  resetSession: (options?: { clearWorkingSet?: boolean }) => void;
  requestSession: () => void;
  requestSessions: (query?: string) => void;
  setSessionSearchQuery: (query: string) => void;
  saveSession: (title: string, sessionId?: string) => void;
  openSession: (sessionId: string) => void;
  renameSession: (sessionId: string, title: string) => void;
  duplicateSession: (sessionId: string, title?: string) => void;
  revealSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  consumeSessionActionResult: () => void;
  clearError: () => void;
  generateWidgetMenu: (payload: WorkshopWidgetGeneratePayload) => void;
  cancelWidgetGenerate: (requestId: string) => void;
  requestWidgetConfig: (configId: string) => void;
  clearWidgetConfigData: () => void;
  commitWidget: (payload: WorkshopCommitWidgetPayload) => void;
  consumeWidgetActionResult: () => void;
  handleWidgetMenuResult: (message: WorkshopWidgetMenuResultMessage) => void;
  handleWidgetConfigData: (message: WorkshopWidgetConfigDataMessage) => void;
  handleWidgetGenerationProgress: (message: WorkshopWidgetGenerationProgressMessage) => void;
  handleWidgetActionResult: (message: WorkshopWidgetActionResultMessage) => void;
  handleSessionState: (message: WorkshopSessionStateMessage) => void;
  handleSessionsData: (message: WorkshopSessionsDataMessage) => void;
  handleSessionActionResult: (message: WorkshopSessionActionResultMessage) => void;
  handleSessionSaveStatus: (message: WorkshopSessionSaveStatusMessage) => void;
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
  const [persistenceAvailable, setPersistenceAvailable] = React.useState(true);
  const [persistenceUnavailableReason, setPersistenceUnavailableReason] = React.useState<
    'no-workspace' | 'multi-root' | undefined
  >();
  const [currentCheckpointProtected, setCurrentCheckpointProtected] = React.useState(false);
  const [degradedConversationKeys, setDegradedConversationKeys] = React.useState<string[]>([]);
  const [degradedConversations, setDegradedConversations] =
    React.useState<WorkshopConversationDegradation[]>([]);
  const [excerpt, setExcerpt] = React.useState<WorkshopExcerptSnapshot | null>(null);
  const [scope, setScopeState] = React.useState<WorkshopSessionScope>(null);
  const [participantSubjectReady, setParticipantSubjectReady] = React.useState(false);
  const [shelvedExcerpt, setShelvedExcerpt] = React.useState<WorkshopExcerptSnapshot | null>(null);
  const [roomHasMemory, setRoomHasMemory] = React.useState(false);
  const [attachmentContent, setAttachmentContent] =
    React.useState<WorkshopAttachmentContentState | null>(null);
  const [contextAttachments, setContextAttachments] = React.useState<WorkshopContextAttachmentSnapshot[]>([]);
  const [pendingMessageAttachments, setPendingMessageAttachments] = React.useState<WorkshopMessageAttachmentSnapshot[]>([]);
  const [widgetConfigs, setWidgetConfigs] = React.useState<WorkshopWidgetConfigSummary[]>([]);
  const [standingDirectives, setStandingDirectives] =
    React.useState<WorkshopStandingDirectiveSummary[]>([]);
  const [widgetConfigData, setWidgetConfigData] =
    React.useState<WorkshopWidgetConfigSnapshot | null>(null);
  const [widgetConfigResponseId, setWidgetConfigResponseId] = React.useState<string | null>(null);
  const [widgetConfigError, setWidgetConfigError] = React.useState<string | null>(null);
  const [widgetMenuResult, setWidgetMenuResult] =
    React.useState<WorkshopWidgetMenuResultPayload | null>(null);
  const [widgetGenerationProgress, setWidgetGenerationProgress] =
    React.useState<WorkshopWidgetGenerationProgressPayload | null>(null);
  const [widgetActionResult, setWidgetActionResult] =
    React.useState<WorkshopWidgetActionResultPayload | null>(null);
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
  const [writerProfile, setWriterProfile] =
    React.useState<WorkshopWriterProfile>({ ...DEFAULT_WORKSHOP_WRITER_PROFILE });
  const [webResearch, setWebResearch] =
    React.useState<WorkshopWebResearchSettings>({ ...DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS });
  const [toolSidecars, setToolSidecars] = React.useState<WorkshopToolSidecarSnapshot[]>([]);
  const [personaGuests, setPersonaGuests] = React.useState<WorkshopPersonaGuestSnapshot[]>([]);
  const [contextBudget, setContextBudget] = React.useState<LabeledContextBudgetSnapshot | undefined>();
  const [todos, setTodos] = React.useState<WorkshopTodoItem[]>([]);
  const [selectedToolId, setSelectedToolId] = React.useState<WorkshopToolId | null>(null);
  const [activeToolId, setActiveToolId] = React.useState<WorkshopToolId | null>(null);
  const [statusMessage, setStatusMessage] = React.useState('');
  const [tickerMessage, setTickerMessage] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [sessionsAvailable, setSessionsAvailable] = React.useState<boolean | null>(null);
  const [sessionsUnavailableReason, setSessionsUnavailableReason] = React.useState<
    'no-workspace' | 'multi-root' | undefined
  >();
  const [currentSessionSummary, setCurrentSessionSummary] = React.useState<WorkshopSessionSummary>();
  const [activeNamedSessionSummary, setActiveNamedSessionSummary] =
    React.useState<WorkshopSessionSummary>();
  const [savedSessionSummaries, setSavedSessionSummaries] = React.useState<WorkshopSessionSummary[]>([]);
  const [sessionsTruncated, setSessionsTruncated] = React.useState(false);
  const [sessionsSearchTruncated, setSessionsSearchTruncated] = React.useState(false);
  const [sessionsPending, setSessionsPending] = React.useState(false);
  const [sessionsError, setSessionsError] = React.useState<string>();
  const [sessionSearchQuery, setSessionSearchQuery] = React.useState('');
  const [sessionActionResult, setSessionActionResult] = React.useState<
    WorkshopSessionActionResultMessage['payload']
  >();
  const [sessionActionPending, setSessionActionPending] =
    React.useState<WorkshopSessionAction>();
  const [sessionSaveStatus, setSessionSaveStatus] =
    React.useState<WorkshopSessionSaveStatusMessage['payload']>();
  const latestSessionsRequestIdRef = React.useRef<string>();
  const latestSessionsQueryRef = React.useRef('');
  const sessionsRequestCounterRef = React.useRef(0);
  const pendingResetRollbackRef = React.useRef<{
    turns: WorkshopTurn[];
    totalTurns: number;
  }>();
  const pendingNamedActionRef = React.useRef<{
    action: 'save' | 'rename' | 'delete';
    sessionId: string;
    title?: string;
  }>();

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

  const updateContextText = React.useCallback((id: string, text: string) => {
    post(MessageType.WORKSHOP_UPDATE_CONTEXT_TEXT, { id, text });
  }, [post]);

  /**
   * Ask for one attachment's body. The pending marker carries the id so a
   * stale reply for a previously opened pill cannot paint into the sheet the
   * writer is looking at now.
   */
  const requestContextAttachment = React.useCallback((id: string) => {
    setAttachmentContent({ id, canOpenInEditor: false });
    post(MessageType.WORKSHOP_REQUEST_CONTEXT_ATTACHMENT, { id });
  }, [post]);

  const openContextAttachmentFile = React.useCallback((id: string) => {
    post(MessageType.WORKSHOP_OPEN_CONTEXT_ATTACHMENT_FILE, { id });
  }, [post]);

  const clearAttachmentContent = React.useCallback(() => setAttachmentContent(null), []);

  const setSessionScope = React.useCallback((next: WorkshopSelectableSessionScope) => {
    setErrorMessage('');
    post(MessageType.WORKSHOP_SET_SESSION_SCOPE, { scope: next });
  }, [post]);

  const repinExcerpt = React.useCallback(() => {
    setErrorMessage('');
    post(MessageType.WORKSHOP_REPIN_EXCERPT, {});
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

  // ── Conversation Widgets (ADR 2026-07-22) ──────────────────────────────────

  const generateWidgetMenu = React.useCallback((payload: WorkshopWidgetGeneratePayload) => {
    setWidgetMenuResult(null);
    setWidgetGenerationProgress(null);
    post(MessageType.WORKSHOP_WIDGET_GENERATE, payload);
  }, [post]);

  const cancelWidgetGenerate = React.useCallback((requestId: string) => {
    vscode.postMessage(
      createCancelRequestMessage('workshop-widget', requestId, 'webview.workshop.widget')
    );
  }, [vscode]);

  const requestWidgetConfig = React.useCallback((configId: string) => {
    setWidgetConfigData(null);
    setWidgetConfigResponseId(null);
    setWidgetConfigError(null);
    post(MessageType.WORKSHOP_REQUEST_WIDGET_CONFIG, { configId });
  }, [post]);

  const clearWidgetConfigData = React.useCallback(() => {
    setWidgetConfigData(null);
    setWidgetConfigResponseId(null);
    setWidgetConfigError(null);
  }, []);

  const commitWidget = React.useCallback((payload: WorkshopCommitWidgetPayload) => {
    setWidgetActionResult(null);
    post(MessageType.WORKSHOP_COMMIT_WIDGET, payload);
  }, [post]);

  const consumeWidgetActionResult = React.useCallback(() => {
    setWidgetActionResult(null);
  }, []);

  const handleWidgetMenuResult = React.useCallback(
    (message: WorkshopWidgetMenuResultMessage) => {
      setWidgetMenuResult(message.payload);
      setWidgetGenerationProgress((current) =>
        current?.token === message.payload.token ? null : current
      );
    },
    []
  );

  const handleWidgetGenerationProgress = React.useCallback(
    (message: WorkshopWidgetGenerationProgressMessage) => {
      setWidgetGenerationProgress(message.payload);
    },
    []
  );

  const handleWidgetActionResult = React.useCallback(
    (message: WorkshopWidgetActionResultMessage) => {
      setWidgetActionResult(message.payload);
    },
    []
  );

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

  const handleContextAttachmentContent = React.useCallback(
    (message: WorkshopContextAttachmentContentMessage) => {
      const { id, content, error, canOpenInEditor } = message.payload;
      setAttachmentContent((current) =>
        current?.id === id ? { id, content, error, canOpenInEditor } : current
      );
    },
    []
  );

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
  const setConversationSettings = React.useCallback(
    (behavior: WorkshopConversationBehavior, profile: WorkshopWriterProfile, research = DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS) => {
      setErrorMessage('');
      post(MessageType.WORKSHOP_SET_CONVERSATION_SETTINGS, {
        behavior,
        writerProfile: profile,
        webResearch: research
      });
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

  const resetSession = React.useCallback((options: { clearWorkingSet?: boolean } = {}) => {
    setErrorMessage('');
    setSessionActionPending('new');
    pendingResetRollbackRef.current = {
      turns: [...turns],
      totalTurns
    };
    // New Session is a room replacement, not a filesystem refresh. Clear the
    // visible thread immediately; the host snapshot confirms the new room, or
    // the typed failure result restores this exact client-side window.
    setTurns([]);
    setTotalTurns(0);
    post(MessageType.WORKSHOP_RESET_SESSION, {
      ...(options.clearWorkingSet ? { clearWorkingSet: true } : {})
    });
  }, [post, totalTurns, turns]);

  const requestSession = React.useCallback(() => {
    post(MessageType.WORKSHOP_REQUEST_SESSION, {});
  }, [post]);

  const requestSessions = React.useCallback((query?: string) => {
    const nextQuery = query ?? sessionSearchQuery;
    const requestId = `workshop-sessions-${Date.now()}-${++sessionsRequestCounterRef.current}`;
    latestSessionsRequestIdRef.current = requestId;
    latestSessionsQueryRef.current = nextQuery.trim();
    setSessionsPending(true);
    setSessionsError(undefined);
    post(MessageType.WORKSHOP_LIST_SESSIONS, {
      requestId,
      ...(nextQuery.trim() ? { query: nextQuery.trim() } : {})
    });
  }, [post, sessionSearchQuery]);

  const setSessionSearchQueryAction = React.useCallback((query: string) => {
    setSessionSearchQuery(query);
  }, []);

  const saveSession = React.useCallback((title: string, sessionId?: string) => {
    setSessionActionPending('save');
    pendingNamedActionRef.current = sessionId
      ? { action: 'save', sessionId, title }
      : undefined;
    post(MessageType.WORKSHOP_SAVE_SESSION, {
      title,
      ...(sessionId ? { sessionId } : {})
    });
  }, [post]);

  const openSession = React.useCallback((sessionId: string) => {
    setSessionActionPending('open');
    post(MessageType.WORKSHOP_OPEN_SESSION, { sessionId });
  }, [post]);

  const renameSession = React.useCallback((sessionId: string, title: string) => {
    setSessionActionPending('rename');
    pendingNamedActionRef.current = { action: 'rename', sessionId, title };
    post(MessageType.WORKSHOP_RENAME_SESSION, { sessionId, title });
  }, [post]);

  const duplicateSession = React.useCallback((sessionId: string, title?: string) => {
    setSessionActionPending('duplicate');
    post(MessageType.WORKSHOP_DUPLICATE_SESSION, {
      sessionId,
      ...(title?.trim() ? { title: title.trim() } : {})
    });
  }, [post]);

  const revealSession = React.useCallback((sessionId: string) => {
    post(MessageType.WORKSHOP_REVEAL_SESSION, { sessionId });
  }, [post]);

  const deleteSession = React.useCallback((sessionId: string) => {
    setSessionActionPending('delete');
    pendingNamedActionRef.current = { action: 'delete', sessionId };
    post(MessageType.WORKSHOP_DELETE_SESSION, { sessionId });
  }, [post]);

  const consumeSessionActionResult = React.useCallback(() => {
    setSessionActionResult(undefined);
  }, []);

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
      setPersistenceAvailable(message.payload.persistence.available);
      setPersistenceUnavailableReason(message.payload.persistence.unavailableReason);
      setCurrentCheckpointProtected(
        message.payload.persistence.currentCheckpointProtected === true
      );
      setDegradedConversationKeys([...message.payload.persistence.degradedConversationKeys]);
      setDegradedConversations(
        (message.payload.persistence.degradedConversations ?? []).map((entry) => ({ ...entry }))
      );
      setExcerpt(session.excerpt ?? null);
      setScopeState(session.scope);
      setParticipantSubjectReady(session.participantSubjectReady);
      setShelvedExcerpt(session.shelvedExcerpt ?? null);
      setRoomHasMemory(session.roomHasMemory);
      setContextAttachments(session.contextAttachments ?? []);
      setPendingMessageAttachments(session.pendingMessageAttachments ?? []);
      setWidgetConfigs(session.widgetConfigs ?? []);
      setStandingDirectives(session.standingDirectives ?? []);
      setContextPending(session.pendingHostUpdate?.context ?? false);
      setTotalTurns(session.totalTurns);
      setHasHostConversation(session.participants.host.hasConversation);
      setSelectedPersonaId(session.participants.host.personaId);
      setChatTargetState(session.participants.chatTarget);
      // Fail-closed hydration (ADR 2026-07-20 §3): an unprovable object
      // degrades to the COMPLETE approved default, never a per-field blend.
      setConversationBehaviorState(coerceWorkshopConversationBehavior(session.conversationBehavior));
      setWriterProfile(coerceWorkshopWriterProfile(message.payload.writerProfile));
      setWebResearch(coerceWorkshopWebResearchSettings(message.payload.webResearch));
      setToolSidecars(session.participants.toolSidecars);
      setPersonaGuests(session.participants.personaGuests);
      setContextBudget(session.contextBudget);
      setTodos(session.todos);
      setSelectedToolId(session.selectedToolId ?? null);
      setActiveToolId(session.activeToolId ?? null);
      // The host snapshot is authoritative. Marathon sessions deliberately
      // expose only the latest bounded window in the webview; the aggregate and
      // persisted session retain the complete ledger for future pagination.
      setTurns(session.turns);

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

  const handleWidgetConfigData = React.useCallback(
    (message: WorkshopWidgetConfigDataMessage) => {
      setWidgetConfigResponseId(message.payload.configId);
      setWidgetConfigData(message.payload.config ?? null);
      setWidgetConfigError(message.payload.error ?? null);
    },
    []
  );

  const handleSessionsData = React.useCallback((message: WorkshopSessionsDataMessage) => {
    if (message.payload.requestId !== latestSessionsRequestIdRef.current) {
      return;
    }
    setSessionsPending(false);
    setSessionsAvailable(message.payload.available);
    setSessionsUnavailableReason(message.payload.unavailableReason);
    setSessionsError(message.payload.error);
    setCurrentSessionSummary(message.payload.current);
    setSavedSessionSummaries(message.payload.sessions);
    if (!message.payload.error) {
      const activeNamedSession = message.payload.current
        ? message.payload.sessions.find(
            (session) => session.sessionId === message.payload.current?.sessionId
          )
        : undefined;
      if (activeNamedSession) {
        setActiveNamedSessionSummary(activeNamedSession);
      } else if (latestSessionsQueryRef.current === '') {
        // Only an unfiltered authoritative list can prove the live room is no
        // longer associated. A browser search omitting the room must not make
        // its header name disappear.
        setActiveNamedSessionSummary(undefined);
      }
    }
    setSessionsTruncated(!!message.payload.truncated);
    setSessionsSearchTruncated(!!message.payload.searchTruncated);
  }, []);

  const handleSessionActionResult = React.useCallback((message: WorkshopSessionActionResultMessage) => {
    if (message.payload.action === 'new') {
      const rollback = pendingResetRollbackRef.current;
      if (!message.payload.ok && rollback) {
        setTurns(rollback.turns);
        setTotalTurns(rollback.totalTurns);
      }
      pendingResetRollbackRef.current = undefined;
    }
    const pendingNamedAction = pendingNamedActionRef.current;
    if (pendingNamedAction?.action === message.payload.action) {
      if (message.payload.ok) {
        setActiveNamedSessionSummary((active) => {
          if (active?.sessionId !== pendingNamedAction.sessionId) {
            return active;
          }
          if (pendingNamedAction.action === 'delete') {
            return undefined;
          }
          return pendingNamedAction.title
            ? { ...active, title: pendingNamedAction.title }
            : active;
        });
      }
      pendingNamedActionRef.current = undefined;
    }
    if (message.payload.action === 'new' && message.payload.ok) {
      setActiveNamedSessionSummary(undefined);
    }
    setSessionActionPending((pending) =>
      pending === message.payload.action ? undefined : pending
    );
    setSessionActionResult(message.payload);
  }, []);

  const handleSessionSaveStatus = React.useCallback((message: WorkshopSessionSaveStatusMessage) => {
    setSessionSaveStatus(message.payload);
  }, []);

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
  // ADR 2026-07-26: the aggregate owns subject validity. The webview combines
  // that host decision only with local readiness/run state.
  const canMessage = sessionReady
    && !isRunning
    && participantSubjectReady;
  const isPersonaSelectionLocked = hasHostConversation || isRunning;

  return {
    // State
    sessionReady,
    persistenceAvailable,
    persistenceUnavailableReason,
    currentCheckpointProtected,
    degradedConversationKeys,
    degradedConversations,
    excerpt,
    scope,
    shelvedExcerpt,
    roomHasMemory,
    attachmentContent,
    contextAttachments,
    pendingMessageAttachments,
    widgetConfigs,
    standingDirectives,
    widgetConfigData,
    widgetConfigResponseId,
    widgetConfigError,
    widgetMenuResult,
    widgetGenerationProgress,
    widgetActionResult,
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
    writerProfile,
    webResearch,
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
    sessionsAvailable,
    sessionsUnavailableReason,
    currentSessionSummary,
    activeNamedSessionSummary,
    savedSessionSummaries,
    sessionsTruncated,
    sessionsSearchTruncated,
    sessionsPending,
    sessionsError,
    sessionSearchQuery,
    sessionActionPending,
    sessionActionResult,
    sessionSaveStatus,

    // Actions
    pinExcerpt,
    pinFromFile,
    rereadExcerpt,
    addContextText,
    addContextFile,
    removeContextAttachment,
    updateContextText,
    requestContextAttachment,
    openContextAttachmentFile,
    clearAttachmentContent,
    setSessionScope,
    repinExcerpt,
    requestContextCatalog,
    searchContextResources,
    clearContextSearch,
    addContextResources,
    attachMessageResources,
    generateWidgetMenu,
    cancelWidgetGenerate,
    requestWidgetConfig,
    clearWidgetConfigData,
    commitWidget,
    consumeWidgetActionResult,
    handleWidgetMenuResult,
    handleWidgetConfigData,
    handleWidgetGenerationProgress,
    handleWidgetActionResult,
    attachMessageFile,
    removeMessageAttachment,
    setExcerptResource,
    runContextWizard,
    cancelContextWizard,
    handleContextCatalog,
    handleContextAttachmentContent,
    handleContextSearchResults,
    runTool,
    quickAction,
    sendMessage,
    selectPersona,
    inviteGuest,
    dismissGuest,
    setChatTarget,
    setConversationSettings,
    todoAction,
    cancelRun,
    resetSession,
    requestSession,
    requestSessions,
    setSessionSearchQuery: setSessionSearchQueryAction,
    saveSession,
    openSession,
    renameSession,
    duplicateSession,
    revealSession,
    deleteSession,
    consumeSessionActionResult,
    clearError,
    handleSessionState,
    handleSessionsData,
    handleSessionActionResult,
    handleSessionSaveStatus,
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
