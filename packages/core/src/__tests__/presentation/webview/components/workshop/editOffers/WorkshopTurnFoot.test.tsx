/**
 * @jest-environment jsdom
 */

/**
 * A reply's footer (ADR 2026-11-10 U1–U6; epic Slice 3), through the real
 * bubble: offers at the left and the reaction corner at the right in one
 * row; the widget chip moved in; a chip that keeps its node and its focus
 * across every status; waiting chips that stay focusable; the press's line
 * and the answer's line, cards and marks. *Alice*.
 */

import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

jest.mock('marked', () => {
  const marked = Object.assign(jest.fn((content: string) => content), { setOptions: jest.fn() });
  return { marked };
});

import type { WorkshopEditOffer, WorkshopEditOfferStatus, WorkshopFileEditProposal, WorkshopTurn } from '@messages';
import { WorkshopTurnBubble } from '@components/workshop/WorkshopTurnBubble';
import type { WorkshopEditOfferControls } from '@components/workshop/editOffers/WorkshopEditOfferChip';
import type { WorkshopFileEditControls } from '@components/workshop/fileEdits/WorkshopFileEditCard';
import type { WorkshopReactionControls } from '@components/workshop/reactions/WorkshopTurnReactions';
import { workshopEditOfferRefusalWords } from '@shared/constants/workshopEditOfferWords';

const PATH = 'chapters/down-the-rabbit-hole.md';
const GROUP = 'Edits Jill can suggest from this reply';

const reply = (change: Partial<WorkshopTurn> = {}): WorkshopTurn => ({
  id: 'turn-2',
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  content: 'Three slips first, and two lines I would rewrite.',
  timestamp: 2,
  excerptVersion: 0,
  ...change
});

const offer = (kind: WorkshopEditOffer['kind'], count: number, status: WorkshopEditOfferStatus = { state: 'open' }): WorkshopEditOffer =>
  ({ kind, count, target: { kind: 'file', relativePath: PATH }, status });

const offerControls = (change: Partial<WorkshopEditOfferControls> = {}): WorkshopEditOfferControls => ({
  running: false,
  locked: false,
  askingOffers: new Set(),
  offerFeedback: new Map(),
  onAsk: jest.fn(),
  onGoToTurn: jest.fn(),
  ...change
});

const reactionControls = (reactions: ReturnType<WorkshopReactionControls['reactionsOf']> = []): WorkshopReactionControls => ({
  reactionsOf: () => reactions,
  disabled: false,
  onSet: jest.fn(),
  onHide: jest.fn()
});

const recommendation = {
  widgetId: 'gesture-playground' as const,
  seed: { targetPhrase: 'Alice was beginning to get very tired.' }
} as NonNullable<WorkshopTurn['widgetRecommendation']>;

interface BubbleOptions {
  turn?: WorkshopTurn;
  offers?: WorkshopEditOfferControls;
  reactions?: WorkshopReactionControls;
  fileEdits?: WorkshopFileEditControls;
  onOpenWidgetRecommendation?: jest.Mock;
}

const bubble = ({ turn = reply(), offers, reactions, fileEdits, onOpenWidgetRecommendation }: BubbleOptions = {}) => (
  <WorkshopTurnBubble
    turn={turn}
    quickActionToolId={null}
    onQuickAction={jest.fn()}
    onTalkDirectly={jest.fn()}
    onCopy={jest.fn()}
    onSave={jest.fn()}
    editOffers={offers}
    reactions={reactions}
    fileEdits={fileEdits}
    onOpenWidgetRecommendation={onOpenWidgetRecommendation}
  />
);

const foot = () => document.querySelector<HTMLElement>('.pm-ws-turn-foot')!;
const chip = (kind: string) => document.querySelector<HTMLButtonElement>(`[data-pm-offer="${kind}"]`)!;
const description = (element: HTMLElement) => document.getElementById(element.getAttribute('aria-describedby') ?? '')?.textContent;

