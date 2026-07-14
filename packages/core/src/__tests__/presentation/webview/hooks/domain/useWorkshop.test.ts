/**
 * @jest-environment jsdom
 */

/**
 * useWorkshop tests — the webview half of Sprint 2's reload-safety criterion
 * (PR #67 review #1: the one domain hook that shipped without a test).
 *
 * Behavior under test:
 * - mount requests the host session; a snapshot rehydrates the whole thread,
 *   including ADOPTING a mid-run request after a reload,
 * - the streaming lifecycle under domain 'workshop' (foreign domains and
 *   stale requestIds ignored),
 * - the settled handshake: the live bubble SURVIVES stream-complete and
 *   retires only when the assistant turn lands (the flicker regression net),
 * - cancelled/error paths clear immediately via the authoritative snapshot,
 * - STATUS/ERROR source filtering keeps sidebar noise out of the Workshop.
 */

import { renderHook, act } from '@testing-library/react';
import { useWorkshop } from '@hooks/domain/useWorkshop';
import { MessageType } from '@shared/types';
import type {
  ErrorMessage,
  StatusMessage,
  StreamChunkMessage,
  StreamCompleteMessage,
  StreamStartedMessage,
  WorkshopSessionSnapshot,
  WorkshopSessionStateMessage,
  WorkshopTurn,
  WorkshopTurnMessage
} from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const sessionState = (session: Partial<WorkshopSessionSnapshot>): WorkshopSessionStateMessage => {
  const turns = session.turns ?? [];
  return {
    type: MessageType.WORKSHOP_SESSION_STATE,
    source: 'extension.workshop',
    payload: {
      session: {
        excerptVersion: 0,
        replacementCount: 0,
        todos: [],
        turns,
        totalTurns: turns.length,
        truncatedTurns: 0,
        hasConversation: false,
        participants: {
          host: { personaId: 'jill', hasConversation: false },
          toolSidecars: [],
          personaGuests: [],
          chatTarget: { kind: 'host' }
        },
        ...session
      }
    },
    timestamp: 0
  };
};

const makeTurn = (overrides: Partial<WorkshopTurn>): WorkshopTurn => ({
  id: 'turn-1-user-1000',
  role: 'user',
  kind: 'tool_run',
  participant: 'writer',
  artifact: 'tool_request',
  toolId: 'prose',
  toolLabel: 'Prose',
  content: 'Run **Prose** on the pinned excerpt.',
  timestamp: 1000,
  excerptVersion: 1,
  ...overrides
});

const turnMessage = (turn: WorkshopTurn): WorkshopTurnMessage => ({
  type: MessageType.WORKSHOP_TURN,
  source: 'extension.workshop',
  payload: { turn },
  timestamp: 0
});

const streamStarted = (requestId: string, domain = 'workshop'): StreamStartedMessage => ({
  type: MessageType.STREAM_STARTED,
  source: 'extension.workshop',
  payload: { requestId, domain: domain as never },
  timestamp: 0
});

const streamChunk = (requestId: string, token: string, domain = 'workshop'): StreamChunkMessage => ({
  type: MessageType.STREAM_CHUNK,
  source: 'extension.workshop',
  payload: { requestId, domain: domain as never, token },
  timestamp: 0
});

const streamComplete = (
  requestId: string,
  cancelled: boolean,
  content = ''
): StreamCompleteMessage => ({
  type: MessageType.STREAM_COMPLETE,
  source: 'extension.workshop',
  payload: { requestId, domain: 'workshop', content, cancelled },
  timestamp: 0
});

