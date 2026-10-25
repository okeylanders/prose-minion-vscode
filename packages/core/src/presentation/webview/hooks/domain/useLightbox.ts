/**
 * useLightbox — the Lightbox domain hook (ADR 2026-10-19 D6, D9, D10, D12),
 * mirroring the host's LightboxHandler and LightboxReadingHandler.
 *
 * It owns the `LIGHTBOX_*` transport: asks for the host's current outcome on
 * mount, receives boards and refusals, group results, run progress, the
 * estimate and the context list, and posts the source actions (choose a file,
 * re-read it, dismiss a refusal) and the reading and context actions. The
 * board and the standing refusal are host truth and are never persisted here
 * (D12): every `LIGHTBOX_BOARD` carries both, so a refusal made before this
 * webview listened still shows (PR #148 F-02), and a group result replaces
 * its group in the board it names. Dismissing tells the host, which then
 * stops serving it. Webview state holds only UI preferences: the tile filter,
 * the pinned item, and which lenses are off.
 *
 * The lens toggles reach the host on mount, on every toggle and whenever the
 * board changes; `requestEstimate` re-sends them on every model
 * confirmation (`handleModelData`), a change to the context list, and a
 * press the host refused as priced on inputs that moved. The host answers
 * each with the context list and a fresh estimate.
 *
 * **Correlation (PR #149 F-03).** Every estimate request carries a
 * webview-minted `requestId`, and from the moment it is sent the press has
 * no usable estimate ("Estimating the cost…"): only the reply echoing the
 * latest id, for the board it was asked about, becomes the estimate, so a
 * late reply for another board, other lenses or another model is never
 * shown or pressed. Runs and progress are kept per board and token
 * (`lightboxRuns`): one board finishing never clears another's Stop, a late
 * message from a stopped or replaced run is ignored, and Stop is built from
 * the board's own run.
 *
 * Handoffs to the Workshop (D11) are `useLightboxHandoff`'s. The Spark
 * lane's "Not for me" and its Undo (Slice 4) ask the host, which marks the
 * board's own spark and answers with the board; nothing about a dismissal is
 * kept here.
 *
 * **The selected, confirmed model (PR #149 F-03 re-review).** The model is
 * the Lightbox's own scope (Slice 4L), never the Workshop's. The header's
 * model picker updates its selection at once, while the host saves it and
 * only then confirms it with `MODEL_DATA`. An estimate is usable only when
 * it priced the model the writer has selected, and that selection is the one
 * the host last confirmed: while a selection is saving, Read waits. Each
 * request remembers the model it was asked for, and a reply that priced
 * another model is refused even when its request id is the latest. Every
 * `MODEL_DATA` is an authoritative confirmation (a saved selection, an
 * external change, a catalog refresh with new prices, or the same values
 * again) and asks for a fresh estimate. A press names the model, and the
 * host starts only on it. Nothing is ever pressed automatically.
 */

