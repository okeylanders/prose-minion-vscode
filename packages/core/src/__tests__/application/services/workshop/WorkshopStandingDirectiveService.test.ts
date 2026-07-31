import {
  WorkshopStandingDirectiveService
} from '@/application/services/workshop/directives/WorkshopStandingDirectiveService';
import {
  renderWorkshopStandingDirectiveFramesForSnapshots,
  renderWorkshopStandingDirectiveFramesFromState
} from '@/application/services/workshop/directives/WorkshopStandingDirectiveFrames';
import {
  buildLexicalGravityDirectiveFrame
} from '@/application/services/workshop/lexicalGravity/LexicalGravityDirective';
import {
  builtInLexicalGravityLens
} from '@/application/services/workshop/lexicalGravity/LexicalGravityLenses';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { parseWorkshopSessionStateV1 } from '@/application/services/workshop/WorkshopSessionStateV1';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  WorkshopLexicalGravityDraft
} from '@messages';

const draft = (
  lensSlug = 'photography',
  weight = 60,
  reach: 1 | 2 | 3 = 2
): WorkshopLexicalGravityDraft => ({
  lensSlug,
  weight,
  reach,
  metaphorPull: true,
  resolvedLens: builtInLexicalGravityLens(lensSlug)!
});

const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const applyLexicalGravity = (
  service: WorkshopStandingDirectiveService,
  nextDraft: WorkshopLexicalGravityDraft,
  widgetConfigId?: string
) => service.apply({ family: 'lexical-gravity', draft: nextDraft, widgetConfigId });

