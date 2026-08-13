import {
  WorkshopCreativeVariationsHandler
} from '@handlers/domain/workshop/widgets/creativeVariations/WorkshopCreativeVariationsHandler';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  fixedWorkshopWidgetAvailabilityPolicy
} from '@/application/services/workshop/widgets/WorkshopWidgetAvailabilityPolicy';
import {
  computeCreativeVariationsTextualOverlap
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsDistinctness';
import {
  CREATIVE_VARIATIONS_RESPONSE_START
} from '@services/widgets/creativeVariations/CreativeVariationsResponseCodec';
import {
  MessageType,
  type WorkshopCreativeVariationsGenerateMessage,
  type WorkshopCreativeVariationsWorkup
} from '@messages';

const ids = [
  'cvw-00000000-0000-4000-8000-000000000001',
  'cvw-00000000-0000-4000-8000-000000000002',
  'cvw-00000000-0000-4000-8000-000000000003'
];

const message = (
  overrides: Partial<WorkshopCreativeVariationsGenerateMessage['payload']> = {}
): WorkshopCreativeVariationsGenerateMessage => ({
  type: MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATE,
  source: 'webview.workshop',
  timestamp: 1,
  payload: {
    widgetId: 'creative-variations',
    token: 'tok-1',
    subject: { text: 'Mara folded the letter.', provenance: { kind: 'pasted' } },
    surroundingContext: { writerText: 'Her brother waits.', sourceReferences: [] },
    invariants: { mustSurvive: 'Mara delays her answer.', mustNotChange: '' },
    intent: { kind: 'custom-aim', aim: 'Make the delay active.', distance: 'tail' },
    requestedCount: 3,
    ...overrides
  }
});

const workup = (workupId = ids[0]): WorkshopCreativeVariationsWorkup => {
  const cards = [1, 2, 3].map((position) => ({
    position,
    approach: `Approach ${position}`,
    direction: `Distinct direction ${position}`,
    prose: `Mara makes distinct choice ${position} before answering.`,
    tradeoff: { gain: `Gain ${position}`, cost: `Cost ${position}` },
    invariantFlags: []
  }));
  return {
    workupId,
    generationProtocolVersion: 1,
    cards,
    overlap: computeCreativeVariationsTextualOverlap('Mara folded the letter.', cards)
  };
};

const build = (options: { generate?: jest.Mock; available?: boolean } = {}) => {
  let clock = 0;
  const session = new WorkshopSessionService(() => ++clock);
  session.setSessionScope('open');
  const generate = options.generate ?? jest.fn().mockImplementation(async (request) => ({
    cancelled: false,
    workup: workup(request.workupId),
    truncated: false
  }));
  const postMessage = jest.fn().mockResolvedValue(undefined);
  const appendLine = jest.fn();
  let idIndex = 0;
  const createWorkupId = jest.fn(() => ids[idIndex++]);
  const handler = new WorkshopCreativeVariationsHandler(
    session,
    { generate } as never,
    createWorkupId,
    fixedWorkshopWidgetAvailabilityPolicy(
      options.available === false ? [] : ['creative-variations']
    ),
    postMessage,
    { appendLine } as never
  );
  const posted = (type: MessageType) => postMessage.mock.calls
    .map(([postedMessage]) => postedMessage)
    .filter((postedMessage) => postedMessage.type === type);
  return { handler, session, generate, createWorkupId, posted, appendLine };
};

describe('WorkshopCreativeVariationsHandler', () => {
  it('keeps the dormant production route unavailable without model spend', async () => {
    const { handler, generate, posted } = build({ available: false });
    await handler.handleGenerate(message());
    expect(generate).not.toHaveBeenCalled();
    expect(posted(MessageType.WORKSHOP_CREATIVE_VARIATIONS_RESULT)[0].payload)
      .toEqual(expect.objectContaining({
        token: 'tok-1',
        workupId: ids[0],
        ok: false,
        error: 'That widget is not available yet.'
      }));
  });

  it('returns a settled workup under both correlation identities without mutating session', async () => {
    const { handler, session, generate, posted } = build();
    const before = session.getSnapshot();
    await handler.handleGenerate(message());

    expect(session.getSnapshot()).toEqual(before);
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      workupId: ids[0],
      requestedCount: 3,
      sourceMaterials: [],
      onToken: expect.any(Function),
      signal: expect.any(AbortSignal)
    }));
    expect(posted(MessageType.WORKSHOP_CREATIVE_VARIATIONS_RESULT)[0].payload)
      .toEqual(expect.objectContaining({
        token: 'tok-1',
        workupId: ids[0],
        ok: true,
        workup: expect.objectContaining({ workupId: ids[0] })
      }));
  });

  it('resolves selected sources from current host-owned session truth', async () => {
    const { handler, session, generate } = build();
    session.setExcerpt({ text: 'Current excerpt body.', source: { kind: 'manual' } });
    session.addContextAttachment({
      kind: 'text',
      origin: 'writer',
      label: 'Character notes',
      words: 3,
      content: 'Mara hides fear.'
    });
    await handler.handleGenerate(message({
      surroundingContext: {
        writerText: '',
        sourceReferences: [
          { kind: 'active-excerpt' },
          { kind: 'context-attachment', attachmentId: 'ctx-1' }
        ]
      }
    }));
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      sourceMaterials: [
        {
          reference: { kind: 'active-excerpt' },
          label: 'Active excerpt v1',
          content: 'Current excerpt body.'
        },
        {
          reference: { kind: 'context-attachment', attachmentId: 'ctx-1' },
          label: 'Character notes',
          content: 'Mara hides fear.'
        }
      ]
    }));
  });

  it('rejects a missing selected source before calling the provider service', async () => {
    const { handler, generate, posted } = build();
    await handler.handleGenerate(message({
      surroundingContext: {
        writerText: '',
        sourceReferences: [{ kind: 'context-attachment', attachmentId: 'ctx-9' }]
      }
    }));
    expect(generate).not.toHaveBeenCalled();
    expect(posted(MessageType.WORKSHOP_CREATIVE_VARIATIONS_RESULT)[0].payload)
      .toEqual(expect.objectContaining({
        ok: false,
        error: expect.stringMatching(/ctx-9.*no longer available/i)
      }));
  });

  it('reports streaming stage and terminal usage without leaking raw chunks', async () => {
    const generate = jest.fn().mockImplementation(async (request) => {
      request.onToken(`${CREATIVE_VARIATIONS_RESPONSE_START}${'x'.repeat(1_000)}`);
      return {
        cancelled: false,
        workup: workup(request.workupId),
        usage: { promptTokens: 100, completionTokens: 250, totalTokens: 350 },
        truncated: false
      };
    });
    const { handler, posted } = build({ generate });
    await handler.handleGenerate(message());
    const progress = posted(MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATION_PROGRESS)
      .map((value) => value.payload);
    expect(progress[0]).toEqual(expect.objectContaining({
      phase: 'started', stage: 'requesting', workupId: ids[0]
    }));
    expect(progress).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'streaming', stage: 'variations' })
    ]));
    expect(progress.at(-1)).toEqual(expect.objectContaining({
      phase: 'completed', stage: 'validating', completionTokens: 250
    }));
  });

  it('mints a fresh workup id and drops a superseded result even if abort loses the race', async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    const generate = jest.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(async (request) => ({
        cancelled: false,
        workup: workup(request.workupId),
        truncated: false
      }));
    const { handler, posted } = build({ generate });
    const first = handler.handleGenerate(message({ token: 'tok-old' }));
    const second = handler.handleGenerate(message({ token: 'tok-new' }));
    resolveFirst({ cancelled: false, workup: workup(ids[0]), truncated: false });
    await Promise.all([first, second]);

    expect(generate.mock.calls.map(([request]) => request.workupId)).toEqual([ids[0], ids[1]]);
    const results = posted(MessageType.WORKSHOP_CREATIVE_VARIATIONS_RESULT);
    expect(results).toHaveLength(1);
    expect(results[0].payload).toEqual(expect.objectContaining({
      token: 'tok-new', workupId: ids[1], ok: true
    }));
  });

  it('aborts only the matching active token through the Creative cancel domain', async () => {
    let signal: AbortSignal | undefined;
    const generate = jest.fn().mockImplementation((request) => {
      signal = request.signal;
      return new Promise((resolve) => request.signal.addEventListener('abort', () =>
        resolve({ cancelled: true })
      ));
    });
    const { handler, posted } = build({ generate });
    const pending = handler.handleGenerate(message());
    await handler.handleCancelGenerate({
      type: MessageType.CANCEL_CREATIVE_VARIATIONS_GENERATE_REQUEST,
      source: 'webview.workshop',
      timestamp: 2,
      payload: { domain: 'workshop-creative-variations', requestId: 'other' }
    });
    expect(signal?.aborted).toBe(false);
    await handler.handleCancelGenerate({
      type: MessageType.CANCEL_CREATIVE_VARIATIONS_GENERATE_REQUEST,
      source: 'webview.workshop',
      timestamp: 3,
      payload: { domain: 'workshop-creative-variations', requestId: 'tok-1' }
    });
    await pending;
    expect(signal?.aborted).toBe(true);
    expect(posted(MessageType.WORKSHOP_CREATIVE_VARIATIONS_RESULT)).toHaveLength(0);
    expect(posted(MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATION_PROGRESS))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ payload: expect.objectContaining({ phase: 'cancelled' }) })
      ]));
  });
});
