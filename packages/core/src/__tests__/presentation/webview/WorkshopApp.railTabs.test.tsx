/** @jest-environment jsdom */

/**
 * WorkshopApp rail tabs (ADR 2026-11-03 D1, Wayfinding Slice 1): the rail is
 * Material and Notes, the Tools block is gone, the composer still opens every
 * tool, and existing rail actions still work through the tabs.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType,
  WorkshopSessionSnapshot,
  WorkshopSessionStateMessage,
  WorkshopTodoItem,
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
jest.mock('../../../presentation/webview/styles/workshop/memory.css', () => ({}));
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { WorkshopApp } from '@/presentation/webview/WorkshopApp';

const hostTurn: WorkshopTurn = {
  id: 'turn-1',
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  content: 'Let the father stay quiet one line longer.',
  timestamp: 1,
  excerptVersion: 0
};

const todo = (id: string): WorkshopTodoItem => ({
  id,
  text: `Move the father's silence ${id}.`,
  status: 'open',
  source: {
    kind: 'host_turn',
    personaId: 'jill',
    turnId: 'turn-1',
    participantLabel: 'Jill',
    findingKey: `finding-${id}`,
    findingText: 'x',
    excerptVersion: 0
  },
  createdAt: 1,
  stale: false
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
      turns: [hostTurn],
      turnRewindability: {},
      totalTurns: 1,
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

const deliver = (message: WorkshopSessionStateMessage) =>
  act(() => window.dispatchEvent(new MessageEvent('message', { data: message })));

const rail = () => screen.getByLabelText('Session rail');

describe('WorkshopApp rail tabs', () => {
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

  it('drops the rail Tools block, and the composer still opens every tool', () => {
    render(<WorkshopApp />);
    deliver(session());

    expect(within(rail()).getByRole('tablist', { name: 'Rail sections' })).toBeTruthy();
    expect(within(rail()).queryByText(/needs excerpt/i)).toBeNull();
    expect(within(rail()).queryByText(/^All \d+ tools/)).toBeNull();
    expect(within(rail()).queryByText('Tools')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
    expect(screen.getByRole('dialog', { name: /tools/i })).not.toBeNull();
  });

  it('keeps the empty thread\'s quick starts', () => {
    render(<WorkshopApp />);
    deliver(session({ scope: 'excerpt', turns: [], totalTurns: 0 }));
    expect(screen.getByRole('button', { name: 'Dialogue & Beats' })).toBeTruthy();
    expect(screen.getByText(/or run a tool below/)).toBeTruthy();
  });

  it('restores the stored tab and persists the one the writer picks', () => {
    vscode.getState.mockReturnValue({ workshopRailTab: 'notes' });
    render(<WorkshopApp />);
    deliver(session({ todos: [todo('a')] }));
    expect(screen.getByRole('tab', { name: /^Notes/ }).getAttribute('aria-selected')).toBe('true');
    expect(within(rail()).getByText("Move the father's silence a.")).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /^Material/ }));
    expect(vscode.setState).toHaveBeenLastCalledWith(
      expect.objectContaining({ workshopRailTab: 'material' })
    );
  });

  it('opens a context pill from Material and shows a to-do\'s source from Notes', () => {
    render(<WorkshopApp />);
    deliver(session({
      todos: [todo('a')],
      contextAttachments: [{
        id: 'ctx-1', kind: 'text', origin: 'writer', label: 'Barn notes', words: 12, addedAt: 1
      }]
    }));

    fireEvent.click(within(rail()).getByText('Barn notes'));
    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_REQUEST_CONTEXT_ATTACHMENT,
      payload: { id: 'ctx-1' }
    }));

    fireEvent.click(screen.getByRole('tab', { name: /^Notes/ }));
    fireEvent.click(within(rail()).getByTitle('Show source turn turn-1'));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('badges a to-do that arrives while Notes is hidden, never on a new room', () => {
    render(<WorkshopApp />);
    deliver(session({ todos: [todo('a')] }));
    expect(screen.getByRole('tab', { name: 'Notes, 1 open' })).toBeTruthy();

    deliver(session({ todos: [todo('a'), todo('b')] }));
    expect(screen.getByRole('tab', { name: 'Notes, 2 open, 1 new' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /^Material/ }).getAttribute('aria-selected')).toBe('true');

    deliver(session({ roomRevision: 2, todos: [todo('x'), todo('y'), todo('z')] }));
    expect(screen.getByRole('tab', { name: 'Notes, 3 open' })).toBeTruthy();

    deliver(session({ roomRevision: 2, todos: [todo('x'), todo('y'), todo('z'), todo('w')] }));
    fireEvent.click(screen.getByRole('tab', { name: 'Notes, 4 open, 1 new' }));
    expect(screen.getByRole('tab', { name: 'Notes, 4 open' })).toBeTruthy();
  });
});
