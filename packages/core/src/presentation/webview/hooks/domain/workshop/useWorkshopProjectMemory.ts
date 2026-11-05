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
  type WorkshopTurn
} from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

/** What the sheet is for: a card's edit, a saved memory's edit, a bubble as source, or nothing. */
export type WorkshopMemorySheetMode = 'card' | 'memory' | 'turn' | 'new';

export interface WorkshopMemorySheetState {
  readonly mode: WorkshopMemorySheetMode;
  /** The card's or bubble's turn. */
  readonly turnId?: string;
  /** The saved memory being edited. */
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
}

export interface WorkshopProjectMemoryState {
  sheet: WorkshopMemorySheetState | null;
  /** Turns whose card action is waiting for the host. */
  busyTurnIds: ReadonlySet<string>;
  /** A card's refusal, by turn, until its next action. */
  cardErrors: ReadonlyMap<string, string>;
  /** The latest refusal from a receipt's Forget or Restore. */
  receiptError?: string;
}

export interface WorkshopProjectMemoryActions {
  saveCard: (turnId: string) => void;
  dismissCard: (turnId: string) => void;
  reopenCard: (turnId: string) => void;
  /** Edit… on a card: the sheet, filled from the proposal. */
  editCard: (turn: WorkshopTurn) => void;
  /** Save to memory… on an eligible bubble. */
  saveTurn: (turn: WorkshopTurn) => void;
  /** Edit on a receipt (and Slice 4b's manager). */
  editMemory: (memoryId: string) => void;
  /** New memory (Slice 4b's manager). */
  newMemory: () => void;
  forget: (memoryId: string) => void;
  restore: (memoryId: string) => void;
  updateDraft: (change: Partial<WorkshopMemoryDraft>) => void;
  /** "Don't replace" one memory. */
  dropReplaced: (memoryId: string) => void;
  submitSheet: () => void;
  closeSheet: () => void;
  handleWriteResult: (message: WorkshopMemoryWriteResultMessage) => void;
  handleEditData: (message: WorkshopMemoryEditDataMessage) => void;
  handleEstimateResult: (message: WorkshopMemoryEstimateResultMessage) => void;
}

export interface WorkshopProjectMemoryPersistence {
  // Memory files and the session own everything; nothing is kept in webview state.
}

export type UseWorkshopProjectMemoryReturn = WorkshopProjectMemoryState &
  WorkshopProjectMemoryActions & {
    persistedState: WorkshopProjectMemoryPersistence;
  };

type Pending =
  | { readonly kind: 'card'; readonly turnId: string }
  /** A sheet's save; a card's names its turn, which stays busy until answered (PR #200 F-05). */
  | { readonly kind: 'sheet'; readonly turnId?: string }
  | { readonly kind: 'receipt' };

const SOURCE = 'webview.workshop.memory';
const ESTIMATE_DELAY_MS = 250;
const EMPTY_DRAFT: WorkshopMemoryDraft = { title: '', kind: 'decision', summary: '', body: '', supersedes: [], pinned: false };

/** A bubble's text as a new memory's note: whole when it fits, else cut at the bound, for the writer to shape. */
export function workshopMemoryNoteFromTurn(content: string): string {
  const text = content.trim();
  const bound = PROMPT_BUDGETS.workshopProjectMemory.bodyCharacters;
  return text.length <= bound ? text : text.slice(0, bound).trimEnd();
}

