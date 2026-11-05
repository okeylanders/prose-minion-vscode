/**
 * @jest-environment jsdom
 */

/**
 * The edit card (epic Slice 6c): what changes, as before → after; the
 * note's changed region with a little context, collapsed when long; Save ·
 * Edit… · Dismiss; held; stale with Dismiss alone. And the sheet, filled
 * with the result. *Alice*.
 */

import * as React from 'react';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import type { WorkshopMemoryEditProposal, WorkshopTurn } from '@messages';
import { MessageType } from '@messages';
import { WorkshopTurnBubble } from '@components/workshop/WorkshopTurnBubble';
import type { WorkshopTurnMemoryControls } from '@components/workshop/memory/WorkshopTurnMemory';
import { bodyChange, CONTEXT_CHARACTERS, LONG_CHARACTERS, workshopMemoryEditView } from '@hooks/domain/workshop/memory/workshopMemoryEditView';
import { useWorkshopProjectMemory } from '@hooks/domain/workshop/useWorkshopProjectMemory';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi', () => ({ useVSCodeApi: jest.fn() }));

const BEFORE = {
  title: 'The Rabbit\'s watch runs backward',
  kind: 'canon' as const,
  summary: 'From chapter 3 on, the White Rabbit\'s watch runs backward.',
  body: 'Settled at the tea party. The reader notices before Alice does. Nobody remarks on it.'
};
const EDIT: WorkshopMemoryEditProposal = {
  proposes: 'edit',
  ...BEFORE,
  summary: 'From chapter 2 on, the White Rabbit\'s watch runs backward.',
  body: 'Settled at the tea party. Alice notices first. Nobody remarks on it.',
  state: 'pending',
  target: {
    id: 'mem-7f3c2a',
    token: '0123456789ab',
    pinned: true,
    supersedes: ['mem-1a9e04', 'mem-0e0e0e'],
    replaces: [{ id: 'mem-1a9e04', title: 'The watch stops at six' }]
  },
  before: BEFORE
};

const reply = (proposal: WorkshopMemoryEditProposal): WorkshopTurn => ({
  id: 'turn-4-assistant-1008', role: 'assistant', kind: 'message', participant: 'host', artifact: 'persona_message',
  personaId: 'jill', personaLabel: 'Jill', excerptVersion: 1, content: 'Good.', timestamp: 1, memoryProposals: [proposal]
});

const controls = (overrides: Partial<WorkshopTurnMemoryControls> = {}): WorkshopTurnMemoryControls => ({
  disabled: false, busyCards: new Set(), cardErrors: new Map(), onSaveCard: jest.fn(), onEditCard: jest.fn(),
  onDismissCard: jest.fn(), onReopenCard: jest.fn(), onSaveTurn: jest.fn(), onEditMemory: jest.fn(), onForget: jest.fn(),
  onRestore: jest.fn(), ...overrides
});

const bubble = (turn: WorkshopTurn, memory = controls()) => render(
  <WorkshopTurnBubble turn={turn} quickActionToolId={null} onQuickAction={jest.fn()} onTalkDirectly={jest.fn()} onCopy={jest.fn()} onSave={jest.fn()} memory={memory} />
);

describe('what an edit card shows', () => {
  it('each changed field as before → after, and the note\'s changed region in context', () => {
    const view = workshopMemoryEditView(EDIT, (kind) => kind);
    expect(view.fields).toEqual([{ field: 'summary', label: 'Summary', before: BEFORE.summary, after: EDIT.summary }]);
    expect(view.body).toEqual({
      lead: 'Settled at the tea party. ',
      removed: 'The reader notices before Alice does',
      added: 'Alice notices first',
      trail: '. Nobody remarks on it.',
      long: false
    });
  });

  it('cuts long shared context at a word, and marks a long change to collapse', () => {
    const shared = 'Alice walked on through the long hall of doors. '.repeat(6);
    const change = bodyChange(`${shared}Old.${shared}`, `${shared}New.${shared}`);
    expect(change.lead.startsWith('…')).toBe(true);
    expect(change.lead.length).toBeLessThanOrEqual(CONTEXT_CHARACTERS + 1);
    expect(change.trail.endsWith('…')).toBe(true);
    expect(change.removed).toBe('Old');
    expect(bodyChange('a', `a${'b'.repeat(LONG_CHARACTERS + 1)}`).long).toBe(true);
  });

  it('cuts its context on whole characters too (PR #212 F-05)', () => {
    const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    const leading = '\u{1F600}'.repeat(41) + 'x';
    const lead = bodyChange(`${leading}A`, `${leading}B`).lead;
    expect(lead).not.toMatch(lone);
    const trailing = 'x' + '\u{1F600}'.repeat(41);
    const trail = bodyChange(`A${trailing}`, `B${trailing}`).trail;
    expect(trail).not.toMatch(lone);
    expect(lead.length).toBeGreaterThan(70);
    expect(trail.length).toBeGreaterThan(70);
  });

  it('never splits a character in two', () => {
    const change = bodyChange('Tea \u{1F375} at six', 'Tea \u{1F36A} at six');
    expect(change.removed).toBe('\u{1F375}');
    expect(change.added).toBe('\u{1F36A}');
  });
});

