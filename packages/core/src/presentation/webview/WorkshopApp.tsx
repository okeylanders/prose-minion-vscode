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
  ErrorMessage,
  SaveResultSuccessMessage,
  StatusMessage,
  WorkshopToolId
} from '@messages';
import { ModelSelector } from './components/shared/ModelSelector';
import { ExcerptPanel } from './components/workshop/ExcerptPanel';
import { WorkshopComposer } from './components/workshop/WorkshopComposer';
import { WorkshopThread } from './components/workshop/WorkshopThread';
import { WorkshopToolsModal } from './components/workshop/WorkshopToolsModal';
import { WorkshopToast, WorkshopToastState } from './components/workshop/WorkshopToast';
import { WORKSHOP_TOOL_ICONS } from './components/workshop/workshopToolIcons';
import {
  WORKSHOP_TOOL_CATALOG,
  WorkshopToolDescriptor
} from '@shared/constants/workshopTools';
import { useVSCodeApi } from './hooks/useVSCodeApi';
import { usePersistence } from './hooks/usePersistence';
import { useMessageRouter } from './hooks/useMessageRouter';
import { useWorkshop } from './hooks/domain/useWorkshop';
import { useModelsSettings } from './hooks/domain/useModelsSettings';
import { useTokenTracking } from './hooks/domain/useTokenTracking';
import { useAccountBalance } from './hooks/domain/useAccountBalance';
import './workshop.css';

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

const toolNameForResult = (toolId: WorkshopToolId | null): string => {
  if (toolId === 'dialogue') {return 'dialogue_analysis';}
  if (toolId === 'prose') {return 'prose_analysis';}
  return toolId ? `writing_tools_${toolId}` : 'writing_tools_editor';
};