describe('WorkshopStandingDirectiveService', () => {
  it('stages first install until every retained prompt has been replaced', async () => {
    const session = new WorkshopSessionService(() => 100);
    const gate = deferred();
    const replaceStandingDirectiveFrames = jest.fn().mockReturnValue(gate.promise);
    const service = new WorkshopStandingDirectiveService(
      session,
      { replaceStandingDirectiveFrames } as never
    );

    const installing = applyLexicalGravity(service, draft());
    await Promise.resolve();
    await Promise.resolve();

    expect(replaceStandingDirectiveFrames).toHaveBeenCalledTimes(1);
    expect(session.getStandingDirectives()).toEqual([]);
    expect(session.getSnapshot().widgetConfigs).toEqual([]);

    gate.resolve();
    const result = await installing;

    expect(result).toEqual(expect.objectContaining({
      action: 'installed',
      directiveId: 'pd-1',
      config: expect.objectContaining({ id: 'wc-1', revision: 1 })
    }));
    expect(result.turn.content).toBe(
      'Lexical Gravity installed — Photography · 60% · 2° · metaphor'
    );
    expect(session.getStandingDirectives()).toEqual([
      expect.objectContaining({ id: 'pd-1', widgetConfigId: 'wc-1', revision: 1 })
    ]);
  });

  it('leaves no config or counter mutation when prompt replacement fails', async () => {
    const session = new WorkshopSessionService(() => 100);
    const replaceStandingDirectiveFrames = jest.fn()
      .mockRejectedValueOnce(new Error('provider refused replacement'))
      .mockResolvedValueOnce(undefined);
    const service = new WorkshopStandingDirectiveService(
      session,
      { replaceStandingDirectiveFrames } as never
    );

    await expect(applyLexicalGravity(service, draft())).rejects.toThrow(
      'provider refused replacement'
    );
    expect(session.getStandingDirectives()).toEqual([]);
    expect(session.getSnapshot().widgetConfigs).toEqual([]);

    const retry = await applyLexicalGravity(service, draft());
    expect(retry.config.id).toBe('wc-1');
    expect(retry.directiveId).toBe('pd-1');
  });

  it('serializes shifts, preserves identity, increments revision, and emits audit markers', async () => {
    const session = new WorkshopSessionService(() => 100);
    const replaceStandingDirectiveFrames = jest.fn().mockResolvedValue(undefined);
    const service = new WorkshopStandingDirectiveService(
      session,
      { replaceStandingDirectiveFrames } as never
    );
    const installed = await applyLexicalGravity(service, draft());

    const firstShift = applyLexicalGravity(
      service,
      draft('music', 40, 1),
      installed.config.id
    );
    const secondShift = applyLexicalGravity(
      service,
      draft('mathematics', 75, 3),
      installed.config.id
    );
    const [first, second] = await Promise.all([firstShift, secondShift]);

    expect(first.config).toEqual(expect.objectContaining({ id: 'wc-1', revision: 2 }));
    expect(second.config).toEqual(expect.objectContaining({ id: 'wc-1', revision: 3 }));
    expect(first.directiveId).toBe('pd-1');
    expect(second.directiveId).toBe('pd-1');
    expect(first.turn.content).toBe(
      'shifted — Photography · 60% · 2° · metaphor → Music · 40% · 1° · metaphor'
    );
    expect(second.turn.content).toBe(
      'shifted — Music · 40% · 1° · metaphor → Mathematics · 75% · 3° · metaphor'
    );
    expect(replaceStandingDirectiveFrames).toHaveBeenCalledTimes(3);

    const state = session.exportCommittedState();
    const restored = new WorkshopSessionService(() => 1000);
    restored.hydrateCommittedState(
      state,
      {},
      DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR
    );

    expect(restored.getStandingDirective('lexical-gravity')).toEqual(
      expect.objectContaining({ id: 'pd-1', revision: 3 })
    );
    expect(restored.getWidgetConfig('wc-1')).toEqual(
      expect.objectContaining({ id: 'wc-1', revision: 3 })
    );
  });

  it('kills the directive between runs and keeps the historical config addressable', async () => {
    const session = new WorkshopSessionService(() => 100);
    const replaceStandingDirectiveFrames = jest.fn().mockResolvedValue(undefined);
    const service = new WorkshopStandingDirectiveService(
      session,
      { replaceStandingDirectiveFrames } as never
    );
    const installed = await applyLexicalGravity(service, draft());

    const removal = await service.remove('lexical-gravity');

    expect(removal.removed).toBe(true);
    expect(removal.turn?.content).toBe(
      'Lexical Gravity removed — the passage stops gravitating'
    );
    expect(session.getStandingDirectives()).toEqual([]);
    expect(session.getWidgetConfig(installed.config.id)).toBeDefined();
    expect(replaceStandingDirectiveFrames).toHaveBeenLastCalledWith([]);
  });

  it('refuses install while a Workshop response is active', async () => {
    const session = new WorkshopSessionService(() => 100);
    session.setSessionScope('open');
    session.beginPersonaMessage('active-request', 'Keep talking.');
    const replaceStandingDirectiveFrames = jest.fn().mockResolvedValue(undefined);
    const service = new WorkshopStandingDirectiveService(
      session,
      { replaceStandingDirectiveFrames } as never
    );

    await expect(applyLexicalGravity(service, draft())).rejects.toThrow(
      'A Workshop response is still running.'
    );
    expect(replaceStandingDirectiveFrames).not.toHaveBeenCalled();
  });

  it('reconstructs the exact bounded frame from persisted session truth', async () => {
    const session = new WorkshopSessionService(() => 100);
    const service = new WorkshopStandingDirectiveService(
      session,
      { replaceStandingDirectiveFrames: jest.fn().mockResolvedValue(undefined) } as never
    );
    await applyLexicalGravity(service, draft());
    const state = session.exportCommittedState();

    const frames = renderWorkshopStandingDirectiveFramesFromState(state);

    expect(frames).toHaveLength(1);
    expect(frames[0]).toBe(buildLexicalGravityDirectiveFrame(
      state.standingDirectives![0],
      draft()
    ));
    expect(frames[0]).toContain('Keep it dormant during analysis, critique, planning');
    expect(frames[0]).toContain('Degree 2:');
    expect(frames[0]).not.toContain('Degree 3:');
  });

  it('preserves prepared directive order in the shared live/restore renderer', () => {
    const directives = [
      {
        id: 'pd-1', family: 'lexical-gravity' as const, widgetId: 'lexical-gravity' as const,
        widgetConfigId: 'wc-1', revision: 1, updatedAt: 1
      },
      {
        id: 'pd-2', family: 'lexical-gravity' as const, widgetId: 'lexical-gravity' as const,
        widgetConfigId: 'wc-2', revision: 1, updatedAt: 2
      }
    ];
    const configs = new Map([
      ['wc-1', { widgetId: 'lexical-gravity' as const, draft: draft('music') }],
      ['wc-2', { widgetId: 'lexical-gravity' as const, draft: draft('mathematics') }]
    ]);

    const frames = renderWorkshopStandingDirectiveFramesForSnapshots(
      directives,
      (configId) => configs.get(configId) as never
    );

    expect(frames[0]).toContain('id="pd-1"');
    expect(frames[0]).toContain('Lens: Music');
    expect(frames[1]).toContain('id="pd-2"');
    expect(frames[1]).toContain('Lens: Mathematics');
  });

  it.each([
    {
      label: 'revision drift',
      mutate: (state: ReturnType<WorkshopSessionService['exportCommittedState']>) => {
        state.standingDirectives![0].revision += 1;
      },
      message: /invalid config linkage/
    },
    {
      label: 'an unlinked config directive id',
      mutate: (state: ReturnType<WorkshopSessionService['exportCommittedState']>) => {
        state.widgetConfigs![0].directiveId = 'pd-2';
      },
      message: /invalid config linkage/
    },
    {
      label: 'family and widget divergence',
      mutate: (state: ReturnType<WorkshopSessionService['exportCommittedState']>) => {
        state.standingDirectives![0].widgetId = 'prose-controller';
      },
      message: /invalid config linkage/
    },
    {
      label: 'a duplicate family',
      mutate: (state: ReturnType<WorkshopSessionService['exportCommittedState']>) => {
        state.standingDirectives!.push({ ...state.standingDirectives![0], id: 'pd-2' });
      },
      message: /Duplicate persisted Workshop standing family/
    },
    {
      label: 'a trailing counter',
      mutate: (state: ReturnType<WorkshopSessionService['exportCommittedState']>) => {
        state.counters.standingDirective = 0;
      },
      message: /standing-directive counter trails/
    }
  ])('rejects persisted standing state with $label', async ({ mutate, message }) => {
    const session = new WorkshopSessionService(() => 100);
    const service = new WorkshopStandingDirectiveService(
      session,
      { replaceStandingDirectiveFrames: jest.fn().mockResolvedValue(undefined) } as never
    );
    await applyLexicalGravity(service, draft());
    const state = session.exportCommittedState();

    mutate(state);

    expect(() => parseWorkshopSessionStateV1(state)).toThrow(message);
  });
});