describe('the edit card', () => {
  it('names the memory it changes, and offers Save · Edit… · Dismiss by the card\'s index', () => {
    const memory = controls();
    bubble(reply(EDIT), memory);
    const card = screen.getByRole('group', { name: 'Suggested change' });
    expect(card.textContent).toContain('Suggested change to project memory');
    expect(card.textContent).toContain(BEFORE.title);
    expect(within(card).getByText(BEFORE.summary).tagName).toBe('DEL');
    expect(within(card).getByText(EDIT.summary).tagName).toBe('INS');
    expect(within(card).getByText('The reader notices before Alice does').tagName).toBe('DEL');
    expect(within(card).getByText('Alice notices first').tagName).toBe('INS');
    fireEvent.click(within(card).getByRole('button', { name: /^Save$/ }));
    fireEvent.click(within(card).getByRole('button', { name: 'Edit…' }));
    fireEvent.click(within(card).getByRole('button', { name: 'Dismiss' }));
    expect(memory.onSaveCard).toHaveBeenCalledWith('turn-4-assistant-1008', 0);
    expect(memory.onEditCard).toHaveBeenCalledWith(expect.objectContaining({ id: 'turn-4-assistant-1008' }), 0);
    expect(memory.onDismissCard).toHaveBeenCalledWith('turn-4-assistant-1008', 0);
  });

  it('collapses a long change to the note', () => {
    bubble(reply({ ...EDIT, summary: BEFORE.summary, body: `${BEFORE.body}\n\n${'Alice runs on. '.repeat(60)}` }));
    expect(screen.getByText('Changes to the note').closest('details')).toBeTruthy();
  });

  it('held under Save and tell me, it says an edit always waits', () => {
    bubble(reply({ ...EDIT, held: 'edit' }));
    const card = screen.getByRole('group', { name: 'Suggested change, held for you' });
    expect(card.textContent).toContain('It changes a saved memory, so it waits for you to save it.');
  });

  it('stale: says the note changed, and offers Dismiss alone', () => {
    bubble(reply({ ...EDIT, stale: true }));
    const card = screen.getByRole('group', { name: 'Suggested change, out of date' });
    expect(within(card).getByRole('alert').textContent).toBe('This note changed since it was suggested, so nothing was saved.');
    expect(within(card).queryByRole('button', { name: /^Save$/ })).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Edit…' })).toBeNull();
    expect(within(card).getByRole('button', { name: 'Dismiss' })).toBeTruthy();
  });

  it('settles as "Updated in project memory" once saved, and as a dismissed change', () => {
    const { unmount } = bubble(reply({ ...EDIT, state: 'saved', memoryId: 'mem-7f3c2a' }));
    expect(screen.getByText(/Updated in project memory/)).toBeTruthy();
    unmount();
    bubble(reply({ ...EDIT, state: 'dismissed' }));
    expect(screen.getByText(/The change to/).textContent).toContain(BEFORE.title);
  });
});

describe('the sheet from an edit card', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (useVSCodeApi as jest.Mock).mockReturnValue(createMockVSCode());
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens filled with the result, keeps what the note replaces and loads in full, and saves by index', () => {
    const vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const { result } = renderHook(() => useWorkshopProjectMemory());
    act(() => result.current.editCard(reply(EDIT), 0));
    expect(result.current.sheet).toMatchObject({
      mode: 'card',
      memoryId: 'mem-7f3c2a',
      proposalIndex: 0,
      // Every id the note supersedes, the unlisted one too (PR #212 F-01); titles only for those listed.
      draft: { title: EDIT.title, kind: 'canon', summary: EDIT.summary, body: EDIT.body, supersedes: ['mem-1a9e04', 'mem-0e0e0e'], pinned: true },
      replaces: [{ id: 'mem-1a9e04', title: 'The watch stops at six' }]
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });
    const posted = vscode.postMessage.mock.calls.map(([sent]: [{ type: MessageType; payload: Record<string, unknown> }]) => sent);
    expect(posted.find((sent) => sent.type === MessageType.WORKSHOP_MEMORY_ESTIMATE)?.payload).toMatchObject({ memoryId: 'mem-7f3c2a' });
    act(() => result.current.submitSheet());
    expect(vscode.postMessage.mock.calls.at(-1)[0].payload).toMatchObject({ turnId: 'turn-4-assistant-1008', index: 0, action: 'save', edited: { body: EDIT.body } });
  });

  it('a stale edit opens no sheet', () => {
    const { result } = renderHook(() => useWorkshopProjectMemory());
    act(() => result.current.editCard(reply({ ...EDIT, stale: true }), 0));
    expect(result.current.sheet).toBeNull();
  });
});
