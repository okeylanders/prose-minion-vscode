import {
  WorkshopLexicalGravityHandler
} from '@/application/handlers/domain/workshop/widgets/lexicalGravity/WorkshopLexicalGravityHandler';
import {
  builtInLexicalGravityLens
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';
import { MessageType, WorkshopLexicalGravityLensCandidate } from '@messages';

const candidates = (): WorkshopLexicalGravityLensCandidate[] => {
  const source = builtInLexicalGravityLens('photography')!;
  return ['The hunt', 'The mews', 'The stoop'].map((variant, index) => ({
    candidateId: `falconry-${index + 1}`,
    lens: {
      ...source,
      slug: 'falconry',
      name: 'Falconry',
      source: 'project',
      variant
    }
  }));
};

describe('WorkshopLexicalGravityHandler generated-lens saves', () => {
  const buildMessage = {
    type: MessageType.WORKSHOP_BUILD_LEXICAL_GRAVITY_LENS,
    source: 'webview.test',
    timestamp: 1,
    payload: { token: 'build-1', query: 'falconry' }
  } as const;

  const createHandler = () => {
    const generated = candidates();
    const model = { buildLenses: jest.fn().mockResolvedValue(generated) };
    const repository = {
      findForQuery: jest.fn().mockResolvedValue(undefined),
      saveManyForQuery: jest.fn().mockResolvedValue([
        { ...generated[0].lens, slug: 'falconry' },
        { ...generated[2].lens, slug: 'falconry-the-stoop' }
      ]),
      availability: jest.fn().mockReturnValue({ displayPath: 'prose-minion/lenses' })
    };
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const handler = new WorkshopLexicalGravityHandler(
      {} as never,
      model as never,
      repository as never,
      {} as never,
      postMessage,
      { appendLine: jest.fn() } as never,
      { postSessionState: jest.fn(), postTurn: jest.fn(), markDirty: jest.fn() }
    );
    return { generated, handler, postMessage, repository };
  };

  it('forwards the writer-edited source through the bounded preview boundary', async () => {
    const resolvedLens = builtInLexicalGravityLens('photography')!;
    const draft = {
      lensSlug: 'photography',
      weight: 60,
      reach: 2 as const,
      metaphorPull: false,
      resolvedLens
    };
    const sourceText = 'Elias watched rain gather in the empty birdbath.';
    const model = {
      preview: jest.fn().mockResolvedValue({
        configKey: 'photography|60|2|0',
        sourceText,
        text: 'Elias framed the rain inside the birdbath.'
      })
    };
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const handler = new WorkshopLexicalGravityHandler(
      {} as never,
      model as never,
      {} as never,
      {} as never,
      postMessage,
      { appendLine: jest.fn() } as never,
      { postSessionState: jest.fn(), postTurn: jest.fn(), markDirty: jest.fn() }
    );

    await handler.handlePreview({
      type: MessageType.WORKSHOP_PREVIEW_LEXICAL_GRAVITY,
      source: 'webview.test',
      timestamp: 1,
      payload: { token: 'preview-1', draft, sourceText }
    });

    expect(model.preview).toHaveBeenCalledWith(
      expect.objectContaining({ lensSlug: 'photography' }),
      sourceText,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_LEXICAL_GRAVITY_PREVIEW_RESULT,
      payload: expect.objectContaining({ token: 'preview-1', ok: true })
    }));
  });

  it('resolves selected ids against host-owned candidates and saves one ordered batch', async () => {
    const { generated, handler, postMessage, repository } = createHandler();
    await handler.handleBuild(buildMessage);

    await handler.handleSave({
      type: MessageType.WORKSHOP_SAVE_LEXICAL_GRAVITY_LENSES,
      source: 'webview.test',
      timestamp: 2,
      payload: {
        token: 'build-1',
        query: 'falconry',
        candidateIds: ['falconry-3', 'falconry-1']
      }
    });

    expect(repository.saveManyForQuery).toHaveBeenCalledWith(
      'falconry',
      [generated[0].lens, generated[2].lens],
      { useCanonicalSlug: true }
    );
    expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_SAVED,
      payload: expect.objectContaining({
        ok: true,
        lenses: expect.any(Array),
        candidateIds: ['falconry-1', 'falconry-3'],
        remainingCandidateIds: ['falconry-2']
      })
    }));
  });

  it('retains unsaved generated takes for a second save without another model call', async () => {
    const { generated, handler, postMessage, repository } = createHandler();
    await handler.handleBuild(buildMessage);

    await handler.handleSave({
      type: MessageType.WORKSHOP_SAVE_LEXICAL_GRAVITY_LENSES,
      source: 'webview.test',
      timestamp: 2,
      payload: { token: 'build-1', query: 'falconry', candidateIds: ['falconry-1'] }
    });
    await handler.handleSave({
      type: MessageType.WORKSHOP_SAVE_LEXICAL_GRAVITY_LENSES,
      source: 'webview.test',
      timestamp: 3,
      payload: { token: 'build-1', query: 'falconry', candidateIds: ['falconry-2'] }
    });

    expect(repository.saveManyForQuery).toHaveBeenNthCalledWith(
      2,
      'falconry',
      [generated[1].lens],
      { useCanonicalSlug: false }
    );
    expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        ok: true,
        candidateIds: ['falconry-2'],
        remainingCandidateIds: ['falconry-3']
      })
    }));
  });

  it('rejects unknown or duplicated candidate ids without writing project files', async () => {
    const { handler, postMessage, repository } = createHandler();
    await handler.handleBuild(buildMessage);

    await handler.handleSave({
      type: MessageType.WORKSHOP_SAVE_LEXICAL_GRAVITY_LENSES,
      source: 'webview.test',
      timestamp: 2,
      payload: {
        token: 'build-1',
        query: 'falconry',
        candidateIds: ['falconry-1', 'falconry-1']
      }
    });

    expect(repository.saveManyForQuery).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_SAVED,
      payload: expect.objectContaining({ ok: false })
    }));
  });

  it('keeps the audited built-in when a project file claims the same slug', async () => {
    const source = builtInLexicalGravityLens('photography')!;
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const handler = new WorkshopLexicalGravityHandler(
      {} as never,
      {} as never,
      {
        list: jest.fn().mockResolvedValue([{
          ...source,
          source: 'project',
          name: 'Counterfeit Photography'
        }]),
        availability: jest.fn().mockReturnValue({ displayPath: 'prose-minion/lenses' })
      } as never,
      {} as never,
      postMessage,
      { appendLine: jest.fn() } as never,
      { postSessionState: jest.fn(), postTurn: jest.fn(), markDirty: jest.fn() }
    );

    await handler.handleRequestLenses({
      type: MessageType.WORKSHOP_REQUEST_LEXICAL_GRAVITY_LENSES,
      source: 'webview.test',
      timestamp: 1,
      payload: {}
    });

    const payload = postMessage.mock.calls[0][0].payload;
    expect(payload.lenses.find(({ slug }: { slug: string }) => slug === 'photography'))
      .toEqual(expect.objectContaining({ name: 'Photography', source: 'built-in' }));
  });

  it('logs successful install and idempotent removal lifecycle outcomes', async () => {
    const resolvedLens = builtInLexicalGravityLens('photography')!;
    const draft = {
      lensSlug: 'photography',
      weight: 60,
      reach: 2 as const,
      metaphorPull: false,
      resolvedLens
    };
    const config = {
      id: 'wc-1',
      widgetId: 'lexical-gravity' as const,
      revision: 1,
      directiveId: 'pd-1',
      createdAt: 1,
      draft
    };
    const appendLine = jest.fn();
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const directives = {
      apply: jest.fn().mockResolvedValue({
        action: 'installed',
        directiveId: 'pd-1',
        config,
        turn: { id: 'turn-1-system-1' }
      }),
      remove: jest.fn().mockResolvedValue({ removed: false })
    };
    const handler = new WorkshopLexicalGravityHandler(
      { getStandingDirective: jest.fn().mockReturnValue(undefined) } as never,
      {} as never,
      {} as never,
      directives as never,
      postMessage,
      { appendLine } as never,
      { postSessionState: jest.fn(), postTurn: jest.fn(), markDirty: jest.fn() }
    );

    await handler.handleApply({
      type: MessageType.WORKSHOP_APPLY_STANDING_WIDGET,
      source: 'webview.test',
      timestamp: 1,
      payload: { widgetId: 'lexical-gravity', draft }
    });
    await handler.handleRemove({
      type: MessageType.WORKSHOP_REMOVE_STANDING_WIDGET,
      source: 'webview.test',
      timestamp: 2,
      payload: { family: 'lexical-gravity' }
    });

    expect(appendLine).toHaveBeenCalledWith(expect.stringContaining(
      'lexical-gravity installed: pd-1 -> wc-1'
    ));
    expect(appendLine).toHaveBeenCalledWith(expect.stringContaining(
      'lexical-gravity remove no-op'
    ));
    expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ action: 'remove-standing', ok: true, removed: false })
    }));
  });
});
