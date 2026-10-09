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
jest.mock('../../../presentation/webview/components/workshop/widgets/showVsTell/showVsTell.css', () => ({}));
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
      roomRevision: 1,
      contextRevision: 0,
      contextAttachments: [],
      pendingMessageAttachments: [],
      widgetConfigs: [],
      standingDirectives: [],
      todos: [],
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

  it('keeps startup loading visible after dismissing the notice before the room arrives', () => {
    render(<WorkshopApp />);
    act(() => window.dispatchEvent(new MessageEvent('message', { data: {
      type: MessageType.STARTUP_NOTICE_DATA,
      source: 'extension.workshop', timestamp: 1,
      payload: { shouldShow: true, noticeVersion: 'test-notice' }
    } })));

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    expect(screen.getByText('Opening your Workshop session…')).not.toBeNull();
    const content = screen.getByLabelText('Session thread').querySelector('.pm-ws-session-content')!;
    expect(content.hasAttribute('inert')).toBe(true);

    act(() => window.dispatchEvent(new MessageEvent('message', { data: readySession() })));
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(content.hasAttribute('inert')).toBe(false);
  });

  it.each([true, false])('dismisses the notice into the current scan state (scanning=%s)', (scanning) => {
    render(<WorkshopApp />);
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: {
        type: MessageType.STARTUP_NOTICE_DATA,
        source: 'extension.workshop', timestamp: 1,
        payload: { shouldShow: true, noticeVersion: 'test-notice' }
      } }));
      window.dispatchEvent(new MessageEvent('message', { data: {
        type: MessageType.WORKSHOP_SESSION_CONTEXT_SCAN,
        source: 'extension.workshop', timestamp: 2, payload: { scanning: true }
      } }));
      window.dispatchEvent(new MessageEvent('message', { data: readySession() }));
    });
    if (!scanning) {
      act(() => window.dispatchEvent(new MessageEvent('message', { data: {
        type: MessageType.WORKSHOP_SESSION_CONTEXT_SCAN,
        source: 'extension.workshop', timestamp: 3, payload: { scanning: false }
      } })));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Loading…') !== null).toBe(scanning);
    const content = screen.getByLabelText('Session thread').querySelector('.pm-ws-session-content')!;
    expect(content.hasAttribute('inert')).toBe(scanning);
  });

  it('shows a startup error instead of covering it with the initial loader', () => {
    render(<WorkshopApp />);
    expect(screen.getByText('Opening your Workshop session…')).not.toBeNull();
    act(() => window.dispatchEvent(new MessageEvent('message', { data: {
      type: MessageType.ERROR, source: 'extension.workshop', timestamp: 1,
      payload: { source: 'workshop', message: 'Could not load the saved Workshop session.' }
    } })));
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(screen.getByText('Could not load the saved Workshop session.')).not.toBeNull();
    const content = screen.getByLabelText('Session thread').querySelector('.pm-ws-session-content')!;
    expect(content.hasAttribute('inert')).toBe(false);
  });

  it('covers the chat while context is scanned, even when session state arrives mid-scan', () => {
    render(<WorkshopApp />);
    const scan = (scanning: boolean) => act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: {
        type: MessageType.WORKSHOP_SESSION_CONTEXT_SCAN,
        source: 'extension.workshop', timestamp: 1, payload: { scanning }
      } }));
    });

    scan(true);
    expect(screen.getByText('Scanning context files for updates…')).not.toBeNull();
    const content = screen.getByLabelText('Session thread').querySelector('.pm-ws-session-content')!;
    expect(content.hasAttribute('inert')).toBe(true);
    act(() => window.dispatchEvent(new MessageEvent('message', { data: readySession() })));
    expect(screen.getByText('Loading…')).not.toBeNull();

    scan(false);
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(content.hasAttribute('inert')).toBe(false);
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

  describe('Rewind and Branch (ADR 2026-09-30)', () => {
    const message = (id: string, role: 'user' | 'assistant', content: string): WorkshopTurn => ({
      id,
      role,
      kind: 'message',
      participant: role === 'user' ? 'writer' : 'host',
      artifact: 'persona_message',
      ...(role === 'assistant' ? { personaId: 'jill' as const, personaLabel: 'Jill' } : {}),
      content,
      timestamp: 1,
      excerptVersion: 0
    });
    const question = message('turn-2-user-2', 'user', 'What does the cup mean?');
    const answer = message('turn-3-assistant-3', 'assistant', 'It is a promise.');
    const followUp = message('turn-4-user-4', 'user', 'And the sill?');
    const latest = message('turn-5-assistant-5', 'assistant', 'It is the threshold.');
    const roomWith = (turns: WorkshopTurn[]) => {
      const state = readySession();
      state.payload.session.turns = turns;
      state.payload.session.totalTurns = turns.length;
      state.payload.session.turnRewindability = Object.fromEntries(
        turns.filter((turn) => turn.kind === 'message').map((turn) => [turn.id, { available: true as const }])
      );
      return state;
    };
    const rewindPosts = () => vscode.postMessage.mock.calls
      .map(([posted]) => posted)
      .filter((posted) => posted.type === MessageType.WORKSHOP_REWIND_SESSION);

    it('offers no rewind on the latest reply, which is already where the room stands', () => {
      render(<WorkshopApp />);
      act(() => {
        window.dispatchEvent(new MessageEvent('message', {
          data: roomWith([existingTurn, question, answer, followUp, latest])
        }));
      });

      // One agent action (the earlier reply) and two edit actions (both writer messages).
      expect(screen.getAllByRole('button', { name: /Rewind to here/ })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: /Edit from here/ })).toHaveLength(2);
    });

    it('confirms an agent-reply rewind with its removed count, and cancelling sends nothing', () => {
      render(<WorkshopApp />);
      act(() => {
        window.dispatchEvent(new MessageEvent('message', {
          data: roomWith([existingTurn, question, answer, followUp, latest])
        }));
      });

      fireEvent.click(screen.getByRole('button', { name: /Rewind to here/ }));
      const dialog = screen.getByRole('dialog', { name: 'Rewind to here?' });
      expect(dialog.textContent).toContain(
        '2 turns will be removed. Your excerpt and context stay as they are now. ' +
        'To keep this conversation too, use Branch instead.'
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog', { name: 'Rewind to here?' })).toBeNull();
      expect(rewindPosts()).toEqual([]);
    });

    it('edits a writer message: confirm, then the host\'s shorter room and restored draft', () => {
      render(<WorkshopApp />);
      act(() => {
        window.dispatchEvent(new MessageEvent('message', {
          data: roomWith([existingTurn, question, answer, followUp, latest])
        }));
      });

      fireEvent.click(screen.getAllByRole('button', { name: /Edit from here/ })[0]);
      const dialog = screen.getByRole('dialog', { name: 'Edit this message?' });
      expect(dialog.textContent).toContain('This message and 3 turns after it will be removed.');
      fireEvent.click(screen.getByRole('button', { name: 'Rewind and edit' }));

      expect(rewindPosts()).toEqual([expect.objectContaining({
        source: 'webview.workshop',
        payload: { turnId: question.id }
      })]);
      // Nothing is removed until the host answers with the rewound room.
      expect(screen.getByText('It is the threshold.')).not.toBeNull();

      // The host restaged the message's one-shot attachment under its old id.
      const rewound = roomWith([existingTurn]);
      rewound.payload.session.pendingMessageAttachments = [
        { id: 'ta-1', label: 'beat-sheet.md', words: 7 }
      ];
      act(() => {
        window.dispatchEvent(new MessageEvent('message', { data: rewound }));
        window.dispatchEvent(new MessageEvent('message', {
          data: {
            type: MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED,
            source: 'extension.workshop',
            payload: { text: question.content },
            timestamp: 2
          }
        }));
      });

      expect(screen.queryByText('It is the threshold.')).toBeNull();
      expect(screen.queryByText('It is a promise.')).toBeNull();
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(question.content);
      expect(screen.getByText(/beat-sheet\.md/)).not.toBeNull();
    });

    it('edits a widget message in its widget: the host\'s restore reopens the released config', () => {
      render(<WorkshopApp />);
      const widgetMessage: WorkshopTurn = {
        ...question,
        content: 'Here are the directions I want.',
        widgetCommit: {
          widgetId: 'gesture-playground',
          widgetConfigId: 'wc-1',
          rail: 'thread-artifact',
          artifactId: 'ta-1',
          selectionCount: 1
        }
      };
      act(() => {
        window.dispatchEvent(new MessageEvent('message', {
          data: roomWith([existingTurn, widgetMessage, answer, followUp, latest])
        }));
      });

      fireEvent.click(screen.getAllByRole('button', { name: /Edit from here/ })[0]);
      const dialog = screen.getByRole('dialog', { name: 'Edit this message?' });
      expect(dialog.textContent).toContain('Its widget reopens so you can adjust it and send it again.');
      fireEvent.click(screen.getByRole('button', { name: 'Rewind and edit' }));
      expect(rewindPosts()).toEqual([expect.objectContaining({
        payload: { turnId: widgetMessage.id }
      })]);

      act(() => {
        window.dispatchEvent(new MessageEvent('message', { data: roomWith([existingTurn]) }));
        window.dispatchEvent(new MessageEvent('message', {
          data: {
            type: MessageType.WORKSHOP_WIDGET_CONFIG_RESTORED,
            source: 'extension.workshop',
            payload: { widgetConfigId: 'wc-1' },
            timestamp: 2
          }
        }));
      });

      expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: MessageType.WORKSHOP_REQUEST_WIDGET_CONFIG,
        payload: { configId: 'wc-1' }
      }));
      // Widget copy belongs to the widget: the composer stays empty.
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');

      act(() => {
        window.dispatchEvent(new MessageEvent('message', {
          data: {
            type: MessageType.WORKSHOP_WIDGET_CONFIG_DATA,
            source: 'extension.workshop.widget',
            timestamp: 3,
            payload: {
              configId: 'wc-1',
              // Released by the rewind: no commit linkage remains.
              config: {
                id: 'wc-1',
                widgetId: 'gesture-playground',
                revision: 1,
                createdAt: 1,
                draft: {
                  targetPhrase: 'she smiled',
                  writerInstructions: '',
                  contextText: '',
                  characterNotes: '',
                  sourceReferences: [],
                  dictionaryMarkdown: '',
                  menu: [],
                  selections: [],
                  note: '',
                  includeDictionaryInCommit: false
                }
              }
            }
          }
        }));
      });

      expect(screen.getByText(/Reopened from a message you rewound/)).not.toBeNull();
    });

    describe('Branch (§7)', () => {
      const branchPosts = () => vscode.postMessage.mock.calls
        .map(([posted]) => posted)
        .filter((posted) => posted.type === MessageType.WORKSHOP_BRANCH_SESSION);
      const listPosts = () => vscode.postMessage.mock.calls
        .map(([posted]) => posted)
        .filter((posted) => posted.type === MessageType.WORKSHOP_LIST_SESSIONS);
      const namedSession = {
        sessionId: 'chapter-3',
        title: 'Chapter 3 — Felix',
        fileName: 'chapter-3.json',
        kind: 'named' as const,
        startedAt: 1,
        updatedAt: 2,
        savedAt: 2,
        timezone: 'America/Chicago',
        hostPersonaId: 'jill' as const,
        participantPersonaIds: ['jill' as const],
        turnCount: 5,
        excerptWordCount: 0
      };
      /** Answer the webview's latest session-list request with this room saved. */
      const answerSessionsAsNamed = () => {
        const requestId = listPosts().at(-1)!.payload.requestId;
        act(() => {
          window.dispatchEvent(new MessageEvent('message', {
            data: {
              type: MessageType.WORKSHOP_SESSIONS_DATA,
              source: 'extension.workshop',
              payload: {
                requestId,
                available: true,
                current: { ...namedSession, kind: 'current', fileName: 'current.json' },
                sessions: [namedSession]
              },
              timestamp: 3
            }
          }));
        });
      };

      it('offers Branch on every eligible bubble, the latest reply included', () => {
        render(<WorkshopApp />);
        act(() => {
          window.dispatchEvent(new MessageEvent('message', {
            data: roomWith([existingTurn, question, answer, followUp, latest])
          }));
        });

        expect(screen.getAllByRole('button', { name: /Branch from here/ })).toHaveLength(4);
        expect(screen.getAllByRole('button', { name: /Rewind to here/ })).toHaveLength(1);
      });

      it('asks an unsaved room to save first: the popup opens Save and nothing is sent', () => {
        render(<WorkshopApp />);
        act(() => {
          window.dispatchEvent(new MessageEvent('message', {
            data: roomWith([existingTurn, question, answer, followUp, latest])
          }));
        });

        fireEvent.click(screen.getAllByRole('button', { name: /Branch from here/ }).at(-1)!);
        const dialog = screen.getByRole('dialog', { name: 'Save before branching' });
        expect(dialog.textContent).toContain(
          'Branching creates a new session from this point. ' +
          "Save this session first so it isn't replaced."
        );
        fireEvent.click(screen.getByRole('button', { name: 'Save session…' }));

        expect(screen.queryByRole('dialog', { name: 'Save before branching' })).toBeNull();
        expect(screen.getByRole('dialog', { name: 'Save session' })).not.toBeNull();
        expect(branchPosts()).toEqual([]);
      });

      it('branches a saved room at once, then follows the branch as the active session', () => {
        render(<WorkshopApp />);
        act(() => {
          window.dispatchEvent(new MessageEvent('message', {
            data: roomWith([existingTurn, question, answer, followUp, latest])
          }));
        });
        answerSessionsAsNamed();

        // From the writer's message: the branch is an edit there.
        fireEvent.click(screen.getAllByRole('button', { name: /Branch from here/ })[0]);

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(branchPosts()).toEqual([expect.objectContaining({
          source: 'webview.workshop',
          payload: { turnId: question.id }
        })]);
        // Pending: every room action pauses until the host answers.
        expect((screen.getAllByRole('button', { name: /Branch from here/ })[0] as HTMLButtonElement).disabled)
          .toBe(true);

        const listsBefore = listPosts().length;
        act(() => {
          window.dispatchEvent(new MessageEvent('message', { data: roomWith([existingTurn]) }));
          window.dispatchEvent(new MessageEvent('message', {
            data: {
              type: MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED,
              source: 'extension.workshop',
              payload: { text: question.content },
              timestamp: 4
            }
          }));
          window.dispatchEvent(new MessageEvent('message', {
            data: {
              type: MessageType.WORKSHOP_SESSION_ACTION_RESULT,
              source: 'extension.workshop',
              payload: {
                action: 'branch',
                ok: true,
                message: 'Branched “Chapter 3 — Felix” into “Chapter 3 — Felix — branch”.'
              },
              timestamp: 5
            }
          }));
        });

        expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(question.content);
        expect(screen.getByText('Branched “Chapter 3 — Felix” into “Chapter 3 — Felix — branch”.'))
          .not.toBeNull();
        // The Sessions list is re-read whole, so the branch becomes the active session.
        expect(listPosts().length).toBeGreaterThan(listsBefore);
        expect(listPosts().at(-1)!.payload.query).toBeUndefined();
      });

      it('disables Branch with its own D7 reason when sessions cannot be saved', () => {
        render(<WorkshopApp />);
        const state = roomWith([existingTurn, question, answer, followUp, latest]);
        state.payload.persistence = {
          available: false,
          unavailableReason: 'no-workspace',
          degradedConversationKeys: []
        };
        act(() => {
          window.dispatchEvent(new MessageEvent('message', { data: state }));
        });

        const action = screen.getAllByRole('button', { name: /Branch from here/ })[0] as HTMLButtonElement;
        expect(action.disabled).toBe(true);
        expect(action.getAttribute('title')).toBe('Branch needs an open workspace folder');
        expect(screen.getAllByRole('button', { name: /Edit from here/ })[0].getAttribute('title'))
          .toBe('Rewind needs an open workspace folder');
      });
    });
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
