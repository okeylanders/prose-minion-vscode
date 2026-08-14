import {
  MessageType
} from '@messages';
import {
  analysisResult,
  message,
  createWorkshopRouteTestHarness
} from './WorkshopRouteTestHarness';
import type { WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';
import {
  generatedDraft
} from '@/__tests__/presentation/webview/components/workshop/widgets/creativeVariations/creativeVariationsFixtures';
import {
  parseWorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';

describe('WorkshopRoomHandler routing — cross-owner seams', () => {
  let session: WorkshopRouteTestHarness['session'];
  let log: WorkshopRouteTestHarness['log'];
  let service: WorkshopRouteTestHarness['service'];
  let contextAssistant: WorkshopRouteTestHarness['contextAssistant'];
  let router: WorkshopRouteTestHarness['router'];
  let persistence: WorkshopRouteTestHarness['persistence'];
  let posted: WorkshopRouteTestHarness['posted'];
  let pin: WorkshopRouteTestHarness['pin'];
  let runProse: WorkshopRouteTestHarness['runProse'];
  let creativeVariationsGenerate: WorkshopRouteTestHarness['creativeVariationsGenerate'];

  beforeEach(() => {
    ({
      session,
      log,
      service,
      contextAssistant,
      router,
      persistence,
      posted,
      pin,
      runProse,
      creativeVariationsGenerate
    } = createWorkshopRouteTestHarness());
  });

  it('registers one composer route and one target route without enter/exit variants', () => {
    expect(router.hasHandler(MessageType.WORKSHOP_SET_CHAT_TARGET)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_SEND_MESSAGE)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_ADD_CONTEXT_TEXT)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_ADD_CONTEXT_FILE)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_REMOVE_CONTEXT_ATTACHMENT)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_TODO_ACTION)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_REREAD_EXCERPT)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_REQUEST_CONTEXT_CATALOG)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_SEARCH_CONTEXT_RESOURCES)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_ADD_CONTEXT_RESOURCES)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_SET_EXCERPT_RESOURCE)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_RUN_CONTEXT_WIZARD)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_ATTACH_MESSAGE_RESOURCES)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_ATTACH_MESSAGE_FILE)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_REMOVE_MESSAGE_ATTACHMENT)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_SET_CONVERSATION_SETTINGS)).toBe(true);
    // Conversation Widgets (ADR 2026-07-22): generate + cancel are free
    // preview routes; commit is mutation-gated.
    expect(router.hasHandler(MessageType.WORKSHOP_GESTURE_PLAYGROUND_GENERATE)).toBe(true);
    expect(router.hasHandler(MessageType.CANCEL_GESTURE_PLAYGROUND_GENERATE_REQUEST)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_REQUEST_WIDGET_CONFIG)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_COMMIT_WIDGET)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATE)).toBe(true);
    expect(router.hasHandler(MessageType.CANCEL_CREATIVE_VARIATIONS_GENERATE_REQUEST)).toBe(true);
    expect(router.handlerCount).toBe(50);
  });

  it('refuses a live non-one-shot wire id through the real closed generation adapter', async () => {
    await expect(router.route(message(MessageType.WORKSHOP_COMMIT_WIDGET, {
      widgetId: 'lexical-gravity',
      requestToken: 'commit-wrong-rail',
      draft: {}
    }) as any)).resolves.toBeUndefined();

    expect(posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT).at(-1)).toMatchObject({
      payload: {
        action: 'commit',
        requestToken: 'commit-wrong-rail',
        widgetId: 'lexical-gravity',
        ok: false,
        message: 'That widget does not support one-shot commits.'
      }
    });
    expect(session.getWidgetConfig('wc-1')).toBeUndefined();
  });

  it('keeps a failed widget send as a complete retryable user turn plus artifact', async () => {
    session.setSessionScope('open');
    service.startWorkshopPersonaConversation.mockRejectedValueOnce(
      new Error('provider unavailable')
    );
    const widgetMenu = Array.from({ length: 4 }, (_, index) => ({
      heading: `Route ${index + 1}`,
      options: [`Option ${index + 1}.1`, `Option ${index + 1}.2`, `Option ${index + 1}.3`]
    }));

    await router.route(message(MessageType.WORKSHOP_COMMIT_WIDGET, {
      widgetId: 'gesture-playground',
      requestToken: 'commit-retry',
      draft: {
        targetPhrase: 'she smiled',
        writerInstructions: '',
        contextText: '',
        characterNotes: '',
        sourceReferences: [],
        dictionaryMarkdown: '# Gesture Dictionary\n\nA quiet refusal.',
        menu: widgetMenu,
        selections: ['Option 1.1'],
        note: '',
        includeDictionaryInCommit: false
      }
    }) as any);

    const state = session.exportCommittedState();
    const writerTurn = state.turns.find((turn) => turn.widgetCommit);
    expect(writerTurn).toEqual(expect.objectContaining({
      participant: 'writer',
      widgetCommit: expect.objectContaining({
        widgetConfigId: 'wc-1',
        artifactId: 'ta-1'
      })
    }));
    expect(state.threadArtifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'ta-1',
        turnId: writerTurn?.id,
        content: expect.stringContaining('Option 1.1')
      })
    ]));
    expect(session.getWidgetConfig('wc-1')).toBeDefined();
    expect(posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT).at(-1)).toMatchObject({
      source: 'extension.workshop.widget',
      payload: {
        action: 'commit',
        requestToken: 'commit-retry',
        widgetId: 'gesture-playground',
        ok: true,
        widgetConfigId: 'wc-1',
        turnId: writerTurn?.id
      }
    });
  });

  it('commits and clone-recommits Creative through fresh linked records without regeneration', async () => {
    session.setSessionScope('open');
    const exactDraft = {
      ...JSON.parse(JSON.stringify(generatedDraft)),
      intent: { ...generatedDraft.intent, aim: '' },
      selections: [{
        position: 1,
        carryMode: 'direction' as const,
        acceptedAdvisoryRiskIds: []
      }],
      note: 'Ask whether the quieter direction earns its silence.'
    };

    await router.route(message(MessageType.WORKSHOP_COMMIT_WIDGET, {
      widgetId: 'creative-variations',
      requestToken: 'creative-original',
      draft: exactDraft
    }) as any);

    const original = session.getWidgetConfig('wc-1');
    const originalState = JSON.parse(JSON.stringify(original));
    const originalTurn = session.exportCommittedState().turns.find(
      (turn) => turn.widgetCommit?.widgetConfigId === 'wc-1'
    );
    expect(original).toMatchObject({
      widgetId: 'creative-variations',
      draft: expect.objectContaining({
        intent: expect.objectContaining({ aim: '' }),
        workup: generatedDraft.workup,
        selections: exactDraft.selections
      }),
      artifactId: 'ta-1',
      committedTurnId: originalTurn?.id
    });
    expect(originalTurn?.widgetCommit).toMatchObject({
      widgetId: 'creative-variations',
      widgetConfigId: 'wc-1',
      artifactId: 'ta-1',
      selectionCount: 1
    });
    expect(originalTurn?.content).toContain(
      'for “He set the mug down where her hand could reach it without asking. She smiled.”'
    );

    await router.route(message(MessageType.WORKSHOP_COMMIT_WIDGET, {
      widgetId: 'creative-variations',
      requestToken: 'creative-clone',
      draft: exactDraft,
      clonedFromConfigId: 'wc-1'
    }) as any);

    const committed = session.exportCommittedState();
    const cloned = session.getWidgetConfig('wc-2');
    const cloneTurn = committed.turns.find(
      (turn) => turn.widgetCommit?.widgetConfigId === 'wc-2'
    );
    expect(cloned).toMatchObject({
      widgetId: 'creative-variations',
      clonedFromConfigId: 'wc-1',
      artifactId: 'ta-2',
      committedTurnId: cloneTurn?.id
    });
    expect(cloneTurn?.id).not.toBe(originalTurn?.id);
    expect(session.getWidgetConfig('wc-1')).toEqual(originalState);
    expect(committed.threadArtifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'ta-1',
        turnId: originalTurn?.id,
        kind: 'widget:creative-variations'
      }),
      expect.objectContaining({
        id: 'ta-2',
        turnId: cloneTurn?.id,
        kind: 'widget:creative-variations'
      })
    ]));
    expect(creativeVariationsGenerate).not.toHaveBeenCalled();
    expect(posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT).slice(-2))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({
            requestToken: 'creative-original',
            widgetId: 'creative-variations',
            ok: true,
            widgetConfigId: 'wc-1'
          })
        }),
        expect.objectContaining({
          payload: expect.objectContaining({
            requestToken: 'creative-clone',
            widgetId: 'creative-variations',
            ok: true,
            widgetConfigId: 'wc-2'
          })
        })
      ]));
  });

  it('rejects unknown Creative clone provenance before mutation and exports valid state', async () => {
    session.setSessionScope('open');
    const exactDraft = {
      ...JSON.parse(JSON.stringify(generatedDraft)),
      selections: [{
        position: 1,
        carryMode: 'direction' as const,
        acceptedAdvisoryRiskIds: []
      }]
    };

    await router.route(message(MessageType.WORKSHOP_COMMIT_WIDGET, {
      widgetId: 'creative-variations',
      requestToken: 'creative-invalid-clone',
      draft: exactDraft,
      clonedFromConfigId: 'wc-999'
    }) as any);

    expect(session.getWidgetConfig('wc-1')).toBeUndefined();
    expect(posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT).at(-1)).toMatchObject({
      payload: {
        action: 'commit',
        requestToken: 'creative-invalid-clone',
        widgetId: 'creative-variations',
        ok: false,
        message: expect.stringMatching(/source widget configuration is no longer available/i)
      }
    });
    expect(() => parseWorkshopSessionStateV1(session.exportCommittedState())).not.toThrow();
  });

  it('guards routed room mutations while a shared session operation is pending', async () => {
    persistence.isSessionOperationPending.mockReturnValue(true);

    await router.route(message(MessageType.WORKSHOP_SET_EXCERPT, {
      text: 'Must not race an open.',
      source: { kind: 'manual' }
    }) as any);

    expect(session.getExcerpt()).toBeUndefined();
    expect(posted(MessageType.ERROR).at(-1).payload.message)
      .toMatch(/session save or replacement/i);
    expect(log.appendLine).toHaveBeenCalledWith(
      '[WorkshopExcerptScopeHandler] ERROR [workshop]: ' +
      'Wait for the current session save or replacement to finish before changing the room.'
    );
  });

  it('returns a widget-owned rejection when commit meets the session-operation gate', async () => {
    persistence.isSessionOperationPending.mockReturnValue(true);

    await router.route(message(MessageType.WORKSHOP_COMMIT_WIDGET, {
      widgetId: 'gesture-playground',
      requestToken: 'commit-blocked',
      draft: {
        targetPhrase: 'she smiled',
        writerInstructions: '',
        contextText: '',
        characterNotes: '',
        sourceReferences: [],
        dictionaryMarkdown: '# Gesture Dictionary\n\nA quiet refusal.',
        menu: Array.from({ length: 4 }, (_, index) => ({
          heading: `Route ${index + 1}`,
          options: [`Option ${index + 1}.1`, `Option ${index + 1}.2`, `Option ${index + 1}.3`]
        })),
        selections: ['Option 1.1'],
        note: '',
        includeDictionaryInCommit: false
      }
    }) as any);

    expect(session.getWidgetConfig('wc-1')).toBeUndefined();
    expect(posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT).at(-1)).toMatchObject({
      source: 'extension.workshop.widget',
      payload: {
        action: 'commit',
        requestToken: 'commit-blocked',
        widgetId: 'gesture-playground',
        ok: false,
        message: expect.stringMatching(/session save or replacement/i)
      }
    });
  });

  it('does not duplicate a brief when the first host attempt fails and is retried', async () => {
    await pin();
    let rejectFirst!: (error: Error) => void;
    service.startWorkshopPersonaConversation.mockImplementationOnce(
      async () => new Promise((_resolve, reject) => {
        rejectFirst = reject;
      })
    );

    const firstAttempt = router.route(message(
      MessageType.WORKSHOP_SEND_MESSAGE,
      { text: 'Start host.' }
    ) as any);
    await Promise.resolve();
    await router.route(message(
      MessageType.WORKSHOP_ADD_CONTEXT_TEXT,
      { text: 'Mara is hiding her identity.' }
    ) as any);
    rejectFirst(new Error('temporary failure'));
    await firstAttempt;

    await router.route(message(
      MessageType.WORKSHOP_SEND_MESSAGE,
      { text: 'Retry host.' }
    ) as any);

    const retryInput = service.startWorkshopPersonaConversation.mock.calls.at(-1)![0];
    expect(retryInput.contextAttachmentsFrame).toContain('Mara is hiding her identity.');
    expect(retryInput.message).toContain('<workshop-room-catch-up>');
    expect(retryInput.message).toContain('Retry host.');
    expect(retryInput.message).not.toContain('<workshop-host-update>');
    expect(session.getSnapshot().pendingHostUpdate).toBeUndefined();
  });

  it('delivers collapsed excerpt and context updates once after a successful host turn', async () => {
    await pin();
    await router.route(message(
      MessageType.WORKSHOP_SEND_MESSAGE,
      { text: 'Read the first version.' }
    ) as any);
    service.continueConversation.mockClear();

    await router.route(message(
      MessageType.WORKSHOP_ADD_CONTEXT_TEXT,
      { text: 'The story is a winter mystery.' }
    ) as any);
    await router.route(message(
      MessageType.WORKSHOP_SET_EXCERPT,
      {
        text: 'Second version.',
        source: { kind: 'file', sourceUri: 'file:///chapter-two.md', relativePath: 'chapter-two.md' }
      }
    ) as any);
    await router.route(message(
      MessageType.WORKSHOP_SET_EXCERPT,
      {
        text: 'Newest version.',
        source: { kind: 'file', sourceUri: 'file:///chapter-three.md', relativePath: 'chapter-three.md' }
      }
    ) as any);

    expect(session.getHostConversationId()).toBe('host-conv');
    expect(service.continueConversation).not.toHaveBeenCalled();
    expect(session.getSnapshot().pendingHostUpdate).toEqual({
      excerptVersion: 3,
      context: true
    });
    expect(posted(MessageType.WORKSHOP_TURN).at(-1).payload.turn).toMatchObject({
      artifact: 'excerpt_revision',
      excerptVersion: 3
    });

    service.continueConversation.mockRejectedValueOnce(new Error('temporary failure'));
    await router.route(message(
      MessageType.WORKSHOP_SEND_MESSAGE,
      { text: 'Compare this revision.' }
    ) as any);
    expect(session.getSnapshot().pendingHostUpdate).toBeDefined();

    await router.route(message(
      MessageType.WORKSHOP_SEND_MESSAGE,
      { text: 'Try the comparison again.' }
    ) as any);
    const delivered = service.continueConversation.mock.calls.at(-1)![1];
    const deliveryOptions = service.continueConversation.mock.calls.at(-1)![2];
    expect(delivered).toContain('<pinned-excerpt version="3">');
    expect(delivered).toContain('Newest version.');
    expect(delivered).not.toContain('Second version.');
    expect(delivered).toContain('The story is a winter mystery.');
    expect(deliveryOptions?.capability).toEqual(expect.objectContaining({
      catalog: 'workshopPersona'
    }));
    expect(session.getSnapshot().pendingHostUpdate).toBeUndefined();
    expect(log.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('Pending host update prepared')
    );
    expect(log.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('Pending host update committed')
    );

    await router.route(message(
      MessageType.WORKSHOP_SEND_MESSAGE,
      { text: 'One more thought.' }
    ) as any);
    expect(service.continueConversation.mock.calls.at(-1)![1]).toContain('One more thought.');
  });

  it('keeps a revision pending when its host delivery is cancelled', async () => {
    await pin();
    await router.route(message(
      MessageType.WORKSHOP_SEND_MESSAGE,
      { text: 'Read the first version.' }
    ) as any);
    await router.route(message(
      MessageType.WORKSHOP_SET_EXCERPT,
      { text: 'A revision awaiting delivery.' }
    ) as any);
    service.continueConversation.mockImplementationOnce(
      async (_conversationId, _text, options) => new Promise((resolve) => {
        options?.signal?.addEventListener('abort', () => resolve(
          analysisResult('partial host response', { conversationId: 'host-conv' }) as any
        ));
      }) as any
    );

    const delivery = router.route(message(
      MessageType.WORKSHOP_SEND_MESSAGE,
      { text: 'Compare it.' }
    ) as any);
    await Promise.resolve();
    const requestId = session.getSnapshot().activeRequestId!;
    await router.route(message(
      MessageType.CANCEL_WORKSHOP_REQUEST,
      { requestId, domain: 'workshop' }
    ) as any);
    await delivery;

    expect(session.getSnapshot().pendingHostUpdate).toEqual({
      excerptVersion: 2,
      context: false
    });
    expect(session.getSnapshot().turns.some(
      (turn) => turn.content === 'partial host response'
    )).toBe(false);
  });

  describe('session persistence routes', () => {
    const invokeStateReplacingActions = async () => {
      await router.route(message(
        MessageType.WORKSHOP_SAVE_SESSION,
        { title: 'Saved Room' }
      ) as any);
      await router.route(message(
        MessageType.WORKSHOP_OPEN_SESSION,
        { sessionId: 'saved-1' }
      ) as any);
      await router.route(message(
        MessageType.WORKSHOP_RESET_SESSION,
        {}
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
        MessageType.WORKSHOP_DELETE_SESSION,
        { sessionId: 'saved-1' }
      ) as any);
    };

    it.each(['persona response', 'Context wizard'] as const)(
      'blocks state replacement during an active %s but permits list and reveal',
      async (activeKind) => {
        await pin();
        let settle!: () => void;
        let active: Promise<void>;
        if (activeKind === 'persona response') {
          service.startWorkshopPersonaConversation.mockImplementationOnce(
            async () => new Promise((resolve) => {
              settle = () => resolve(
                analysisResult('Finished.', { conversationId: 'host-conv' }) as any
              );
            })
          );
          active = router.route(message(
            MessageType.WORKSHOP_SEND_MESSAGE,
            { text: 'Keep thinking.' }
          ) as any);
        } else {
          contextAssistant.generateContext.mockImplementationOnce(
            async () => new Promise((resolve) => {
              settle = () => resolve({
                toolName: 'context_assistant',
                content: 'Wizard finished.',
                timestamp: new Date(0),
                requestedResources: []
              });
            })
          );
          active = router.route(message(
            MessageType.WORKSHOP_RUN_CONTEXT_WIZARD,
            {}
          ) as any);
        }
        await Promise.resolve();

        await invokeStateReplacingActions();
        await router.route(message(
          MessageType.WORKSHOP_LIST_SESSIONS,
          { requestId: 'allowed-list' }
        ) as any);
        await router.route(message(
          MessageType.WORKSHOP_REVEAL_SESSION,
          { sessionId: 'saved-1' }
        ) as any);

        expect(persistence.saveNamed).not.toHaveBeenCalled();
        expect(persistence.openNamed).not.toHaveBeenCalled();
        expect(persistence.resetSession).not.toHaveBeenCalled();
        expect(persistence.renameNamed).not.toHaveBeenCalled();
        expect(persistence.duplicateNamed).not.toHaveBeenCalled();
        expect(persistence.deleteNamed).not.toHaveBeenCalled();
        expect(persistence.list).toHaveBeenCalledWith(undefined, expect.any(AbortSignal));
        expect(persistence.resolveRevealPath).toHaveBeenCalledWith('saved-1');
        expect(posted(MessageType.WORKSHOP_SESSION_ACTION_RESULT).slice(0, 6).map(
          (entry) => entry.payload
        )).toEqual([
          expect.objectContaining({ action: 'save', ok: false }),
          expect.objectContaining({ action: 'open', ok: false }),
          expect.objectContaining({ action: 'new', ok: false }),
          expect.objectContaining({ action: 'rename', ok: false }),
          expect.objectContaining({ action: 'duplicate', ok: false }),
          expect.objectContaining({ action: 'delete', ok: false })
        ]);
        expect(posted(MessageType.WORKSHOP_SESSIONS_DATA).at(-1).payload.requestId)
          .toBe('allowed-list');
        expect(posted(MessageType.WORKSHOP_SESSION_ACTION_RESULT).at(-1).payload)
          .toMatchObject({ action: 'reveal', ok: true });

        settle();
        await active;
      }
    );
  });

  describe('Context wizard (Sprint 12 Phase 5)', () => {
    const runWizard = () =>
      router.route(message(MessageType.WORKSHOP_RUN_CONTEXT_WIZARD, {}) as any);

    it('uses one run-state precedence for excerpt and session-operation refusals', async () => {
      await pin();
      let finishRoom!: () => void;
      let finishWizard!: () => void;
      service.startWorkshopPersonaConversation.mockImplementationOnce(
        () => new Promise((resolve) => {
          finishRoom = () => resolve(
            analysisResult('Room reply.', { conversationId: 'host-conv' }) as any
          );
        })
      );
      contextAssistant.generateContext.mockImplementationOnce(
        () => new Promise((resolve) => {
          finishWizard = () => resolve({
            toolName: 'context_assistant',
            content: '',
            timestamp: new Date(0),
            requestedResources: []
          });
        })
      );

      const roomRun = router.route(message(
        MessageType.WORKSHOP_SEND_MESSAGE,
        { text: 'Keep thinking.' }
      ) as any);
      await Promise.resolve();
      const wizardRun = runWizard();
      await Promise.resolve();
      expect(service.startWorkshopPersonaConversation).toHaveBeenCalledTimes(1);
      expect(contextAssistant.generateContext).toHaveBeenCalledTimes(1);

      await router.route(message(MessageType.WORKSHOP_SET_EXCERPT, {
        text: 'A replacement that must wait.',
        source: { kind: 'manual' }
      }) as any);
      expect(posted(MessageType.ERROR).at(-1).payload.message).toBe(
        'A tool is still running. Wait for it to finish (or start a new session) before replacing the excerpt.'
      );

      await router.route(message(MessageType.WORKSHOP_RENAME_SESSION, {
        sessionId: 'saved-1',
        title: 'Must Wait'
      }) as any);
      expect(posted(MessageType.WORKSHOP_SESSION_ACTION_RESULT).at(-1).payload).toEqual({
        action: 'rename',
        ok: false,
        message: 'Wait for the current response to finish before you rename a saved session.'
      });

      finishRoom();
      finishWizard();
      await Promise.all([roomRun, wizardRun]);
    });

    it('routes a wizard-time excerpt refusal through the excerpt owner', async () => {
      await pin();
      let reject!: (reason: unknown) => void;
      contextAssistant.generateContext.mockReturnValueOnce(
        new Promise((_resolve, rejectRun) => { reject = rejectRun; })
      );

      const run = runWizard();
      await Promise.resolve();
      await router.route(message(MessageType.WORKSHOP_SET_EXCERPT, {
        text: 'A replacement that must wait.',
        source: { kind: 'selection' }
      }) as any);

      const refusal = 'The Context wizard is still running. Wait for it to finish or cancel it before replacing the excerpt.';
      expect(posted(MessageType.ERROR).at(-1).payload.message).toBe(refusal);
      expect(log.appendLine).toHaveBeenCalledWith(
        `[WorkshopExcerptScopeHandler] ERROR [workshop]: ${refusal}`
      );
      expect(session.getSnapshot().excerpt?.text).toBe('A pinned excerpt.');

      const requestId = posted(MessageType.STREAM_STARTED).at(-1).payload.requestId;
      await router.route(message(MessageType.CANCEL_WORKSHOP_REQUEST, {
        requestId,
        domain: 'workshop-context'
      }) as any);
      reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
      await run;
    });

    it('keeps a cancelled wizard in its slot until that run settles', async () => {
      await pin();
      let reject!: (reason: unknown) => void;
      contextAssistant.generateContext.mockReturnValueOnce(
        new Promise((_resolve, rejectRun) => { reject = rejectRun; })
      );

      const run = runWizard();
      await Promise.resolve();
      const requestId = posted(MessageType.STREAM_STARTED).at(-1).payload.requestId;
      await router.route(message(MessageType.CANCEL_WORKSHOP_REQUEST, {
        requestId,
        domain: 'workshop-context'
      }) as any);

      await runWizard();
      expect(contextAssistant.generateContext).toHaveBeenCalledTimes(1);
      expect(posted(MessageType.ERROR).at(-1).payload.message).toMatch(/already running/i);

      reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
      await run;

      expect(session.getContextAttachments()).toEqual([]);
      expect(posted(MessageType.STREAM_COMPLETE).at(-1).payload).toMatchObject({
        requestId,
        domain: 'workshop-context',
        cancelled: true
      });

      await runWizard();
      expect(contextAssistant.generateContext).toHaveBeenCalledTimes(2);
    });

    it('logs a stale Context-wizard cancellation request', async () => {
      await pin();
      let finish!: () => void;
      contextAssistant.generateContext.mockImplementationOnce(
        () => new Promise((resolve) => {
          finish = () => resolve({
            toolName: 'context_assistant',
            content: '',
            timestamp: new Date(0),
            requestedResources: []
          });
        })
      );

      const run = runWizard();
      await Promise.resolve();
      await router.route(message(MessageType.CANCEL_WORKSHOP_REQUEST, {
        requestId: 'stale-wizard-request',
        domain: 'workshop-context'
      }) as any);

      expect(log.appendLine).toHaveBeenCalledWith(
        '[WorkshopRoomHandler] Cancel ignored: stale-wizard-request (domain=workshop-context)'
      );
      finish();
      await run;
    });

    it('rejects a session reset while the Context wizard is active', async () => {
      await pin();
      let reject!: (reason: unknown) => void;
      let signal!: AbortSignal;
      contextAssistant.generateContext.mockImplementationOnce((_input: unknown, options: { signal: AbortSignal; }) => {
        signal = options.signal;
        return new Promise((_resolve, rejectRun) => { reject = rejectRun; });
      });

      const run = runWizard();
      await Promise.resolve();
      await router.route(message(MessageType.WORKSHOP_RESET_SESSION, {}) as any);
      expect(signal.aborted).toBe(false);
      expect(persistence.resetSession).not.toHaveBeenCalled();
      reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
      await run;
    });
  });

  it('refuses a message until the writer chooses a path for the new room', async () => {
    await pin();
    await router.route(message(MessageType.WORKSHOP_RESET_SESSION, {}) as any);
    service.startWorkshopPersonaConversation.mockClear();

    await router.route(message(
      MessageType.WORKSHOP_SEND_MESSAGE,
      { text: 'Straight into it.' }
    ) as any);

    expect(service.startWorkshopPersonaConversation).not.toHaveBeenCalled();
    expect(posted(MessageType.ERROR).at(-1)?.payload.message)
      .toContain('Choose how to start this session');
  });

  describe('message attachments — one-shot thread-artifacts (Phase 6B)', () => {
    const attachRaven = () => router.route(message(
      MessageType.WORKSHOP_ATTACH_MESSAGE_RESOURCES,
      { items: [{ group: 'characters', path: 'Characters/raven.md' }] }
    ) as any);

    it('ships staged artifacts inside one send, stamps the turn, and clears pending on success', async () => {
      await pin();
      await attachRaven();

      await router.route(message(
        MessageType.WORKSHOP_SEND_MESSAGE,
        { text: 'Does Raven read as seventeen here?' }
      ) as any);

      const [input] = service.startWorkshopPersonaConversation.mock.calls[0];
      expect(input.message).toContain('<thread-artifact id="ta-1">');
      expect(input.message).toContain('Name: raven.md');
      expect(input.message).toContain('Raven is seventeen and keeps the marked token.');
      expect(input.message.indexOf('</thread-artifact>'))
        .toBeLessThan(input.message.indexOf('WRITER MESSAGE:'));

      const userTurn = posted(MessageType.WORKSHOP_TURN)
        .map((entry) => entry.payload.turn)
        .find((turn) => turn.artifact === 'persona_message' && turn.role === 'user');
      expect(userTurn?.messageAttachments).toEqual([
        expect.objectContaining({ id: 'ta-1', label: 'raven.md' })
      ]);
      expect(session.getRoomThreadArtifactsForTurn(userTurn!.id)).toEqual([
        expect.objectContaining({
          id: 'ta-1',
          name: 'raven.md',
          content: 'Raven is seventeen and keeps the marked token.'
        })
      ]);
      expect(session.getSnapshot().pendingMessageAttachments).toHaveLength(0);
    });

    it('retains staged artifacts when the send fails, so a retry ships the same ids', async () => {
      await pin();
      await attachRaven();
      service.startWorkshopPersonaConversation.mockRejectedValueOnce(new Error('transport down'));

      await router.route(message(
        MessageType.WORKSHOP_SEND_MESSAGE,
        { text: 'First try.' }
      ) as any);

      expect(session.getSnapshot().pendingMessageAttachments).toEqual([
        expect.objectContaining({ id: 'ta-1' })
      ]);

      await router.route(message(
        MessageType.WORKSHOP_SEND_MESSAGE,
        { text: 'Second try.' }
      ) as any);

      const [retryInput] = service.startWorkshopPersonaConversation.mock.calls[1];
      expect(retryInput.message).toContain('<thread-artifact id="ta-1">');
      expect(session.getSnapshot().pendingMessageAttachments).toEqual([]);
    });

    it('never lets a deterministic quick action consume staged message attachments', async () => {
      await pin();
      await runProse();
      await attachRaven();
      const reportTurnId = session.getSnapshot().participants.toolSidecars[0].latestReportTurnId;
      service.continueConversation.mockClear();

      await router.route(message(MessageType.WORKSHOP_QUICK_ACTION, {
        toolId: 'prose',
        reportTurnId,
        label: 'Rewrite for flow'
      }) as any);

      const [, quickActionMessage] = service.continueConversation.mock.calls[0];
      expect(quickActionMessage).not.toContain('<thread-artifact');
      expect(session.getSnapshot().pendingMessageAttachments).toHaveLength(1);
    });
  });
});
