/** @jest-environment jsdom */

/**
 * WorkshopApp edit offers (ADR 2026-11-10 U1–U6; epic Slice 3), through the
 * real App: a chip's press posts ids only; the chip keeps its node and its
 * focus from the press to the answer; what the press came to is announced
 * once by the hook's live region; the answered chip, the press's line and
 * the answer's line move focus to a bubble only when pressed; a refusal's
 * words stay with the chip until the next snapshot. *Alice*.
 */

import * as React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType,
  WorkshopSessionSnapshot,
  WorkshopSessionStateMessage,
  WorkshopTurn
} from '@messages';
import type { WorkshopEditOfferResultPayload, WorkshopEditOfferStatus } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../presentation/webview/styles/workshop/tokens.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/shell.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/context.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/session.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/memory.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/gesturePlayground/gesturePlayground.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/lexicalGravity/lexicalGravity.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/creativeVariations/creativeVariations.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/showVsTell/showVsTell.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/standingDirectiveRail.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/schematic/schematic.css', () => ({}));
// eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked component's own name.
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { WorkshopApp } from '@/presentation/webview/WorkshopApp';
import { WORKSHOP_TURN_ID_ATTRIBUTE } from '@components/workshop/WorkshopTurnBubble';


const PATH = 'chapters/down-the-rabbit-hole.md';
const offers = (fixes: WorkshopEditOfferStatus = { state: 'open' }): NonNullable<WorkshopTurn['editOffers']> => [
  { kind: 'fixes', count: 3, target: { kind: 'file', relativePath: PATH }, status: fixes },
  { kind: 'rewrites', count: 2, target: { kind: 'file', relativePath: PATH }, status: { state: 'open' } }
];

const writerTurn: WorkshopTurn = {
  id: 'turn-1',
  role: 'user',
  kind: 'message',
  participant: 'writer',
  artifact: 'persona_message',
  content: 'Does the fall work?',
  timestamp: 1,
  excerptVersion: 0
};

const hostTurn = (fixes?: WorkshopEditOfferStatus): WorkshopTurn => ({
  id: 'turn-2',
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  content: 'The fall works. Three slips first, and two lines I would rewrite.',
  timestamp: 2,
  excerptVersion: 0,
  editOffers: offers(fixes)
});

const requestTurn: WorkshopTurn = {
  ...writerTurn,
  id: 'turn-3',
  content: 'Asked Jill to suggest the fixes from their reply as file edits.',
  timestamp: 3,
  editOfferRequest: { sourceTurnId: 'turn-2', kind: 'fixes' }
};

const answerTurn: WorkshopTurn = {
  ...hostTurn(),
  id: 'turn-4',
  content: `Suggested 3 fixes to ${PATH}, from the 2:02 pm reply.`,
  timestamp: 4,
  editOffers: undefined,
  editOfferAnswer: { sourceTurnId: 'turn-2', kind: 'fixes', outcome: 'proposed' },
  fileEditProposals: [{
    requested: { kind: 'resource', group: 'chapters', path: PATH },
    target: { kind: 'file', relativePath: PATH },
    class: 'prose',
    operations: [
      { op: 'replace', find: 'begining', with: 'beginning' },
      { op: 'replace', find: 'the the', with: 'the' },
      { op: 'replace', find: 'it\'s sides', with: 'its sides' }
    ],
    why: 'The three slips the reply named.',
    baseline: { sha256: 'a'.repeat(64), length: 1200 },
    state: 'pending',
    intent: 'fixes'
  }]
};

const ANSWERED: WorkshopEditOfferStatus = { state: 'answered', answerTurnId: 'turn-4', cards: 1, changes: 3, askAgain: false };
const ANSWERED_WORDS = `Jill suggested 3 fixes to ${PATH}. They are at the end of the conversation.`;

