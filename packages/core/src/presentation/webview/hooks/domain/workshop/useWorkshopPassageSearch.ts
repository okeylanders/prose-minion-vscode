/**
 * A persona's passage-search card, as the webview asks for it (ADR
 * 2026-11-20 D19–D21): its price, Run, Stop, Cancel, Send, Discard and
 * Open report.
 *
 * - **Host-owned truth.** The card and its state arrive on the snapshot's
 *   turns (`passageSearchRequest.view`); nothing about a search's state is
 *   worked out here. Every action posts ids only: a webview-minted
 *   `requestId`, the room revision and the card's turn id. A Run adds the
 *   `planKey` of the estimate on screen, so the host can refuse a price
 *   the writer did not see.
 * - **The price is asked once per card in each room generation,** when it
 *   is first drawn pending. A Run the host answers `price-changed` shows the
 *   new price and waits for another press.
 * - **Bound to the room the render drew** (PR #296 F1). A card asks its
 *   price in its own effect, and a child's effects run before its parent's,
 *   so nothing here waits for an effect to learn the room: every action is
 *   posted under the generation of the render it came from, and a new room
 *   empties every map during that render, before anything under it draws or
 *   asks. The actions are new callbacks in each generation, so a card drawn
 *   pending asks again there, once.
 * - **Correlated.** Only an answer still waited for, for the room on
 *   screen, is taken: a late, duplicate or other room's answer changes
 *   nothing. A Run stays waited for until the search it began has ended.
 * - **One line per outcome** (`feedback`), which the card announces once.
 * - **It listens for its own answers** (`useMessageRouter`), so the app's
 *   router gains no route.
 * - **Nothing persisted.** The session owns the card; the window owns a
 *   running search and its result.
 */

import * as React from 'react';
import {
  MessageType,
  type WorkshopPassageSearchAction,
  type WorkshopPassageSearchEstimateView,
  type WorkshopPassageSearchProgress,
  type WorkshopPassageSearchProgressMessage,
  type WorkshopPassageSearchResultMessage
} from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { useMessageRouter } from '@hooks/useMessageRouter';

/** A card's price: asked for, shown, or refused in the host's words. */
export interface WorkshopPassageSearchEstimateState {
  loading: boolean;
  estimate?: WorkshopPassageSearchEstimateView;
  /** Why the search can't be priced, in the host's words. */
  refusal?: string;
}

export interface WorkshopPassageSearchState {
  estimates: ReadonlyMap<string, WorkshopPassageSearchEstimateState>;
  /** The action a card waits on, by turn id. */
  busy: ReadonlyMap<string, WorkshopPassageSearchAction>;
  /** A running search's progress, by turn id. */
  progress: ReadonlyMap<string, WorkshopPassageSearchProgress>;
  /** The host's words for a card's last outcome, by turn id. */
  feedback: ReadonlyMap<string, string>;
}

export interface WorkshopPassageSearchActions {
  /** Ask the card's price, once: a card already asked for is left alone unless `again` asks afresh. */
  requestEstimate: (turnId: string, again?: boolean) => void;
  run: (turnId: string) => void;
  stop: (turnId: string) => void;
  cancel: (turnId: string) => void;
  send: (turnId: string) => void;
  discard: (turnId: string) => void;
  openReport: (turnId: string) => void;
  handleResult: (message: WorkshopPassageSearchResultMessage) => void;
  handleProgress: (message: WorkshopPassageSearchProgressMessage) => void;
}

export interface WorkshopPassageSearchPersistence {
  // The session owns every card; nothing is kept in webview state.
}

export type UseWorkshopPassageSearchReturn = WorkshopPassageSearchState &
  WorkshopPassageSearchActions & {
    persistedState: WorkshopPassageSearchPersistence;
  };

export interface UseWorkshopPassageSearchOptions {
  /** The room's identity (`room:<revision>`, or `pending` before the first snapshot). */
  roomKey: string;
  /** The room generation cards are shown in; absent before the first snapshot, when nothing posts. */
  roomRevision?: number;
}

