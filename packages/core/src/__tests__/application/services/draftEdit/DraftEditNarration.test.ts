/**
 * The narration baseline in a run (Draft Edit Slice 3b; ADR 2026-10-21,
 * Amendment 2026-10-26): measured over the whole document, a selection
 * run's too, and sent beside every chunk; a tagger that fails to load sends
 * none, and the run goes on. Text is public-domain *Alice*; nothing reaches
 * a provider.
 */
import * as narrationBaseline from '@/utils/proofread/narrationBaseline';
import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { DraftEditUseCase, type ProofreadPassPort } from '@/application/services/draftEdit/DraftEditUseCase';
import type { ProofreadRunRequest } from '@services/proofread/ProofreadService';
import { FakeAnnotations, FakeDocuments } from '@/__tests__/application/services/draftEdit/fakeDocuments';
import { ALICE_CATERPILLAR_SINGLE_QUOTED, ALICE_THIRD_PAST } from '@/__tests__/utils/proofread/narrationFixtures';

const CHAPTER = `${ALICE_THIRD_PAST}\n\n${ALICE_CATERPILLAR_SINGLE_QUOTED}`;

function proofreader(text = CHAPTER) {
  const document = new FakeDocuments(text);
  const requests: ProofreadRunRequest[] = [];
  const pass: ProofreadPassPort = {
    proofread: jest.fn(async (request: ProofreadRunRequest) => {
      requests.push(request);
      return { kind: 'completed' as const, chunks: request.chunks.map(() => ({ kind: 'read' as const, findings: [], malformed: 0 })) };
    })
  };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const useCase = new DraftEditUseCase(pass, document, new FakeAnnotations(document), new DraftEditApplier(document), log);
  const target = (range?: { start: number; end: number }) => ({ ...document.snapshot(), relativePath: 'chapter-01.md', ...(range ? { range } : {}) });
  return { useCase, requests, log, target };
}

afterEach(() => jest.restoreAllMocks());

describe('The narration baseline in a run (Slice 3b)', () => {
  it('sends the whole document\'s narration with a selection of nothing but single-quoted speech', async () => {
    const { useCase, requests, target } = proofreader();
    const speech = { start: CHAPTER.indexOf("'Who are you?'"), end: CHAPTER.length };

    await expect(useCase.run(target(speech), { kind: 'proofread', output: 'flag' })).resolves.toMatchObject({ kind: 'completed' });

    expect(requests).toHaveLength(1);
    expect(requests[0].chunks.join('')).not.toContain('Alice was beginning');
    expect(requests[0].narration).toEqual({ tense: 'past', person: 'third' });
  });

  it('sends no narration when the document\'s is not clear', async () => {
    const { useCase, requests, target } = proofreader(ALICE_CATERPILLAR_SINGLE_QUOTED);
    await useCase.run(target(), { kind: 'proofread', output: 'flag' });

    expect(requests[0]).not.toHaveProperty('narration');
  });

  it('runs without a baseline when the tagger cannot load, and says so in the log only', async () => {
    jest.spyOn(narrationBaseline, 'measureNarrationBaseline').mockImplementation(() => {
      throw new Error('Cannot find module \'wink-pos-tagger\'');
    });
    const { useCase, requests, log, target } = proofreader();

    await expect(useCase.run(target(), { kind: 'proofread', output: 'flag' })).resolves.toMatchObject({ kind: 'completed' });

    expect(requests[0]).not.toHaveProperty('narration');
    expect(log.appendLine).toHaveBeenCalledWith('[DraftEdit] Proofread chapter-01.md: no narration baseline (Cannot find module \'wink-pos-tagger\')');
  });
});
