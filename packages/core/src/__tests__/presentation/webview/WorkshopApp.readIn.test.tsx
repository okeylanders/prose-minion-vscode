/** @jest-environment jsdom */

/**
 * WorkshopApp Read in (ADR 2026-11-03 D1, D2, D4; Wayfinding Slice 2): the
 * chat target's fetched rows show under Material, named for it; a resource
 * row opens in the reader sheet and beside the Workshop; rows that arrive
 * while Material is hidden badge it, and a change of chat target does not.
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

const withGuestTarget = (sources: ContextSourceEntry[]) => session(sources, {
  participants: {
    host: { personaId: 'jill', hasConversation: true },
    toolSidecars: [],
    personaGuests: [{
      personaId: 'cliff',
      personaLabel: 'Cliff',
      hasConversation: true,
      liveness: 'live',
      activeTarget: true
    }],
    chatTarget: { kind: 'personaGuest', personaId: 'cliff' }
  }
});

const deliver = (message: unknown) =>
  act(() => window.dispatchEvent(new MessageEvent('message', { data: message })));

const rail = () => screen.getByLabelText('Session rail');

describe('WorkshopApp Read in', () => {
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

  it('lists what the chat target read, named for it, and opens a file in the reader', () => {
    render(<WorkshopApp />);
    deliver(session([resourceRow('characters/rabbit.md', 1_000)]));

    const readIn = within(rail()).getByRole('region', { name: 'Read in by Jill' });
    fireEvent.click(within(readIn).getByRole('button', { name: 'Open characters/rabbit.md in the reader' }));
    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_REQUEST_READ_IN_RESOURCE,
      payload: { group: 'characters', path: 'characters/rabbit.md' }
    }));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('Read in by Jill')).toBeTruthy();
    expect(within(sheet).getByRole('status').textContent).toContain('Loading the file…');

    deliver({
      type: MessageType.WORKSHOP_READ_IN_RESOURCE_CONTENT,
      source: 'extension.workshop',
      payload: {
        group: 'characters',
        path: 'characters/rabbit.md',
        content: '# The Rabbit\n\nHe checks his watch.',
        truncated: true,
        canOpenInEditor: true
      },
      timestamp: 1
    });
    expect(within(sheet).getByRole('heading', { name: 'The Rabbit' })).toBeTruthy();
    expect(within(sheet).getByRole('note').textContent).toContain('Showing the start of the file only');

    fireEvent.click(within(sheet).getByRole('button', { name: /open beside/i }));
    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_OPEN_READ_IN_RESOURCE,
      payload: { group: 'characters', path: 'characters/rabbit.md' }
    }));
  });

  it('follows the chat target: its rows, its name, and no badge for switching', () => {
    render(<WorkshopApp />);
    deliver(session([resourceRow('characters/rabbit.md', 1_000)]));
    fireEvent.click(screen.getByRole('tab', { name: /^Notes/ }));

    deliver(withGuestTarget([resourceRow('characters/hatter.md', 2_000)]));
    expect(screen.getByRole('tab', { name: /^Material/ }).getAttribute('aria-label')).not.toMatch(/new/);

    fireEvent.click(screen.getByRole('tab', { name: /^Material/ }));
    const readIn = within(rail()).getByRole('region', { name: 'Read in by Cliff' });
    expect(within(readIn).getByText('characters/hatter.md')).toBeTruthy();
    expect(within(readIn).queryByText('characters/rabbit.md')).toBeNull();
  });

  it('badges Material for a row read while Notes is showing', () => {
    render(<WorkshopApp />);
    deliver(session([resourceRow('characters/rabbit.md', 1_000)]));
    fireEvent.click(screen.getByRole('tab', { name: /^Notes/ }));

    deliver(session([resourceRow('characters/rabbit.md', 1_000), resourceRow('characters/duchess.md', 2_000)]));
    expect(screen.getByRole('tab', { name: /^Material, \d+ items?, 1 new$/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /^Notes/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('says so when the chat target has read nothing', () => {
    render(<WorkshopApp />);
    deliver(session([]));
    expect(within(rail()).getByText('When Jill reads a file or runs a tool, it shows here.')).toBeTruthy();
  });
});
