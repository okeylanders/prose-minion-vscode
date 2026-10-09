import {
  WorkshopShowVsTellHandler
} from '@handlers/domain/workshop/widgets/showVsTell/WorkshopShowVsTellHandler';
import type { MessageRouter } from '@handlers/MessageRouter';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY,
  fixedWorkshopWidgetAvailabilityPolicy
} from '@/application/services/workshop/widgets/WorkshopWidgetAvailabilityPolicy';
import {
  SHOW_VS_TELL_RESPONSE_START,
  decodeShowVsTellResponse
} from '@services/widgets/showVsTell/ShowVsTellResponseCodec';
import {
  MessageType,
  type CancelShowVsTellGenerateRequestMessage,
  type WorkshopShowVsTellGenerateMessage,
  type WorkshopShowVsTellWorkup
} from '@messages';
import {
  SVT_EXAMPLE_INVARIANTS,
  exampleResponseText
} from '@/__tests__/infrastructure/api/services/widgets/showVsTell/showVsTellResponseFixtures';

const ids = [
  'svtw-00000000-0000-4000-8000-000000000001',
  'svtw-00000000-0000-4000-8000-000000000002',
  'svtw-00000000-0000-4000-8000-000000000003'
];

const message = (
  overrides: Partial<WorkshopShowVsTellGenerateMessage['payload']> = {}
): WorkshopShowVsTellGenerateMessage => ({
  type: MessageType.WORKSHOP_SHOW_VS_TELL_GENERATE,
  source: 'webview.workshop',
  timestamp: 1,
  payload: {
    widgetId: 'show-vs-tell',
    token: 'tok-1',
    beat: { text: 'She hadn’t trusted him since the funeral.', provenance: { kind: 'pasted' } },
    surroundingContext: { sourceReferences: [] },
    pov: { mode: 'close-third', focalCharacter: 'Nora' },
    invariants: { ...SVT_EXAMPLE_INVARIANTS },
    channels: ['observable-action', 'sensory-evidence'],
    lengthBudget: 'same-length',
    position: 'hinge',
    ...overrides
  }
});

const cancelMessage = (requestId: string, domain = 'workshop-show-vs-tell'): CancelShowVsTellGenerateRequestMessage => ({
  type: MessageType.CANCEL_SHOW_VS_TELL_GENERATE_REQUEST,
  source: 'webview.workshop',
  timestamp: 2,
  payload: { domain, requestId } as never
});

/** A workup the real codec settled, with the attempt's host-minted id. */
const workup = (workupId: string): WorkshopShowVsTellWorkup =>
  decodeShowVsTellResponse(exampleResponseText(), {
    workupId,
    invariants: SVT_EXAMPLE_INVARIANTS
  });

const settled = (request: { workupId: string }) => ({
  cancelled: false,
  workup: workup(request.workupId),
  truncated: false
});

const build = (options: {
  generate?: jest.Mock;
  policy?: ReturnType<typeof fixedWorkshopWidgetAvailabilityPolicy>;
} = {}) => {
  let clock = 0;
  const session = new WorkshopSessionService(() => ++clock);
  session.setSessionScope('open');
  const generate = options.generate ?? jest.fn().mockImplementation(async (request) => settled(request));
  const postMessage = jest.fn().mockResolvedValue(undefined);
  const appendLine = jest.fn();
  let idIndex = 0;
  const createWorkupId = jest.fn(() => ids[idIndex++]);
  const handler = new WorkshopShowVsTellHandler(
    session,
    { generate } as never,
    createWorkupId,
    options.policy ?? fixedWorkshopWidgetAvailabilityPolicy(['show-vs-tell']),
    postMessage,
    { appendLine } as never
  );
  const posted = (type: MessageType) => postMessage.mock.calls
    .map(([postedMessage]) => postedMessage)
    .filter((postedMessage) => postedMessage.type === type);
  const results = () => posted(MessageType.WORKSHOP_SHOW_VS_TELL_RESULT).map((value) => value.payload);
  const progress = () =>
    posted(MessageType.WORKSHOP_SHOW_VS_TELL_GENERATION_PROGRESS).map((value) => value.payload);
  return { handler, session, generate, createWorkupId, posted, results, progress, appendLine };
};

