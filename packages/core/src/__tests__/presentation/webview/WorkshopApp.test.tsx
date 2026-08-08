/** @jest-environment jsdom */

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MessageType } from '@messages';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  WorkshopSessionStateMessage,
  WorkshopTurn
} from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../presentation/webview/styles/workshop/tokens.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/shell.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/context.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/session.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/gesturePlayground/gesturePlayground.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/lexicalGravity/lexicalGravity.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/standingDirectiveRail.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/schematic/schematic.css', () => ({}));
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { WorkshopApp } from '@/presentation/webview/WorkshopApp';

const existingTurn: WorkshopTurn = {
  id: 'turn-1',
  role: 'user',
  kind: 'tool_run',
  participant: 'writer',
  artifact: 'tool_request',
  toolId: 'prose',
  toolLabel: 'Prose',
  content: 'Run Prose on the pinned excerpt.',
  timestamp: 1,
  excerptVersion: 0
};

const readySession = (): WorkshopSessionStateMessage => ({
  type: MessageType.WORKSHOP_SESSION_STATE,
  source: 'extension.workshop',
  payload: {
    session: {
      scope: 'open',
      participantSubjectReady: true,
      excerptVersion: 0,
      replacementCount: 0,
      contextAttachments: [],
      pendingMessageAttachments: [],
      widgetConfigs: [],
      standingDirectives: [],
      todos: [],
      turns: [existingTurn],
      totalTurns: 1,
      truncatedTurns: 0,
      roomHasMemory: true,
      participants: {
        host: { personaId: 'jill', hasConversation: true },
        toolSidecars: [],
        personaGuests: [],
        chatTarget: { kind: 'host' }
      },
      conversationBehavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR }
    },
    writerProfile: { ...DEFAULT_WORKSHOP_WRITER_PROFILE },
    webResearch: { enabled: false },
    persistence: { available: true, degradedConversationKeys: [] }
  },
  timestamp: 0
});

describe('WorkshopApp', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (useVSCodeApi as jest.Mock).mockReturnValue(createMockVSCode());
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('renders the room shell and opens its composed feature surfaces', () => {
    render(<WorkshopApp />, { wrapper: React.StrictMode });

    expect(screen.getByRole('heading', { name: 'Workshop' })).not.toBeNull();
    expect(screen.getByLabelText('Session rail')).not.toBeNull();
    expect(screen.getByLabelText('Session thread')).not.toBeNull();

    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: readySession() }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Widgets' }));
    expect(screen.getByRole('dialog', { name: 'Widgets' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close widgets' }));

    fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
    expect(screen.getByRole('dialog', { name: /tools/i })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close tools' }));

    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    fireEvent.click(screen.getByText('New session').closest('button') as HTMLButtonElement);
    expect(screen.getByRole('dialog', { name: 'Start a new session?' })).not.toBeNull();
  });

  it('shows the actual rolling-checkpoint restore diagnostic', () => {
    render(<WorkshopApp />);
    const message = readySession();
    message.payload.persistence.currentCheckpointProtected = true;
    message.payload.persistence.currentCheckpointError =
      'Persisted Workshop turn counter must be a non-negative safe integer';

    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: message }));
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('current.json could not be restored');
    expect(alert.textContent).toContain('turn counter must be a non-negative safe integer');
  });
});
