import {
  LexicalGravityModelService
} from '@services/widgets/LexicalGravityModelService';
import {
  lexicalGravityConfigKey
} from '@/application/services/workshop/lexicalGravity/LexicalGravityConfigCodec';
import {
  builtInLexicalGravityLens,
} from '@/application/services/workshop/lexicalGravity/LexicalGravityLenses';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const candidate = (variant: string) => ({
  ...builtInLexicalGravityLens('photography')!,
  variant,
  description: `${variant} pressure`
});

const buildResponse = [
  '===LEXICAL_GRAVITY_LENSES_V1===',
  JSON.stringify({
    version: 1,
    candidates: [candidate('Technical'), candidate('Domestic'), candidate('Cosmic')]
  }),
  '===END_LEXICAL_GRAVITY_LENSES_V1==='
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

describe('LexicalGravityModelService', () => {
  it('builds exactly three validated project candidates through the widget scope', async () => {
    const { service, manager, promptLoader, runInitial } = createService(buildResponse);

    const result = await service.buildLenses('Radio Astronomy');

    expect(manager.getEngine).toHaveBeenCalledWith('widget');
    expect(promptLoader.loadPrompts).toHaveBeenCalledWith([
      'lexical-gravity/00-build-lens.md'
    ]);
    expect(runInitial).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'lexical-gravity-build',
      userMessage: expect.stringContaining('"Radio Astronomy"'),
      options: expect.objectContaining({
        temperature: 0.75,
        maxTokens: PROMPT_BUDGETS.workshopWidgets.lexicalBuildOutputTokens
      })
    }));
    expect(result).toHaveLength(3);
    expect(result.map((item) => item.candidateId)).toEqual([
      'radio-astronomy-1', 'radio-astronomy-2', 'radio-astronomy-3'
    ]);
    expect(result.every((item) => item.lens.source === 'project')).toBe(true);
  });

  it('previews one exact config and returns the source beside its transformed prose', async () => {
    const previewText = 'The room held its breath in a minor cadence.';
    const { service, promptLoader, runInitial } = createService(previewText);
    const draft = {
      lensSlug: 'music',
      weight: 40,
      reach: 2 as const,
      metaphorPull: false,
      resolvedLens: builtInLexicalGravityLens('music')!
    };

    const sourceText = 'The room waited beneath the quiet rafters.';
    await expect(service.preview(draft, sourceText)).resolves.toEqual({
      configKey: lexicalGravityConfigKey(draft),
      sourceText,
      text: previewText
    });
    expect(promptLoader.loadPrompts).toHaveBeenCalledWith([
      'lexical-gravity/01-preview.md'
    ]);
    expect(runInitial).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'lexical-gravity-preview',
      userMessage: expect.stringMatching(
        new RegExp(`${JSON.stringify(sourceText).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*Return only the rewritten passage\\.`)
      ),
      options: expect.objectContaining({
        temperature: 0.55,
        maxTokens: PROMPT_BUDGETS.workshopWidgets.lexicalPreviewOutputTokens,
        reasoning: { effort: 'low' }
      })
    }));
  });

  it('normalizes returned prose without requiring a model-authored protocol', async () => {
    const sourceText = 'A bell moved through the empty house.';
    const plain = createService(
      '\r\nThe bell tolled through the house in a minor interval.\r\n'
    );
    const draft = {
      lensSlug: 'music',
      weight: 40,
      reach: 2 as const,
      metaphorPull: false,
      resolvedLens: builtInLexicalGravityLens('music')!
    };

    await expect(plain.service.preview(draft, sourceText)).resolves.toEqual({
      configKey: lexicalGravityConfigKey(draft),
      sourceText,
      text: 'The bell tolled through the house in a minor interval.'
    });
  });

  it('logs and translates a provider response without final text', async () => {
    const malformed = createService(null);
    const draft = {
      lensSlug: 'music',
      weight: 40,
      reach: 2 as const,
      metaphorPull: false,
      resolvedLens: builtInLexicalGravityLens('music')!
    };

    await expect(malformed.service.preview(draft, 'A bell rang.'))
      .rejects.toThrow('selected widget model did not return a usable preview');
    expect(malformed.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('response did not contain text')
    );
  });

  it('rejects truncated preview prose instead of caching an incomplete passage', async () => {
    const truncated = createService('The bell tolled through');
    truncated.runInitial.mockResolvedValueOnce({
      content: 'The bell tolled through',
      rawContent: 'The bell tolled through',
      finishReason: 'length'
    });
    const draft = {
      lensSlug: 'music',
      weight: 40,
      reach: 2 as const,
      metaphorPull: false,
      resolvedLens: builtInLexicalGravityLens('music')!
    };

    await expect(truncated.service.preview(draft, 'A bell rang.'))
      .rejects.toThrow('selected widget model did not return a usable preview');
    expect(truncated.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('response reached its output limit')
    );
  });

  it('fails closed on wrapper prose, duplicate variants, and output truncation', async () => {
    const wrapperProse = `Here you go!\n${buildResponse}`;
    const rejected = createService(wrapperProse);
    await expect(rejected.service.buildLenses('Light'))
      .rejects.toThrow('unusable lexical fields');
    expect(rejected.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('response sentinels must be the first and last lines')
    );
    expect(rejected.appendLine).toHaveBeenCalledWith([
      '[LexicalGravityModelService] Rejected lens response body BEGIN',
      wrapperProse,
      '[LexicalGravityModelService] Rejected lens response body END'
    ].join('\n'));

    const duplicateVariants = [
      '===LEXICAL_GRAVITY_LENSES_V1===',
      JSON.stringify({
        version: 1,
        candidates: [candidate('Same'), candidate('Same'), candidate('Other')]
      }),
      '===END_LEXICAL_GRAVITY_LENSES_V1==='
    ].join('\n');
    await expect(createService(duplicateVariants).service.buildLenses('Light'))
      .rejects.toThrow('unusable lexical fields');

    const truncated = createService(buildResponse);
    truncated.runInitial.mockResolvedValueOnce({
      content: buildResponse,
      finishReason: 'length'
    });
    await expect(truncated.service.buildLenses('Light')).rejects.toThrow('output limit');
  });
});
