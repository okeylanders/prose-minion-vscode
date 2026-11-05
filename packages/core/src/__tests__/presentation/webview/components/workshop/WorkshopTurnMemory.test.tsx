/**
 * @jest-environment jsdom
 */

/**
 * Project memory in the thread (ADR 2026-11-04 D6, D7; Slice 0d, "In the
 * thread"): one card component with a read-only mode; the card's pending,
 * saved and dismissed states under a persona's reply; receipt dividers;
 * and Save to memory… on the bubbles bookmarks allow. The UI never says
 * "pin". *Alice*.
 */

import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

jest.mock('marked', () => {
  const marked = Object.assign(jest.fn((content: string) => content), { setOptions: jest.fn() });
  return { marked };
});

import type { WorkshopMemoryProposal, WorkshopProjectMemoryReceipt, WorkshopTurn } from '@messages';
import { WorkshopTurnBubble } from '@components/workshop/WorkshopTurnBubble';
import { WorkshopMemoryCard } from '@components/workshop/memory/WorkshopMemoryCard';
import type { WorkshopTurnMemoryControls } from '@components/workshop/memory/WorkshopTurnMemory';
import { workshopAutoSavedMemories } from '@hooks/domain/workshop/memory/workshopMemoryAutoReceipts';

const PROPOSAL: WorkshopMemoryProposal = {
  proposes: 'new',
  title: 'The Rabbit\'s watch runs backward',
  kind: 'canon',
  summary: 'From chapter 3 on, the White Rabbit\'s watch runs backward.',
  body: 'We settled this while working the tea-party scene.',
  supersedes: [{ id: 'mem-1a9e04', title: 'The Rabbit\'s watch stops at six' }],
  state: 'pending'
};

const reply = (proposal?: WorkshopMemoryProposal): WorkshopTurn => ({
  id: 'turn-4-assistant-1008',
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  excerptVersion: 1,
  content: 'Good. It earns its place.',
  timestamp: 1,
  ...(proposal ? { memoryProposals: [proposal] } : {})
});

const receiptTurn = (receipt: WorkshopProjectMemoryReceipt): WorkshopTurn => ({
  id: 'turn-5-system-1010',
  role: 'system',
  kind: 'divider',
  participant: 'session',
  artifact: 'memory_receipt',
  excerptVersion: 1,
  content: `Saved to project memory: ${receipt.title} (${receipt.memoryId}).`,
  timestamp: 2,
  projectMemoryReceipt: receipt
});

const controls = (overrides: Partial<WorkshopTurnMemoryControls> = {}): WorkshopTurnMemoryControls => ({
  disabled: false,
  busyCards: new Set(),
  cardErrors: new Map(),
  onSaveCard: jest.fn(),
  onEditCard: jest.fn(),
  onDismissCard: jest.fn(),
  onReopenCard: jest.fn(),
  onSaveTurn: jest.fn(),
  onEditMemory: jest.fn(),
  onForget: jest.fn(),
  onRestore: jest.fn(),
  ...overrides
});

const bubble = (turn: WorkshopTurn, memory = controls()) => render(
  <WorkshopTurnBubble
    turn={turn}
    quickActionToolId={null}
    onQuickAction={jest.fn()}
    onTalkDirectly={jest.fn()}
    onCopy={jest.fn()}
    onSave={jest.fn()}
    memory={memory}
  />
);

