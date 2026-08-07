import {
  LexicalGravityModelService
} from '@services/widgets/LexicalGravityModelService';
import {
  lexicalGravityConfigKey
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec';
import {
  builtInLexicalGravityLens,
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const candidate = (variant: string) => ({
  ...builtInLexicalGravityLens('photography')!,
  variant,
  description: `${variant} pressure`
});

const buildResponse = [
  '===LEXICAL_GRAVITY_LENSES_V2===',
  JSON.stringify({
    version: 2,
    candidates: [candidate('Technical'), candidate('Domestic'), candidate('Cosmic')]
  }),
  '===END_LEXICAL_GRAVITY_LENSES_V2==='
].join('\n');

const previewBody = (
  text = 'The room held its breath in a minor cadence.',
  overrides: Record<string, unknown> = {}
) => ({
  version: 2,
  semanticPositions: [{
    element: 'the room',
    roleId: 'rest',
    axisId: 'time',
    axisPosition: 'suspended after the expected answer',
    significance: 'The missing reply becomes active pressure.'
  }],
  selectedDynamicId: 'hold-rest',
  openEntailment: 'The next speaker must answer the silence before the old rhythm resumes.',
  text,
  ...overrides
});

const previewResponse = (body = previewBody()) => [
  '===LEXICAL_GRAVITY_PREVIEW_V2===',
  JSON.stringify(body),
  '===END_LEXICAL_GRAVITY_PREVIEW_V2==='
].join('\n');

const createService = (content: unknown) => {
  const runInitial = jest.fn().mockResolvedValue({
    content,
    rawContent: content,
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
  });
  const manager = { getEngine: jest.fn().mockReturnValue({ runInitial }) };
  const promptLoader = { loadPrompts: jest.fn().mockResolvedValue('lexical system prompt') };
  const appendLine = jest.fn();
  return {
    service: new LexicalGravityModelService(
      manager as never,
      promptLoader as never,
      { appendLine } as never
    ),
    manager,
    promptLoader,
    runInitial,
    appendLine
  };
};

const musicDraft = () => ({
  lensSlug: 'music',
  applicationMode: 'recompose' as const,
  weight: 40,
  reach: 2 as const,
  metaphorPull: false,
  resolvedLens: builtInLexicalGravityLens('music')!
});

describe('LexicalGravityModelService', () => {
  it('builds exactly three validated v2 project candidates through the widget scope', async () => {
    const { service, manager, promptLoader, runInitial } = createService(buildResponse);

    const result = await service.buildLenses('Radio Astronomy');

    expect(manager.getEngine).toHaveBeenCalledWith('widget');
    expect(promptLoader.loadPrompts).toHaveBeenCalledWith([
      'lexical-gravity/00-build-lens.md'
    ]);
    expect(runInitial).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'lexical-gravity-build',
      userMessage: expect.stringMatching(/interpretive-grammar takes[\s\S]*"Radio Astronomy"/),
      options: expect.objectContaining({
        temperature: 0.75,
        maxTokens: PROMPT_BUDGETS.workshopWidgets.lexicalBuildOutputTokens
      })
    }));
    expect(result.map((item) => item.candidateId)).toEqual([
      'radio-astronomy-1', 'radio-astronomy-2', 'radio-astronomy-3'
    ]);
    expect(result.every(({ lens }) => lens.version === 2 && lens.source === 'project'))
      .toBe(true);
    expect(result.every(({ lens }) => lens.logic.dynamics.length > 0)).toBe(true);
  });

  it('returns strict semantic positioning, one dynamic, open entailment, and prose', async () => {
    const body = previewBody('"Wait," she said. The unanswered note held.');
    const { service, promptLoader, runInitial } = createService(previewResponse(body));
    const draft = musicDraft();
    const sourceText = 'The room waited beneath the quiet rafters.';

    await expect(service.preview(draft, sourceText)).resolves.toEqual({
      ...body,
      configKey: lexicalGravityConfigKey(draft),
      sourceText
    });
    expect(promptLoader.loadPrompts).toHaveBeenCalledWith([
      'lexical-gravity/01-preview.md'
    ]);
    expect(runInitial).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'lexical-gravity-preview',
      userMessage: expect.stringMatching(
        /"applicationMode": "recompose"[\s\S]*"The room waited beneath the quiet rafters\."[\s\S]*sentinel-framed Preview v2 JSON/
      ),
      options: expect.objectContaining({
        temperature: 0.55,
        maxTokens: PROMPT_BUDGETS.workshopWidgets.lexicalPreviewOutputTokens,
        reasoning: { effort: 'low' }
      })
    }));
  });

  it('accepts an honest semantic no-op', async () => {
    const body = previewBody('The room waited.', {
      semanticPositions: [],
      selectedDynamicId: null,
      openEntailment: null
    });

    await expect(createService(previewResponse(body)).service.preview(
      musicDraft(),
      'The room waited.'
    )).resolves.toMatchObject(body);
  });

  it('fails closed on undeclared semantic references and wrapper prose', async () => {
    const undeclared = previewBody('The room waited.', { selectedDynamicId: 'develop' });
    const rejected = createService(previewResponse(undeclared));
    await expect(rejected.service.preview(musicDraft(), 'The room waited.'))
      .rejects.toThrow('selected widget model did not return a usable preview');
    expect(rejected.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('selectedDynamicId must be an id declared by the selected lens')
    );

    const wrapped = createService(`Here is the result:\n${previewResponse()}`);
    await expect(wrapped.service.preview(musicDraft(), 'The room waited.'))
      .rejects.toThrow('selected widget model did not return a usable preview');
    expect(wrapped.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('response sentinels must be the first and last lines')
    );
  });

  it('logs and translates a provider response without the required protocol', async () => {
    const malformed = createService(null);

    await expect(malformed.service.preview(musicDraft(), 'A bell rang.'))
      .rejects.toThrow('selected widget model did not return a usable preview');
    expect(malformed.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('response sentinels must appear exactly once')
    );
  });

  it('rejects truncated Preview JSON instead of caching an incomplete artifact', async () => {
    const truncated = createService(previewResponse());
    truncated.runInitial.mockResolvedValueOnce({
      content: previewResponse(),
      rawContent: previewResponse(),
      finishReason: 'length'
    });

    await expect(truncated.service.preview(musicDraft(), 'A bell rang.'))
      .rejects.toThrow('selected widget model did not return a usable preview');
    expect(truncated.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('response reached its output limit')
    );
  });

  it('fails closed on lens wrapper prose, duplicate variants, and output truncation', async () => {
    const wrapperProse = `Here you go!\n${buildResponse}`;
    const rejected = createService(wrapperProse);
    await expect(rejected.service.buildLenses('Light'))
      .rejects.toThrow('unusable interpretive lenses');
    expect(rejected.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('response sentinels must be the first and last lines')
    );

    const duplicateVariants = [
      '===LEXICAL_GRAVITY_LENSES_V2===',
      JSON.stringify({
        version: 2,
        candidates: [candidate('Same'), candidate('Same'), candidate('Other')]
      }),
      '===END_LEXICAL_GRAVITY_LENSES_V2==='
    ].join('\n');
    await expect(createService(duplicateVariants).service.buildLenses('Light'))
      .rejects.toThrow('unusable interpretive lenses');

    const truncated = createService(buildResponse);
    truncated.runInitial.mockResolvedValueOnce({
      content: buildResponse,
      finishReason: 'length'
    });
    await expect(truncated.service.buildLenses('Light')).rejects.toThrow('output limit');
  });
});
