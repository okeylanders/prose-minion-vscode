/**
 * A persona's suggested file edits, as the webview asks for them (ADR
 * 2026-11-05 D8, D9; epic Slice 4b): a card's Apply, Review in editor… and
 * Decline, and a rewrite card's before and after.
 *
 * - **Host-owned truth.** A card's state arrives on the snapshot's turns
 *   (`applying`, then the outcome); nothing is applied optimistically. An
 *   action posts and waits for its answer (`WORKSHOP_FILE_EDIT_RESULT`),
 *   which the host sends after the snapshot that carries the card's state.
 * - **Correlated** (the #221 pattern). Each request carries an id this hook
 *   mints (with a per-webview prefix) and the room it was shown in. Only an
 *   answer still waited for, for the room on screen, is taken: a late,
 *   duplicate or other room's answer changes nothing. This correlates
 *   answers only; the host's claim is what serializes writes.
 * - **Per card** (`turnId#index`): busy while its request is out, and the
 *   answer's words beside it when the card is still `pending` (a refusal, a
 *   discarded review). One request per card at a time: a second press while
 *   busy posts nothing.
 * - **A new room** (New, Open, Rewind, Branch, reload) drops everything the
 *   old one waited on or said.
 * - **Nothing persisted.** The session owns the cards.
 */

import * as React from 'react';
import {
  MessageType,
  type WorkshopFileEditAction,
  type WorkshopFileEditAnswer,
  type WorkshopFileEditPreviewResultMessage,
  type WorkshopFileEditResultMessage
} from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { workshopFileEditCardKey } from '@hooks/domain/workshop/fileEdits/workshopFileEditCardView';

/** What an answer left to say beside a card that is still `pending`. */
export interface WorkshopFileEditCardFeedback {
  readonly answer: WorkshopFileEditAnswer;
  /** The host's words. */
  readonly message: string;
}

/** A rewrite card's before and after, as the host answered it. */
export type WorkshopFileEditPreviewView =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly before: string; readonly after: string }
  | { readonly status: 'stale' | 'refused'; readonly message: string };

export interface WorkshopFileEditsState {
  /** Cards whose action waits for the host, by `workshopFileEditCardKey`. */
  busyCards: ReadonlySet<string>;
  /** An answer's words, by card, until its next action or a new room. */
  cardFeedback: ReadonlyMap<string, WorkshopFileEditCardFeedback>;
  /** Rewrite previews asked for in this room, by card. */
  previews: ReadonlyMap<string, WorkshopFileEditPreviewView>;
}

export interface WorkshopFileEditsActions {
  apply: (turnId: string, index: number) => void;
  review: (turnId: string, index: number) => void;
  decline: (turnId: string, index: number) => void;
  /** A rewrite card's before and after; asked once per card and room. */
  requestPreview: (turnId: string, index: number) => void;
  handleResult: (message: WorkshopFileEditResultMessage) => void;
  handlePreviewResult: (message: WorkshopFileEditPreviewResultMessage) => void;
}

export interface WorkshopFileEditsPersistence {
  // The session owns every card; nothing is kept in webview state.
}

export type UseWorkshopFileEditsReturn = WorkshopFileEditsState &
  WorkshopFileEditsActions & {
    persistedState: WorkshopFileEditsPersistence;
  };

export interface UseWorkshopFileEditsOptions {
  /** The room's identity (`room:<revision>`, or `pending` before the first snapshot). */
  roomKey: string;
  /** The room generation requests are shown in; absent before the first snapshot, when nothing posts. */
  roomRevision?: number;
}

interface Pending {
  readonly kind: 'action' | 'preview';
  readonly card: string;
  readonly roomKey: string;
  readonly roomRevision: number;
}

/** Answers whose words stay beside a card the host left `pending`. */
const FEEDBACK_ANSWERS: ReadonlySet<WorkshopFileEditAnswer> = new Set(['settled', 'joined', 'refused', 'held', 'no-card']);

const SOURCE = 'webview.workshop.fileEdits';