describe('useWorkshop', () => {
  let mockVSCode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    jest.useFakeTimers();
    mockVSCode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(mockVSCode);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const posted = (type: MessageType) =>
    mockVSCode.postMessage.mock.calls.map((c) => c[0]).filter((m) => m.type === type);

  it('requests the host session on mount (reload rehydration entry point)', () => {
    renderHook(() => useWorkshop());

    const requests = posted(MessageType.WORKSHOP_REQUEST_SESSION);
    expect(requests).toHaveLength(1);
    expect(requests[0].source).toBe('webview.workshop');
  });

  it('posts explicit writer-owned task actions', () => {
    const { result } = renderHook(() => useWorkshop());

    act(() => result.current.todoAction({
      action: 'add',
      sourceTurnId: 'turn-report',
      findingKey: 'finding-1'
    }));

    expect(posted(MessageType.WORKSHOP_TODO_ACTION)[0].payload).toEqual({
      action: 'add',
      sourceTurnId: 'turn-report',
      findingKey: 'finding-1'
    });
  });

  it('rehydrates the whole thread from a session snapshot', () => {
    const { result } = renderHook(() => useWorkshop());
    const turns = [
      makeTurn({ id: 't1' }),
      makeTurn({ id: 't2', role: 'assistant', content: 'Analysis…' })
    ];

    act(() => {
      result.current.handleSessionState(
        sessionState({
          excerpt: { text: 'Pinned prose.', version: 1, relativePath: 'ch1.md', pinnedAt: 1 },
          contextBrief: 'Mara is hiding her identity.',
          pendingHostUpdate: { contextBrief: true },
          todos: [{
            id: 'todo-1',
            text: 'Fix the cup continuity.',
            status: 'open',
            source: {
              kind: 'tool_report',
              turnId: 't2',
              participantLabel: 'Continuity',
              toolId: 'continuity',
              findingKey: 'finding-1',
              findingText: 'Fix the cup continuity.',
              excerptVersion: 1
            },
            createdAt: 1,
            stale: false
          }],
          turns
        })
      );
    });

    expect(result.current.sessionReady).toBe(true);
    expect(result.current.excerpt?.relativePath).toBe('ch1.md');
    expect(result.current.contextBrief).toBe('Mara is hiding her identity.');
    expect(result.current.contextBriefPending).toBe(true);
    expect(result.current.turns.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(result.current.todos[0]).toMatchObject({ id: 'todo-1', status: 'open' });
    expect(result.current.isRunning).toBe(false);
  });

  it('restores the selected tool separately from the in-flight run', () => {
    const { result } = renderHook(() => useWorkshop());

    act(() => {
      result.current.handleSessionState(
        sessionState({
          excerpt: { text: 'Pinned prose.', version: 1, pinnedAt: 1 },
          turns: [makeTurn({ id: 't1', toolId: 'gestures', toolLabel: 'Gestures' })],
          selectedToolId: 'gestures',
          hasConversation: true
        })
      );
    });

    expect(result.current.selectedToolId).toBe('gestures');
    expect(result.current.activeToolId).toBeNull();
    expect(result.current.isRunning).toBe(false);
    expect(result.current.canMessage).toBe(true);
  });

  it('adopts a mid-run request from the snapshot so post-reload chunks attach', () => {
    const { result } = renderHook(() => useWorkshop());

    act(() => {
      result.current.handleSessionState(
        sessionState({
          excerpt: { text: 'Pinned prose.', version: 1, pinnedAt: 1 },
          turns: [makeTurn({ id: 't1', toolId: 'cliche', toolLabel: 'Cliché' })],
          activeToolId: 'cliche',
          activeRequestId: 'req-live'
        })
      );
    });

    expect(result.current.currentRequestId).toBe('req-live');
    expect(result.current.activeToolId).toBe('cliche');
    expect(result.current.isRunning).toBe(true);
    expect(result.current.isStreaming).toBe(true);

    // Chunks for the adopted request land; the completed turn arrives whole.
    act(() => {
      result.current.handleStreamChunk(streamChunk('req-live', 'more '));
    });
    expect(result.current.streamingChunkCount).toBe(1);
  });

  it('appends turns and dedupes by id (live increment + snapshot overlap)', () => {
    const { result } = renderHook(() => useWorkshop());
    const turn = makeTurn({ id: 'dup' });

    act(() => {
      result.current.handleTurn(turnMessage(turn));
      result.current.handleTurn(turnMessage(turn));
    });

    expect(result.current.turns).toHaveLength(1);
  });

  it('ignores foreign-domain and stale-request stream events', () => {
    const { result } = renderHook(() => useWorkshop());

    act(() => {
      result.current.handleStreamStarted(streamStarted('req-analysis', 'analysis'));
    });
    expect(result.current.isStreaming).toBe(false);

    act(() => {
      result.current.handleStreamStarted(streamStarted('req-1'));
    });
    act(() => {
      result.current.handleStreamChunk(streamChunk('req-1', 'mine'));
      result.current.handleStreamChunk(streamChunk('req-stale', 'not mine'));
      result.current.handleStreamChunk(streamChunk('req-1', 'dictionary', 'dictionary'));
    });

    expect(result.current.streamingChunkCount).toBe(1);

    // A stale completion must not end the live stream either.
    act(() => {
      result.current.handleStreamComplete(streamComplete('req-stale', false, 'zombie'));
    });
    expect(result.current.isStreaming).toBe(true);
  });

  it('keeps the live bubble after COMPLETE and retires it only when the assistant turn lands', () => {
    const { result } = renderHook(() => useWorkshop());

    act(() => {
      result.current.handleStreamStarted(streamStarted('req-1'));
    });
    act(() => {
      result.current.handleStreamChunk(streamChunk('req-1', 'Streamed analysis text'));
    });
    act(() => {
      result.current.handleStreamComplete(streamComplete('req-1', false, 'Streamed analysis text'));
    });

    // Stream is over but the turn hasn't arrived: the bubble's content must
    // SURVIVE this window (PR #67 review #16 — the flicker was it resetting
    // here). endStreaming publishes the full buffer as displayContent.
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.currentRequestId).toBeNull();
    expect(result.current.streamingContent).toBe('Streamed analysis text');

    // The assistant turn lands → the bubble retires (content cleared).
    act(() => {
      result.current.handleTurn(
        turnMessage(makeTurn({ id: 'a1', role: 'assistant', content: 'Streamed analysis text' }))
      );
    });
    expect(result.current.turns).toHaveLength(1);
    expect(result.current.streamingContent).toBe('');
  });

  it('clears immediately on a cancelled completion (preempt/reset/failure path)', () => {
    const { result } = renderHook(() => useWorkshop());

    act(() => {
      result.current.handleStreamStarted(streamStarted('req-1'));
    });
    act(() => {
      result.current.handleStreamChunk(streamChunk('req-1', 'partial'));
    });
    act(() => {
      result.current.handleStreamComplete(streamComplete('req-1', true));
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.currentRequestId).toBeNull();
    expect(result.current.streamingContent).toBe('');
  });

  it('a no-run snapshot is authoritative: retires a live bubble after the error path', () => {
    const { result } = renderHook(() => useWorkshop());

    act(() => {
      result.current.handleStreamStarted(streamStarted('req-1'));
    });
    act(() => {
      result.current.handleStreamChunk(streamChunk('req-1', 'done'));
    });
    act(() => {
      result.current.handleStreamComplete(streamComplete('req-1', false, 'done'));
    });
    expect(result.current.streamingContent).toBe('done');

    // Handler error path posts a snapshot with no active run and no turn.
    act(() => {
      result.current.handleSessionState(sessionState({ turns: [makeTurn({ id: 't1' })] }));
    });

    expect(result.current.streamingContent).toBe('');
    expect(result.current.isRunning).toBe(false);
  });

  it('accepts only workshop-sourced STATUS (sidebar progress stays out)', () => {
    const { result } = renderHook(() => useWorkshop());

    const status = (source: string, message: string): StatusMessage => ({
      type: MessageType.STATUS,
      source: source as never,
      payload: { message },
      timestamp: 0
    });

    act(() => {
      result.current.handleStatusMessage(status('extension.dictionary', 'Generating block 3/7…'));
    });
    expect(result.current.statusMessage).toBe('');

    act(() => {
      result.current.handleStatusMessage(status('extension.workshop', 'Streaming Prose…'));
    });
    expect(result.current.statusMessage).toBe('Streaming Prose…');
  });

  it('accepts only workshop-sourced ERROR payloads and clears them on the next run', () => {
    const { result } = renderHook(() => useWorkshop());

    const error = (source: string): ErrorMessage => ({
      type: MessageType.ERROR,
      source: 'extension.workshop',
      payload: { source: source as never, message: 'Failed to run Prose', details: 'boom' },
      timestamp: 0
    });

    act(() => {
      result.current.handleErrorMessage(error('analysis.prose'));
    });
    expect(result.current.errorMessage).toBe('');

    act(() => {
      result.current.handleErrorMessage(error('workshop.run_tool'));
    });
    expect(result.current.errorMessage).toBe('Failed to run Prose — boom');

    act(() => {
      result.current.runTool('prose');
    });
    expect(result.current.errorMessage).toBe('');
  });

  it('actions post the right wire messages', () => {
    const { result } = renderHook(() => useWorkshop());

    act(() => {
      result.current.pinExcerpt('Some prose.', 'file:///ch1.md', 'ch1.md');
      result.current.runTool('gestures');
      result.current.quickAction('gestures', 'report-gestures', '3 variations');
      result.current.resetSession();
      result.current.sendMessage('Now tighten variation two.');
      result.current.pinFromFile();
      result.current.setContextBrief('Project context.');
    });

    const pin = posted(MessageType.WORKSHOP_SET_EXCERPT)[0];
    expect(pin.payload).toEqual({ text: 'Some prose.', sourceUri: 'file:///ch1.md', relativePath: 'ch1.md' });
    expect(posted(MessageType.WORKSHOP_RUN_TOOL)[0].payload).toEqual({ toolId: 'gestures' });
    expect(posted(MessageType.WORKSHOP_QUICK_ACTION)[0].payload).toEqual({
      toolId: 'gestures',
      reportTurnId: 'report-gestures',
      label: '3 variations'
    });
    expect(posted(MessageType.WORKSHOP_RESET_SESSION)).toHaveLength(1);
    expect(posted(MessageType.WORKSHOP_SEND_MESSAGE)[0].payload).toEqual({
      text: 'Now tighten variation two.'
    });
    expect(posted(MessageType.WORKSHOP_PICK_EXCERPT_FILE)).toHaveLength(1);
    expect(posted(MessageType.WORKSHOP_SET_CONTEXT_BRIEF)[0].payload).toEqual({
      text: 'Project context.'
    });
  });

  it('posts persona selection and direct-target changes, then restores both from a host snapshot', () => {
    const { result } = renderHook(() => useWorkshop());

    act(() => {
      result.current.selectPersona('quinn');
      result.current.setChatTarget({ kind: 'tool', toolId: 'continuity' });
      result.current.handleSessionState(sessionState({
        excerpt: { text: 'A pinned excerpt.', version: 1, pinnedAt: 1 },
        participants: {
          host: { personaId: 'quinn', hasConversation: true },
          toolSidecars: [{
            toolId: 'continuity',
            hasConversation: true,
            latestReportTurnId: 'report-continuity',
            availableForDirectFollowUp: true,
            activeTarget: true
          }],
          personaGuests: [],
          chatTarget: { kind: 'tool', toolId: 'continuity' }
        },
        hasConversation: true
      }));
    });

    expect(posted(MessageType.WORKSHOP_SELECT_PERSONA)[0].payload).toEqual({ personaId: 'quinn' });
    expect(posted(MessageType.WORKSHOP_SET_CHAT_TARGET)[0].payload).toEqual({ kind: 'tool', toolId: 'continuity' });
    expect(result.current.selectedPersonaId).toBe('quinn');
    expect(result.current.hasHostConversation).toBe(true);
    expect(result.current.chatTarget).toEqual({ kind: 'tool', toolId: 'continuity' });
    expect(result.current.isPersonaSelectionLocked).toBe(true);
  });

  // ── Persona composer enablement + cancel wire ────────────────────────────

  it('enables the composer for a pinned excerpt before a host conversation starts', () => {
    const { result } = renderHook(() => useWorkshop());
    expect(result.current.canMessage).toBe(false);

    act(() => {
      result.current.handleSessionState(sessionState({
        excerpt: { text: 'A pinned excerpt.', version: 1, pinnedAt: 1 },
        participants: {
          host: { personaId: 'jill', hasConversation: false },
          toolSidecars: [],
          personaGuests: [],
          chatTarget: { kind: 'host' }
        }
      }));
    });
    expect(result.current.hasHostConversation).toBe(false);
    expect(result.current.canMessage).toBe(true);

    // A live run suspends follow-ups without losing the conversation.
    act(() => {
      result.current.handleStreamStarted(streamStarted('req-1'));
    });
    expect(result.current.canMessage).toBe(false);
    expect(result.current.hasHostConversation).toBe(false);
  });

  it('cancelRun posts the workshop cancel message for the live request only', () => {
    const { result } = renderHook(() => useWorkshop());

    // No live run: nothing posted.
    act(() => {
      result.current.cancelRun();
    });
    expect(posted(MessageType.CANCEL_WORKSHOP_REQUEST)).toHaveLength(0);

    act(() => {
      result.current.handleStreamStarted(streamStarted('req-1'));
    });
    act(() => {
      result.current.cancelRun();
    });
    const cancels = posted(MessageType.CANCEL_WORKSHOP_REQUEST);
    expect(cancels).toHaveLength(1);
    expect(cancels[0].payload).toEqual({ requestId: 'req-1', domain: 'workshop' });

    // Settled window (stream done, turn pending): nothing left to cancel.
    act(() => {
      result.current.handleStreamComplete(streamComplete('req-1', false, 'done'));
    });
    act(() => {
      result.current.cancelRun();
    });
    expect(posted(MessageType.CANCEL_WORKSHOP_REQUEST)).toHaveLength(1);
  });

  // ── Sprint 3: bounded snapshots (PR #67 review #12) ──────────────────────

  it('a truncated snapshot MERGES with held turns instead of shrinking the live thread', () => {
    const { result } = renderHook(() => useWorkshop());
    const t1 = makeTurn({ id: 't1' });
    const t2 = makeTurn({ id: 't2', role: 'assistant', content: 'first analysis' });
    const t3 = makeTurn({ id: 't3' });
    const t4 = makeTurn({ id: 't4', role: 'assistant', content: 'second analysis' });

    // The webview accumulated the whole thread live.
    act(() => {
      [t1, t2, t3, t4].forEach((t) => result.current.handleTurn(turnMessage(t)));
    });

    // Host snapshot windows to the last two turns (older two truncated).
    act(() => {
      result.current.handleSessionState(
        sessionState({ turns: [t3, t4], totalTurns: 4, truncatedTurns: 2 })
      );
    });

    // Nothing hidden — the webview still holds everything.
    expect(result.current.turns.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4']);
    expect(result.current.hiddenTurns).toBe(0);
  });

  it('a truncated snapshot on a FRESH mount reports the hidden turns', () => {
    const { result } = renderHook(() => useWorkshop());
    const t3 = makeTurn({ id: 't3' });
    const t4 = makeTurn({ id: 't4', role: 'assistant', content: 'latest analysis' });

    // Reload of a marathon thread: only the window arrives.
    act(() => {
      result.current.handleSessionState(
        sessionState({ turns: [t3, t4], totalTurns: 4, truncatedTurns: 2 })
      );
    });

    expect(result.current.turns.map((t) => t.id)).toEqual(['t3', 't4']);
    expect(result.current.hiddenTurns).toBe(2);
  });
});