describe('WorkshopShowVsTellHandler', () => {
  describe('availability', () => {
    it('refuses generation when the injected policy marks the route unavailable', async () => {
      const { handler, generate, results, progress } = build({
        policy: fixedWorkshopWidgetAvailabilityPolicy([])
      });

      await handler.handleGenerate(message());

      expect(generate).not.toHaveBeenCalled();
      expect(progress()).toEqual([]);
      expect(results()).toEqual([expect.objectContaining({
        token: 'tok-1', workupId: ids[0], ok: false, error: 'That widget is not available yet.'
      })]);
    });

    it('runs through the production catalog policy now that show-vs-tell is live', async () => {
      const { handler, generate, results } = build({
        policy: WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY
      });

      await handler.handleGenerate(message());

      expect(WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY.isAvailable('show-vs-tell')).toBe(true);
      expect(generate).toHaveBeenCalledTimes(1);
      expect(results()).toEqual([expect.objectContaining({ ok: true })]);
    });

    it('still refuses a widget id the production policy does not make live', async () => {
      const { handler, generate, results } = build({
        policy: WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY
      });

      await handler.handleGenerate(message({ widgetId: 'topic-relationship' } as never));

      expect(generate).not.toHaveBeenCalled();
      expect(results()).toEqual([expect.objectContaining({
        ok: false, error: 'That widget is not available yet.'
      })]);
    });

    it('refuses a payload addressed to another widget', async () => {
      const { handler, generate, results } = build({
        policy: fixedWorkshopWidgetAvailabilityPolicy(['show-vs-tell', 'creative-variations'])
      });

      await handler.handleGenerate(message({ widgetId: 'creative-variations' as never }));

      expect(generate).not.toHaveBeenCalled();
      expect(results()[0]).toEqual(expect.objectContaining({ ok: false }));
    });

    it('does not disturb an active generation when a refused request arrives', async () => {
      let signal: AbortSignal | undefined;
      const generate = jest.fn().mockImplementation((request) => {
        signal = request.signal;
        return new Promise((resolve) => request.signal.addEventListener('abort', () =>
          resolve({ cancelled: true })
        ));
      });
      const { handler, results } = build({ generate });
      const pending = handler.handleGenerate(message());

      await handler.handleGenerate(message({ widgetId: 'creative-variations' as never, token: 'tok-x' }));

      expect(signal?.aborted).toBe(false);
      expect(handler.isGenerationActive()).toBe(true);
      expect(results()).toHaveLength(1);
      await handler.handleCancelGenerate(cancelMessage('tok-1'));
      await pending;
    });
  });

  describe('a settled generation', () => {
    it('returns the workup under both correlation identities and never mutates the session', async () => {
      const { handler, session, generate, results } = build();
      const before = JSON.stringify(session.getSnapshot());

      await handler.handleGenerate(message());

      expect(JSON.stringify(session.getSnapshot())).toBe(before);
      expect(generate).toHaveBeenCalledWith(expect.objectContaining({
        workupId: ids[0],
        position: 'hinge',
        channels: ['observable-action', 'sensory-evidence'],
        lengthBudget: 'same-length',
        sourceMaterials: [],
        onToken: expect.any(Function),
        signal: expect.any(AbortSignal)
      }));
      expect(results()).toEqual([expect.objectContaining({
        token: 'tok-1',
        workupId: ids[0],
        ok: true,
        widgetId: 'show-vs-tell',
        workup: expect.objectContaining({ workupId: ids[0] })
      })]);
      expect(handler.isGenerationActive()).toBe(false);
    });

    it('only reads the session: any other session method would fail the test', async () => {
      const real = new WorkshopSessionService(() => 1);
      real.setSessionScope('open');
      real.setExcerpt({ text: 'Nora set the table for two.', source: { kind: 'manual' } });
      const allowed = new Set(['getExcerpt', 'getContextAttachment']);
      const guarded = new Proxy(real, {
        get: (target, property, receiver) => {
          if (typeof property === 'string' && !allowed.has(property)) {
            throw new Error(`Generation touched session.${property}`);
          }
          const value = Reflect.get(target, property, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });
      const generate = jest.fn().mockImplementation(async (request) => settled(request));
      const handler = new WorkshopShowVsTellHandler(
        guarded,
        { generate } as never,
        () => ids[0],
        fixedWorkshopWidgetAvailabilityPolicy(['show-vs-tell']),
        jest.fn().mockResolvedValue(undefined),
        { appendLine: jest.fn() } as never
      );

      await handler.handleGenerate(message({
        surroundingContext: { sourceReferences: [{ kind: 'active-excerpt' }] }
      }));

      expect(generate).toHaveBeenCalledTimes(1);
    });

    it('hands the beat provenance to the service for validation only', async () => {
      const { handler, generate } = build();

      await handler.handleGenerate(message({
        beat: {
          text: 'She hadn’t trusted him since the funeral.',
          provenance: { kind: 'excerpt', relativePath: 'chapters/four.md', startLine: 3, endLine: 3 }
        }
      }));

      expect(generate.mock.calls[0][0].beat.provenance).toEqual({
        kind: 'excerpt', relativePath: 'chapters/four.md', startLine: 3, endLine: 3
      });
    });
  });

  describe('surrounding passage (Q1): resolved on the host, from the reference only', () => {
    it('resolves the active excerpt and a context attachment from current session truth', async () => {
      const { handler, session, generate } = build();
      session.setExcerpt({ text: 'Current excerpt body.', source: { kind: 'manual' } });

      await handler.handleGenerate(message({
        surroundingContext: { sourceReferences: [{ kind: 'active-excerpt' }] }
      }));
      session.addContextAttachment({
        kind: 'text', origin: 'writer', label: 'Character notes', words: 3, content: 'Nora hides fear.'
      });
      await handler.handleGenerate(message({
        token: 'tok-2',
        surroundingContext: {
          sourceReferences: [{ kind: 'context-attachment', attachmentId: 'ctx-1' }]
        }
      }));

      expect(generate.mock.calls[0][0].sourceMaterials).toEqual([{
        reference: { kind: 'active-excerpt' },
        label: 'Active excerpt v1',
        content: 'Current excerpt body.'
      }]);
      expect(generate.mock.calls[1][0].sourceMaterials).toEqual([{
        reference: { kind: 'context-attachment', attachmentId: 'ctx-1' },
        label: 'Character notes',
        content: 'Nora hides fear.'
      }]);
    });

    it('never forwards passage text a webview smuggles in beside the reference', async () => {
      const { handler, generate } = build();
      const payload = message().payload as unknown as Record<string, unknown>;
      payload.surroundingContext = { sourceReferences: [], writerText: 'Webview-supplied passage.' };
      payload.passage = 'Webview-supplied passage.';

      await handler.handleGenerate({ ...message(), payload } as never);

      expect(generate).toHaveBeenCalledTimes(1);
      const request = generate.mock.calls[0][0];
      expect(JSON.stringify({ ...request, signal: undefined, onToken: undefined }))
        .not.toContain('Webview-supplied passage.');
      expect(request.sourceMaterials).toEqual([]);
    });

    it('fails visibly, with no spend, when the referenced excerpt is gone', async () => {
      const { handler, generate, results } = build();

      await handler.handleGenerate(message({
        surroundingContext: { sourceReferences: [{ kind: 'active-excerpt' }] }
      }));

      expect(generate).not.toHaveBeenCalled();
      expect(results()).toEqual([expect.objectContaining({
        ok: false, error: expect.stringMatching(/active excerpt.*no longer available/i)
      })]);
    });

    it('fails visibly, with no spend, when the referenced context item is gone', async () => {
      const { handler, generate, results, progress } = build();

      await handler.handleGenerate(message({
        surroundingContext: { sourceReferences: [{ kind: 'context-attachment', attachmentId: 'ctx-9' }] }
      }));

      expect(generate).not.toHaveBeenCalled();
      expect(results()).toEqual([expect.objectContaining({
        ok: false, error: expect.stringMatching(/ctx-9.*no longer available/i)
      })]);
      expect(progress().at(-1)).toEqual(expect.objectContaining({ phase: 'completed' }));
      expect(handler.isGenerationActive()).toBe(false);
    });

    it('rejects an invalid request without calling the service', async () => {
      const { handler, generate, results } = build();

      await handler.handleGenerate(message({ invariants: { mustSurvive: '', mustNotChange: '' } }));

      expect(generate).not.toHaveBeenCalled();
      expect(results()[0]).toEqual(expect.objectContaining({
        ok: false, error: expect.stringMatching(/mustSurvive/)
      }));
    });
  });

  describe('progress', () => {
    it('reports the stage change and ends on a terminal completed phase with usage', async () => {
      const generate = jest.fn().mockImplementation(async (request) => {
        request.onToken(`${SHOW_VS_TELL_RESPONSE_START}${'x'.repeat(1_000)}`);
        return {
          ...settled(request),
          usage: { promptTokens: 100, completionTokens: 250, totalTokens: 350 }
        };
      });
      const { handler, progress, posted } = build({ generate });

      await handler.handleGenerate(message());

      const phases = progress();
      expect(phases[0]).toEqual(expect.objectContaining({
        phase: 'started', stage: 'requesting', workupId: ids[0], token: 'tok-1'
      }));
      expect(phases).toEqual(expect.arrayContaining([
        expect.objectContaining({ phase: 'streaming', stage: 'workup' })
      ]));
      expect(phases.at(-1)).toEqual(expect.objectContaining({
        phase: 'completed', stage: 'validating', completionTokens: 250
      }));
      // The terminal phase precedes the result so the webview can settle its busy state.
      const order = (type: MessageType) => posted(type).length;
      expect(order(MessageType.WORKSHOP_SHOW_VS_TELL_RESULT)).toBe(1);
    });

    it('never leaks raw model chunks in progress payloads', async () => {
      const generate = jest.fn().mockImplementation(async (request) => {
        request.onToken('SECRET-MODEL-TEXT'.repeat(100));
        return settled(request);
      });
      const { handler, progress } = build({ generate });

      await handler.handleGenerate(message());

      expect(JSON.stringify(progress())).not.toContain('SECRET-MODEL-TEXT');
    });

    it('ends a failed attempt with a terminal phase, then the error result', async () => {
      const generate = jest.fn().mockRejectedValue(new Error('The model returned an unusable Show vs. Tell workup (x).'));
      const { handler, progress, results } = build({ generate });

      await handler.handleGenerate(message());

      expect(progress().map((entry) => entry.phase)).toEqual(['started', 'completed']);
      expect(results()).toEqual([expect.objectContaining({
        token: 'tok-1', workupId: ids[0], ok: false, error: expect.stringMatching(/unusable Show vs\. Tell workup/)
      })]);
      expect(handler.isGenerationActive()).toBe(false);
    });
  });

  describe('cancellation and stale-result correlation', () => {
    it('aborts only the matching active token, in the show-vs-tell cancel domain', async () => {
      let signal: AbortSignal | undefined;
      const generate = jest.fn().mockImplementation((request) => {
        signal = request.signal;
        return new Promise((resolve) => request.signal.addEventListener('abort', () =>
          resolve({ cancelled: true })
        ));
      });
      const { handler, results, progress } = build({ generate });
      const pending = handler.handleGenerate(message());

      await handler.handleCancelGenerate(cancelMessage('other'));
      await handler.handleCancelGenerate(cancelMessage('tok-1', 'workshop-creative-variations'));
      expect(signal?.aborted).toBe(false);
      await handler.handleCancelGenerate(cancelMessage('tok-1'));
      await pending;

      expect(signal?.aborted).toBe(true);
      expect(results()).toEqual([]);
      expect(progress().at(-1)).toEqual(expect.objectContaining({
        phase: 'cancelled', token: 'tok-1', workupId: ids[0]
      }));
      expect(handler.isGenerationActive()).toBe(false);
    });

    it('never posts a late result for a cancelled attempt, even if abort loses the race', async () => {
      let resolveGenerate: (value: unknown) => void = () => undefined;
      const generate = jest.fn().mockImplementation(() => new Promise((resolve) => { resolveGenerate = resolve; }));
      const { handler, results, progress } = build({ generate });
      const pending = handler.handleGenerate(message());

      await handler.handleCancelGenerate(cancelMessage('tok-1'));
      resolveGenerate(settled({ workupId: ids[0] }));
      await pending;

      expect(results()).toEqual([]);
      expect(progress().map((entry) => entry.phase)).toEqual(['started', 'cancelled']);
    });

    it('never posts a late failure for a cancelled attempt', async () => {
      let rejectGenerate: (error: Error) => void = () => undefined;
      const generate = jest.fn().mockImplementation(() => new Promise((_resolve, reject) => { rejectGenerate = reject; }));
      const { handler, results } = build({ generate });
      const pending = handler.handleGenerate(message());

      await handler.handleCancelGenerate(cancelMessage('tok-1'));
      rejectGenerate(new Error('late provider failure'));
      await pending;

      expect(results()).toEqual([]);
    });

    it('supersedes: aborts the prior attempt, mints a fresh id, and posts only the new result', async () => {
      const signals: AbortSignal[] = [];
      let resolveFirst: (value: unknown) => void = () => undefined;
      const generate = jest.fn()
        .mockImplementationOnce((request) => {
          signals.push(request.signal);
          return new Promise((resolve) => { resolveFirst = resolve; });
        })
        .mockImplementationOnce(async (request) => {
          signals.push(request.signal);
          return settled(request);
        });
      const { handler, results, progress } = build({ generate });

      const first = handler.handleGenerate(message({ token: 'tok-old' }));
      const second = handler.handleGenerate(message({ token: 'tok-new' }));
      // The superseded provider call resolves late with a complete, valid workup.
      resolveFirst(settled({ workupId: ids[0] }));
      await Promise.all([first, second]);

      expect(signals[0].aborted).toBe(true);
      expect(signals[1].aborted).toBe(false);
      expect(generate.mock.calls.map(([request]) => request.workupId)).toEqual([ids[0], ids[1]]);
      expect(results()).toEqual([expect.objectContaining({
        token: 'tok-new', workupId: ids[1], ok: true
      })]);
      expect(progress().filter((entry) => entry.token === 'tok-old').map((entry) => entry.phase))
        .toEqual(['started', 'cancelled']);
      expect(progress().filter((entry) => entry.token === 'tok-new').at(-1))
        .toEqual(expect.objectContaining({ phase: 'completed' }));
    });

    it('drops a superseded late failure instead of reporting it as the current error', async () => {
      let rejectFirst: (error: Error) => void = () => undefined;
      const generate = jest.fn()
        .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }))
        .mockImplementationOnce(async (request) => settled(request));
      const { handler, results } = build({ generate });

      const first = handler.handleGenerate(message({ token: 'tok-old' }));
      const second = handler.handleGenerate(message({ token: 'tok-new' }));
      rejectFirst(new Error('stale failure'));
      await Promise.all([first, second]);

      expect(results()).toEqual([expect.objectContaining({ token: 'tok-new', ok: true })]);
    });

    it('does not let a superseded attempt report streaming progress as current', async () => {
      let emitFirst: (chunk: string) => void = () => undefined;
      let resolveFirst: (value: unknown) => void = () => undefined;
      const generate = jest.fn()
        .mockImplementationOnce((request) => {
          emitFirst = request.onToken;
          return new Promise((resolve) => { resolveFirst = resolve; });
        })
        .mockImplementationOnce(async (request) => settled(request));
      const { handler, progress } = build({ generate });
      const first = handler.handleGenerate(message({ token: 'tok-old' }));
      const second = handler.handleGenerate(message({ token: 'tok-new' }));

      emitFirst('x'.repeat(5_000));
      resolveFirst({ cancelled: true });
      await Promise.all([first, second]);

      expect(progress().filter((entry) => entry.token === 'tok-old' && entry.phase === 'streaming'))
        .toEqual([]);
    });

    it('never reuses a workup id across cancelled, failed, and successful attempts', async () => {
      const generate = jest.fn()
        .mockRejectedValueOnce(new Error('first fails'))
        .mockResolvedValueOnce({ cancelled: true })
        .mockImplementationOnce(async (request) => settled(request));
      const { handler, results, createWorkupId } = build({ generate });

      await handler.handleGenerate(message({ token: 'a' }));
      await handler.handleGenerate(message({ token: 'b' }));
      await handler.handleGenerate(message({ token: 'c' }));

      expect(generate.mock.calls.map(([request]) => request.workupId)).toEqual(ids);
      expect(createWorkupId).toHaveBeenCalledTimes(3);
      expect(results().map((entry) => entry.workupId)).toEqual([ids[0], ids[2]]);
    });

    it('treats a service-reported cancellation as silent, with no result', async () => {
      const generate = jest.fn().mockResolvedValue({ cancelled: true });
      const { handler, results } = build({ generate });

      await handler.handleGenerate(message());

      expect(results()).toEqual([]);
      expect(handler.isGenerationActive()).toBe(false);
    });

    it('aborts the active attempt on dispose', async () => {
      let signal: AbortSignal | undefined;
      const generate = jest.fn().mockImplementation((request) => {
        signal = request.signal;
        return new Promise((resolve) => request.signal.addEventListener('abort', () =>
          resolve({ cancelled: true })
        ));
      });
      const { handler, results } = build({ generate });
      const pending = handler.handleGenerate(message());

      handler.dispose();
      await pending;

      expect(signal?.aborted).toBe(true);
      expect(handler.isGenerationActive()).toBe(false);
      expect(results()).toEqual([]);
    });
  });

  describe('route registration', () => {
    it('registers exactly the generate and cancel routes', () => {
      const { handler } = build();
      const register = jest.fn();

      handler.registerRoutes({ register } as unknown as MessageRouter);

      expect(register.mock.calls.map(([type]) => type)).toEqual([
        MessageType.WORKSHOP_SHOW_VS_TELL_GENERATE,
        MessageType.CANCEL_SHOW_VS_TELL_GENERATE_REQUEST
      ]);
    });
  });
});
