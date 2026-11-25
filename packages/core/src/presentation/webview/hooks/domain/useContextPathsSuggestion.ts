/**
 * useContextPathsSuggestion - "Suggest from my folders" in the Settings
 * overlay's context-paths section (ADR 2026-11-19 D21, D23, D24).
 *
 * - **Correlated.** Each request (suggest, apply, status) carries an id
 *   minted here; the host echoes it, and only the answer still waited for
 *   is taken. A newer suggestion, or dismissing the review, stops waiting.
 * - **Ids and ticks only.** Apply sends the host's proposal id and the
 *   groups ticked, never a pattern.
 * - **Nothing changes without Apply,** and a failure leaves one quiet line.
 *
 * Nothing is persisted: a proposal lives only while the host holds it.
 */

import * as React from 'react';
import {
  MessageType,
  type ContextPathGroup,
  type ContextPathGroupApplyOutcome,
  type ContextPathProposalView,
  type ContextPathsAppliedMessage,
  type ContextPathsStatusMessage,
  type ContextPathsSuggestionMessage
} from '@shared/types';
import { CONTEXT_PATH_SUGGESTION_WORDS } from '@shared/constants/contextPathSuggestionWords';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { contextPathsInitialTicked, contextPathsTickable } from '@utils/contextPathsSuggestion';

const SOURCE = 'webview.settings.contextPaths.suggestion';

export type ContextPathsSuggestionPhase = 'idle' | 'suggesting' | 'review' | 'applying' | 'applied';

export interface ContextPathsSuggestionState {
  phase: ContextPathsSuggestionPhase;
  /** The proposal under review (`review`, `applying`). */
  view?: ContextPathProposalView;
  ticked: ContextPathGroup[];
  /** What Apply did (`applied`). */
  applied?: ContextPathGroupApplyOutcome[];
  /** One quiet line: a suggestion that proposed nothing to review, or a proposal no longer held. */
  note?: string;
  /** Every group matches nothing in this project: the section points at the button. */
  everyGroupEmpty: boolean;
}

export interface ContextPathsSuggestionActions {
  suggest: () => void;
  toggleGroup: (group: ContextPathGroup) => void;
  apply: () => void;
  dismiss: () => void;
  requestStatus: () => void;
  handleSuggestion: (message: ContextPathsSuggestionMessage) => void;
  handleApplied: (message: ContextPathsAppliedMessage) => void;
  handleStatus: (message: ContextPathsStatusMessage) => void;
}

/** The review is the host's proposal's; nothing of it outlives the webview. */
export type ContextPathsSuggestionPersistence = Record<string, never>;

export type UseContextPathsSuggestionReturn = ContextPathsSuggestionState & ContextPathsSuggestionActions & {
  persistedState: ContextPathsSuggestionPersistence;
};

const NO_PERSISTENCE: ContextPathsSuggestionPersistence = {};

export const useContextPathsSuggestion = (): UseContextPathsSuggestionReturn => {
  const vscode = useVSCodeApi();
  const [state, setState] = React.useState<Omit<ContextPathsSuggestionState, 'everyGroupEmpty'>>({ phase: 'idle', ticked: [] });
  const [everyGroupEmpty, setEveryGroupEmpty] = React.useState(false);
  const proposalId = React.useRef<string | undefined>(undefined);
  const idPrefix = React.useRef(`cpw-${Math.random().toString(36).slice(2, 10)}`);
  const minted = React.useRef(0);
  const pending = React.useRef<{ suggest?: string; apply?: string; status?: string }>({});

  const post = React.useCallback((type: MessageType, kind: 'suggest' | 'apply' | 'status', payload: Record<string, unknown>) => {
    minted.current += 1;
    const requestId = `${idPrefix.current}:${minted.current}`;
    pending.current[kind] = requestId;
    vscode.postMessage({ type, source: SOURCE, payload: { requestId, ...payload }, timestamp: Date.now() });
  }, [vscode]);

  const requestStatus = React.useCallback(() => {
    post(MessageType.CONTEXT_PATHS_STATUS_REQUEST, 'status', {});
  }, [post]);

  const suggest = React.useCallback(() => {
    pending.current.apply = undefined;
    proposalId.current = undefined;
    setState({ phase: 'suggesting', ticked: [] });
    post(MessageType.CONTEXT_PATHS_SUGGEST, 'suggest', {});
  }, [post]);

  const dismiss = React.useCallback(() => {
    pending.current.suggest = undefined;
    pending.current.apply = undefined;
    proposalId.current = undefined;
    setState({ phase: 'idle', ticked: [] });
  }, []);

  const toggleGroup = React.useCallback((group: ContextPathGroup) => {
    setState((current) => {
      if (current.phase !== 'review' || !contextPathsTickable(current.view, group)) {
        return current;
      }
      const ticked = current.ticked.includes(group)
        ? current.ticked.filter((each) => each !== group)
        : [...current.ticked, group];
      return { ...current, ticked };
    });
  }, []);

  const apply = React.useCallback(() => {
    if (state.phase !== 'review' || !proposalId.current || state.ticked.length === 0) {
      return;
    }
    setState((current) => ({ ...current, phase: 'applying' }));
    post(MessageType.CONTEXT_PATHS_APPLY, 'apply', { proposalId: proposalId.current, groups: [...state.ticked] });
  }, [post, state.phase, state.ticked]);

  const handleSuggestion = React.useCallback((message: ContextPathsSuggestionMessage) => {
    const payload = message.payload;
    if (!payload || payload.requestId !== pending.current.suggest) {
      return;
    }
    pending.current.suggest = undefined;
    if (payload.outcome === 'proposed' && payload.view && payload.proposalId) {
      proposalId.current = payload.proposalId;
      setState({ phase: 'review', view: payload.view, ticked: contextPathsInitialTicked(payload.view) });
      return;
    }
    const outcome = payload.outcome === 'proposed' ? 'failed' : payload.outcome;
    setState({ phase: 'idle', ticked: [], note: CONTEXT_PATH_SUGGESTION_WORDS[outcome] });
  }, []);

  const handleApplied = React.useCallback((message: ContextPathsAppliedMessage) => {
    const payload = message.payload;
    if (!payload || payload.requestId !== pending.current.apply) {
      return;
    }
    pending.current.apply = undefined;
    proposalId.current = undefined;
    if (payload.outcome === 'unknown-proposal') {
      setState({ phase: 'idle', ticked: [], note: 'That suggestion is no longer held; nothing was applied. Suggest again.' });
      return;
    }
    setState({ phase: 'applied', ticked: [], applied: payload.groups });
    if (payload.groups.some((entry) => entry.outcome === 'applied')) {
      setEveryGroupEmpty(false);
    }
  }, []);

  const handleStatus = React.useCallback((message: ContextPathsStatusMessage) => {
    const payload = message.payload;
    if (!payload || payload.requestId !== pending.current.status) {
      return;
    }
    pending.current.status = undefined;
    setEveryGroupEmpty(payload.everyGroupEmpty === true);
  }, []);

  return {
    // State
    ...state,
    everyGroupEmpty,

    // Actions
    suggest,
    toggleGroup,
    apply,
    dismiss,
    requestStatus,
    handleSuggestion,
    handleApplied,
    handleStatus,

    // Persistence
    persistedState: NO_PERSISTENCE
  };
};
