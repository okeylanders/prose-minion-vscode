import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  CreativeVariationsService,
  type CreativeVariationsGenerationRequest
} from '@services/widgets/creativeVariations/CreativeVariationsService';
import {
  CREATIVE_VARIATIONS_RANDOM_AIM
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsDerivations';

const response = (): string => [
  '===CREATIVE_VARIATIONS_V1===',
  JSON.stringify({
    version: 1,
    cards: [1, 2, 3].map((position) => ({
      position,
      approach: `Approach ${position}`,
      direction: `Take the scene through distinct direction ${position}.`,
      prose: `Mara makes distinct choice ${position} before she answers her brother.`,
      tradeoff: { gain: `Gain ${position}`, cost: `Cost ${position}` },
      invariantFlags: []
    }))
  }),
  '===END_CREATIVE_VARIATIONS_V1==='
].join('\n');

const request = (): CreativeVariationsGenerationRequest => ({
  workupId: 'cvw-00000000-0000-4000-8000-000000000001',
  subject: { text: 'Mara folded the letter.', provenance: { kind: 'pasted' } },
  surroundingContext: { writerText: 'Her brother waits.', sourceReferences: [] },
  invariants: { mustSurvive: 'Mara delays her answer.', mustNotChange: '' },
  intent: { kind: 'custom-aim', aim: 'Make the delay active.', distance: 'tail' },
  requestedCount: 3,
  sourceMaterials: []
});

const build = (provider = {
  cancelled: false,
  content: response(),
  rawContent: response(),
  finishReason: 'stop',
  usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 }
}) => {
  const runInitial = jest.fn().mockResolvedValue(provider);
  const getEngine = jest.fn().mockReturnValue({ runInitial });
  const loadPrompts = jest.fn().mockResolvedValue('creative variations prompt');
  const capture = jest.fn().mockResolvedValue({
    filePath: '/workspace/recovery/creative.response.txt',
    toolName: 'creative-variations',
    storageScope: 'project'
  });
  const present = jest.fn().mockResolvedValue(undefined);
  const appendLine = jest.fn();
  const service = new CreativeVariationsService(
    { getEngine } as never,
    { loadPrompts } as never,
    { capture },
    { present },
    { appendLine } as never
  );
  return { service, runInitial, getEngine, loadPrompts, capture, present };
};

describe('CreativeVariationsService', () => {
  it('loads the prompt pair and settles one quality-first widget call', async () => {
    const { service, runInitial, getEngine, loadPrompts } = build();
    const onToken = jest.fn();
    const result = await service.generate({ ...request(), onToken });

    expect(getEngine).toHaveBeenCalledWith('widget');
    expect(loadPrompts).toHaveBeenCalledWith([
      'creative-variations/00-creative-variations.md',
      'creative-variations/01-creative-variations-example.md'
    ]);
    expect(runInitial).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'creative-variations',
      systemMessage: 'creative variations prompt',
      userMessage: expect.stringContaining('"requestedCount": 3'),
      options: expect.objectContaining({
        temperature: 0.7,
        maxTokens: PROMPT_BUDGETS.workshopWidgets.creativeOutputTokens,
        onToken
      })
    }));
    expect(result).toEqual(expect.objectContaining({
      cancelled: false,
      truncated: false,
      workup: expect.objectContaining({
        workupId: request().workupId,
        cards: expect.any(Array)
      })
    }));
  });

  it('returns provider cancellation without attempting to decode', async () => {
    const { service, capture } = build({ cancelled: true } as never);
    await expect(service.generate(request())).resolves.toEqual({ cancelled: true });
    expect(capture).not.toHaveBeenCalled();
  });

  it('normalizes a blank aim for direct host callers and keeps blank invariants empty', async () => {
    const { service, runInitial } = build();
    const minimal = request();
    minimal.invariants = { mustSurvive: '', mustNotChange: '' };
    minimal.intent = { ...minimal.intent, aim: '' };

    await service.generate(minimal);

    const userMessage = runInitial.mock.calls[0][0].userMessage as string;
    expect(userMessage).toContain(`"aim": "${CREATIVE_VARIATIONS_RANDOM_AIM}"`);
    expect(userMessage).toContain('"mustSurvive": ""');
    expect(userMessage).toContain('"mustNotChange": ""');
  });

  it('rejects malformed input before acquiring an engine or spending tokens', async () => {
    const { service, getEngine, runInitial } = build();
    const invalid = request();
    invalid.subject.text = '  ';
    await expect(service.generate(invalid)).rejects.toThrow(/subject.text.*non-empty string/);
    expect(getEngine).not.toHaveBeenCalled();
    expect(runInitial).not.toHaveBeenCalled();
  });

  it('rejects a non-host workup identity before provider spend', async () => {
    const { service, getEngine } = build();
    const invalid = request();
    invalid.workupId = 'model-chosen-id';
    await expect(service.generate(invalid)).rejects.toThrow(/host-minted cvw-<UUID>/);
    expect(getEngine).not.toHaveBeenCalled();
  });

  it('bounds writer context and resolved source bodies as one prompt allowance', async () => {
    const { service, getEngine } = build();
    const invalid = request();
    invalid.surroundingContext.writerText = 'x'.repeat(
      PROMPT_BUDGETS.workshopWidgets.creativeContextCharacters
    );
    invalid.surroundingContext.sourceReferences = [{ kind: 'active-excerpt' }];
    invalid.sourceMaterials = [{
      reference: { kind: 'active-excerpt' },
      label: 'Active excerpt',
      content: 'y'
    }];
    await expect(service.generate(invalid)).rejects.toThrow(/combined surrounding context exceeds/i);
    expect(getEngine).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed protocol', { cancelled: false, content: 'not framed', rawContent: 'not framed', finishReason: 'stop' }, /unusable Creative Variations/],
    ['token truncation', { cancelled: false, content: response(), rawContent: response(), finishReason: 'length' }, /output ceiling/]
  ])('quarantines a completed paid response rejected for %s', async (
    _label,
    provider,
    expected
  ) => {
    const { service, capture, present } = build(provider as never);
    await expect(service.generate(request())).rejects.toThrow(expected);
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'creative-variations',
      requestSummary: 'Generate 3 Creative Variations at tail distance',
      rawResponse: provider.rawContent
    }));
    expect(present).toHaveBeenCalled();
  });
});