const session = (overrides: Partial<WorkshopSessionSnapshot> = {}): WorkshopSessionStateMessage => ({
  type: MessageType.WORKSHOP_SESSION_STATE,
  source: 'extension.workshop',
  payload: {
    session: {
      scope: 'open',
      participantSubjectReady: true,
      excerptVersion: 0,
      replacementCount: 0,
      roomRevision: 1,
      contextRevision: 0,
      contextAttachments: [],
      pendingMessageAttachments: [],
      widgetConfigs: [],
      standingDirectives: [],
      todos: [],
      bookmarks: [],
      reactions: [],
      turns: [writerTurn, hostTurn()],
      turnRewindability: {},
      totalTurns: 2,
      truncatedTurns: 0,
      roomHasMemory: true,
      participants: {
        host: { personaId: 'jill', hasConversation: true },
        toolSidecars: [],
        personaGuests: [],
        chatTarget: { kind: 'host' }
      },
      conversationBehavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR },
      ...overrides
    },
    writerProfile: { ...DEFAULT_WORKSHOP_WRITER_PROFILE },
    webResearch: { enabled: false },
    persistence: { available: true, degradedConversationKeys: [] }
  },
  timestamp: 0
});

const deliver = (message: unknown) =>
  act(() => window.dispatchEvent(new MessageEvent('message', { data: message })));

const bubble = (turnId: string) =>
  document.querySelector<HTMLElement>(`[${WORKSHOP_TURN_ID_ATTRIBUTE}="${turnId}"]`)!;


