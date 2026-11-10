/**
 * @jest-environment jsdom
 */

/**
 * A chip per alternative version (ADR 2026-11-10, second addendum; epic
 * Slice 3b), through the real bubble: the fixes chip first, then one chip
 * per option labeled with the option's own words; each with its own status,
 * waiting reason, accessible name and one stable node; a press that names
 * its option. An offer without options keeps its one chip. *Alice*.
 */

import * as React from 'react';
import { fireEvent, render, within } from '@testing-library/react';

jest.mock('marked', () => {
  const marked = Object.assign(jest.fn((content: string) => content), { setOptions: jest.fn() });
  return { marked };
});

import type { WorkshopEditOffer, WorkshopEditOfferStatus, WorkshopTurn } from '@messages';
import { WorkshopTurnBubble } from '@components/workshop/WorkshopTurnBubble';
import type { WorkshopEditOfferControls } from '@components/workshop/editOffers/WorkshopEditOfferChip';
import { workshopEditOfferRefusalWords } from '@shared/constants/workshopEditOfferWords';

const PATH = 'chapters/down-the-rabbit-hole.md';
const LABELS = ['Version 1', 'Version 2', 'A third option'];
const OPEN: WorkshopEditOfferStatus = { state: 'open' };

const reply = (editOffers: WorkshopEditOffer[]): WorkshopTurn => ({
  id: 'turn-2',
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  content: 'One slip, and three ways the Rabbit\'s line could go.',
  timestamp: 2,
  excerptVersion: 0,
  editOffers
});

const fixes: WorkshopEditOffer = { kind: 'fixes', count: 1, target: { kind: 'file', relativePath: PATH }, status: OPEN };
const versions = (statuses: WorkshopEditOfferStatus[] = [OPEN, OPEN, OPEN]): WorkshopEditOffer =>
  ({ kind: 'rewrites', target: { kind: 'file', relativePath: PATH }, options: LABELS, optionStatuses: statuses });

const controls = (change: Partial<WorkshopEditOfferControls> = {}): WorkshopEditOfferControls => ({
  running: false,
  locked: false,
  askingOffers: new Set(),
  offerFeedback: new Map(),
  onAsk: jest.fn(),
  onGoToTurn: jest.fn(),
  ...change
});

const bubble = (turn: WorkshopTurn, offers: WorkshopEditOfferControls) => (
  <WorkshopTurnBubble
    turn={turn}
    quickActionToolId={null}
    onQuickAction={jest.fn()}
    onTalkDirectly={jest.fn()}
    onCopy={jest.fn()}
    onSave={jest.fn()}
    editOffers={offers}
  />
);

const chips = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.pm-ws-offer-group [data-pm-offer]'));
const option = (index: number) => document.querySelector<HTMLButtonElement>(`[data-pm-offer="rewrites"][data-pm-offer-option="${index}"]`)!;
const description = (element: HTMLElement) => document.getElementById(element.getAttribute('aria-describedby') ?? '')?.textContent;

