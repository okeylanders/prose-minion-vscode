import { DictionaryUtility } from '@/tools/utility/dictionaryUtility';

describe('DictionaryUtility', () => {
  it('includes the Special Focus contract in the system prompt fallback', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const executeWithoutCapabilities = jest.fn().mockResolvedValue({
      content: '# Result',
      usage: undefined,
      finishReason: 'stop'
    });

    const utility = new DictionaryUtility(
      { executeWithoutCapabilities } as any,
      {
        loadSharedPrompts: jest.fn().mockResolvedValue('shared-prompts'),
        loadPrompts: jest.fn().mockRejectedValue(new Error('missing prompt files'))
      } as any
    );

    await utility.lookup({
      word: 'crash',
      contextText: 'Need a sound word for a pencil cup tipping over.'
    });

    const [, systemMessage, userMessage] = executeWithoutCapabilities.mock.calls[0];

    expect(systemMessage).toContain('Special Focus');
    expect(systemMessage).toContain('context or author notes are provided');
    expect(userMessage).toContain('Contextual Excerpt:');
    expect(userMessage).toContain('Need a sound word for a pencil cup tipping over.');

    warnSpy.mockRestore();
  });
});
