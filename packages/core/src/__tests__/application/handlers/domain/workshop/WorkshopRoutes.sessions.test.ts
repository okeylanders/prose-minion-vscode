import {
  MessageType
} from '@messages';
import {
  analysisResult,
  message,
  createWorkshopRouteTestHarness
} from './WorkshopRouteTestHarness';
import type { WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

describe('Workshop composed routing — session owner', () => {
  let session: WorkshopRouteTestHarness['session'];
  let postMessage: WorkshopRouteTestHarness['postMessage'];
  let log: WorkshopRouteTestHarness['log'];
  let service: WorkshopRouteTestHarness['service'];
  let shell: WorkshopRouteTestHarness['shell'];
  let workspace: WorkshopRouteTestHarness['workspace'];
  let router: WorkshopRouteTestHarness['router'];
  let contextBudgets: WorkshopRouteTestHarness['contextBudgets'];
  let contextSources: WorkshopRouteTestHarness['contextSources'];
  let persistence: WorkshopRouteTestHarness['persistence'];
  let posted: WorkshopRouteTestHarness['posted'];
  let storeContext: WorkshopRouteTestHarness['storeContext'];
  let pin: WorkshopRouteTestHarness['pin'];
  let runProse: WorkshopRouteTestHarness['runProse'];

  beforeEach(() => {
    ({
      session,
      postMessage,
      log,
      service,
      shell,
      workspace,
      router,
      contextBudgets,
      contextSources,
      persistence,
      posted,
      storeContext,
      pin,
      runProse
    } = createWorkshopRouteTestHarness());
  });

  it('forwards the coordinator named-save state as typed Workshop IPC', () => {
    const listener = persistence.addSessionSaveStatusListener.mock.calls[0][0];

    listener({ sessionId: 'named-room', status: 'saving' });

    expect(posted(MessageType.WORKSHOP_SESSION_SAVE_STATUS).at(-1).payload).toEqual({
      sessionId: 'named-room',
      status: 'saving'
    });
  });

  it('posts recovery notices after session state and consumes them only once', async () => {
    const notice = {
      code: 'recovered-lexical-gravity-v1',
      widgetId: 'lexical-gravity',
      configId: 'wc-1',
      message: 'Restored an older Lexical Gravity configuration.'
    } as const;
    persistence.consumeRecoveryNotices
      .mockReturnValueOnce([notice])
      .mockReturnValueOnce([]);

    await router.route(message(MessageType.WORKSHOP_REQUEST_SESSION, {}) as any);
    await router.route(message(MessageType.WORKSHOP_REQUEST_SESSION, {}) as any);

    const sessionStateOrder = postMessage.mock.calls.findIndex(
      ([entry]) => entry.type === MessageType.WORKSHOP_SESSION_STATE
    );
    const recoveryOrder = postMessage.mock.calls.findIndex(
      ([entry]) => entry.type === MessageType.WORKSHOP_SESSION_RECOVERY_NOTICE
    );
    expect(recoveryOrder).toBeGreaterThan(sessionStateOrder);
    expect(posted(MessageType.WORKSHOP_SESSION_RECOVERY_NOTICE)).toHaveLength(1);
    expect(posted(MessageType.WORKSHOP_SESSION_RECOVERY_NOTICE)[0].payload).toEqual(notice);
  });

  it('settles a routed session action rejected behind an earlier operation', async () => {
    persistence.isSessionOperationPending.mockReturnValue(true);

    await router.route(message(MessageType.WORKSHOP_OPEN_SESSION, {
      sessionId: 'must-wait'
    }) as any);

    expect(persistence.openNamed).not.toHaveBeenCalled();
    expect(posted(MessageType.WORKSHOP_SESSION_ACTION_RESULT).at(-1).payload)
      .toMatchObject({
        action: 'open',
        ok: false,
        message: expect.stringMatching(/session save or replacement/i)
      });
  });

  it('projects independent Jill, guest, and tool context readings without exposing conversation ids', async () => {
    const readProjected = async () => {
      postMessage.mockClear();
      await router.route(message(MessageType.WORKSHOP_REQUEST_SESSION, {}) as any);
      return posted(MessageType.WORKSHOP_SESSION_STATE).at(-1).payload.session.contextBudget;
    };

    await pin();
    await router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Host read.' }) as any);
    storeContext('host-conv', 30);
    expect(await readProjected()).toMatchObject({ label: 'Jill context', snapshot: { contextTokens: 32 } });

    await router.route(message(
      MessageType.WORKSHOP_INVITE_GUEST,
      { personaId: 'margot', openingMessage: 'Guest read.' }
    ) as any);
    storeContext('guest-conv', 20);
    expect(await readProjected()).toMatchObject({ label: 'Margot context', snapshot: { contextTokens: 22 } });

    await runProse();
    storeContext('tool-conv', 10);
    await router.route(message(
      MessageType.WORKSHOP_SET_CHAT_TARGET,
      { kind: 'tool', toolId: 'prose' }
    ) as any);
    expect(await readProjected()).toMatchObject({ label: 'Prose context', snapshot: { contextTokens: 12 } });

    await router.route(message(
      MessageType.WORKSHOP_SET_CHAT_TARGET,
      { kind: 'host' }
    ) as any);
    const jillAgain = await readProjected();
    expect(jillAgain).toMatchObject({ label: 'Jill context', snapshot: { contextTokens: 32 } });
    expect(JSON.stringify(jillAgain)).not.toContain('host-conv');
    expect(JSON.stringify(jillAgain)).not.toContain('guest-conv');
    expect(JSON.stringify(jillAgain)).not.toContain('tool-conv');
  });

  describe('session persistence routes', () => {
    it('delegates browser actions and posts typed list/action responses', async () => {
      await router.route(message(
        MessageType.WORKSHOP_SAVE_SESSION,
        { title: 'Saved Room' }
      ) as any);
      await router.route(message(
        MessageType.WORKSHOP_LIST_SESSIONS,
        { requestId: 'list-1', query: 'room' }
      ) as any);
      await router.route(message(
        MessageType.WORKSHOP_OPEN_SESSION,
        { sessionId: 'saved-1' }
      ) as any);
      await router.route(message(
        MessageType.WORKSHOP_RENAME_SESSION,
        { sessionId: 'saved-1', title: 'Renamed Room' }
      ) as any);
      await router.route(message(
        MessageType.WORKSHOP_DUPLICATE_SESSION,
        { sessionId: 'saved-1', title: 'Copied Room' }
      ) as any);
      await router.route(message(
        MessageType.WORKSHOP_REVEAL_SESSION,
        { sessionId: 'saved-1' }
      ) as any);
      await router.route(message(
        MessageType.WORKSHOP_DELETE_SESSION,
        { sessionId: 'saved-1' }
      ) as any);
      await router.route(message(
        MessageType.WORKSHOP_RESET_SESSION,
        {}
      ) as any);

      expect(persistence.saveNamed).toHaveBeenCalledWith('Saved Room', undefined);
      expect(persistence.list).toHaveBeenCalledWith('room', expect.any(AbortSignal));
      expect(persistence.openNamed).toHaveBeenCalledWith('saved-1');
      expect(persistence.renameNamed).toHaveBeenCalledWith('saved-1', 'Renamed Room');
      expect(persistence.duplicateNamed).toHaveBeenCalledWith('saved-1', 'Copied Room');
      expect(persistence.resolveRevealPath).toHaveBeenCalledWith('saved-1');
      expect(shell.revealFileInOS).toHaveBeenCalledWith(
        '/workspace/prose-minion/sessions/saved-1.json'
      );
      expect(persistence.deleteNamed).toHaveBeenCalledWith('saved-1');
      expect(persistence.resetSession).toHaveBeenCalledTimes(1);

      expect(posted(MessageType.WORKSHOP_SESSIONS_DATA).at(-1)).toMatchObject({
        source: 'extension.workshop',
        payload: {
          requestId: 'list-1',
          available: true,
          current: expect.objectContaining({ sessionId: 'current' }),
          sessions: [],
          truncated: false,
          searchTruncated: false
        }
      });
      expect(posted(MessageType.WORKSHOP_SESSION_ACTION_RESULT).map(
        (entry) => entry.payload
      )).toEqual([
        expect.objectContaining({ action: 'save', ok: true }),
        expect.objectContaining({ action: 'open', ok: true }),
        expect.objectContaining({ action: 'rename', ok: true }),
        expect.objectContaining({ action: 'duplicate', ok: true }),
        expect.objectContaining({ action: 'reveal', ok: true }),
        expect.objectContaining({ action: 'delete', ok: true }),
        expect.objectContaining({ action: 'new', ok: true })
      ]);
    });

    it('reports a failed durable New promotion without claiming the room changed', async () => {
      persistence.resetSession.mockRejectedValueOnce(new Error('current promotion failed'));

      await router.route(message(
        MessageType.WORKSHOP_RESET_SESSION,
        {}
      ) as any);

      expect(posted(MessageType.WORKSHOP_SESSION_ACTION_RESULT).at(-1).payload)
        .toEqual({
          action: 'new',
          ok: false,
          message: 'current promotion failed'
        });
    });

    it('updates an explicitly identified live named session without title matching', async () => {
      persistence.saveNamed.mockResolvedValueOnce({
        sessionId: 'saved-1',
        title: 'Living room',
        createdAt: '2026-07-23T14:00:00.000Z',
        updatedAt: '2026-07-23T14:00:00.000Z',
        savedAt: '2026-07-23T14:00:00.000Z',
        startedAt: '2026-07-23T14:00:00.000Z',
        timezone: 'America/Chicago',
        hostPersonaId: 'jill',
        participantPersonaIds: ['jill'],
        turnCount: 4,
        excerptWordCount: 1751,
        fileName: '20260723-090000-living-room.json'
      });
      await router.route(message(
        MessageType.WORKSHOP_SAVE_SESSION,
        { title: 'Living room', sessionId: 'saved-1' }
      ) as any);

      expect(persistence.saveNamed).toHaveBeenCalledWith('Living room', 'saved-1');
      expect(posted(MessageType.WORKSHOP_SESSION_ACTION_RESULT).at(-1).payload)
        .toEqual({
          action: 'save',
          ok: true,
          message: 'Updated “Living room”.'
        });
    });

    it('settles a failed browser request with a typed error response', async () => {
      persistence.list.mockRejectedValueOnce(new Error('session directory is unreadable'));

      await router.route(message(
        MessageType.WORKSHOP_LIST_SESSIONS,
        { requestId: 'list-failed' }
      ) as any);

      expect(posted(MessageType.WORKSHOP_SESSIONS_DATA).at(-1)).toMatchObject({
        payload: {
          requestId: 'list-failed',
          available: true,
          error: 'session directory is unreadable',
          sessions: []
        }
      });
      expect(posted(MessageType.ERROR).at(-1).payload).toMatchObject({
        message: 'Could not list Workshop sessions.',
        details: 'session directory is unreadable'
      });
      expect(log.appendLine).toHaveBeenCalledWith(
        '[WorkshopSessionMessageHandler] ERROR [workshop]: Could not list Workshop sessions. - session directory is unreadable'
      );
    });
  });

  it('disposes all retained participants on reset and returns to Jill', async () => {
    await pin();
    await runProse();
    session.addContextAttachment({
      kind: 'text', origin: 'writer', label: 'Story bible\u2026', words: 3, content: 'Mara keeps watch.'
    });
    for (const key of ['host-conv', 'tool-conv']) {
      storeContext(key, 10);
    }
    await router.route(message(MessageType.WORKSHOP_RESET_SESSION, {}) as any);

    expect(service.discardConversation).toHaveBeenCalledWith('tool-conv');
    expect(service.discardConversation).toHaveBeenCalledWith('host-conv');
    expect(contextBudgets.get('tool-conv')).toBeUndefined();
    expect(contextBudgets.get('host-conv')).toBeUndefined();
    expect(session.getSnapshot().participants.host.personaId).toBe('jill');
    expect(session.getSnapshot().turns).toEqual([]);
    expect(session.getSnapshot().contextAttachments).toEqual([
      expect.objectContaining({ id: 'ctx-1', label: 'Story bible\u2026', words: 3 })
    ]);
    expect(session.getSnapshot().pendingHostUpdate).toBeUndefined();
    // Sprint 13A §3: the working set survives the boundary, but the path does
    // not — the new room opens on the chooser and offers to continue.
    expect(session.getSnapshot().scope).toBeNull();
    expect(session.getSnapshot().excerpt).toBeDefined();

    await router.route(message(
      MessageType.WORKSHOP_SET_SESSION_SCOPE,
      { scope: 'excerpt' }
    ) as any);
    await router.route(message(
      MessageType.WORKSHOP_SEND_MESSAGE,
      { text: 'Begin the fresh room.' }
    ) as any);

    const freshHostInput = service.startWorkshopPersonaConversation.mock.calls.at(-1)![0];
    expect(freshHostInput.contextAttachmentsFrame).toContain('Mara keeps watch.');
  });

  describe('In-context manifest projection (Phase 7)', () => {
    it('projects writer rows and fetched rows for the active target without leaking conversation ids', async () => {
      await pin();
      await router.route(message(
        MessageType.WORKSHOP_ADD_CONTEXT_TEXT,
        { text: 'Mara cannot read.' }
      ) as any);
      contextSources.set('host-conv', [{
        kind: 'resource',
        origin: 'host',
        label: 'Characters/raven.md',
        configuredResource: { group: 'characters', path: 'Characters/raven.md' },
        sizeChars: 46,
        promptTokensDelta: 120,
        isEstimate: false,
        deliveredAt: 5
      }]);

      await router.route(message(
        MessageType.WORKSHOP_SEND_MESSAGE,
        { text: 'What does Raven want?' }
      ) as any);

      const state = posted(MessageType.WORKSHOP_SESSION_STATE).at(-1).payload;
      const sources = state.session.contextBudget?.sources ?? [];
      expect(sources).toEqual([
        expect.objectContaining({ kind: 'pin', origin: 'writer', excerptVersion: 1 }),
        expect.objectContaining({ kind: 'attachment', origin: 'writer', label: expect.stringContaining('Mara') }),
        expect.objectContaining({
          kind: 'resource',
          origin: 'host',
          label: 'Characters/raven.md',
          promptTokensDelta: 120,
          isEstimate: false
        })
      ]);
      // The webview contract never carries conversation ids or absolute paths.
      const wire = JSON.stringify(state);
      expect(wire).not.toContain('host-conv');
      expect(wire).not.toContain('/ws/');
    });

    it('drops a replaced tool sidecar\u2019s manifest with its conversation', async () => {
      await pin();
      await runProse();
      contextSources.set('tool-conv', [{
        kind: 'resource', origin: 'tool', label: 'chapters/ch-04.md',
        sizeChars: 100, isEstimate: true, deliveredAt: 4
      }]);
      await router.route(message(
        MessageType.WORKSHOP_SET_CHAT_TARGET,
        { kind: 'tool', toolId: 'prose' }
      ) as any);
      const withTool = posted(MessageType.WORKSHOP_SESSION_STATE).at(-1).payload.session.contextBudget;
      expect(withTool?.sources).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'resource', origin: 'tool', label: 'chapters/ch-04.md' })
      ]));

      // Replacement: a new run discards the old conversation and its manifest.
      service.analyzeProse.mockResolvedValue(analysisResult('second report', { conversationId: 'tool-conv-2' }));
      await runProse();
      await router.route(message(
        MessageType.WORKSHOP_SET_CHAT_TARGET,
        { kind: 'tool', toolId: 'prose' }
      ) as any);
      const replaced = posted(MessageType.WORKSHOP_SESSION_STATE).at(-1).payload.session.contextBudget;
      expect(JSON.stringify(replaced?.sources ?? [])).not.toContain('ch-04.md');
    });
  });
});
