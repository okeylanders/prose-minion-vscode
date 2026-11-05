/**
 * Project memory's write path, as the webview asks for it (ADR 2026-11-04
 * D6, D7, D8; epic Slice 3): a card's Save, Edit…, Dismiss and Show it
 * again; Save to memory… on a bubble; New; Edit and Forget from a receipt;
 * and the one memory sheet those open.
 *
 * - **Host-owned truth.** Cards and receipts arrive on the snapshot's turns;
 *   nothing is applied optimistically. A write posts and waits for its
 *   answer (`WORKSHOP_MEMORY_WRITE_RESULT`) and the next snapshot.
 * - **Correlated.** Each request carries an id this hook mints (with a
 *   per-webview prefix), and only the answer to a request still pending is
 *   taken, so a late answer never closes a sheet opened since. The sheet
 *   keeps the writer's draft until the host has saved it.
 * - **The host's numbers.** The "Always load in full" line and its refusal
 *   read the host's estimate (`WORKSHOP_MEMORY_ESTIMATE`), asked again as the
 *   draft changes, never a webview guess.
 * - **From a bookmark** (Bookmark Recall Slice 3, ADR 2026-11-05 D9): a
 *   turn of this room outside the window prefills from the host's message
 *   (the browser's live row, or a turn preview asked for here) and names its
 *   room (`roomRevision`); a saved session's turn (`saved-turn`) prefills
 *   from the row the host sent and saves by session and turn.
 * - **Nothing persisted.** Memory files and the session own everything.
 */

import * as React from 'react';
import {
  MessageType,
  type WorkshopMemoryDraft,
  type WorkshopMemoryEditDataMessage,
  type WorkshopMemoryEstimateResultMessage,
  type WorkshopMemoryListedTitle,
  type WorkshopMemoryPinnedEstimate,
  type WorkshopMemoryWriteResultMessage,
  type WorkshopTurn,
  type WorkshopTurnPreviewMessage
} from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { workshopMemoryCardKey, workshopMemoryProposalAt, workshopMemoryProposalDraft } from '@shared/constants/workshopProjectMemoryWrites';
import {
  WORKSHOP_MEMORY_EMPTY_DRAFT as EMPTY_DRAFT,
  workshopMemoryNoteFromTurn,
  workshopMemoryRoomBookmarkSheet,
  workshopMemorySavedBookmarkSheet,
  workshopMemorySheetWithPreview,
  type WorkshopMemoryRoomBookmark,
  type WorkshopMemorySavedBookmark
} from '@hooks/domain/workshop/memory/workshopMemoryBookmarkSheets';
import { withWorkshopMemoryEntry, withWorkshopMemoryKey } from '@hooks/domain/workshop/memory/workshopMemoryKeyedState';
import { workshopMemorySheetSubmission } from '@hooks/domain/workshop/memory/workshopMemorySheetSubmission';

export { workshopMemoryNoteFromTurn, type WorkshopMemoryRoomBookmark, type WorkshopMemorySavedBookmark };

/** What the sheet is for: a card's edit, a saved memory's edit, a turn of this room or of a saved session as source, or nothing. */
export type WorkshopMemorySheetMode = 'card' | 'memory' | 'turn' | 'saved-turn' | 'new';


export interface WorkshopMemorySheetState {
  readonly mode: WorkshopMemorySheetMode;
  /** The card's or bubble's turn. */
  readonly turnId?: string;
  /** The card's index on its turn (Slice 6b); a card's edit only. */
  readonly proposalIndex?: number;
  /** The saved memory being edited: a receipt's or the manager's, or the note an edit card changes (Slice 6c). */
  readonly memoryId?: string;
  readonly draft: WorkshopMemoryDraft;
  /** Titles of the memories `draft.supersedes` names. */
  readonly replaces: readonly WorkshopMemoryListedTitle[];
  /** A saved memory's fields are still being read. */
  readonly loading: boolean;
  /** The pending write's request, while the host saves. */
  readonly saving: boolean;
  readonly estimate?: WorkshopMemoryPinnedEstimate;
  readonly error?: string;
  /** Who the source is, for the source line ("Jill's reply"). */
  readonly sourceLabel?: string;
  /** A bookmark's turn outside the window: the room it was asked in. */
  readonly roomRevision?: number;
  /** A saved session's turn: its session and title. */
  readonly sessionId?: string;
  readonly sessionTitle?: string;
}

