/**
 * A persona's context-paths card, as the webview asks to apply it (ADR
 * 2026-11-19 D24, D27): Apply with the groups ticked, or Decline.
 *
 * - **Host-owned truth.** The card, its view and its answers arrive on the
 *   snapshot's turns; nothing is worked out here but which boxes are
 *   ticked, which start as every offered group. Apply posts ids only (a
 *   webview-minted `requestId`, the room revision, the turn id, the groups
 *   ticked) and waits for `WORKSHOP_LOCATIONS_PROPOSAL_RESULT`.
 * - **Correlated.** Only an answer still waited for, for the room on
 *   screen, is taken: a late, duplicate or other room's answer changes
 *   nothing.
 * - **Per card:** one Apply at a time; a refusal's words stay with the card
 *   until the next room.
 * - **It listens for its own answer** (`useMessageRouter`), so the app's
 *   router gains no route.
 * - **Nothing persisted.** The session owns the card.
 */

import * as React from 'react';
import {
  MessageType,
  type WorkshopApplyLocationsProposalPayload,
  type WorkshopLocationsProposalResultMessage
} from '@messages';
import type { ContextPathGroup } from '@shared/types';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { useMessageRouter } from '@hooks/useMessageRouter';
import { WORKSHOP_LOCATIONS_RESULT_WORDS } from '@shared/constants/contextPathSuggestionWords';

export interface WorkshopLocationsProposalState {
  /** Cards whose Apply waits for the host, by turn id. */
  applying: ReadonlySet<string>;
  /** The host's words for an Apply that did nothing, by turn id. */
  feedback: ReadonlyMap<string, string>;
}

export interface WorkshopLocationsProposalActions {
  /** Apply the groups ticked; none declines the card. */
  apply: (turnId: string, groups: readonly ContextPathGroup[]) => void;
  handleResult: (message: WorkshopLocationsProposalResultMessage) => void;
}

export interface WorkshopLocationsProposalPersistence {
  // The session owns every card; nothing is kept in webview state.
}

export type UseWorkshopLocationsProposalReturn = WorkshopLocationsProposalState &
  WorkshopLocationsProposalActions & {
    persistedState: WorkshopLocationsProposalPersistence;
  };

export interface UseWorkshopLocationsProposalOptions {
  /** The room's identity (`room:<revision>`, or `pending` before the first snapshot). */
  roomKey: string;
  /** The room generation cards are shown in; absent before the first snapshot, when nothing posts. */
  roomRevision?: number;
}

const SOURCE = 'webview.workshop.locationsProposal';
const NO_PERSISTENCE: WorkshopLocationsProposalPersistence = {};

export function useWorkshopLocationsProposal({ roomKey, roomRevision }: UseWorkshopLocationsProposalOptions): UseWorkshopLocationsProposalReturn {
  const vscode = useVSCodeApi();
  const [applying, setApplying] = React.useState<ReadonlySet<string>>(new Set());
  const [feedback, setFeedback] = React.useState<ReadonlyMap<string, string>>(new Map());
  const room = React.useRef({ key: roomKey, revision: roomRevision });
  const pending = React.useRef(new Map<string, { turnId: string; roomKey: string }>());
  const applyingRef = React.useRef(new Set<string>());
  const ids = React.useRef({ prefix: `ws-locations-${Math.random().toString(36).slice(2, 10)}`, count: 0 });

  const setCardApplying = React.useCallback((turnId: string, value: boolean) => {
    if (value) {
      applyingRef.current.add(turnId);
    } else {
      applyingRef.current.delete(turnId);
    }
    setApplying(new Set(applyingRef.current));
  }, []);

  const apply = React.useCallback((turnId: string, groups: readonly ContextPathGroup[]) => {
    const { key, revision } = room.current;
    if (revision === undefined || applyingRef.current.has(turnId)) {
      return;
    }
    ids.current.count += 1;
    const requestId = `${ids.current.prefix}-${ids.current.count}`;
    pending.current.set(requestId, { turnId, roomKey: key });
    setCardApplying(turnId, true);
    setFeedback((current) => {
      if (!current.has(turnId)) {
        return current;
      }
      const next = new Map(current);
      next.delete(turnId);
      return next;
    });
    // Ids and ticked groups only (D24): never a pattern.
    const payload: WorkshopApplyLocationsProposalPayload = { requestId, roomRevision: revision, turnId, groups: [...groups] };
    vscode.postMessage({ type: MessageType.WORKSHOP_APPLY_LOCATIONS_PROPOSAL, source: SOURCE, payload, timestamp: Date.now() });
  }, [setCardApplying, vscode]);

  const clearWhenRoomChanges = React.useCallback((key: string, revision: number | undefined) => {
    const changed = room.current.key !== key;
    room.current = { key, revision };
    if (!changed) {
      return;
    }
    pending.current.clear();
    applyingRef.current.clear();
    setApplying((current) => (current.size === 0 ? current : new Set()));
    setFeedback((current) => (current.size === 0 ? current : new Map()));
  }, []);
  React.useEffect(() => {
    clearWhenRoomChanges(roomKey, roomRevision);
  }, [clearWhenRoomChanges, roomKey, roomRevision]);

  const handleResult = React.useCallback((message: WorkshopLocationsProposalResultMessage) => {
    const owner = pending.current.get(message.payload.requestId);
    if (!owner) {
      return;
    }
    pending.current.delete(message.payload.requestId);
    if (owner.roomKey !== room.current.key) {
      return;
    }
    setCardApplying(owner.turnId, false);
    const { outcome } = message.payload;
    if (outcome !== 'done') {
      setFeedback((current) => new Map(current).set(owner.turnId, WORKSHOP_LOCATIONS_RESULT_WORDS[outcome]));
    }
  }, [setCardApplying]);

  const routes = React.useMemo(() => ({ [MessageType.WORKSHOP_LOCATIONS_PROPOSAL_RESULT]: handleResult }), [handleResult]);
  useMessageRouter(routes as Parameters<typeof useMessageRouter>[0]);

  return { applying, feedback, apply, handleResult, persistedState: NO_PERSISTENCE };
}
