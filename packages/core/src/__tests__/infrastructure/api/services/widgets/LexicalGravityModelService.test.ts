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
  const capture = jest.fn().mockResolvedValue({
    filePath: '/workspace/prose-minion/recovery/model-responses/rejected.response.txt',
    toolName: 'lexical-gravity-build',
    storageScope: 'project'
  });
  const present = jest.fn().mockResolvedValue(undefined);
  return {
    service: new LexicalGravityModelService(
      manager as never,
      promptLoader as never,
      { capture },
      { present },
      { appendLine } as never
    ),
    manager,
    promptLoader,
    runInitial,
    appendLine,
    capture,
    present
  };
};

const musicDraft = () => ({
  lensSlug: 'music',
  applicationMode: 'recompose' as const,
  evidenceMode: 'blend' as const,
  weight: 40,
  reach: 2 as const,
  metaphorPull: false,
  resolvedLens: builtInLexicalGravityLens('music')!
});

describe('LexicalGravityModelService', () => {
  it('builds exactly three validated v2 project candidates through the widget scope', async () => {
    const { service, manager, promptLoader, runInitial } = createService(buildResponse);

    const { candidates: result, note } = await service.buildLenses('Radio Astronomy');
    expect(note).toBeUndefined();

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

  it('reads a no-op preview that leaves its empty fields out as empty', async () => {
    const { service, appendLine, capture } = createService(previewResponse(
      { version: 2, text: 'The room waited.' } as never
    ));

    await expect(service.preview(musicDraft(), 'The room waited.')).resolves.toMatchObject({
      semanticPositions: [],
      selectedDynamicId: null,
      openEntailment: null,
      text: 'The room waited.'
    });
    expect(capture).not.toHaveBeenCalled();
    expect(appendLine).toHaveBeenCalledWith(
      '[LexicalGravityModelService] Preview reply left out 3 empty field(s) '
      + '(semanticPositions, selectedDynamicId, openEntailment); read as empty.'
    );
  });

  it('reads a position that leaves out its axis as on no axis', async () => {
    const body = previewBody();
    const { axisId: _axisId, axisPosition: _axisPosition, ...position } =
      body.semanticPositions[0];
    const { service } = createService(previewResponse(
      { ...body, semanticPositions: [position] } as never
    ));

    const preview = await service.preview(musicDraft(), 'The room waited.');

    expect(preview.semanticPositions).toEqual([
      { ...position, axisId: null, axisPosition: null }
    ]);
  });

  it('still rejects a preview missing its text, or carrying an unknown field', async () => {
    const { text: _text, ...withoutText } = previewBody();
    await expect(createService(previewResponse(withoutText as never)).service.preview(
      musicDraft(),
      'The room waited.'
    )).rejects.toThrow(/usable preview/);
    await expect(createService(previewResponse(
      previewBody('The room waited.', { score: 1 })
    )).service.preview(musicDraft(), 'The room waited.')).rejects.toThrow(/usable preview/);
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

  it('tells the writer when a rejected preview could not be saved', async () => {
    const rejected = createService('not the preview protocol');
    rejected.capture.mockResolvedValueOnce(undefined);

    await expect(rejected.service.preview(musicDraft(), 'A bell rang.'))
      .rejects.toThrow('complete response could not be saved');
    expect(rejected.present).not.toHaveBeenCalled();
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

  it('fails closed on lens wrapper prose, no usable lens, and output truncation', async () => {
    const wrapperProse = `Here you go!\n${buildResponse}`;
    const rejected = createService(wrapperProse);
    await expect(rejected.service.buildLenses('Light'))
      .rejects.toThrow('/workspace/prose-minion/recovery/model-responses/rejected.response.txt');
    expect(rejected.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('response sentinels must be the first and last lines')
    );
    expect(rejected.capture).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'lexical-gravity-build',
      rawResponse: wrapperProse,
      finishReason: 'stop'
    }));
    expect(rejected.present).toHaveBeenCalledWith(expect.objectContaining({
      filePath: '/workspace/prose-minion/recovery/model-responses/rejected.response.txt'
    }));

    const noUsableLens = [
      '===LEXICAL_GRAVITY_LENSES_V2===',
      JSON.stringify({
        version: 2,
        candidates: [{ ...candidate('Same'), name: '' }, { ...candidate('Other'), name: '' }]
      }),
      '===END_LEXICAL_GRAVITY_LENSES_V2==='
    ].join('\n');
    await expect(createService(noUsableLens).service.buildLenses('Light'))
      .rejects.toThrow('unusable interpretive lenses');

    const truncated = createService(buildResponse);
    truncated.runInitial.mockResolvedValueOnce({
      content: buildResponse,
      finishReason: 'length'
    });
    await expect(truncated.service.buildLenses('Light')).rejects.toThrow('output limit');
  });

  describe('reading model JSON through the shared repair', () => {
    const frame = (body: string) => [
      '===LEXICAL_GRAVITY_LENSES_V2===', body, '===END_LEXICAL_GRAVITY_LENSES_V2==='
    ].join('\n');
    const takes = () => [
      candidate('Down the Rabbit-Hole'), candidate('A Mad Tea-Party'), candidate('The Croquet-Ground')
    ];
    const body = (candidates: unknown[] = takes()) => JSON.stringify({ version: 2, candidates });
    const logged = (appendLine: jest.Mock): string =>
      appendLine.mock.calls.map(([line]) => String(line)).join('\n');
    /** The model's slip in the lens named: attention closed after foregrounds, a brace too many after backgrounds. */
    const slip = (text: string, variant: string): string => {
      const seam = '],"backgrounds":';
      const at = text.indexOf(seam, text.indexOf(variant));
      return `${text.slice(0, at)}]},"backgrounds":${text.slice(at + seam.length)}`;
    };

    it('reads a fenced lens reply with a trailing comma, and logs each repair by kind', async () => {
      const fenced = ['```json', body().replace(/\}\]\}$/u, '},]}'), '```'].join('\n');
      const { service, appendLine, capture } = createService(frame(fenced));

      const { candidates, note } = await service.buildLenses('Wonderland');

      expect(candidates.map((item) => item.lens.variant)).toEqual([
        'Down the Rabbit-Hole', 'A Mad Tea-Party', 'The Croquet-Ground'
      ]);
      expect(note).toBeUndefined();
      expect(capture).not.toHaveBeenCalled();
      expect(appendLine.mock.calls).toEqual([[
        '[LexicalGravityModelService] Lens reply JSON repaired: code-fence, trailing-comma.'
      ]]);
    });

    it('keeps all three lenses when two closed attention early, and logs the repair as its own kind', async () => {
      const written = slip(slip(body(), 'The Croquet-Ground'), 'A Mad Tea-Party');
      expect(() => JSON.parse(written)).toThrow();
      const { service, appendLine, capture } = createService(frame(written));

      const { candidates, note } = await service.buildLenses('Wonderland');

      expect(candidates.map((item) => item.candidateId)).toEqual([
        'wonderland-1', 'wonderland-2', 'wonderland-3'
      ]);
      expect(candidates.map((item) => item.lens.logic.attention)).toEqual(
        takes().map((lens) => lens.logic.attention)
      );
      expect(note).toBeUndefined();
      expect(capture).not.toHaveBeenCalled();
      expect(appendLine.mock.calls).toEqual([[
        '[LexicalGravityModelService] Lens reply JSON repaired: early-closed-attention '
        + '(2 attention object(s) closed again).'
      ]]);
    });

    it('keeps the lenses that can be used when one cannot, with a note and counts only in the log', async () => {
      const [first, second, third] = takes();
      const unusable = { ...second, name: '' };
      const { service, appendLine, capture } = createService(frame(body([first, unusable, third])));

      const { candidates, note } = await service.buildLenses('Wonderland');

      // Each kept lens keeps the place the reply gave it.
      expect(candidates.map((item) => item.candidateId)).toEqual(['wonderland-1', 'wonderland-3']);
      expect(candidates.map((item) => item.lens.variant)).toEqual([
        'Down the Rabbit-Hole', 'The Croquet-Ground'
      ]);
      expect(note).toBe("1 of 3 lenses couldn't be used.");
      expect(capture).not.toHaveBeenCalled();
      expect(appendLine.mock.calls).toEqual([[
        '[LexicalGravityModelService] Lens reply held 3 lens(es) for an ask of 3; kept 2 '
        + '(invalid 1, variant missing or repeated 0, past the ask 0).'
      ]]);
      expect(logged(appendLine)).not.toMatch(/Rabbit|Tea-Party|Croquet|Wonderland/);
    });

    it('leaves out a lens that repeats a variant, and reads a reply short of the ask', async () => {
      const [first, , third] = takes();
      const repeated = createService(frame(body([first, { ...third, variant: ' down the rabbit-hole' }, third])));
      const kept = await repeated.service.buildLenses('Wonderland');
      expect(kept.candidates.map((item) => item.candidateId)).toEqual(['wonderland-1', 'wonderland-3']);
      expect(kept.note).toBe("1 of 3 lenses couldn't be used.");
      expect(logged(repeated.appendLine)).toContain('variant missing or repeated 1');

      const short = createService(frame(body([first])));
      const one = await short.service.buildLenses('Wonderland');
      expect(one.candidates).toHaveLength(1);
      expect(one.note).toBe("2 of 3 lenses couldn't be used.");
    });

    it('reads no lens past the ask, and says nothing when the ask is met', async () => {
      const { service, appendLine } = createService(frame(body([...takes(), candidate('Who Stole the Tarts?')])));

      const { candidates, note } = await service.buildLenses('Wonderland');

      expect(candidates).toHaveLength(PROMPT_BUDGETS.workshopWidgets.lexicalBuildCandidates);
      expect(note).toBeUndefined();
      expect(logged(appendLine)).toContain('held 4 lens(es) for an ask of 3; kept 3');
    });

    it('still rejects a reply whose JSON no repair can read, and one with no lens at all', async () => {
      const broken = createService(frame(body().replace('"candidates":[', '"candidates":[}')));
      await expect(broken.service.buildLenses('Wonderland')).rejects.toThrow('unusable interpretive lenses');
      expect(broken.capture).toHaveBeenCalledWith(expect.objectContaining({
        rejection: expect.stringMatching(/^The JSON is invalid/)
      }));

      const empty = createService(frame(body([])));
      await expect(empty.service.buildLenses('Wonderland')).rejects.toThrow('expected exactly 3 candidates');
    });

    it('reads a fenced preview with a trailing comma, and logs each repair by kind', async () => {
      const fenced = ['```json', JSON.stringify(previewBody()).replace(/\}$/u, ',}'), '```'].join('\n');
      const { service, appendLine, capture } = createService([
        '===LEXICAL_GRAVITY_PREVIEW_V2===', fenced, '===END_LEXICAL_GRAVITY_PREVIEW_V2==='
      ].join('\n'));

      const preview = await service.preview(musicDraft(), 'The room waited beneath the quiet rafters.');

      expect(preview.text).toBe('The room held its breath in a minor cadence.');
      expect(capture).not.toHaveBeenCalled();
      expect(appendLine.mock.calls).toEqual([[
        '[LexicalGravityModelService] Preview reply JSON repaired: code-fence, trailing-comma.'
      ]]);
    });
  });
});
