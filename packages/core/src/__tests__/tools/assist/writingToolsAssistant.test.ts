import { WritingToolsAssistant, WritingToolsFocus } from '@/tools/assist/writingToolsAssistant';

describe('WritingToolsAssistant', () => {
  const promptLoader = {
    loadSharedPrompts: jest.fn().mockResolvedValue('Shared prompts content'),
    loadPrompts: jest.fn().mockResolvedValue('Tool prompts content')
  };
  const engine = {
    runInitial: jest.fn().mockResolvedValue({
      content: 'Analysis result content', usedGuides: [], requestedResources: [], artifacts: []
    })
  };
  const guides = { catalog: 'guides' };
  const output = { appendLine: jest.fn() };
  let assistant: WritingToolsAssistant;

  beforeEach(() => {
    jest.clearAllMocks();
    assistant = new WritingToolsAssistant(engine as never, promptLoader as never, (() => guides) as never, output as never);
  });

  it.each<WritingToolsFocus>(['cliche', 'continuity', 'style', 'editor', 'fresh', 'repetition', 'craft-steering'])(
    'declares the guides policy for %s',
    async focus => {
      const result = await assistant.analyze({ text: 'Test passage' }, { focus });
      expect(result.content).toBe('Analysis result content');
      expect(engine.runInitial).toHaveBeenCalledWith(expect.objectContaining({
        toolName: `writing-tools-${focus}`,
        policy: expect.objectContaining({ capabilityCatalog: 'guides' }),
        capability: guides
      }));
    }
  );

  it('switches to the explicit none policy when guides are disabled', async () => {
    await assistant.analyze({ text: 'Test passage' }, { focus: 'editor', includeCraftGuides: false });
    expect(engine.runInitial).toHaveBeenCalledWith(expect.objectContaining({
      policy: expect.objectContaining({ capabilityCatalog: 'none' }),
      capability: undefined
    }));
  });

  it('retains a usable Craft Steering analysis when prompt resources cannot load', async () => {
    promptLoader.loadPrompts.mockRejectedValueOnce(new Error('Resource unavailable'));
    const passage = 'Rain tapped the roof. Then it stopped.';

    const result = await assistant.analyze(
      { text: passage, contextText: 'A deliberate pause before the visitor arrives.' },
      { focus: 'craft-steering', includeCraftGuides: false }
    );

    expect(result.content).toBe('Analysis result content');
    const request = engine.runInitial.mock.calls[0][0];
    expect(request.toolName).toBe('writing-tools-craft-steering');
    expect(request.systemMessage).toContain('# Craft Steering Analysis');
    expect(request.systemMessage).toContain('Trace how one sentence prepares the next.');
    expect(request.systemMessage).toContain('forward movement does not require constant speed');
    expect(request.systemMessage).toContain('What to Preserve');
    expect(request.systemMessage).toContain('Sample Revisions');
    expect(request.systemMessage).toContain('9. Creative variations');
    expect(request.systemMessage).toContain('10. Bound creative variations');
    expect(request.systemMessage).toContain('original already works');
    expect(request.systemMessage).toContain('Shared prompts content');
    expect(request.userMessage).toContain(passage);
    expect(request.userMessage).toContain('A deliberate pause before the visitor arrives.');
    expect(request.capability).toBeUndefined();
  });

  it('preserves prompt and streaming inputs in the run request', async () => {
    const onToken = jest.fn();
    const signal = new AbortController().signal;
    await assistant.analyze(
      { text: 'Test passage', contextText: 'Additional context', sourceFileUri: 'file:///chapter.md' },
      { focus: 'style', temperature: 0.9, maxTokens: 5000, onToken, signal }
    );
    const request = engine.runInitial.mock.calls[0][0];
    expect(request.userMessage).toContain('Additional context');
    expect(request.userMessage).toContain('file:///chapter.md');
    expect(request.options).toEqual(expect.objectContaining({ temperature: 0.9, maxTokens: 5000, onToken, signal }));
    expect(promptLoader.loadPrompts).toHaveBeenCalledWith([
      'writing-tools-assistant/00-writing-tools-base.md',
      'writing-tools-assistant/focus/style.md'
    ]);
  });
});
