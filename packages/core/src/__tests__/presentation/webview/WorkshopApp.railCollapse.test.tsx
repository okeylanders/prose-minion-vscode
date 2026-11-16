/** @jest-environment jsdom */

/**
 * WorkshopApp's collapsible rail (Everyday Conveniences, item D): the rail
 * collapses to its icon strip and back, a strip icon reopens it on that tab,
 * badges stay in sight, focus never drops, and the choice is this window's.
 */

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
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
      reactions: [],
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

const control = () => screen.getByRole('button', { name: 'Side pane' });
const body = () => document.getElementById(control().getAttribute('aria-controls')!)!;
const lastPersisted = (vscode: ReturnType<typeof createMockVSCode>) =>
  vscode.setState.mock.calls[vscode.setState.mock.calls.length - 1][0];

describe('WorkshopApp collapsible rail', () => {
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
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it('starts expanded, with the control at the rail\'s top edge naming the rail\'s content', () => {
    render(<WorkshopApp />);
    deliver(session());

    expect(rail().firstElementChild).toBe(control());
    expect(control().getAttribute('aria-expanded')).toBe('true');
    expect(body().hidden).toBe(false);
    expect(body().contains(screen.getByRole('tablist', { name: 'Rail sections' }))).toBe(true);
    expect(screen.queryByRole('group', { name: 'Open a rail section' })).toBeNull();
    expect(lastPersisted(vscode)).toEqual(expect.objectContaining({ fullTabRailCollapsed: false }));
  });

  it('collapses to the strip with counts, and expands back from the control', () => {
    render(<WorkshopApp />);
    deliver(session({ todos: [todo('a'), todo('b')] }));

    fireEvent.click(control());
    expect(control().getAttribute('aria-expanded')).toBe('false');
    expect(body().hidden).toBe(true);
    expect(screen.getByRole('group', { name: 'Open a rail section' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Material, 0 items' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Notes, 2 open' })
      .querySelector('.pm-ws-rail-tab-count')?.textContent).toBe('2');
    expect(lastPersisted(vscode)).toEqual(expect.objectContaining({ fullTabRailCollapsed: true }));

    fireEvent.click(control());
    expect(control().getAttribute('aria-expanded')).toBe('true');
    expect(body().hidden).toBe(false);
    expect(screen.queryByRole('group', { name: 'Open a rail section' })).toBeNull();
    expect(lastPersisted(vscode)).toEqual(expect.objectContaining({ fullTabRailCollapsed: false }));
  });

  it('reopens on the tab whose strip icon was pressed, with focus on that tab', () => {
    render(<WorkshopApp />);
    deliver(session({ todos: [todo('a')] }));
    fireEvent.click(control());

    const icon = screen.getByRole('button', { name: 'Notes, 1 open' });
    icon.focus();
    fireEvent.click(icon);

    const notes = screen.getByRole('tab', { name: /^Notes/ });
    expect(control().getAttribute('aria-expanded')).toBe('true');
    expect(notes.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(notes);
    expect(lastPersisted(vscode)).toEqual(
      expect.objectContaining({ fullTabRailCollapsed: false, workshopRailTab: 'notes' })
    );
  });

  it('moves focus to the control when the rail collapses around it', () => {
    render(<WorkshopApp />);
    deliver(session());
    const material = screen.getByRole('tab', { name: /^Material/ });
    material.focus();

    fireEvent.click(control());
    expect(document.activeElement).toBe(control());
  });

  it('badges news on the strip, for the tab that was showing too', () => {
    render(<WorkshopApp />);
    deliver(session({ todos: [todo('a')] }));
    fireEvent.click(screen.getByRole('tab', { name: /^Notes/ }));
    fireEvent.click(control());

    deliver(session({ todos: [todo('a'), todo('b')] }));
    const notes = screen.getByRole('button', { name: 'Notes, 2 open, 1 new' });
    expect(notes.querySelector('.pm-ws-rail-tab-badge')?.textContent).toBe('1 new');

    // Opening on that tab is seeing it.
    fireEvent.click(notes);
    expect(screen.getByRole('tab', { name: 'Notes, 2 open' })).toBeTruthy();
  });

  it('keeps a panel\'s unsaved draft through a collapse', () => {
    render(<WorkshopApp />);
    deliver(session({ todos: [todo('a')] }));
    fireEvent.click(screen.getByRole('tab', { name: /^Notes/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit task' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit task text' }), {
      target: { value: 'Unsaved writer correction' }
    });

    fireEvent.click(control());
    fireEvent.click(control());
    expect((screen.getByRole('textbox', { name: 'Edit task text' }) as HTMLInputElement).value)
      .toBe('Unsaved writer correction');
  });

  it('restores a stored collapse', () => {
    vscode.getState.mockReturnValue({ fullTabRailCollapsed: true, workshopRailTab: 'notes' });
    render(<WorkshopApp />);
    deliver(session({ todos: [todo('a')] }));

    expect(control().getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: 'Notes, 1 open' })).toBeTruthy();
  });

  it('starts collapsed on a narrow tab, opens as an overlay, and stores neither', () => {
    (window as { matchMedia?: unknown }).matchMedia = (query: string) => ({
      matches: query === '(max-width: 900px)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    });
    render(<WorkshopApp />);
    deliver(session());

    expect(control().getAttribute('aria-expanded')).toBe('false');
    expect(lastPersisted(vscode)).toEqual(expect.objectContaining({ fullTabRailCollapsed: false }));

    fireEvent.click(screen.getByRole('button', { name: /^Material/ }));
    expect(rail().className).toContain('pm-ws-rail-overlay');
    expect(lastPersisted(vscode)).toEqual(expect.objectContaining({ fullTabRailCollapsed: false }));

    fireEvent.keyDown(screen.getByRole('tab', { name: /^Material/ }), { key: 'Escape' });
    expect(control().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(control());
  });
});
