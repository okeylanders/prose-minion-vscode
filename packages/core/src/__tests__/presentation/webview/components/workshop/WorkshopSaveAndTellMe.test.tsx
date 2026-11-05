/**
 * @jest-environment jsdom
 */

/**
 * Save and tell me in the thread (Slice 0d, "In the thread", items 3–4 and
 * decision 13; ADR 2026-11-04 D7, D8; epic Slice 5):
 *
 * - the held card, under an amber border, with the host's reason and the
 *   suggestion's buttons;
 * - a reply whose card was saved shows nothing under it: its receipt
 *   carries it;
 * - the receipt keeps Edit · Forget, and its chevron expands the saved card,
 *   read only, collapsed by default, with `aria-expanded` and
 *   `aria-controls`. *Alice*.
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('marked', () => {
  const marked = Object.assign(jest.fn((content: string) => content), { setOptions: jest.fn() });
  return { marked };
});

import type { WorkshopMemoryProposal, WorkshopProjectMemoryReceipt, WorkshopTurn } from '@messages';
import { WorkshopTurnBubble } from '@components/workshop/WorkshopTurnBubble';
import type { WorkshopTurnMemoryControls } from '@components/workshop/memory/WorkshopTurnMemory';
import { workshopAutoSavedMemories } from '@hooks/domain/workshop/memory/workshopMemoryAutoReceipts';

const BODY = 'Jill and I agreed the Cat\'s arrivals are never shown.';
const PROPOSAL: WorkshopMemoryProposal = {
  proposes: 'new',
  title: 'The Cheshire Cat is never seen arriving',
  kind: 'canon',
  summary: 'It is always already there.',
  body: BODY,
  supersedes: [{ id: 'mem-1a9e04', title: 'The Cat fades in from the grin' }],
  state: 'pending'
};

const reply = (proposal: WorkshopMemoryProposal): WorkshopTurn => ({
  id: 'turn-4-assistant-1008',
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  excerptVersion: 1,
  content: 'And the Cat never arrives on the page.',
  timestamp: 1,
  memoryProposals: [proposal]
});

const RECEIPT: WorkshopProjectMemoryReceipt = {
  action: 'saved', memoryId: 'mem-7f3c2a', title: PROPOSAL.title, version: '0123456789ab', by: 'auto', proposedBy: 'jill'
};

const receiptTurn = (receipt: WorkshopProjectMemoryReceipt = RECEIPT): WorkshopTurn => ({
  id: 'turn-5-system-1010',
  role: 'system',
  kind: 'divider',
  participant: 'session',
  artifact: 'memory_receipt',
  excerptVersion: 1,
  content: `Jill saved to project memory: ${receipt.title} (${receipt.memoryId}).`,
  timestamp: 2,
  projectMemoryReceipt: receipt
});

const SAVED = reply({ ...PROPOSAL, state: 'saved', memoryId: 'mem-7f3c2a' });

const controls = (turns: WorkshopTurn[] = [], overrides: Partial<WorkshopTurnMemoryControls> = {}): WorkshopTurnMemoryControls => ({
  disabled: false,
  autoSaved: workshopAutoSavedMemories(turns),
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

const bubble = (turn: WorkshopTurn, memory: WorkshopTurnMemoryControls) => render(
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

describe('the held card', () => {
  it('web research: "Held for you to decide", the reason that claims no search, and Save · Edit… · Dismiss', () => {
    const memory = controls();
    bubble(reply({ ...PROPOSAL, held: 'web-research' }), memory);
    const card = screen.getByRole('group', { name: 'Suggested memory, held for you' });
    expect(card.className).toContain('pm-ws-memory-card-held');
    expect(card.textContent).toContain('Held for you to decide');
    expect(card.textContent).toContain('Live web research was available for this reply, so this memory waits for you to save it.');
    expect(card.textContent).not.toContain('Saved to this project only.');
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    expect(memory.onSaveCard).toHaveBeenCalledWith('turn-4-assistant-1008', 0);
    expect(screen.getByRole('button', { name: 'Edit…' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
  });

  it('the room\'s cap: the room-wide limit, naming no persona', () => {
    bubble(reply({ ...PROPOSAL, held: 'room-cap' }), controls());
    const card = screen.getByRole('group', { name: 'Suggested memory, held for you' });
    expect(card.textContent).toContain('This conversation has reached its limit of 5 automatic memory saves. This one waits for you.');
    expect(card.textContent?.replace('Jill and I', '')).not.toContain('Jill');
  });

  it('once the writer saves it, it settles like any saved card', () => {
    bubble(reply({ ...PROPOSAL, held: 'web-research', state: 'saved', memoryId: 'mem-7f3c2a' }), controls());
    expect(screen.getByText(/Saved to project memory:/)).toBeTruthy();
  });
});

describe('Save and tell me\'s receipt', () => {
  const turns = [SAVED, receiptTurn()];

  it('the reply it saved shows no settled line: the receipt carries it', () => {
    const { container } = bubble(SAVED, controls(turns));
    expect(container.textContent).not.toContain('Saved to project memory');
    expect(screen.queryByRole('group', { name: /memory/ })).toBeNull();
  });

  it('a writer\'s save of the same card still settles in place', () => {
    bubble(SAVED, controls([SAVED, receiptTurn({ ...RECEIPT, by: 'writer' })]));
    expect(screen.getByText(/Saved to project memory:/)).toBeTruthy();
  });

  it('is collapsed by default, keeps Edit · Forget, and expands to the saved card, read only', () => {
    const memory = controls(turns);
    const { container } = bubble(receiptTurn(), memory);
    const expand = screen.getByRole('button', { name: 'Show the saved memory' });
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    const controlled = expand.getAttribute('aria-controls')!;
    const region = container.querySelector(`#${controlled}`) as HTMLElement;
    expect(region).toBeTruthy();
    expect(region.hidden).toBe(true);
    expect(screen.queryByRole('group', { name: 'Saved memory' })).toBeNull();
    const receipt = screen.getByRole('group', { name: 'Jill saved to project memory: The Cheshire Cat is never seen arriving (mem-7f3c2a).' });
    expect(receipt.contains(expand)).toBe(true);
    expect(receipt.textContent).toContain('Jill saved to project memory: The Cheshire Cat is never seen arriving');
    expect(screen.queryByRole('separator')).toBeNull();

    fireEvent.click(expand);
    const opened = screen.getByRole('button', { name: 'Hide the saved memory' });
    expect(opened.getAttribute('aria-expanded')).toBe('true');
    expect(region.hidden).toBe(false);
    const card = screen.getByRole('group', { name: 'Saved memory' });
    expect(region.contains(card)).toBe(true);
    expect(card.textContent).toContain('Saved to project memory');
    expect(card.textContent).toContain('canon');
    expect(card.textContent).toContain('It is always already there.');
    expect(card.textContent).toContain('Replaces The Cat fades in from the grin, which stays searchable.');
    expect(screen.getByText('Full note')).toBeTruthy();
    for (const name of [/^Save$/, 'Edit…', 'Dismiss']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forget' }));
    expect(memory.onEditMemory).toHaveBeenCalledWith('mem-7f3c2a');
    expect(memory.onForget).toHaveBeenCalledWith('mem-7f3c2a');

    fireEvent.click(opened);
    expect(screen.getByRole('button', { name: 'Show the saved memory' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('group', { name: 'Saved memory' })).toBeNull();
  });

  it('offers no expand when the card it came from isn\'t in the thread, and none on a writer\'s receipt', () => {
    const { unmount } = bubble(receiptTurn(), controls([receiptTurn()]));
    expect(screen.queryByRole('button', { name: 'Show the saved memory' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Forget' })).toBeTruthy();
    unmount();
    const writer = receiptTurn({ ...RECEIPT, by: 'writer' });
    bubble(writer, controls([SAVED, writer]));
    expect(screen.queryByRole('button', { name: 'Show the saved memory' })).toBeNull();
  });
});

describe('workshopAutoSavedMemories', () => {
  it('maps each automatic receipt to the saved card it names, and nothing else', () => {
    const forgotten = { ...receiptTurn({ ...RECEIPT, action: 'forgotten', by: 'writer' }), id: 'turn-6-system-1012' };
    const result = workshopAutoSavedMemories([SAVED, receiptTurn(), forgotten]);
    expect([...result.cards.keys()]).toEqual(['turn-5-system-1010']);
    expect(result.cards.get('turn-5-system-1010')).toBe(SAVED.memoryProposals![0]);
    expect([...result.cardKeys]).toEqual([`${SAVED.id}#0`]);
    expect(workshopAutoSavedMemories([reply(PROPOSAL)]).cards.size).toBe(0);
  });
});
