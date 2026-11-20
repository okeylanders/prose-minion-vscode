/**
 * usePassageSearch - the Search tab's Passage Search subtab (ADR 2026-11-20
 * D15), mirrored on the host by `PassageSearchRoute`.
 *
 * - **Two steps, both correlated.** Estimate asks for a plan; Run names the
 *   host's `planId`. Each request carries an id minted here, the host echoes
 *   it, and only the answer still waited for is taken.
 * - **An estimate is for exactly what was asked.** Changing the question, a
 *   scope or the organize toggle drops the shown plan, and stops waiting for
 *   one still on its way.
 * - **Text never leaves the webview** but the question, the path or pattern
 *   field and the scope choices. An instance is opened by its number.
 * - **Only UI preferences persist:** the scope choices and the "Organize the
 *   results" toggle. The question, the plan and the result are never put in
 *   `setState`.
 */

import * as React from 'react';
import {
  MessageType,
  PassageSearchEstimateView,
  PassageSearchOpenInstanceResultMessage,
  PassageSearchOrganizeEstimateView,
  PassageSearchOrganizePlanMessage,
  PassageSearchPlanMessage,
  PassageSearchProgressMessage,
  PassageSearchProgressPayload,
  PassageSearchResultMessage,
  PassageSearchResultView,
  PassageSearchScopeChoices
} from '@messages';
import { CONTEXT_PATH_GROUPS, isContextPathGroup, type ContextPathGroup } from '@shared/types/context';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { usePersistedState } from '@hooks/usePersistence';

const SOURCE = 'webview.search.passage';

export type PassageSearchPlanState =
  | { status: 'none' }
  | { status: 'estimating' }
  | { status: 'planned'; planId: string; estimate: PassageSearchEstimateView }
  | { status: 'refused'; message: string };

export type PassageSearchRunState =
  | { status: 'idle' }
  | { status: 'running'; kind: 'search' | 'organize'; stopping: boolean; progress?: Omit<PassageSearchProgressPayload, 'requestId'> };

export type PassageSearchOrganizeOffer =
  | { status: 'none' }
  | { status: 'estimating' }
  | { status: 'planned'; organizePlanId: string; estimate: PassageSearchOrganizeEstimateView }
  | { status: 'refused'; message: string };

export interface PassageSearchState {
  question: string;
  scopes: PassageSearchScopeChoices;
  /** "Organize the results". */
  organize: boolean;
  plan: PassageSearchPlanState;
  run: PassageSearchRunState;
  /** The newest result the host answered with. */
  result?: PassageSearchResultView;
  /** Why the last Run or organizing run was refused, in host words. */
  runRefusal?: string;
  /** "Organize these results", for the result on screen. */
  organizeOffer: PassageSearchOrganizeOffer;
  /** Why the last instance could not be opened, in host words. */
  openRefusal?: string;
}

export interface PassageSearchActions {
  setQuestion: (question: string) => void;
  setActiveFileScope: (on: boolean) => void;
  setSelectionScope: (on: boolean) => void;
  setGroupScope: (group: ContextPathGroup, on: boolean) => void;
  setPatternScope: (pattern: string) => void;
  setOrganize: (on: boolean) => void;
  requestEstimate: () => void;
  runSearch: () => void;
  stopSearch: () => void;
  openInstance: (instance: number) => void;
  requestOrganizeEstimate: () => void;
  runOrganize: () => void;
  handlePlan: (message: PassageSearchPlanMessage) => void;
  handleProgress: (message: PassageSearchProgressMessage) => void;
  handleResult: (message: PassageSearchResultMessage) => void;
  handleOrganizePlan: (message: PassageSearchOrganizePlanMessage) => void;
  handleOpenInstanceResult: (message: PassageSearchOpenInstanceResultMessage) => void;
}

/** UI preferences only: never the question, a plan or a result. */
export interface PassageSearchPersistence {
  passageSearchScopes: PassageSearchScopeChoices;
  passageSearchOrganize: boolean;
}

export type UsePassageSearchReturn = PassageSearchState & PassageSearchActions & { persistedState: PassageSearchPersistence };

export const PASSAGE_SEARCH_DEFAULT_SCOPES: PassageSearchScopeChoices = { activeFile: true, selection: false, groups: [], pattern: '' };

const NO_PLAN: PassageSearchPlanState = { status: 'none' };
const IDLE: PassageSearchRunState = { status: 'idle' };
const NO_OFFER: PassageSearchOrganizeOffer = { status: 'none' };

