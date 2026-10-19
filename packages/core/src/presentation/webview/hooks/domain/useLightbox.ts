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
 * board changes; `requestEstimate` re-sends them when the assistant model or
 * its catalog changes. The host answers each with the context list and a
 * fresh estimate.
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
  MessageType
} from '@messages';
import { isLightboxLensId } from '@shared/constants/lightbox';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { usePersistedState } from '@hooks/usePersistence';
import { LightboxItemRef, parseLightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import { mergeLightboxGroupResult } from '@hooks/domain/lightbox/lightboxReadings';

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
  /** `undefined` until the host estimates; `null` with no board. */
  estimate: LightboxRunEstimate | null | undefined;
  /** The board's run in flight, as the host last reported it with the estimate. */
  activeRun: LightboxActiveRun | null;
  /** The latest progress of a run (or a refusal). */
  progress: LightboxRunProgress | null;
  /** A press was sent and the host has not answered it yet. */
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

type LightboxRequestType =
  | MessageType.LIGHTBOX_REQUEST_BOARD
  | MessageType.LIGHTBOX_PICK_SOURCE_FILE
  | MessageType.LIGHTBOX_REFRESH_SOURCE
  | MessageType.LIGHTBOX_DISMISS_REFUSAL
  | MessageType.LIGHTBOX_SET_LENSES
  | MessageType.LIGHTBOX_RUN
  | MessageType.LIGHTBOX_CANCEL_RUN
  | MessageType.LIGHTBOX_ADD_CONTEXT_FILES
  | MessageType.LIGHTBOX_REMOVE_CONTEXT_FILE;

export function useLightbox(): UseLightboxReturn {
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
  const [activeRun, setActiveRun] = React.useState<LightboxActiveRun | null>(null);
  const [progress, setProgress] = React.useState<LightboxRunProgress | null>(null);
  const [awaitingStart, setAwaitingStart] = React.useState(false);
  const [context, setContext] = React.useState<LightboxContextState>(NO_CONTEXT);

  // Refusals dismissed here; a host answer already on its way may still name one.
  const dismissed = React.useRef(new Set<string>());

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
    setBoard(message.payload?.board ?? null);
    setRefusal(unlessDismissed(message.payload?.refusal));
    setRereading(false);
    // A board answers a press too: a run's board shows its running groups,
    // and one that arrives after a missed refusal ends the wait.
    setAwaitingStart(false);
  }, [unlessDismissed]);

  const handleSourceRefused = React.useCallback((message: LightboxSourceRefusedMessage) => {
    setRefusal(unlessDismissed(message.payload?.refusal));
    setRereading(false);
  }, [unlessDismissed]);

  const handleRunEstimate = React.useCallback((message: LightboxRunEstimateMessage) => {
    setEstimate(message.payload?.estimate ?? null);
    setActiveRun(message.payload?.activeRun ?? null);
  }, []);

  const handleRunProgress = React.useCallback((message: LightboxRunProgressMessage) => {
    const next = message.payload;
    if (!next) {
      return;
    }
    setProgress(next);
    setAwaitingStart(false);
    if (next.phase === 'started' && next.token) {
      setActiveRun({ boardId: next.boardId, token: next.token, groups: next.groups, ...(next.lens ? { lens: next.lens } : {}) });
    } else if (next.phase === 'finished' || next.phase === 'cancelled') {
      setActiveRun(null);
    }
  }, []);

  const handleGroupResult = React.useCallback((message: LightboxGroupResultMessage) => {
    const payload = message.payload;
    if (payload) {
      setBoard((current) => (current ? mergeLightboxGroupResult(current, payload) : current));
    }
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

  const lensesKey = lensesOff.join(',');
  const requestEstimate = React.useCallback(() => {
    post(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: lensesKey ? (lensesKey.split(',') as LightboxLensId[]) : [] });
  }, [lensesKey, post]);

  const boardId = board?.boardId;
  const run = React.useCallback((scope: LightboxRunScope) => {
    if (!boardId) {
      return;
    }
    setAwaitingStart(true);
    post(MessageType.LIGHTBOX_RUN, { boardId, scope });
  }, [boardId, post]);

  const cancelRun = React.useCallback((token: string) => {
    if (!boardId) {
      return;
    }
    post(MessageType.LIGHTBOX_CANCEL_RUN, { boardId, token });
  }, [boardId, post]);

  const addContextFile = React.useCallback(() => post(MessageType.LIGHTBOX_ADD_CONTEXT_FILES), [post]);
  const removeContextFile = React.useCallback((id: string) => {
    post(MessageType.LIGHTBOX_REMOVE_CONTEXT_FILE, { id });
  }, [post]);

  // The outcome is host truth: ask for it once on mount (a reveal re-asks host-side).
  React.useEffect(() => {
    requestBoard();
  }, [requestBoard]);

  // The lens toggles, and with them the estimate, follow every toggle and every new board.
  const syncLensesWithHost = React.useCallback(() => requestEstimate(), [requestEstimate]);
  React.useEffect(() => {
    syncLensesWithHost();
  }, [syncLensesWithHost, boardId]);

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
    estimate,
    activeRun,
    progress,
    awaitingStart,
    context,
    handleBoard,
    handleSourceRefused,
    handleRunEstimate,
    handleRunProgress,
    handleGroupResult,
    handleContextFiles,
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
    persistedState
  };
}
