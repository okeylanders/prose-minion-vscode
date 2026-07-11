import { ContextAssistantService } from '@services/analysis/ContextAssistantService';

jest.mock('@/infrastructure/context/ContextResourceResolver', () => ({
  ContextResourceResolver: jest.fn().mockImplementation(() => ({
    createProvider: jest.fn().mockResolvedValue({
      listResources: jest.fn().mockReturnValue([]),
      loadResources: jest.fn().mockResolvedValue([])
    })
  }))
}));

describe('ContextAssistantService', () => {
  const engine = {
    runInitial: jest.fn().mockResolvedValue({
      content: 'brief', usedGuides: [], requestedResources: [], artifacts: [], usage: undefined
    })
  };
  const aiResourceManager = {
    ensureInitialized: jest.fn().mockResolvedValue(undefined),
    getEngine: jest.fn().mockReturnValue(engine),
    createContextFileCapability: jest.fn().mockReturnValue({ catalog: 'projectContext' })
  };
  const resourceLoader = {
    getPromptLoader: jest.fn().mockReturnValue({
      loadSharedPrompts: jest.fn().mockResolvedValue('shared'),
      loadPrompts: jest.fn().mockResolvedValue('context prompt')
    })
  };
  const toolOptions = { getOptions: jest.fn().mockReturnValue({ temperature: 0.7, maxTokens: 1000 }) };
  const settings = { get: jest.fn((_section: string, _key: string, fallback: unknown) => fallback) };
  const workspace = {};

  const makeService = (fileSystem: { readFile: jest.Mock }) => new ContextAssistantService(
    aiResourceManager as never,
    resourceLoader as never,
    toolOptions as never,
    settings as never,
    fileSystem as never,
    workspace as never
  );

  beforeEach(() => {
    engine.runInitial.mockClear();
  });

  it('bounds an oversized source document to the shared 50k-word evidence cap', async () => {
    const oversized = 'word '.repeat(50_500);
    const fileSystem = { readFile: jest.fn().mockResolvedValue(Buffer.from(oversized, 'utf8')) };

    const result = await makeService(fileSystem).generateContext({
      excerpt: 'The excerpt.',
      sourceFileUri: 'file:///drafts/chapter-1.md'
    } as never);

    expect(result.content).toBe('brief');
    const userMessage: string = engine.runInitial.mock.calls[0][0].userMessage;
    expect(userMessage).toContain('## Source Document');
    expect(userMessage).toContain('source document trimmed to 50000 words');
    const sourceWordCount = (userMessage.match(/\bword\b/g) ?? []).length;
    expect(sourceWordCount).toBeLessThanOrEqual(50_000);
  });

  it('tells the model when a configured source file could not be read', async () => {
    const fileSystem = { readFile: jest.fn().mockRejectedValue(new Error('ENOENT: missing chapter')) };

    await makeService(fileSystem).generateContext({
      excerpt: 'The excerpt.',
      sourceFileUri: 'file:///drafts/deleted-chapter.md'
    } as never);

    const userMessage: string = engine.runInitial.mock.calls[0][0].userMessage;
    expect(userMessage).toContain('## Source Document');
    expect(userMessage).toContain('could not be read (ENOENT: missing chapter)');
    expect(userMessage).toContain('Note this gap in the briefing');
  });
});
