/** @jest-environment jsdom */

/**
 * WorkshopApp Read in provenance (ADR 2026-11-03 D3, D4; Wayfinding Slice 3):
 * a card-backed row jumps to its card; the reader asks for its row by delivery
 * time, marks the lines read, says when the file changed, and "Show where it
 * was read" closes the sheet before it focuses the card, because the thread
 * behind an open sheet is inert.
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
import type { ContextSourceEntry } from '@shared/types';
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

const resourceRow = (path: string, deliveredAt: number): ContextSourceEntry => ({
  kind: 'resource',
  origin: 'host',
  label: path,
  configuredResource: { group: 'characters', path },
  sizeChars: 240,
  isEstimate: true,
  deliveredAt
});

const session = (
  sources: ContextSourceEntry[],
  overrides: Partial<WorkshopSessionSnapshot> = {}
): WorkshopSessionStateMessage => ({
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
      contextBudget: { label: 'Jill', sources },
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

const readInContent = (
  requestId: string,
  content: string,
  extra: object = {},
  path = 'characters/rabbit.md'
) => ({
  type: MessageType.WORKSHOP_READ_IN_RESOURCE_CONTENT,
  source: 'extension.workshop',
  payload: {
    requestId,
    group: 'characters',
    path,
    content,
    canOpenInEditor: true,
    ...extra
  },
  timestamp: 1
});

const cardTurn: WorkshopTurn = {
  id: 'turn-2',
  role: 'assistant',
  kind: 'tool_run',
  participant: 'tool',
  artifact: 'resource_read',
  toolLabel: 'Project resources',
  capability: {
    operation: 'resource.read',
    status: 'success',
    requestSummary: 'characters/rabbit.md',
    requestedByPersonaId: 'jill',
    invokedBy: { kind: 'host' }
  },
  content: '## Project resource · rabbit.md',
  timestamp: 2,
  excerptVersion: 0
};

describe('WorkshopApp Read in provenance', () => {
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

  const readInRequests = () => vscode.postMessage.mock.calls
    .map(([entry]: [{ type: MessageType; payload: Record<string, unknown> }]) => entry)
    .filter((entry) => entry.type === MessageType.WORKSHOP_REQUEST_READ_IN_RESOURCE)
    .map((entry) => entry.payload);

  const withCard = (sources: ContextSourceEntry[]) => session(sources, { turns: [hostTurn, cardTurn], totalTurns: 2 });

  /** Records, when the card takes focus, whether anything above it was still inert. */
  const watchFocus = () => {
    const card = document.querySelector<HTMLElement>(`[${WORKSHOP_TURN_ID_ATTRIBUTE}="turn-2"]`);
    expect(card).toBeTruthy();
    const focusedWhileInert: boolean[] = [];
    card!.addEventListener('focus', () => focusedWhileInert.push(card!.closest('[inert]') !== null));
    return { card: card!, focusedWhileInert };
  };

  it('jumps from a card-backed row to the card that fetched it', () => {
    render(<WorkshopApp />);
    deliver(withCard([{
      kind: 'dictionary', origin: 'host', label: 'tardy', sizeChars: 300, isEstimate: true,
      deliveredAt: 1_000, turnId: 'turn-2'
    }]));
    const { card, focusedWhileInert } = watchFocus();

    fireEvent.click(within(rail()).getByRole('button', { name: 'Show the card for tardy in the thread' }));

    expect(document.activeElement).toBe(card);
    expect(focusedWhileInert).toEqual([false]);
  });

  it('asks for the row by delivery time, marks the lines read, and says the file changed', () => {
    render(<WorkshopApp />);
    deliver(withCard([{ ...resourceRow('characters/rabbit.md', 1_000), turnId: 'turn-2', lineRange: { start: 2, end: 3 } }]));

    fireEvent.click(within(rail()).getByRole('button', { name: 'Open characters/rabbit.md in the reader' }));
    const [request] = readInRequests();
    expect(request).toMatchObject({ group: 'characters', path: 'characters/rabbit.md', deliveredAt: 1_000 });

    deliver(readInContent(String(request.requestId), 'One\nTwo\nThree\nFour', {
      lineRange: { start: 2, end: 3 },
      changedSinceRead: true
    }));

    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByRole('note').textContent)
      .toContain('This file has changed since Jill read it. You’re seeing it as it is now.');
    expect(Array.from(sheet.querySelectorAll<HTMLElement>('.pm-ws-readin-line-read')).map((line) => line.dataset.line))
      .toEqual(['2', '3']);
    expect(within(sheet).getByText('End of Jill\'s read · line 3')).toBeTruthy();
  });

  /** Lets the overlay's cleanup and its queued focus restore run (PR #187 F-01). */
  const settle = async () => {
    await act(async () => {
      jest.runAllTicks();
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  const openRabbitFromRail = () => {
    const row = within(rail()).getByRole('button', { name: 'Open characters/rabbit.md in the reader' });
    row.focus();
    fireEvent.click(row);
    return row;
  };

  it('"Show where it was read" closes the reader, then the card keeps focus after the overlay settles', async () => {
    render(<WorkshopApp />);
    deliver(withCard([{ ...resourceRow('characters/rabbit.md', 1_000), turnId: 'turn-2' }]));
    const { card, focusedWhileInert } = watchFocus();

    openRabbitFromRail();
    await settle();
    expect(screen.getByLabelText('Session thread').closest('[inert]')).not.toBeNull();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Show where it was read' }));
    await settle();

    expect(screen.queryByRole('dialog')).toBeNull();
    // The opener restore must not take focus back to the Read in row.
    expect(document.activeElement).toBe(card);
    expect(focusedWhileInert.every((inert) => !inert)).toBe(true);
    expect(focusedWhileInert.length).toBeGreaterThan(0);
  });

  it('still returns focus to the Read in row on an ordinary Close or Escape', async () => {
    render(<WorkshopApp />);
    deliver(withCard([{ ...resourceRow('characters/rabbit.md', 1_000), turnId: 'turn-2' }]));

    let row = openRabbitFromRail();
    await settle();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    await settle();
    expect(document.activeElement).toBe(row);

    row = openRabbitFromRail();
    await settle();
    fireEvent.keyDown(window, { key: 'Escape' });
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(row);
  });

  it('opens a card outside the window in the turn preview in place of the reader, then returns focus to the row', async () => {
    render(<WorkshopApp />);
    // The row names a card the snapshot's window no longer holds.
    deliver(session([{ ...resourceRow('characters/rabbit.md', 1_000), turnId: 'turn-0' }]));

    const row = openRabbitFromRail();
    await settle();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Show where it was read' }));
    await settle();

    const previews = vscode.postMessage.mock.calls
      .map(([entry]: [{ type: MessageType; payload: Record<string, unknown> }]) => entry)
      .filter((entry) => entry.type === MessageType.WORKSHOP_REQUEST_TURN_PREVIEW);
    expect(previews.map((entry) => entry.payload.turnId)).toEqual(['turn-0']);
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('Outside the loaded window')).toBeTruthy();
    expect(screen.queryByText('That source turn is outside the current reload window.')).toBeNull();
    expect(sheet.contains(document.activeElement)).toBe(true);

    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(row);
  });

  it('scrolls to the first line read once the async reply has put the Source pane on screen (PR #187 N-01)', async () => {
    const calls: Array<{ line?: string; hidden: boolean }> = [];
    Element.prototype.scrollIntoView = jest.fn(function (this: HTMLElement) {
      calls.push({ line: this.dataset.line, hidden: this.closest('[hidden]') !== null });
    });
    render(<WorkshopApp />);
    deliver(withCard([{ ...resourceRow('characters/rabbit.md', 1_000), turnId: 'turn-2', lineRange: { start: 3, end: 4 } }]));

    fireEvent.click(within(rail()).getByRole('button', { name: 'Open characters/rabbit.md in the reader' }));
    await settle();
    const [request] = readInRequests();
    // The reply lands after the sheet opened on its loading state.
    deliver(readInContent(String(request.requestId), 'One\nTwo\nThree\nFour\nFive', { lineRange: { start: 3, end: 4 } }));
    await settle();

    const rangeScrolls = calls.filter((call) => call.line !== undefined);
    expect(rangeScrolls).toEqual([{ line: '3', hidden: false }]);
    expect(within(screen.getByRole('dialog')).getByRole('tab', { name: 'Source' }).getAttribute('aria-selected')).toBe('true');
  });

  it('offers no "Show where it was read" for a row that recorded no card', () => {
    render(<WorkshopApp />);
    deliver(withCard([resourceRow('characters/rabbit.md', 1_000)]));

    fireEvent.click(within(rail()).getByRole('button', { name: 'Open characters/rabbit.md in the reader' }));

    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Show where it was read' })).toBeNull();
  });
});
