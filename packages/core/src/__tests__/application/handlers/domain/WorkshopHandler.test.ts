import { WorkshopHandler } from '@/application/handlers/domain/WorkshopHandler';
import { WorkshopSessionService } from '@/application/services/WorkshopSessionService';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType, API_KEY_NOT_CONFIGURED_HEADING } from '@messages';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import { FileType } from '@/platform';
import type { FileSystem, LogSink, ShellService, Workspace } from '@/platform';
import { createFakeFileSystem, createFakeShellService, createFakeWorkspace } from '../../../mocks/platform';

const analysisResult = (content: string, extra: Record<string, unknown> = {}) => ({
  toolName: 'workshop-test',
  content,
  usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  ...extra
});

const message = (type: MessageType, payload: unknown) => ({
  type,
  source: 'webview.workshop' as const,
  payload,
  timestamp: 1
});

describe('WorkshopHandler — Sprint 05 host routing', () => {
  let session: WorkshopSessionService;
  let postMessage: jest.Mock;
  let log: LogSink;
  let service: jest.Mocked<AssistantToolService>;
  let shell: ShellService;
  let fileSystem: FileSystem;
  let workspace: Workspace;
  let handler: WorkshopHandler;

  const posted = (type: MessageType) => postMessage.mock.calls
    .map(([entry]) => entry)
    .filter((entry) => entry.type === type);

  beforeEach(() => {
    session = new WorkshopSessionService(() => 1);
    postMessage = jest.fn().mockResolvedValue(undefined);
    log = { appendLine: jest.fn() } as unknown as LogSink;
    service = {
      analyzeDialogue: jest.fn().mockResolvedValue(analysisResult('tool report', { conversationId: 'tool-conv' })),
      analyzeProse: jest.fn().mockResolvedValue(analysisResult('tool report', { conversationId: 'tool-conv' })),
      analyzeWritingTools: jest.fn().mockResolvedValue(analysisResult('tool report', { conversationId: 'tool-conv' })),
      startWorkshopPersonaConversation: jest.fn().mockResolvedValue(analysisResult('Jill reply', { conversationId: 'host-conv' })),
      continueConversation: jest.fn().mockResolvedValue(analysisResult('continued reply', { conversationId: 'continued-conv' })),
      discardConversation: jest.fn(),
      addStatusListener: jest.fn(() => jest.fn())
    } as unknown as jest.Mocked<AssistantToolService>;
    shell = createFakeShellService();
    fileSystem = createFakeFileSystem();
    workspace = createFakeWorkspace();
    handler = new WorkshopHandler(service, session, postMessage, shell, fileSystem, workspace, log);
  });

  const pin = async () => handler.handleSetExcerpt(
    message(MessageType.WORKSHOP_SET_EXCERPT, { text: 'A pinned excerpt.', relativePath: 'chapter-one.md' }) as any
  );

  it('registers both Sprint 05 routes alongside the eight existing Workshop routes', () => {
    const router = new MessageRouter();
    handler.registerRoutes(router);

    expect(router.hasHandler(MessageType.WORKSHOP_SELECT_PERSONA)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_SET_CHAT_TARGET)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_SEND_MESSAGE)).toBe(true);
    expect(router.handlerCount).toBe(10);
  });

  it('starts Jill from the composer before any tool run and retains the host conversation', async () => {
    await pin();
    postMessage.mockClear();

    await handler.handleSendMessage(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Where does this scene turn?' }) as any);

    expect(service.startWorkshopPersonaConversation).toHaveBeenCalledWith(
      expect.objectContaining({ personaId: 'jill', message: 'Where does this scene turn?' }),
      expect.objectContaining({ signal: expect.anything(), onToken: expect.any(Function) })
    );
    expect(session.getHostConversationId()).toBe('host-conv');
    const assistantTurn = posted(MessageType.WORKSHOP_TURN)[1].payload.turn;
    expect(assistantTurn).toMatchObject({ personaId: 'jill', personaLabel: 'Jill', toolId: undefined });
    expect(postMessage.mock.calls.map(([entry]) => entry.type)).toEqual([
      MessageType.WORKSHOP_TURN,
      MessageType.WORKSHOP_SESSION_STATE,
      MessageType.STREAM_STARTED,
      MessageType.STATUS,
      MessageType.STREAM_COMPLETE,
      MessageType.WORKSHOP_TURN,
      MessageType.WORKSHOP_SESSION_STATE,
      MessageType.STATUS
    ]);
  });

  it('allows selection before host start, persists it, and locks it afterward', async () => {
    await handler.handleSelectPersona(message(MessageType.WORKSHOP_SELECT_PERSONA, { personaId: 'margot' }) as any);
    expect(session.getSelectedPersonaId()).toBe('margot');
    expect(posted(MessageType.WORKSHOP_SESSION_STATE).at(-1).payload.session.participants.host.personaId).toBe('margot');

    await pin();
    await handler.handleSendMessage(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Keep this close.' }) as any);
    await handler.handleSelectPersona(message(MessageType.WORKSHOP_SELECT_PERSONA, { personaId: 'quinn' }) as any);

    expect(session.getSelectedPersonaId()).toBe('margot');
    expect(posted(MessageType.ERROR).at(-1).payload.source).toBe('workshop.select_persona');
  });

  it('rejects unknown personas without mutating the session', async () => {
    await handler.handleSelectPersona(message(MessageType.WORKSHOP_SELECT_PERSONA, { personaId: 'a-dragon' }) as any);

    expect(session.getSelectedPersonaId()).toBe('jill');
    expect(posted(MessageType.ERROR)[0].payload.message).toMatch(/Unknown Workshop persona/);
  });

  it('keeps tool-run boundary guardrails for unknown tools and missing excerpts', async () => {
    await handler.handleRunTool(message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'not-a-tool' }) as any);
    await handler.handleRunTool(message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any);

    expect(service.analyzeProse).not.toHaveBeenCalled();
    expect(posted(MessageType.ERROR).map((entry) => entry.payload.message)).toEqual([
      expect.stringMatching(/Unknown Workshop tool/),
      'Pin an excerpt before running a tool.'
    ]);
  });

  it('pins a picked text file with durable head-slice provenance', async () => {
    const content = Array.from({ length: 10_001 }, (_, index) => `word${index}`).join(' ');
    shell.pickFile = jest.fn().mockResolvedValue({ fsPath: '/chapter.md', uri: 'file:///chapter.md' });
    fileSystem.stat = jest.fn().mockResolvedValue({ type: FileType.File, size: content.length });
    fileSystem.readFile = jest.fn().mockResolvedValue(new TextEncoder().encode(content));

    await handler.handlePickExcerptFile(message(MessageType.WORKSHOP_PICK_EXCERPT_FILE, {}) as any);

    expect(session.getExcerpt()).toMatchObject({
      relativePath: 'External file: chapter.md',
      truncation: { pinnedWords: 10_000, totalWords: 10_001 }
    });
    expect(session.getExcerpt()!.text).toContain('word9999');
    expect(session.getExcerpt()!.text).not.toContain('word10000');
  });

  it('keeps a successful pre-host tool run as the explicit direct target', async () => {
    await pin();
    await handler.handleRunTool(message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'continuity' }) as any);

    expect(session.getToolSidecarConversationId('continuity')).toBe('tool-conv');
    expect(session.getChatTarget()).toEqual({ kind: 'tool', toolId: 'continuity' });
    await handler.handleSendMessage(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Where did it vanish?' }) as any);
    expect(service.continueConversation).toHaveBeenCalledWith(
      'tool-conv',
      'Where did it vanish?',
      expect.objectContaining({ signal: expect.anything() })
    );
    expect(posted(MessageType.WORKSHOP_TURN).at(-1).payload.turn).toMatchObject({
      toolId: 'continuity',
      personaId: undefined
    });
  });

  it('returns from direct mode to the selected host without discarding the tool sidecar', async () => {
    await pin();
    await handler.handleRunTool(message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any);
    await handler.handleSetChatTarget(message(MessageType.WORKSHOP_SET_CHAT_TARGET, { kind: 'host' }) as any);
    await handler.handleSendMessage(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'What should I revise first?' }) as any);

    expect(session.getToolSidecarConversationId('prose')).toBe('tool-conv');
    expect(service.startWorkshopPersonaConversation).toHaveBeenCalled();
    expect(session.getHostConversationId()).toBe('host-conv');
  });

  it('validates direct targets against live sidecars rather than trusting the webview', async () => {
    await handler.handleSetChatTarget(message(MessageType.WORKSHOP_SET_CHAT_TARGET, { kind: 'tool', toolId: 'prose' }) as any);

    expect(session.getChatTarget()).toEqual({ kind: 'host' });
    expect(posted(MessageType.ERROR)[0].payload.source).toBe('workshop.set_chat_target');
  });

  it('rejects a crafted tool run after a host conversation begins', async () => {
    await pin();
    await handler.handleSendMessage(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Start with the scene goal.' }) as any);
    postMessage.mockClear();

    await handler.handleRunTool(message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any);

    expect(service.analyzeProse).not.toHaveBeenCalled();
    expect(posted(MessageType.ERROR)[0].payload.message).toMatch(/Sprint 06/);
  });

  it('clears every retained participant when a continuation discovers resource loss', async () => {
    await pin();
    await handler.handleRunTool(message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any);
    await handler.handleSetChatTarget(message(MessageType.WORKSHOP_SET_CHAT_TARGET, { kind: 'host' }) as any);
    await handler.handleSendMessage(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Start host.' }) as any);
    service.continueConversation.mockRejectedValueOnce(Object.assign(new Error('gone'), { name: 'ConversationNotFoundError' }));

    await handler.handleSendMessage(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Continue host.' }) as any);

    expect(session.getSnapshot().participants).toEqual({
      host: { personaId: 'jill', hasConversation: false },
      toolSidecars: [],
      chatTarget: { kind: 'host' }
    });
    expect(service.discardConversation).toHaveBeenCalledWith('host-conv');
    expect(service.discardConversation).toHaveBeenCalledWith('tool-conv');
  });

  it('clears the full participant generation for a lost direct-tool conversation without leaking its id', async () => {
    await pin();
    await handler.handleRunTool(message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any);
    service.continueConversation.mockRejectedValueOnce(
      Object.assign(new Error('Conversation tool-conv not found'), { name: 'ConversationNotFoundError' })
    );

    await handler.handleSendMessage(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Try again.' }) as any);

    expect(session.getSnapshot().participants).toEqual({
      host: { personaId: 'jill', hasConversation: false },
      toolSidecars: [],
      chatTarget: { kind: 'host' }
    });
    expect(posted(MessageType.ERROR).at(-1).payload.details).not.toContain('tool-conv');
    expect((log.appendLine as jest.Mock).mock.calls.flat().join('\n')).toContain('1 conversations discarded: tool-conv');
  });

  it('keeps API-key warnings out of the thread and leaves the host unadopted', async () => {
    await pin();
    service.startWorkshopPersonaConversation.mockResolvedValueOnce(
      analysisResult(`${API_KEY_NOT_CONFIGURED_HEADING}\nConfigure a key.`) as any
    );

    await handler.handleSendMessage(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Hello?' }) as any);

    expect(session.getHostConversationId()).toBeUndefined();
    expect(session.getSnapshot().turns).toHaveLength(1);
    expect(posted(MessageType.ERROR).at(-1).payload.message).toMatch(/API key/);
  });

  it('cancels a host start without retaining its partial exchange', async () => {
    await pin();
    service.startWorkshopPersonaConversation.mockImplementationOnce(
      async (_input, options) => new Promise((resolve) => {
        options?.signal?.addEventListener('abort', () => resolve(analysisResult('partial host reply') as any));
      }) as any
    );

    const run = handler.handleSendMessage(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Start, then stop.' }) as any);
    await Promise.resolve();
    const requestId = session.getSnapshot().activeRequestId!;
    await handler.handleCancelRequest(message(MessageType.CANCEL_WORKSHOP_REQUEST, { requestId, domain: 'workshop' }) as any);
    await run;

    expect(session.getHostConversationId()).toBeUndefined();
    expect(session.getSnapshot().turns).toHaveLength(1);
    expect(posted(MessageType.STREAM_COMPLETE).at(-1).payload.cancelled).toBe(true);
  });

  it('refuses a zombie host completion after a newer message preempts it', async () => {
    await pin();
    let releaseFirst!: () => void;
    service.startWorkshopPersonaConversation.mockImplementationOnce(
      async () => new Promise((resolve) => {
        releaseFirst = () => resolve(analysisResult('zombie host reply', { conversationId: 'zombie-conv' }) as any);
      }) as any
    );

    const first = handler.handleSendMessage(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'First.' }) as any);
    await Promise.resolve();
    await handler.handleSendMessage(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Second.' }) as any);
    releaseFirst();
    await first;

    expect(session.getHostConversationId()).toBe('host-conv');
    expect(session.getSnapshot().turns.some((turn) => turn.content === 'zombie host reply')).toBe(false);
    expect(service.discardConversation).toHaveBeenCalledWith('zombie-conv');
  });

  it('disposes all host and tool participants on reset and returns to Jill', async () => {
    await pin();
    await handler.handleRunTool(message(MessageType.WORKSHOP_RUN_TOOL, { toolId: 'prose' }) as any);
    await handler.handleSetChatTarget(message(MessageType.WORKSHOP_SET_CHAT_TARGET, { kind: 'host' }) as any);
    await handler.handleSendMessage(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Start host.' }) as any);

    await handler.handleResetSession(message(MessageType.WORKSHOP_RESET_SESSION, {}) as any);

    expect(service.discardConversation).toHaveBeenCalledWith('tool-conv');
    expect(service.discardConversation).toHaveBeenCalledWith('host-conv');
    expect(session.getSnapshot().participants.host.personaId).toBe('jill');
    expect(session.getSnapshot().turns).toEqual([]);
  });
});
