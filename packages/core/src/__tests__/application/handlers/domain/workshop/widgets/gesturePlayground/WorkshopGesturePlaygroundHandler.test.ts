/**
 * The Gesture Playground IPC slice (ADR 2026-07-22, Sprint 01): generate is a free
 * preview call with token correlation and cancel; commit is one atomic
 * route — config before send (the durable retry token), linkage and the
 * writer-origin manifest only when the reply lands, and the writer's staged
 * composer pills never consumed.
 */

import { WorkshopGesturePlaygroundHandler } from '@handlers/domain/workshop/widgets/gesturePlayground/WorkshopGesturePlaygroundHandler';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  MessageType,
  WorkshopCommitWidgetMessage,
  WorkshopGesturePlaygroundDraft,
  WorkshopGesturePlaygroundGenerateMessage
} from '@messages';

const oversizedContextAttachmentId = `ctx-${'9'.repeat(500)}`;

const menu = [
  {
    heading: 'Delay the answer',
    options: ['the smile arrived late', 'her mouth considered it', 'the answer waited']
  },
  {
    heading: 'Move it into the hands',
    options: ['she turned the mug once', 'her thumb found the seam', 'the spoon went still']
  },
  {
    heading: 'Let the observer read it',
    options: ['he knew that careful quiet', 'he mistook it for ease', 'the delay told him enough']
  },
  {
    heading: 'Use the room',
    options: ['the kettle clicked between them', 'silence took the chair', 'the doorway stayed open']
  }
];

const draft = (overrides: Partial<WorkshopGesturePlaygroundDraft> = {}): WorkshopGesturePlaygroundDraft => ({
  targetPhrase: 'she smiled',
  writerInstructions: 'Keep it private.',
  contextText: '',
  characterNotes: '',
  sourceReferences: [],
  dictionaryMarkdown: '# Gesture Dictionary\n\nA private deflection.',
  menu,
  selections: ['the smile arrived late'],
  note: '',
  includeDictionaryInCommit: false,
  ...overrides
});

const generateMessage = (
  overrides: Partial<WorkshopGesturePlaygroundGenerateMessage['payload']> = {}
): WorkshopGesturePlaygroundGenerateMessage => ({
  type: MessageType.WORKSHOP_GESTURE_PLAYGROUND_GENERATE,
  source: 'webview.workshop',
  timestamp: 1,
  payload: {
    widgetId: 'gesture-playground',
    token: 'tok-1',
    mode: 'full',
    targetPhrase: 'she smiled',
    writerInstructions: 'Keep it private.',
    contextText: '',
    characterNotes: '',
    sourceReferences: [],
    ...overrides
  } as WorkshopGesturePlaygroundGenerateMessage['payload']
});

const commitMessage = (
  overrides: Partial<WorkshopCommitWidgetMessage['payload']> = {}
): WorkshopCommitWidgetMessage => ({
  type: MessageType.WORKSHOP_COMMIT_WIDGET,
  source: 'webview.workshop',
  timestamp: 1,
  payload: {
    widgetId: 'gesture-playground',
    requestToken: 'commit-1',
    draft: draft(),
    ...overrides
  }
});

const build = (options: {
  sendOutcome?: { committed: boolean; userTurnId?: string };
  sendError?: Error;
  generateMenu?: jest.Mock;
  generateMore?: jest.Mock;
  roomRunActive?: boolean;
  acceptBeforeOutcome?: boolean;
} = {}) => {
  let clock = 0;
  const session = new WorkshopSessionService(() => ++clock);
  session.setSessionScope('open');
  const postMessage = jest.fn().mockResolvedValue(undefined);
  const sendRoomMessage = options.sendError
    ? jest.fn().mockRejectedValue(options.sendError)
    : jest.fn().mockImplementation(async (
        _text: string,
        _displayText: string,
        executeOptions: { onRoomAccepted: (userTurnId: string) => void }
      ) => {
        // The real seam mints the visible turn before replying.
        const turn = session.beginPersonaMessage('req-live', 'visible');
        const outcome = options.sendOutcome ?? { committed: true, userTurnId: turn.id };
        if (outcome.committed || options.acceptBeforeOutcome) {
          executeOptions.onRoomAccepted(turn.id);
        }
        session.completeRun('req-live', 'reply');
        return outcome;
      });
  const markDirty = jest.fn();
  const postSessionState = jest.fn();
  const generateMenu = options.generateMenu
    ?? jest.fn().mockResolvedValue({
      dictionaryMarkdown: '# Gesture Dictionary\n\nA private deflection.',
      menu
    });
  const generateMore = options.generateMore ?? jest.fn();
  const appendLine = jest.fn();
  const handler = new WorkshopGesturePlaygroundHandler(
    session,
    { generateMenu, generateMore } as never,
    postMessage,
    { appendLine } as never,
    {
      sendRoomMessage: sendRoomMessage as never,
      postSessionState,
      markDirty,
      reportError: jest.fn(),
      isRoomRunActive: () => options.roomRunActive ?? false
    }
  );
  const posted = (type: MessageType) =>
    postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);
  return {
    handler,
    session,
    postMessage,
    sendRoomMessage,
    markDirty,
    postSessionState,
    generateMenu,
    generateMore,
    appendLine,
    posted
  };
};

