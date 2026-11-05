/**
 * What the memory sheet's Save sends, by its mode, as a pure value: the
 * route and payload `useWorkshopProjectMemory` posts under the request id it
 * minted. A card saves its edited proposal; a turn of this room saves by
 * turn (naming its room when it came from a bookmark outside the window:
 * ADR 2026-11-05 D9); a saved session's turn by session and turn; a saved
 * memory's edit replaces what it says; New makes a memory with no source.
 */

import { MessageType } from '@messages';
import type { WorkshopMemorySheetState } from '@hooks/domain/workshop/useWorkshopProjectMemory';

export interface WorkshopMemorySheetSubmission {
  readonly type: MessageType;
  readonly payload: Readonly<Record<string, unknown>>;
}

export function workshopMemorySheetSubmission(sheet: WorkshopMemorySheetState, requestId: string): WorkshopMemorySheetSubmission {
  const { draft } = sheet;
  switch (sheet.mode) {
    case 'card':
      return {
        type: MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION,
        payload: { requestId, turnId: sheet.turnId, index: sheet.proposalIndex, action: 'save', edited: draft }
      };
    case 'turn':
      return {
        type: MessageType.WORKSHOP_SAVE_TURN_TO_MEMORY,
        payload: { requestId, turnId: sheet.turnId, draft, ...(sheet.roomRevision !== undefined ? { roomRevision: sheet.roomRevision } : {}) }
      };
    case 'saved-turn':
      return {
        type: MessageType.WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY,
        payload: { requestId, sessionId: sheet.sessionId, turnId: sheet.turnId, draft }
      };
    case 'memory':
      return { type: MessageType.WORKSHOP_MEMORY_UPDATE, payload: { requestId, memoryId: sheet.memoryId, patch: draft } };
    case 'new':
      return { type: MessageType.WORKSHOP_MEMORY_CREATE, payload: { requestId, draft } };
    default: {
      const unreachable: never = sheet.mode;
      return unreachable;
    }
  }
}
