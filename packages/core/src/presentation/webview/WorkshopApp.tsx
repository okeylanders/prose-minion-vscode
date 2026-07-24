/**
 * WorkshopApp — the Workshop editor-tab React root (ADR 2026-07-03;
 * Sprint 2 session spine, Sprint 3 multi-turn).
 *
 * Session spine: the left rail pins an excerpt (host-side, via
 * WORKSHOP_SET_EXCERPT), the tool palette fires WORKSHOP_RUN_TOOL, and the
 * thread streams the run under `domain: 'workshop'` before the completed
 * turn pair lands via WORKSHOP_TURN. All session truth lives in
 * WorkshopSessionService on the host — this component renders snapshots, so
 * a webview reload rehydrates the thread (useWorkshop's mount request).
 *
 * Sprint 3: the composer is LIVE — free-text follow-ups continue the
 * session's retained conversation (WORKSHOP_SEND_MESSAGE), the send button
 * becomes a stop affordance while a run streams (CANCEL_WORKSHOP_REQUEST),
 * and the rail gains "Pin from file…". Quick-action chips stay Sprint 4.
 *
 * Each region (rail / thread / composer) is wrapped in an ErrorBoundary the
 * way App.tsx wraps its tabs — dynamic session data can throw mid-render now
 * (PR #66 review, Sam).
 */

import * as React from 'react';
import { Icon, IconName } from './components/shared/Icon';
import { PmLogo } from './components/shared/PmLogo';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { TabErrorFallback } from './components/shared/TabErrorFallback';
import { StreamingContent } from './components/shared/StreamingContent';
import { MessageType } from '@shared/types';
import {
  ApiKeyStatusMessage,
  CopyResultSuccessMessage,
  ErrorMessage,
  SaveResultSuccessMessage,
  StatusMessage,
  WorkshopToolId,
  WorkshopPersonaId,
  WorkshopTurn,
  isWorkshopWriterProfileActive,
  workshopExcerptSourcePath
} from '@messages';
import { ModelSelector } from './components/shared/ModelSelector';
import { ExcerptPanel } from './components/workshop/ExcerptPanel';
import { ContextPanel } from './components/workshop/ContextPanel';
import { WorkshopComposer } from './components/workshop/WorkshopComposer';
import { WorkshopParticipantRail } from './components/workshop/WorkshopParticipantRail';
import { ContextBudget } from './components/shared/ContextBudget';
import { WorkshopThread } from './components/workshop/WorkshopThread';
import { WORKSHOP_TURN_ID_ATTRIBUTE } from './components/workshop/WorkshopTurnBubble';
import { WorkshopToolsModal } from './components/workshop/WorkshopToolsModal';
import { WorkshopPersonaBrowserModal } from './components/workshop/WorkshopPersonaBrowserModal';
import { WorkshopPersonaSchematicModal } from './components/workshop/schematic/WorkshopPersonaSchematicModal';
import { WorkshopContextSelectorModal } from './components/workshop/WorkshopContextSelectorModal';
import { WorkshopConversationBehaviorModal } from './components/workshop/WorkshopConversationBehaviorModal';
import { WorkshopSessionBrowserModal } from './components/workshop/WorkshopSessionBrowserModal';
import {
  WorkshopSaveSessionManifest,
  WorkshopSaveSessionModal
} from './components/workshop/WorkshopSaveSessionModal';
import { WorkshopSessionsMenu } from './components/workshop/WorkshopSessionsMenu';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WorkshopToast, WorkshopToastState } from './components/workshop/WorkshopToast';
import { WorkshopTodoList } from './components/workshop/WorkshopTodoList';
import { WORKSHOP_TOOL_ICONS } from './components/workshop/workshopToolIcons';
import { WORKSHOP_PERSONA_FOCUS_ICONS } from './components/workshop/workshopPersonaIcons';
import {
  WORKSHOP_TOOL_CATALOG,
  WorkshopToolDescriptor,
  workshopToolLabel
} from '@shared/constants/workshopTools';
import {
  DEFAULT_WORKSHOP_PERSONA_ID,
  WORKSHOP_GUEST_CAPACITY,
  getWorkshopPersona
} from '@shared/constants/workshopPersonas';
import {
  resultToolNameForWorkshopTool,
  WORKSHOP_PERSONA_RESULT_TOOL_NAME
} from '@shared/constants/resultToolNames';
import { useVSCodeApi } from './hooks/useVSCodeApi';
import { usePersistence } from './hooks/usePersistence';
import { useMessageRouter } from './hooks/useMessageRouter';
import { useWorkshop } from './hooks/domain/useWorkshop';
import { useWorkshopExcerptVerify } from './hooks/domain/useWorkshopExcerptVerify';
import { useWorkshopThreadAutoscroll } from './hooks/useWorkshopThreadAutoscroll';
import { useModelsSettings } from './hooks/domain/useModelsSettings';
import { useTokenTracking } from './hooks/domain/useTokenTracking';
import { useAccountBalance } from './hooks/domain/useAccountBalance';
import './workshop.css';
import './components/workshop/schematic/schematic.css';

interface WorkshopTool extends WorkshopToolDescriptor {
  icon: IconName;
}

/**
 * Catalog + icons; retained export shape from Sprint 1. Ids/labels/grouping
 * come from the shared catalog (`@shared/constants/workshopTools`) so the
 * palette and the handler's turn labels can never drift; icons stay
 * presentation-side (`./components/workshop/workshopToolIcons`).
 */
