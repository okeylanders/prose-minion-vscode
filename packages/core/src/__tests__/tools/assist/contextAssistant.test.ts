import { ContextAssistant } from '@/tools/assist/contextAssistant';
import { ContextFileCapability } from '@orchestration/capabilities/ContextFileCapability';

describe('ContextAssistant', () => {
  it('keeps the full source document as one semantic input and leaves project catalog protocol to its capability', async () => {
    const promptLoader = {
      loadSharedPrompts: jest.fn().mockResolvedValue('shared prompt'),
      loadPrompts: jest.fn().mockResolvedValue('context prompt')
    };
    const engine = {
      runInitial: jest.fn().mockResolvedValue({ content: 'brief', requestedResources: [], usage: undefined })
    };
    const provider = {
      listResources: jest.fn().mockReturnValue([{ group: 'projectBrief', path: 'story.md', label: 'Story' }]),
      loadResources: jest.fn()
    };
    const settings = { get: jest.fn((_section, _key, fallback) => fallback) };
    const capability = new ContextFileCapability(provider as never, settings as never);
    const assistant = new ContextAssistant(engine as never, promptLoader as never);
    const sourceContent = 'First source line.\n\nLast source line.\n';

    await assistant.generate({
      excerpt: 'The chosen excerpt.',
      existingContext: 'The user context.',
      sourceFileUri: 'file:///drafts/chapter-1.md',
      sourceContent,
      requestedGroups: ['projectBrief']
    }, { capability });

    const request = engine.runInitial.mock.calls[0][0];
    expect(request.userMessage.match(/## Source Document/g)).toHaveLength(1);
    expect(request.userMessage).toContain(sourceContent);
    expect(request.userMessage).not.toContain('## Available Project Resources');
    expect(request.userMessage).not.toContain('Resource Request Protocol');

    const initialMessage = await capability.appendContract(request.userMessage);
    expect(initialMessage.match(/## Available Project Resources/g)).toHaveLength(1);
    expect(initialMessage.match(/## Resource Request Protocol/g)).toHaveLength(1);
    expect(initialMessage.match(/<prose-minion-tool-call name="resource.read">/g)).toHaveLength(1);
  });
});
