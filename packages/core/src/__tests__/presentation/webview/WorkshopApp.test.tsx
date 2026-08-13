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
import {
  generatedDraft
} from '@/__tests__/presentation/webview/components/workshop/widgets/creativeVariations/creativeVariationsFixtures';

jest.mock('../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../presentation/webview/styles/workshop/tokens.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/shell.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/context.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/session.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/gesturePlayground/gesturePlayground.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/lexicalGravity/lexicalGravity.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/creativeVariations/creativeVariations.css', () => ({}));
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

  it('shows the persistent offline notice and opens the existing settings overlay', () => {
    render(<WorkshopApp />);

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: MessageType.API_KEY_STATUS,
          source: 'extension.configuration',
          payload: { hasSavedKey: false },
          timestamp: 1
        }
      }));
    });

    expect(screen.getByText('AI replies are paused.')).not.toBeNull();
    expect(screen.getByText(/Your Workshop sessions and local context remain/)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Add API key/i }));
    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.OPEN_ASSISTANT_SETTINGS,
      source: 'webview.workshop',
      payload: {}
    }));

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: MessageType.CLEAR_TRANSIENT_API_KEY_WARNING,
          source: 'extension.handler',
          payload: {},
          timestamp: 2
        }
      }));
    });
    expect(screen.queryByText('AI replies are paused.')).toBeNull();
  });

  it('returns a transiently failed writer message to the composer', () => {
    render(<WorkshopApp />);
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: readySession() }));
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED,
          source: 'extension.workshop',
          payload: { text: 'Keep this draft safe.' },
          timestamp: 1
        }
      }));
    });

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value)
      .toBe('Keep this draft safe.');
  });

  it('mounts the Creative authoring flow with correlated generation and host clipboard copy', () => {
    render(<WorkshopApp />);
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: readySession() }));
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: MessageType.MODEL_DATA,
          source: 'extension.configuration',
          timestamp: 1,
          payload: {
            options: [
              { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5' },
              { id: 'openai/gpt-5.4', label: 'GPT-5.4' }
            ],
            selections: { widget: 'anthropic/claude-sonnet-5' }
          }
        }
      }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Widgets' }));
    fireEvent.click(
      screen.getAllByRole('button', { name: /Creative Variations Explorer/ })[0]
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open widget' }));

    expect(screen.getByRole('dialog', {
      name: 'Creative Variations Explorer'
    })).not.toBeNull();
    const commit = screen.getByRole('button', { name: 'Commit to thread' });
    expect((commit as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Commit to the Workshop thread is not available/)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Use editor selection' }));
    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.REQUEST_SELECTION,
      payload: { target: 'workshop_creative_variations_subject' }
    }));

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: MessageType.SELECTION_DATA,
          source: 'extension.ui',
          timestamp: 2,
          payload: {
            target: 'workshop_creative_variations_subject',
            content: 'The selected passage.',
            sourceUri: 'file:///private/draft.md',
            relativePath: 'draft.md',
            startLine: 4,
            endLine: 5
          }
        }
      }));
    });
    expect((screen.getByRole('textbox', {
      name: /Selected passage/
    }) as HTMLTextAreaElement).value).toBe('The selected passage.');
    expect(screen.getByText('from excerpt · draft.md · L4–5')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Generate the workup/ }));

    const generateMessage = vscode.postMessage.mock.calls
      .map(([message]) => message)
      .find((message) =>
        message.type === MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATE);
    expect(generateMessage).toBeDefined();
    expect(generateMessage.payload.invariants).toEqual({
      mustSurvive: '',
      mustNotChange: ''
    });
    expect(generateMessage.payload.intent).toEqual({
      kind: 'custom-aim',
      aim: '',
      distance: 'tail'
    });

    const mountedWorkup = {
      ...generatedDraft.workup!,
      cards: generatedDraft.workup!.cards.map((card) => ({
        ...card,
        invariantFlags: []
      }))
    };

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: MessageType.WORKSHOP_CREATIVE_VARIATIONS_RESULT,
          source: 'extension.workshop',
          timestamp: 3,
          payload: {
            widgetId: 'creative-variations',
            token: generateMessage.payload.token,
            workupId: mountedWorkup.workupId,
            ok: true,
            workup: mountedWorkup
          }
        }
      }));
    });

    expect(screen.getByText('3 returned · none ranked')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy Take 1 prose' }));
    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.COPY_RESULT,
      source: 'webview.workshop.creative-variations',
      payload: {
        toolName: 'creative_variations',
        content: mountedWorkup.cards[0].prose
      }
    }));

    fireEvent.click(screen.getByRole('button', {
      name: /Browse widget model options. Current model: Claude Sonnet 5/
    }));
    fireEvent.click(screen.getByRole('button', { name: /GPT-5.4/ }));
    expect(screen.queryByText('3 returned · none ranked')).toBeNull();
    expect(screen.getByText(
      'Generated workup cleared because the widget model changed.'
    ).getAttribute('role')).toBe('status');
    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.SET_MODEL_SELECTION,
      payload: { scope: 'widget', modelId: 'openai/gpt-5.4' }
    }));
  });
});
