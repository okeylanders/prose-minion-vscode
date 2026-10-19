/**
 * useLightbox — the Lightbox domain hook (ADR 2026-10-19 D10, D12), mirroring
 * the host's LightboxHandler.
 *
 * It owns the `LIGHTBOX_*` transport: asks for the host's current outcome on
 * mount, receives boards and refusals, and posts the source actions (choose
 * a file, re-read it, dismiss a refusal). The board and the standing refusal
 * are host truth and are never persisted here (D12): every `LIGHTBOX_BOARD`
 * carries both, so a refusal made before this webview listened still shows
 * (PR #148 F-02). Dismissing tells the host, which then stops serving it.
 * Webview state holds only UI preferences: the tile filter, the pinned item,
 * and which lenses are off.
 */

import * as React from 'react';
import {
  LightboxBoard,
  LightboxBoardMessage,
  LightboxLensId,
  LightboxSourceRefusal,
  LightboxSourceRefusedMessage,
  MessageType
} from '@messages';
import { isLightboxLensId } from '@shared/constants/lightbox';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { usePersistedState } from '@hooks/usePersistence';
import { LightboxItemRef, parseLightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';

/** Which tiles the board shows. */
export type LightboxFilter = 'all' | 'measured' | 'read';

const FILTERS: readonly LightboxFilter[] = ['all', 'measured', 'read'];

export interface LightboxState {
  /** `undefined` until the host first answers; `null` when nothing is boarded yet. */
  board: LightboxBoard | null | undefined;
  refusal: LightboxSourceRefusal | null;
  /** A re-read is on its way. */
  rereading: boolean;
  filter: LightboxFilter;
  selected: LightboxItemRef | null;
  lensesOff: readonly LightboxLensId[];
}

export interface LightboxActions {
  handleBoard: (message: LightboxBoardMessage) => void;
  handleSourceRefused: (message: LightboxSourceRefusedMessage) => void;
  requestBoard: () => void;
  pickSourceFile: () => void;
  refreshSource: () => void;
  dismissRefusal: () => void;
  setFilter: (filter: LightboxFilter) => void;
  selectItem: (ref: LightboxItemRef | null) => void;
  toggleLens: (lens: LightboxLensId) => void;
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

type LightboxRequestType =
  | MessageType.LIGHTBOX_REQUEST_BOARD
  | MessageType.LIGHTBOX_PICK_SOURCE_FILE
  | MessageType.LIGHTBOX_REFRESH_SOURCE
  | MessageType.LIGHTBOX_DISMISS_REFUSAL;

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
  }, [unlessDismissed]);

  const handleSourceRefused = React.useCallback((message: LightboxSourceRefusedMessage) => {
    setRefusal(unlessDismissed(message.payload?.refusal));
    setRereading(false);
  }, [unlessDismissed]);

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

  // The outcome is host truth: ask for it once on mount (a reveal re-asks host-side).
  React.useEffect(() => {
    requestBoard();
  }, [requestBoard]);

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
    handleBoard,
    handleSourceRefused,
    requestBoard,
    pickSourceFile,
    refreshSource,
    dismissRefusal,
    setFilter,
    selectItem,
    toggleLens,
    persistedState
  };
}
