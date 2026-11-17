/** @jest-environment jsdom */

/**
 * "Show earlier turns" through the real App (ADR 2026-11-17 D5–D7): the
 * control leads a long room's thread; a press posts ids only; the page's
 * bubbles land before the window's, each a full bubble whose Rewind counts
 * and names its own turn; a room replacement drops them; a session state in
 * the same room reads them again; the webview persists nothing loaded.
 * Made-up lines.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType,
  WorkshopEarlierTurnsPage,
  WorkshopRequestEarlierTurnsPayload,
  WorkshopSessionSnapshot,
  WorkshopSessionStateMessage,
  WorkshopTurn
} from '@messages';
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
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { WorkshopApp } from '@/presentation/webview/WorkshopApp';
import { WORKSHOP_TURN_ID_ATTRIBUTE } from '@components/workshop/WorkshopTurnBubble';

/** The room: t1 … t8, a question then Jill's answer; the window holds t5 … t8. */
const turn = (n: number): WorkshopTurn => ({
  id: `turn-${n}`,
  role: n % 2 === 1 ? 'user' : 'assistant',
  kind: 'message',
  participant: n % 2 === 1 ? 'writer' : 'host',
  artifact: 'persona_message',
  ...(n % 2 === 0 ? { personaId: 'jill' as const, personaLabel: 'Jill' } : {}),
  content: n % 2 === 1 ? `Question ${n} about the tea table.` : `Answer ${n} about the tea table.`,
  timestamp: n,
  excerptVersion: 0
});
const turns = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => turn(from + index));
const verdicts = (list: WorkshopTurn[]) => Object.fromEntries(list.map((each) => [each.id, { available: true as const }]));

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
      turns: turns(5, 8),
      turnRewindability: verdicts(turns(5, 8)),
      totalTurns: 8,
      truncatedTurns: 4,
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

const page = (from: number, to: number, change: Partial<WorkshopEarlierTurnsPage> = {}): WorkshopEarlierTurnsPage => ({
  turns: turns(from, to),
  turnRewindability: verdicts(turns(from, to)),
  reactions: [],
  widgetConfigs: [],
  remainingBefore: from - 1,
  ...change
});

const deliver = (message: unknown) =>
  act(() => window.dispatchEvent(new MessageEvent('message', { data: message })));

const bubbleIds = () => [...document.querySelectorAll<HTMLElement>(`[${WORKSHOP_TURN_ID_ATTRIBUTE}]`)]
  .map((element) => element.getAttribute(WORKSHOP_TURN_ID_ATTRIBUTE));
const bubble = (id: string) => document.querySelector<HTMLElement>(`[${WORKSHOP_TURN_ID_ATTRIBUTE}="${id}"]`)!;

