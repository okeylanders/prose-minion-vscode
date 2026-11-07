/** @jest-environment jsdom */

/**
 * WorkshopApp reactions (ADR 2026-11-07 D8), through the real App: a persona
 * reply's "Add reaction" opens the palette in three labelled groups, the
 * keyboard moves through it and Escape returns focus to the button; a pick
 * posts ids only and waits for the host; the writer's chips are toggles that
 * remove; a persona's chip has a Hide action. The webview persists nothing.
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

/** Lets overlay cleanups and their queued focus restores run. */
const settle = async () => {
  await act(async () => {
    jest.runAllTicks();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const mine = (turnId: string, reaction: WorkshopTurnReactionSummary['reaction']): WorkshopTurnReactionSummary => ({
  turnId,
  reaction,
  author: { kind: 'writer' },
  label: 'You'
});

describe('WorkshopApp reactions', () => {
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

  const addButton = (turnId: string) => within(bubble(turnId)).getByRole('button', { name: /Add reaction/ });

  it('offers "Add reaction" on a persona reply, and not on the writer\'s own message', () => {
    render(<WorkshopApp />);
    deliver(session());

    expect(addButton('turn-2').getAttribute('aria-expanded')).toBe('false');
    expect(within(bubble('turn-1')).queryByRole('button', { name: /Add reaction/ })).toBeNull();
  });

  it('opens the palette in three labelled groups, focused on its first reaction', () => {
    render(<WorkshopApp />);
    deliver(session());

    fireEvent.click(addButton('turn-2'));

    const palette = screen.getByRole('dialog', { name: 'Add a reaction' });
    expect(within(palette).getAllByRole('group').map((group) => group.getAttribute('aria-labelledby'))
      .map((id) => document.getElementById(id!)?.textContent)).toEqual(['Warm', 'Curious', 'Negative']);
    expect(within(palette).getAllByRole('button')).toHaveLength(19);
    expect(within(within(palette).getByRole('group', { name: 'Curious' })).getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'))).toEqual(['thinking', 'eyes', 'surprised']);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('heart');
    expect(addButton('turn-2').getAttribute('aria-expanded')).toBe('true');
  });

  it('moves with the arrow keys, Home and End, and Escape closes it and returns focus to the button', () => {
    render(<WorkshopApp />);
    deliver(session());
    fireEvent.click(addButton('turn-2'));
    const palette = screen.getByRole('dialog', { name: 'Add a reaction' });
    const focused = () => document.activeElement?.getAttribute('aria-label');

    fireEvent.keyDown(palette, { key: 'ArrowRight' });
    expect(focused()).toBe('thumbs up');
    fireEvent.keyDown(palette, { key: 'ArrowDown' });
    expect(focused()).toBe('laughing');
    fireEvent.keyDown(palette, { key: 'ArrowLeft' });
    expect(focused()).toBe('mind-blown');
    fireEvent.keyDown(palette, { key: 'ArrowUp' });
    expect(focused()).toBe('heart');
    fireEvent.keyDown(palette, { key: 'End' });
    expect(focused()).toBe('frustrated');
    fireEvent.keyDown(palette, { key: 'Home' });
    expect(focused()).toBe('heart');
    // Only the focused option is in the tab order.
    expect(within(palette).getAllByRole('button').filter((button) => button.tabIndex === 0)).toHaveLength(1);

    fireEvent.keyDown(palette, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Add a reaction' })).toBeNull();
    expect(document.activeElement).toBe(addButton('turn-2'));
    expect(posted(MessageType.WORKSHOP_SET_TURN_REACTION)).toEqual([]);
  });

  it('posts a pick by ids only, closes, and changes nothing until the host answers', () => {
    render(<WorkshopApp />);
    deliver(session());
    fireEvent.click(addButton('turn-2'));

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'mind-blown' }));

    expect(posted(MessageType.WORKSHOP_SET_TURN_REACTION)).toEqual([
      { turnId: 'turn-2', reaction: 'mind-blown', reacted: true }
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(addButton('turn-2'));
    expect(within(bubble('turn-2')).queryByRole('button', { name: 'You reacted: mind-blown' })).toBeNull();

    deliver(session({ reactions: [mine('turn-2', 'mind-blown')] }));
    const chip = within(bubble('turn-2')).getByRole('button', { name: 'You reacted: mind-blown' });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(chip.textContent).toBe('\u{1F92F}');
  });

  it('removes the writer\'s reaction from its chip, or by picking it again in the palette', () => {
    render(<WorkshopApp />);
    deliver(session({ reactions: [mine('turn-2', 'fire'), mine('turn-2', 'heart')] }));

    fireEvent.click(within(bubble('turn-2')).getByRole('button', { name: 'You reacted: fire' }));
    expect(posted(MessageType.WORKSHOP_SET_TURN_REACTION).at(-1)).toEqual({ turnId: 'turn-2', reaction: 'fire', reacted: false });

    fireEvent.click(addButton('turn-2'));
    const heart = within(screen.getByRole('dialog')).getByRole('button', { name: 'heart' });
    expect(heart.getAttribute('aria-pressed')).toBe('true');
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'sad' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(heart);
    expect(posted(MessageType.WORKSHOP_SET_TURN_REACTION).at(-1)).toEqual({ turnId: 'turn-2', reaction: 'heart', reacted: false });
  });

  it('draws a persona\'s reaction as a named chip with a Hide action that posts its author', () => {
    render(<WorkshopApp />);
    deliver(session({
      reactions: [{ turnId: 'turn-1', reaction: 'heart', author: { kind: 'host' }, label: 'Jill' }]
    }));

    const chip = within(bubble('turn-1')).getByRole('group', { name: 'Jill reacted: heart' });
    fireEvent.click(within(chip).getByRole('button', { name: 'Hide Jill\'s heart' }));

    expect(posted(MessageType.WORKSHOP_HIDE_TURN_REACTION)).toEqual([
      { turnId: 'turn-1', reaction: 'heart', author: { kind: 'host' } }
    ]);
  });

  it('closes when focus leaves it, without taking focus back (PR #245 L3)', () => {
    render(<WorkshopApp />);
    deliver(session());
    fireEvent.click(addButton('turn-2'));
    const option = within(screen.getByRole('dialog')).getByRole('button', { name: 'heart' });

    // Focus moving to the button keeps it open: the button's own toggle decides.
    fireEvent.focusOut(option, { relatedTarget: addButton('turn-2') });
    expect(screen.getByRole('dialog')).toBeTruthy();

    const elsewhere = within(bubble('turn-2')).getByRole('button', { name: 'Copy' });
    fireEvent.focusOut(option, { relatedTarget: elsewhere });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(addButton('turn-2').getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on a lock and returns focus to its button, which stays focusable (PR #245 L2)', () => {
    render(<WorkshopApp />);
    deliver(session());
    fireEvent.click(addButton('turn-2'));
    expect(screen.getByRole('dialog')).toBeTruthy();

    deliver(session({ activeToolId: 'prose' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(addButton('turn-2'));
    expect(addButton('turn-2').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(addButton('turn-2'));
    expect(screen.queryByRole('dialog')).toBeNull();
    // A locked chip does nothing either.
    deliver(session({ activeToolId: 'prose', reactions: [mine('turn-2', 'fire')] }));
    fireEvent.click(within(bubble('turn-2')).getByRole('button', { name: 'You reacted: fire' }));
    expect(posted(MessageType.WORKSHOP_SET_TURN_REACTION)).toEqual([]);
  });

  it('hands focus to the next chip, then to "Add reaction", as chips are removed (PR #245 L2)', () => {
    render(<WorkshopApp />);
    deliver(session({ reactions: [mine('turn-2', 'fire'), mine('turn-2', 'heart')] }));

    const fire = within(bubble('turn-2')).getByRole('button', { name: 'You reacted: fire' });
    fire.focus();
    fireEvent.click(fire);
    deliver(session({ reactions: [mine('turn-2', 'heart')] }));
    const heart = within(bubble('turn-2')).getByRole('button', { name: 'You reacted: heart' });
    expect(document.activeElement).toBe(heart);

    fireEvent.click(heart);
    deliver(session());
    expect(document.activeElement).toBe(addButton('turn-2'));
  });

  it('hands focus from a hidden persona chip on the writer\'s bubble to the next one', () => {
    render(<WorkshopApp />);
    const jill = { turnId: 'turn-1', reaction: 'heart', author: { kind: 'host' }, label: 'Jill' } as const;
    const margot = {
      turnId: 'turn-1', reaction: 'eyes', author: { kind: 'personaGuest', personaId: 'margot' }, label: 'Margot'
    } as const;
    deliver(session({ reactions: [jill, margot] }));

    const hideJill = within(bubble('turn-1')).getByRole('button', { name: 'Hide Jill\'s heart' });
    hideJill.focus();
    fireEvent.click(hideJill);
    deliver(session({ reactions: [margot] }));

    expect(document.activeElement).toBe(within(bubble('turn-1')).getByRole('button', { name: 'Hide Margot\'s eyes' }));
    expect(within(bubble('turn-1')).getByRole('group', { name: 'Margot reacted: eyes' })).toBeTruthy();
  });

  it('persists nothing of reactions in the webview\'s state', () => {
    render(<WorkshopApp />);
    deliver(session({ reactions: [mine('turn-2', 'fire')] }));
    fireEvent.click(within(bubble('turn-2')).getByRole('button', { name: 'You reacted: fire' }));

    expect(JSON.stringify(vscode.setState.mock.calls)).not.toContain('reaction');
  });
});