export const WORKSHOP_TOOLS: readonly WorkshopTool[] = WORKSHOP_TOOL_CATALOG.map(
  (tool) => ({ ...tool, icon: WORKSHOP_TOOL_ICONS[tool.id] })
);

/**
 * The rail's six tools per the APPROVED Direction B prototype — which
 * deliberately overrides the catalog order (pm-direction-b.js `railTools`:
 * dialogue, prose, gestures, choreography, cliche, showtell), NOT a naive
 * first-six slice of the reference comp (PR #66 review, Bria). The remaining
 * eight arrive with the Sprint 4 tools modal.
 */
const RAIL_TOOL_IDS: readonly WorkshopToolId[] = [
  'dialogue',
  'prose',
  'gestures',
  'choreography',
  'cliche',
  'show-and-tell',
];

const RAIL_TOOLS: readonly WorkshopTool[] = RAIL_TOOL_IDS.flatMap((id) => {
  const tool = WORKSHOP_TOOLS.find((entry) => entry.id === id);
  return tool ? [tool] : [];
});

/**
 * Matches the approved Direction B welcome quick starts. Kept named beside the
 * rail override so prototype provenance is visible at both repeated lists.
 */
const EMPTY_STATE_TOOL_IDS: readonly WorkshopToolId[] = [
  'dialogue',
  'gestures',
  'choreography',
  'cliche',
];

const EMPTY_STATE_TOOLS: readonly WorkshopTool[] = EMPTY_STATE_TOOL_IDS.flatMap((id) => {
  const tool = WORKSHOP_TOOLS.find((entry) => entry.id === id);
  return tool ? [tool] : [];
});