describe('WorkshopApp — show earlier turns', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls
    .map(([message]) => message)
    .filter((message) => message.type === type);
  const asked = (): WorkshopRequestEarlierTurnsPayload[] =>
    posted(MessageType.WORKSHOP_REQUEST_EARLIER_TURNS).map((message) => message.payload);
  const answer = (request: WorkshopRequestEarlierTurnsPayload, body: { page?: WorkshopEarlierTurnsPage; error?: string }) =>
    deliver({ type: MessageType.WORKSHOP_EARLIER_TURNS, source: 'extension.workshop', payload: { ...request, ...body }, timestamp: 1 });
  const control = () => screen.queryByRole('button', { name: /earlier turns/ });
  const announcer = () => document.querySelector<HTMLElement>('[data-pm-earlier-turns-announcer]')!;

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    render(<WorkshopApp />);
    deliver(session());
  });

  afterEach(() => jest.clearAllMocks());

  it('leads the thread with the count; a press posts ids only and waits', () => {
    expect(control()?.textContent).toBe('Show earlier turns (4 not shown)');
    expect(bubbleIds()).toEqual(['turn-5', 'turn-6', 'turn-7', 'turn-8']);

    fireEvent.click(control()!);

    expect(asked()).toEqual([{ requestId: expect.any(String), roomRevision: 1, beforeTurnId: 'turn-5' }]);
    expect(posted(MessageType.WORKSHOP_REQUEST_EARLIER_TURNS)[0].source).toBe('webview.workshop.earlierTurns');
    expect(control()?.textContent).toBe('Loading earlier turns…');
    expect(control()?.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(control()!);
    expect(asked()).toHaveLength(1);
  });

  it('draws a page before the window, counts what remains, and announces it once', () => {
    fireEvent.click(control()!);
    answer(asked()[0], { page: page(3, 4) });

    expect(bubbleIds()).toEqual(['turn-3', 'turn-4', 'turn-5', 'turn-6', 'turn-7', 'turn-8']);
    expect(control()?.textContent).toBe('Show earlier turns (2 not shown)');
    expect(announcer().textContent).toBe('2 earlier turns shown.');

    fireEvent.click(control()!);
    expect(asked()[1]).toMatchObject({ roomRevision: 1, beforeTurnId: 'turn-3' });
    answer(asked()[1], { page: page(1, 2) });

    expect(bubbleIds()).toEqual(turns(1, 8).map((each) => each.id));
    // At the room's first turn the control and the notice go.
    expect(control()).toBeNull();
    expect(document.querySelector('.pm-ws-thread-hidden')).toBeNull();
    expect(screen.getAllByText('2 earlier turns shown.')).toHaveLength(1);
  });

  it('an earlier bubble rewinds: the dialog counts every turn after it, and the confirm names its turn', () => {
    fireEvent.click(control()!);
    answer(asked()[0], { page: page(1, 4) });

    // turn-2 is Jill's first answer, outside the window.
    fireEvent.click(within(bubble('turn-2')).getByRole('button', { name: /Rewind to here/ }));
    const dialog = screen.getByRole('dialog', { name: 'Rewind to here?' });
    expect(dialog.textContent).toContain('6 turns will be removed.');
    fireEvent.click(within(dialog).getByRole('button', { name: /^Rewind/ }));

    expect(posted(MessageType.WORKSHOP_REWIND_SESSION).map((message) => message.payload)).toEqual([{ turnId: 'turn-2' }]);
  });

  it('an earlier bubble offers Branch, bookmark and reactions through their own routes', () => {
    fireEvent.click(control()!);
    answer(asked()[0], {
      page: page(1, 4, { reactions: [{ turnId: 'turn-2', reaction: 'heart', author: { kind: 'writer' }, label: 'You' } as never] })
    });
    const earlier = within(bubble('turn-2'));

    expect(earlier.getByRole('button', { name: /Branch from here/ })).toBeTruthy();
    expect(bubble('turn-2').querySelectorAll('.pm-ws-reaction-item')).toHaveLength(1);
    fireEvent.click(earlier.getByRole('button', { name: /bookmark/i }));

    expect(posted(MessageType.WORKSHOP_SET_TURN_BOOKMARK).map((message) => message.payload))
      .toEqual([{ turnId: 'turn-2', bookmarked: true }]);
  });

  it.each([
    ['New', { turns: [], truncatedTurns: 0, totalTurns: 0, turnRewindability: {} }],
    ['Open', { turns: turns(5, 8), truncatedTurns: 4 }],
    ['Rewind', { turns: turns(5, 6), truncatedTurns: 4, totalTurns: 6 }],
    ['Branch', { turns: turns(5, 6), truncatedTurns: 4, totalTurns: 6 }]
  ])('%s replaces the room before a held answer: the earlier turns go, and the answer is dropped', (_operation, room) => {
    fireEvent.click(control()!);
    answer(asked()[0], { page: page(3, 4) });
    fireEvent.click(control()!);
    const held = asked()[1];

    deliver(session({ ...room, roomRevision: 2 } as Partial<WorkshopSessionSnapshot>));

    expect(bubbleIds()).toEqual((room.turns as WorkshopTurn[]).map((each) => each.id));
    answer(held, { page: page(1, 2) });
    expect(bubbleIds()).toEqual((room.turns as WorkshopTurn[]).map((each) => each.id));
    expect(asked()).toHaveLength(2);
  });

  it('a session state in the same room reads the earlier turns again and shows what changed', () => {
    fireEvent.click(control()!);
    answer(asked()[0], { page: page(1, 4) });

    // A reply arrived: turn-5 slid out of the window.
    deliver(session({ turns: turns(6, 9), turnRewindability: verdicts(turns(6, 9)), truncatedTurns: 5, totalTurns: 9 }));

    expect(bubbleIds()).toEqual(turns(1, 9).map((each) => each.id));
    expect(asked()[1]).toMatchObject({ roomRevision: 1, beforeTurnId: 'turn-6' });
    const reread = page(1, 5);
    reread.turns[1] = { ...turn(2), content: 'Answer 2, as the host holds it now.' };
    answer(asked()[1], { page: reread });

    expect(bubbleIds()).toEqual(turns(1, 9).map((each) => each.id));
    expect(bubble('turn-2').textContent).toContain('Answer 2, as the host holds it now.');
    expect(control()).toBeNull();
  });

  it('shows a refusal\'s words beside the control and keeps what it held', () => {
    fireEvent.click(control()!);
    answer(asked()[0], { page: page(3, 4) });
    fireEvent.click(control()!);

    answer(asked()[1], { error: 'The room changed before its earlier turns could be shown.' });

    expect(document.querySelector('.pm-ws-thread-earlier-error')?.textContent)
      .toBe('The room changed before its earlier turns could be shown.');
    expect(control()?.textContent).toBe('Show earlier turns (2 not shown)');
    expect(bubbleIds()).toEqual(turns(3, 8).map((each) => each.id));
  });

  it('persists nothing it loaded', () => {
    fireEvent.click(control()!);
    answer(asked()[0], { page: page(1, 4) });

    const saved = JSON.stringify(vscode.setState.mock.calls);
    expect(saved).not.toContain('Question 1 about the tea table.');
    expect(saved).not.toContain('Answer 2 about the tea table.');
    expect(saved).not.toContain('turn-2');
  });
});
