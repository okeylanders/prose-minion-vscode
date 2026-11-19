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
 * - **A jump** (D6, amended 2026-11-18): `loadThrough` walks page after page
 *   back to a turn outside the window (a bookmark's), each request naming
 *   it, so the host refuses a turn the room no longer holds or one more than
 *   `jumpPages` full pages back; the walk itself stops after `jumpPages`
 *   pages. A turn the run already holds lands at once. The walk ends with
 *   one outcome, `landed` (the caller scrolls to it) or `refused` (the
 *   caller opens the reader), announced once. A newer jump replaces it,
 *   `cancelJump` drops it (the pages already shown stay), and a new room
 *   abandons it. A re-read in flight finishes first.
 * - **Announced once** per page shown, by the polite live region the thread
 *   draws for this hook; a jump's pages are announced once, together.
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
  workshopEarlierJumpAnnouncement,
  workshopEarlierJumpStep,
  workshopEarlierRereadStep,
  workshopEarlierRunCarrying,
  workshopEarlierRunHolds,
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

/** A turn to load the earlier turns back through, and the bookmark label it is known by. */
export interface WorkshopEarlierTurnsJumpTarget {
  readonly turnId: string;
  readonly label?: string;
}

/** How a jump ended; `serial` moves with each, so the caller acts on each once. */
export interface WorkshopEarlierTurnsJumpOutcome extends WorkshopEarlierTurnsJumpTarget {
  /** `landed`: the thread holds the turn. `refused`: it does not, and the words why were announced. */
  readonly kind: 'landed' | 'refused';
  readonly serial: number;
}

export interface WorkshopEarlierTurnsState {
  /** The earlier turns drawn, then the window: what the thread shows. */
  threadTurns: readonly WorkshopTurn[];
  thread: WorkshopEarlierTurnsThreadView;
  /** The turn a jump is loading the earlier turns back through, while it loads. */
  jumpingTo?: string;
  /** The latest jump's outcome. */
  jumpOutcome?: WorkshopEarlierTurnsJumpOutcome;
}

export interface WorkshopEarlierTurnsActions {
  /** Ask for the page before the oldest turn held. */
  showEarlier: () => void;
  /** Load the earlier turns back through a turn outside the window, then settle `jumpOutcome`. */
  loadThrough: (target: WorkshopEarlierTurnsJumpTarget) => void;
  /** Stop the jump in progress; the pages already shown stay. */
  cancelJump: () => void;
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
      readonly kind: 'jump';
      readonly requestId: string;
      readonly target: WorkshopEarlierTurnsJumpTarget;
      /** Turns this jump's pages added so far. */
      readonly loaded: number;
      /** Pages this jump has asked for, the one in flight included. */
      readonly pages: number;
    }
  | {
      readonly kind: 'reread';
      readonly requestId: string;
      readonly oldestHeldTurnId: string;
      readonly limit: number;
      readonly fresh: readonly WorkshopEarlierTurnEntry[];
      /** "Show earlier turns" was pressed, or was waiting, when this walk began: ask once it ends. */
      readonly moreAfter: boolean;
      /** A jump asked for while this walk ran: it starts once the walk ends. */
      readonly jumpAfter?: WorkshopEarlierTurnsJumpTarget;
    };

const SOURCE = 'webview.workshop.earlierTurns';
/** A jump whose turn the walk could not reach, with no host words to say why. */
export const WORKSHOP_EARLIER_JUMP_NOT_LOADED = 'The turn could not be shown in the thread, so the reader shows it instead.';
/** A jump that used its `jumpPages` pages without reaching the turn. */
export const WORKSHOP_EARLIER_JUMP_TOO_FAR = 'The turn is too far back to load into the thread, so the reader shows it instead.';

/** The jump a walk carries: its own target, or the one waiting behind a re-read. */
const jumpTargetOf = (walk: Walk | undefined): WorkshopEarlierTurnsJumpTarget | undefined => {
  if (walk?.kind === 'jump') {
    return walk.target;
  }
  return walk?.kind === 'reread' ? walk.jumpAfter : undefined;
};
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
  const [jumpingTo, setJumpingTo] = React.useState<string | undefined>(undefined);
  const [jumpOutcome, setJumpOutcome] = React.useState<WorkshopEarlierTurnsJumpOutcome | undefined>(undefined);
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
  const request = React.useCallback((roomRevision: number, beforeTurnId: string, targetTurnId?: string): string => {
    ids.current.count += 1;
    const requestId = `${ids.current.prefix}-${ids.current.count}`;
    const payload: WorkshopRequestEarlierTurnsPayload = {
      requestId,
      roomRevision,
      beforeTurnId,
      ...(targetTurnId !== undefined ? { targetTurnId } : {})
    };
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

  /** The jump is over: the caller scrolls to the turn, or opens the reader. */
  const settleJump = React.useCallback((target: WorkshopEarlierTurnsJumpTarget, kind: WorkshopEarlierTurnsJumpOutcome['kind']) => {
    setJumpingTo(undefined);
    setPending(false);
    setJumpOutcome((current) => ({ ...target, kind, serial: (current?.serial ?? 0) + 1 }));
  }, []);

  /** Ask for the first page of a jump, from the oldest turn held (or the window's first). */
  const startJump = React.useCallback((target: WorkshopEarlierTurnsJumpTarget) => {
    if (workshopEarlierRunHolds(runRef.current, target.turnId)) {
      walkRef.current = undefined;
      announce(workshopEarlierJumpAnnouncement(0, target.label));
      settleJump(target, 'landed');
      return;
    }
    const room = windowRef.current;
    const beforeTurnId = runRef.current.entries[0]?.turn.id ?? room?.turns[0]?.id;
    if (!room || beforeTurnId === undefined) {
      walkRef.current = undefined;
      announce(WORKSHOP_EARLIER_JUMP_NOT_LOADED);
      settleJump(target, 'refused');
      return;
    }
    walkRef.current = {
      kind: 'jump',
      requestId: request(room.roomRevision, beforeTurnId, target.turnId),
      target,
      loaded: 0,
      pages: 1
    };
    setJumpingTo(target.turnId);
    setPending(true);
  }, [announce, request, settleJump]);

  const loadThrough = React.useCallback((target: WorkshopEarlierTurnsJumpTarget) => {
    const walk = walkRef.current;
    setError(undefined);
    if (walk?.kind === 'reread') {
      // One request in flight at a time: the jump starts once the re-read ends.
      walkRef.current = { ...walk, jumpAfter: target };
      setJumpingTo(target.turnId);
      setPending(true);
      return;
    }
    // A jump replaces a page or a jump still waited for; that answer is dropped.
    startJump(target);
  }, [startJump]);

  const cancelJump = React.useCallback(() => {
    const walk = walkRef.current;
    if (walk?.kind === 'jump') {
      walkRef.current = undefined;
      setPending(false);
    } else if (walk?.kind === 'reread' && walk.jumpAfter) {
      walkRef.current = { ...walk, jumpAfter: undefined };
      setPending(walk.moreAfter);
    }
    setJumpingTo(undefined);
  }, []);

  const showEarlier = React.useCallback(() => {
    const walk = walkRef.current;
    if (walk?.kind === 'more' || walk?.kind === 'jump') {
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
    setJumpingTo(undefined);
  }, [setRun]);

  const handleSessionState = React.useCallback((message: WorkshopSessionStateMessage) => {
    const session = message.payload.session;
    const earlier = windowRef.current;
    windowRef.current = session;
    // Another room, or a window that now reaches the room's first turn: nothing earlier is held or waited for.
    if (!earlier || earlier.roomRevision !== session.roomRevision || session.truncatedTurns <= 0) {
      const sameRoomJump = earlier?.roomRevision === session.roomRevision ? jumpTargetOf(walkRef.current) : undefined;
      if (walkRef.current || runRef.current.entries.length > 0) {
        clearEarlierTurns();
      }
      // The same room's window now reaches its first turn: the turn a jump was loading toward is drawn.
      if (sameRoomJump) {
        settleJump(sameRoomJump, 'landed');
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
      if (walk?.kind === 'jump' && earlier.turns[0]?.id !== windowFirstTurnId) {
        // The walk starts again from where the window now starts.
        startJump(walk.target);
      }
      return;
    }
    const jumpTarget = jumpTargetOf(walk);
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
      moreAfter: walk?.kind === 'more' || (walk?.kind === 'reread' && walk.moreAfter),
      ...(jumpTarget ? { jumpAfter: jumpTarget } : {})
    };
  }, [clearEarlierTurns, request, setRun, settleJump, startJump]);

  const handleEarlierTurns = React.useCallback((message: WorkshopEarlierTurnsMessage) => {
    const { payload } = message;
    const walk = walkRef.current;
    const room = windowRef.current;
    // Only the answer still waited for, for the room on screen, is taken.
    if (!walk || !room || walk.requestId !== payload.requestId || payload.roomRevision !== room.roomRevision) {
      return;
    }
    const wantedMore = walk.kind === 'more' || (walk.kind === 'reread' && walk.moreAfter);
    const jumpTarget = jumpTargetOf(walk);
    if (!payload.page) {
      // A refusal keeps what was held.
      walkRef.current = undefined;
      setPending(false);
      if (jumpTarget) {
        // The reader shows the turn instead; the host's words say why.
        announce(payload.error ?? WORKSHOP_EARLIER_JUMP_NOT_LOADED);
        settleJump(jumpTarget, 'refused');
      } else if (wantedMore) {
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
    if (walk.kind === 'jump') {
      setRun(workshopEarlierRunWithOlderPage(runRef.current, payload.page));
      setLandSerial((serial) => serial + 1);
      const jump = workshopEarlierJumpStep(walk.loaded, payload.page, walk.target.turnId);
      if (jump.kind === 'next' && walk.pages < PROMPT_BUDGETS.workshopThread.jumpPages) {
        walkRef.current = {
          ...walk,
          loaded: jump.loaded,
          pages: walk.pages + 1,
          requestId: request(room.roomRevision, jump.beforeTurnId, walk.target.turnId)
        };
        return;
      }
      walkRef.current = undefined;
      if (jump.kind === 'landed') {
        announce(workshopEarlierJumpAnnouncement(jump.loaded, walk.target.label));
        settleJump(walk.target, 'landed');
      } else {
        // Past `jumpPages` pages (byte-bounded pages can hold fewer turns), or the walk lost its way.
        announce(jump.kind === 'next' ? WORKSHOP_EARLIER_JUMP_TOO_FAR : WORKSHOP_EARLIER_JUMP_NOT_LOADED);
        settleJump(walk.target, 'refused');
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
    if (walk.jumpAfter) {
      startJump(walk.jumpAfter);
    } else if (walk.moreAfter) {
      setPending(requestOlderPage());
    }
  }, [announce, request, requestOlderPage, setRun, settleJump, startJump]);

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
    ...(jumpingTo !== undefined ? { jumpingTo } : {}),
    ...(jumpOutcome ? { jumpOutcome } : {}),
    showEarlier,
    loadThrough,
    cancelJump,
    handleEarlierTurns,
    handleSessionState,
    persistedState: NO_PERSISTENCE
  };
}
