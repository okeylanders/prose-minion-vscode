/** @jest-environment jsdom */

/**
 * A bookmark outside the window, through the real App (ADR 2026-11-17 D6,
 * amended 2026-11-18): opening it loads the earlier turns back to it, page
 * by page, then scrolls to and focuses its bubble, with one announcement;
 * its row is busy meanwhile; a jump the host refuses, or one past
 * `jumpPages` pages, opens the reader instead; a new room abandons it.
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
import type { WorkshopBookmarkSummary } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
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

const older: WorkshopBookmarkSummary = {
  id: 'bookmark-2', turnId: 'turn-2', label: 'Jill · Answer two', participant: 'host', personaId: 'jill', inWindow: false
};

describe('WorkshopApp — a bookmark outside the window', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls
    .map(([message]) => message)
    .filter((message) => message.type === type);
  const asked = (): WorkshopRequestEarlierTurnsPayload[] =>
    posted(MessageType.WORKSHOP_REQUEST_EARLIER_TURNS).map((message) => message.payload);
  const answer = (request: WorkshopRequestEarlierTurnsPayload, body: { page?: WorkshopEarlierTurnsPage; error?: string }) =>
    deliver({ type: MessageType.WORKSHOP_EARLIER_TURNS, source: 'extension.workshop', payload: { ...request, ...body }, timestamp: 1 });
  const announcer = () => document.querySelector<HTMLElement>('[data-pm-earlier-turns-announcer]')!;
  const row = () => within(screen.getByLabelText('Session rail'))
    .getByRole('button', { name: 'Jill · Answer two: show it in the thread' });
  const settle = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    Element.prototype.scrollIntoView = jest.fn();
    render(<WorkshopApp />);
    deliver(session({ bookmarks: [older] }));
    fireEvent.click(screen.getByRole('tab', { name: /^Notes/ }));
  });

  afterEach(() => jest.clearAllMocks());

  it('loads the earlier turns back to it, then scrolls to and focuses its bubble', async () => {
    expect(within(row()).getByText('earlier in thread')).toBeTruthy();
    fireEvent.click(row());

    expect(asked()).toEqual([{ requestId: expect.any(String), roomRevision: 1, beforeTurnId: 'turn-5', targetTurnId: 'turn-2' }]);
    expect(row().getAttribute('aria-busy')).toBe('true');
    expect(posted(MessageType.WORKSHOP_REQUEST_TURN_PREVIEW)).toEqual([]);

    answer(asked()[0], { page: page(3, 4) });
    expect(asked()[1]).toMatchObject({ beforeTurnId: 'turn-3', targetTurnId: 'turn-2' });
    answer(asked()[1], { page: page(1, 2) });
    await settle();

    expect(bubbleIds()).toEqual(['turn-1', 'turn-2', 'turn-3', 'turn-4', 'turn-5', 'turn-6', 'turn-7', 'turn-8']);
    expect(document.activeElement).toBe(bubble('turn-2'));
    expect(bubble('turn-2').scrollIntoView).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(posted(MessageType.WORKSHOP_REQUEST_TURN_PREVIEW)).toEqual([]);
    expect(announcer().textContent).toBe('4 earlier turns shown. Showing bookmark: Jill · Answer two.');
    expect(row().getAttribute('aria-busy')).toBeNull();
  });

  it('asks nothing for a second press while it loads', () => {
    fireEvent.click(row());
    fireEvent.click(row());
    expect(asked()).toHaveLength(1);
  });

  it('opens the reader with the host\'s reason when the host refuses the jump', async () => {
    fireEvent.click(row());
    answer(asked()[0], { error: 'The turn is too far back to load into the thread, so the reader shows it instead.' });
    await settle();

    expect(posted(MessageType.WORKSHOP_REQUEST_TURN_PREVIEW).map((message) => message.payload.turnId)).toEqual(['turn-2']);
    expect(screen.getByRole('dialog', { name: 'Jill · Answer two' })).toBeTruthy();
    expect(announcer().textContent).toBe('The turn is too far back to load into the thread, so the reader shows it instead.');
  });

  it(`lands on a target in its ${PROMPT_BUDGETS.workshopThread.jumpPages}rd one-turn page, and opens the reader for one a page further back`, async () => {
    // One-turn pages, as a byte bound could make them: turn-4, turn-3, then turn-2.
    const onePage = (n: number) => page(n, n);
    fireEvent.click(row());
    [4, 3, 2].forEach((n, index) => answer(asked()[index], { page: onePage(n) }));
    await settle();
    expect(asked()).toHaveLength(PROMPT_BUDGETS.workshopThread.jumpPages);
    expect(document.activeElement).toBe(bubble('turn-2'));

    const first: WorkshopBookmarkSummary = { id: 'bookmark-1', turnId: 'turn-1', label: 'You · Question one', participant: 'writer', inWindow: false };
    deliver(session({ roomRevision: 2, bookmarks: [first] }));
    vscode.postMessage.mockClear();
    fireEvent.click(within(screen.getByLabelText('Session rail')).getByRole('button', { name: 'You · Question one: show it in the thread' }));
    [4, 3, 2].forEach((n, index) => answer({ ...asked()[index], roomRevision: 2 }, { page: onePage(n) }));
    await settle();

    expect(asked()).toHaveLength(PROMPT_BUDGETS.workshopThread.jumpPages);
    expect(posted(MessageType.WORKSHOP_REQUEST_TURN_PREVIEW).map((message) => message.payload.turnId)).toEqual(['turn-1']);
    expect(screen.getByRole('dialog', { name: 'You · Question one' })).toBeTruthy();
    expect(announcer().textContent).toBe('The turn is too far back to load into the thread, so the reader shows it instead.');
  });

  describe('a newer choice of a drawn turn supersedes the jump still loading (PR #281 P2)', () => {
    const visible: WorkshopBookmarkSummary = {
      id: 'bookmark-6', turnId: 'turn-6', label: 'Jill · Answer six', participant: 'host', personaId: 'jill', inWindow: true
    };
    const chooseOlderThenVisible = () => {
      deliver(session({ bookmarks: [older, visible] }));
      fireEvent.click(row());
      fireEvent.click(within(screen.getByLabelText('Session rail'))
        .getByRole('button', { name: 'Jill · Answer six: show it in the thread' }));
      expect(document.activeElement).toBe(bubble('turn-6'));
      expect(row().getAttribute('aria-busy')).toBeNull();
    };

    it('keeps the focus on the newer bookmark when the late page lands; pages already shown stay', async () => {
      deliver(session({ bookmarks: [older, visible] }));
      fireEvent.click(row());
      answer(asked()[0], { page: page(3, 4) });
      expect(asked()).toHaveLength(2);
      fireEvent.click(within(screen.getByLabelText('Session rail'))
        .getByRole('button', { name: 'Jill · Answer six: show it in the thread' }));
      expect(document.activeElement).toBe(bubble('turn-6'));

      answer(asked()[1], { page: page(1, 2) });
      await settle();

      expect(document.activeElement).toBe(bubble('turn-6'));
      expect(bubbleIds()).toEqual(['turn-3', 'turn-4', 'turn-5', 'turn-6', 'turn-7', 'turn-8']);
      expect(asked()).toHaveLength(2);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens no reader when the late answer is a refusal', async () => {
      chooseOlderThenVisible();
      answer(asked()[0], { error: 'This room no longer holds the turn to show.' });
      await settle();

      expect(document.activeElement).toBe(bubble('turn-6'));
      expect(posted(MessageType.WORKSHOP_REQUEST_TURN_PREVIEW)).toEqual([]);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('does the same for the Bookmarks screen\'s Show in thread', async () => {
      deliver(session({ bookmarks: [older, visible] }));
      fireEvent.click(row());
      fireEvent.click(within(screen.getByLabelText('Session rail')).getByRole('button', { name: 'All bookmarks…' }));
      const live = posted(MessageType.WORKSHOP_REQUEST_LIVE_BOOKMARKS).at(-1)!.payload;
      deliver({
        type: MessageType.WORKSHOP_LIVE_BOOKMARKS,
        source: 'extension.workshop',
        payload: {
          ...live,
          bookmarks: [{
            bookmarkId: 'bookmark-6', turnId: 'turn-6', label: 'Jill · Answer six', createdAt: 1, speaker: 'Jill', identity: 'jill',
            message: { kind: 'reply', speaker: 'Jill', content: 'Answer 6 about the tea table.', timestamp: 6 }
          }]
        },
        timestamp: 2
      });
      fireEvent.click(screen.getByRole('button', { name: 'Show Jill · Answer six in the thread' }));
      await settle();
      expect(document.activeElement).toBe(bubble('turn-6'));

      answer(asked()[0], { page: page(1, 4) });
      await settle();

      expect(document.activeElement).toBe(bubble('turn-6'));
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('is abandoned by a new room: its late answer opens nothing', async () => {
    fireEvent.click(row());
    deliver(session({ roomRevision: 2, bookmarks: [older] }));
    answer(asked()[0], { page: page(1, 4) });
    await settle();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(posted(MessageType.WORKSHOP_REQUEST_TURN_PREVIEW)).toEqual([]);
    expect(bubbleIds()).toEqual(['turn-5', 'turn-6', 'turn-7', 'turn-8']);
  });
});
