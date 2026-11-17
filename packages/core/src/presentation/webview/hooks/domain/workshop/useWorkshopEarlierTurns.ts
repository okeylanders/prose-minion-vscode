/**
 * A long room's earlier turns, as the webview asks for them (ADR 2026-11-17
 * D4, D5, D7): the turns outside the snapshot window, a page at a time.
 *
 * - **Host-owned truth.** A page carries its turns with the host's verdicts
 *   and summaries, built by the function the snapshot window uses. Nothing
 *   is worked out here: the run's parts are copied, never derived.
 * - **Correlated** (the turn preview's pattern). A request names a minted
 *   `requestId`, the room revision and the turn to read before. Only the
 *   answer to the one request still waited for is taken; one request is in
 *   flight at a time.
 * - **One contiguous run** that ends directly before the window's first
 *   turn. "Show earlier turns" reads the page before the oldest turn held.
 * - **Re-read, not trusted.** A session state for the same room re-reads the
 *   run, page by page, from the window's first turn back to the oldest turn
 *   held. The run stays on screen meanwhile; turns that slid out of the
 *   window join it at once, as the earlier snapshot showed them. A newer
 *   session state restarts the walk, and the earlier walk's answer is
 *   dropped. A held turn the answers covering its place did not return is
 *   removed.
 * - **A new room** (New, Open, Rewind, Branch, restore) drops every held
 *   turn and the pending request.
 * - **Announced once** per page shown, by the polite live region the thread
 *   draws for this hook.
 * - **Nothing persisted.** A reload shows the window again.
 */

import * as React from 'react';
import {
  MessageType,
  type WorkshopEarlierTurnsMessage,
  type WorkshopRequestEarlierTurnsPayload,
  type WorkshopSessionSnapshot,
  type WorkshopSessionStateMessage,
  type WorkshopTurn
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopModelsBeforeWindow } from '@shared/workshop/workshopModelSlices';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import {
  WORKSHOP_NO_EARLIER_TURNS,
  workshopEarlierRereadStep,
  workshopEarlierRunCarrying,
  workshopEarlierRunRereadSoFar,
  workshopEarlierRunWithOlderPage,
  workshopEarlierTurnsShownAnnouncement,
  workshopEarlierTurnsThreadParts,
  type WorkshopEarlierTurnEntry,
  type WorkshopEarlierTurnsRun,
  type WorkshopEarlierTurnsThreadParts
} from '@hooks/domain/workshop/earlierTurns/workshopEarlierTurnsRun';

/** What the thread draws of the earlier turns: their parts, and the control. */
export interface WorkshopEarlierTurnsThreadView extends WorkshopEarlierTurnsThreadParts {
  /** The model-slice seed for the first earlier turn drawn. */
  readonly modelsBefore?: WorkshopModelsBeforeWindow;
  /** Turns older than the oldest drawn; the control shows while above zero. */
  readonly remaining: number;
  /** "Show earlier turns" was pressed and its page has not landed. */
  readonly pending: boolean;
  /** The host's words for a refused request, until the next press. */
  readonly error?: string;
  /** Moves each time an older page lands, so the thread holds the writer's place across it. */
  readonly landSerial: number;
  /** The polite live region's text: the latest page shown, or a refusal. */
  readonly announcement: string;
  /** Moves with every announcement, so the same words said twice are read twice (a keyed node). */
  readonly announcementSerial: number;
  readonly onShowEarlier: () => void;
}

export interface WorkshopEarlierTurnsState {
  /** The earlier turns drawn, then the window: what the thread shows. */
  threadTurns: readonly WorkshopTurn[];
  thread: WorkshopEarlierTurnsThreadView;
}

export interface WorkshopEarlierTurnsActions {
  /** Ask for the page before the oldest turn held. */
  showEarlier: () => void;
  handleEarlierTurns: (message: WorkshopEarlierTurnsMessage) => void;
  /** A snapshot arrived: another room drops the run; the same room re-reads it. */
  handleSessionState: (message: WorkshopSessionStateMessage) => void;
}

export interface WorkshopEarlierTurnsPersistence {
  // Nothing loaded is kept: a reload shows the snapshot window again.
}

export type UseWorkshopEarlierTurnsReturn = WorkshopEarlierTurnsState &
  WorkshopEarlierTurnsActions & {
    persistedState: WorkshopEarlierTurnsPersistence;
  };