describe('the memory card', () => {
  it('a pending suggestion: title, kind, summary, Replaces, the Full note, and Save · Edit… · Dismiss', () => {
    const memory = controls();
    bubble(reply(PROPOSAL), memory);
    const card = screen.getByRole('group', { name: 'Suggested memory' });
    expect(card.textContent).toContain('Suggested for project memory');
    expect(card.textContent).toContain('canon');
    expect(card.textContent).toContain('The Rabbit\'s watch runs backward');
    expect(card.textContent).toContain('Replaces The Rabbit\'s watch stops at six, which stays searchable.');
    expect(screen.getByText('Full note')).toBeTruthy();
    expect(card.textContent).toContain('Saved to this project only. Later conversations start knowing it.');

    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(memory.onSaveCard).toHaveBeenCalledWith('turn-4-assistant-1008', 0);
    expect(memory.onEditCard).toHaveBeenCalledWith(expect.objectContaining({ id: 'turn-4-assistant-1008' }), 0);
    expect(memory.onDismissCard).toHaveBeenCalledWith('turn-4-assistant-1008', 0);
  });

  it('says how many replaced memories were left out, and the card\'s refusal', () => {
    bubble(reply({ ...PROPOSAL, supersedes: undefined, droppedSupersedes: 2 }), controls({
      cardErrors: new Map([['turn-4-assistant-1008#0', 'Project memory isn\'t available here: no folder is open.']])
    }));
    expect(screen.getByText(/It named 2 memories to replace that aren't saved here/)).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Project memory isn\'t available here: no folder is open.');
  });

  it('settles in place: saved, and dismissed with Show it again', () => {
    const memory = controls();
    const { unmount } = bubble(reply({ ...PROPOSAL, state: 'saved', memoryId: 'mem-7f3c2a' }), memory);
    expect(screen.getByText(/Saved to project memory:/).textContent).toContain('The Rabbit\'s watch runs backward');
    expect(screen.queryByRole('group', { name: 'Suggested memory' })).toBeNull();
    unmount();

    bubble(reply({ ...PROPOSAL, state: 'dismissed' }), memory);
    expect(screen.getByText(/wasn't saved/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show it again' }));
    expect(memory.onReopenCard).toHaveBeenCalledWith('turn-4-assistant-1008', 0);
  });

  it('several suggestions: each its own card under a small count, acted on by its index (Slice 6b)', () => {
    const memory = controls();
    const turn = { ...reply(PROPOSAL), memoryProposals: [
      PROPOSAL,
      { ...PROPOSAL, title: 'The Hatter might know the Rabbit', kind: 'idea' as const, supersedes: undefined },
      { ...PROPOSAL, title: 'Tea is at six', state: 'saved' as const, memoryId: 'mem-7f3c2a', supersedes: undefined }
    ] };
    bubble(turn, memory);
    const stack = screen.getByRole('group', { name: '3 memory suggestions' });
    expect(stack.textContent).toContain('3 suggestions');
    const pending = within(stack).getAllByRole('group', { name: 'Suggested memory' });
    expect(pending).toHaveLength(2);
    expect(pending[1].textContent).toContain('The Hatter might know the Rabbit');
    expect(stack.textContent).toContain('Saved to project memory: Tea is at six');

    fireEvent.click(within(pending[1]).getByRole('button', { name: /^Save$/ }));
    fireEvent.click(within(pending[0]).getByRole('button', { name: 'Dismiss' }));
    fireEvent.click(within(pending[1]).getByRole('button', { name: 'Edit…' }));
    expect(memory.onSaveCard).toHaveBeenCalledWith('turn-4-assistant-1008', 1);
    expect(memory.onDismissCard).toHaveBeenCalledWith('turn-4-assistant-1008', 0);
    expect(memory.onEditCard).toHaveBeenCalledWith(expect.objectContaining({ id: 'turn-4-assistant-1008' }), 1);
  });

  it('busy and refused one card at a time: the others stay free', () => {
    const turn = { ...reply(PROPOSAL), memoryProposals: [PROPOSAL, { ...PROPOSAL, title: 'Tea is at six', supersedes: undefined }] };
    bubble(turn, controls({
      busyCards: new Set(['turn-4-assistant-1008#0']),
      cardErrors: new Map([['turn-4-assistant-1008#1', 'Try again.']])
    }));
    const [first, second] = screen.getAllByRole('group', { name: 'Suggested memory' });
    expect((within(first).getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(second).getByRole('button', { name: /^Save$/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(within(second).getByRole('alert').textContent).toBe('Try again.');
    expect(within(first).queryByRole('alert')).toBeNull();
  });

  describe('cards Save and tell me saved show on their receipts, and are not counted here (PR #209 F-01)', () => {
    const saved = (title: string, memoryId: string): WorkshopMemoryProposal => ({ ...PROPOSAL, title, supersedes: undefined, state: 'saved', memoryId });
    const autoReceipt = (memoryId: string, title: string, n: number): WorkshopTurn => ({
      ...receiptTurn({ action: 'saved', memoryId, title, version: '0123456789ab', by: 'auto', proposedBy: 'jill' }),
      id: `turn-${5 + n}-system-${1010 + n}`
    });
    const render3 = (proposals: WorkshopMemoryProposal[], receipts: WorkshopTurn[], memory = controls()) => {
      const turn = { ...reply(PROPOSAL), memoryProposals: proposals };
      const autoSaved = workshopAutoSavedMemories([turn, ...receipts]);
      return { memory, ...bubble(turn, { ...memory, autoSaved }) };
    };

    it('all saved automatically: no group, no count, no card', () => {
      render3([saved('Tea is at six', 'mem-000001'), saved('The Cat grins last', 'mem-000002')],
        [autoReceipt('mem-000001', 'Tea is at six', 0), autoReceipt('mem-000002', 'The Cat grins last', 1)]);
      expect(screen.queryByRole('group', { name: /memory suggestions/ })).toBeNull();
      expect(screen.queryByText(/suggestions$/)).toBeNull();
      expect(screen.queryByText(/Saved to project memory/)).toBeNull();
    });

    it('one left beside an automatic save: a plain card, no count', () => {
      render3([saved('Tea is at six', 'mem-000001'), { ...PROPOSAL, held: 'supersedes' }], [autoReceipt('mem-000001', 'Tea is at six', 0)]);
      expect(screen.queryByRole('group', { name: /memory suggestions/ })).toBeNull();
      expect(screen.queryByText(/suggestions$/)).toBeNull();
      expect(screen.getByRole('group', { name: 'Suggested memory, held for you' })).toBeTruthy();
    });

    it('two or more left: the count names only the cards shown', () => {
      render3([saved('Tea is at six', 'mem-000001'), PROPOSAL, { ...PROPOSAL, title: 'The Queen might be bluffing', supersedes: undefined }],
        [autoReceipt('mem-000001', 'Tea is at six', 0)]);
      const stack = screen.getByRole('group', { name: '2 memory suggestions' });
      expect(stack.textContent).toContain('2 suggestions');
      expect(within(stack).getAllByRole('group', { name: 'Suggested memory' })).toHaveLength(2);
    });

    it('an action on a later card still names its own index on the turn', () => {
      const { memory } = render3([saved('Tea is at six', 'mem-000001'), PROPOSAL, { ...PROPOSAL, title: 'The Queen might be bluffing', supersedes: undefined }],
        [autoReceipt('mem-000001', 'Tea is at six', 0)]);
      const [first, second] = screen.getAllByRole('group', { name: 'Suggested memory' });
      fireEvent.click(within(second).getByRole('button', { name: /^Save$/ }));
      fireEvent.click(within(first).getByRole('button', { name: 'Dismiss' }));
      fireEvent.click(within(second).getByRole('button', { name: 'Edit…' }));
      expect(memory.onSaveCard).toHaveBeenCalledWith('turn-4-assistant-1008', 2);
      expect(memory.onDismissCard).toHaveBeenCalledWith('turn-4-assistant-1008', 1);
      expect(memory.onEditCard).toHaveBeenCalledWith(expect.objectContaining({ id: 'turn-4-assistant-1008' }), 2);
    });

    it('a card the writer saved still shows its settled line, counted', () => {
      render3([saved('Tea is at six', 'mem-000001'), PROPOSAL], []);
      const stack = screen.getByRole('group', { name: '2 memory suggestions' });
      expect(stack.textContent).toContain('Saved to project memory: Tea is at six');
    });
  });

  it('one suggestion shows no count', () => {
    bubble(reply(PROPOSAL));
    expect(screen.queryByText(/suggestions$/)).toBeNull();
    expect(screen.queryByRole('group', { name: /memory suggestions/ })).toBeNull();
  });

  it('a supersession held under Save and tell me says it waits for the writer (Slice 6b)', () => {
    bubble(reply({ ...PROPOSAL, held: 'supersedes' }));
    const card = screen.getByRole('group', { name: 'Suggested memory, held for you' });
    expect(card.textContent).toContain('Held for you to decide');
    expect(card.textContent).toContain('It replaces a saved memory, so it waits for you to save it.');
  });

  it('is read-only with no actions (the expanded receipt, Slice 5)', () => {
    render(
      <WorkshopMemoryCard heading="Saved to project memory" kind="canon" title="The Cat" summary="Always already there." body="" />
    );
    expect(screen.getByRole('group', { name: 'Saved memory' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('never says pin', () => {
    const { container } = bubble(reply(PROPOSAL));
    expect(container.textContent?.toLowerCase()).not.toMatch(/\bpin/);
  });
});

describe('receipts', () => {
  it('a writer\'s save is a quiet divider line with no actions', () => {
    bubble(receiptTurn({ action: 'saved', memoryId: 'mem-7f3c2a', title: 'The watch', version: '0123456789ab', by: 'writer' }));
    const line = screen.getByRole('separator');
    expect(line.textContent).toBe('Saved to project memory: The watch');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('Save and tell me\'s receipt names the persona and carries Edit · Forget', () => {
    const memory = controls();
    bubble(receiptTurn({ action: 'saved', memoryId: 'mem-7f3c2a', title: 'The watch', version: '0123456789ab', by: 'auto', proposedBy: 'jill' }), memory);
    const receipt = screen.getByRole('group', { name: 'Saved to project memory: The watch (mem-7f3c2a).' });
    expect(receipt.textContent).toContain('Jill saved to project memory: The watch');
    expect(screen.queryByRole('separator')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forget' }));
    expect(memory.onEditMemory).toHaveBeenCalledWith('mem-7f3c2a');
    expect(memory.onForget).toHaveBeenCalledWith('mem-7f3c2a', 'turn-5-system-1010');
  });

  it('Forget\'s receipt says it is archived, not deleted, and offers Restore', () => {
    const memory = controls();
    bubble(receiptTurn({ action: 'forgotten', memoryId: 'mem-7f3c2a', title: 'The watch', version: '0123456789ab', by: 'writer' }), memory);
    expect(screen.getByRole('group').textContent).toContain('Forgotten from project memory: The watch. It\'s archived, not deleted.');
    expect(screen.queryByRole('separator')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(memory.onRestore).toHaveBeenCalledWith('mem-7f3c2a', 'turn-5-system-1010');
  });
});

describe('Save to memory…', () => {
  it('appears on a persona reply and a writer message, after Bookmark, and opens the sheet with the turn', () => {
    const memory = controls();
    bubble(reply(), memory);
    fireEvent.click(screen.getByRole('button', { name: 'Save to memory…' }));
    expect(memory.onSaveTurn).toHaveBeenCalledWith(expect.objectContaining({ id: 'turn-4-assistant-1008' }));

    bubble({ ...reply(), id: 'turn-3-user-1006', role: 'user', participant: 'writer', personaId: undefined, content: 'So it\'s settled.' }, memory);
    expect(screen.getAllByRole('button', { name: 'Save to memory…' })).toHaveLength(2);
  });

  it('is not offered on a divider, and is disabled while the room is busy', () => {
    const { unmount } = bubble({ ...receiptTurn({ action: 'saved', memoryId: 'mem-7f3c2a', title: 'T', version: '0123456789ab', by: 'writer' }) });
    expect(screen.queryByRole('button', { name: 'Save to memory…' })).toBeNull();
    unmount();
    bubble(reply(), controls({ disabled: true }));
    expect((screen.getByRole('button', { name: 'Save to memory…' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
