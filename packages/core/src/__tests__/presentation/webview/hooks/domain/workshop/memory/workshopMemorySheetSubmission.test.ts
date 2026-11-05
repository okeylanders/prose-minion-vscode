/**
 * What the memory sheet's Save sends, by mode: the route and payload the
 * hook posts under its request id. *Alice*.
 */

import { MessageType, type WorkshopMemoryDraft } from '@messages';
import type { WorkshopMemorySheetState } from '@hooks/domain/workshop/useWorkshopProjectMemory';
import { workshopMemorySheetSubmission } from '@hooks/domain/workshop/memory/workshopMemorySheetSubmission';

const draft: WorkshopMemoryDraft = {
  title: 'The Duchess keeps a pig', kind: 'canon', summary: 'The baby turns into a pig.', body: '', supersedes: [], pinned: false
};
const sheet = (fields: Partial<WorkshopMemorySheetState>): WorkshopMemorySheetState => ({
  mode: 'new', draft, replaces: [], loading: false, saving: false, ...fields
});

describe('workshopMemorySheetSubmission', () => {
  it('a card saves its edited proposal', () => {
    expect(workshopMemorySheetSubmission(sheet({ mode: 'card', turnId: 'turn-4-assistant-1', proposalIndex: 1 }), 'r1')).toEqual({
      type: MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION,
      payload: { requestId: 'r1', turnId: 'turn-4-assistant-1', index: 1, action: 'save', edited: draft }
    });
  });

  it('a turn of this room saves by turn, naming its room only when a bookmark outside the window opened it', () => {
    expect(workshopMemorySheetSubmission(sheet({ mode: 'turn', turnId: 'turn-4-assistant-1' }), 'r2')).toEqual({
      type: MessageType.WORKSHOP_SAVE_TURN_TO_MEMORY,
      payload: { requestId: 'r2', turnId: 'turn-4-assistant-1', draft }
    });
    expect(workshopMemorySheetSubmission(sheet({ mode: 'turn', turnId: 'turn-4-assistant-1', roomRevision: 3 }), 'r3').payload)
      .toEqual({ requestId: 'r3', turnId: 'turn-4-assistant-1', draft, roomRevision: 3 });
  });

  it('a saved session\'s turn saves by session and turn', () => {
    expect(workshopMemorySheetSubmission(sheet({ mode: 'saved-turn', sessionId: 'saved-0042', turnId: 'turn-7-assistant-1' }), 'r4')).toEqual({
      type: MessageType.WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY,
      payload: { requestId: 'r4', sessionId: 'saved-0042', turnId: 'turn-7-assistant-1', draft }
    });
  });

  it('a saved memory\'s edit replaces what it says, and New makes one with no source', () => {
    expect(workshopMemorySheetSubmission(sheet({ mode: 'memory', memoryId: 'mem-0000c1' }), 'r5')).toEqual({
      type: MessageType.WORKSHOP_MEMORY_UPDATE,
      payload: { requestId: 'r5', memoryId: 'mem-0000c1', patch: draft }
    });
    expect(workshopMemorySheetSubmission(sheet({ mode: 'new' }), 'r6')).toEqual({
      type: MessageType.WORKSHOP_MEMORY_CREATE,
      payload: { requestId: 'r6', draft }
    });
  });
});
