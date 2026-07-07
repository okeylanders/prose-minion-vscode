/**
 * WorkshopHandler Tests (ADR 2026-07-03; Sprint 2 session spine, Sprint 3
 * multi-turn).
 *
 * Behavior under test: route registration for the 12th domain; a tool run
 * streams under domain 'workshop' and appends a user+assistant turn pair to
 * the shared session; excerpt/reset/session-request mutate and serve the
 * aggregate; guard rails (no excerpt, unknown tool, missing API key) surface
 * errors without corrupting the thread. Sprint 3 pins the continuation
 * contract: tool runs retain + the session adopts conversations, follow-ups
 * continue them, reset/replacement discards them, the cancel wire aborts,
 * and "Pin from file…" seeds through the shell/fileSystem/workspace ports.
 * Uses the REAL WorkshopSessionService — it is pure, and the
 * handler↔aggregate contract is exactly what these sprints introduce.
 */

import { WorkshopHandler, WORKSHOP_FILE_EXCERPT_MAX_WORDS } from '@/application/handlers/domain/WorkshopHandler';
import { WorkshopSessionService } from '@/application/services/WorkshopSessionService';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType, API_KEY_NOT_CONFIGURED_HEADING } from '@messages';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { FileSystem, LogSink, ShellService, Workspace } from '@/platform';
import {
  createFakeFileSystem,
  createFakeShellService,
  createFakeWorkspace
} from '../../../mocks/platform';

const analysisResult = (content: string, extra: Record<string, unknown> = {}) => ({
  toolName: 'test_tool',
  content,
  usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  ...extra
});

const message = (type: MessageType, payload: unknown) => ({
  type,
  source: 'webview.workshop' as const,
  payload,
  timestamp: Date.now()
});

