/**
 * Save and tell me's decision point (ADR 2026-11-04 D8; epic Slice 5), and
 * the held card's words (Slice 0d, "In the thread", item 4; PR #196 F-01,
 * F-02). Pure. *Alice*, made-up ids.
 */

import type { WorkshopProjectMemoryReceipt, WorkshopTurn } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { workshopMemoryHeldReason } from '@shared/constants/workshopProjectMemoryWrites';
import {
  countWorkshopRoomAutoSaves,
  routeWorkshopMemoryProposal,
  WORKSHOP_MEMORY_AUTO_SAVES_PER_ROOM
} from '@/application/services/workshop/memory/WorkshopMemoryAutoSave';

const facts = (webResearchAttached: boolean, autoSaves: number) => ({ webResearchAttached, autoSavesInRoom: jest.fn(() => autoSaves) });

const receiptTurn = (n: number, receipt: Partial<WorkshopProjectMemoryReceipt>): WorkshopTurn => ({
  id: `turn-${n}-system-${1000 + n}`,
  role: 'system',
  kind: 'divider',
  participant: 'session',
  artifact: 'memory_receipt',
  content: '',
  timestamp: 1000 + n,
  projectMemoryReceipt: {
    action: 'saved', memoryId: `mem-00000${n}`, title: 'The watch', version: '0123456789ab', by: 'auto', ...receipt
  }
} as WorkshopTurn);

describe('routeWorkshopMemoryProposal', () => {
  it('Ask first, and a mode not read as on, leave the card waiting, unheld, whatever the run did', () => {
    expect(routeWorkshopMemoryProposal('ask', facts(true, 99))).toEqual({ kind: 'wait' });
    expect(routeWorkshopMemoryProposal(undefined, facts(false, 0))).toEqual({ kind: 'wait' });
  });

  it('Save and tell me saves at once under the cap with no web research attached', () => {
    expect(routeWorkshopMemoryProposal('auto', facts(false, WORKSHOP_MEMORY_AUTO_SAVES_PER_ROOM - 1))).toEqual({ kind: 'auto' });
  });

  it('holds for web research attached, before it counts the room (citations play no part)', () => {
    const run = facts(true, 0);
    expect(routeWorkshopMemoryProposal('auto', run)).toEqual({ kind: 'held', held: 'web-research' });
    expect(run.autoSavesInRoom).not.toHaveBeenCalled();
  });

  it('holds at the room\'s cap', () => {
    expect(routeWorkshopMemoryProposal('auto', facts(false, WORKSHOP_MEMORY_AUTO_SAVES_PER_ROOM))).toEqual({ kind: 'held', held: 'room-cap' });
  });

  it('the cap is the budget\'s autoSavesPerRoom', () => {
    expect(WORKSHOP_MEMORY_AUTO_SAVES_PER_ROOM).toBe(PROMPT_BUDGETS.workshopProjectMemory.autoSavesPerRoom);
    expect(WORKSHOP_MEMORY_AUTO_SAVES_PER_ROOM).toBe(5);
  });
});

describe('countWorkshopRoomAutoSaves', () => {
  it('counts only saves Save and tell me made', () => {
    expect(countWorkshopRoomAutoSaves([
      receiptTurn(1, {}),
      receiptTurn(2, { by: 'writer' }),
      receiptTurn(3, { action: 'updated', by: 'writer' }),
      receiptTurn(4, { action: 'forgotten', by: 'writer' }),
      receiptTurn(5, {})
    ])).toBe(2);
    expect(countWorkshopRoomAutoSaves([])).toBe(0);
  });
});

describe('the held card\'s reason', () => {
  it('says web research was available, never that a search ran', () => {
    const line = workshopMemoryHeldReason('web-research');
    expect(line).toBe('Live web research was available for this reply, so this memory waits for you to save it.');
    expect(line).not.toMatch(/searched|found|cited|source/i);
  });

  it('names the room-wide cap from the budget, and no persona', () => {
    expect(workshopMemoryHeldReason('room-cap'))
      .toBe(`This conversation has reached its limit of ${PROMPT_BUDGETS.workshopProjectMemory.autoSavesPerRoom} automatic memory saves. This one waits for you.`);
    expect(workshopMemoryHeldReason('room-cap')).not.toMatch(/Jill|Cliff|Margot/);
  });
});