import * as React from 'react';
import {
  LightboxActiveRun,
  LightboxBoard,
  LightboxBoardMessage,
  LightboxContextFile,
  LightboxContextFilesMessage,
  LightboxGroupResultMessage,
  LightboxLensId,
  LightboxRunEstimate,
  LightboxRunEstimateMessage,
  LightboxRunProgress,
  LightboxRunProgressMessage,
  LightboxRunScope,
  LightboxSourceRefusal,
  LightboxSourceRefusedMessage,
  MessageType,
  ModelDataMessage
} from '@messages';
import { isLightboxLensId } from '@shared/constants/lightbox';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { usePersistedState } from '@hooks/usePersistence';
import { LightboxItemRef, parseLightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import { mergeLightboxGroupResult } from '@hooks/domain/lightbox/lightboxReadings';
import {
  NO_LIGHTBOX_RUNS,
  applyLightboxRunProgress,
  lightboxCancelOf,
  pruneLightboxRuns,
  withLightboxBoardRun,
  type LightboxRunsByBoard
} from '@hooks/domain/lightbox/lightboxRuns';

/** Which tiles the board shows. */
export type LightboxFilter = 'all' | 'measured' | 'read';

const FILTERS: readonly LightboxFilter[] = ['all', 'measured', 'read'];

export interface LightboxContextState {
  files: LightboxContextFile[];
  totalWords: number;
  ceilingWords: number;
  notice: string | null;
}

export interface LightboxState {
  /** `undefined` until the host first answers; `null` when nothing is boarded yet. */
  board: LightboxBoard | null | undefined;
  refusal: LightboxSourceRefusal | null;
  /** A re-read is on its way. */
  rereading: boolean;
  filter: LightboxFilter;
  selected: LightboxItemRef | null;
  lensesOff: readonly LightboxLensId[];
  /**
   * The current board's estimate: `undefined` while one is being asked for
   * (nothing to press yet), `null` with no board.
   */
  estimate: LightboxRunEstimate | null | undefined;
  /** The current board's run in flight, by its token. */
  activeRun: LightboxActiveRun | null;
  /** The latest progress of the current board's run (or a refusal of a press on it). */
  progress: LightboxRunProgress | null;
  /** A press on the current board was sent and the host has not answered it yet. */
  awaitingStart: boolean;
  context: LightboxContextState;
}

export interface LightboxActions {
  handleBoard: (message: LightboxBoardMessage) => void;
  handleSourceRefused: (message: LightboxSourceRefusedMessage) => void;
  handleRunEstimate: (message: LightboxRunEstimateMessage) => void;
  handleRunProgress: (message: LightboxRunProgressMessage) => void;
  handleGroupResult: (message: LightboxGroupResultMessage) => void;
  handleContextFiles: (message: LightboxContextFilesMessage) => void;
  /**
   * The host confirmed the model configuration (`MODEL_DATA`): record the
   * confirmed Lightbox model, and ask for a fresh estimate.
   */
  handleModelData: (message: ModelDataMessage) => void;
  requestBoard: () => void;
  pickSourceFile: () => void;
  refreshSource: () => void;
  dismissRefusal: () => void;
  setFilter: (filter: LightboxFilter) => void;
  selectItem: (ref: LightboxItemRef | null) => void;
  toggleLens: (lens: LightboxLensId) => void;
  /** Re-send the lens toggles so the host re-estimates (a model or catalog change). */
  requestEstimate: () => void;
  run: (scope: LightboxRunScope) => void;
  cancelRun: (token: string) => void;
  addContextFile: () => void;
  removeContextFile: (id: string) => void;
  /** "Not for me" (`true`) or its Undo (`false`) for a spark on the board on screen; the host answers with the board. */
  setSparkDismissed: (tileId: string, dismissed: boolean) => void;
}

/** UI preferences only. The board is the host's (D12). */
export interface LightboxPersistence {
  lightboxFilter: LightboxFilter;
  lightboxSelectedItem: LightboxItemRef | null;
  lightboxLensesOff: LightboxLensId[];
}

export type UseLightboxReturn = LightboxState & LightboxActions & {
  persistedState: LightboxPersistence;
};

const SOURCE = 'webview.lightbox';
const NO_CONTEXT: LightboxContextState = { files: [], totalWords: 0, ceilingWords: 0, notice: null };

/** An estimate request in flight: its id, the board on screen and the model selected when it was asked. */
interface LightboxEstimateRequest {
  requestId: string;
  boardId: string | undefined;
  model: string | undefined;
}

export interface UseLightboxOptions {
  /** The Lightbox model the writer has selected (the header picker's, possibly not yet saved). */
  lightboxModel?: string;
}

type LightboxRequestType =
  | MessageType.LIGHTBOX_REQUEST_BOARD
  | MessageType.LIGHTBOX_PICK_SOURCE_FILE
  | MessageType.LIGHTBOX_REFRESH_SOURCE
  | MessageType.LIGHTBOX_DISMISS_REFUSAL
  | MessageType.LIGHTBOX_SET_LENSES
  | MessageType.LIGHTBOX_RUN
  | MessageType.LIGHTBOX_CANCEL_RUN
  | MessageType.LIGHTBOX_ADD_CONTEXT_FILES
  | MessageType.LIGHTBOX_REMOVE_CONTEXT_FILE
  | MessageType.LIGHTBOX_SET_SPARK_DISMISSED;

export function useLightbox(options: UseLightboxOptions = {}): UseLightboxReturn {
  const selectedModel = options.lightboxModel;
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<Partial<Record<keyof LightboxPersistence, unknown>>>();

  const [board, setBoard] = React.useState<LightboxBoard | null | undefined>(undefined);
  const [refusal, setRefusal] = React.useState<LightboxSourceRefusal | null>(null);
  const [rereading, setRereading] = React.useState(false);
  const [filter, setFilterState] = React.useState<LightboxFilter>(() =>
    FILTERS.find((candidate) => candidate === persisted?.lightboxFilter) ?? 'all'
  );
  const [selected, setSelected] = React.useState<LightboxItemRef | null>(() =>
    parseLightboxItemRef(persisted?.lightboxSelectedItem)
  );
  const [lensesOff, setLensesOff] = React.useState<LightboxLensId[]>(() =>
    Array.isArray(persisted?.lightboxLensesOff)
      ? [...new Set(persisted.lightboxLensesOff.filter(isLightboxLensId))]
      : []
  );
  const [estimate, setEstimate] = React.useState<LightboxRunEstimate | null | undefined>(undefined);
  const [runs, setRuns] = React.useState<LightboxRunsByBoard>(NO_LIGHTBOX_RUNS);
  const [awaitingStartFor, setAwaitingStartFor] = React.useState<string | null>(null);
  const [context, setContext] = React.useState<LightboxContextState>(NO_CONTEXT);
  // The Lightbox model as the host last confirmed it, and how many confirmations have arrived.
  const [confirmedModel, setConfirmedModel] = React.useState<string | undefined>(undefined);
  const [confirmations, setConfirmations] = React.useState(0);

  // Refusals dismissed here; a host answer already on its way may still name one.
  const dismissed = React.useRef(new Set<string>());
  // The latest estimate request: only its reply becomes the estimate.
  const pendingEstimate = React.useRef<LightboxEstimateRequest | null>(null);
  const requestIds = React.useRef({ prefix: Math.random().toString(36).slice(2, 10), count: 0 });
  // The board on screen, for message handlers that run between renders.
  const boardOnScreen = React.useRef<string | undefined>(undefined);
  boardOnScreen.current = board?.boardId ?? undefined;

  const post = React.useCallback(
    (type: LightboxRequestType, payload: object = {}) => {
      vscode.postMessage({ type, source: SOURCE, payload, timestamp: Date.now() });
    },
    [vscode]
  );

  const unlessDismissed = React.useCallback(
    (incoming: LightboxSourceRefusal | null | undefined): LightboxSourceRefusal | null =>
      incoming && !dismissed.current.has(incoming.id) ? incoming : null,
    []
  );

  const handleBoard = React.useCallback((message: LightboxBoardMessage) => {
    const next = message.payload?.board ?? null;
    setBoard(next);
    setRefusal(unlessDismissed(message.payload?.refusal));
    setRereading(false);
    // A board answers a press on it too: a run's board shows its running
    // groups, and one that arrives after a missed refusal ends the wait.
    setAwaitingStartFor((current) => (current !== null && current === next?.boardId ? null : current));
    setRuns((current) => pruneLightboxRuns(current, next?.boardId));
  }, [unlessDismissed]);

  const handleSourceRefused = React.useCallback((message: LightboxSourceRefusedMessage) => {
    setRefusal(unlessDismissed(message.payload?.refusal));
    setRereading(false);
  }, [unlessDismissed]);

  const handleRunEstimate = React.useCallback((message: LightboxRunEstimateMessage) => {
    const payload = message.payload;
    const pending = pendingEstimate.current;
    // Only the reply to the latest request counts: a late one priced other inputs.
    if (!payload || !pending || payload.requestId !== pending.requestId) {
      return;
    }
    const next = payload.estimate ?? null;
    if (next && next.boardId !== pending.boardId) {
      // The host priced a board this webview has not shown yet; its board message brings a fresh request.
      return;
    }
    pendingEstimate.current = null;
    if (next && next.model !== pending.model) {
      // The host priced another model than the one asked for (a selection still saving): never usable.
      return;
    }
    setEstimate(next);
    if (next) {
      const run = payload.activeRun?.boardId === next.boardId ? payload.activeRun : undefined;
      setRuns((current) => withLightboxBoardRun(current, next.boardId, run));
    }
  }, []);

  const handleGroupResult = React.useCallback((message: LightboxGroupResultMessage) => {
    const payload = message.payload;
    if (payload) {
      setBoard((current) => (current ? mergeLightboxGroupResult(current, payload) : current));
    }
  }, []);

  const handleModelData = React.useCallback((message: ModelDataMessage) => {
    const confirmed = message.payload?.selections?.lightbox;
    if (confirmed !== undefined) {
      setConfirmedModel(confirmed);
    }
    setConfirmations((count) => count + 1);
  }, []);

  const handleContextFiles = React.useCallback((message: LightboxContextFilesMessage) => {
    const payload = message.payload;
    if (payload) {
      setContext({
        files: payload.files,
        totalWords: payload.totalWords,
        ceilingWords: payload.ceilingWords,
        notice: payload.notice ?? null
      });
    }
  }, []);

  const requestBoard = React.useCallback(() => post(MessageType.LIGHTBOX_REQUEST_BOARD), [post]);
  const pickSourceFile = React.useCallback(() => post(MessageType.LIGHTBOX_PICK_SOURCE_FILE), [post]);
  const refreshSource = React.useCallback(() => {
    setRereading(true);
    post(MessageType.LIGHTBOX_REFRESH_SOURCE);
  }, [post]);
  const dismissRefusal = React.useCallback(() => {
    if (refusal) {
      dismissed.current.add(refusal.id);
      post(MessageType.LIGHTBOX_DISMISS_REFUSAL, { refusalId: refusal.id });
    }
    setRefusal(null);
  }, [post, refusal]);
  const setFilter = React.useCallback((next: LightboxFilter) => setFilterState(next), []);
  const selectItem = React.useCallback((ref: LightboxItemRef | null) => setSelected(ref), []);
  const toggleLens = React.useCallback((lens: LightboxLensId) => {
    setLensesOff((current) =>
      current.includes(lens) ? current.filter((candidate) => candidate !== lens) : [...current, lens]
    );
  }, []);

  const boardId = board?.boardId;
  const lensesKey = lensesOff.join(',');
  /** Ask for a fresh estimate; until its own reply lands there is nothing to press. */
  const requestEstimate = React.useCallback(() => {
    const ids = requestIds.current;
    ids.count += 1;
    const requestId = `${ids.prefix}-${ids.count}`;
    pendingEstimate.current = { requestId, boardId, model: selectedModel };
    setEstimate(undefined);
    post(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: lensesKey ? (lensesKey.split(',') as LightboxLensId[]) : [], requestId });
  }, [boardId, lensesKey, post, selectedModel]);
  const latestRequestEstimate = React.useRef(requestEstimate);
  latestRequestEstimate.current = requestEstimate;

  const handleRunProgress = React.useCallback((message: LightboxRunProgressMessage) => {
    const next = message.payload;
    if (!next) {
      return;
    }
    setRuns((current) => applyLightboxRunProgress(current, next));
    if (next.phase === 'started' || next.phase === 'refused') {
      setAwaitingStartFor((current) => (current === next.boardId ? null : current));
    }
    if (next.phase === 'refused' && next.reestimate && next.boardId === boardOnScreen.current) {
      // The press named an estimate the host no longer holds: ask for the current one.
      latestRequestEstimate.current();
    }
  }, []);

  // Only the board on screen's own estimate is shown or pressed, even for the render before a new board's request,
  // and only one that priced the selected model once the host has confirmed that selection.
  const modelSettled = confirmedModel !== undefined && selectedModel === confirmedModel;
  const boardEstimate = estimate && (estimate.boardId !== boardId || !modelSettled || estimate.model !== selectedModel)
    ? undefined
    : estimate;
  // A press names the estimate it was shown and the model it priced, so the host runs only what was priced (PR #149 F-02, F-03).
  const estimateKey = boardEstimate?.key;
  const pressModel = boardEstimate?.model;
  const run = React.useCallback((scope: LightboxRunScope) => {
    if (!boardId || !estimateKey || !pressModel) {
      return;
    }
    setAwaitingStartFor(boardId);
    post(MessageType.LIGHTBOX_RUN, { boardId, scope, estimateKey, model: pressModel });
  }, [boardId, estimateKey, post, pressModel]);

  // Stop names the board's own run, never the board on screen paired with another run's token.
  const cancelRun = React.useCallback((token: string) => {
    const cancel = lightboxCancelOf(runs, boardId, token);
    if (cancel) {
      post(MessageType.LIGHTBOX_CANCEL_RUN, cancel);
    }
  }, [boardId, post, runs]);

  const addContextFile = React.useCallback(() => post(MessageType.LIGHTBOX_ADD_CONTEXT_FILES), [post]);
  const removeContextFile = React.useCallback((id: string) => {
    post(MessageType.LIGHTBOX_REMOVE_CONTEXT_FILE, { id });
  }, [post]);

  // The pin goes with a spark set aside, since it is no longer on the board's face.
  const setSparkDismissed = React.useCallback((tileId: string, dismissed: boolean) => {
    if (!boardId) {
      return;
    }
    if (dismissed) {
      setSelected((current) => (current?.kind === 'reading' && current.tileId === tileId ? null : current));
    }
    post(MessageType.LIGHTBOX_SET_SPARK_DISMISSED, { boardId, tileId, dismissed });
  }, [boardId, post]);

  // The outcome is host truth: ask for it once on mount (a reveal re-asks host-side).
  React.useEffect(() => {
    requestBoard();
  }, [requestBoard]);

  // The lens toggles, and with them the estimate, follow every toggle and every new board.
  const syncLensesWithHost = React.useCallback(() => requestEstimate(), [requestEstimate]);
  React.useEffect(() => {
    syncLensesWithHost();
  }, [syncLensesWithHost, boardId]);

  // Every model confirmation is authoritative: a saved selection, an external change, new catalog prices, or the same values.
  const syncEstimateWithModelConfirmation = React.useCallback(() => {
    if (confirmations > 0) {
      latestRequestEstimate.current();
    }
  }, [confirmations]);
  React.useEffect(() => {
    syncEstimateWithModelConfirmation();
  }, [syncEstimateWithModelConfirmation]);

  // A context file added or removed changes what a press sends, so the estimate follows it.
  const contextKey = `${context.files.map((file) => file.id).join(',')}|${context.totalWords}`;
  const lastContextKey = React.useRef(contextKey);
  const syncEstimateWithContext = React.useCallback(() => {
    if (lastContextKey.current !== contextKey) {
      lastContextKey.current = contextKey;
      latestRequestEstimate.current();
    }
  }, [contextKey]);
  React.useEffect(() => {
    syncEstimateWithContext();
  }, [syncEstimateWithContext]);

  const persistedState = React.useMemo<LightboxPersistence>(
    () => ({
      lightboxFilter: filter,
      lightboxSelectedItem: selected,
      lightboxLensesOff: [...lensesOff]
    }),
    [filter, lensesOff, selected]
  );

  return {
    board,
    refusal,
    rereading,
    filter,
    selected,
    lensesOff,
    estimate: boardEstimate,
    activeRun: (boardId ? runs[boardId]?.run : undefined) ?? null,
    progress: (boardId ? runs[boardId]?.progress : undefined) ?? null,
    awaitingStart: awaitingStartFor !== null && awaitingStartFor === boardId,
    context,
    handleBoard,
    handleSourceRefused,
    handleRunEstimate,
    handleRunProgress,
    handleGroupResult,
    handleContextFiles,
    handleModelData,
    requestBoard,
    pickSourceFile,
    refreshSource,
    dismissRefusal,
    setFilter,
    selectItem,
    toggleLens,
    requestEstimate,
    run,
    cancelRun,
    addContextFile,
    removeContextFile,
    setSparkDismissed,
    persistedState
  };
}
