/** @jest-environment jsdom */

/**
 * The sessions menu's pinned-file count, end to end through WorkshopApp
 * (Pinned Context Slice 3): the hook asks for the list at mount, the host's
 * answer reaches the menu, and the full reset's confirmation follows it.
 * *Alice*, with made-up paths.
 */

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MessageType, type WorkshopPinnedContextPayload } from '@messages';
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
      roomRevision: 1,
      contextRevision: 0,
      contextAttachments: [],
      pendingMessageAttachments: [],
      widgetConfigs: [],
      standingDirectives: [],
      todos: [],
      bookmarks: [],
      turns: [existingTurn],
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
      conversationBehavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR }
    },
    writerProfile: { ...DEFAULT_WORKSHOP_WRITER_PROFILE },
    webResearch: { enabled: false },
    persistence: { available: true, degradedConversationKeys: [] }
  },
  timestamp: 0
});

const pinnedAnswer = (requestId: string | null, paths: string[]): WorkshopPinnedContextPayload => ({
  requestId,
  platform: 'posix',
  availability: { available: true },
  file: { state: paths.length > 0 ? 'ok' : 'absent' },
  revision: paths.length > 0 ? 'rev-1' : 'absent',
  entries: paths.map((entryPath) => ({ path: entryPath, label: entryPath.split('/').pop()!, words: 1000, state: 'ready' as const })),
  totals: { words: paths.length * 1000, budgetWords: 100_000, files: paths.length, maxFiles: 20 }
});

describe('WorkshopApp: the sessions menu follows pinned context', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    jest.useFakeTimers();
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const deliver = (data: unknown) => act(() => window.dispatchEvent(new MessageEvent('message', { data })));
  const answerPinned = (paths: string[]) => {
    const requests = vscode.postMessage.mock.calls
      .map(([posted]: [{ type: MessageType; payload: { requestId: string } }]) => posted)
      .filter((posted) => posted.type === MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT);
    deliver({ type: MessageType.WORKSHOP_PINNED_CONTEXT, source: 'extension.workshop', timestamp: 2,
      payload: pinnedAnswer(requests[requests.length - 1].payload.requestId, paths) });
  };
  const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
  const closeMenu = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

  it('offers the empty-context start and the new full-reset subtitle once files are pinned, and today\'s menu with none', () => {
    render(<WorkshopApp />);
    deliver(readySession());

    answerPinned(['Characters/alice.md', 'Project/brief.md']);
    openMenu();
    expect(screen.getByText('New session: full reset, empty context')).not.toBeNull();
    expect(screen.getByText('clears the excerpt and context, then attaches pinned context')).not.toBeNull();
    fireEvent.click(screen.getByText('New session: full reset').closest('button') as HTMLButtonElement);
    expect(screen.getByText(/then the 2 pinned files are attached\./)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // The pushed list (or the next answer) empties it: the menu is today's.
    deliver({ type: MessageType.WORKSHOP_PINNED_CONTEXT, source: 'extension.workshop', timestamp: 3, payload: pinnedAnswer(null, []) });
    closeMenu();
    openMenu();
    expect(screen.queryByText('New session: full reset, empty context')).toBeNull();
    expect(screen.getByText('also clears the excerpt and context')).not.toBeNull();
  });
});