export const WorkshopApp: React.FC = () => {
  const vscode = useVSCodeApi();

  // Domain hooks — same rails the sidebar rides (epic thesis: reuse, not
  // reinvention). Balance/models/tokens arrive through this webview's own
  // MessageHandler.
  const workshop = useWorkshop();
  const excerptVerify = useWorkshopExcerptVerify();
  const modelsSettings = useModelsSettings();
  const tokenTracking = useTokenTracking();
  const [hasSavedKey, setHasSavedKey] = React.useState(false);
  const [toolsModalOpen, setToolsModalOpen] = React.useState(false);
  const [behaviorModalOpen, setBehaviorModalOpen] = React.useState(false);
  const [personaModalOpen, setPersonaModalOpen] = React.useState(false);
  const [schematicPersonaId, setSchematicPersonaId] = React.useState<WorkshopPersonaId | null>(null);
  const [contextSelectorOpen, setContextSelectorOpen] = React.useState(false);
  const [sessionsMenuOpen, setSessionsMenuOpen] = React.useState(false);
  const [saveSessionModalOpen, setSaveSessionModalOpen] = React.useState(false);
  const [sessionBrowserOpen, setSessionBrowserOpen] = React.useState(false);
  const sessionListInitializedRef = React.useRef(false);
  const [contextSelectorMode, setContextSelectorMode] = React.useState<'attach' | 'excerpt' | 'message'>('attach');
  const [personaModalMode, setPersonaModalMode] = React.useState<'host' | 'guest'>('host');
  const [toast, setToast] = React.useState<WorkshopToastState | null>(null);
  const accountBalance = useAccountBalance({ apiKeyConfigured: hasSavedKey });

  const showToast = React.useCallback((next: WorkshopToastState) => {
    setToast(next);
  }, []);

  React.useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleApiKeyStatus = React.useCallback((message: ApiKeyStatusMessage) => {
    setHasSavedKey(!!message.payload?.hasSavedKey);
  }, []);

  const handleStatusMessage = React.useCallback(
    (message: StatusMessage) => {
      workshop.handleStatusMessage(message);
    },
    [workshop.handleStatusMessage]
  );

  const handleErrorMessage = React.useCallback(
    (message: ErrorMessage) => {
      workshop.handleErrorMessage(message);
      const source = message.payload?.source;
      if (typeof source === 'string' && source.startsWith('file_ops')) {
        showToast({ message: message.payload.message, icon: 'x', tone: 'error' });
      }
    },
    [showToast, workshop.handleErrorMessage]
  );

  const handleSaveResultSuccess = React.useCallback(
    (message: SaveResultSuccessMessage) => {
      showToast({ message: `Saved to ${message.payload.filePath}`, icon: 'save' });
    },
    [showToast]
  );

  const handleCopyResultSuccess = React.useCallback(
    (_message: CopyResultSuccessMessage) => {
      showToast({ message: 'Copied to clipboard', icon: 'copy' });
    },
    [showToast]
  );

  useMessageRouter({
    [MessageType.WORKSHOP_SESSION_STATE]: workshop.handleSessionState,
    [MessageType.WORKSHOP_TURN]: workshop.handleTurn,
    [MessageType.WORKSHOP_SESSIONS_DATA]: workshop.handleSessionsData,
    [MessageType.WORKSHOP_SESSION_ACTION_RESULT]: workshop.handleSessionActionResult,
    [MessageType.WORKSHOP_NAMED_SAVE_STATUS]: workshop.handleNamedSaveStatus,
    [MessageType.SELECTION_DATA]: excerptVerify.handleSelectionData,
    [MessageType.WORKSHOP_CONTEXT_CATALOG]: workshop.handleContextCatalog,
    [MessageType.WORKSHOP_CONTEXT_SEARCH_RESULTS]: workshop.handleContextSearchResults,
    [MessageType.STREAM_STARTED]: workshop.handleStreamStarted,
    [MessageType.STREAM_CHUNK]: workshop.handleStreamChunk,
    [MessageType.STREAM_COMPLETE]: workshop.handleStreamComplete,
    [MessageType.STATUS]: handleStatusMessage,
    [MessageType.ERROR]: handleErrorMessage,
    [MessageType.MODEL_DATA]: modelsSettings.handleModelData,
    [MessageType.SETTINGS_DATA]: modelsSettings.handleSettingsData,
    [MessageType.TOKEN_USAGE_UPDATE]: tokenTracking.handleTokenUsageUpdate,
    [MessageType.ACCOUNT_BALANCE_DATA]: accountBalance.handleAccountBalanceData,
    [MessageType.API_KEY_STATUS]: handleApiKeyStatus,
    [MessageType.COPY_RESULT_SUCCESS]: handleCopyResultSuccess,
    [MessageType.SAVE_RESULT_SUCCESS]: handleSaveResultSuccess,
  });

  usePersistence({
    ...workshop.persistedState,
    ...excerptVerify.persistedState,
    ...modelsSettings.persistedState,
    ...tokenTracking.persistedState,
    ...accountBalance.persistedState,
  });

  // Initial data requests (session itself is requested inside useWorkshop)
  React.useEffect(() => {
    modelsSettings.requestModelData();
  }, [modelsSettings.requestModelData]);

  React.useEffect(() => {
    vscode.postMessage({
      type: MessageType.REQUEST_API_KEY,
      source: 'webview.workshop',
      payload: {},
      timestamp: Date.now(),
    });
  }, [vscode]);

  React.useEffect(() => {
    if (!workshop.sessionReady || sessionListInitializedRef.current) {
      return;
    }
    sessionListInitializedRef.current = true;
    workshop.requestSessions('');
  }, [workshop.requestSessions, workshop.sessionReady]);

  // The full session browser is intentionally a host-side bounded search. Debounce
  // the query so the writer can type naturally without a filesystem scan for
  // each keystroke; the hook's request id discards any late result.
  React.useEffect(() => {
    if (!sessionBrowserOpen) {
      return undefined;
    }
    const timer = window.setTimeout(() => workshop.requestSessions(), 220);
    return () => window.clearTimeout(timer);
  }, [sessionBrowserOpen, workshop.requestSessions, workshop.sessionSearchQuery]);

  React.useEffect(() => {
    const result = workshop.sessionActionResult;
    if (!result) {
      return;
    }
    showToast({
      message: result.message,
      icon: result.ok ? (result.action === 'save' ? 'save' : 'check') : 'x',
      ...(result.ok ? {} : { tone: 'error' })
    });
    if (result.ok && result.action === 'save') {
      setSaveSessionModalOpen(false);
    }
    if (result.ok && (result.action === 'open' || result.action === 'new')) {
      setSessionBrowserOpen(false);
    }
    const sessionIndexChanged =
      result.ok && result.action !== 'reveal';
    const activeRoomIdentityChanged =
      result.ok && (
        result.action === 'save' ||
        result.action === 'open' ||
        result.action === 'new'
      );
    if (activeRoomIdentityChanged) {
      workshop.requestSessions('');
    } else if (sessionBrowserOpen || sessionsMenuOpen || sessionIndexChanged) {
      workshop.requestSessions();
    }
    workshop.consumeSessionActionResult();
  }, [sessionBrowserOpen, sessionsMenuOpen, showToast, workshop]);

  // Error boundary plumbing — same reporting path as App.tsx
  const handleBoundaryError = React.useCallback(
    (error: Error, errorInfo: React.ErrorInfo) => {
      vscode.postMessage({
        type: MessageType.WEBVIEW_ERROR,
        source: 'webview.error_boundary',
        payload: {
          message: error.message,
          details: errorInfo.componentStack || undefined,
        },
        timestamp: Date.now(),
      });
    },
    [vscode]
  );
  const railErrorRef = React.useRef<ErrorBoundary>(null);
  const threadErrorRef = React.useRef<ErrorBoundary>(null);
  const composerErrorRef = React.useRef<ErrorBoundary>(null);

  // Thread autoscroll: follow NEW turns and streaming paint. Session-only
  // mutations (for example adding several tasks from an older report) replace
  // the snapshot's turns array without changing its newest turn; keying on the
  // array would yank the writer back to the bottom after every bubble action.
  const threadRef = React.useRef<HTMLDivElement>(null);
  const latestTurnId = workshop.turns.at(-1)?.id;
  useWorkshopThreadAutoscroll({
    threadRef,
    latestTurnId,
    streamingContent: workshop.streamingContent,
    isRunning: workshop.isRunning,
    errorMessage: workshop.errorMessage
  });

  const roomMutationLocked =
    workshop.isRunning || workshop.wizardRunning || workshop.sessionActionPending !== undefined;
  const toolsEnabled = !!workshop.excerpt && !roomMutationLocked && workshop.sessionReady;
  const activePersona = getWorkshopPersona(workshop.selectedPersonaId)
    ?? getWorkshopPersona(DEFAULT_WORKSHOP_PERSONA_ID)!;
  const guestTargetPersonaId = workshop.chatTarget.kind === 'personaGuest'
    ? workshop.chatTarget.personaId
    : undefined;
  const chatTargetLabel = workshop.chatTarget.kind === 'tool'
    ? workshopToolLabel(workshop.chatTarget.toolId)
    : workshop.chatTarget.kind === 'personaGuest'
      ? workshop.personaGuests.find((guest) => guest.personaId === guestTargetPersonaId)?.personaLabel
        ?? guestTargetPersonaId
        ?? 'Guest'
      : activePersona.label;

  // Recomputing a full word split per streamed token was O(excerpt) work on
  // the token clock (PR #67 review #11) — the excerpt only changes on re-pin.
  const excerptText = workshop.excerpt?.text;
  const excerptWordCount = React.useMemo(() => {
    const trimmed = excerptText?.trim() ?? '';
    return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  }, [excerptText]);

  // Live run bubble: visible from run start until the assistant turn lands.
  const showLiveTurn = workshop.isRunning || workshop.isStreaming || workshop.streamingContent.length > 0;
  // Invite appears once context is ready and the room has an open guest seat.
  const canInviteGuest = !!workshop.excerpt
    && workshop.sessionReady
    && !roomMutationLocked
    && workshop.personaGuests.filter((guest) => guest.liveness === 'live').length
      < WORKSHOP_GUEST_CAPACITY;
  const sessionMutationsDisabled = roomMutationLocked;

  const openToolsModal = React.useCallback(() => setToolsModalOpen(true), []);
  const setSessionsMenuVisibility = React.useCallback((open: boolean) => {
    setSessionsMenuOpen(open);
    if (open) {
      workshop.requestSessions('');
    }
  }, [workshop.requestSessions]);
  const openSaveSessionModal = React.useCallback(() => {
    setSessionsMenuOpen(false);
    setSessionBrowserOpen(false);
    setSaveSessionModalOpen(true);
  }, []);
  const closeSaveSessionModal = React.useCallback(() => setSaveSessionModalOpen(false), []);
  const openSessionBrowser = React.useCallback(() => {
    setSessionsMenuOpen(false);
    setSaveSessionModalOpen(false);
    workshop.setSessionSearchQuery('');
    setSessionBrowserOpen(true);
  }, [workshop.setSessionSearchQuery]);
  const closeSessionBrowser = React.useCallback(() => setSessionBrowserOpen(false), []);
  const startNewSession = React.useCallback(() => {
    if (window.confirm(
      'Start a new Workshop session? The pinned excerpt and standing context stay; ' +
      'the thread, tasks, guests, and conversation memory reset.'
    )) {
      workshop.resetSession();
    }
  }, [workshop.resetSession]);
  const openStoredSession = React.useCallback((session: typeof workshop.savedSessionSummaries[number]) => {
    if (
      window.confirm(
        `Open “${session.title}”? Your current Workshop room will be replaced.`
      )
    ) {
      workshop.openSession(session.sessionId);
    }
  }, [workshop.openSession]);
  const openBehaviorModal = React.useCallback(() => setBehaviorModalOpen(true), []);
  const closeBehaviorModal = React.useCallback(() => setBehaviorModalOpen(false), []);
  const openContextSelector = React.useCallback((mode: 'attach' | 'excerpt' | 'message' = 'attach') => {
    workshop.requestContextCatalog();
    setContextSelectorMode(mode);
    setContextSelectorOpen(true);
  }, [workshop.requestContextCatalog]);

  const openExcerptSelector = React.useCallback(
    () => openContextSelector('excerpt'),
    [openContextSelector]
  );
  const openAttachSelector = React.useCallback(
    () => openContextSelector('attach'),
    [openContextSelector]
  );
  const openMessageAttachSelector = React.useCallback(
    () => openContextSelector('message'),
    [openContextSelector]
  );

  const openContext = openAttachSelector;
  const closeToolsModal = React.useCallback(() => setToolsModalOpen(false), []);
  const selectTool = React.useCallback(
    (toolId: WorkshopToolId) => {
      setToolsModalOpen(false);
      workshop.runTool(toolId);
    },
    [workshop.runTool]
  );
  const openPersonaModal = React.useCallback(() => {
    setPersonaModalMode('host');
    setPersonaModalOpen(true);
  }, []);
  const openGuestModal = React.useCallback(() => {
    setPersonaModalMode('guest');
    setPersonaModalOpen(true);
  }, []);
  const closePersonaModal = React.useCallback(() => setPersonaModalOpen(false), []);
  const openSchematic = React.useCallback((personaId: WorkshopPersonaId) => {
    setSchematicPersonaId(personaId);
    setPersonaModalOpen(false);
  }, []);
  const backToPersonas = React.useCallback(() => {
    setSchematicPersonaId(null);
    setPersonaModalOpen(true);
  }, []);
  const selectPersona = React.useCallback(
    (personaId: typeof workshop.selectedPersonaId) => {
      setPersonaModalOpen(false);
      workshop.selectPersona(personaId);
    },
    [workshop.selectPersona]
  );
  const inviteGuest = React.useCallback(
    (personaId: WorkshopPersonaId, openingMessage: string) => {
      setPersonaModalOpen(false);
      workshop.inviteGuest(personaId, openingMessage);
    },
    [workshop.inviteGuest]
  );
  const copyTurn = React.useCallback(
    (content: string, turn: WorkshopTurn) => {
      vscode.postMessage({
        type: MessageType.COPY_RESULT,
        source: 'webview.workshop',
        payload: {
          toolName: turn.toolId
            ? resultToolNameForWorkshopTool(turn.toolId)
            : WORKSHOP_PERSONA_RESULT_TOOL_NAME,
          content
        },
        timestamp: Date.now(),
      });
    },
    [vscode]
  );

  const saveTurn = React.useCallback(
    (content: string, turn: WorkshopTurn) => {
      const participantLabel = turn.personaLabel ?? turn.toolLabel ?? 'Workshop';
      vscode.postMessage({
        type: MessageType.SAVE_RESULT,
        source: 'webview.workshop',
        payload: {
          toolName: turn.toolId
            ? resultToolNameForWorkshopTool(turn.toolId)
            : WORKSHOP_PERSONA_RESULT_TOOL_NAME,
          content,
          metadata: {
            excerpt: workshop.excerpt?.text,
            context: `${participantLabel} · ${turn.artifact.replace(/_/g, ' ')}`,
            relativePath: workshop.excerpt ? workshopExcerptSourcePath(workshop.excerpt.source) : undefined,
            sourceFileUri: undefined,
            timestamp: Date.now()
          }
        },
        timestamp: Date.now(),
      });
    },
    [vscode, workshop.excerpt]
  );

  const showTodoSource = React.useCallback((sourceTurnId: string) => {
    const sourceTurn = document.querySelector<HTMLElement>(
      `[${WORKSHOP_TURN_ID_ATTRIBUTE}="${sourceTurnId}"]`
    );
    if (sourceTurn) {
      sourceTurn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      sourceTurn.focus({ preventScroll: true });
    } else {
      showToast({ message: 'That source turn is outside the current reload window.', icon: 'doc' });
    }
  }, [showToast]);

  const openrouter = accountBalance.openrouter;
  const remaining = openrouter?.credits?.remaining;
  const balanceTitle = (() => {
    if (!openrouter || openrouter.status === 'no_key') {
      return 'OpenRouter balance — no API key configured';
    }
    const parts: string[] = [];
    if (typeof remaining === 'number') {parts.push(`Credits remaining: $${remaining.toFixed(2)}`);}
    if (typeof tokenTracking.lastRequestCostUsd === 'number') {
      parts.push(`Last request: $${tokenTracking.lastRequestCostUsd.toFixed(4)}`);
    }
    if (openrouter.creditsStatus !== 'ok') {parts.push('Account balance unavailable');}
    return parts.join(' · ') || 'OpenRouter balance';
  })();

  const excerptSessionLabel = (() => {
    const sourcePath = workshop.excerpt
      ? workshopExcerptSourcePath(workshop.excerpt.source)
      : undefined;
    return sourcePath?.split(/[\\/]/).filter(Boolean).at(-1) ?? 'Untitled session';
  })();
  const activeNamedSession = workshop.activeNamedSessionSummary;
  const activeNamedSaveStatus =
    workshop.namedSaveStatus &&
    workshop.namedSaveStatus.sessionId === activeNamedSession?.sessionId
      ? workshop.namedSaveStatus.status
      : 'saved';
  const suggestedSessionTitle = activeNamedSession?.title ??
    `${excerptSessionLabel} — ${activePersona.label} — ${
      new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }`;
  const saveSessionManifest: WorkshopSaveSessionManifest = {
    excerptVersion: workshop.excerpt?.version,
    excerptWordCount,
    turnCount: workshop.turns.length + workshop.hiddenTurns,
    hostLabel: activePersona.label,
    guestCount: workshop.personaGuests.filter((guest) => guest.liveness === 'live').length,
    contextAttachmentCount: workshop.contextAttachments.length,
    todoCount: workshop.todos.length,
    behavior: workshop.conversationBehavior
  };

  React.useEffect(() => {
    const handleSessionShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }
      if (event.key.toLocaleLowerCase() === 's' && !event.shiftKey) {
        event.preventDefault();
        if (
          workshop.sessionReady &&
          workshop.persistenceAvailable &&
          !sessionMutationsDisabled
        ) {
          openSaveSessionModal();
        }
      }
      if (event.key.toLocaleLowerCase() === 'n' && event.shiftKey) {
        event.preventDefault();
        if (workshop.sessionReady && !sessionMutationsDisabled) {
          startNewSession();
        }
      }
    };
    window.addEventListener('keydown', handleSessionShortcut);
    return () => window.removeEventListener('keydown', handleSessionShortcut);
  }, [
    openSaveSessionModal,
    sessionMutationsDisabled,
    startNewSession,
    workshop.persistenceAvailable,
    workshop.sessionReady
  ]);

  return (
    <div className="pm-ws">
      <header className="pm-ws-header">
        <div className="pm-ws-brand">
          <div className="pm-ws-logo">
            <PmLogo />
          </div>
          <div>
            <div className="pm-ws-eyebrow pm-ws-header-eyebrow">Prose Minion · Assistant</div>
            <h1 className="pm-ws-title">Workshop</h1>
            <p className="pm-ws-subtitle">
              <Icon name="doc" size={12} />{' '}
              {workshop.excerpt
                ? `${workshopExcerptSourcePath(workshop.excerpt.source) ?? 'Pinned excerpt'} · v${workshop.excerpt.version} · ${excerptWordCount} words`
                : 'No excerpt pinned yet'}
            </p>
          </div>
        </div>
        <div className="pm-ws-header-actions">
          <button
            className="pm-ws-persona-trigger"
            type="button"
            disabled={!workshop.sessionReady || workshop.isPersonaSelectionLocked}
            onClick={openPersonaModal}
            title={
              workshop.isPersonaSelectionLocked
                ? workshop.hasHostConversation
                  ? 'Start a new session to choose a different writing partner'
                  : 'Wait for the current run to finish before choosing a writing partner'
                : 'Choose a writing partner'
            }
          >
            <Icon name="person" size={15} />
            <span className="pm-ws-persona-trigger-badge" aria-hidden="true">
              <Icon name={WORKSHOP_PERSONA_FOCUS_ICONS[activePersona.id]} size={10} />
            </span>
            {activePersona.label}
          </button>
          <WorkshopSessionsMenu
            open={sessionsMenuOpen}
            activeSessionTitle={activeNamedSession?.title}
            saveStatus={activeNamedSaveStatus}
            sessions={workshop.savedSessionSummaries}
            disabled={
              !workshop.sessionReady ||
              sessionMutationsDisabled ||
              !workshop.persistenceAvailable
            }
            newSessionDisabled={!workshop.sessionReady || sessionMutationsDisabled}
            onOpenChange={setSessionsMenuVisibility}
            onNewSession={startNewSession}
            onSaveSession={openSaveSessionModal}
            onBrowseSessions={openSessionBrowser}
            onOpenSession={openStoredSession}
          />
          {/* Model browser — the SAME ModelSelector + ModelBrowserModal the
              sidebar uses (assistant scope, same MODEL_DATA rails); only the
              trigger is reskinned to the workshop chip via workshop.css. */}
          <ModelSelector
            scope="assistant"
            options={modelsSettings.modelOptions}
            value={modelsSettings.modelSelections.assistant}
            onChange={modelsSettings.setModelSelection}
            onOpenBrowser={() => modelsSettings.requestModelData(true)}
            label="Assistant Model"
          />
          {/* Cumulative processed traffic is cost/activity, not context size. */}
          <div
            className="pm-ws-balance"
            title={`Cumulative processed traffic — prompt ${tokenTracking.usage.promptTokens.toLocaleString()} · completion ${tokenTracking.usage.completionTokens.toLocaleString()}. Retained history may be processed again across calls.`}
          >
            <span className="pm-ws-balance-label">Processed</span>
            <span className="pm-ws-balance-val">
              {tokenTracking.usage.totalTokens.toLocaleString()}
            </span>
          </div>
          <div className="pm-ws-balance" title={balanceTitle}>
            <span
              className={`pm-ws-balance-dot ${
                openrouter?.status === 'ok' ? 'pm-ws-balance-dot-ok' : 'pm-ws-balance-dot-off'
              }`}
            />
            <span className="pm-ws-balance-label">OpenRouter</span>
            <span className="pm-ws-balance-val">
              {typeof remaining === 'number' ? `$ ${remaining.toFixed(2)}` : '$ —'}
            </span>
          </div>
        </div>
      </header>

      {workshop.degradedConversationKeys.length > 0 && (
        <div className="pm-ws-degraded-memory" role="status">
          <Icon name="refresh" size={14} />
          Some restored persona memory could not be continued. The room and transcript are intact; those personas will begin fresh on their next turn.
        </div>
      )}
      {workshop.currentCheckpointProtected && (
        <div className="pm-ws-degraded-memory" role="alert">
          <Icon name="save" size={14} />
          Automatic recovery is paused because <code>current.json</code> could not be read.
          This room remains open in memory; save a named checkpoint before replacing it.
        </div>
      )}

      <div className="pm-ws-split">
        <aside className="pm-ws-rail" aria-label="Session rail">
          <ErrorBoundary
            ref={railErrorRef}
            fallback={
              <TabErrorFallback
                tabName="Workshop rail"
                onRetry={() => railErrorRef.current?.reset()}
              />
            }
            onError={handleBoundaryError}
          >
            <ExcerptPanel
              excerpt={workshop.excerpt}
              isRunning={roomMutationLocked}
              locked={workshop.hasHostConversation}
              verified={excerptVerify.verified}
              onSet={workshop.pinExcerpt}
              onChooseFile={openExcerptSelector}
              onRereadFile={workshop.rereadExcerpt}
              onPasteVerify={excerptVerify.requestVerify}
            />

            <ContextPanel
              attachments={workshop.contextAttachments}
              pendingDelivery={workshop.contextPending}
              isRunning={roomMutationLocked}
              onAddText={workshop.addContextText}
              onAddFile={openAttachSelector}
              onRemove={workshop.removeContextAttachment}
              wizardRunning={workshop.wizardRunning}
              onRunWizard={workshop.runContextWizard}
              onCancelWizard={workshop.cancelContextWizard}
            />

            <div className="pm-ws-block pm-ws-block-grow">
              <div className="pm-ws-eyebrow">Tools</div>
              <div className="pm-ws-tools" role="list">
                {RAIL_TOOLS.map((tool) => (
                  <button
                    key={tool.id}
                    className={`pm-ws-tool ${
                      workshop.selectedToolId === tool.id ? 'pm-ws-tool-active' : ''
                    }`}
                    type="button"
                    role="listitem"
                    disabled={!toolsEnabled}
                    onClick={() => workshop.runTool(tool.id)}
                    title={workshop.excerpt
                      ? `Have ${activePersona.label} ask ${tool.label} to inspect the pinned excerpt`
                      : 'Pin an excerpt first'}
                  >
                    <Icon name={tool.icon} size={15} /> {tool.label}
                  </button>
                ))}
                <button
                  className="pm-ws-tool pm-ws-tool-ghost"
                  type="button"
                  role="listitem"
                  disabled={!toolsEnabled}
                  onClick={openToolsModal}
                  title="All writing tools"
                >
                  <Icon name="grid" size={15} /> All {WORKSHOP_TOOLS.length} tools…
                </button>
              </div>
            </div>

            <WorkshopTodoList
              todos={workshop.todos}
              onAction={workshop.todoAction}
              onShowSource={showTodoSource}
            />
          </ErrorBoundary>
        </aside>

        <section className="pm-ws-main" aria-label="Session thread">
          <ErrorBoundary
            ref={threadErrorRef}
            fallback={
              <TabErrorFallback
                tabName="Workshop thread"
                onRetry={() => threadErrorRef.current?.reset()}
              />
            }
            onError={handleBoundaryError}
          >
            <div className="pm-ws-thread" ref={threadRef}>
              {workshop.turns.length === 0 && !showLiveTurn && (
                <div className="pm-ws-thread-empty">
                  <Icon name="sparkle" size={22} />
                  <p className="pm-ws-thread-empty-title">
                    {workshop.excerpt
                      ? `Your excerpt is pinned. Message ${activePersona.label}.`
                      : 'Pin an excerpt to start the Workshop.'}
                  </p>
                  <p className="pm-ws-thread-empty-sub">
                    {workshop.excerpt
                      ? `Ask ${activePersona.label} directly, or run a tool for a verbatim report and a separate host synthesis.`
                      : 'Paste text or pin a file on the left. The excerpt stays fixed while the conversation grows here.'}
                  </p>
                  {workshop.excerpt && (
                    <div className="pm-ws-empty-actions">
                      {EMPTY_STATE_TOOLS.map((tool) => (
                        <button
                          key={tool.id}
                          className="pm-ws-qa"
                          type="button"
                          disabled={!toolsEnabled}
                          onClick={() => workshop.runTool(tool.id)}
                        >
                          {tool.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {workshop.hiddenTurns > 0 && (
                <div className="pm-ws-thread-hidden">
                  {workshop.hiddenTurns.toLocaleString()} earlier turn
                  {workshop.hiddenTurns === 1 ? '' : 's'} from this session aren&apos;t shown
                  after reload.
                </div>
              )}
              <WorkshopThread
                turns={workshop.turns}
                toolSidecars={workshop.toolSidecars}
                todos={workshop.todos}
                currentExcerptVersion={workshop.excerpt?.version ?? 0}
                quickActionsDisabled={!workshop.canMessage}
                onQuickAction={workshop.quickAction}
                onTalkDirectly={(toolId) => workshop.setChatTarget({ kind: 'tool', toolId })}
                onAddTodo={(sourceTurnId, findingKey) => workshop.todoAction({
                  action: 'add',
                  sourceTurnId,
                  findingKey
                })}
                onCopy={copyTurn}
                onSave={saveTurn}
              />

              {showLiveTurn && (
                workshop.streamingChunkCount === 0 ? (
                  /* Warm-up placeholder: the SAME pulsing live line as the
                     gutter ticker (pm-ws-ticker-live), parked where the turn
                     will land — not the shared big loader. It disappears at
                     the first token; the gutter ticker stays, as usual. */
                  <div className="pm-ws-turn pm-ws-turn-assistant pm-ws-turn-live pm-ws-turn-waiting">
                    <span className="pm-ws-ticker-live">
                      <Icon name="bolt" size={12} />
                      {workshop.statusMessage || 'Warming up the minion…'}
                    </span>
                  </div>
                ) : (
                  <div className="pm-ws-turn pm-ws-turn-assistant pm-ws-turn-live">
                    <StreamingContent
                      content={workshop.streamingContent}
                      isStreaming={workshop.isStreaming}
                      isBuffering={workshop.isBuffering}
                      chunkCount={workshop.streamingChunkCount}
                      elapsedMs={workshop.streamingElapsedMs}
                      initialLatencyMs={workshop.streamingInitialLatencyMs}
                      chunksPerSecond={workshop.streamingChunksPerSecond}
                    />
                  </div>
                )
              )}

              {workshop.errorMessage && (
                <div className="pm-ws-error" role="alert">
                  <span>{workshop.errorMessage}</span>
                  <button type="button" onClick={workshop.clearError} aria-label="Dismiss error">
                    <Icon name="x" size={13} />
                  </button>
                </div>
              )}
            </div>
          </ErrorBoundary>

          <ErrorBoundary
            ref={composerErrorRef}
            fallback={
              <TabErrorFallback
                tabName="Workshop composer"
                onRetry={() => composerErrorRef.current?.reset()}
              />
            }
            onError={handleBoundaryError}
          >
            {/* Composer band (composer-messaging v2): ticker centered above the
                divider (thread-side — it narrates the run), the divider on the
                ticker's bottom edge, then the rail below it grouped with the
                composer it routes into; the keyboard hint sits centered under
                the text entry. The ticker slot is ALWAYS mounted with a
                reserved height so messages coming and going never jitter the
                band (or move the divider), and the live region exists before
                its first announcement. */}
            <div className="pm-ws-status-ticker" role="status" aria-live="polite">
              {(workshop.tickerMessage || workshop.statusMessage) && (
                <span className="pm-ws-ticker-live">
                  <Icon name="bolt" size={12} />
                  {workshop.tickerMessage || workshop.statusMessage}
                </span>
              )}
            </div>
            <WorkshopParticipantRail
              personaId={activePersona.id}
              personaLabel={activePersona.label}
              toolSidecars={workshop.toolSidecars}
              personaGuests={workshop.personaGuests}
              chatTarget={workshop.chatTarget}
              onSetChatTarget={workshop.setChatTarget}
              disabled={showLiveTurn || roomMutationLocked}
              showInviteGuest={canInviteGuest}
              onInviteGuest={openGuestModal}
              onDismissGuest={workshop.dismissGuest}
            />
            <ContextBudget
              label={workshop.contextBudget?.label ?? `${chatTargetLabel} context`}
              snapshot={workshop.contextBudget?.snapshot}
              modelOptions={modelsSettings.modelOptions}
              cumulativeProcessedTokens={tokenTracking.usage.totalTokens}
              sources={workshop.contextBudget?.sources}
              requesterLabel={activePersona.label}
            />
            <WorkshopComposer
              canMessage={workshop.canMessage && !roomMutationLocked}
              hasConversation={workshop.chatTarget.kind === 'host' ? workshop.hasHostConversation : true}
              recipientLabel={chatTargetLabel}
              isRunning={workshop.isRunning}
              sessionReady={workshop.sessionReady}
              conversationBehavior={workshop.conversationBehavior}
              writerProfileShared={isWorkshopWriterProfileActive(workshop.writerProfile)}
              messageAttachments={workshop.pendingMessageAttachments}
              onSend={workshop.sendMessage}
              onCancel={workshop.cancelRun}
              onOpenContext={openContext}
              onAttachToMessage={openMessageAttachSelector}
              onRemoveMessageAttachment={workshop.removeMessageAttachment}
              onOpenConversationSettings={openBehaviorModal}
              onOpenTools={openToolsModal}
            />
          </ErrorBoundary>
        </section>
      </div>

      <WorkshopToolsModal
        open={toolsModalOpen}
        activeToolId={workshop.selectedToolId}
        disabled={!toolsEnabled}
        unavailableMessage={undefined}
        onClose={closeToolsModal}
        onSelect={selectTool}
      />
      {/* Conversation behavior (ADR 2026-07-20 §11): behavior is the COMMITTED
          object from the session snapshot — the modal drafts locally and waits
          for the host round-trip, so no optimistic state lives here either. */}
      <WorkshopConversationBehaviorModal
        open={behaviorModalOpen}
        behavior={workshop.conversationBehavior}
        writerProfile={workshop.writerProfile}
        isRunning={roomMutationLocked}
        errorMessage={workshop.errorMessage}
        onApply={workshop.setConversationSettings}
        onClose={closeBehaviorModal}
      />
        <WorkshopContextSelectorModal
          open={contextSelectorOpen}
          mode={contextSelectorMode}
          catalog={workshop.contextCatalog}
          attachments={workshop.contextAttachments}
          pendingMessageAttachments={workshop.pendingMessageAttachments}
          searchResults={workshop.contextSearch}
          remainingWords={Math.max(
            0,
            PROMPT_BUDGETS.contextAttachments.words -
              workshop.contextAttachments.reduce((total, attachment) => total + attachment.words, 0)
          )}
          onSearch={workshop.searchContextResources}
          onClearSearch={workshop.clearContextSearch}
          onConfirm={contextSelectorMode === 'message'
            ? workshop.attachMessageResources
            : workshop.addContextResources}
          onPickExcerpt={workshop.setExcerptResource}
          onExplore={contextSelectorMode === 'excerpt'
            ? workshop.pinFromFile
            : contextSelectorMode === 'message'
              ? workshop.attachMessageFile
              : workshop.addContextFile}
          onClose={() => setContextSelectorOpen(false)}
        />
      <WorkshopPersonaBrowserModal
        open={personaModalOpen}
        activePersonaId={workshop.selectedPersonaId}
        mode={personaModalMode}
        invitedPersonaIds={workshop.personaGuests
          .filter((guest) => guest.liveness === 'live')
          .map((guest) => guest.personaId)}
        disabled={roomMutationLocked ||
          (personaModalMode === 'host' ? workshop.isPersonaSelectionLocked : workshop.isRunning)}
        onClose={closePersonaModal}
        onSelect={selectPersona}
        onInvite={inviteGuest}
        onMoreInfo={openSchematic}
      />
      <WorkshopPersonaSchematicModal personaId={schematicPersonaId} onBack={backToPersonas} />
      <WorkshopSaveSessionModal
        open={saveSessionModalOpen}
        available={workshop.persistenceAvailable}
        unavailableReason={workshop.persistenceUnavailableReason}
        suggestedTitle={suggestedSessionTitle}
        activeNamedSession={activeNamedSession}
        manifest={saveSessionManifest}
        saving={workshop.sessionActionPending === 'save'}
        onClose={closeSaveSessionModal}
        onSave={workshop.saveSession}
      />
      <WorkshopSessionBrowserModal
        open={sessionBrowserOpen}
        available={workshop.sessionsAvailable}
        unavailableReason={workshop.sessionsUnavailableReason ?? workshop.persistenceUnavailableReason}
        current={workshop.currentSessionSummary}
        sessions={workshop.savedSessionSummaries}
        truncated={workshop.sessionsTruncated}
        searchTruncated={workshop.sessionsSearchTruncated}
        pending={workshop.sessionsPending}
        error={workshop.sessionsError}
        query={workshop.sessionSearchQuery}
        mutationsDisabled={sessionMutationsDisabled}
        actionPending={workshop.sessionActionPending}
        onClose={closeSessionBrowser}
        onQueryChange={workshop.setSessionSearchQuery}
        onRefresh={() => workshop.requestSessions()}
        onNewSession={startNewSession}
        onOpen={openStoredSession}
        onRename={workshop.renameSession}
        onDuplicate={workshop.duplicateSession}
        onReveal={workshop.revealSession}
        onDelete={workshop.deleteSession}
      />
      <WorkshopToast toast={toast} />
    </div>
  );
};