describe('WorkshopApp edit offers', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    jest.useFakeTimers();
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const presses = () => vscode.postMessage.mock.calls
    .map(([entry]: [{ type: MessageType; payload: Record<string, unknown> }]) => entry)
    .filter((entry) => entry.type === MessageType.WORKSHOP_EDIT_OFFER_ACTION)
    .map((entry) => entry.payload);
  const chip = (kind: string, turnId = 'turn-2') => bubble(turnId).querySelector<HTMLButtonElement>(`[data-pm-offer="${kind}"]`)!;
  const announcer = () => document.querySelector<HTMLElement>('[data-pm-edit-offer-announcer]')!;
  const result = (payload: Partial<WorkshopEditOfferResultPayload> & { requestId: string }) => ({
    type: MessageType.WORKSHOP_EDIT_OFFER_RESULT,
    source: 'extension.workshop',
    payload: { roomRevision: 1, turnId: 'turn-2', kind: 'fixes', answer: 'answered', message: ANSWERED_WORDS, ...payload },
    timestamp: 5
  });
  const answeredSession = () => session({ turns: [writerTurn, hostTurn(ANSWERED), requestTurn, answerTurn], totalTurns: 4 });

  it('draws a reply\'s offers in its footer, in a group named for the persona, and none where the host sent none', () => {
    render(<WorkshopApp />);
    deliver(session());
    const group = within(bubble('turn-2')).getByRole('group', { name: 'Edits Jill can suggest from this reply' });
    expect(within(group).getAllByRole('button').map((button) => button.textContent)).toEqual(['3 fixes', '2 rewrites']);
    expect(group.closest('.pm-ws-turn-foot')).toBe(bubble('turn-2').querySelector('.pm-ws-turn-foot'));

    // File edits turned off: the host's view leaves the offers out, and no chip is drawn.
    deliver(session({ turns: [writerTurn, { ...hostTurn(), editOffers: undefined }] }));
    expect(bubble('turn-2').querySelector('[data-pm-offer]')).toBeNull();
    expect(bubble('turn-2').querySelector('.pm-ws-offer-lead')).toBeNull();
  });

  it('a press posts a minted id, the room, the turn and the kind, and nothing else', () => {
    render(<WorkshopApp />);
    deliver(session());
    fireEvent.click(chip('fixes'));
    expect(presses()).toEqual([{ requestId: expect.stringMatching(/^ws-edit-offer-/), roomRevision: 1, turnId: 'turn-2', kind: 'fixes' }]);
    expect(chip('fixes').textContent).toBe('Asking Jill for 3 fixes…');
    expect(chip('fixes').getAttribute('aria-busy')).toBe('true');
    // A second press while asked posts nothing.
    fireEvent.click(chip('fixes'));
    expect(presses()).toHaveLength(1);
  });

  it('the chip keeps its node and its focus from the press to the answer, and the answer is announced once', () => {
    render(<WorkshopApp />);
    deliver(session());
    const node = chip('fixes');
    node.focus();
    fireEvent.click(node);
    const requestId = presses()[0].requestId as string;
    expect(announcer().textContent).toBe('');
    expect(announcer().getAttribute('aria-live')).toBe('polite');

    // The host's snapshot with the press's turn and its answer, then the press's own result.
    deliver(answeredSession());
    expect(chip('fixes')).toBe(node);
    expect(document.activeElement).toBe(node);
    // Its own press is still out, so it reads asked until its result lands.
    expect(node.textContent).toBe('Asking Jill for 3 fixes…');
    expect(announcer().textContent).toBe('');

    deliver(result({ requestId, answerTurnId: 'turn-4', outcome: 'proposed', cards: 1, changes: 3 }));
    expect(chip('fixes')).toBe(node);
    expect(node.textContent).toBe('3 fixes suggested');
    expect(announcer().textContent).toBe(ANSWERED_WORDS);
    const said = announcer().firstElementChild;
    // Focus did not move by itself, to the answer or anywhere.
    expect(document.activeElement).toBe(node);

    // A duplicate result and a later snapshot say nothing again.
    deliver(result({ requestId, answerTurnId: 'turn-4', outcome: 'proposed', cards: 1, changes: 3 }));
    deliver(answeredSession());
    expect(announcer().firstElementChild).toBe(said);
    expect(announcer().textContent).toBe(ANSWERED_WORDS);
    // The reactions' own live region is a different one.
    expect(document.querySelector('[data-pm-reaction-announcer]')).not.toBe(announcer());
    expect(document.querySelector('[data-pm-reaction-announcer]')?.textContent).toBe('');
  });

  it('an answered chip moves focus to the answer\'s bubble, and both lines\' links move it back to the source', () => {
    render(<WorkshopApp />);
    deliver(answeredSession());

    fireEvent.click(chip('fixes'));
    expect(document.activeElement).toBe(bubble('turn-4'));
    expect(presses()).toHaveLength(0);

    // The answer: the host's line, no persona prose, its cards under the kind.
    const answer = bubble('turn-4');
    expect(answer.querySelector('.pm-ws-offer-answer-line')?.textContent).toContain(answerTurn.content);
    expect(within(answer).getByRole('group', { name: 'Suggested file edits · fixes' })).toBeTruthy();
    fireEvent.click(within(answer.querySelector<HTMLElement>('.pm-ws-offer-answer-line')!).getByRole('button', { name: /^That reply\./ }));
    expect(document.activeElement).toBe(bubble('turn-2'));

    // The press: a divider line, not a writer bubble.
    const request = bubble('turn-3');
    expect(request.className).toContain('pm-ws-revision-divider');
    expect(request.textContent).toContain(requestTurn.content);
    bubble('turn-4').focus();
    fireEvent.click(within(request).getByRole('button', { name: /^That reply\./ }));
    expect(document.activeElement).toBe(bubble('turn-2'));
  });

  it('a refusal\'s words are announced and stay with the chip until the next snapshot', () => {
    render(<WorkshopApp />);
    deliver(session());
    const node = chip('fixes');
    fireEvent.click(node);
    const words = 'The persona didn’t answer with edits. Try again, or ask in your own words.';
    deliver(result({ requestId: presses()[0].requestId as string, answer: 'failed', reason: 'no-answer', message: words }));

    // Open again, in the same place, with the host's reason as its description.
    expect(chip('fixes')).toBe(node);
    expect(node.textContent).toBe('3 fixes');
    expect(document.getElementById(node.getAttribute('aria-describedby')!)?.textContent).toBe(words);
    expect(announcer().textContent).toBe(words);

    deliver(session());
    expect(chip('fixes')).toBe(node);
    expect(node.getAttribute('aria-describedby')).toBeNull();
  });

  it('ignores a result for another room, and a new room drops what the old one waited on', () => {
    render(<WorkshopApp />);
    deliver(session());
    fireEvent.click(chip('fixes'));
    const requestId = presses()[0].requestId as string;

    deliver(session({ roomRevision: 2 }));
    expect(chip('fixes').textContent).toBe('3 fixes');
    deliver(result({ requestId, roomRevision: 1 }));
    deliver(result({ requestId, roomRevision: 2 }));
    expect(announcer().textContent).toBe('');
  });

  it('persists nothing about offers in webview state', () => {
    render(<WorkshopApp />);
    deliver(session());
    fireEvent.click(chip('fixes'));
    const saved = JSON.stringify(vscode.setState.mock.calls);
    expect(saved).not.toContain('ws-edit-offer-');
    expect(saved).not.toContain('askingOffers');
  });
});