export interface UseWorkshopEarlierTurnsOptions {
  /** The snapshot window's turns, as the room hook holds them. */
  windowTurns: readonly WorkshopTurn[];
  /** Turns older than the window (the snapshot's `truncatedTurns`). */
  hiddenTurns: number;
}

type Walk =
  | { readonly kind: 'more'; readonly requestId: string }
  | {
      readonly kind: 'reread';
      readonly requestId: string;
      readonly oldestHeldTurnId: string;
      readonly limit: number;
      readonly fresh: readonly WorkshopEarlierTurnEntry[];
      /** "Show earlier turns" was pressed, or was waiting, when this walk began: ask once it ends. */
      readonly moreAfter: boolean;
    };

const SOURCE = 'webview.workshop.earlierTurns';
const NO_PERSISTENCE: WorkshopEarlierTurnsPersistence = {};

export function useWorkshopEarlierTurns({
  windowTurns,
  hiddenTurns
}: UseWorkshopEarlierTurnsOptions): UseWorkshopEarlierTurnsReturn {
  const vscode = useVSCodeApi();
  const [run, setRunState] = React.useState<WorkshopEarlierTurnsRun>(WORKSHOP_NO_EARLIER_TURNS);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [landSerial, setLandSerial] = React.useState(0);
  const [announced, setAnnounced] = React.useState({ text: '', serial: 0 });
  // The handlers read these synchronously; state alone would lag a message behind.
  const runRef = React.useRef(run);
  const walkRef = React.useRef<Walk | undefined>(undefined);
  const windowRef = React.useRef<WorkshopSessionSnapshot | undefined>(undefined);
  const ids = React.useRef({ prefix: `ws-earlier-${Math.random().toString(36).slice(2, 10)}`, count: 0 });

  const setRun = React.useCallback((next: WorkshopEarlierTurnsRun) => {
    runRef.current = next;
    setRunState(next);
  }, []);

  const announce = React.useCallback((text: string) => {
    setAnnounced((current) => ({ text, serial: current.serial + 1 }));
  }, []);

  /** Post one request and return its id; the caller records the walk it belongs to. */
  const request = React.useCallback((roomRevision: number, beforeTurnId: string): string => {
    ids.current.count += 1;
    const requestId = `${ids.current.prefix}-${ids.current.count}`;
    const payload: WorkshopRequestEarlierTurnsPayload = { requestId, roomRevision, beforeTurnId };
    vscode.postMessage({ type: MessageType.WORKSHOP_REQUEST_EARLIER_TURNS, source: SOURCE, payload, timestamp: Date.now() });
    return requestId;
  }, [vscode]);

  /** The page before the oldest turn held, or before the window when nothing is held. */
  const requestOlderPage = React.useCallback((): boolean => {
    const room = windowRef.current;
    const beforeTurnId = runRef.current.entries[0]?.turn.id ?? room?.turns[0]?.id;
    if (!room || beforeTurnId === undefined) {
      return false;
    }
    walkRef.current = { kind: 'more', requestId: request(room.roomRevision, beforeTurnId) };
    return true;
  }, [request]);

  const showEarlier = React.useCallback(() => {
    const walk = walkRef.current;
    if (walk?.kind === 'more') {
      return;
    }
    setError(undefined);
    if (walk?.kind === 'reread') {
      // One request in flight at a time: the page is asked for once the re-read ends.
      walkRef.current = { ...walk, moreAfter: true };
      setPending(true);
      return;
    }
    setPending(requestOlderPage());
  }, [requestOlderPage]);

  const clearEarlierTurns = React.useCallback(() => {
    walkRef.current = undefined;
    setRun(WORKSHOP_NO_EARLIER_TURNS);
    setPending(false);
    setError(undefined);
  }, [setRun]);

  const handleSessionState = React.useCallback((message: WorkshopSessionStateMessage) => {
    const session = message.payload.session;
    const earlier = windowRef.current;
    windowRef.current = session;
    // Another room, or a window that now reaches the room's first turn: nothing earlier is held or waited for.
    if (!earlier || earlier.roomRevision !== session.roomRevision || session.truncatedTurns <= 0) {
      if (walkRef.current || runRef.current.entries.length > 0) {
        clearEarlierTurns();
      }
      return;
    }
    const walk = walkRef.current;
    const windowFirstTurnId = session.turns[0]?.id;
    if (windowFirstTurnId === undefined) {
      return;
    }
    if (runRef.current.entries.length === 0) {
      // Nothing held to re-read. A first page still waited for is asked again from where the window now starts.
      if (walk?.kind === 'more' && earlier.turns[0]?.id !== windowFirstTurnId) {
        walkRef.current = { kind: 'more', requestId: request(session.roomRevision, windowFirstTurnId) };
      }
      return;
    }
    const carried = workshopEarlierRunCarrying(runRef.current, earlier, windowFirstTurnId);
    if (carried !== runRef.current) {
      setRun(carried);
    }
    // A newer session state restarts the walk: the earlier walk's request is no longer the pending one.
    walkRef.current = {
      kind: 'reread',
      requestId: request(session.roomRevision, windowFirstTurnId),
      oldestHeldTurnId: carried.entries[0].turn.id,
      limit: carried.entries.length + PROMPT_BUDGETS.workshopThread.pageTurns,
      fresh: [],
      moreAfter: walk?.kind === 'more' || (walk?.kind === 'reread' && walk.moreAfter)
    };
  }, [clearEarlierTurns, request, setRun]);

  const handleEarlierTurns = React.useCallback((message: WorkshopEarlierTurnsMessage) => {
    const { payload } = message;
    const walk = walkRef.current;
    const room = windowRef.current;
    // Only the answer still waited for, for the room on screen, is taken.
    if (!walk || !room || walk.requestId !== payload.requestId || payload.roomRevision !== room.roomRevision) {
      return;
    }
    const wantedMore = walk.kind === 'more' || walk.moreAfter;
    if (!payload.page) {
      // A refusal keeps what was held.
      walkRef.current = undefined;
      setPending(false);
      if (wantedMore) {
        const words = payload.error ?? 'Earlier turns could not be shown.';
        setError(words);
        announce(words);
      }
      return;
    }
    if (walk.kind === 'more') {
      walkRef.current = undefined;
      setRun(workshopEarlierRunWithOlderPage(runRef.current, payload.page));
      setPending(false);
      setLandSerial((serial) => serial + 1);
      if (payload.page.turns.length > 0) {
        announce(workshopEarlierTurnsShownAnnouncement(payload.page.turns.length));
      }
      return;
    }
    const step = workshopEarlierRereadStep(walk.fresh, payload.page, walk.oldestHeldTurnId, walk.limit);
    if (!step.run) {
      const oldestRead = step.fresh[0]?.turn.id;
      if (oldestRead !== undefined) {
        setRun(workshopEarlierRunRereadSoFar(runRef.current, step.fresh));
        walkRef.current = { ...walk, fresh: step.fresh, requestId: request(room.roomRevision, oldestRead) };
        return;
      }
    }
    walkRef.current = undefined;
    setRun(step.run ?? { ...runRef.current, entries: step.fresh });
    if (walk.moreAfter) {
      setPending(requestOlderPage());
    }
  }, [announce, request, requestOlderPage, setRun]);

  const parts = React.useMemo(() => workshopEarlierTurnsThreadParts(run, windowTurns), [run, windowTurns]);
  const threadTurns = React.useMemo(
    () => (parts.turns.length === 0 ? windowTurns : [...parts.turns, ...windowTurns]),
    [parts.turns, windowTurns]
  );
  const held = run.entries.length > 0;
  const thread = React.useMemo<WorkshopEarlierTurnsThreadView>(() => ({
    ...parts,
    ...(held && run.modelsBefore ? { modelsBefore: run.modelsBefore } : {}),
    remaining: held ? run.remainingBefore : hiddenTurns,
    pending,
    ...(error !== undefined ? { error } : {}),
    landSerial,
    announcement: announced.text,
    announcementSerial: announced.serial,
    onShowEarlier: showEarlier
  }), [parts, held, run.modelsBefore, run.remainingBefore, hiddenTurns, pending, error, landSerial, announced, showEarlier]);

  return {
    threadTurns,
    thread,
    showEarlier,
    handleEarlierTurns,
    handleSessionState,
    persistedState: NO_PERSISTENCE
  };
}
