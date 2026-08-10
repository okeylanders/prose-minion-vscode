/**
 * The Gesture Playground IPC slice (ADR 2026-07-22, Sprint 01): generate is a free
 * preview call with token correlation and cancel. One-shot commit behavior is
 * owned by the Widget Host and coordinator suites.
 */

import { WorkshopGesturePlaygroundHandler } from '@handlers/domain/workshop/widgets/gesturePlayground/WorkshopGesturePlaygroundHandler';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY
} from '@/application/services/workshop/widgets/WorkshopWidgetAvailabilityPolicy';
import {
  MessageType,
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

const build = (options: {
  generateMenu?: jest.Mock;
  generateMore?: jest.Mock;
} = {}) => {
  let clock = 0;
  const session = new WorkshopSessionService(() => ++clock);
  session.setSessionScope('open');
  const postMessage = jest.fn().mockResolvedValue(undefined);
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
    WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY,
    postMessage,
    { appendLine } as never
  );
  const posted = (type: MessageType) =>
    postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);
  return {
    handler,
    session,
    postMessage,
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
