import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { ConversationManager } from '@orchestration/ConversationManager';
import { GuideCapability } from '@orchestration/capabilities/GuideCapability';
import { ContextFileCapability } from '@orchestration/capabilities/ContextFileCapability';
import { ContextAssistant } from '@/tools/assist/contextAssistant';
import { DialogueMicrobeatAssistant } from '@/tools/assist/dialogueMicrobeatAssistant';
import { ProseAssistant } from '@/tools/assist/proseAssistant';
import { WritingToolsAssistant } from '@/tools/assist/writingToolsAssistant';

const stream = async function* (tokens: string[]) {
  for (const token of tokens) {
    yield { token, done: false };
  }
  yield {
    token: '',
    done: true,
    finishReason: 'stop',
    usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 }
  };
};

const promptLoader = {
  loadSharedPrompts: jest.fn().mockResolvedValue('Shared prompt'),
  loadPrompts: jest.fn().mockResolvedValue('Tool prompt')
};
const settings = { get: jest.fn((_section, _key, fallback) => fallback) };
const guidePath = 'scene-example-guides/campfire-stories.md';

describe('capability-enabled assistant routes', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['Dialogue', 'Prose', 'Writing Tools editor'] as const)(
    '%s hides a valid guide request and progressively streams final prose',
    async route => {
      const finalResponse = `Final prose for ${route}, streamed normally after the hidden guide request.`;
      const client = {
        createChatCompletion: jest.fn(),
        createStreamingChatCompletion: jest.fn()
          .mockReturnValueOnce(stream([
            '<prose-minion-tool-call name="resource.read"><paths>',
            `<path>${guidePath}</path>`,
            '</paths></prose-minion-tool-call>'
          ]))
          .mockReturnValueOnce(stream([
            `Final prose for ${route}, `,
            'streamed normally ',
            'after the hidden guide request.'
          ]))
      };
      const engine = new AgentRunEngine(client as never, new ConversationManager());
      const registry = {
        listAvailableGuides: jest.fn().mockResolvedValue([
          { path: guidePath, displayName: 'Campfire Stories', category: 'Scene Examples' }
        ]),
        formatGuideListForPrompt: jest.fn().mockReturnValue(`## Available Craft Guides\n\n- \`${guidePath}\``)
      };
      const loader = { loadGuide: jest.fn().mockResolvedValue('Guide evidence') };
      const capability = new GuideCapability(registry as never, loader as never, settings as never);
      const visible: string[] = [];

      try {
        const input = { text: 'Mara set the cup down.', contextText: 'She has not slept.' };
        const options = { onToken: (token: string) => visible.push(token) };
        const result = route === 'Dialogue'
          ? await new DialogueMicrobeatAssistant(engine, promptLoader as never, capability).analyze(input, { ...options, focus: 'both' })
          : route === 'Prose'
            ? await new ProseAssistant(engine, promptLoader as never, capability).analyze(input, options)
            : await new WritingToolsAssistant(engine, promptLoader as never, capability).analyze(input, { ...options, focus: 'editor' });

        expect(result.content).toBe(finalResponse);
        expect(result.usedGuides).toEqual([guidePath]);
        expect(visible.join('')).toBe(finalResponse);
        expect(visible.length).toBeGreaterThan(1);
        expect(visible.join('')).not.toContain('prose-minion-tool-call');
        expect(loader.loadGuide).toHaveBeenCalledWith(guidePath);
      } finally {
        engine.dispose();
      }
    }
  );

  it('Context corrects an unauthorized opaque key, then loads and hides the valid request', async () => {
    const contextPath = 'project/characters/mara.md';
    const invalidRequest = '<prose-minion-tool-call name="resource.read"><paths><path>Mara.md</path></paths></prose-minion-tool-call>';
    const validRequest = `<prose-minion-tool-call name="resource.read"><paths><path>${contextPath}</path></paths></prose-minion-tool-call>`;
    const client = {
      createChatCompletion: jest.fn(),
      createStreamingChatCompletion: jest.fn()
        .mockReturnValueOnce(stream([invalidRequest]))
        .mockReturnValueOnce(stream([validRequest]))
        .mockReturnValueOnce(stream([
          'Final context briefing, ',
          'streamed normally after ',
          'the corrected hidden request.'
        ]))
    };
    const engine = new AgentRunEngine(client as never, new ConversationManager());
    const provider = {
      listResources: jest.fn().mockReturnValue([
        { group: 'characters', path: contextPath, label: 'Mara' }
      ]),
      loadResources: jest.fn().mockResolvedValue([
        { group: 'characters', path: contextPath, label: 'Mara', content: 'Mara is exhausted.' }
      ])
    };
    const capability = new ContextFileCapability(provider as never, settings as never);
    const visible: string[] = [];

    try {
      const result = await new ContextAssistant(engine, promptLoader as never).generate(
        { excerpt: 'Mara set the cup down.', requestedGroups: ['characters'] },
        { capability, onToken: token => visible.push(token) }
      );

      expect(result.content).toBe('Final context briefing, streamed normally after the corrected hidden request.');
      expect(result.requestedResources).toEqual([contextPath]);
      expect(visible.join('')).toBe(result.content);
      expect(visible.length).toBeGreaterThan(1);
      expect(visible.join('')).not.toContain('prose-minion-tool-call');
      expect(provider.loadResources).toHaveBeenCalledWith([contextPath]);
      expect(client.createStreamingChatCompletion).toHaveBeenCalledTimes(3);
    } finally {
      engine.dispose();
    }
  });
});
