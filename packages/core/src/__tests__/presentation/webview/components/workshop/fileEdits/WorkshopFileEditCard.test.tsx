/**
 * @jest-environment jsdom
 */

/**
 * File-edit cards in the thread (ADR 2026-11-05 D8, D9; epic Slice 4b):
 * every state in the host's words, actions only while pending (no blind
 * retry), busy as `aria-busy`, a `role=status` line, buttons named with
 * their file, focus kept after an action, a rewrite's preview (stale
 * included), and no `documentUri` in the tree. *Alice*.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

jest.mock('marked', () => {
  const marked = Object.assign(jest.fn((content: string) => content), { setOptions: jest.fn() });
  return { marked };
});

import { WORKSHOP_FILE_EDIT_STATES, type WorkshopFileEditProposal, type WorkshopTurn } from '@messages';
import { workshopFileEditCardWords } from '@shared/constants/workshopFileEditWords';
import { WorkshopFileEditCard, type WorkshopFileEditControls } from '@components/workshop/fileEdits/WorkshopFileEditCard';
import { WorkshopTurnBubble } from '@components/workshop/WorkshopTurnBubble';
import type { WorkshopFileEditPreviewView } from '@hooks/domain/workshop/useWorkshopFileEdits';

const TURN = 'turn-4-assistant-1008';
const PATH = 'chapters/one.md';

const card = (change: Partial<WorkshopFileEditProposal> = {}): WorkshopFileEditProposal => ({
  requested: { kind: 'resource', group: 'chapters', path: PATH },
  target: { kind: 'file', relativePath: PATH },
  class: 'prose',
  operations: [{ op: 'replace', find: 'Alice ran down the hall.', with: 'Alice walked down the hall.' }],
  why: 'Slow the chase before the fall.',
  baseline: { sha256: 'a'.repeat(64), length: 1200 },
  state: 'pending',
  ...change
});

const rewriteCard = (change: Partial<WorkshopFileEditProposal> = {}) => card({
  target: { kind: 'file', relativePath: 'notes/cast.md' },
  class: 'notes',
  operations: [{ op: 'rewrite', text: 'Cast: Alice, the White Rabbit.' }],
  why: 'Add the Rabbit to the cast list.',
  ...change
});

const controls = (change: Partial<WorkshopFileEditControls> = {}): WorkshopFileEditControls => ({
  disabled: false,
  busyCards: new Set(),
  cardFeedback: new Map(),
  previews: new Map(),
  onApply: jest.fn(),
  onReview: jest.fn(),
  onDecline: jest.fn(),
  onRequestPreview: jest.fn(),
  ...change
});

const draw = (proposal: WorkshopFileEditProposal, given = controls()) =>
  render(<WorkshopFileEditCard turnId={TURN} index={0} proposal={proposal} controls={given} />);

describe('WorkshopFileEditCard', () => {
  it('shows the display path, its class, the why and the replace as a word diff', () => {
    const { container } = draw(card());
    const group = screen.getByRole('group', { name: `Suggested edit to ${PATH}` });
    expect(within(group).getByText(PATH)).toBeTruthy();
    expect(within(group).getByText('chapter')).toBeTruthy();
    expect(within(group).getByText('Slow the chase before the fall.')).toBeTruthy();
    expect(container.querySelector('del')?.textContent).toBe('removed: ran');
    expect(container.querySelector('ins')?.textContent).toBe('added: walked');
  });

  it('shows an append and a prepend as the text they add', () => {
    draw(card({ operations: [{ op: 'append', text: 'The Rabbit was late.' }, { op: 'prepend', text: 'Chapter One.' }] }));
    expect(screen.getByText('Add at the end')).toBeTruthy();
    expect(screen.getByText('The Rabbit was late.').tagName).toBe('INS');
    expect(screen.getByText('Add at the start')).toBeTruthy();
    expect(screen.getByText('Chapter One.').tagName).toBe('INS');
  });

  it('a pending card offers Apply, Review in editor… and Decline, named with its file', () => {
    const given = controls();
    draw(card(), given);
    fireEvent.click(screen.getByRole('button', { name: `Apply, edit to ${PATH}` }));
    fireEvent.click(screen.getByRole('button', { name: `Review in editor, edit to ${PATH}` }));
    fireEvent.click(screen.getByRole('button', { name: `Decline, edit to ${PATH}` }));
    expect(given.onApply).toHaveBeenCalledWith(TURN, 0);
    expect(given.onReview).toHaveBeenCalledWith(TURN, 0);
    expect(given.onDecline).toHaveBeenCalledWith(TURN, 0);
    expect(screen.getByRole('status').textContent).toBe(workshopFileEditCardWords('pending'));
  });

  it.each(WORKSHOP_FILE_EDIT_STATES.filter((state) => state !== 'pending'))('a %s card reads in the host\'s words and offers no action', (state) => {
    draw(card({ state, ...(state === 'stale' ? { reason: 'baseline-changed' } : {}) }));
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('status').textContent)
      .toBe(workshopFileEditCardWords(state, state === 'stale' ? 'baseline-changed' : undefined));
  });

  it('a refused card names its reason in the host\'s words', () => {
    draw(card({ target: undefined, class: undefined, baseline: undefined, state: 'refused', reason: 'not-configured' }));
    expect(screen.getByRole('status').textContent).toBe(workshopFileEditCardWords('refused', 'not-configured'));
    expect(screen.queryByText('chapter')).toBeNull();
  });

  it('an applied card shows what landed; a partial one, by operation', () => {
    const { unmount } = draw(card({ state: 'applied', outcomes: ['landed'] }));
    expect(screen.getByText('Applied', { selector: '.pm-ws-file-edit-outcome' })).toBeTruthy();
    unmount();

    draw(card({
      operations: [
        { op: 'replace', find: 'Alice ran', with: 'Alice walked' },
        { op: 'append', text: 'The Rabbit was late.' }
      ],
      state: 'partial',
      reason: 'changed',
      outcomes: ['landed', 'not-applied']
    }));
    const outcomes = [...document.querySelectorAll('.pm-ws-file-edit-outcome')].map((each) => each.textContent);
    expect(outcomes).toEqual(['Applied', 'Not applied']);
    expect(screen.getByText('1 of 2 changes applied.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(workshopFileEditCardWords('partial', 'changed'));
  });

  it('an unknown card says so by operation and offers no second Apply', () => {
    draw(card({ state: 'unknown', reason: 'applying-on-reopen', outcomes: ['unknown'] }));
    expect(screen.getByText('Not known')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Apply/u })).toBeNull();
  });

  it('a card whose request is out is aria-busy, and its buttons press nothing', () => {
    const given = controls({ busyCards: new Set([`${TURN}#0`]) });
    draw(card(), given);
    expect(screen.getByRole('group').getAttribute('aria-busy')).toBe('true');
    const apply = screen.getByRole('button', { name: `Apply, edit to ${PATH}` });
    expect(apply.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(apply);
    expect(given.onApply).not.toHaveBeenCalled();
  });

  it('an applying card is aria-busy and says so', () => {
    draw(card({ state: 'applying' }));
    expect(screen.getByRole('group').getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Applying…');
  });

  it('a locked room disables the buttons, and says why when a reply runs', () => {
    draw(card(), controls({ disabled: true, disabledReason: 'Apply after the current reply finishes.' }));
    expect((screen.getByRole('button', { name: `Apply, edit to ${PATH}` }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Apply after the current reply finishes.')).toBeTruthy();
  });

  it('an answer that left the card pending is read out in the status line', () => {
    draw(card(), controls({ cardFeedback: new Map([[`${TURN}#0`, { answer: 'refused', message: 'The session could not be saved before the change, so nothing changed. Try again.' }]]) }));
    expect(screen.getByRole('status').textContent).toBe('The session could not be saved before the change, so nothing changed. Try again.');
  });

  it('a settled card does not show an answer meant for its pending self', () => {
    draw(card({ state: 'declined' }), controls({ cardFeedback: new Map([[`${TURN}#0`, { answer: 'refused', message: 'Old words.' }]]) }));
    expect(screen.getByRole('status').textContent).toBe(workshopFileEditCardWords('declined'));
  });

  it('when an action settles the card, focus moves to its status line', () => {
    const given = controls();
    const { rerender } = draw(card(), given);
    const decline = screen.getByRole('button', { name: `Decline, edit to ${PATH}` });
    decline.focus();
    fireEvent.click(decline);
    rerender(<WorkshopFileEditCard turnId={TURN} index={0} proposal={card({ state: 'declined' })} controls={given} />);
    expect(document.activeElement).toBe(screen.getByRole('status'));
  });

  it('a state change it did not act on leaves focus where it is', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    const given = controls();
    const { rerender } = draw(card(), given);
    rerender(<WorkshopFileEditCard turnId={TURN} index={0} proposal={card({ state: 'stale', reason: 'baseline-changed' })} controls={given} />);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  describe('a rewrite', () => {
    const open = () => {
      const details = document.querySelector('details') as HTMLDetailsElement;
      act(() => {
        details.open = true;
        details.dispatchEvent(new Event('toggle'));
      });
    };

    it('asks for its preview when opened, and shows before and after', () => {
      const given = controls();
      const { rerender } = draw(rewriteCard(), given);
      expect(screen.getByText('note')).toBeTruthy();
      expect(given.onRequestPreview).not.toHaveBeenCalled();
      open();
      expect(given.onRequestPreview).toHaveBeenCalledWith(TURN, 0);
      expect(screen.getByText('Reading the file…')).toBeTruthy();

      const previews = new Map<string, WorkshopFileEditPreviewView>([[`${TURN}#0`, { status: 'ready', before: 'Cast: Alice.', after: 'Cast: Alice, the White Rabbit.' }]]);
      rerender(<WorkshopFileEditCard turnId={TURN} index={0} proposal={rewriteCard()} controls={{ ...given, previews }} />);
      expect(screen.getByText('Before')).toBeTruthy();
      expect(screen.getByText('Cast: Alice.')).toBeTruthy();
      expect(screen.getByText('Cast: Alice, the White Rabbit.')).toBeTruthy();
    });

    it('shows the host\'s stale notice', () => {
      const message = workshopFileEditCardWords('stale', 'baseline-changed');
      draw(rewriteCard(), controls({ previews: new Map([[`${TURN}#0`, { status: 'stale', message }]]) }));
      expect(document.querySelector('.pm-ws-file-edit-note-stale')?.textContent).toBe(message);
    });

    it('once settled, shows what it replaced from its landed record, and asks for nothing', () => {
      const given = controls();
      draw(rewriteCard({
        state: 'applied',
        outcomes: ['landed'],
        landed: [{ operation: 0, before: 'Cast: Alice.', after: 'Cast: Alice, the White Rabbit.', contextBefore: '', contextAfter: '', versionAfter: 7 }]
      }), given);
      open();
      expect(screen.getByText('What it replaced')).toBeTruthy();
      expect(screen.getByText('Cast: Alice.')).toBeTruthy();
      expect(given.onRequestPreview).not.toHaveBeenCalled();
    });
  });

  it('never draws a documentUri, even one the view should not have carried', () => {
    const leaked = card({ target: { kind: 'file', relativePath: PATH, documentUri: 'file:///Users/alice/book/chapters/one.md' } });
    const { container } = draw(leaked);
    expect(container.innerHTML).not.toMatch(/file:|documentUri|Users\/alice/u);
  });

  it('a bubble draws its turn\'s cards under a count, each acting on its own index', () => {
    const given = controls();
    const turn: WorkshopTurn = {
      id: TURN,
      role: 'assistant',
      kind: 'message',
      participant: 'host',
      artifact: 'persona_message',
      personaId: 'jill',
      personaLabel: 'Jill',
      excerptVersion: 1,
      content: 'Two small changes.',
      timestamp: 1,
      fileEditProposals: [card(), rewriteCard({ state: 'declined' })]
    };
    render(<WorkshopTurnBubble turn={turn} quickActionToolId={null} onQuickAction={jest.fn()} onTalkDirectly={jest.fn()} onAddTodo={jest.fn()} onCopy={jest.fn()} onSave={jest.fn()} fileEdits={given} />);
    const stack = screen.getByRole('group', { name: '2 suggested edits' });
    expect(within(stack).getAllByRole('group', { name: /^Suggested edit to/u })).toHaveLength(2);
    expect(within(stack).getAllByRole('button', { name: /^Apply, edit to/u })).toHaveLength(1);
    fireEvent.click(within(stack).getByRole('button', { name: `Apply, edit to ${PATH}` }));
    expect(given.onApply).toHaveBeenCalledWith(TURN, 0);
  });
});