describe('a reply\'s footer row (U1)', () => {
  it('holds the offers, then the widget chip, then the reaction corner, in one row after the action row', () => {
    const onOpen = jest.fn();
    render(bubble({
      turn: reply({ editOffers: [offer('fixes', 3), offer('rewrites', 2)], widgetRecommendation: recommendation }),
      offers: offerControls(),
      reactions: reactionControls(),
      onOpenWidgetRecommendation: onOpen
    }));
    const row = foot();
    expect(row.className).toBe('pm-ws-turn-foot');
    const [offersEnd, corner] = Array.from(row.children);
    expect(row.children).toHaveLength(2);
    expect(offersEnd.className).toBe('pm-ws-turn-offers');
    expect(corner.className).toBe('pm-ws-reaction-corner');

    // The lead is quiet, and only decoration: the group's name says it.
    const group = within(row).getByRole('group', { name: GROUP });
    expect(group.querySelector('.pm-ws-offer-lead')?.textContent?.trim()).toBe('As edits');
    expect(group.querySelector('.pm-ws-offer-lead')?.getAttribute('aria-hidden')).toBe('true');
    expect(Array.from(group.querySelectorAll('[data-pm-offer]')).map((each) => each.getAttribute('data-pm-offer'))).toEqual(['fixes', 'rewrites']);

    // The widget chip moved in beside the offers, after them, outside the edits' group.
    const widget = within(row).getByRole('button', { name: /Gesture Playground/ });
    expect(widget.className).toBe('pm-ws-widget-reco');
    expect(widget.parentElement).toBe(offersEnd);
    expect(group.contains(widget)).toBe(false);
    expect(group.compareDocumentPosition(widget) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(widget);
    expect(onOpen).toHaveBeenCalledWith(recommendation, 'Jill', 'jill');

    // Tab order is the DOM's: the action row, the offers, the reactions (U6).
    const actions = document.querySelector('.pm-ws-turn-actions')!;
    expect(actions.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const order = Array.from(document.querySelectorAll('button')).map((button) =>
      button.closest('.pm-ws-turn-actions') ? 'action' : button.closest('.pm-ws-turn-offers') ? 'offer' : button.closest('.pm-ws-reaction-corner') ? 'reaction' : 'other');
    expect(order.join(' ')).toMatch(/^(action )+(offer )+reaction$/);
  });

  it('draws fixes before rewrites whatever order the reply declared them in, and leaves the turn as it was (PR #253 N1)', () => {
    const declared = [offer('rewrites', 2), offer('fixes', 3)];
    render(bubble({ turn: reply({ editOffers: declared }), offers: offerControls() }));
    const kinds = Array.from(document.querySelectorAll('[data-pm-offer]')).map((element) => element.getAttribute('data-pm-offer'));
    expect(kinds).toEqual(['fixes', 'rewrites']);
    expect(declared.map((entry) => entry.kind)).toEqual(['rewrites', 'fixes']);
  });

  it('no bubble gains a row: the widget chip has no row of its own any more', () => {
    render(bubble({ turn: reply({ widgetRecommendation: recommendation }), reactions: reactionControls(), onOpenWidgetRecommendation: jest.fn() }));
    const widget = screen.getByRole('button', { name: /Gesture Playground/ });
    expect(widget.closest('.pm-ws-turn-foot')).toBe(foot());
    expect(document.querySelectorAll('.pm-ws-widget-reco')).toHaveLength(1);
    // No lead and no group without an edit offer.
    expect(screen.queryByRole('group', { name: GROUP })).toBeNull();
    expect(document.querySelector('.pm-ws-offer-lead')).toBeNull();
  });

  it('with reactions alone the row is the corner; with offers alone it is the offers', () => {
    const { unmount } = render(bubble({ reactions: reactionControls() }));
    expect(Array.from(foot().children).map((each) => each.className)).toEqual(['pm-ws-reaction-corner']);
    unmount();

    render(bubble({ turn: reply({ editOffers: [offer('fixes', 3)] }), offers: offerControls() }));
    expect(Array.from(foot().children).map((each) => each.className)).toEqual(['pm-ws-turn-offers']);
    expect(foot().className).toBe('pm-ws-turn-foot');
  });

  it('an empty footer takes no row, and keeps the corner mounted inside it', () => {
    // A tool report: not reactable, nothing offered.
    render(bubble({
      turn: reply({ participant: 'tool', artifact: 'tool_report', personaId: undefined, personaLabel: undefined, toolLabel: 'Prose analysis' }),
      offers: offerControls(),
      reactions: reactionControls()
    }));
    expect(foot().className).toBe('pm-ws-turn-foot pm-ws-turn-foot-bare');
    expect(foot().querySelector('.pm-ws-reaction-corner')).not.toBeNull();
  });

  it('draws only what the host sent: no offers on the turn, or no controls, is no chip', () => {
    const { unmount } = render(bubble({ offers: offerControls(), reactions: reactionControls() }));
    expect(document.querySelector('[data-pm-offer]')).toBeNull();
    unmount();
    render(bubble({ turn: reply({ editOffers: [offer('fixes', 3)] }), reactions: reactionControls() }));
    expect(document.querySelector('[data-pm-offer]')).toBeNull();
  });

  it('a writer\'s message keeps its corner as it was, with no footer row', () => {
    render(bubble({
      turn: reply({ id: 'turn-1', role: 'user', participant: 'writer', personaId: undefined, personaLabel: undefined, content: 'Does the fall work?' }),
      offers: offerControls(),
      reactions: reactionControls()
    }));
    expect(document.querySelector('.pm-ws-turn-foot')).toBeNull();
    expect(document.querySelector('.pm-ws-reaction-corner')?.parentElement?.className).toContain('pm-ws-turn-user');
  });
});

describe('a chip and its states (U2)', () => {
  const statuses: Array<[string, WorkshopEditOfferStatus, string, string]> = [
    ['open', { state: 'open' }, '3 fixes', `3 fixes. Ask Jill to suggest them as edits to ${PATH}.`],
    ['asked', { state: 'asked' }, 'Asking Jill for 3 fixes…', 'Asking Jill for 3 fixes… The room’s Stop ends the request.'],
    ['answered', { state: 'answered', answerTurnId: 'turn-6', cards: 1, changes: 3, askAgain: false }, '3 fixes suggested', '3 fixes suggested. Go to the edits.'],
    ['nothing-to-change', { state: 'nothing-to-change', answerTurnId: 'turn-6', askAgain: true }, '3 fixes · nothing to change · ask again',
      `3 fixes, nothing to change, ask again. Ask Jill again to suggest them as edits to ${PATH}.`],
    ['ask-again', { state: 'ask-again', answerTurnId: 'turn-6', cards: 1, changes: 3, askAgain: true }, '3 fixes · ask again',
      `3 fixes, ask again. The last suggested edits were not applied. Ask Jill again to suggest them as edits to ${PATH}.`]
  ];

  it.each(statuses)('%s: its own words, and a name that starts with them', (face, status, label, name) => {
    render(bubble({ turn: reply({ editOffers: [offer('fixes', 3, status)] }), offers: offerControls() }));
    const button = chip('fixes');
    expect(button.className).toBe(`pm-ws-offer pm-ws-offer-${face}`);
    expect(button.textContent).toBe(label);
    expect(screen.getByRole('button', { name })).toBe(button);
    expect(button.getAttribute('aria-busy')).toBe(face === 'asked' ? 'true' : null);
  });

  it('a press asks with the turn and the kind; an asked chip is busy, focusable and presses nothing', () => {
    const offers = offerControls();
    const view = render(bubble({ turn: reply({ editOffers: [offer('fixes', 3), offer('rewrites', 2)] }), offers }));
    fireEvent.click(chip('rewrites'));
    expect(offers.onAsk).toHaveBeenCalledTimes(1);
    expect(offers.onAsk).toHaveBeenCalledWith('turn-2', 'rewrites');

    view.rerender(bubble({ turn: reply({ editOffers: [offer('fixes', 3), offer('rewrites', 2)] }), offers: { ...offers, askingOffers: new Set(['turn-2#rewrites']) } }));
    const asked = chip('rewrites');
    expect(asked.getAttribute('aria-busy')).toBe('true');
    expect(asked.getAttribute('aria-disabled')).toBe('true');
    expect(asked.disabled).toBe(false);
    fireEvent.click(asked);
    expect(offers.onAsk).toHaveBeenCalledTimes(1);
    // The sibling stays focusable.
    expect(chip('fixes').disabled).toBe(false);
  });

  it('never unmounts or moves: one node, and its focus, from the press to the answer and on to ask again', () => {
    const offers = offerControls();
    const turnWith = (status: WorkshopEditOfferStatus) => reply({ editOffers: [offer('fixes', 3, status), offer('rewrites', 2)] });
    const view = render(bubble({ turn: turnWith({ state: 'open' }), offers }));
    const node = chip('fixes');
    node.focus();
    fireEvent.click(node);

    const steps: WorkshopEditOfferStatus[] = [
      { state: 'asked' },
      { state: 'answered', answerTurnId: 'turn-6', cards: 1, changes: 3, askAgain: false },
      { state: 'ask-again', answerTurnId: 'turn-6', cards: 1, changes: 3, askAgain: true },
      { state: 'nothing-to-change', answerTurnId: 'turn-8', askAgain: true },
      { state: 'open' }
    ];
    for (const status of steps) {
      view.rerender(bubble({ turn: turnWith(status), offers }));
      expect(chip('fixes')).toBe(node);
      // Focus stays where the writer left it: it never moves by itself.
      expect(document.activeElement).toBe(node);
      expect(Array.from(node.parentElement!.querySelectorAll('[data-pm-offer]')).indexOf(node)).toBe(0);
    }
  });

  it('an answered chip goes to the answer; nothing to change and ask again ask', () => {
    const offers = offerControls();
    const view = render(bubble({
      turn: reply({ editOffers: [offer('fixes', 3, { state: 'answered', answerTurnId: 'turn-6', cards: 1, changes: 3, askAgain: false })] }),
      offers
    }));
    fireEvent.click(chip('fixes'));
    expect(offers.onGoToTurn).toHaveBeenCalledWith('turn-6');
    expect(offers.onAsk).not.toHaveBeenCalled();

    for (const status of [
      { state: 'nothing-to-change', answerTurnId: 'turn-6', askAgain: true },
      { state: 'ask-again', answerTurnId: 'turn-6', cards: 1, changes: 3, askAgain: true }
    ] as WorkshopEditOfferStatus[]) {
      view.rerender(bubble({ turn: reply({ editOffers: [offer('fixes', 3, status)] }), offers }));
      fireEvent.click(chip('fixes'));
    }
    expect(offers.onAsk).toHaveBeenCalledTimes(2);
    expect(offers.onGoToTurn).toHaveBeenCalledTimes(1);
  });

  it('shows the host\'s words for a press that left no answer as the chip\'s description', () => {
    render(bubble({
      turn: reply({ editOffers: [offer('fixes', 3)] }),
      offers: offerControls({ offerFeedback: new Map([['turn-2#fixes', workshopEditOfferRefusalWords('no-answer')]]) })
    }));
    expect(chip('fixes').textContent).toBe('3 fixes');
    expect(description(chip('fixes'))).toBe(workshopEditOfferRefusalWords('no-answer'));
    expect(chip('fixes').getAttribute('aria-disabled')).toBeNull();
  });
});

describe('waiting and blocked (U5)', () => {
  const waits: Array<[string, Partial<WorkshopEditOfferControls>, WorkshopEditOfferStatus, string]> = [
    ['a run is going', { running: true, locked: true }, { state: 'open' }, 'Wait for the current reply to finish.'],
    ['the room\'s lock is held', { locked: true }, { state: 'open' }, workshopEditOfferRefusalWords('session-operation')],
    ['the author left', {}, { state: 'open', blocked: 'author-left' }, 'Jill isn’t in this room now']
  ];

  it.each(waits)('%s: focusable, aria-disabled, its reason as its description, and no press', (_name, room, status, reason) => {
    const offers = offerControls(room);
    render(bubble({ turn: reply({ editOffers: [offer('fixes', 3, status)] }), offers }));
    const button = chip('fixes');
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(description(button)).toBe(reason);
    // It keeps its face and its name: only the description says why it waits.
    expect(button.textContent).toBe('3 fixes');
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(offers.onAsk).not.toHaveBeenCalled();
  });

  it('a chip that goes to its answer still presses while the room is busy', () => {
    const offers = offerControls({ running: true, locked: true });
    render(bubble({
      turn: reply({ editOffers: [offer('fixes', 3, { state: 'answered', answerTurnId: 'turn-6', cards: 1, changes: 3, askAgain: false })] }),
      offers
    }));
    expect(chip('fixes').getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(chip('fixes'));
    expect(offers.onGoToTurn).toHaveBeenCalledWith('turn-6');
  });
});

describe('the press and its answer in the thread (U3, U4)', () => {
  const REQUEST = 'Asked Jill to suggest the fixes from their reply as file edits.';
  const ANSWER = `Suggested 3 fixes to ${PATH}, from the 2:02 pm reply.`;
  const card = (change: Partial<WorkshopFileEditProposal> = {}): WorkshopFileEditProposal => ({
    requested: { kind: 'resource', group: 'chapters', path: PATH },
    target: { kind: 'file', relativePath: PATH },
    class: 'prose',
    operations: [{ op: 'replace', find: 'begining', with: 'beginning' }],
    why: 'The slips the reply named.',
    baseline: { sha256: 'a'.repeat(64), length: 1200 },
    state: 'pending',
    intent: 'fixes',
    ...change
  });
  const fileEdits: WorkshopFileEditControls = {
    disabled: false,
    busyCards: new Set(),
    cardFeedback: new Map(),
    previews: new Map(),
    onApply: jest.fn(),
    onReview: jest.fn(),
    onDecline: jest.fn(),
    onRequestPreview: jest.fn()
  };

  it('the press is one divider line in the host\'s words, never a writer bubble, with a link to its source', () => {
    const offers = offerControls();
    render(bubble({
      turn: reply({ id: 'turn-5', role: 'user', participant: 'writer', personaId: undefined, personaLabel: undefined, content: REQUEST, editOfferRequest: { sourceTurnId: 'turn-2', kind: 'fixes' } }),
      offers,
      reactions: reactionControls()
    }));
    const line = document.querySelector<HTMLElement>('.pm-ws-offer-request')!;
    expect(line.className).toContain('pm-ws-revision-divider');
    expect(line.textContent).toContain(REQUEST);
    expect(line.getAttribute('data-turn-id')).toBe('turn-5');
    expect(document.querySelector('.pm-ws-turn-user')).toBeNull();
    expect(document.querySelector('.pm-ws-reaction-corner')).toBeNull();
    // The host's words use no pronoun (the addendum).
    expect(line.textContent).not.toMatch(/\b(her|his|she|he)\b/i);

    fireEvent.click(within(line).getByRole('button', { name: /^That reply\./ }));
    expect(offers.onGoToTurn).toHaveBeenCalledWith('turn-2');
  });

  it('the answer shows the host\'s line with a link to its source, and its cards under the kind, each marked', () => {
    const offers = offerControls();
    render(bubble({
      turn: reply({ id: 'turn-6', content: ANSWER, editOfferAnswer: { sourceTurnId: 'turn-2', kind: 'fixes', outcome: 'proposed' }, fileEditProposals: [card()] }),
      offers,
      fileEdits,
      reactions: reactionControls()
    }));
    const line = document.querySelector<HTMLElement>('.pm-ws-offer-answer-line')!;
    expect(line.textContent).toContain(ANSWER);
    // Plain words, never rendered as the persona's prose.
    expect(document.querySelector('.pm-ws-turn-body')).toBeNull();
    fireEvent.click(within(line).getByRole('button', { name: /^That reply\./ }));
    expect(offers.onGoToTurn).toHaveBeenCalledWith('turn-2');

    // One card still gets the heading, with the kind.
    const stack = screen.getByRole('group', { name: 'Suggested file edits · fixes' });
    expect(stack.querySelector('.pm-ws-file-edit-stack-head')?.textContent?.trim()).toBe('Suggested file edits · fixes');
    const marks = Array.from(stack.querySelectorAll('.pm-ws-file-edit-card .pm-ws-file-edit-class')).map((each) => each.textContent);
    expect(marks).toEqual(['chapter', 'fixes']);
  });

  it('a rewrites answer\'s cards carry no intent, and take their mark from the answer\'s kind', () => {
    render(bubble({
      turn: reply({
        id: 'turn-6',
        content: `Suggested 2 rewrites to ${PATH}, from the 2:02 pm reply.`,
        editOfferAnswer: { sourceTurnId: 'turn-2', kind: 'rewrites', outcome: 'proposed' },
        fileEditProposals: [card({ intent: undefined }), card({ intent: undefined, target: undefined, class: undefined, state: 'refused', reason: 'not-the-offered-file' })]
      }),
      offers: offerControls(),
      fileEdits
    }));
    const stack = screen.getByRole('group', { name: 'Suggested file edits · rewrites' });
    const cards = Array.from(stack.querySelectorAll('.pm-ws-file-edit-card'));
    expect(cards.map((each) => Array.from(each.querySelectorAll('.pm-ws-file-edit-class')).map((mark) => mark.textContent)))
      .toEqual([['chapter', 'rewrites'], ['rewrites']]);
  });

  it('nothing to change: the host\'s line with the persona\'s one-line why, and no cards', () => {
    const none = 'Jill found nothing to change: the chapter already reads “beginning”.';
    render(bubble({
      turn: reply({ id: 'turn-6', content: none, editOfferAnswer: { sourceTurnId: 'turn-2', kind: 'fixes', outcome: 'none', why: 'the chapter already reads “beginning”.' } }),
      offers: offerControls(),
      fileEdits
    }));
    const line = document.querySelector<HTMLElement>('.pm-ws-offer-answer-line')!;
    expect(line.className).toContain('pm-ws-offer-answer-none');
    expect(line.textContent).toContain(none);
    expect(document.querySelector('.pm-ws-file-edit-card')).toBeNull();
    expect(screen.queryByRole('group', { name: /Suggested file edits/ })).toBeNull();
  });

  it('an ordinary reply\'s cards read as they did: no heading for one card, no mark', () => {
    render(bubble({ turn: reply({ fileEditProposals: [card({ intent: undefined })] }), fileEdits }));
    expect(document.querySelector('.pm-ws-file-edit-stack')).toBeNull();
    expect(Array.from(document.querySelectorAll('.pm-ws-file-edit-class')).map((each) => each.textContent)).toEqual(['chapter']);
  });
});