/** Persisted scope choices, read defensively: an older or damaged shape falls back field by field. */
export function passageSearchScopesFrom(persisted: unknown): PassageSearchScopeChoices {
  const value = (typeof persisted === 'object' && persisted !== null ? persisted : {}) as Partial<Record<keyof PassageSearchScopeChoices, unknown>>;
  const groups = Array.isArray(value.groups) ? value.groups.filter((group): group is ContextPathGroup => typeof group === 'string' && isContextPathGroup(group)) : [];
  return {
    activeFile: typeof value.activeFile === 'boolean' ? value.activeFile : PASSAGE_SEARCH_DEFAULT_SCOPES.activeFile,
    selection: typeof value.selection === 'boolean' ? value.selection : PASSAGE_SEARCH_DEFAULT_SCOPES.selection,
    groups: CONTEXT_PATH_GROUPS.filter((group) => groups.includes(group)),
    pattern: typeof value.pattern === 'string' ? value.pattern : PASSAGE_SEARCH_DEFAULT_SCOPES.pattern
  };
}

export const usePassageSearch = (): UsePassageSearchReturn => {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<Partial<PassageSearchPersistence>>();

  const [question, setQuestionState] = React.useState('');
  const [scopes, setScopes] = React.useState<PassageSearchScopeChoices>(() => passageSearchScopesFrom(persisted?.passageSearchScopes));
  const [organize, setOrganizeState] = React.useState<boolean>(() => persisted?.passageSearchOrganize !== false);
  const [plan, setPlan] = React.useState<PassageSearchPlanState>(NO_PLAN);
  const [run, setRun] = React.useState<PassageSearchRunState>(IDLE);
  const [result, setResult] = React.useState<PassageSearchResultView | undefined>(undefined);
  const [runRefusal, setRunRefusal] = React.useState<string | undefined>(undefined);
  const [organizeOffer, setOrganizeOffer] = React.useState<PassageSearchOrganizeOffer>(NO_OFFER);
  const [openRefusal, setOpenRefusal] = React.useState<string | undefined>(undefined);

  // Request ids: this webview's prefix, so a reloaded webview never takes an answer meant for the one before it.
  const idPrefix = React.useRef(`ps-${Math.random().toString(36).slice(2, 10)}`);
  const minted = React.useRef(0);
  const pendingPlan = React.useRef<string | undefined>(undefined);
  const pendingRun = React.useRef<string | undefined>(undefined);
  const pendingOrganizePlan = React.useRef<string | undefined>(undefined);
  const pendingOpen = React.useRef<string | undefined>(undefined);

  const mint = React.useCallback((): string => {
    minted.current += 1;
    return `${idPrefix.current}:${minted.current}`;
  }, []);

  const post = React.useCallback((type: MessageType, payload: Record<string, unknown>) => {
    vscode.postMessage({ type, source: SOURCE, payload, timestamp: Date.now() });
  }, [vscode]);

  /** An estimate is for exactly what was asked: any edit drops it, and stops waiting for one on its way. */
  const dropPlan = React.useCallback(() => {
    pendingPlan.current = undefined;
    setPlan((current) => (current.status === 'none' ? current : NO_PLAN));
  }, []);

  const setQuestion = React.useCallback((next: string) => {
    dropPlan();
    setQuestionState(next);
  }, [dropPlan]);

  const changeScopes = React.useCallback((change: (current: PassageSearchScopeChoices) => PassageSearchScopeChoices) => {
    dropPlan();
    setScopes(change);
  }, [dropPlan]);

  const setActiveFileScope = React.useCallback((on: boolean) => changeScopes((current) => ({ ...current, activeFile: on })), [changeScopes]);
  const setSelectionScope = React.useCallback((on: boolean) => changeScopes((current) => ({ ...current, selection: on })), [changeScopes]);
  const setPatternScope = React.useCallback((pattern: string) => changeScopes((current) => ({ ...current, pattern })), [changeScopes]);
  const setGroupScope = React.useCallback((group: ContextPathGroup, on: boolean) => changeScopes((current) => ({
    ...current,
    groups: CONTEXT_PATH_GROUPS.filter((known) => (known === group ? on : current.groups.includes(known)))
  })), [changeScopes]);

  const setOrganize = React.useCallback((on: boolean) => {
    dropPlan();
    setOrganizeState(on);
  }, [dropPlan]);

  const requestEstimate = React.useCallback(() => {
    if (pendingRun.current !== undefined) {
      return;
    }
    const requestId = mint();
    pendingPlan.current = requestId;
    setPlan({ status: 'estimating' });
    setRunRefusal(undefined);
    post(MessageType.PASSAGE_SEARCH_PLAN_REQUEST, { requestId, question, scopes, organize });
  }, [mint, organize, post, question, scopes]);

  const handlePlan = React.useCallback((message: PassageSearchPlanMessage) => {
    const payload = message.payload;
    if (!payload || pendingPlan.current === undefined || payload.requestId !== pendingPlan.current) {
      return;
    }
    pendingPlan.current = undefined;
    setPlan(payload.status === 'planned'
      ? { status: 'planned', planId: payload.planId, estimate: payload.estimate }
      : { status: 'refused', message: payload.message });
  }, []);

  const runSearch = React.useCallback(() => {
    if (plan.status !== 'planned' || pendingRun.current !== undefined) {
      return;
    }
    const requestId = mint();
    pendingRun.current = requestId;
    pendingOrganizePlan.current = undefined;
    // The plan is spent by the run; a second search is estimated again.
    setPlan(NO_PLAN);
    setRun({ status: 'running', kind: 'search', stopping: false });
    setRunRefusal(undefined);
    setOpenRefusal(undefined);
    setOrganizeOffer(NO_OFFER);
    post(MessageType.PASSAGE_SEARCH_RUN, { requestId, planId: plan.planId });
  }, [mint, plan, post]);

  const stopSearch = React.useCallback(() => {
    const requestId = pendingRun.current;
    if (requestId === undefined) {
      return;
    }
    setRun((current) => (current.status === 'running' ? { ...current, stopping: true } : current));
    post(MessageType.PASSAGE_SEARCH_STOP, { requestId });
  }, [post]);

  const handleProgress = React.useCallback((message: PassageSearchProgressMessage) => {
    const payload = message.payload;
    if (!payload || pendingRun.current === undefined || payload.requestId !== pendingRun.current) {
      return;
    }
    const progress = { calls: payload.calls, found: payload.found };
    setRun((current) => (current.status === 'running' ? { ...current, progress } : current));
  }, []);

  const handleResult = React.useCallback((message: PassageSearchResultMessage) => {
    const payload = message.payload;
    if (!payload || pendingRun.current === undefined || payload.requestId !== pendingRun.current) {
      return;
    }
    pendingRun.current = undefined;
    setRun(IDLE);
    setOrganizeOffer(NO_OFFER);
    if (payload.status === 'finished') {
      setResult(payload.result);
      return;
    }
    setRunRefusal(payload.message);
    if (payload.reason === 'run-failed') {
      // The host kept nothing of a search that failed, so nothing here still names a result it holds.
      setResult(undefined);
    }
  }, []);

  const openInstance = React.useCallback((instance: number) => {
    if (!result) {
      return;
    }
    const requestId = mint();
    pendingOpen.current = requestId;
    setOpenRefusal(undefined);
    post(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE, { requestId, resultId: result.resultId, instance });
  }, [mint, post, result]);

  const handleOpenInstanceResult = React.useCallback((message: PassageSearchOpenInstanceResultMessage) => {
    const payload = message.payload;
    if (!payload || pendingOpen.current === undefined || payload.requestId !== pendingOpen.current) {
      return;
    }
    pendingOpen.current = undefined;
    setOpenRefusal(payload.status === 'refused' ? payload.message : undefined);
  }, []);

  const requestOrganizeEstimate = React.useCallback(() => {
    if (!result?.canOrganize || pendingRun.current !== undefined) {
      return;
    }
    const requestId = mint();
    pendingOrganizePlan.current = requestId;
    setOrganizeOffer({ status: 'estimating' });
    setRunRefusal(undefined);
    post(MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN_REQUEST, { requestId, resultId: result.resultId });
  }, [mint, post, result]);

  const handleOrganizePlan = React.useCallback((message: PassageSearchOrganizePlanMessage) => {
    const payload = message.payload;
    if (!payload || pendingOrganizePlan.current === undefined || payload.requestId !== pendingOrganizePlan.current) {
      return;
    }
    pendingOrganizePlan.current = undefined;
    setOrganizeOffer(payload.status === 'planned'
      ? { status: 'planned', organizePlanId: payload.organizePlanId, estimate: payload.estimate }
      : { status: 'refused', message: payload.message });
  }, []);

  const runOrganize = React.useCallback(() => {
    if (!result || organizeOffer.status !== 'planned' || pendingRun.current !== undefined) {
      return;
    }
    const requestId = mint();
    pendingRun.current = requestId;
    setRun({ status: 'running', kind: 'organize', stopping: false });
    setRunRefusal(undefined);
    setOrganizeOffer(NO_OFFER);
    post(MessageType.PASSAGE_SEARCH_ORGANIZE_RUN, { requestId, resultId: result.resultId, organizePlanId: organizeOffer.organizePlanId });
  }, [mint, organizeOffer, post, result]);

  const persistedState = React.useMemo<PassageSearchPersistence>(
    () => ({ passageSearchScopes: scopes, passageSearchOrganize: organize }),
    [organize, scopes]
  );

  return {
    // State
    question,
    scopes,
    organize,
    plan,
    run,
    result,
    runRefusal,
    organizeOffer,
    openRefusal,

    // Actions
    setQuestion,
    setActiveFileScope,
    setSelectionScope,
    setGroupScope,
    setPatternScope,
    setOrganize,
    requestEstimate,
    runSearch,
    stopSearch,
    openInstance,
    requestOrganizeEstimate,
    runOrganize,
    handlePlan,
    handleProgress,
    handleResult,
    handleOrganizePlan,
    handleOpenInstanceResult,

    // Persistence
    persistedState
  };
};