export function useWorkshopFileEdits({ roomKey, roomRevision }: UseWorkshopFileEditsOptions): UseWorkshopFileEditsReturn {
  const vscode = useVSCodeApi();
  const [busyCards, setBusyCards] = React.useState<ReadonlySet<string>>(new Set());
  const [cardFeedback, setCardFeedback] = React.useState<ReadonlyMap<string, WorkshopFileEditCardFeedback>>(new Map());
  const [previews, setPreviews] = React.useState<ReadonlyMap<string, WorkshopFileEditPreviewView>>(new Map());
  const room = React.useRef({ key: roomKey, revision: roomRevision });
  const pending = React.useRef(new Map<string, Pending>());
  // Mirrors of state the actions read synchronously, so a double press in one tick posts once.
  const busyRef = React.useRef(new Set<string>());
  const askedPreviews = React.useRef(new Set<string>());
  const ids = React.useRef({ prefix: `ws-file-edit-${Math.random().toString(36).slice(2, 10)}`, count: 0 });

  const mint = React.useCallback((): string => {
    ids.current.count += 1;
    return `${ids.current.prefix}-${ids.current.count}`;
  }, []);

  const post = React.useCallback((type: MessageType, payload: object) => {
    vscode.postMessage({ type, source: SOURCE, payload, timestamp: Date.now() });
  }, [vscode]);

  const setBusy = React.useCallback((card: string, busy: boolean) => {
    if (busy) {
      busyRef.current.add(card);
    } else {
      busyRef.current.delete(card);
    }
    setBusyCards(new Set(busyRef.current));
  }, []);

  const setFeedback = React.useCallback((card: string, feedback: WorkshopFileEditCardFeedback | undefined) =>
    setCardFeedback((current) => {
      if (!feedback && !current.has(card)) {
        return current;
      }
      const next = new Map(current);
      if (feedback) {
        next.set(card, feedback);
      } else {
        next.delete(card);
      }
      return next;
    }), []);

  const act = React.useCallback((turnId: string, index: number, action: WorkshopFileEditAction) => {
    const { key, revision } = room.current;
    const card = workshopFileEditCardKey(turnId, index);
    if (revision === undefined || busyRef.current.has(card)) {
      return;
    }
    const requestId = mint();
    pending.current.set(requestId, { kind: 'action', card, roomKey: key, roomRevision: revision });
    setBusy(card, true);
    setFeedback(card, undefined);
    post(MessageType.WORKSHOP_FILE_EDIT_ACTION, { requestId, roomRevision: revision, turnId, index, action });
  }, [mint, post, setBusy, setFeedback]);

  const requestPreview = React.useCallback((turnId: string, index: number) => {
    const { key, revision } = room.current;
    const card = workshopFileEditCardKey(turnId, index);
    if (revision === undefined || askedPreviews.current.has(card)) {
      return;
    }
    askedPreviews.current.add(card);
    const requestId = mint();
    pending.current.set(requestId, { kind: 'preview', card, roomKey: key, roomRevision: revision });
    setPreviews((current) => new Map(current).set(card, { status: 'loading' }));
    post(MessageType.WORKSHOP_FILE_EDIT_PREVIEW, { requestId, roomRevision: revision, turnId, index });
  }, [mint, post]);

  // A new room drops what the old one's cards were waiting on or said: its
  // answers are ignored when they come, and nothing is shown for it.
  const clearCardsWhenRoomChanges = React.useCallback((key: string, revision: number | undefined) => {
    const changed = room.current.key !== key;
    room.current = { key, revision };
    if (!changed) {
      return;
    }
    pending.current.clear();
    busyRef.current.clear();
    askedPreviews.current.clear();
    setBusyCards((current) => (current.size === 0 ? current : new Set()));
    setCardFeedback((current) => (current.size === 0 ? current : new Map()));
    setPreviews((current) => (current.size === 0 ? current : new Map()));
  }, []);
  React.useEffect(() => {
    clearCardsWhenRoomChanges(roomKey, roomRevision);
  }, [clearCardsWhenRoomChanges, roomKey, roomRevision]);

  /** The request an answer belongs to, taken once; undefined for anything not waited for here and now. */
  const takeOwner = React.useCallback((kind: Pending['kind'], payload: { requestId: string; roomRevision: number; turnId: string; index: number }) => {
    const owner = pending.current.get(payload.requestId);
    if (!owner || owner.kind !== kind) {
      return undefined;
    }
    pending.current.delete(payload.requestId);
    const sameRoom = owner.roomKey === room.current.key && owner.roomRevision === payload.roomRevision
      && payload.roomRevision === room.current.revision;
    const sameCard = owner.card === workshopFileEditCardKey(payload.turnId, payload.index);
    return sameRoom && sameCard ? owner : undefined;
  }, []);

  const handleResult = React.useCallback((message: WorkshopFileEditResultMessage) => {
    const owner = takeOwner('action', message.payload);
    if (!owner) {
      return;
    }
    const { answer, state, message: words } = message.payload;
    setBusy(owner.card, false);
    // A settled card speaks through its state; an answer that left it pending says why.
    const leftPending = state === undefined || state === 'pending';
    setFeedback(owner.card, FEEDBACK_ANSWERS.has(answer) && leftPending && words ? { answer, message: words } : undefined);
  }, [setBusy, setFeedback, takeOwner]);

  const handlePreviewResult = React.useCallback((message: WorkshopFileEditPreviewResultMessage) => {
    const owner = takeOwner('preview', message.payload);
    if (!owner) {
      return;
    }
    const { preview } = message.payload;
    const view: WorkshopFileEditPreviewView = preview.kind === 'rewrite'
      ? { status: 'ready', before: preview.before, after: preview.after }
      : { status: preview.kind, message: preview.message };
    // A refused read may be asked again when the card is next opened; a stale one says so for good.
    if (preview.kind === 'refused') {
      askedPreviews.current.delete(owner.card);
    }
    setPreviews((current) => new Map(current).set(owner.card, view));
  }, [takeOwner]);

  return {
    busyCards,
    cardFeedback,
    previews,
    apply: React.useCallback((turnId: string, index: number) => act(turnId, index, 'apply'), [act]),
    review: React.useCallback((turnId: string, index: number) => act(turnId, index, 'review'), [act]),
    decline: React.useCallback((turnId: string, index: number) => act(turnId, index, 'decline'), [act]),
    requestPreview,
    handleResult,
    handlePreviewResult,
    persistedState: {}
  };
}
