/**
 * WorkshopApp — the Workshop editor-tab React root (ADR 2026-07-03, Sprint 2).
 *
 * Session spine: the left rail pins an excerpt (host-side, via
 * WORKSHOP_SET_EXCERPT), the tool palette fires WORKSHOP_RUN_TOOL, and the
 * thread streams the run under `domain: 'workshop'` before the completed
 * turn pair lands via WORKSHOP_TURN. All session truth lives in
 * WorkshopSessionService on the host — this component renders snapshots, so
 * a webview reload rehydrates the thread (useWorkshop's mount request).
 *
 * Header placeholders are now live: model select on the `assistant` scope via
 * useModelsSettings, balance via useAccountBalance. The composer STAYS
 * disabled — free-text follow-ups are Sprint 3, quick-action chips Sprint 4.
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
import { MarkdownRenderer } from './components/shared/MarkdownRenderer';
import { StreamingContent } from './components/shared/StreamingContent';
import { MessageType, ModelScope } from '@shared/types';
import { ApiKeyStatusMessage, WorkshopToolId, WorkshopTurn } from '@messages';
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

/**
 * Icons are presentation-only; ids/labels/grouping come from the shared
 * catalog (`@shared/constants/workshopTools`) so the palette and the
 * handler's turn labels can never drift (deterministic — the LLM never
 * names buttons, epic invariant).
 */
const TOOL_ICONS: Record<WorkshopToolId, IconName> = {
  dialogue: 'dialogue',
  prose: 'pen',
  gestures: 'hand',
  cliche: 'stamp',
  repetition: 'repeat',
  'decision-points': 'branch',
  'show-and-tell': 'eye',
  choreography: 'move',
  'stock-and-signature': 'target',
  placeholders: 'search',
  style: 'palette',
  editor: 'list',
  continuity: 'link',
  fresh: 'sprout',
};

interface WorkshopTool extends WorkshopToolDescriptor {
  icon: IconName;
}

