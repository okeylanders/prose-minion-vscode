/** @jest-environment jsdom */

/**
 * WorkshopApp turn preview (ADR 2026-11-03 D6; Wayfinding Slice 5), through
 * the real App: a turn outside the window (a bookmark, a to-do's source, a
 * read-in card) opens in the read-only preview, which takes only its own
 * request's reply, returns focus to its opener, and closes on a room or
 * chat-target change.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType,
  WorkshopSessionSnapshot,
  WorkshopSessionStateMessage,
  WorkshopTurn
} from '@messages';
import type { WorkshopBookmarkSummary } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../presentation/webview/styles/workshop/tokens.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/shell.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/context.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/session.css', () => ({}));
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

const hostTurn: WorkshopTurn = {
  id: 'turn-2',
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  content: 'Let the father stay quiet one line longer.',
  timestamp: 2,
  excerptVersion: 0
};

const writerTurn: WorkshopTurn = {
  id: 'turn-1',
  role: 'user',
  kind: 'message',
  participant: 'writer',
  artifact: 'persona_message',
  content: 'Does the lantern beat land?',
  timestamp: 1,
  excerptVersion: 0
};

const mark = (id: string, turnId: string, label: string, inWindow = true): WorkshopBookmarkSummary => ({
  id,
  turnId,
  label,
  participant: turnId === 'turn-1' ? 'writer' : 'host',
  ...(turnId === 'turn-1' ? {} : { personaId: 'jill' as const }),
  inWindow
});

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
      turns: [writerTurn, hostTurn],
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

const rail = () => screen.getByLabelText('Session rail');
const thread = () => screen.getByLabelText('Session thread');
const bubble = (turnId: string) =>
  document.querySelector<HTMLElement>(`[${WORKSHOP_TURN_ID_ATTRIBUTE}="${turnId}"]`)!;

/** Lets overlay cleanups and their queued focus restores run. */
const settle = async () => {
  await act(async () => {
    jest.runAllTicks();
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('WorkshopApp turn preview', () => {
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

  const posted = (type: MessageType) => vscode.postMessage.mock.calls
    .map(([entry]: [{ type: MessageType; payload: Record<string, unknown> }]) => entry)
    .filter((entry) => entry.type === type)
    .map((entry) => entry.payload);

  describe('the turn preview (D6)', () => {
    const openNotes = () => fireEvent.click(screen.getByRole('tab', { name: /^Notes/ }));
    const previewRequests = () => posted(MessageType.WORKSHOP_REQUEST_TURN_PREVIEW) as Array<{ requestId: string; turnId: string; roomRevision: number }>;
    const answer = (requestId: string, turnId: string, content: string, roomRevision = 1) => deliver({
      type: MessageType.WORKSHOP_TURN_PREVIEW,
      source: 'extension.workshop',
      payload: { requestId, turnId, roomRevision, turn: { kind: 'reply', speaker: 'Jill', content, timestamp: 5 } },
      timestamp: 6
    });
    const older = mark('bookmark-3-1', 'turn-0', 'Jill · An older reply', false);
    const openOlder = () => {
      const row = within(rail()).getByRole('button', { name: 'Jill · An older reply: open it in the reader' });
      row.focus();
      fireEvent.click(row);
      return row;
    };

    it('opens an out-of-window bookmark in the preview, read-only, with the frame behind it inert', async () => {
      render(<WorkshopApp />);
      deliver(session({ bookmarks: [older] }));
      openNotes();

      openOlder();
      await settle();

      expect(previewRequests()).toEqual([{ requestId: expect.any(String), turnId: 'turn-0', roomRevision: 1 }]);
      const sheet = screen.getByRole('dialog', { name: 'Jill · An older reply' });
      expect(within(sheet).getByText('Loading the message…')).toBeTruthy();
      expect(thread().closest('[inert]')).not.toBeNull();

      answer(previewRequests()[0].requestId, 'turn-0', 'The **barn** opens on the eggs.');
      expect(within(sheet).getByText('Outside the loaded window')).toBeTruthy();
      expect(within(sheet).getByText('barn').tagName).toBe('STRONG');
      expect(within(sheet).queryByRole('button', { name: /Apply|Save changes/ })).toBeNull();
      // Opens on the rendered read; its Source pane is read-only too.
      expect(within(sheet).getByRole('tab', { name: 'Preview' }).getAttribute('aria-selected')).toBe('true');
      expect(sheet.querySelector('textarea')?.readOnly).toBe(true);
    });

    it('returns focus to the bookmark row when the preview closes', async () => {
      render(<WorkshopApp />);
      deliver(session({ bookmarks: [older] }));
      openNotes();

      const row = openOlder();
      await settle();
      fireEvent.keyDown(window, { key: 'Escape' });
      await settle();

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(row);
    });

    it('takes only the pending request\'s reply: an earlier opening\'s late answer never fills a later one', async () => {
      render(<WorkshopApp />);
      deliver(session({ bookmarks: [older] }));
      openNotes();

      openOlder();
      await settle();
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
      await settle();
      openOlder();
      await settle();
      const [first, second] = previewRequests();
      expect(second.requestId).not.toBe(first.requestId);

      answer(first.requestId, 'turn-0', 'A late answer.');
      expect(screen.queryByText('A late answer.')).toBeNull();
      answer(second.requestId, 'turn-0', 'The current answer.');
      answer(second.requestId, 'turn-0', 'A second answer.');
      expect(within(screen.getByRole('dialog')).getByText('The current answer.', { selector: 'p' })).toBeTruthy();
      expect(screen.queryByText('A second answer.')).toBeNull();
    });

    it('closes on a room change, and drops the request', async () => {
      render(<WorkshopApp />);
      deliver(session({ bookmarks: [older] }));
      openNotes();
      openOlder();
      await settle();
      const [request] = previewRequests();

      deliver(session({ roomRevision: 2, bookmarks: [older] }));
      await settle();
      expect(screen.queryByRole('dialog')).toBeNull();

      answer(request.requestId, 'turn-0', 'From the old room.');
      expect(screen.queryByText('From the old room.')).toBeNull();
    });

    describe('in the order the host posts during an Open: the preview, then the new room (PR #189 F-02)', () => {
      it('shows the host\'s refusal, never the other room\'s turn, then closes on the new room', async () => {
        render(<WorkshopApp />);
        deliver(session({ bookmarks: [older] }));
        openNotes();
        openOlder();
        await settle();
        const [request] = previewRequests();
        expect(request.roomRevision).toBe(1);

        deliver({
          type: MessageType.WORKSHOP_TURN_PREVIEW,
          source: 'extension.workshop',
          payload: {
            requestId: request.requestId,
            turnId: 'turn-0',
            roomRevision: 1,
            error: 'The room changed before this message could be shown.'
          },
          timestamp: 6
        });
        expect(within(screen.getByRole('dialog')).getByText(/The room changed before this message could be shown\./)).toBeTruthy();

        deliver(session({ roomRevision: 2, bookmarks: [older] }));
        await settle();
        expect(screen.queryByRole('dialog')).toBeNull();
      });

      it('never shows a reply that names another room, whatever comes after it', async () => {
        render(<WorkshopApp />);
        deliver(session({ bookmarks: [older] }));
        openNotes();
        openOlder();
        await settle();
        const [request] = previewRequests();

        answer(request.requestId, 'turn-0', 'The other room\'s turn.', 2);
        expect(screen.queryByText('The other room\'s turn.')).toBeNull();
        expect(within(screen.getByRole('dialog')).getByText('Loading the message…')).toBeTruthy();

        deliver(session({ roomRevision: 2, bookmarks: [older] }));
        await settle();
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.queryByText('The other room\'s turn.')).toBeNull();
      });
    });

    it('closes on a chat-target change', async () => {
      render(<WorkshopApp />);
      deliver(session({ bookmarks: [older] }));
      openNotes();
      openOlder();
      await settle();

      deliver(session({
        bookmarks: [older],
        participants: {
          host: { personaId: 'jill', hasConversation: true },
          toolSidecars: [],
          personaGuests: [],
          chatTarget: { kind: 'tool', toolId: 'prose' }
        }
      }));
      await settle();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens a to-do whose source is outside the window in the preview, never a notice', async () => {
      render(<WorkshopApp />);
      deliver(session({
        todos: [{
          id: 'todo-1',
          text: 'Let the father stay quiet.',
          status: 'open',
          source: {
            kind: 'host_turn',
            personaId: 'jill',
            turnId: 'turn-0',
            participantLabel: 'Jill',
            findingKey: 'finding-1',
            findingText: 'x',
            excerptVersion: 0
          },
          createdAt: 1,
          stale: false
        }]
      }));
      openNotes();

      fireEvent.click(within(rail()).getByTitle('Show source turn turn-0'));
      await settle();

      expect(previewRequests().map((request) => request.turnId)).toEqual(['turn-0']);
      expect(within(screen.getByRole('dialog')).getByText('Outside the loaded window')).toBeTruthy();
      expect(screen.queryByText(/outside the current reload window/)).toBeNull();
    });

    it('opens a read-in card outside the window in the preview', async () => {
      render(<WorkshopApp />);
      deliver(session({
        contextBudget: {
          label: 'Jill',
          sources: [{
            kind: 'dictionary', origin: 'host', label: 'tardy', sizeChars: 300, isEstimate: true,
            deliveredAt: 1_000, turnId: 'turn-0'
          }]
        }
      }));

      fireEvent.click(within(rail()).getByRole('button', { name: 'Show the card for tardy in the thread' }));
      await settle();

      expect(previewRequests().map((request) => request.turnId)).toEqual(['turn-0']);
      expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('still jumps a to-do whose source is in the window, asking for no preview', async () => {
      render(<WorkshopApp />);
      deliver(session({
        todos: [{
          id: 'todo-1',
          text: 'Let the father stay quiet.',
          status: 'open',
          source: {
            kind: 'host_turn',
            personaId: 'jill',
            turnId: 'turn-2',
            participantLabel: 'Jill',
            findingKey: 'finding-1',
            findingText: 'x',
            excerptVersion: 0
          },
          createdAt: 1,
          stale: false
        }]
      }));
      openNotes();
      fireEvent.click(within(rail()).getByTitle('Show source turn turn-2'));
      await settle();

      expect(document.activeElement).toBe(bubble('turn-2'));
      expect(previewRequests()).toEqual([]);
    });
  });
});