export interface WorkshopProjectMemoryState {
  sheet: WorkshopMemorySheetState | null;
  /** Cards whose action is waiting for the host, by `workshopMemoryCardKey`. */
  busyCards: ReadonlySet<string>;
  /** A card's refusal, by `workshopMemoryCardKey`, until its next action. */
  cardErrors: ReadonlyMap<string, string>;
  /** Receipts whose Forget or Restore waits for the host, by the receipt's turn id. */
  busyReceipts: ReadonlySet<string>;
  /**
   * A receipt's refused Forget or Restore, by the receipt's turn id, until
   * its next try, its success, or a new room (PR #221 F-01).
   */
  receiptErrors: ReadonlyMap<string, WorkshopMemoryReceiptError>;
}

/** What a receipt's refused action says beside it. */
export interface WorkshopMemoryReceiptError {
  readonly action: 'forget' | 'restore';
  readonly error: string;
}

export interface UseWorkshopProjectMemoryOptions {
  /**
   * The room's identity (`room:<revision>`); a new one (New, Open, Rewind,
   * Branch) drops receipt feedback and ignores answers still owed to the
   * room before (PR #221 F-01).
   */
  roomKey?: string;
}

export interface WorkshopProjectMemoryActions {
  saveCard: (turnId: string, index: number) => void;
  dismissCard: (turnId: string, index: number) => void;
  reopenCard: (turnId: string, index: number) => void;
  /** Edit… on a card: the sheet, filled from the proposal at `index`. */
  editCard: (turn: WorkshopTurn, index: number) => void;
  /** Save to memory… on an eligible bubble. */
  saveTurn: (turn: WorkshopTurn) => void;
  /** Remember this on a bookmark of this room: Save to memory… when its turn is in the window, else from the host's message. */
  rememberRoomBookmark: (bookmark: WorkshopMemoryRoomBookmark) => void;
  /** Remember this on a saved session's bookmark. */
  rememberSavedBookmark: (bookmark: WorkshopMemorySavedBookmark) => void;
  /** Edit on a receipt (and Slice 4b's manager). */
  editMemory: (memoryId: string) => void;
  /** New memory (Slice 4b's manager). */
  newMemory: () => void;
  /** Forget on a receipt; its feedback shows beside that receipt. */
  forget: (memoryId: string, receiptTurnId: string) => void;
  /** Restore on a forgotten receipt; its feedback shows beside that receipt. */
  restore: (memoryId: string, receiptTurnId: string) => void;
  updateDraft: (change: Partial<WorkshopMemoryDraft>) => void;
  /** "Don't replace" one memory. */
  dropReplaced: (memoryId: string) => void;
  submitSheet: () => void;
  closeSheet: () => void;
  handleWriteResult: (message: WorkshopMemoryWriteResultMessage) => void;
  handleEditData: (message: WorkshopMemoryEditDataMessage) => void;
  handleEstimateResult: (message: WorkshopMemoryEstimateResultMessage) => void;
  /** A turn preview this hook asked for, to prefill a bookmark outside the window. */
  handleTurnPreview: (message: WorkshopTurnPreviewMessage) => void;
}

export interface WorkshopProjectMemoryPersistence {
  // Memory files and the session own everything; nothing is kept in webview state.
}

export type UseWorkshopProjectMemoryReturn = WorkshopProjectMemoryState &
  WorkshopProjectMemoryActions & {
    persistedState: WorkshopProjectMemoryPersistence;
  };

type Pending =
  | { readonly kind: 'card'; readonly card: string }
  /** A sheet's save; a card's names its card key, which stays busy until answered (PR #200 F-05). */
  | { readonly kind: 'sheet'; readonly card?: string }
  | { readonly kind: 'receipt'; readonly receipt: string; readonly action: 'forget' | 'restore'; readonly roomKey: string | undefined };

const SOURCE = 'webview.workshop.memory';
const ESTIMATE_DELAY_MS = 250;

