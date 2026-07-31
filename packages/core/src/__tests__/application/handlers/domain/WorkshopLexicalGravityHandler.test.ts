import {
  WorkshopLexicalGravityHandler
} from '@/application/handlers/domain/WorkshopLexicalGravityHandler';
import {
  builtInLexicalGravityLens
} from '@/application/services/workshop/lexicalGravity/LexicalGravityLenses';
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
      [generated[0].lens, generated[2].lens]
    );
    expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_SAVED,
      payload: expect.objectContaining({ ok: true, lenses: expect.any(Array) })
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
});
