/**
 * WorkshopHandler Tests (ADR 2026-07-03, Sprint 2 — session spine).
 *
 * Behavior under test: route registration for the 12th domain; a tool run
 * streams under domain 'workshop' and appends a user+assistant turn pair to
 * the shared session; excerpt/reset/session-request mutate and serve the
 * aggregate; guard rails (no excerpt, unknown tool, missing API key) surface
 * errors without corrupting the thread. Uses the REAL WorkshopSessionService —
 * it is pure, and the handler↔aggregate contract is exactly what this sprint
 * introduces.
 */

import { WorkshopHandler } from '@/application/handlers/domain/WorkshopHandler';
import { WorkshopSessionService } from '@/application/services/WorkshopSessionService';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType, API_KEY_NOT_CONFIGURED_HEADING } from '@messages';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { LogSink } from '@/platform';

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
  let handler: WorkshopHandler;

  const postedTypes = () => postMessage.mock.calls.map((c) => c[0].type);
  const postedOf = (type: MessageType) =>
    postMessage.mock.calls.map((c) => c[0]).filter((m) => m.type === type);

  beforeEach(() => {
    session = new WorkshopSessionService();
    postMessage = jest.fn().mockResolvedValue(undefined);
    log = { appendLine: jest.fn() } as unknown as LogSink;
    mockService = {
      analyzeDialogue: jest.fn().mockResolvedValue(analysisResult('dialogue analysis')),
      analyzeProse: jest.fn().mockResolvedValue(analysisResult('prose analysis')),
      analyzeWritingTools: jest.fn().mockResolvedValue(analysisResult('tools analysis')),
      addStatusListener: jest.fn(() => jest.fn())
    } as unknown as jest.Mocked<AssistantToolService>;

    handler = new WorkshopHandler(mockService, session, postMessage, log);
  });

  it('registers the four workshop routes', () => {
    const router = new MessageRouter();
    handler.registerRoutes(router);

    expect(router.hasHandler(MessageType.WORKSHOP_RUN_TOOL)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_SET_EXCERPT)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_RESET_SESSION)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_REQUEST_SESSION)).toBe(true);
    expect(router.handlerCount).toBe(4);
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
  });

  it('serves the session snapshot on request', async () => {
    session.setExcerpt({ text: 'Some prose.' });

    await handler.handleRequestSession(message(MessageType.WORKSHOP_REQUEST_SESSION, {}) as any);

    const [state] = postedOf(MessageType.WORKSHOP_SESSION_STATE);
    expect(state.source).toBe('extension.workshop');
    expect(state.payload.session.excerpt.text).toBe('Some prose.');
    expect(postedTypes()).toEqual([MessageType.WORKSHOP_SESSION_STATE]);
  });

  it('dispose releases the status listener and aborts any in-flight run', async () => {
    const disposeListener = jest.fn();
    (mockService.addStatusListener as jest.Mock).mockReturnValue(disposeListener);
    const local = new WorkshopHandler(mockService, session, postMessage, log);

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