describe('WorkshopHandler', () => {
  let session: WorkshopSessionService;
  let postMessage: jest.Mock;
  let log: LogSink;
  let mockService: jest.Mocked<AssistantToolService>;
  let shell: ShellService;
  let fileSystem: FileSystem;
  let workspace: Workspace;
  let handler: WorkshopHandler;

  const postedTypes = () => postMessage.mock.calls.map((c) => c[0].type);
  const postedOf = (type: MessageType) =>
    postMessage.mock.calls.map((c) => c[0]).filter((m) => m.type === type);

  const buildHandler = () =>
    new WorkshopHandler(mockService, session, postMessage, shell, fileSystem, workspace, log);

  beforeEach(() => {
    session = new WorkshopSessionService();
    postMessage = jest.fn().mockResolvedValue(undefined);
    log = { appendLine: jest.fn() } as unknown as LogSink;
    mockService = {
      analyzeDialogue: jest.fn().mockResolvedValue(analysisResult('dialogue analysis')),
      analyzeProse: jest.fn().mockResolvedValue(analysisResult('prose analysis')),
      analyzeWritingTools: jest.fn().mockResolvedValue(analysisResult('tools analysis')),
      continueConversation: jest.fn().mockResolvedValue(analysisResult('follow-up reply')),
      discardConversation: jest.fn(),
      addStatusListener: jest.fn(() => jest.fn())
    } as unknown as jest.Mocked<AssistantToolService>;
    shell = createFakeShellService();
    fileSystem = createFakeFileSystem();
    workspace = createFakeWorkspace();

    handler = buildHandler();
  });

  it('registers the seven workshop routes', () => {
    const router = new MessageRouter();
    handler.registerRoutes(router);

    expect(router.hasHandler(MessageType.WORKSHOP_RUN_TOOL)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_SEND_MESSAGE)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_SET_EXCERPT)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_PICK_EXCERPT_FILE)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_RESET_SESSION)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_REQUEST_SESSION)).toBe(true);
    expect(router.hasHandler(MessageType.CANCEL_WORKSHOP_REQUEST)).toBe(true);
    expect(router.handlerCount).toBe(7);
  });

  it('pins an excerpt and broadcasts the session snapshot', async () => {
    await handler.handleSetExcerpt(
      message(MessageType.WORKSHOP_SET_EXCERPT, {
        text: 'She left the letter on the table.',
        relativePath: 'ch1.md'
      }) as any
    );

    const [state] = postedOf(MessageType.WORKSHOP_SESSION_STATE);
    expect(state.payload.session.excerpt.text).toBe('She left the letter on the table.');
    expect(session.getExcerpt()?.relativePath).toBe('ch1.md');
  });

  it('rejects an empty excerpt with a workshop error', async () => {
    await handler.handleSetExcerpt(
      message(MessageType.WORKSHOP_SET_EXCERPT, { text: '   ' }) as any
    );

    const [error] = postedOf(MessageType.ERROR);
    expect(error.payload.source).toBe('workshop');
    expect(postedOf(MessageType.WORKSHOP_SESSION_STATE)).toHaveLength(0);
  });

  it('refuses a mid-run re-pin — the finished turn must describe the excerpt it ran on', async () => {
    session.setExcerpt({ text: 'The original excerpt.' });

    let releaseRun!: () => void;
    mockService.analyzeProse.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        releaseRun = resolve;
      });
      return analysisResult('analysis of the original') as any;
    });

    const runPromise = handler.handleRunTool(
      message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any
    );
    await Promise.resolve(); // run is in flight

    await handler.handleSetExcerpt(
      message(MessageType.WORKSHOP_SET_EXCERPT, { text: 'A sneaky replacement.' }) as any
    );

    const errors = postedOf(MessageType.ERROR);
    expect(errors).toHaveLength(1);
    expect(errors[0].payload.source).toBe('workshop');
    expect(errors[0].payload.message).toMatch(/still running/i);
    // The pinned excerpt is untouched — no silent misattribution window.
    expect(session.getExcerpt()?.text).toBe('The original excerpt.');

    releaseRun();
    await runPromise;
    expect(session.getSnapshot().turns.map((t) => t.role)).toEqual(['user', 'assistant']);
    // Re-pin works again once the run has settled.
    await handler.handleSetExcerpt(
      message(MessageType.WORKSHOP_SET_EXCERPT, { text: 'A sneaky replacement.' }) as any
    );
    expect(session.getExcerpt()?.text).toBe('A sneaky replacement.');
  });

  it('refuses to run a tool without a pinned excerpt', async () => {
    await handler.handleRunTool(
      message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any
    );

    const [error] = postedOf(MessageType.ERROR);
    expect(error.payload.source).toBe('workshop.run_tool');
    expect(error.payload.message).toMatch(/excerpt/i);
    expect(mockService.analyzeProse).not.toHaveBeenCalled();
    expect(session.getSnapshot().turns).toHaveLength(0);
  });

  it('rejects an unknown tool id before touching the session', async () => {
    session.setExcerpt({ text: 'Some prose.' });

    await handler.handleRunTool(
      message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'summon-dragons' }) as any
    );

    const [error] = postedOf(MessageType.ERROR);
    expect(error.payload.message).toMatch(/Unknown Workshop tool/);
    expect(session.getSnapshot().turns).toHaveLength(0);
  });

  it('runs a tool: streams under domain workshop and appends the turn pair', async () => {
    session.setExcerpt({ text: 'Some prose.', sourceUri: 'file:///ch1.md' });
    mockService.analyzeWritingTools.mockImplementation(
      async (_text, _ctx, _uri, _focus, streamingOptions) => {
        streamingOptions?.onToken?.('chunk-1');
        streamingOptions?.onToken?.('chunk-2');
        return analysisResult('cliché analysis') as any;
      }
    );

    await handler.handleRunTool(
      message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'cliche' }) as any
    );

    // Routed to the writing-tools contract with the focus = tool id.
    expect(mockService.analyzeWritingTools).toHaveBeenCalledWith(
      'Some prose.',
      undefined,
      'file:///ch1.md',
      'cliche',
      expect.objectContaining({ signal: expect.anything(), onToken: expect.any(Function) })
    );

    // Streaming lifecycle, all under domain 'workshop'.
    const started = postedOf(MessageType.STREAM_STARTED);
    const chunks = postedOf(MessageType.STREAM_CHUNK);
    const completes = postedOf(MessageType.STREAM_COMPLETE);
    expect(started).toHaveLength(1);
    expect(started[0].payload.domain).toBe('workshop');
    expect(chunks.map((c) => c.payload.token)).toEqual(['chunk-1', 'chunk-2']);
    expect(chunks.every((c) => c.payload.domain === 'workshop')).toBe(true);
    expect(completes).toHaveLength(1);
    expect(completes[0].payload).toMatchObject({
      domain: 'workshop',
      content: 'cliché analysis',
      cancelled: false
    });

    // Turn pair posted and recorded.
    const turns = postedOf(MessageType.WORKSHOP_TURN);
    expect(turns.map((t) => t.payload.turn.role)).toEqual(['user', 'assistant']);
    expect(turns[1].payload.turn.content).toBe('cliché analysis');
    expect(turns[1].payload.turn.usage?.totalTokens).toBe(30);
    expect(session.getSnapshot().turns.map((t) => t.role)).toEqual(['user', 'assistant']);
    expect(session.getSnapshot().activeToolId).toBeUndefined();

    // Snapshot broadcast keeps the replay cache fresh (mid-run + completion).
    expect(postedOf(MessageType.WORKSHOP_SESSION_STATE).length).toBeGreaterThanOrEqual(2);

    // The EXACT cross-message order is the webview handshake contract
    // (PR #67 review #7): useWorkshop keeps the live bubble alive until the
    // assistant turn lands, so STREAM_COMPLETE must precede it, and both
    // turns must bracket the stream. A refactor that reorders these should
    // fail here, not in a user's thread.
    expect(postedTypes()).toEqual([
      MessageType.WORKSHOP_TURN, // user
      MessageType.WORKSHOP_SESSION_STATE, // mid-run snapshot (reload adoption)
      MessageType.STREAM_STARTED,
      MessageType.STATUS, // "Streaming Cliché…"
      MessageType.STREAM_CHUNK,
      MessageType.STREAM_CHUNK,
      MessageType.STREAM_COMPLETE,
      MessageType.WORKSHOP_TURN, // assistant — strictly after COMPLETE
      MessageType.WORKSHOP_SESSION_STATE, // completion snapshot
      MessageType.STATUS // final '' clear
    ]);
  });

  it('a preempted run cannot blank the successor\'s status, and its late result is refused', async () => {
    session.setExcerpt({ text: 'Some prose.' });

    let releaseFirst!: () => void;
    mockService.analyzeProse.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      return analysisResult('first result — must never land') as any;
    });
    let releaseSecond!: () => void;
    mockService.analyzeDialogue.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        releaseSecond = resolve;
      });
      return analysisResult('second result') as any;
    });

    const firstRun = handler.handleRunTool(
      message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any
    );
    await Promise.resolve();

    const secondRun = handler.handleRunTool(
      message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'dialogue' }) as any
    );
    await Promise.resolve();

    // Preemption leaves a request-correlated trail (PR #67 review #4).
    expect((log.appendLine as jest.Mock).mock.calls.flat().join('\n')).toMatch(
      /Preempting in-flight run: workshop_prose-.*\(Prose\)/
    );

    // First run settles AFTER being preempted: its finally must NOT blank
    // the second run's "Streaming…" ticker (PR #67 review #15).
    releaseFirst();
    await firstRun;

    const statusesAfterFirstSettles = postedOf(MessageType.STATUS).map((s) => s.payload.message);
    expect(statusesAfterFirstSettles[statusesAfterFirstSettles.length - 1]).toBe(
      'Streaming Dialogue & Beats…'
    );
    // Its stream completed as cancelled, and the cancellation left a trail.
    const firstComplete = postedOf(MessageType.STREAM_COMPLETE)[0];
    expect(firstComplete.payload.cancelled).toBe(true);
    expect((log.appendLine as jest.Mock).mock.calls.flat().join('\n')).toMatch(
      /Run cancelled: workshop_prose-/
    );

    releaseSecond();
    await secondRun;

    // The thread records both attempts but only the survivor's analysis.
    expect(session.getSnapshot().turns.map((t) => [t.role, t.toolId])).toEqual([
      ['user', 'prose'],
      ['user', 'dialogue'],
      ['assistant', 'dialogue']
    ]);
    // And the second run's own finally does clear the ticker at the end.
    const finalStatuses = postedOf(MessageType.STATUS).map((s) => s.payload.message);
    expect(finalStatuses[finalStatuses.length - 1]).toBe('');
  });

  it('guide-loading status is forwarded only while a workshop run is in flight (idle gating)', async () => {
    // Capture the listener the handler registered on the shared service.
    let capturedListener: ((m: string, p?: unknown, t?: string) => void) | undefined;
    const localService = {
      ...mockService,
      addStatusListener: jest.fn((listener) => {
        capturedListener = listener;
        return jest.fn();
      })
    } as unknown as jest.Mocked<AssistantToolService>;
    const localPost = jest.fn().mockResolvedValue(undefined);
    const localHandler = new WorkshopHandler(
      localService,
      session,
      localPost,
      shell,
      fileSystem,
      workspace,
      log
    );
    expect(capturedListener).toBeDefined();

    // Idle: another surface's guide loading must not surface here.
    capturedListener!('Loading requested craft guides...', undefined, 'guide.md');
    expect(localPost).not.toHaveBeenCalled();

    // In flight: the same signal IS this run's progress — forward it.
    session.setExcerpt({ text: 'Some prose.' });
    let releaseRun!: () => void;
    (localService.analyzeProse as jest.Mock).mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        releaseRun = resolve;
      });
      return analysisResult('done') as any;
    });
    const runPromise = localHandler.handleRunTool(
      message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any
    );
    await Promise.resolve();

    capturedListener!('Loading requested craft guides...', undefined, 'guide.md');
    const statuses = localPost.mock.calls
      .map((c) => c[0])
      .filter((m) => m.type === MessageType.STATUS)
      .map((m) => m.payload.message);
    expect(statuses).toContain('Loading requested craft guides...');

    releaseRun();
    await runPromise;
  });

  it('routes dialogue and prose ids to their dedicated service calls', async () => {
    session.setExcerpt({ text: 'Some prose.' });

    await handler.handleRunTool(message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'dialogue' }) as any);
    expect(mockService.analyzeDialogue).toHaveBeenCalledTimes(1);

    await handler.handleRunTool(message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any);
    expect(mockService.analyzeProse).toHaveBeenCalledTimes(1);
    expect(mockService.analyzeWritingTools).not.toHaveBeenCalled();
  });

  it('keeps the thread clean and reports an error when the API key is missing', async () => {
    session.setExcerpt({ text: 'Some prose.' });
    mockService.analyzeProse.mockResolvedValue(
      analysisResult(`${API_KEY_NOT_CONFIGURED_HEADING}\n\nConfigure your key…`) as any
    );

    await handler.handleRunTool(
      message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any
    );

    const [error] = postedOf(MessageType.ERROR);
    expect(error.payload.message).toMatch(/API key/i);
    // The attempted user turn stays; no assistant turn carries the warning.
    const roles = session.getSnapshot().turns.map((t) => t.role);
    expect(roles).toEqual(['user']);
    const completes = postedOf(MessageType.STREAM_COMPLETE);
    expect(completes[0].payload.cancelled).toBe(true);
  });

  it('surfaces service failures as workshop errors and unsticks the stream', async () => {
    session.setExcerpt({ text: 'Some prose.' });
    mockService.analyzeProse.mockRejectedValue(new Error('boom'));

    await handler.handleRunTool(
      message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any
    );

    const [error] = postedOf(MessageType.ERROR);
    expect(error.payload).toMatchObject({ source: 'workshop.run_tool', details: 'boom' });
    const completes = postedOf(MessageType.STREAM_COMPLETE);
    expect(completes).toHaveLength(1);
    expect(completes[0].payload.cancelled).toBe(true);
    expect(session.getSnapshot().activeToolId).toBeUndefined();
    expect(session.getSnapshot().turns.map((t) => t.role)).toEqual(['user']);
  });

  it('reset clears the thread (and aborts nothing when idle) then serves the empty session', async () => {
    session.setExcerpt({ text: 'Some prose.' });
    await handler.handleRunTool(message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any);
    postMessage.mockClear();

    await handler.handleResetSession(message(MessageType.WORKSHOP_RESET_SESSION, {}) as any);

    const [state] = postedOf(MessageType.WORKSHOP_SESSION_STATE);
    expect(state.payload.session.turns).toEqual([]);
    expect(state.payload.session.activeToolId).toBeUndefined();
    // Excerpt survives reset — new session over the same working text.
    expect(state.payload.session.excerpt.text).toBe('Some prose.');
  });

  it('a reset mid-run aborts the in-flight request and drops its late completion', async () => {
    session.setExcerpt({ text: 'Some prose.' });

    let releaseRun!: () => void;
    let observedSignal: AbortSignal | undefined;
    mockService.analyzeProse.mockImplementation(async (_t, _c, _u, streamingOptions) => {
      observedSignal = streamingOptions?.signal;
      await new Promise<void>((resolve) => {
        releaseRun = resolve;
      });
      return analysisResult('late result') as any;
    });

    const runPromise = handler.handleRunTool(
      message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any
    );
    await Promise.resolve(); // let the run reach the service call

    await handler.handleResetSession(message(MessageType.WORKSHOP_RESET_SESSION, {}) as any);
    expect(observedSignal?.aborted).toBe(true);

    releaseRun();
    await runPromise;

    // The zombie result never lands: no assistant turn, thread stays empty.
    expect(session.getSnapshot().turns).toEqual([]);
    const turnPosts = postedOf(MessageType.WORKSHOP_TURN).map((t) => t.payload.turn.role);
    expect(turnPosts).toEqual(['user']); // only the pre-reset user turn was ever posted

    // Designed disappearances leave a request-correlated trail (PR #67 #4).
    const logLines = (log.appendLine as jest.Mock).mock.calls.flat().join('\n');
    expect(logLines).toMatch(/Preempting in-flight run: workshop_prose-/);
    expect(logLines).toMatch(/Run cancelled: workshop_prose-/);
  });

  it('serves the session snapshot on request', async () => {
    session.setExcerpt({ text: 'Some prose.' });

    await handler.handleRequestSession(message(MessageType.WORKSHOP_REQUEST_SESSION, {}) as any);

    const [state] = postedOf(MessageType.WORKSHOP_SESSION_STATE);
    expect(state.source).toBe('extension.workshop');
    expect(state.payload.session.excerpt.text).toBe('Some prose.');
    expect(postedTypes()).toEqual([MessageType.WORKSHOP_SESSION_STATE]);
  });

  // ── Sprint 3: conversation lifecycle (retain / continue / discard) ──────

  const runToolToCompletion = async (toolId: string, conversationId: string, content = 'analysis') => {
    const method =
      toolId === 'prose'
        ? mockService.analyzeProse
        : toolId === 'dialogue'
          ? mockService.analyzeDialogue
          : mockService.analyzeWritingTools;
    method.mockResolvedValueOnce(analysisResult(content, { conversationId }) as any);
    await handler.handleRunTool(message(MessageType.WORKSHOP_RUN_TOOL, { toolId }) as any);
  };

  it('asks the service to retain the conversation on every tool run', async () => {
    session.setExcerpt({ text: 'Some prose.' });

    await handler.handleRunTool(message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any);

    expect(mockService.analyzeProse).toHaveBeenCalledWith(
      'Some prose.',
      undefined,
      undefined,
      expect.objectContaining({ retainConversation: true })
    );
  });

  it('adopts the run\'s conversation and discards the one it replaces', async () => {
    session.setExcerpt({ text: 'Some prose.' });

    await runToolToCompletion('prose', 'conv-1');
    expect(session.getConversationId()).toBe('conv-1');
    expect(mockService.discardConversation).not.toHaveBeenCalled();

    await runToolToCompletion('dialogue', 'conv-2');
    expect(session.getConversationId()).toBe('conv-2');
    // One live conversation per session: the replaced one must not leak.
    expect(mockService.discardConversation).toHaveBeenCalledTimes(1);
    expect(mockService.discardConversation).toHaveBeenCalledWith('conv-1');
  });

  it('a zombie completion\'s retained conversation is discarded, never adopted', async () => {
    session.setExcerpt({ text: 'Some prose.' });

    let releaseRun!: () => void;
    mockService.analyzeProse.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        releaseRun = resolve;
      });
      return analysisResult('late result', { conversationId: 'conv-zombie' }) as any;
    });

    const runPromise = handler.handleRunTool(
      message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any
    );
    await Promise.resolve();

    // Reset the AGGREGATE directly (not via the handler, which would abort
    // the signal and resolve through the cancelled branch instead): the run
    // completes "successfully" but its requestId is stale.
    session.reset();
    releaseRun();
    await runPromise;

    expect(session.getConversationId()).toBeUndefined();
    expect(mockService.discardConversation).toHaveBeenCalledWith('conv-zombie');
    expect(session.getSnapshot().turns).toEqual([]);
  });

  it('reset discards the session conversation', async () => {
    session.setExcerpt({ text: 'Some prose.' });
    await runToolToCompletion('prose', 'conv-1');

    await handler.handleResetSession(message(MessageType.WORKSHOP_RESET_SESSION, {}) as any);

    expect(session.getConversationId()).toBeUndefined();
    expect(mockService.discardConversation).toHaveBeenCalledWith('conv-1');
  });

  // ── Sprint 3: free-text follow-ups (WORKSHOP_SEND_MESSAGE) ──────────────

  it('refuses a follow-up when no conversation exists', async () => {
    session.setExcerpt({ text: 'Some prose.' });

    await handler.handleSendMessage(
      message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'tighten it' }) as any
    );

    const [error] = postedOf(MessageType.ERROR);
    expect(error.payload.source).toBe('workshop.send_message');
    expect(error.payload.message).toMatch(/Run a tool first/i);
    expect(mockService.continueConversation).not.toHaveBeenCalled();
    expect(session.getSnapshot().turns).toEqual([]);
  });

  it('refuses an empty follow-up', async () => {
    session.setExcerpt({ text: 'Some prose.' });
    await runToolToCompletion('prose', 'conv-1');
    postMessage.mockClear();

    await handler.handleSendMessage(
      message(MessageType.WORKSHOP_SEND_MESSAGE, { text: '   ' }) as any
    );

    const [error] = postedOf(MessageType.ERROR);
    expect(error.payload.message).toMatch(/empty message/i);
    expect(mockService.continueConversation).not.toHaveBeenCalled();
  });

  it('a follow-up continues the SAME conversation and appends a message turn pair in wire order', async () => {
    session.setExcerpt({ text: 'Some prose.' });
    await runToolToCompletion('prose', 'conv-1');
    postMessage.mockClear();

    mockService.continueConversation.mockImplementation(
      async (_id, _text, streamingOptions) => {
        streamingOptions?.onToken?.('tight');
        streamingOptions?.onToken?.('ened');
        return analysisResult('tightened version') as any;
      }
    );

    await handler.handleSendMessage(
      message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Now tighten variation two.' }) as any
    );

    // Continuation, not restart: the session's conversation id is the target.
    expect(mockService.continueConversation).toHaveBeenCalledWith(
      'conv-1',
      'Now tighten variation two.',
      expect.objectContaining({ signal: expect.anything(), onToken: expect.any(Function) })
    );
    // The id is STABLE across the follow-up.
    expect(session.getConversationId()).toBe('conv-1');

    // Message-kind turn pair recorded.
    const turnMessages = postedOf(MessageType.WORKSHOP_TURN);
    expect(turnMessages.map((t) => [t.payload.turn.role, t.payload.turn.kind])).toEqual([
      ['user', 'message'],
      ['assistant', 'message']
    ]);
    expect(turnMessages[0].payload.turn.content).toBe('Now tighten variation two.');
    expect(turnMessages[1].payload.turn.content).toBe('tightened version');

    // Same wire-order contract as a tool run (PR #67 review #7).
    expect(postedTypes()).toEqual([
      MessageType.WORKSHOP_TURN, // user (message)
      MessageType.WORKSHOP_SESSION_STATE,
      MessageType.STREAM_STARTED,
      MessageType.STATUS, // "Streaming follow-up…"
      MessageType.STREAM_CHUNK,
      MessageType.STREAM_CHUNK,
      MessageType.STREAM_COMPLETE,
      MessageType.WORKSHOP_TURN, // assistant — strictly after COMPLETE
      MessageType.WORKSHOP_SESSION_STATE,
      MessageType.STATUS // final '' clear
    ]);
  });

  it('a lost conversation surfaces honestly: clears the reference, no silent restart', async () => {
    session.setExcerpt({ text: 'Some prose.' });
    await runToolToCompletion('prose', 'conv-1');
    postMessage.mockClear();

    const lost = new Error('Conversation conv-1 not found');
    lost.name = 'ConversationNotFoundError';
    mockService.continueConversation.mockRejectedValue(lost);

    await handler.handleSendMessage(
      message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'still there?' }) as any
    );

    const [error] = postedOf(MessageType.ERROR);
    expect(error.payload.source).toBe('workshop.send_message');
    expect(error.payload.message).toMatch(/no longer available/i);
    // Reference cleared so the composer disables (hasConversation: false).
    expect(session.getConversationId()).toBeUndefined();
    const states = postedOf(MessageType.WORKSHOP_SESSION_STATE);
    expect(states[states.length - 1].payload.session.hasConversation).toBe(false);
    // The stream unsticks and the attempted user turn stays in the thread.
    expect(postedOf(MessageType.STREAM_COMPLETE)[0].payload.cancelled).toBe(true);
    expect(session.getSnapshot().turns.map((t) => [t.role, t.kind])).toEqual([
      ['user', 'tool_run'],
      ['assistant', 'tool_run'],
      ['user', 'message']
    ]);
  });

  // ── Sprint 3: the cancel wire (CANCEL_WORKSHOP_REQUEST) ─────────────────

  it('cancel aborts the matching in-flight run, which resolves through the cancelled branch', async () => {
    session.setExcerpt({ text: 'Some prose.' });

    let releaseRun!: () => void;
    let observedSignal: AbortSignal | undefined;
    mockService.analyzeProse.mockImplementation(async (_t, _c, _u, streamingOptions) => {
      observedSignal = streamingOptions?.signal;
      await new Promise<void>((resolve) => {
        releaseRun = resolve;
      });
      return analysisResult('partial content') as any;
    });

    const runPromise = handler.handleRunTool(
      message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any
    );
    await Promise.resolve();

    const requestId = session.getSnapshot().activeRequestId!;
    await handler.handleCancelRequest(
      message(MessageType.CANCEL_WORKSHOP_REQUEST, { requestId, domain: 'workshop' }) as any
    );
    expect(observedSignal?.aborted).toBe(true);

    releaseRun();
    await runPromise;

    // Resolves exactly like a preemption-style abort: cancelled COMPLETE,
    // user turn kept, no assistant turn, request-correlated log line.
    const completes = postedOf(MessageType.STREAM_COMPLETE);
    expect(completes[0].payload.cancelled).toBe(true);
    expect(session.getSnapshot().turns.map((t) => t.role)).toEqual(['user']);
    const logLines = (log.appendLine as jest.Mock).mock.calls.flat().join('\n');
    expect(logLines).toMatch(/Cancel requested: workshop_prose-/);
    expect(logLines).toMatch(/Run cancelled: workshop_prose-/);
  });

  it('cancel ignores other domains and stale request ids', async () => {
    session.setExcerpt({ text: 'Some prose.' });

    let releaseRun!: () => void;
    let observedSignal: AbortSignal | undefined;
    mockService.analyzeProse.mockImplementation(async (_t, _c, _u, streamingOptions) => {
      observedSignal = streamingOptions?.signal;
      await new Promise<void>((resolve) => {
        releaseRun = resolve;
      });
      return analysisResult('content') as any;
    });

    const runPromise = handler.handleRunTool(
      message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any
    );
    await Promise.resolve();
    const requestId = session.getSnapshot().activeRequestId!;

    await handler.handleCancelRequest(
      message(MessageType.CANCEL_WORKSHOP_REQUEST, { requestId, domain: 'analysis' }) as any
    );
    await handler.handleCancelRequest(
      message(MessageType.CANCEL_WORKSHOP_REQUEST, { requestId: 'someone-else', domain: 'workshop' }) as any
    );
    expect(observedSignal?.aborted).toBe(false);

    releaseRun();
    await runPromise;
    expect(session.getSnapshot().turns.map((t) => t.role)).toEqual(['user', 'assistant']);
  });

  // ── Sprint 3: "Pin from file…" (WORKSHOP_PICK_EXCERPT_FILE) ─────────────

  it('pins a picked file\'s content with full provenance', async () => {
    shell.pickFile = jest.fn().mockResolvedValue({
      fsPath: '/ws/chapters/ch2.md',
      uri: 'file:///ws/chapters/ch2.md'
    });
    fileSystem = createFakeFileSystem({}, { '/ws/chapters/ch2.md': 'The rain kept its own counsel.' });
    workspace = createFakeWorkspace({ asRelativePath: (p) => p.replace('/ws/', '') });
    handler = buildHandler();

    await handler.handlePickExcerptFile(
      message(MessageType.WORKSHOP_PICK_EXCERPT_FILE, {}) as any
    );

    const excerpt = session.getExcerpt();
    expect(excerpt).toMatchObject({
      text: 'The rain kept its own counsel.',
      sourceUri: 'file:///ws/chapters/ch2.md',
      relativePath: 'chapters/ch2.md'
    });
    expect(excerpt?.truncation).toBeUndefined();
    expect(postedOf(MessageType.WORKSHOP_SESSION_STATE)).toHaveLength(1);
    expect(postedOf(MessageType.ERROR)).toHaveLength(0);
  });

  it('a dismissed picker is a no-op, not an error', async () => {
    shell.pickFile = jest.fn().mockResolvedValue(undefined);
    handler = buildHandler();

    await handler.handlePickExcerptFile(
      message(MessageType.WORKSHOP_PICK_EXCERPT_FILE, {}) as any
    );

    expect(session.getExcerpt()).toBeUndefined();
    expect(postedOf(MessageType.ERROR)).toHaveLength(0);
    expect(postedOf(MessageType.WORKSHOP_SESSION_STATE)).toHaveLength(0);
  });

  it('head-slices a huge file and records the truncation on the excerpt', async () => {
    const totalWords = WORKSHOP_FILE_EXCERPT_MAX_WORDS + 500;
    const novel = Array.from({ length: totalWords }, (_, i) => `word${i}`).join(' ');
    shell.pickFile = jest.fn().mockResolvedValue({ fsPath: '/ws/novel.md', uri: 'file:///ws/novel.md' });
    fileSystem = createFakeFileSystem({}, { '/ws/novel.md': novel });
    handler = buildHandler();

    await handler.handlePickExcerptFile(
      message(MessageType.WORKSHOP_PICK_EXCERPT_FILE, {}) as any
    );

    const excerpt = session.getExcerpt();
    expect(excerpt?.truncation).toEqual({
      pinnedWords: WORKSHOP_FILE_EXCERPT_MAX_WORDS,
      totalWords
    });
    expect(excerpt?.text.split(/\s+/)).toHaveLength(WORKSHOP_FILE_EXCERPT_MAX_WORDS);
    const logLines = (log.appendLine as jest.Mock).mock.calls.flat().join('\n');
    expect(logLines).toMatch(/head-sliced/);
  });

  it('refuses to pick a file mid-run (same guard as re-pin)', async () => {
    session.setExcerpt({ text: 'The original excerpt.' });
    shell.pickFile = jest.fn();
    handler = buildHandler();

    let releaseRun!: () => void;
    mockService.analyzeProse.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        releaseRun = resolve;
      });
      return analysisResult('analysis') as any;
    });
    const runPromise = handler.handleRunTool(
      message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any
    );
    await Promise.resolve();

    await handler.handlePickExcerptFile(
      message(MessageType.WORKSHOP_PICK_EXCERPT_FILE, {}) as any
    );

    const errors = postedOf(MessageType.ERROR);
    expect(errors).toHaveLength(1);
    expect(errors[0].payload.message).toMatch(/still running/i);
    expect(shell.pickFile).not.toHaveBeenCalled();

    releaseRun();
    await runPromise;
  });

  it('dispose releases the status listener and aborts any in-flight run', async () => {
    const disposeListener = jest.fn();
    (mockService.addStatusListener as jest.Mock).mockReturnValue(disposeListener);
    const local = buildHandler();

    session.setExcerpt({ text: 'Some prose.' });
    let releaseRun!: () => void;
    let observedSignal: AbortSignal | undefined;
    mockService.analyzeProse.mockImplementation(async (_t, _c, _u, streamingOptions) => {
      observedSignal = streamingOptions?.signal;
      await new Promise<void>((resolve) => {
        releaseRun = resolve;
      });
      return analysisResult('late') as any;
    });

    const runPromise = local.handleRunTool(
      message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any
    );
    await Promise.resolve();

    local.dispose();

    expect(disposeListener).toHaveBeenCalledTimes(1);
    expect(observedSignal?.aborted).toBe(true);
    expect(session.getSnapshot().activeRequestId).toBeUndefined();

    releaseRun();
    await runPromise;
    expect(session.getSnapshot().turns.map((t) => t.role)).toEqual(['user']);
  });
});
