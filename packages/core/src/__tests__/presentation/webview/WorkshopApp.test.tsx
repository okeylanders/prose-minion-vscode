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

  it('opens the exact Creative persona prefill without generating or committing for the writer', () => {
    render(<WorkshopApp />);
    const session = readySession();
    const recommendationTurn: WorkshopTurn = {
      id: 'turn-recommendation',
      role: 'assistant',
      kind: 'message',
      participant: 'host',
      artifact: 'persona_message',
      personaId: 'jill',
      personaLabel: 'Jill',
      content: 'Let us put unlike possibilities beside each other.',
      timestamp: 2,
      excerptVersion: 0,
      widgetRecommendation: {
        widgetId: 'creative-variations',
        seed: {
          subjectText: 'She turned the mug until the chip faced the wall.',
          contextText: 'Nate waited across the table.',
          sourceReferences: [],
          mustSurvive: 'The refusal remains implicit.',
          mustNotChange: 'Keep close third person.',
          aim: 'Move the refusal into physical behavior.',
          distance: 'far-tail',
          requestedCount: 5
        }
      }
    };
    session.payload.session.turns = [existingTurn, recommendationTurn];
    session.payload.session.totalTurns = 2;
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: session }));
    });
    jest.clearAllMocks();

    fireEvent.click(screen.getByRole('button', {
      name: /Creative Variations Explorer prefilled · passage ready/
    }));

    expect(screen.getByText('Recommended and prefilled by Jill.')).not.toBeNull();
    expect((screen.getByRole('textbox', {
      name: /Persona-prefilled passage/
    }) as HTMLTextAreaElement).value).toBe(
      'She turned the mug until the chip faced the wall.'
    );
    expect((screen.getByRole('textbox', {
      name: /Must survive every take optional/
    }) as HTMLTextAreaElement).value).toBe('The refusal remains implicit.');
    expect(screen.getByRole('button', { name: /Far tail/ }).getAttribute('aria-pressed'))
      .toBe('true');
    expect(screen.getByRole('button', { name: '5' }).getAttribute('aria-pressed'))
      .toBe('true');
    expect(vscode.postMessage.mock.calls.map(([message]) => message.type)).not.toContain(
      MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATE
    );
    expect(vscode.postMessage.mock.calls.map(([message]) => message.type)).not.toContain(
      MessageType.WORKSHOP_COMMIT_WIDGET
    );
  });

  it('mounts Creative generation, commit, thread chip reopen, and clone recommit', () => {
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
    expect(screen.getByText('Generate a workup before committing.')).not.toBeNull();

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
            content: generatedDraft.subject.text,
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
    }) as HTMLTextAreaElement).value).toBe(generatedDraft.subject.text);
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

    fireEvent.click(screen.getByRole('button', { name: /Generate the workup/ }));
    const regenerateMessage = vscode.postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) =>
        message.type === MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATE)
      .at(-1);
    expect(regenerateMessage.payload.token).not.toBe(generateMessage.payload.token);
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: MessageType.WORKSHOP_CREATIVE_VARIATIONS_RESULT,
          source: 'extension.workshop',
          timestamp: 4,
          payload: {
            widgetId: 'creative-variations',
            token: regenerateMessage.payload.token,
            workupId: mountedWorkup.workupId,
            ok: true,
            workup: mountedWorkup
          }
        }
      }));
    });
    expect(screen.getByText('3 returned · none ranked')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', {
      name: 'Select Take 1 — Baseline — the competent fix'
    }));
    const eligibleCommit = screen.getByRole('button', { name: 'Commit to thread' });
    expect((eligibleCommit as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole('progressbar', { name: 'Commit payload budget' }))
      .not.toBeNull();
    fireEvent.click(eligibleCommit);

    const firstCommit = vscode.postMessage.mock.calls
      .map(([message]) => message)
      .find((message) => message.type === MessageType.WORKSHOP_COMMIT_WIDGET);
    expect(firstCommit).toEqual(expect.objectContaining({
      source: 'webview.workshop.creative-variations',
      payload: expect.objectContaining({
        widgetId: 'creative-variations',
        requestToken: expect.any(String),
        draft: expect.objectContaining({
          intent: expect.objectContaining({ aim: '' }),
          workup: mountedWorkup,
          selections: [{
            position: 1,
            carryMode: 'direction',
            acceptedAdvisoryRiskIds: []
          }]
        })
      })
    }));
    expect(screen.getByRole('button', { name: 'Committing…' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close Creative Variations' }));
    expect(screen.getByRole('dialog', { name: 'Creative Variations Explorer' }))
      .not.toBeNull();

    const creativeTurn: WorkshopTurn = {
      id: 'turn-creative-1',
      role: 'user',
      kind: 'message',
      participant: 'writer',
      artifact: 'persona_message',
      content:
        'I’m committing 1 selected Creative Variations take for '
        + '“He set the mug down where her hand could reach it without asking. She smiled.” '
        + 'to the room.',
      timestamp: 5,
      excerptVersion: 0,
      widgetCommit: {
        widgetId: 'creative-variations',
        widgetConfigId: 'wc-1',
        rail: 'thread-artifact',
        artifactId: 'ta-1',
        selectionCount: 1
      }
    };
    const committedSession = readySession();
    committedSession.payload.session.turns = [existingTurn, creativeTurn];
    committedSession.payload.session.totalTurns = 2;
    committedSession.payload.session.widgetConfigs = [{
      id: 'wc-1',
      widgetId: 'creative-variations',
      revision: 2,
      createdAt: 4,
      committedTurnId: creativeTurn.id,
      artifactId: 'ta-1',
      subjectPreview: generatedDraft.subject.text,
      selectionCount: 1
    }];
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: committedSession }));
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
          source: 'extension.workshop.widget',
          timestamp: 6,
          payload: {
            action: 'commit',
            requestToken: firstCommit.payload.requestToken,
            widgetId: 'creative-variations',
            ok: true,
            widgetConfigId: 'wc-1',
            turnId: creativeTurn.id
          }
        }
      }));
    });

    expect(screen.queryByRole('dialog', { name: 'Creative Variations Explorer' }))
      .toBeNull();
    const chip = screen.getByRole('button', { name: /Creative Variations Explorer/ });
    expect(chip.textContent).toContain('1 variation · re-open');
    fireEvent.click(chip);
    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_REQUEST_WIDGET_CONFIG,
      payload: { configId: 'wc-1' }
    }));

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: MessageType.WORKSHOP_WIDGET_CONFIG_DATA,
          source: 'extension.workshop.widget',
          timestamp: 7,
          payload: {
            configId: 'wc-1',
            config: {
              id: 'wc-1',
              widgetId: 'creative-variations',
              revision: 2,
              createdAt: 4,
              committedTurnId: creativeTurn.id,
              artifactId: 'ta-1',
              draft: firstCommit.payload.draft
            }
          }
        }
      }));
    });

    expect(screen.getByText(/Re-opened from a committed turn/)).not.toBeNull();
    expect((screen.getByRole(
      'textbox',
      { name: /Creative aim optional/ }
    ) as HTMLTextAreaElement).value).toBe('');
    const cloneCommit = screen.getByRole('button', { name: 'Commit as new turn' });
    expect((cloneCommit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(cloneCommit);

    const commits = vscode.postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === MessageType.WORKSHOP_COMMIT_WIDGET);
    expect(commits).toHaveLength(2);
    expect(commits[1].payload).toMatchObject({
      widgetId: 'creative-variations',
      clonedFromConfigId: 'wc-1',
      draft: firstCommit.payload.draft
    });
    expect(commits[1].payload.requestToken).not.toBe(firstCommit.payload.requestToken);
  });
});
