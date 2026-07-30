/**
 * The widget IPC slice (ADR 2026-07-22, Sprint 01): generate is a free
 * preview call with token correlation and cancel; commit is one atomic
 * route — config before send (the durable retry token), linkage and the
 * writer-origin manifest only when the reply lands, and the writer's staged
 * composer pills never consumed.
 */

import { WorkshopWidgetHandler } from '@handlers/domain/WorkshopWidgetHandler';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  MessageType,
  WorkshopCommitWidgetMessage,
  WorkshopGestureDraft,
  WorkshopWidgetGenerateMessage
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

const draft = (overrides: Partial<WorkshopGestureDraft> = {}): WorkshopGestureDraft => ({
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
  overrides: Partial<WorkshopWidgetGenerateMessage['payload']> = {}
): WorkshopWidgetGenerateMessage => ({
  type: MessageType.WORKSHOP_WIDGET_GENERATE,
  source: 'webview.workshop',
  timestamp: 1,
  payload: {
    widgetId: 'gesture-playground',
    token: 'tok-1',
    targetPhrase: 'she smiled',
    writerInstructions: 'Keep it private.',
    contextText: '',
    characterNotes: '',
    sourceReferences: [],
    ...overrides
  }
});

const commitMessage = (
  overrides: Partial<WorkshopCommitWidgetMessage['payload']> = {}
): WorkshopCommitWidgetMessage => ({
  type: MessageType.WORKSHOP_COMMIT_WIDGET,
  source: 'webview.workshop',
  timestamp: 1,
  payload: {
    widgetId: 'gesture-playground',
    draft: draft(),
    ...overrides
  }
});

const build = (options: {
  sendOutcome?: { committed: boolean; userTurnId?: string };
  sendError?: Error;
  generateMenu?: jest.Mock;
} = {}) => {
  let clock = 0;
  const session = new WorkshopSessionService(() => ++clock);
  session.setSessionScope('open');
  const postMessage = jest.fn().mockResolvedValue(undefined);
  const sendRoomMessage = options.sendError
    ? jest.fn().mockRejectedValue(options.sendError)
    : jest.fn().mockImplementation(async () => {
        // The real seam mints the visible turn before replying.
        const turn = session.beginPersonaMessage('req-live', 'visible');
        session.completeRun('req-live', 'reply');
        return options.sendOutcome ?? { committed: true, userTurnId: turn.id };
      });
  const markDirty = jest.fn();
  const postSessionState = jest.fn();
  const generateMenu = options.generateMenu
    ?? jest.fn().mockResolvedValue({
      dictionaryMarkdown: '# Gesture Dictionary\n\nA private deflection.',
      menu
    });
  const handler = new WorkshopWidgetHandler(
    session,
    { generateMenu } as never,
    postMessage,
    { appendLine: jest.fn() } as never,
    {
      sendRoomMessage: sendRoomMessage as never,
      postSessionState,
      markDirty,
      reportError: jest.fn()
    }
  );
  const posted = (type: MessageType) =>
    postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);
  return { handler, session, postMessage, sendRoomMessage, markDirty, postSessionState, generateMenu, posted };
};

describe('WorkshopWidgetHandler — generate', () => {
  it('returns the menu under the request token', async () => {
    const { handler, posted, generateMenu } = build();
    await handler.handleGenerate(generateMessage());
    const results = posted(MessageType.WORKSHOP_WIDGET_MENU_RESULT);
    expect(results).toHaveLength(1);
    expect(results[0].payload).toEqual(expect.objectContaining({
      ok: true,
      token: 'tok-1',
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
    const { handler, posted } = build({ generateMenu });

    await handler.handleGenerate(generateMessage());

    const progress = posted(MessageType.WORKSHOP_WIDGET_GENERATION_PROGRESS)
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
    expect(posted(MessageType.WORKSHOP_WIDGET_MENU_RESULT)[0].payload).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringMatching(expected)
      })
    );
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

    expect(posted(MessageType.WORKSHOP_WIDGET_MENU_RESULT)[0].payload).toEqual(
      expect.objectContaining({
        ok: false,
        dictionaryMarkdown: expect.stringContaining('The scan survived'),
        menuError: expect.stringContaining('malformed'),
        truncated: true
      })
    );
    expect(posted(MessageType.WORKSHOP_WIDGET_MENU_RESULT)[0].payload.menu).toBeUndefined();
  });

  it('reports generation failures as a typed result, not a crash', async () => {
    const { handler, posted } = build({
      generateMenu: jest.fn().mockRejectedValue(new Error('unusable menu'))
    });
    await handler.handleGenerate(generateMessage());
    expect(posted(MessageType.WORKSHOP_WIDGET_MENU_RESULT)[0].payload).toEqual(
      expect.objectContaining({ ok: false, error: expect.stringContaining('unusable menu') })
    );
  });

  it('rejects non-live widgets without calling the service', async () => {
    const { handler, posted, generateMenu } = build();
    await handler.handleGenerate(
      generateMessage({ widgetId: 'lexical-gravity' as never })
    );
    expect(generateMenu).not.toHaveBeenCalled();
    expect(posted(MessageType.WORKSHOP_WIDGET_MENU_RESULT)[0].payload.ok).toBe(false);
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
    const { handler, posted } = build({ generateMenu });
    const first = handler.handleGenerate(generateMessage({ token: 'tok-old' }));
    const second = handler.handleGenerate(generateMessage({ token: 'tok-new' }));
    rejectFirst(new Error('late failure'));
    await Promise.all([first, second]);
    const results = posted(MessageType.WORKSHOP_WIDGET_MENU_RESULT);
    expect(results).toHaveLength(1);
    expect(results[0].payload.token).toBe('tok-new');
    expect(posted(MessageType.WORKSHOP_WIDGET_GENERATION_PROGRESS)
      .map((message) => message.payload))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          token: 'tok-old',
          phase: 'cancelled'
        })
      ]));
  });
});

describe('WorkshopWidgetHandler — atomic commit', () => {
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
    expect(markDirty).toHaveBeenCalledWith('widget commit landed');
    const results = posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT);
    expect(results[0].payload).toEqual(expect.objectContaining({
      ok: true,
      widgetConfigId: 'wc-1'
    }));
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
    // Force the chat target to a tool.
    (session as unknown as { participants: { chatTarget: unknown } })
      .participants.chatTarget = { kind: 'tool', toolId: 'prose' };
    await handler.handleCommit(commitMessage());
    expect(sendRoomMessage).not.toHaveBeenCalled();
    expect(posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT)[0].payload.message)
      .toMatch(/persona target/);
  });
});
