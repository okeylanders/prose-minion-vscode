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
      model as never,
      repository as never,
      postMessage,
      { appendLine: jest.fn() } as never
    );
    return { generated, handler, postMessage, repository };
  };

  it('forwards the writer-edited source through the bounded preview boundary', async () => {
    const resolvedLens = builtInLexicalGravityLens('photography')!;
    const draft = {
      lensSlug: 'photography',
      applicationMode: 'recompose' as const,
      evidenceMode: 'blend' as const,
      weight: 60,
      reach: 2 as const,
      metaphorPull: false,
      resolvedLens
    };
    const sourceText = 'Elias watched rain gather in the empty birdbath.';
    const model = {
      preview: jest.fn().mockResolvedValue({
        version: 2,
        configKey: 'photography|recompose|60|2|0',
        sourceText,
        semanticPositions: [],
        selectedDynamicId: null,
        openEntailment: null,
        text: 'Elias framed the rain inside the birdbath.'
      })
    };
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const handler = new WorkshopLexicalGravityHandler(
      model as never,
      {} as never,
      postMessage,
      { appendLine: jest.fn() } as never
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

  it('correlates a rebuild target and replaces exactly one verified v1 resource', async () => {
    const generated = candidates();
    const replacement = {
      ...generated[1].lens,
      slug: 'legacy-falconry',
      source: 'project' as const
    };
    const model = { buildLenses: jest.fn().mockResolvedValue(generated) };
    const repository = {
      assertIncompatibleResource: jest.fn().mockResolvedValue({
        resourceName: 'legacy-falconry.json',
        foundVersion: 1,
        rebuildQuery: 'falconry',
        message: 'Rebuild it.'
      }),
      replaceIncompatibleForQuery: jest.fn().mockResolvedValue(replacement),
      availability: jest.fn().mockReturnValue({ displayPath: 'prose-minion/lenses' })
    };
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const handler = new WorkshopLexicalGravityHandler(
      model as never,
      repository as never,
      postMessage,
      { appendLine: jest.fn() } as never
    );

    await handler.handleBuild({
      ...buildMessage,
      payload: {
        ...buildMessage.payload,
        rebuildResourceName: 'legacy-falconry.json'
      }
    });
    await handler.handleSave({
      type: MessageType.WORKSHOP_SAVE_LEXICAL_GRAVITY_LENSES,
      source: 'webview.test',
      timestamp: 2,
      payload: { token: 'build-1', query: 'falconry', candidateIds: ['falconry-2'] }
    });

    expect(repository.assertIncompatibleResource)
      .toHaveBeenCalledWith('legacy-falconry.json');
    expect(repository.replaceIncompatibleForQuery).toHaveBeenCalledWith(
      'legacy-falconry.json',
      'falconry',
      generated[1].lens
    );
    expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        ok: true,
        lenses: [replacement],
        candidateIds: ['falconry-2'],
        remainingCandidateIds: [],
        replacedResourceName: 'legacy-falconry.json'
      })
    }));
  });

  it('does not let multiple generated takes overwrite one legacy resource', async () => {
    const generated = candidates();
    const model = { buildLenses: jest.fn().mockResolvedValue(generated) };
    const repository = {
      assertIncompatibleResource: jest.fn().mockResolvedValue({
        resourceName: 'legacy-falconry.json',
        foundVersion: 1,
        rebuildQuery: 'falconry',
        message: 'Rebuild it.'
      }),
      replaceIncompatibleForQuery: jest.fn(),
      availability: jest.fn().mockReturnValue({ displayPath: 'prose-minion/lenses' })
    };
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const handler = new WorkshopLexicalGravityHandler(
      model as never,
      repository as never,
      postMessage,
      { appendLine: jest.fn() } as never
    );
    await handler.handleBuild({
      ...buildMessage,
      payload: { ...buildMessage.payload, rebuildResourceName: 'legacy-falconry.json' }
    });

    await handler.handleSave({
      type: MessageType.WORKSHOP_SAVE_LEXICAL_GRAVITY_LENSES,
      source: 'webview.test',
      timestamp: 2,
      payload: {
        token: 'build-1',
        query: 'falconry',
        candidateIds: ['falconry-1', 'falconry-2']
      }
    });

    expect(repository.replaceIncompatibleForQuery).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        ok: false,
        error: expect.stringMatching(/exactly one generated take/)
      })
    }));
  });

  it('refuses to rebuild a v1 resource whose replacement would be hidden by a built-in', async () => {
    const generated = candidates();
    const model = { buildLenses: jest.fn().mockResolvedValue(generated) };
    const repository = {
      assertIncompatibleResource: jest.fn().mockResolvedValue({
        resourceName: 'photography.json',
        foundVersion: 1,
        rebuildQuery: 'photography',
        message: 'Rebuild it.'
      })
    };
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const handler = new WorkshopLexicalGravityHandler(
      model as never,
      repository as never,
      postMessage,
      { appendLine: jest.fn() } as never
    );

    await handler.handleBuild({
      ...buildMessage,
      payload: {
        ...buildMessage.payload,
        query: 'photography',
        rebuildResourceName: 'photography.json'
      }
    });

    expect(model.buildLenses).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        ok: false,
        error: expect.stringMatching(/collides with a built-in.*will not be overwritten/i)
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
      {
        list: jest.fn().mockResolvedValue({
          lenses: [{
            ...source,
            source: 'project',
            name: 'Counterfeit Photography'
          }],
          incompatibleResources: []
        }),
        availability: jest.fn().mockReturnValue({ displayPath: 'prose-minion/lenses' })
      } as never,
      postMessage,
      { appendLine: jest.fn() } as never
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

  it('forwards actionable incompatible project resources with the lens catalog', async () => {
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const incompatibility = {
      resourceName: 'old-lens.json',
      foundVersion: 1,
      rebuildQuery: 'old lens',
      message: 'Regenerate this version 1 lens with Build lens.'
    };
    const handler = new WorkshopLexicalGravityHandler(
      {} as never,
      {
        list: jest.fn().mockResolvedValue({
          lenses: [],
          incompatibleResources: [incompatibility]
        }),
        availability: jest.fn().mockReturnValue({ displayPath: 'prose-minion/lenses' })
      } as never,
      postMessage,
      { appendLine: jest.fn() } as never
    );

    await handler.handleRequestLenses({
      type: MessageType.WORKSHOP_REQUEST_LEXICAL_GRAVITY_LENSES,
      source: 'webview.test',
      timestamp: 1,
      payload: {}
    });

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ incompatibleResources: [incompatibility] })
    }));
  });

});
