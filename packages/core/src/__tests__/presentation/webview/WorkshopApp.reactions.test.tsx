/** @jest-environment jsdom */

/**
 * WorkshopApp reactions (ADR 2026-11-07 D8; Slice 3b), through the real App:
 * a persona reply's corner holds its reactions left to right and an icon
 * "Add reaction" button, which opens the palette in three labelled groups
 * (up, or down without room above); the keyboard moves through it and Escape
 * returns focus to the button; a pick posts ids only and waits for the host;
 * a click on any reaction removes it (a persona's by Hide). The webview
 * persists nothing.
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

  const addButton = (turnId: string) => within(bubble(turnId)).getByRole('button', { name: 'Add reaction' });
  const corner = (turnId: string) => bubble(turnId).querySelector<HTMLElement>('.pm-ws-reaction-corner')!;
  const cluster = (turnId: string) => within(bubble(turnId)).getByRole('group', { name: 'Reactions' });

  it('offers an icon "Add reaction" button in a persona reply\'s corner, always shown, and none on the writer\'s own message', () => {
    render(<WorkshopApp />);
    deliver(session());

    const add = addButton('turn-2');
    expect(add.getAttribute('aria-expanded')).toBe('false');
    expect(add.getAttribute('title')).toBe('Add reaction');
    // An icon, not a text label: the name is its accessible name alone.
    expect(add.textContent).toBe('');
    expect(add.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    // In the bubble's corner, outside the action row, and not hover-only.
    expect(corner('turn-2').contains(add)).toBe(true);
    expect(add.closest('.pm-ws-turn-actions')).toBeNull();
    expect(corner('turn-2').parentElement).toBe(bubble('turn-2'));
    expect(corner('turn-2').className).not.toMatch(/hover/);
    expect(within(bubble('turn-1')).queryByRole('button', { name: 'Add reaction' })).toBeNull();
  });

  it('lines a bubble\'s reactions up left to right before the button: the writer\'s first, then personas\'', () => {
    render(<WorkshopApp />);
    const jill = { turnId: 'turn-2', reaction: 'heart', author: { kind: 'host' }, label: 'Jill' } as const;
    const margot = {
      turnId: 'turn-2', reaction: 'eyes', author: { kind: 'personaGuest', personaId: 'margot' }, label: 'Margot'
    } as const;
    deliver(session({ reactions: [jill, mine('turn-2', 'fire'), margot] }));

    expect(within(cluster('turn-2')).getAllByRole('button').map((item) => item.getAttribute('aria-label'))).toEqual([
      'You reacted: fire. Remove',
      'Jill reacted: heart. Remove',
      'Margot reacted: eyes. Remove'
    ]);
    const [, jillItem] = within(cluster('turn-2')).getAllByRole('button');
    expect(jillItem.textContent).toBe('❤️Jill');
    // The title is the name, so a screen reader hears it once (PR #248 L2).
    expect(jillItem.getAttribute('title')).toBe('Jill reacted: heart. Remove');
    // The cluster, then the button, in one corner.
    expect(Array.from(corner('turn-2').children).map((child) => child.className)).toEqual([
      'pm-ws-reaction-cluster', 'pm-ws-reaction-wrap'
    ]);
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

  it('opens the palette up, and down when the button sits too near the top (PR #245 L4)', () => {
    render(<WorkshopApp />);
    deliver(session());
    const rect = (top: number, height: number) => ({
      top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({})
    }) as DOMRect;
    const original = Element.prototype.getBoundingClientRect;
    let triggerTop = 600;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.classList.contains('pm-ws-reaction-add')) {
        return rect(triggerTop, 28);
      }
      return this.classList.contains('pm-ws-reaction-palette') ? rect(0, 200) : original.call(this);
    };
    try {
      fireEvent.click(addButton('turn-2'));
      expect(screen.getByRole('dialog').getAttribute('data-placement')).toBe('up');
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      // The first option is focused only once the palette is placed, so the browser
      // never scrolls toward a palette drawn on the side with no room.
      const focus = jest.spyOn(HTMLElement.prototype, 'focus');
      const placedAtFocus: (string | null)[] = [];
      focus.mockImplementation(function (this: HTMLElement) {
        placedAtFocus.push(this.closest('[role="dialog"]')?.getAttribute('data-placement') ?? null);
      });
      triggerTop = 40;
      fireEvent.click(addButton('turn-2'));
      focus.mockRestore();
      expect(screen.getByRole('dialog').getAttribute('data-placement')).toBe('down');
      expect(screen.getByRole('dialog').className).toContain('pm-ws-reaction-palette-down');
      expect(screen.getByRole('dialog').style.visibility).toBe('');
      expect(placedAtFocus).toEqual(['down']);
    } finally {
      Element.prototype.getBoundingClientRect = original;
    }
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
    expect(within(bubble('turn-2')).queryByRole('button', { name: 'You reacted: mind-blown. Remove' })).toBeNull();

    deliver(session({ reactions: [mine('turn-2', 'mind-blown')] }));
    const item = within(cluster('turn-2')).getByRole('button', { name: 'You reacted: mind-blown. Remove' });
    expect(item.textContent).toBe('\u{1F92F}');
  });

  it('removes the writer\'s reaction with a click on it, or by picking it again in the palette', () => {
    render(<WorkshopApp />);
    deliver(session({ reactions: [mine('turn-2', 'fire'), mine('turn-2', 'heart')] }));

    fireEvent.click(within(bubble('turn-2')).getByRole('button', { name: 'You reacted: fire. Remove' }));
    expect(posted(MessageType.WORKSHOP_SET_TURN_REACTION).at(-1)).toEqual({ turnId: 'turn-2', reaction: 'fire', reacted: false });

    fireEvent.click(addButton('turn-2'));
    const heart = within(screen.getByRole('dialog')).getByRole('button', { name: 'heart' });
    expect(heart.getAttribute('aria-pressed')).toBe('true');
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'sad' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(heart);
    expect(posted(MessageType.WORKSHOP_SET_TURN_REACTION).at(-1)).toEqual({ turnId: 'turn-2', reaction: 'heart', reacted: false });
  });

  it('removes a persona\'s reaction with a click on it, posting a Hide with its author, and offers no separate Hide', () => {
    render(<WorkshopApp />);
    deliver(session({
      reactions: [{ turnId: 'turn-1', reaction: 'heart', author: { kind: 'host' }, label: 'Jill' }]
    }));

    expect(within(bubble('turn-1')).queryByRole('button', { name: /^Hide/ })).toBeNull();
    fireEvent.click(within(cluster('turn-1')).getByRole('button', { name: 'Jill reacted: heart. Remove' }));

    expect(posted(MessageType.WORKSHOP_HIDE_TURN_REACTION)).toEqual([
      { turnId: 'turn-1', reaction: 'heart', author: { kind: 'host' } }
    ]);
    expect(posted(MessageType.WORKSHOP_SET_TURN_REACTION)).toEqual([]);
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
    // A locked reaction stays focusable and does nothing either, the writer's or a persona's.
    deliver(session({
      activeToolId: 'prose',
      reactions: [mine('turn-2', 'fire'), { turnId: 'turn-1', reaction: 'heart', author: { kind: 'host' }, label: 'Jill' }]
    }));
    const fire = within(bubble('turn-2')).getByRole('button', { name: 'You reacted: fire. Remove' });
    const jill = within(bubble('turn-1')).getByRole('button', { name: 'Jill reacted: heart. Remove' });
    for (const item of [fire, jill]) {
      expect(item.getAttribute('aria-disabled')).toBe('true');
      expect(item.hasAttribute('disabled')).toBe(false);
      expect(item.getAttribute('title')).toBe('Wait for the room to finish before reacting');
      fireEvent.click(item);
    }
    expect(posted(MessageType.WORKSHOP_SET_TURN_REACTION)).toEqual([]);
    expect(posted(MessageType.WORKSHOP_HIDE_TURN_REACTION)).toEqual([]);
  });

  it('hands focus to the next reaction, then the previous, then to "Add reaction", as reactions are removed (PR #245 L2)', () => {
    render(<WorkshopApp />);
    deliver(session({ reactions: [mine('turn-2', 'fire'), mine('turn-2', 'heart'), mine('turn-2', 'eyes')] }));

    const fire = within(bubble('turn-2')).getByRole('button', { name: 'You reacted: fire. Remove' });
    fire.focus();
    fireEvent.click(fire);
    deliver(session({ reactions: [mine('turn-2', 'heart'), mine('turn-2', 'eyes')] }));
    expect(document.activeElement).toBe(within(bubble('turn-2')).getByRole('button', { name: 'You reacted: heart. Remove' }));

    // The last one removed: focus goes back to the one before it.
    const eyes = within(bubble('turn-2')).getByRole('button', { name: 'You reacted: eyes. Remove' });
    eyes.focus();
    fireEvent.click(eyes);
    deliver(session({ reactions: [mine('turn-2', 'heart')] }));
    const heart = within(bubble('turn-2')).getByRole('button', { name: 'You reacted: heart. Remove' });
    expect(document.activeElement).toBe(heart);

    fireEvent.click(heart);
    deliver(session());
    expect(document.activeElement).toBe(addButton('turn-2'));
  });

  it('hands focus from a removed persona reaction on the writer\'s bubble to the next one', () => {
    render(<WorkshopApp />);
    const jill = { turnId: 'turn-1', reaction: 'heart', author: { kind: 'host' }, label: 'Jill' } as const;
    const margot = {
      turnId: 'turn-1', reaction: 'eyes', author: { kind: 'personaGuest', personaId: 'margot' }, label: 'Margot'
    } as const;
    deliver(session({ reactions: [jill, margot] }));

    const jillItem = within(bubble('turn-1')).getByRole('button', { name: 'Jill reacted: heart. Remove' });
    jillItem.focus();
    fireEvent.click(jillItem);
    deliver(session({ reactions: [margot] }));

    expect(document.activeElement).toBe(within(bubble('turn-1')).getByRole('button', { name: 'Margot reacted: eyes. Remove' }));
  });

  it('hands focus to the writer\'s bubble itself when its last persona reaction is removed (PR #247 F-01)', () => {
    render(<WorkshopApp />);
    const jill = { turnId: 'turn-1', reaction: 'heart', author: { kind: 'host' }, label: 'Jill' } as const;
    deliver(session({ reactions: [jill] }));

    const jillItem = within(bubble('turn-1')).getByRole('button', { name: 'Jill reacted: heart. Remove' });
    jillItem.focus();
    fireEvent.click(jillItem);
    deliver(session());

    expect(within(bubble('turn-1')).queryByRole('group', { name: 'Reactions' })).toBeNull();
    expect(document.activeElement).toBe(bubble('turn-1'));
    expect(document.activeElement).not.toBe(document.body);
  });

  it('leaves focus where the writer moved it when the removal\'s snapshot arrives late', () => {
    render(<WorkshopApp />);
    const jill = { turnId: 'turn-1', reaction: 'heart', author: { kind: 'host' }, label: 'Jill' } as const;
    deliver(session({ reactions: [jill] }));

    const jillItem = within(bubble('turn-1')).getByRole('button', { name: 'Jill reacted: heart. Remove' });
    jillItem.focus();
    fireEvent.click(jillItem);
    const copy = within(bubble('turn-2')).getByRole('button', { name: 'Copy' });
    copy.focus();
    deliver(session());

    expect(document.activeElement).toBe(copy);
  });

  it('posts one removal for a double click, until the host\'s next snapshot (PR #248 M1, T1)', () => {
    render(<WorkshopApp />);
    const jill = { turnId: 'turn-2', reaction: 'heart', author: { kind: 'host' }, label: 'Jill' } as const;
    deliver(session({ reactions: [mine('turn-2', 'fire'), jill] }));

    // The second press lands on whatever slid under the pointer: it does nothing.
    fireEvent.click(within(cluster('turn-2')).getByRole('button', { name: 'Jill reacted: heart. Remove' }));
    fireEvent.click(within(cluster('turn-2')).getByRole('button', { name: 'You reacted: fire. Remove' }));
    fireEvent.click(within(cluster('turn-2')).getByRole('button', { name: 'Jill reacted: heart. Remove' }));
    expect(posted(MessageType.WORKSHOP_HIDE_TURN_REACTION)).toEqual([
      { turnId: 'turn-2', reaction: 'heart', author: { kind: 'host' } }
    ]);
    expect(posted(MessageType.WORKSHOP_SET_TURN_REACTION)).toEqual([]);

    // The host's answer re-arms the corner.
    deliver(session({ reactions: [mine('turn-2', 'fire')] }));
    fireEvent.click(within(cluster('turn-2')).getByRole('button', { name: 'You reacted: fire. Remove' }));
    expect(posted(MessageType.WORKSHOP_SET_TURN_REACTION)).toEqual([
      { turnId: 'turn-2', reaction: 'fire', reacted: false }
    ]);
  });

  it('re-arms on a refusal and disarms its focus hand-off (PR #248 L4)', () => {
    render(<WorkshopApp />);
    deliver(session({ reactions: [mine('turn-2', 'fire')] }));
    const fire = () => within(bubble('turn-2')).getByRole('button', { name: 'You reacted: fire. Remove' });

    fire().focus();
    fireEvent.click(fire());
    // The host refused: its snapshot keeps the reaction.
    deliver(session({ reactions: [mine('turn-2', 'fire')], roomRevision: 2 }));
    fireEvent.click(fire());
    expect(posted(MessageType.WORKSHOP_SET_TURN_REACTION)).toHaveLength(2);

    // A refusal again, focus dropped meanwhile; a later removal from elsewhere pulls nothing.
    deliver(session({ reactions: [mine('turn-2', 'fire')], roomRevision: 3 }));
    (document.activeElement as HTMLElement).blur();
    deliver(session({ roomRevision: 4 }));
    expect(document.activeElement).toBe(document.body);
  });

  it('removes a reaction pressed while the palette is open, and closes the palette (T1)', () => {
    render(<WorkshopApp />);
    deliver(session({ reactions: [mine('turn-2', 'fire')] }));
    fireEvent.click(addButton('turn-2'));
    expect(screen.getByRole('dialog')).toBeTruthy();

    const fire = within(cluster('turn-2')).getByRole('button', { name: 'You reacted: fire. Remove' });
    fireEvent.mouseDown(fire);
    fire.focus();
    fireEvent.click(fire);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(posted(MessageType.WORKSHOP_SET_TURN_REACTION)).toEqual([
      { turnId: 'turn-2', reaction: 'fire', reacted: false }
    ]);
    deliver(session());
    expect(document.activeElement).toBe(addButton('turn-2'));
  });

  it('closes the palette when the thread scrolls, returning focus only from inside it (PR #248 L3)', () => {
    render(<WorkshopApp />);
    deliver(session());
    const thread = bubble('turn-2').closest<HTMLElement>('.pm-ws-thread')!;
    thread.style.overflowY = 'auto';

    fireEvent.click(addButton('turn-2'));
    expect(document.activeElement?.getAttribute('aria-label')).toBe('heart');
    fireEvent.scroll(thread);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(addButton('turn-2'));

    // Focus back on the button (the palette stays open): the scroll closes it and moves no focus.
    fireEvent.click(addButton('turn-2'));
    addButton('turn-2').focus();
    expect(screen.getByRole('dialog')).toBeTruthy();
    const focus = jest.spyOn(HTMLElement.prototype, 'focus');
    fireEvent.scroll(thread);
    expect(focus).not.toHaveBeenCalled();
    focus.mockRestore();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('persists nothing of reactions in the webview\'s state', () => {
    render(<WorkshopApp />);
    deliver(session({ reactions: [mine('turn-2', 'fire')] }));
    fireEvent.click(within(bubble('turn-2')).getByRole('button', { name: 'You reacted: fire. Remove' }));

    expect(JSON.stringify(vscode.setState.mock.calls)).not.toContain('reaction');
  });
});