describe('WorkshopGesturePlaygroundHandler — generate', () => {
  it('returns the menu under the request token', async () => {
    const { handler, posted, generateMenu } = build();
    await handler.handleGenerate(generateMessage());
    const results = posted(MessageType.WORKSHOP_GESTURE_PLAYGROUND_MENU_RESULT);
    expect(results).toHaveLength(1);
    expect(results[0].payload).toEqual(expect.objectContaining({
      ok: true,
      token: 'tok-1',
      mode: 'full',
      dictionaryMarkdown: expect.stringContaining('A private deflection'),
      menu
    }));
    expect(generateMenu).toHaveBeenCalledWith(expect.objectContaining({
      writerInstructions: 'Keep it private.',
      sourceMaterials: [],
      onToken: expect.any(Function),
      signal: expect.any(AbortSignal)
    }));
  });

  it('reports honest streaming stages and terminal provider usage', async () => {
    const generateMenu = jest.fn().mockImplementation(async (request: {
      onToken?: (chunk: string) => void;
    }) => {
      // The sentinel deliberately begins a chunk much larger than the
      // 128-character carry buffer. Detection must happen before that buffer
      // is truncated or both stage transitions disappear.
      request.onToken?.(`===GESTURE_DICTIONARY_V1===${'x'.repeat(1_000)}`);
      request.onToken?.(`===GESTURE_MENU_V1===${'y'.repeat(1_000)}`);
      return {
        dictionaryMarkdown: '# Gesture Dictionary\n\nThe scan.',
        menu,
        usage: { promptTokens: 800, completionTokens: 1_750, totalTokens: 2_550 }
      };
    });
    const { handler, posted, appendLine } = build({ generateMenu });

    await handler.handleGenerate(generateMessage());

    const progress = posted(MessageType.WORKSHOP_GESTURE_PLAYGROUND_GENERATION_PROGRESS)
      .map((message) => message.payload);
    expect(progress[0]).toEqual(expect.objectContaining({
      token: 'tok-1',
      phase: 'started',
      stage: 'requesting',
      outputCharacters: 0,
      estimatedOutputTokens: 0,
      outputTokenLimit: PROMPT_BUDGETS.workshopWidgets.gestureOutputTokens
    }));
    expect(progress).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'streaming',
        stage: 'dictionary',
        outputCharacters: expect.any(Number),
        estimatedOutputTokens: expect.any(Number)
      }),
      expect.objectContaining({
        phase: 'streaming',
        stage: 'menu'
      })
    ]));
    expect(progress.at(-1)).toEqual(expect.objectContaining({
      phase: 'completed',
      stage: 'validating',
      completionTokens: 1_750,
      outputTokenLimit: PROMPT_BUDGETS.workshopWidgets.gestureOutputTokens
    }));
  });

  it('resolves selected excerpt and context ids to current host-owned source bodies', async () => {
    const { handler, session, generateMenu } = build();
    session.setExcerpt({
      text: 'The entire active chapter, supplied without persona transcription.',
      source: { kind: 'manual' }
    });
    session.addContextAttachment({
      kind: 'text',
      origin: 'writer',
      label: 'Micah notes',
      words: 5,
      content: 'Micah contains fear through physical control.'
    });

    await handler.handleGenerate(generateMessage({
      sourceReferences: [
        { kind: 'active-excerpt' },
        { kind: 'context-attachment', attachmentId: 'ctx-1' }
      ]
    }));

    expect(generateMenu).toHaveBeenCalledWith(expect.objectContaining({
      sourceMaterials: [
        {
          reference: { kind: 'active-excerpt' },
          label: 'Active excerpt v1',
          content: 'The entire active chapter, supplied without persona transcription.'
        },
        {
          reference: { kind: 'context-attachment', attachmentId: 'ctx-1' },
          label: 'Micah notes',
          content: 'Micah contains fear through physical control.'
        }
      ]
    }));
  });

  it.each([
    [
      'missing excerpt',
      [{ kind: 'active-excerpt' }],
      /active excerpt.*no longer available/i
    ],
    [
      'unknown context id',
      [{ kind: 'context-attachment', attachmentId: 'ctx-9' }],
      /ctx-9.*no longer available/i
    ],
    [
      'path-bearing extension field',
      [{ kind: 'context-attachment', attachmentId: 'ctx-1', path: '/workspace/secret.md' }],
      /context source references? is invalid/i
    ],
    [
      'duplicate reference',
      [{ kind: 'active-excerpt' }, { kind: 'active-excerpt' }],
      /contain a duplicate/i
    ],
    [
      'serialized reference text over budget',
      [{
        kind: 'context-attachment',
        attachmentId: oversizedContextAttachmentId
      }],
      /references exceed 500 characters/i
    ]
  ])('rejects closed source resolution before model spend: %s', async (
    _label,
    sourceReferences,
    expected
  ) => {
    const { handler, posted, generateMenu } = build();

    await handler.handleGenerate(generateMessage({
      sourceReferences: sourceReferences as never
    }));

    expect(generateMenu).not.toHaveBeenCalled();
    expect(posted(MessageType.WORKSHOP_GESTURE_PLAYGROUND_MENU_RESULT)[0].payload).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringMatching(expected)
      })
    );
  });

  it('accepts exactly 500 serialized source-reference characters before resolution', async () => {
    const keyPrefix = 'context-attachment:ctx-';
    const attachmentId = `ctx-1${'0'.repeat(
      PROMPT_BUDGETS.workshopWidgets.gestureSourceReferenceCharacters
      - keyPrefix.length
      - 1
    )}`;
    const sourceReferences = [{ kind: 'context-attachment' as const, attachmentId }];
    expect(`context-attachment:${attachmentId}`).toHaveLength(
      PROMPT_BUDGETS.workshopWidgets.gestureSourceReferenceCharacters
    );
    const { handler, posted, generateMenu } = build();

    await handler.handleGenerate(generateMessage({ sourceReferences }));

    expect(generateMenu).not.toHaveBeenCalled();
    expect(posted(MessageType.WORKSHOP_GESTURE_PLAYGROUND_MENU_RESULT)[0].payload.error)
      .toMatch(/no longer available/i);
    expect(posted(MessageType.WORKSHOP_GESTURE_PLAYGROUND_MENU_RESULT)[0].payload.error)
      .not.toMatch(/references exceed/i);
  });

  it('returns a recovered dictionary without selectable menu state when menu parsing fails', async () => {
    const { handler, posted } = build({
      generateMenu: jest.fn().mockResolvedValue({
        dictionaryMarkdown: '# Gesture Dictionary\n\nThe scan survived.',
        menuError: 'The alternatives menu was malformed.',
        truncated: true
      })
    });

    await handler.handleGenerate(generateMessage());

    expect(posted(MessageType.WORKSHOP_GESTURE_PLAYGROUND_MENU_RESULT)[0].payload).toEqual(
      expect.objectContaining({
        ok: false,
        dictionaryMarkdown: expect.stringContaining('The scan survived'),
        menuError: expect.stringContaining('malformed'),
        truncated: true
      })
    );
    expect(posted(MessageType.WORKSHOP_GESTURE_PLAYGROUND_MENU_RESULT)[0].payload.menu).toBeUndefined();
  });

  it('reports generation failures as a typed result, not a crash', async () => {
    const { handler, posted } = build({
      generateMenu: jest.fn().mockRejectedValue(new Error('unusable menu'))
    });
    await handler.handleGenerate(generateMessage());
    expect(posted(MessageType.WORKSHOP_GESTURE_PLAYGROUND_MENU_RESULT)[0].payload).toEqual(
      expect.objectContaining({ ok: false, error: expect.stringContaining('unusable menu') })
    );
  });

  it('rejects non-live widgets without calling the service', async () => {
    const { handler, posted, generateMenu } = build();
    await handler.handleGenerate(
      generateMessage({ widgetId: 'lexical-gravity' as never })
    );
    expect(generateMenu).not.toHaveBeenCalled();
    expect(posted(MessageType.WORKSHOP_GESTURE_PLAYGROUND_MENU_RESULT)[0].payload.ok).toBe(false);
  });

  it('drops the superseded call silently when a regenerate lands first', async () => {
    let rejectFirst: (error: Error) => void = () => undefined;
    const generateMenu = jest.fn()
      .mockImplementationOnce((request: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          rejectFirst = reject;
          request.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          );
        }))
      .mockResolvedValueOnce({
        dictionaryMarkdown: '# Gesture Dictionary\n\nSecond run.',
        menu
      });
    const { handler, posted, appendLine } = build({ generateMenu });
    const first = handler.handleGenerate(generateMessage({ token: 'tok-old' }));
    const second = handler.handleGenerate(generateMessage({ token: 'tok-new' }));
    rejectFirst(new Error('late failure'));
    await Promise.all([first, second]);
    const results = posted(MessageType.WORKSHOP_GESTURE_PLAYGROUND_MENU_RESULT);
    expect(results).toHaveLength(1);
    expect(results[0].payload.token).toBe('tok-new');
    expect(appendLine).toHaveBeenCalledWith(expect.stringContaining(
      'token tok-old, reason=superseded'
    ));
    expect(posted(MessageType.WORKSHOP_GESTURE_PLAYGROUND_GENERATION_PROGRESS)
      .map((message) => message.payload))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          token: 'tok-old',
          phase: 'cancelled'
        })
      ]));
  });

  it('aborts only the active token through the real cancel route', async () => {
    let activeSignal: AbortSignal | undefined;
    const generateMenu = jest.fn().mockImplementation((request: { signal?: AbortSignal }) => {
      activeSignal = request.signal;
      return new Promise((resolve) => request.signal?.addEventListener('abort', () =>
        resolve({ cancelled: true, truncated: false })
      ));
    });
    const { handler, posted } = build({ generateMenu });
    const pending = handler.handleGenerate(generateMessage());

    await handler.handleCancelGenerate({
      type: MessageType.CANCEL_GESTURE_PLAYGROUND_GENERATE_REQUEST,
      source: 'webview.workshop.widget',
      timestamp: 2,
      payload: { domain: 'workshop-gesture-playground', requestId: 'not-the-token' }
    });
    expect(activeSignal?.aborted).toBe(false);

    await handler.handleCancelGenerate({
      type: MessageType.CANCEL_GESTURE_PLAYGROUND_GENERATE_REQUEST,
      source: 'webview.workshop.widget',
      timestamp: 3,
      payload: { domain: 'workshop-gesture-playground', requestId: 'tok-1' }
    });
    await pending;

    expect(activeSignal?.aborted).toBe(true);
    expect(posted(MessageType.WORKSHOP_GESTURE_PLAYGROUND_GENERATION_PROGRESS))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({ token: 'tok-1', phase: 'cancelled' })
        })
      ]));
    expect(posted(MessageType.WORKSHOP_GESTURE_PLAYGROUND_MENU_RESULT)).toHaveLength(0);
  });

  it('merges fresh stateless additions without disturbing the existing options', async () => {
    const additions = menu.map((group, index) => ({
      heading: group.heading,
      options: [
        group.options[0],
        `fresh gesture ${index + 1}.1`,
        `fresh gesture ${index + 1}.2`
      ]
    }));
    const generateMore = jest.fn().mockResolvedValue({
      cancelled: false,
      additions
    });
    const { handler, posted, generateMenu } = build({ generateMore });

    await handler.handleGenerate(generateMessage({
      mode: 'more',
      dictionaryMarkdown: draft().dictionaryMarkdown,
      menu
    }));

    expect(generateMenu).not.toHaveBeenCalled();
    expect(generateMore).toHaveBeenCalledWith(expect.objectContaining({
      dictionaryMarkdown: draft().dictionaryMarkdown,
      menu
    }));
    expect(posted(MessageType.WORKSHOP_GESTURE_PLAYGROUND_MENU_RESULT)[0].payload)
      .toEqual(expect.objectContaining({
        ok: true,
        mode: 'more',
        menu: menu.map((group, index) => ({
          heading: group.heading,
          options: [
            ...group.options,
            `fresh gesture ${index + 1}.1`,
            `fresh gesture ${index + 1}.2`
          ]
        }))
      }));
  });
});

