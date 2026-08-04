/** @jest-environment jsdom */

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MessageType } from '@messages';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  WorkshopSessionStateMessage
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
      turns: [],
      totalTurns: 0,
      truncatedTurns: 0,
      roomHasMemory: false,
      participants: {
        host: { personaId: 'jill', hasConversation: false },
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
    render(<WorkshopApp />);

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
  });
});
