import { DialogueMicrobeatAssistant } from '@/tools/assist/dialogueMicrobeatAssistant';
import { ProseAssistant } from '@/tools/assist/proseAssistant';
import { WritingToolsAssistant, WritingToolsFocus } from '@/tools/assist/writingToolsAssistant';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { resolvePassageRunPolicy } from '@/tools/assist/PromptedPassageAssistant';

const passage = {
  text: 'Mara set the cup down.',
  contextText: 'She has not slept.',
  sourceFileUri: 'file:///drafts/chapter-1.md'
};

const makeHarness = () => {
  const promptLoader = {
    loadSharedPrompts: jest.fn().mockResolvedValue('SHARED PROMPTS'),
    loadPrompts: jest.fn().mockImplementation(async (paths: string[]) => `PROMPTS: ${paths.join(' | ')}`)
  };
  const engine = {
    runInitial: jest.fn().mockResolvedValue({
      content: 'analysis', usedGuides: [], requestedResources: [], artifacts: []
    })
  };
  const guideCapability = { catalog: 'guides' as const };
  const output = { appendLine: jest.fn() };
  return { promptLoader, engine, guideCapability, output };
};

describe('passage assistant contracts', () => {
  it.each([
    [undefined, undefined, AGENT_RUN_POLICIES.assistant],
    [false, undefined, AGENT_RUN_POLICIES.assistantWithoutResources],
    [true, true, AGENT_RUN_POLICIES.workshopTool],
    [false, true, AGENT_RUN_POLICIES.workshopToolWithoutResources]
  ] as const)('resolves guide and retention policy dimensions independently', (includeCraftGuides, retainConversation, expected) => {
    expect(resolvePassageRunPolicy(includeCraftGuides, retainConversation)).toBe(expected);
  });

  it.each([
    ['dialogue', 'dialogue'],
    ['microbeats', 'microbeats'],
    ['both', 'both']
  ] as const)('keeps the Dialogue %s prompt profile and default run contract', async (focus, promptFocus) => {
    const { promptLoader, engine, guideCapability, output } = makeHarness();
    const assistant = new DialogueMicrobeatAssistant(engine as never, promptLoader as never, guideCapability as never, output as never);

    await assistant.analyze(passage, { focus });

    const request = engine.runInitial.mock.calls[0][0];
    expect(promptLoader.loadPrompts).toHaveBeenCalledWith([
      'dialog-microbeat-assistant/00-dialog-microbeat-assistant.md',
      'dialog-microbeat-assistant/01-dialogue-tags-and-microbeats.md',
      `dialog-microbeat-assistant/focus/${promptFocus}.md`
    ]);
    expect(request).toEqual(expect.objectContaining({
      toolName: 'dialogue-microbeat-assistant',
      policy: AGENT_RUN_POLICIES.assistant,
      capability: guideCapability,
      options: expect.objectContaining({ temperature: 0.7, maxTokens: 10000 })
    }));
    expect(request.systemMessage).toBe([
      'You are a creative writing assistant specializing in dialogue analysis.',
      'PROMPTS: dialog-microbeat-assistant/00-dialog-microbeat-assistant.md | dialog-microbeat-assistant/01-dialogue-tags-and-microbeats.md | dialog-microbeat-assistant/focus/' + promptFocus + '.md',
      'SHARED PROMPTS'
    ].join('\n\n---\n\n'));
    expect(request.userMessage).toContain('### Dialogue Passage');
    expect(request.userMessage).toContain(passage.text);
    expect(request.userMessage).toContain('Source File: file:///drafts/chapter-1.md');
    expect(request.userMessage).toContain('### Additional Context');
  });

  it('keeps the Prose prompt profile, message framing, and defaults', async () => {
    const { promptLoader, engine, guideCapability } = makeHarness();
    const assistant = new ProseAssistant(engine as never, promptLoader as never, guideCapability as never);

    await assistant.analyze(passage);

    const request = engine.runInitial.mock.calls[0][0];
    expect(promptLoader.loadPrompts).toHaveBeenCalledWith(['prose-assistant/00-prose-assistant.md']);
    expect(request).toEqual(expect.objectContaining({
      toolName: 'prose-assistant',
      policy: AGENT_RUN_POLICIES.assistant,
      capability: guideCapability,
      options: expect.objectContaining({ temperature: 0.7, maxTokens: 10000 })
    }));
    expect(request.systemMessage).toBe([
      'You are a creative writing assistant specializing in prose analysis and improvement.',
      'PROMPTS: prose-assistant/00-prose-assistant.md',
      'SHARED PROMPTS'
    ].join('\n\n---\n\n'));
    expect(request.userMessage).toContain('### Prose Passage');
    expect(request.userMessage).toContain('### Supplemental Context');
    expect(request.userMessage).toContain('Focus on voice, clarity, pacing, sensory detail');
  });

  const writingToolProfiles: ReadonlyArray<readonly [WritingToolsFocus, string, string]> = [
    ['cliche', 'identifying cliches, dead metaphors, and overused expressions', 'cliches, dead metaphors, stock phrases'],
    ['continuity', 'detecting scene continuity errors, choreography issues', 'continuity errors, choreography issues'],
    ['style', 'detecting stylistic drift, tense shifts, POV breaks', 'stylistic drift, tense shifts, POV breaks'],
    ['editor', 'copyeditor specializing in grammar, spelling, punctuation', 'grammar, spelling, punctuation, and mechanical errors'],
    ['fresh', 'reader engagement analysis', 'reader engagement: character depth, pacing, stakes'],
    ['repetition', 'detecting repetitive patterns', 'repetitive patterns: echo words, recycled metaphors'],
    ['decision-points', 'semantic gradient commitment', 'gradient commitment issues'],
    ['show-and-tell', 'dramatization balance', 'dramatization balance'],
    ['gestures', 'choreographic event generation', 'convert static descriptions into live choreographic events'],
    ['choreography', 'scene-wide choreography analysis', 'scene-wide choreography patterns'],
    ['stock-and-signature', 'cognitive economy analysis', 'cognitive economy: categorize each beat'],
    ['placeholders', 'bidirectional precision analysis', 'two directions: (1) SHARPEN']
  ];

  it.each(writingToolProfiles)('keeps the Writing Tools %s profile contract', async (focus, role, task) => {
    const { promptLoader, engine, guideCapability, output } = makeHarness();
    const assistant = new WritingToolsAssistant(engine as never, promptLoader as never, guideCapability as never, output as never);

    await assistant.analyze(passage, { focus });

    const request = engine.runInitial.mock.calls[0][0];
    expect(promptLoader.loadPrompts).toHaveBeenCalledWith([
      'writing-tools-assistant/00-writing-tools-base.md',
      `writing-tools-assistant/focus/${focus}.md`
    ]);
    expect(request).toEqual(expect.objectContaining({
      toolName: `writing-tools-${focus}`,
      policy: AGENT_RUN_POLICIES.assistant,
      capability: guideCapability,
      options: expect.objectContaining({ temperature: 0.7, maxTokens: 10000 })
    }));
    expect(request.systemMessage).toContain(role);
    expect(request.systemMessage).toContain('PROMPTS: writing-tools-assistant/00-writing-tools-base.md | writing-tools-assistant/focus/' + focus + '.md');
    expect(request.systemMessage).toContain('SHARED PROMPTS');
    expect(request.userMessage).toContain(task);
    expect(request.userMessage).toContain('### Passage to Analyze');
    expect(request.userMessage).toContain('### Supplemental Context');
  });

  it('resolves guides and retained policies independently without changing the Dialogue profile', async () => {
    const { promptLoader, engine, guideCapability, output } = makeHarness();
    const assistant = new DialogueMicrobeatAssistant(engine as never, promptLoader as never, guideCapability as never, output as never);
    const controller = new AbortController();
    const onToken = jest.fn();

    await assistant.analyze(passage, {
      focus: 'both', includeCraftGuides: false, retainConversation: true,
      temperature: 0.25, maxTokens: 321, signal: controller.signal, onToken
    });

    const request = engine.runInitial.mock.calls[0][0];
    expect(promptLoader.loadPrompts).toHaveBeenCalledWith([
      'dialog-microbeat-assistant/00-dialog-microbeat-assistant.md',
      'dialog-microbeat-assistant/01-dialogue-tags-and-microbeats.md',
      'dialog-microbeat-assistant/focus/both.md'
    ]);
    expect(request).toEqual(expect.objectContaining({
      policy: AGENT_RUN_POLICIES.workshopToolWithoutResources,
      capability: undefined,
      options: { temperature: 0.25, maxTokens: 321, signal: controller.signal, onToken }
    }));
  });

  it('uses the retained guide policy when a Writing Tools run keeps its conversation', async () => {
    const { engine, promptLoader, guideCapability, output } = makeHarness();
    const assistant = new WritingToolsAssistant(engine as never, promptLoader as never, guideCapability as never, output as never);

    await assistant.analyze(passage, { focus: 'editor', retainConversation: true });

    expect(engine.runInitial).toHaveBeenCalledWith(expect.objectContaining({
      policy: AGENT_RUN_POLICIES.workshopTool,
      capability: guideCapability
    }));
  });
});