export function useWorkshopProjectMemory({ roomKey }: UseWorkshopProjectMemoryOptions = {}): UseWorkshopProjectMemoryReturn {
  const vscode = useVSCodeApi();
  const [sheet, setSheetState] = React.useState<WorkshopMemorySheetState | null>(null);
  // The sheet as last set, so actions read it without side effects in an updater.
  const sheetRef = React.useRef<WorkshopMemorySheetState | null>(null);
  const setSheet = React.useCallback((next: WorkshopMemorySheetState | null) => {
    sheetRef.current = next;
    setSheetState(next);
  }, []);
  const [busyCards, setBusyCards] = React.useState<ReadonlySet<string>>(new Set());
  const [cardErrors, setCardErrors] = React.useState<ReadonlyMap<string, string>>(new Map());
  const [busyReceipts, setBusyReceipts] = React.useState<ReadonlySet<string>>(new Set());
  const [receiptErrors, setReceiptErrors] = React.useState<ReadonlyMap<string, WorkshopMemoryReceiptError>>(new Map());
  const roomKeyRef = React.useRef(roomKey);
  const pending = React.useRef(new Map<string, Pending>());
  const sheetRequest = React.useRef<string | undefined>(undefined);
  const editRequest = React.useRef<string | undefined>(undefined);
  const previewRequest = React.useRef<string | undefined>(undefined);
  const estimateRequest = React.useRef<string | undefined>(undefined);
  const estimateTimer = React.useRef<number | undefined>(undefined);
  const ids = React.useRef({ prefix: `ws-memory-${Math.random().toString(36).slice(2, 10)}`, count: 0 });

  const mint = React.useCallback((): string => {
    ids.current.count += 1;
    return `${ids.current.prefix}-${ids.current.count}`;
  }, []);

  const post = React.useCallback((type: MessageType, payload: object) => {
    vscode.postMessage({ type, source: SOURCE, payload, timestamp: Date.now() });
  }, [vscode]);

  // Keyed feedback, by card and by receipt (pure updates: memory/workshopMemoryKeyedState).
  const setCardBusy = React.useCallback((card: string, busy: boolean) => setBusyCards((current) => withWorkshopMemoryKey(current, card, busy)), []);
  const setCardError = React.useCallback((card: string, error: string | undefined) =>
    setCardErrors((current) => withWorkshopMemoryEntry(current, card, error || undefined)), []);

  const cardAction = React.useCallback((turnId: string, index: number, action: 'save' | 'dismiss' | 'reopen') => {
    const requestId = mint();
    const card = workshopMemoryCardKey(turnId, index);
    pending.current.set(requestId, { kind: 'card', card });
    setCardBusy(card, true);
    setCardError(card, undefined);
    post(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId, turnId, index, action });
  }, [mint, post, setCardBusy, setCardError]);

  const requestEstimate = React.useCallback((state: WorkshopMemorySheetState) => {
    window.clearTimeout(estimateTimer.current);
    estimateTimer.current = window.setTimeout(() => {
      const requestId = mint();
      estimateRequest.current = requestId;
      post(MessageType.WORKSHOP_MEMORY_ESTIMATE, {
        requestId,
        ...(state.memoryId ? { memoryId: state.memoryId } : {}),
        draft: state.draft
      });
    }, ESTIMATE_DELAY_MS);
  }, [mint, post]);

  const openSheet = React.useCallback((state: WorkshopMemorySheetState) => {
    if (sheetRef.current?.saving) {
      return;
    }
    sheetRequest.current = undefined;
    setSheet(state);
    if (!state.loading) {
      requestEstimate(state);
    }
  }, [requestEstimate, setSheet]);

  const editCard = React.useCallback((turn: WorkshopTurn, index: number) => {
    const proposal = workshopMemoryProposalAt(turn, index);
    // A stale edit offers no Edit: its result was anchored against text the note no longer holds (Slice 6c).
    if (!proposal || (proposal.proposes === 'edit' && proposal.stale)) {
      return;
    }
    const replaces = proposal.proposes === 'edit' ? proposal.target.replaces : proposal.supersedes;
    openSheet({
      mode: 'card',
      turnId: turn.id,
      proposalIndex: index,
      // An edit's sheet holds its result, and counts the pinned budget as an edit of its note.
      ...(proposal.proposes === 'edit' ? { memoryId: proposal.target.id } : {}),
      draft: workshopMemoryProposalDraft(proposal),
      replaces: (replaces ?? []).map((item) => ({ ...item })),
      loading: false,
      saving: false,
      sourceLabel: turn.personaLabel
    });
  }, [openSheet]);

  const saveTurn = React.useCallback((turn: WorkshopTurn) => {
    openSheet({
      mode: 'turn',
      turnId: turn.id,
      draft: { ...EMPTY_DRAFT, body: workshopMemoryNoteFromTurn(turn.content) },
      replaces: [],
      loading: false,
      saving: false,
      sourceLabel: turn.role === 'user' ? 'your message' : turn.personaLabel ?? turn.toolLabel
    });
  }, [openSheet]);

  const rememberRoomBookmark = React.useCallback((bookmark: WorkshopMemoryRoomBookmark) => {
    if (bookmark.turn) {
      saveTurn(bookmark.turn);
      return;
    }
    const { turnId, roomRevision, message } = bookmark;
    const sheetState = workshopMemoryRoomBookmarkSheet({ turnId, roomRevision, ...(message ? { message } : {}) });
    openSheet(sheetState);
    // Without the row's message, the host's turn preview fills the note.
    if (!message && sheetRef.current === sheetState) {
      const requestId = mint();
      previewRequest.current = requestId;
      post(MessageType.WORKSHOP_REQUEST_TURN_PREVIEW, { requestId, turnId, roomRevision });
    }
  }, [mint, openSheet, post, saveTurn]);

  const rememberSavedBookmark = React.useCallback((bookmark: WorkshopMemorySavedBookmark) =>
    openSheet(workshopMemorySavedBookmarkSheet(bookmark)), [openSheet]);

  const editMemory = React.useCallback((memoryId: string) => {
    const requestId = mint();
    editRequest.current = requestId;
    openSheet({ mode: 'memory', memoryId, draft: EMPTY_DRAFT, replaces: [], loading: true, saving: false });
    post(MessageType.WORKSHOP_MEMORY_REQUEST_EDIT, { requestId, memoryId });
  }, [mint, openSheet, post]);

  const newMemory = React.useCallback(() => {
    openSheet({ mode: 'new', draft: EMPTY_DRAFT, replaces: [], loading: false, saving: false });
  }, [openSheet]);

  const setReceiptBusy = React.useCallback((receipt: string, busy: boolean) =>
    setBusyReceipts((current) => withWorkshopMemoryKey(current, receipt, busy)), []);
  const setReceiptError = React.useCallback((receipt: string, error: WorkshopMemoryReceiptError | undefined) =>
    setReceiptErrors((current) => withWorkshopMemoryEntry(current, receipt, error)), []);

  const receiptAction = React.useCallback((memoryId: string, receipt: string, action: 'forget' | 'restore') => {
    const requestId = mint();
    pending.current.set(requestId, { kind: 'receipt', receipt, action, roomKey: roomKeyRef.current });
    setReceiptBusy(receipt, true);
    setReceiptError(receipt, undefined);
    post(MessageType.WORKSHOP_MEMORY_FORGET, { requestId, memoryId, action });
  }, [mint, post, setReceiptBusy, setReceiptError]);

  // A new room drops what the old one's receipts were waiting on or said:
  // its answers are ignored when they come, and nothing is shown for it.
  const clearReceiptsWhenRoomChanges = React.useCallback((next: string | undefined) => {
    if (roomKeyRef.current === next) {
      return;
    }
    roomKeyRef.current = next;
    for (const [requestId, owner] of pending.current) {
      if (owner.kind === 'receipt') {
        pending.current.delete(requestId);
      }
    }
    setBusyReceipts((current) => (current.size === 0 ? current : new Set()));
    setReceiptErrors((current) => (current.size === 0 ? current : new Map()));
  }, []);
  React.useEffect(() => {
    clearReceiptsWhenRoomChanges(roomKey);
  }, [clearReceiptsWhenRoomChanges, roomKey]);

  const updateDraft = React.useCallback((change: Partial<WorkshopMemoryDraft>) => {
    const current = sheetRef.current;
    if (!current || current.saving || current.loading) {
      return;
    }
    const next = { ...current, draft: { ...current.draft, ...change }, error: undefined };
    setSheet(next);
    requestEstimate(next);
  }, [requestEstimate, setSheet]);

  const dropReplaced = React.useCallback((memoryId: string) => {
    const current = sheetRef.current;
    if (!current || current.saving) {
      return;
    }
    const next = {
      ...current,
      draft: { ...current.draft, supersedes: current.draft.supersedes.filter((id) => id !== memoryId) },
      replaces: current.replaces.filter((item) => item.id !== memoryId)
    };
    setSheet(next);
    requestEstimate(next);
  }, [requestEstimate, setSheet]);

  const submitSheet = React.useCallback(() => {
    const current = sheetRef.current;
    if (!current || current.saving || current.loading) {
      return;
    }
    const requestId = mint();
    sheetRequest.current = requestId;
    const card = current.mode === 'card' && current.turnId !== undefined && current.proposalIndex !== undefined
      ? workshopMemoryCardKey(current.turnId, current.proposalIndex)
      : undefined;
    pending.current.set(requestId, { kind: 'sheet', ...(card ? { card } : {}) });
    if (card) {
      setCardBusy(card, true);
      setCardError(card, undefined);
    }
    const submission = workshopMemorySheetSubmission(current, requestId);
    post(submission.type, submission.payload);
    setSheet({ ...current, saving: true, error: undefined });
  }, [mint, post, setCardBusy, setCardError, setSheet]);

  const dismissSheet = React.useCallback(() => {
    window.clearTimeout(estimateTimer.current);
    sheetRequest.current = undefined;
    editRequest.current = undefined;
    previewRequest.current = undefined;
    estimateRequest.current = undefined;
    setSheet(null);
  }, [setSheet]);

  /** Close, Escape or the backdrop: not while a save is out, so its answer is never lost (PR #200 F-05). */
  const closeSheet = React.useCallback(() => {
    if (!sheetRef.current?.saving) {
      dismissSheet();
    }
  }, [dismissSheet]);

  React.useEffect(() => () => window.clearTimeout(estimateTimer.current), []);

  const handleWriteResult = React.useCallback((message: WorkshopMemoryWriteResultMessage) => {
    const { requestId, ok, error, budget } = message.payload;
    const owner = pending.current.get(requestId);
    if (!owner) {
      return;
    }
    pending.current.delete(requestId);
    if (owner.kind === 'card') {
      setCardBusy(owner.card, false);
      setCardError(owner.card, ok ? undefined : error);
      return;
    }
    if (owner.kind === 'receipt') {
      if (owner.roomKey !== roomKeyRef.current) {
        return;
      }
      setReceiptBusy(owner.receipt, false);
      setReceiptError(owner.receipt, ok ? undefined : { action: owner.action, error: error ?? 'That didn\'t go through. Try again.' });
      return;
    }
    if (owner.card) {
      setCardBusy(owner.card, false);
    }
    if (sheetRequest.current !== requestId) {
      if (owner.card) {
        setCardError(owner.card, ok ? undefined : error);
      }
      return;
    }
    sheetRequest.current = undefined;
    if (ok) {
      dismissSheet();
      return;
    }
    const current = sheetRef.current;
    if (current) {
      setSheet({ ...current, saving: false, error, ...(budget ? { estimate: budget } : {}) });
    }
  }, [dismissSheet, setCardBusy, setCardError, setReceiptBusy, setReceiptError, setSheet]);

  const handleEditData = React.useCallback((message: WorkshopMemoryEditDataMessage) => {
    const { requestId, draft, replaces, error } = message.payload;
    if (editRequest.current !== requestId) {
      return;
    }
    editRequest.current = undefined;
    const current = sheetRef.current;
    if (!current || current.mode !== 'memory') {
      return;
    }
    const next = draft
      ? { ...current, draft, replaces: replaces ?? [], loading: false }
      : { ...current, loading: false, error };
    setSheet(next);
    if (draft) {
      requestEstimate(next);
    }
  }, [requestEstimate, setSheet]);

  const handleTurnPreview = React.useCallback((message: WorkshopTurnPreviewMessage) => {
    const next = previewRequest.current === message.payload.requestId
      ? workshopMemorySheetWithPreview(sheetRef.current, message.payload)
      : undefined;
    if (!next) {
      return;
    }
    previewRequest.current = undefined;
    setSheet(next);
    if (message.payload.turn) {
      requestEstimate(next);
    }
  }, [requestEstimate, setSheet]);

  const handleEstimateResult = React.useCallback((message: WorkshopMemoryEstimateResultMessage) => {
    const { requestId, estimate } = message.payload;
    const current = sheetRef.current;
    if (estimateRequest.current !== requestId || !estimate || !current) {
      return;
    }
    setSheet({ ...current, estimate });
  }, [setSheet]);

  return {
    sheet,
    busyCards,
    cardErrors,
    busyReceipts,
    receiptErrors,
    saveCard: React.useCallback((turnId: string, index: number) => cardAction(turnId, index, 'save'), [cardAction]),
    dismissCard: React.useCallback((turnId: string, index: number) => cardAction(turnId, index, 'dismiss'), [cardAction]),
    reopenCard: React.useCallback((turnId: string, index: number) => cardAction(turnId, index, 'reopen'), [cardAction]),
    editCard,
    saveTurn,
    rememberRoomBookmark,
    rememberSavedBookmark,
    editMemory,
    newMemory,
    forget: React.useCallback((memoryId: string, receipt: string) => receiptAction(memoryId, receipt, 'forget'), [receiptAction]),
    restore: React.useCallback((memoryId: string, receipt: string) => receiptAction(memoryId, receipt, 'restore'), [receiptAction]),
    updateDraft,
    dropReplaced,
    submitSheet,
    closeSheet,
    handleWriteResult,
    handleEditData,
    handleEstimateResult,
    handleTurnPreview,
    persistedState: {}
  };
}
