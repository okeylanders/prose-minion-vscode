/** @jest-environment jsdom */

/**
 * The writer's tapback (ADR 2026-11-07 D8; Slice 3c), through the real App:
 * on the writer's own message, personas' reactions sit in a frame with the
 * bubble, right after its text and before the action row, so screen readers
 * and the tab order reach them after the words; only a bubble with reactions
 * is marked as a tapback and reserves room for it. A persona's reply keeps
 * 3b's corner in its footer. Every 3b behavior holds on the tapback: Hide on
 * press, the double-activation guard, locked-room `aria-disabled`, and focus
 * after a removal. Where it is drawn is CSS alone, proved by the visual
 * harness in `docs/pr-reviews/evidence/workshop-reactions-slice-3c-tapback/`.
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
import type { WorkshopTurnReactionSummary } from '@messages';
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

const bubble = (turnId: string) =>
  document.querySelector<HTMLElement>(`[${WORKSHOP_TURN_ID_ATTRIBUTE}="${turnId}"]`)!;

const jill: WorkshopTurnReactionSummary = { turnId: 'turn-1', reaction: 'heart', author: { kind: 'host' }, label: 'Jill' };
const margot: WorkshopTurnReactionSummary = {
  turnId: 'turn-1', reaction: 'eyes', author: { kind: 'personaGuest', personaId: 'margot' }, label: 'Margot'
};
const theo: WorkshopTurnReactionSummary = {
  turnId: 'turn-1', reaction: 'thinking', author: { kind: 'personaGuest', personaId: 'theo' }, label: 'Theo'
};

const TAPBACK = '[data-pm-reaction-tapback]';
const frame = (turnId: string) => bubble(turnId).querySelector<HTMLElement>('.pm-ws-turn-message-frame');
const follows = (later: Element, earlier: Element) =>
  Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('WorkshopApp writer tapback', () => {
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

  const item = (name: string) => within(bubble('turn-1')).getByRole('button', { name });

  it('puts personas\' reactions in the writer bubble\'s frame, after its text and before the action row', () => {
    render(<WorkshopApp />);
    deliver(session({ reactions: [jill, margot, theo] }));

    const writerFrame = frame('turn-1')!;
    expect(writerFrame.matches(TAPBACK)).toBe(true);
    expect(writerFrame.classList.contains('pm-ws-turn-message-frame-tapback')).toBe(true);
    const [message, corner] = Array.from(writerFrame.children);
    expect(message.className).toBe('pm-ws-turn-message');
    expect(message.textContent).toBe('Does the lantern beat land?');
    expect(corner.className).toBe('pm-ws-reaction-corner');
    const cluster = within(bubble('turn-1')).getByRole('group', { name: 'Reactions' });
    expect(corner.contains(cluster)).toBe(true);
    expect(within(cluster).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Jill reacted: heart. Remove',
      'Margot reacted: eyes. Remove',
      'Theo reacted: thinking. Remove'
    ]);
    // Reading and tab order: the words, then the reactions, then Bookmark and the rest.
    const actions = bubble('turn-1').querySelector('.pm-ws-turn-actions-writer')!;
    expect(follows(cluster, message)).toBe(true);
    expect(follows(actions, cluster)).toBe(true);
    // Still no "Add reaction" on the writer's own message.
    expect(within(bubble('turn-1')).queryByRole('button', { name: 'Add reaction' })).toBeNull();
  });

  it('reserves no room on a writer bubble without reactions, and drops it when the last one goes', () => {
    render(<WorkshopApp />);
    deliver(session());

    expect(frame('turn-1')!.matches(TAPBACK)).toBe(false);
    expect(frame('turn-1')!.className).toBe('pm-ws-turn-message-frame');
    // The corner stays mounted, empty (CSS hides it), so a removal's focus can still find the bubble.
    expect(frame('turn-1')!.querySelector('.pm-ws-reaction-corner')!.childElementCount).toBe(0);

    deliver(session({ reactions: [jill] }));
    expect(frame('turn-1')!.matches(TAPBACK)).toBe(true);
    const jillItem = item('Jill reacted: heart. Remove');
    jillItem.focus();
    fireEvent.click(jillItem);
    deliver(session());

    expect(frame('turn-1')!.matches(TAPBACK)).toBe(false);
    // Focus falls back to the writer's bubble, never the page.
    expect(document.activeElement).toBe(bubble('turn-1'));
  });

  it('leaves a persona\'s reply with 3b\'s corner in its footer, never a tapback', () => {
    render(<WorkshopApp />);
    deliver(session({ reactions: [{ ...jill, turnId: 'turn-2' }, { ...margot, turnId: 'turn-2' }] }));

    expect(bubble('turn-2').querySelector(TAPBACK)).toBeNull();
    expect(bubble('turn-2').querySelector('.pm-ws-turn-message-frame')).toBeNull();
    const corner = bubble('turn-2').querySelector<HTMLElement>('.pm-ws-reaction-corner')!;
    expect(corner.parentElement?.className).toBe('pm-ws-turn-foot');
    expect(within(corner).getByRole('button', { name: 'Add reaction' })).toBeTruthy();
  });

  it('hides a persona\'s reaction on press, once for a double click, and hands focus on through the cluster', () => {
    render(<WorkshopApp />);
    deliver(session({ reactions: [jill, margot, theo] }));

    const margotItem = item('Margot reacted: eyes. Remove');
    margotItem.focus();
    fireEvent.click(margotItem);
    // The second press lands on whatever slid under the pointer: it does nothing (PR #248 M1).
    fireEvent.click(item('Theo reacted: thinking. Remove'));
    expect(posted(MessageType.WORKSHOP_HIDE_TURN_REACTION)).toEqual([
      { turnId: 'turn-1', reaction: 'eyes', author: { kind: 'personaGuest', personaId: 'margot' } }
    ]);

    deliver(session({ reactions: [jill, theo] }));
    // The next reaction takes focus; past the end, the previous one.
    expect(document.activeElement).toBe(item('Theo reacted: thinking. Remove'));
    fireEvent.click(item('Theo reacted: thinking. Remove'));
    deliver(session({ reactions: [jill] }));
    expect(document.activeElement).toBe(item('Jill reacted: heart. Remove'));
  });

  it('keeps a locked tapback focusable and inert', () => {
    render(<WorkshopApp />);
    deliver(session({ activeToolId: 'prose', reactions: [jill] }));

    const jillItem = item('Jill reacted: heart. Remove');
    expect(frame('turn-1')!.matches(TAPBACK)).toBe(true);
    expect(jillItem.getAttribute('aria-disabled')).toBe('true');
    expect(jillItem.hasAttribute('disabled')).toBe(false);
    jillItem.focus();
    expect(document.activeElement).toBe(jillItem);
    fireEvent.click(jillItem);
    expect(posted(MessageType.WORKSHOP_HIDE_TURN_REACTION)).toEqual([]);
  });
});