export function useWorkshopProjectMemory(): UseWorkshopProjectMemoryReturn {
  const vscode = useVSCodeApi();
  const [sheet, setSheetState] = React.useState<WorkshopMemorySheetState | null>(null);
  // The sheet as last set, so actions read it without side effects in an updater.
  const sheetRef = React.useRef<WorkshopMemorySheetState | null>(null);
  const setSheet = React.useCallback((next: WorkshopMemorySheetState | null) => {
    sheetRef.current = next;
    setSheetState(next);
  }, []);
  const [busyTurnIds, setBusyTurnIds] = React.useState<ReadonlySet<string>>(new Set());
  const [cardErrors, setCardErrors] = React.useState<ReadonlyMap<string, string>>(new Map());
  const [receiptError, setReceiptError] = React.useState<string | undefined>(undefined);
  const pending = React.useRef(new Map<string, Pending>());
  const sheetRequest = React.useRef<string | undefined>(undefined);
  const editRequest = React.useRef<string | undefined>(undefined);
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

  const setTurnBusy = React.useCallback((turnId: string, busy: boolean) => {
    setBusyTurnIds((current) => {
      const next = new Set(current);
      if (busy) {
        next.add(turnId);
      } else {
        next.delete(turnId);
      }
      return next;
    });
  }, []);

  const setCardError = React.useCallback((turnId: string, error: string | undefined) => {
    setCardErrors((current) => {
      const next = new Map(current);
      if (error) {
        next.set(turnId, error);
      } else {
        next.delete(turnId);
      }
      return next;
    });
  }, []);

  const cardAction = React.useCallback((turnId: string, action: 'save' | 'dismiss' | 'reopen') => {
    const requestId = mint();
    pending.current.set(requestId, { kind: 'card', turnId });
    setTurnBusy(turnId, true);
    setCardError(turnId, undefined);
    post(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId, turnId, action });
  }, [mint, post, setCardError, setTurnBusy]);

  const requestEstimate = React.useCallback((state: WorkshopMemorySheetState) => {
    window.clearTimeout(estimateTimer.current);
    estimateTimer.current = window.setTimeout(() => {
      const requestId = mint();
      estimateRequest.current = requestId;
      post(MessageType.WORKSHOP_MEMORY_ESTIMATE, {
        requestId,
        ...(state.mode === 'memory' && state.memoryId ? { memoryId: state.memoryId } : {}),
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

  const editCard = React.useCallback((turn: WorkshopTurn) => {
    const proposal = turn.memoryProposal;
    if (!proposal) {
      return;
    }
    openSheet({
      mode: 'card',
      turnId: turn.id,
      draft: {
        title: proposal.title,
        kind: proposal.kind,
        summary: proposal.summary,
        body: proposal.body,
        supersedes: (proposal.supersedes ?? []).map((item) => item.id),
        pinned: false
      },
      replaces: (proposal.supersedes ?? []).map((item) => ({ ...item })),
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

  const editMemory = React.useCallback((memoryId: string) => {
    const requestId = mint();
    editRequest.current = requestId;
    openSheet({ mode: 'memory', memoryId, draft: EMPTY_DRAFT, replaces: [], loading: true, saving: false });
    post(MessageType.WORKSHOP_MEMORY_REQUEST_EDIT, { requestId, memoryId });
  }, [mint, openSheet, post]);

  const newMemory = React.useCallback(() => {
    openSheet({ mode: 'new', draft: EMPTY_DRAFT, replaces: [], loading: false, saving: false });
  }, [openSheet]);

  const receiptAction = React.useCallback((memoryId: string, action: 'forget' | 'restore') => {
    const requestId = mint();
    pending.current.set(requestId, { kind: 'receipt' });
    setReceiptError(undefined);
    post(MessageType.WORKSHOP_MEMORY_FORGET, { requestId, memoryId, action });
  }, [mint, post]);

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
    const cardTurnId = current.mode === 'card' ? current.turnId : undefined;
    pending.current.set(requestId, { kind: 'sheet', ...(cardTurnId ? { turnId: cardTurnId } : {}) });
    if (cardTurnId) {
      setTurnBusy(cardTurnId, true);
      setCardError(cardTurnId, undefined);
    }
    switch (current.mode) {
      case 'card':
        post(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId, turnId: current.turnId, action: 'save', edited: current.draft });
        break;
      case 'turn':
        post(MessageType.WORKSHOP_SAVE_TURN_TO_MEMORY, { requestId, turnId: current.turnId, draft: current.draft });
        break;
      case 'memory':
        post(MessageType.WORKSHOP_MEMORY_UPDATE, { requestId, memoryId: current.memoryId, patch: current.draft });
        break;
      case 'new':
        post(MessageType.WORKSHOP_MEMORY_CREATE, { requestId, draft: current.draft });
        break;
    }
    setSheet({ ...current, saving: true, error: undefined });
  }, [mint, post, setCardError, setSheet, setTurnBusy]);

  const dismissSheet = React.useCallback(() => {
    window.clearTimeout(estimateTimer.current);
    sheetRequest.current = undefined;
    editRequest.current = undefined;
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
      setTurnBusy(owner.turnId, false);
      setCardError(owner.turnId, ok ? undefined : error);
      return;
    }
    if (owner.kind === 'receipt') {
      setReceiptError(ok ? undefined : error);
      return;
    }
    if (owner.turnId) {
      setTurnBusy(owner.turnId, false);
    }
    if (sheetRequest.current !== requestId) {
      if (owner.turnId) {
        setCardError(owner.turnId, ok ? undefined : error);
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
  }, [dismissSheet, setCardError, setSheet, setTurnBusy]);

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
    busyTurnIds,
    cardErrors,
    receiptError,
    saveCard: React.useCallback((turnId: string) => cardAction(turnId, 'save'), [cardAction]),
    dismissCard: React.useCallback((turnId: string) => cardAction(turnId, 'dismiss'), [cardAction]),
    reopenCard: React.useCallback((turnId: string) => cardAction(turnId, 'reopen'), [cardAction]),
    editCard,
    saveTurn,
    editMemory,
    newMemory,
    forget: React.useCallback((memoryId: string) => receiptAction(memoryId, 'forget'), [receiptAction]),
    restore: React.useCallback((memoryId: string) => receiptAction(memoryId, 'restore'), [receiptAction]),
    updateDraft,
    dropReplaced,
    submitSheet,
    closeSheet,
    handleWriteResult,
    handleEditData,
    handleEstimateResult,
    persistedState: {}
  };
}
