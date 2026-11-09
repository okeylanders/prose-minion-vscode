/** @jest-environment jsdom */

/**
 * Persona reactions in the thread (ADR 2026-11-07 R1, D8, Q10), through the
 * real App: a reaction-only reply is a slim line ("Jill reacted ❤️") with no
 * palette, its chip on the writer's bubble; a new persona reaction is
 * announced once through a polite live region, only when its reply arrived
 * live, never on hydration or a snapshot re-render.
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


const reactionOnly: WorkshopTurn = { ...hostTurn, id: 'turn-3', content: 'Reacted with heart.', reactionOnly: 'heart' };
const jills: WorkshopTurnReactionSummary = {
  turnId: 'turn-1', reaction: 'heart', author: { kind: 'host' }, label: 'Jill', viaTurnId: 'turn-3'
};
const turnMessage = (turn: WorkshopTurn) => ({
  type: MessageType.WORKSHOP_TURN, source: 'extension.workshop', payload: { turn }, timestamp: 0
});
const region = () => document.querySelector<HTMLElement>('[data-pm-reaction-announcer]')!;

describe('WorkshopApp persona reactions', () => {
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

  it('draws a reaction-only reply as a slim line, with no palette, and the chip on the writer\'s bubble', () => {
    render(<WorkshopApp />);
    deliver(session({ turns: [writerTurn, reactionOnly], totalTurns: 2, reactions: [jills] }));

    const line = bubble('turn-3');
    expect(line.className).toContain('pm-ws-reaction-only');
    expect(line.textContent).toContain('Jill reacted');
    expect(within(line).getByRole('img', { name: 'heart' }).textContent).toBe('❤️');
    expect(within(line).queryByRole('button', { name: /Add reaction/ })).toBeNull();
    expect(line.textContent).not.toContain('Reacted with heart.');
    expect(within(bubble('turn-1')).getByRole('button', { name: 'Jill reacted: heart. Remove' })).toBeTruthy();
  });

  it('announces a persona reaction once, when its reply arrived live', () => {
    render(<WorkshopApp />);
    deliver(session());
    expect(region().textContent).toBe('');
    expect(region().getAttribute('aria-live')).toBe('polite');

    deliver(turnMessage(reactionOnly));
    deliver(session({ turns: [writerTurn, hostTurn, reactionOnly], totalTurns: 3, reactions: [jills] }));
    expect(region().textContent).toBe('Jill reacted heart to your message');
    const said = region().firstElementChild;

    // A re-render of the same room says nothing new.
    deliver(session({ turns: [writerTurn, hostTurn, reactionOnly], totalTurns: 3, reactions: [jills], roomRevision: 2 }));
    expect(region().firstElementChild).toBe(said);
  });

  it('announces nothing on hydration, Open or reload: no reply arrived live', () => {
    render(<WorkshopApp />);
    deliver(session({ turns: [writerTurn, hostTurn, reactionOnly], totalTurns: 3, reactions: [jills] }));
    expect(region().textContent).toBe('');
  });

  it('never announces across a room replacement: a live turn followed directly by an Open (PR #247 M2)', () => {
    render(<WorkshopApp />);
    deliver(session());
    deliver(turnMessage(reactionOnly));
    // The Open's room reuses the per-session turn ids, and its reaction names the same reply id.
    deliver(session({ turns: [writerTurn, hostTurn, reactionOnly], totalTurns: 3, reactions: [jills], roomRevision: 99 }));
    expect(region().textContent).toBe('');
    // A later snapshot of the opened room says nothing either: what was waiting was cleared.
    deliver(session({ turns: [writerTurn, hostTurn, reactionOnly], totalTurns: 3, reactions: [jills], roomRevision: 99 }));
    expect(region().textContent).toBe('');
  });

  it('never announces a reply the previous snapshot already showed', () => {
    render(<WorkshopApp />);
    deliver(session({ turns: [writerTurn, hostTurn, reactionOnly], totalTurns: 3, reactions: [jills] }));
    deliver(turnMessage(reactionOnly));
    deliver(session({ turns: [writerTurn, hostTurn, reactionOnly], totalTurns: 3, reactions: [jills] }));
    expect(region().textContent).toBe('');
  });
});