export const WorkshopApp: React.FC = () => {
  const vscode = useVSCodeApi();

  // Domain hooks — same rails the sidebar rides (epic thesis: reuse, not
  // reinvention). Balance/models/tokens arrive through this webview's own
  // MessageHandler.
  const workshop = useWorkshop();
  const modelsSettings = useModelsSettings();
  const tokenTracking = useTokenTracking();
  const [hasSavedKey, setHasSavedKey] = React.useState(false);
  const [toolsModalOpen, setToolsModalOpen] = React.useState(false);
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
      if (message.source === 'extension.file_ops') {
        const text = message.payload?.message ?? '';
        if (text.includes('copied')) {
          showToast({ message: 'Copied to clipboard', icon: 'copy' });
        } else if (text.includes('Saved result')) {
          showToast({ message: text, icon: 'save' });
        }
      }
    },
    [showToast, workshop.handleStatusMessage]
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

  useMessageRouter({
    [MessageType.WORKSHOP_SESSION_STATE]: workshop.handleSessionState,
    [MessageType.WORKSHOP_TURN]: workshop.handleTurn,
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
    [MessageType.SAVE_RESULT_SUCCESS]: handleSaveResultSuccess,
  });

  usePersistence({
    ...workshop.persistedState,
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

  // Thread autoscroll: follow new turns and streaming paint.
  const threadRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = threadRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [workshop.turns, workshop.streamingContent, workshop.isRunning]);

  const toolsEnabled = !!workshop.excerpt && !workshop.isRunning && workshop.sessionReady;

  // Recomputing a full word split per streamed token was O(excerpt) work on
  // the token clock (PR #67 review #11) — the excerpt only changes on re-pin.
  const excerptText = workshop.excerpt?.text;
  const excerptWordCount = React.useMemo(() => {
    const trimmed = excerptText?.trim() ?? '';
    return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  }, [excerptText]);

  // Live run bubble: visible from run start until the assistant turn lands.
  const showLiveTurn = workshop.isRunning || workshop.isStreaming || workshop.streamingContent.length > 0;

  const openToolsModal = React.useCallback(() => setToolsModalOpen(true), []);
  const closeToolsModal = React.useCallback(() => setToolsModalOpen(false), []);
  const selectTool = React.useCallback(
    (toolId: WorkshopToolId) => {
      setToolsModalOpen(false);
      workshop.runTool(toolId);
    },
    [workshop.runTool]
  );

  const copyVariation = React.useCallback(
    (content: string, toolId: WorkshopToolId | null) => {
      vscode.postMessage({
        type: MessageType.COPY_RESULT,
        source: 'webview.workshop',
        payload: {
          toolName: toolNameForResult(toolId),
          content
        },
        timestamp: Date.now(),
      });
    },
    [vscode]
  );

  const saveVariation = React.useCallback(
    (content: string, toolId: WorkshopToolId | null) => {
      vscode.postMessage({
        type: MessageType.SAVE_RESULT,
        source: 'webview.workshop',
        payload: {
          toolName: toolNameForResult(toolId),
          content,
          metadata: {
            excerpt: workshop.excerpt?.text,
            relativePath: workshop.excerpt?.relativePath,
            sourceFileUri: workshop.excerpt?.sourceUri,
            timestamp: Date.now()
          }
        },
        timestamp: Date.now(),
      });
    },
    [vscode, workshop.excerpt]
  );

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
                ? `${workshop.excerpt.relativePath ?? 'Pinned excerpt'} · ${excerptWordCount} words`
                : 'No excerpt pinned yet'}
            </p>
          </div>
        </div>
        <div className="pm-ws-header-actions">
          <button
            className="pm-ws-reset"
            type="button"
            onClick={workshop.resetSession}
            disabled={!workshop.sessionReady}
            title="Start a fresh session (keeps the pinned excerpt)"
          >
            <Icon name="refresh" size={13} /> New session
          </button>
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
          {/* Multi-turn token rail (Sprint 3): follow-ups resend the whole
              conversation, so prompt tokens grow every turn — this chip makes
              that budget visible instead of burying it in the balance title. */}
          <div
            className="pm-ws-balance"
            title={`Session tokens — prompt ${tokenTracking.usage.promptTokens.toLocaleString()} · completion ${tokenTracking.usage.completionTokens.toLocaleString()}. Follow-ups resend the conversation history, so prompt tokens grow with each turn.`}
          >
            <span className="pm-ws-balance-label">Tokens</span>
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
              isRunning={workshop.isRunning}
              onPin={workshop.pinExcerpt}
              onPinFromFile={workshop.pinFromFile}
            />

            <div className="pm-ws-block">
              <div className="pm-ws-eyebrow">Context Brief</div>
              <p className="pm-ws-brief-empty">No context brief loaded.</p>
            </div>

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
                    title={
                      workshop.excerpt
                        ? `Run ${tool.label} on the pinned excerpt`
                        : 'Pin an excerpt first'
                    }
                  >
                    <Icon name={tool.icon} size={15} /> {tool.label}
                  </button>
                ))}
                <button
                  className="pm-ws-tool pm-ws-tool-ghost"
                  type="button"
                  role="listitem"
                  disabled={!workshop.sessionReady}
                  onClick={openToolsModal}
                >
                  <Icon name="grid" size={15} /> All {WORKSHOP_TOOLS.length} tools…
                </button>
              </div>
            </div>
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
              {workshop.errorMessage && (
                <div className="pm-ws-error" role="alert">
                  <span>{workshop.errorMessage}</span>
                  <button type="button" onClick={workshop.clearError} aria-label="Dismiss error">
                    <Icon name="x" size={13} />
                  </button>
                </div>
              )}

              {workshop.turns.length === 0 && !showLiveTurn && (
                <div className="pm-ws-thread-empty">
                  <Icon name="sparkle" size={22} />
                  <p className="pm-ws-thread-empty-title">
                    {workshop.excerpt
                      ? 'Your excerpt is pinned. Pick a lens.'
                      : 'Pin an excerpt to start the Workshop.'}
                  </p>
                  <p className="pm-ws-thread-empty-sub">
                    {workshop.excerpt
                      ? 'Run a tool from the rail, open the full palette, or use one of these quick starts.'
                      : 'Paste text or pin a file on the left. The excerpt stays fixed while the conversation grows here.'}
                  </p>
                  {workshop.excerpt && (
                    <div className="pm-ws-empty-actions">
                      {(['dialogue', 'gestures', 'choreography', 'cliche'] as const).map((toolId) => {
                        const tool = WORKSHOP_TOOLS.find((entry) => entry.id === toolId);
                        if (!tool) {return null;}
                        return (
                          <button
                            key={tool.id}
                            className="pm-ws-qa"
                            type="button"
                            disabled={!toolsEnabled}
                            onClick={() => workshop.runTool(tool.id)}
                          >
                            {tool.label}
                          </button>
                        );
                      })}
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
                quickActionsDisabled={!workshop.canFollowUp}
                onQuickAction={workshop.quickAction}
                onCopyVariation={copyVariation}
                onSaveVariation={saveVariation}
              />

              {showLiveTurn && (
                <div className="pm-ws-turn pm-ws-turn-assistant pm-ws-turn-live">
                  <StreamingContent
                    content={workshop.streamingContent}
                    isStreaming={workshop.isStreaming}
                    isBuffering={workshop.isBuffering}
                    chunkCount={workshop.streamingChunkCount}
                    elapsedMs={workshop.streamingElapsedMs}
                    initialLatencyMs={workshop.streamingInitialLatencyMs}
                    chunksPerSecond={workshop.streamingChunksPerSecond}
                    waitingMessage={workshop.statusMessage || 'Warming up the minion…'}
                  />
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
            <WorkshopComposer
              canFollowUp={workshop.canFollowUp}
              hasConversation={workshop.hasConversation}
              isRunning={workshop.isRunning}
              sessionReady={workshop.sessionReady}
              onSend={workshop.sendMessage}
              onCancel={workshop.cancelRun}
              onOpenTools={openToolsModal}
            />
            {(workshop.tickerMessage || workshop.statusMessage) && (
              <div className="pm-ws-status-ticker" role="status" aria-live="polite">
                <Icon name="bolt" size={12} />
                {workshop.tickerMessage || workshop.statusMessage}
              </div>
            )}
          </ErrorBoundary>
        </section>
      </div>

      {toolsModalOpen && (
        <WorkshopToolsModal
          activeToolId={workshop.selectedToolId}
          disabled={!toolsEnabled}
          onClose={closeToolsModal}
          onSelect={selectTool}
        />
      )}
      <WorkshopToast toast={toast} />
    </div>
  );
};