describe('WorkshopGesturePlaygroundHandler — atomic commit', () => {
  it('persists config, ships outside the pending list, and stamps linkage on success', async () => {
    const { handler, session, sendRoomMessage, posted, markDirty } = build();
    // A staged composer pill must survive the widget commit untouched.
    session.addMessageAttachment({ label: 'notes.md', words: 3, content: 'notes' });

    await handler.handleCommit(commitMessage());

    expect(sendRoomMessage).toHaveBeenCalledWith(
      expect.stringContaining('she smiled'),
      expect.any(String),
      expect.objectContaining({
        includeMessageAttachments: false,
        widgetArtifact: expect.objectContaining({
          id: 'ta-2',
          widgetId: 'gesture-playground',
          widgetConfigId: 'wc-1',
          content: expect.stringContaining('Gesture directions I want for "she smiled":')
        })
      })
    );
    const config = session.getWidgetConfig('wc-1')!;
    expect(config.committedTurnId).toBeDefined();
    expect(config.artifactId).toBe('ta-2');
    // The composer pill is still pending — it belonged to the writer's draft.
    expect(session.getSnapshot().pendingMessageAttachments).toHaveLength(1);
    expect(markDirty).toHaveBeenCalledWith('widget config created');
    expect(markDirty).toHaveBeenCalledWith('widget commit accepted');
    const results = posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT);
    expect(results[0].payload).toEqual(expect.objectContaining({
      ok: true,
      widgetConfigId: 'wc-1'
    }));
  });

  it('publishes commit linkage only after the room accepts the writer turn', async () => {
    const { handler, session, sendRoomMessage, posted, markDirty, postSessionState } = build();
    let acceptRoom!: () => void;
    let settleSend!: () => void;
    let acceptedTurnId!: string;
    sendRoomMessage.mockImplementation((
      _text: string,
      _displayText: string,
      executeOptions: { onRoomAccepted: (userTurnId: string) => void }
    ) => new Promise<{ committed: boolean; userTurnId: string }>((resolve) => {
      acceptRoom = () => {
        const turn = session.beginPersonaMessage('req-deferred', 'visible');
        acceptedTurnId = turn.id;
        executeOptions.onRoomAccepted(turn.id);
        session.completeRun('req-deferred', 'reply');
      };
      settleSend = () => resolve({ committed: true, userTurnId: acceptedTurnId });
    }));

    const pendingCommit = handler.handleCommit(commitMessage());
    await Promise.resolve();

    expect(session.getWidgetConfig('wc-1')).toBeDefined();
    expect(session.getWidgetConfig('wc-1')!.committedTurnId).toBeUndefined();
    expect(session.getWidgetConfig('wc-1')!.artifactId).toBeUndefined();
    expect(markDirty).toHaveBeenCalledTimes(1);
    expect(markDirty).toHaveBeenCalledWith('widget config created');
    expect(postSessionState).not.toHaveBeenCalled();
    expect(posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT)).toHaveLength(0);
    expect(session.collectWriterSources({ kind: 'host' })).toEqual([]);

    acceptRoom();

    expect(session.getWidgetConfig('wc-1')).toMatchObject({
      committedTurnId: acceptedTurnId,
      artifactId: 'ta-1'
    });
    expect(markDirty).toHaveBeenCalledTimes(2);
    expect(markDirty).toHaveBeenLastCalledWith('widget commit accepted');
    expect(postSessionState).toHaveBeenCalledTimes(1);
    expect(session.collectWriterSources({ kind: 'host' })).toEqual([
      expect.objectContaining({
        kind: 'message-attachment',
        artifactId: 'ta-1'
      })
    ]);
    expect(posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT)).toHaveLength(1);
    expect(posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT)[0].payload).toMatchObject({
      action: 'commit',
      requestToken: 'commit-1',
      widgetId: 'gesture-playground',
      widgetConfigId: 'wc-1',
      turnId: acceptedTurnId,
      ok: true
    });

    settleSend();
    await pendingCommit;
    expect(posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT)).toHaveLength(1);
  });

  it('includes the full Gesture Dictionary only when the writer opts in', async () => {
    const { handler, sendRoomMessage } = build();

    await handler.handleCommit(commitMessage({
      draft: draft({ includeDictionaryInCommit: true })
    }));

    expect(sendRoomMessage).toHaveBeenCalledWith(
      expect.stringContaining('full Gesture Dictionary shared as reference'),
      expect.any(String),
      expect.objectContaining({
        widgetArtifact: expect.objectContaining({
          content: expect.stringContaining(
            'Full Gesture Dictionary shared by the writer as reference:\n' +
            '# Gesture Dictionary\n\nA private deflection.'
          )
        })
      })
    );
  });

  it('keeps the config as the retry token when the room does not accept', async () => {
    const { handler, session, posted } = build({ sendOutcome: { committed: false } });
    await handler.handleCommit(commitMessage());
    expect(session.getWidgetConfig('wc-1')).toBeDefined();
    expect(session.getWidgetConfig('wc-1')!.committedTurnId).toBeUndefined();
    expect(posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT)[0].payload).toEqual(
      expect.objectContaining({ ok: false, widgetConfigId: 'wc-1' })
    );
  });

  it('keeps the config when the send throws', async () => {
    const { handler, session, posted } = build({ sendError: new Error('network down') });
    await handler.handleCommit(commitMessage());
    expect(session.getWidgetConfig('wc-1')).toBeDefined();
    expect(posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT)[0].payload.ok).toBe(false);
  });

  it('keeps an accepted commit when the participant response later fails', async () => {
    const { handler, session, posted } = build({
      sendOutcome: { committed: false, userTurnId: 'turn-user' },
      acceptBeforeOutcome: true
    });

    await handler.handleCommit(commitMessage());

    expect(session.getWidgetConfig('wc-1')).toMatchObject({
      committedTurnId: expect.any(String),
      artifactId: 'ta-1'
    });
    expect(posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT)).toHaveLength(1);
    expect(posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT)[0].payload.ok).toBe(true);
  });

  it('rejects a re-entrant commit before creating another config', async () => {
    const { handler, session, sendRoomMessage, posted } = build({ roomRunActive: true });

    await handler.handleCommit(commitMessage());

    expect(sendRoomMessage).not.toHaveBeenCalled();
    expect(session.getWidgetConfig('wc-1')).toBeUndefined();
    expect(posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT)[0].payload)
      .toMatchObject({ ok: false, message: expect.stringMatching(/current Workshop response/i) });
  });

  it.each([
    ['no selections', { draft: draft({ selections: [] }) }],
    ['blank phrase', { draft: draft({ targetPhrase: '   ' }) }],
    ['duplicate selections', { draft: draft({ selections: ['same', 'same'] }) }],
    ['missing dictionary', { draft: draft({ dictionaryMarkdown: '' }) }],
    ['missing menu', { draft: draft({ menu: undefined as never }) }],
    ['missing source references', { draft: draft({ sourceReferences: undefined as never }) }],
    [
      'missing dictionary-sharing choice',
      { draft: draft({ includeDictionaryInCommit: undefined as never }) }
    ],
    [
      'duplicate source references',
      {
        draft: draft({
          sourceReferences: [{ kind: 'active-excerpt' }, { kind: 'active-excerpt' }]
        })
      }
    ],
    [
      'path-bearing source reference',
      {
        draft: draft({
          sourceReferences: [
            {
              kind: 'context-attachment',
              attachmentId: 'ctx-1',
              path: '/workspace/secret.md'
            } as never
          ]
        })
      }
    ],
    [
      'serialized source references over budget',
      {
        draft: draft({
          sourceReferences: [{
            kind: 'context-attachment',
            attachmentId: oversizedContextAttachmentId
          }]
        })
      }
    ],
    ['selection outside menu', { draft: draft({ selections: ['invented client option'] }) }],
    ['non-live widget', { widgetId: 'prose-controller' as never }]
  ])('rejects before any state change: %s', async (_label, overrides) => {
    const { handler, session, sendRoomMessage, posted } = build();
    await handler.handleCommit(commitMessage(overrides));
    expect(sendRoomMessage).not.toHaveBeenCalled();
    expect(session.getWidgetConfig('wc-1')).toBeUndefined();
    expect(posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT)[0].payload.ok).toBe(false);
  });

  it('refuses tool-sidecar targets with a usable message', async () => {
    const { handler, session, sendRoomMessage, posted } = build();
    session.setExcerpt({ text: 'A pinned passage.', source: { kind: 'manual' } });
    session.beginToolRun('prose', 'req-sidecar');
    session.completeToolReport('req-sidecar', 'Report.', 'conversation-tool');
    expect(session.setChatTarget({ kind: 'tool', toolId: 'prose' })).toBe(true);
    await handler.handleCommit(commitMessage());
    expect(sendRoomMessage).not.toHaveBeenCalled();
    expect(posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT)[0].payload.message)
      .toMatch(/persona target/);
  });
});