describe('a chip per alternative version', () => {
  it('draws the fixes chip, then one chip per option in the order declared, whatever order the offers came in', () => {
    render(bubble(reply([versions(), fixes]), controls()));
    expect(chips().map((chip) => [chip.dataset.pmOffer, chip.dataset.pmOfferOption, chip.textContent])).toEqual([
      ['fixes', undefined, '1 fix'],
      ['rewrites', '0', 'Version 1'],
      ['rewrites', '1', 'Version 2'],
      ['rewrites', '2', 'A third option']
    ]);
    const group = document.querySelector<HTMLElement>('.pm-ws-offer-group')!;
    expect(group.getAttribute('aria-label')).toBe('Edits Jill can suggest from this reply');
    expect(within(group).getByRole('button', { name: `Version 1. Ask Jill to suggest it as an edit to ${PATH}.` })).toBe(option(0));
    expect(within(group).getByRole('button', { name: `A third option. Ask Jill to suggest it as an edit to ${PATH}.` })).toBe(option(2));
  });

  it('keeps one "N rewrites" chip for an offer without options', () => {
    render(bubble(reply([fixes, { kind: 'rewrites', count: 2, target: { kind: 'file', relativePath: PATH }, status: OPEN }]), controls()));
    expect(chips().map((chip) => [chip.dataset.pmOfferOption, chip.textContent])).toEqual([[undefined, '1 fix'], [undefined, '2 rewrites']]);
  });

  it('shows a label as text, never as markup', () => {
    const offer: WorkshopEditOffer = { ...versions([OPEN]), options: ['<b>Bold</b> & *loud*'], optionStatuses: [OPEN] };
    render(bubble(reply([offer]), controls()));
    expect(option(0).textContent).toBe('<b>Bold</b> & *loud*');
    expect(option(0).querySelector('b')).toBeNull();
  });

  it('presses with the turn, the kind and the option\'s index', () => {
    const offers = controls();
    render(bubble(reply([fixes, versions()]), offers));
    fireEvent.click(option(1));
    expect(offers.onAsk).toHaveBeenCalledTimes(1);
    expect(offers.onAsk).toHaveBeenCalledWith('turn-2', 'rewrites', 1);
  });

  it('gives each option its own five faces, and one node that keeps focus through them', () => {
    const offers = controls();
    const view = render(bubble(reply([fixes, versions()]), offers));
    const node = option(1);
    node.focus();
    const show = (statuses: WorkshopEditOfferStatus[], change: Partial<WorkshopEditOfferControls> = {}) =>
      view.rerender(bubble(reply([fixes, versions(statuses)]), { ...offers, ...change }));

    // Asked by this webview's own press: only that option's chip.
    show([OPEN, OPEN, OPEN], { askingOffers: new Set(['turn-2#rewrites#1']) });
    expect(option(1)).toBe(node);
    expect(node.textContent).toBe('Asking Jill for Version 2…');
    expect(node.getAttribute('aria-busy')).toBe('true');
    expect(node.getAttribute('aria-disabled')).toBe('true');
    expect(option(0).textContent).toBe('Version 1');
    expect(option(0).getAttribute('aria-busy')).toBeNull();

    // Asked, by the host's word.
    show([OPEN, { state: 'asked' }, OPEN]);
    expect(node.className).toBe('pm-ws-offer pm-ws-offer-asked');

    // Answered: goes to the answer; its siblings still ask.
    show([OPEN, { state: 'answered', answerTurnId: 'turn-9', cards: 1, changes: 1, askAgain: false }, OPEN]);
    expect(option(1)).toBe(node);
    expect(document.activeElement).toBe(node);
    expect(node.textContent).toBe('Version 2 suggested');
    expect(node.getAttribute('aria-label')).toBe('Version 2 suggested. Go to the edits.');
    fireEvent.click(node);
    expect(offers.onGoToTurn).toHaveBeenCalledWith('turn-9');
    fireEvent.click(option(2));
    expect(offers.onAsk).toHaveBeenCalledWith('turn-2', 'rewrites', 2);

    show([OPEN, { state: 'nothing-to-change', answerTurnId: 'turn-9', askAgain: true }, OPEN]);
    expect(node.textContent).toBe('Version 2 · nothing to change · ask again');
    expect(node.getAttribute('aria-label')).toBe(`Version 2, nothing to change, ask again. Ask Jill again to suggest it as an edit to ${PATH}.`);

    show([OPEN, { state: 'ask-again', answerTurnId: 'turn-9', cards: 1, changes: 1, askAgain: true }, OPEN]);
    expect(node.textContent).toBe('Version 2 · ask again');
    fireEvent.click(node);
    expect(offers.onAsk).toHaveBeenLastCalledWith('turn-2', 'rewrites', 1);
    expect(option(1)).toBe(node);
    expect(document.activeElement).toBe(node);
  });

  it('waits per option, with the reason as its description: a run, the lock, the author who left', () => {
    const offers = controls({ running: true });
    const view = render(bubble(reply([versions([OPEN, { state: 'answered', answerTurnId: 'turn-9', cards: 1, changes: 1, askAgain: false }, OPEN])]), offers));
    expect(option(0).getAttribute('aria-disabled')).toBe('true');
    expect(description(option(0))).toBe(workshopEditOfferRefusalWords('run-active'));
    fireEvent.click(option(0));
    expect(offers.onAsk).not.toHaveBeenCalled();
    // A chip that goes to its answer never waits.
    expect(option(1).getAttribute('aria-disabled')).toBeNull();

    view.rerender(bubble(reply([versions()]), { ...offers, running: false, locked: true }));
    expect(description(option(2))).toBe(workshopEditOfferRefusalWords('session-operation'));

    view.rerender(bubble(reply([versions([OPEN, { state: 'open', blocked: 'author-left' }, OPEN])]), { ...offers, running: false }));
    expect(description(option(1))).toBe('Jill isn’t in this room now');
    expect(option(0).getAttribute('aria-describedby')).toBeNull();
  });

  it('holds a refusal\'s words on the one option pressed', () => {
    render(bubble(reply([versions()]), controls({ offerFeedback: new Map([['turn-2#rewrites#2', 'The request failed, so nothing was suggested. Try again.']]) })));
    expect(description(option(2))).toBe('The request failed, so nothing was suggested. Try again.');
    expect(option(0).getAttribute('aria-describedby')).toBeNull();
  });
});
