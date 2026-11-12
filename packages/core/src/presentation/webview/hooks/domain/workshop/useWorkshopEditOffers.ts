/**
 * A reply's edit offers, as the webview asks for them (ADR 2026-11-10 D4,
 * U2, U5, U6; epic Slice 3): a chip's press, the words a press that left no
 * answer came back with, and the one announcement of what a press came to.
 *
 * - **Host-owned truth.** An offer and its status arrive on the snapshot's
 *   turns; nothing is worked out here. A press posts ids only (a minted
 *   `requestId`, the room revision, the turn id, the kind and, for one
 *   version, its option's index) and waits for
 *   `WORKSHOP_EDIT_OFFER_RESULT`.
 * - **Correlated** (the file-edit cards' pattern). Only an answer still
 *   waited for, for the room on screen, is taken: a late, duplicate or other
 *   room's answer changes nothing.
 * - **Per chip** (`turnId#kind`, and `#option` for one version of an offer
 *   with options): asking while its request is out; one
 *   request per chip at a time. A refusal's or failure's words stay with the
 *   chip until the next snapshot.
 * - **Announced once** (U6), by the one polite live region this hook owns:
 *   the host's words for the answer, or for why there is none.
 * - **A new room** drops everything the old one waited on or said.
 * - **Nothing persisted.** The session owns the offers.
 */

import * as React from 'react';
import {
  MessageType,
  type WorkshopEditOfferActionPayload,
  type WorkshopEditOfferKind,
  type WorkshopEditOfferResultMessage
} from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { workshopEditOfferKey } from '@hooks/domain/workshop/editOffers/workshopEditOfferChipView';

export interface WorkshopEditOffersState {
  /** Chips whose press waits for the host, by `workshopEditOfferKey`. */
  askingOffers: ReadonlySet<string>;
  /** The host's words for a press that left no answer, by chip, until the next snapshot. */
  offerFeedback: ReadonlyMap<string, string>;
  /** The polite live region's text: what the latest press came to, or empty. */
  announcement: string;
  /** Moves with every announcement, so the same words said twice are read twice (a keyed node). */
  announcementSerial: number;
}

export interface WorkshopEditOffersActions {
  /** Ask the reply's author for its fixes or rewrites as edits. */
  ask: (turnId: string, kind: WorkshopEditOfferKind, option?: number) => void;
  handleResult: (message: WorkshopEditOfferResultMessage) => void;
  /** A snapshot arrived: a chip's held words go with it. */
  noteSessionState: () => void;
}

export interface WorkshopEditOffersPersistence {
  // The session owns every offer; nothing is kept in webview state.
}

export type UseWorkshopEditOffersReturn = WorkshopEditOffersState &
  WorkshopEditOffersActions & {
    persistedState: WorkshopEditOffersPersistence;
  };

export interface UseWorkshopEditOffersOptions {
  /** The room's identity (`room:<revision>`, or `pending` before the first snapshot). */
  roomKey: string;
  /** The room generation chips are shown in; absent before the first snapshot, when nothing posts. */
  roomRevision?: number;
}

interface Pending {
  readonly chip: string;
  readonly roomKey: string;
  readonly roomRevision: number;
}

const SOURCE = 'webview.workshop.editOffers';
const NO_PERSISTENCE: WorkshopEditOffersPersistence = {};

export function useWorkshopEditOffers({ roomKey, roomRevision }: UseWorkshopEditOffersOptions): UseWorkshopEditOffersReturn {
  const vscode = useVSCodeApi();
  const [askingOffers, setAskingOffers] = React.useState<ReadonlySet<string>>(new Set());
  const [offerFeedback, setOfferFeedback] = React.useState<ReadonlyMap<string, string>>(new Map());
  const [announced, setAnnounced] = React.useState({ text: '', serial: 0 });
  const room = React.useRef({ key: roomKey, revision: roomRevision });
  const pending = React.useRef(new Map<string, Pending>());
  // Mirrors the state a press reads synchronously, so a double press in one tick posts once.
  const askingRef = React.useRef(new Set<string>());
  const ids = React.useRef({ prefix: `ws-edit-offer-${Math.random().toString(36).slice(2, 10)}`, count: 0 });

  const setAsking = React.useCallback((chip: string, asking: boolean) => {
    if (asking) {
      askingRef.current.add(chip);
    } else {
      askingRef.current.delete(chip);
    }
    setAskingOffers(new Set(askingRef.current));
  }, []);

  const setFeedback = React.useCallback((chip: string, words: string | undefined) =>
    setOfferFeedback((current) => {
      if (words === undefined && !current.has(chip)) {
        return current;
      }
      const next = new Map(current);
      if (words === undefined) {
        next.delete(chip);
      } else {
        next.set(chip, words);
      }
      return next;
    }), []);

  const ask = React.useCallback((turnId: string, kind: WorkshopEditOfferKind, option?: number) => {
    const { key, revision } = room.current;
    const chip = workshopEditOfferKey(turnId, kind, option);
    if (revision === undefined || askingRef.current.has(chip)) {
      return;
    }
    ids.current.count += 1;
    const requestId = `${ids.current.prefix}-${ids.current.count}`;
    pending.current.set(requestId, { chip, roomKey: key, roomRevision: revision });
    setAsking(chip, true);
    setFeedback(chip, undefined);
    // Ids only (D4): no text, no path, no count.
    const payload: WorkshopEditOfferActionPayload = { requestId, roomRevision: revision, turnId, kind, ...(option !== undefined ? { option } : {}) };
    vscode.postMessage({ type: MessageType.WORKSHOP_EDIT_OFFER_ACTION, source: SOURCE, payload, timestamp: Date.now() });
  }, [setAsking, setFeedback, vscode]);

  // A new room drops what the old one's chips were waiting on or said.
  const clearOffersWhenRoomChanges = React.useCallback((key: string, revision: number | undefined) => {
    const changed = room.current.key !== key;
    room.current = { key, revision };
    if (!changed) {
      return;
    }
    pending.current.clear();
    askingRef.current.clear();
    setAskingOffers((current) => (current.size === 0 ? current : new Set()));
    setOfferFeedback((current) => (current.size === 0 ? current : new Map()));
  }, []);
  React.useEffect(() => {
    clearOffersWhenRoomChanges(roomKey, roomRevision);
  }, [clearOffersWhenRoomChanges, roomKey, roomRevision]);

  const handleResult = React.useCallback((message: WorkshopEditOfferResultMessage) => {
    const { payload } = message;
    const owner = pending.current.get(payload.requestId);
    if (!owner) {
      return;
    }
    pending.current.delete(payload.requestId);
    const sameRoom = owner.roomKey === room.current.key && owner.roomRevision === payload.roomRevision
      && payload.roomRevision === room.current.revision;
    if (!sameRoom || owner.chip !== workshopEditOfferKey(payload.turnId, payload.kind, payload.option)) {
      return;
    }
    setAsking(owner.chip, false);
    // An answer speaks through the chip's status; a press that left none says why beside the chip.
    setFeedback(owner.chip, payload.answer === 'answered' ? undefined : payload.message);
    if (payload.message) {
      setAnnounced((current) => ({ text: payload.message, serial: current.serial + 1 }));
    }
  }, [setAsking, setFeedback]);

  const noteSessionState = React.useCallback(() => {
    setOfferFeedback((current) => (current.size === 0 ? current : new Map()));
  }, []);

  return {
    askingOffers,
    offerFeedback,
    announcement: announced.text,
    announcementSerial: announced.serial,
    ask,
    handleResult,
    noteSessionState,
    persistedState: NO_PERSISTENCE
  };
}
