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

const sessionState = (session: Partial<WorkshopSessionSnapshot>): WorkshopSessionStateMessage => ({
  type: MessageType.WORKSHOP_SESSION_STATE,
  source: 'extension.workshop',
  payload: { session: { turns: [], ...session } },
  timestamp: 0
});

const makeTurn = (overrides: Partial<WorkshopTurn>): WorkshopTurn => ({
  id: 'turn-1-user-1000',
  role: 'user',
  kind: 'tool_run',
  toolId: 'prose',
  toolLabel: 'Prose',
  content: 'Run **Prose** on the pinned excerpt.',
  timestamp: 1000,
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

  it('rehydrates the whole thread from a session snapshot', () => {
    const { result } = renderHook(() => useWorkshop());
    const turns = [
      makeTurn({ id: 't1' }),
      makeTurn({ id: 't2', role: 'assistant', content: 'Analysis…' })
    ];

    act(() => {
      result.current.handleSessionState(
        sessionState({
          excerpt: { text: 'Pinned prose.', relativePath: 'ch1.md', pinnedAt: 1 },
          turns
        })
      );
    });

    expect(result.current.sessionReady).toBe(true);
    expect(result.current.excerpt?.relativePath).toBe('ch1.md');
    expect(result.current.turns.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(result.current.isRunning).toBe(false);
  });

  it('adopts a mid-run request from the snapshot so post-reload chunks attach', () => {
    const { result } = renderHook(() => useWorkshop());

    act(() => {
      result.current.handleSessionState(
        sessionState({
          excerpt: { text: 'Pinned prose.', pinnedAt: 1 },
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
      result.current.resetSession();
    });

    const pin = posted(MessageType.WORKSHOP_SET_EXCERPT)[0];
    expect(pin.payload).toEqual({ text: 'Some prose.', sourceUri: 'file:///ch1.md', relativePath: 'ch1.md' });
    expect(posted(MessageType.WORKSHOP_RUN_TOOL)[0].payload).toEqual({ toolId: 'gestures' });
    expect(posted(MessageType.WORKSHOP_RESET_SESSION)).toHaveLength(1);
  });
});