const SOURCE = 'webview.workshop.passageSearch';
const NO_PERSISTENCE: WorkshopPassageSearchPersistence = {};
export const WORKSHOP_PASSAGE_SEARCH_PRICE_CHANGED = 'The price changed since it was shown. Check it, then press Run again.';

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the actions' kebab-case words. */
const ROUTES: Readonly<Record<WorkshopPassageSearchAction, MessageType>> = {
  estimate: MessageType.WORKSHOP_PASSAGE_SEARCH_ESTIMATE,
  run: MessageType.WORKSHOP_PASSAGE_SEARCH_RUN,
  stop: MessageType.WORKSHOP_PASSAGE_SEARCH_STOP,
  cancel: MessageType.WORKSHOP_PASSAGE_SEARCH_CANCEL,
  send: MessageType.WORKSHOP_PASSAGE_SEARCH_SEND,
  discard: MessageType.WORKSHOP_PASSAGE_SEARCH_DISCARD,
  'open-report': MessageType.WORKSHOP_PASSAGE_SEARCH_OPEN_REPORT
};
/* eslint-enable @typescript-eslint/naming-convention */

function withEntry<V>(map: ReadonlyMap<string, V>, key: string, value: V | undefined): ReadonlyMap<string, V> {
  if (value === undefined && !map.has(key)) {
    return map;
  }
  const next = new Map(map);
  if (value === undefined) {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  return next;
}

export function useWorkshopPassageSearch({ roomKey, roomRevision }: UseWorkshopPassageSearchOptions): UseWorkshopPassageSearchReturn {
  const vscode = useVSCodeApi();
  const [estimates, setEstimates] = React.useState<ReadonlyMap<string, WorkshopPassageSearchEstimateState>>(new Map());
  const [busy, setBusy] = React.useState<ReadonlyMap<string, WorkshopPassageSearchAction>>(new Map());
  const [progress, setProgress] = React.useState<ReadonlyMap<string, WorkshopPassageSearchProgress>>(new Map());
  const [feedback, setFeedback] = React.useState<ReadonlyMap<string, string>>(new Map());
  // The room these maps describe. A new one empties them in this render, so nothing under it draws or asks from the last room's.
  const [mapsRoom, setMapsRoom] = React.useState(roomKey);
  if (mapsRoom !== roomKey) {
    setMapsRoom(roomKey);
    setEstimates(new Map());
    setBusy(new Map());
    setProgress(new Map());
    setFeedback(new Map());
  }
  /** The room on screen, for answers that arrive later; set before any effect below can post. */
  const room = React.useRef({ key: roomKey, revision: roomRevision });
  const pending = React.useRef(new Map<string, { turnId: string; action: WorkshopPassageSearchAction; roomKey: string }>());
  const estimatesRef = React.useRef(estimates);
  estimatesRef.current = estimates;
  const busyRef = React.useRef(new Map<string, WorkshopPassageSearchAction>());
  const ids = React.useRef({ prefix: `ws-passage-search-${Math.random().toString(36).slice(2, 10)}`, count: 0 });

  const setCardBusy = React.useCallback((turnId: string, action: WorkshopPassageSearchAction | undefined) => {
    if (action) {
      busyRef.current.set(turnId, action);
    } else {
      busyRef.current.delete(turnId);
    }
    setBusy(new Map(busyRef.current));
  }, []);

  /**
   * Post one action by ids, under the room this render drew. An estimate and a Stop ride beside whatever the card
   * waits on; any other is one at a time.
   */
  const post = React.useCallback((action: WorkshopPassageSearchAction, turnId: string, planKey?: string): boolean => {
    const beside = action === 'estimate' || action === 'stop';
    if (roomRevision === undefined || (!beside && busyRef.current.has(turnId))) {
      return false;
    }
    ids.current.count += 1;
    const requestId = `${ids.current.prefix}-${ids.current.count}`;
    pending.current.set(requestId, { turnId, action, roomKey });
    if (!beside) {
      setCardBusy(turnId, action);
      setFeedback((current) => withEntry(current, turnId, undefined));
    }
    vscode.postMessage({
      type: ROUTES[action],
      source: SOURCE,
      payload: { requestId, roomRevision, turnId, ...(planKey !== undefined ? { planKey } : {}) },
      timestamp: Date.now()
    });
    return true;
  }, [roomKey, roomRevision, setCardBusy, vscode]);

  const requestEstimate = React.useCallback((turnId: string, again = false) => {
    const held = estimatesRef.current.get(turnId);
    if (held && (!again || held.loading)) {
      return;
    }
    if (post('estimate', turnId)) {
      const next = withEntry(estimatesRef.current, turnId, { loading: true });
      estimatesRef.current = next;
      setEstimates(next);
    }
  }, [post]);

  const run = React.useCallback((turnId: string) => {
    const planKey = estimatesRef.current.get(turnId)?.estimate?.planKey;
    if (planKey !== undefined) {
      post('run', turnId, planKey);
    }
  }, [post]);
  const stop = React.useCallback((turnId: string) => void post('stop', turnId), [post]);
  const cancel = React.useCallback((turnId: string) => void post('cancel', turnId), [post]);
  const send = React.useCallback((turnId: string) => void post('send', turnId), [post]);
  const discard = React.useCallback((turnId: string) => void post('discard', turnId), [post]);
  const openReport = React.useCallback((turnId: string) => void post('open-report', turnId), [post]);

  /** A new room drops every request still waited for; the maps were emptied in the render that drew it. */
  const clearPendingWhenRoomChanges = React.useCallback((key: string, revision: number | undefined) => {
    const changed = room.current.key !== key;
    room.current = { key, revision };
    if (changed) {
      pending.current.clear();
      busyRef.current.clear();
    }
  }, []);
  // A layout effect: it runs in the commit, before any passive effect, so a card's first ask in the new room is never dropped.
  React.useLayoutEffect(() => {
    clearPendingWhenRoomChanges(roomKey, roomRevision);
  }, [clearPendingWhenRoomChanges, roomKey, roomRevision]);

  const handleResult = React.useCallback((message: WorkshopPassageSearchResultMessage) => {
    const { requestId, outcome, estimate, message: words } = message.payload;
    const owner = pending.current.get(requestId);
    if (!owner) {
      return;
    }
    // A Run is waited for until its search ends: `started` only says it began.
    if (!(owner.action === 'run' && outcome === 'started')) {
      pending.current.delete(requestId);
    }
    if (owner.roomKey !== room.current.key) {
      return;
    }
    const { turnId, action } = owner;
    if (action === 'estimate') {
      const next = withEntry(estimatesRef.current, turnId, outcome === 'done' && estimate ? { loading: false, estimate } : { loading: false, refusal: words ?? '' });
      estimatesRef.current = next;
      setEstimates(next);
      return;
    }
    if (action === 'stop') {
      if (outcome === 'refused' && words) {
        setFeedback((current) => withEntry(current, turnId, words));
      }
      return;
    }
    if (outcome === 'started') {
      return;
    }
    setCardBusy(turnId, undefined);
    if (action === 'run') {
      setProgress((current) => withEntry(current, turnId, undefined));
    }
    if (outcome === 'price-changed' && estimate) {
      const next = withEntry(estimatesRef.current, turnId, { loading: false, estimate });
      estimatesRef.current = next;
      setEstimates(next);
      setFeedback((current) => withEntry(current, turnId, WORKSHOP_PASSAGE_SEARCH_PRICE_CHANGED));
      return;
    }
    if (words) {
      setFeedback((current) => withEntry(current, turnId, words));
    }
  }, [setCardBusy]);

  const handleProgress = React.useCallback((message: WorkshopPassageSearchProgressMessage) => {
    const { requestId, done, planned, found } = message.payload;
    const owner = pending.current.get(requestId);
    if (!owner || owner.action !== 'run' || owner.roomKey !== room.current.key) {
      return;
    }
    setProgress((current) => withEntry(current, owner.turnId, { done, planned, found }));
  }, []);

  const routes = React.useMemo(() => ({
    [MessageType.WORKSHOP_PASSAGE_SEARCH_RESULT]: handleResult,
    [MessageType.WORKSHOP_PASSAGE_SEARCH_PROGRESS]: handleProgress
  }), [handleResult, handleProgress]);
  useMessageRouter(routes as Parameters<typeof useMessageRouter>[0]);

  return {
    estimates, busy, progress, feedback,
    requestEstimate, run, stop, cancel, send, discard, openReport, handleResult, handleProgress,
    persistedState: NO_PERSISTENCE
  };
}