/** Catalog + icons; retained export shape from Sprint 1. */
export const WORKSHOP_TOOLS: readonly WorkshopTool[] = WORKSHOP_TOOL_CATALOG.map(
  (tool) => ({ ...tool, icon: TOOL_ICONS[tool.id] })
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

const countWords = (text: string): number => {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
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
  const accountBalance = useAccountBalance({ apiKeyConfigured: hasSavedKey });

  // Excerpt editor (local UI state only — the pinned excerpt itself is host state)
  const [draftExcerpt, setDraftExcerpt] = React.useState('');
  const [editingExcerpt, setEditingExcerpt] = React.useState(false);

  const handleApiKeyStatus = React.useCallback((message: ApiKeyStatusMessage) => {
    setHasSavedKey(!!message.payload?.hasSavedKey);
  }, []);

  useMessageRouter({
    [MessageType.WORKSHOP_SESSION_STATE]: workshop.handleSessionState,
    [MessageType.WORKSHOP_TURN]: workshop.handleTurn,
    [MessageType.STREAM_STARTED]: workshop.handleStreamStarted,
    [MessageType.STREAM_CHUNK]: workshop.handleStreamChunk,
    [MessageType.STREAM_COMPLETE]: workshop.handleStreamComplete,
    [MessageType.STATUS]: workshop.handleStatusMessage,
    [MessageType.ERROR]: workshop.handleErrorMessage,
    [MessageType.MODEL_DATA]: modelsSettings.handleModelData,
    [MessageType.SETTINGS_DATA]: modelsSettings.handleSettingsData,
    [MessageType.TOKEN_USAGE_UPDATE]: tokenTracking.handleTokenUsageUpdate,
    [MessageType.ACCOUNT_BALANCE_DATA]: accountBalance.handleAccountBalanceData,
    [MessageType.API_KEY_STATUS]: handleApiKeyStatus,
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

  const pinDraft = () => {
    const text = draftExcerpt.trim();
    if (!text) {return;}
    workshop.pinExcerpt(draftExcerpt);
    setEditingExcerpt(false);
  };

  const beginEditingExcerpt = () => {
    setDraftExcerpt(workshop.excerpt?.text ?? '');
    setEditingExcerpt(true);
  };

  const toolsEnabled = !!workshop.excerpt && !workshop.isRunning && workshop.sessionReady;

  // Live run bubble: visible from run start until the assistant turn lands.
  const showLiveTurn = workshop.isRunning || workshop.isStreaming || workshop.streamingContent.length > 0;

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

  const renderTurn = (turn: WorkshopTurn) => {
    if (turn.role === 'user') {
      return (
        <div key={turn.id} className="pm-ws-turn pm-ws-turn-user">
          <span className="pm-ws-turn-chip">
            <Icon name={TOOL_ICONS[turn.toolId] ?? 'bolt'} size={13} /> {turn.toolLabel}
          </span>
        </div>
      );
    }
    return (
      <div key={turn.id} className="pm-ws-turn pm-ws-turn-assistant">
        <div className="pm-ws-turn-head">
          <span className="pm-ws-eyebrow">
            <Icon name="sparkle" size={12} /> {turn.toolLabel}
          </span>
          {turn.usage && (
            <span className="pm-ws-turn-usage">{turn.usage.totalTokens.toLocaleString()} tokens</span>
          )}
        </div>
        {turn.truncated && (
          <p className="pm-ws-turn-truncated">Response hit the max-token limit and was truncated.</p>
        )}
        <MarkdownRenderer content={turn.content} className="pm-ws-turn-body" />
      </div>
    );
  };

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
                ? `${workshop.excerpt.relativePath ?? 'Pinned excerpt'} · ${countWords(workshop.excerpt.text)} words`
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
          {/* Model select — assistant scope, the same MODEL_DATA rails as the sidebar */}
          <select
            className="pm-ws-model"
            aria-label="Assistant model"
            value={modelsSettings.modelSelections.assistant ?? ''}
            onChange={(event) =>
              modelsSettings.setModelSelection('assistant' as ModelScope, event.target.value)
            }
            disabled={modelsSettings.modelOptions.length === 0}
          >
            {modelsSettings.modelOptions.length === 0 && <option value="">Model…</option>}
            {modelsSettings.modelSelections.assistant &&
              !modelsSettings.modelOptions.some(
                (option) => option.id === modelsSettings.modelSelections.assistant
              ) && (
                <option value={modelsSettings.modelSelections.assistant}>
                  {modelsSettings.modelSelections.assistant}
                </option>
              )}
            {modelsSettings.modelOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
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
            <div className="pm-ws-block">
              <div className="pm-ws-block-head">
                <div className="pm-ws-eyebrow">
                  <Icon name="pin" size={12} /> Working Excerpt
                </div>
                {workshop.excerpt && !editingExcerpt ? (
                  <span className="pm-ws-pill">Pinned</span>
                ) : null}
              </div>

              {workshop.excerpt && !editingExcerpt ? (
                <>
                  <div className="pm-ws-excerpt">{workshop.excerpt.text}</div>
                  <button
                    className="pm-ws-excerpt-edit"
                    type="button"
                    onClick={beginEditingExcerpt}
                    disabled={workshop.isRunning}
                  >
                    Replace excerpt…
                  </button>
                </>
              ) : (
                <>
                  <textarea
                    className="pm-ws-excerpt pm-ws-excerpt-input"
                    value={draftExcerpt}
                    onChange={(event) => setDraftExcerpt(event.target.value)}
                    placeholder="Paste a passage to work on — it stays pinned here while you iterate. (Sending a selection from the editor arrives in Sprint 3.)"
                    rows={7}
                    aria-label="Excerpt to pin"
                  />
                  <div className="pm-ws-excerpt-actions">
                    <button
                      className="pm-ws-pin-btn"
                      type="button"
                      onClick={pinDraft}
                      disabled={draftExcerpt.trim().length === 0}
                    >
                      <Icon name="pin" size={13} /> Pin excerpt
                    </button>
                    {editingExcerpt && (
                      <button
                        className="pm-ws-excerpt-edit"
                        type="button"
                        onClick={() => setEditingExcerpt(false)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

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
                      workshop.activeToolId === tool.id ? 'pm-ws-tool-active' : ''
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
                <button className="pm-ws-tool pm-ws-tool-ghost" type="button" disabled>
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
                  <p className="pm-ws-thread-empty-title">The thread starts when you run a tool.</p>
                  <p className="pm-ws-thread-empty-sub">
                    Pin an excerpt on the left, pick a tool, and the analysis streams in here.
                  </p>
                </div>
              )}

              {workshop.turns.map(renderTurn)}

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
            <div className="pm-ws-composer-wrap">
              <div className="pm-ws-composer">
                <button className="pm-ws-comp-add" type="button" disabled title="Writing tools (Sprint 4)">
                  <Icon name="plus" size={18} />
                </button>
                <input
                  className="pm-ws-comp-input"
                  type="text"
                  disabled
                  placeholder="Ask a follow-up, or pick a tool…"
                  aria-label="Message the Workshop (available in Sprint 3)"
                />
                <div className="pm-ws-comp-right">
                  <span className="pm-ws-comp-pill">
                    <Icon name="grid" size={13} /> Tools
                  </span>
                  <button className="pm-ws-comp-send" type="button" disabled title="Send (Sprint 3)">
                    <Icon name="send" size={16} />
                  </button>
                </div>
              </div>
            </div>
          </ErrorBoundary>
        </section>
      </div>
    </div>
  );
};
