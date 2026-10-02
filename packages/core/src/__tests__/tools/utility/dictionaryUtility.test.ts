import { DictionaryUtility } from '@/tools/utility/dictionaryUtility';
import * as fs from 'fs';
import * as path from 'path';

const PROMPT_ROOT = path.resolve(__dirname, '../../../../resources/system-prompts');

describe('DictionaryUtility', () => {
  it.each(['bundled', 'fallback'] as const)('includes topic families in the %s lookup instructions', async (mode) => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const runInitial = jest.fn().mockResolvedValue({ content: '# Result' });
    const utility = new DictionaryUtility(
      { runInitial } as never,
      {
        loadSharedPrompts: async () => '',
        loadPrompts: async (paths: string[]) => {
          if (mode === 'fallback') {
            throw new Error('missing prompt files');
          }
          return paths.map((file) => fs.readFileSync(path.join(PROMPT_ROOT, file), 'utf8')).join('\n\n');
        }
      } as never
    );

    try {
      await utility.lookup({ word: 'plosive', contextText: 'Compare consonant textures in prose.' });

      const { systemMessage, userMessage } = runInitial.mock.calls[0][0];
      expect(systemMessage).toContain('📂 **Topic & Related Lexicon**');
      expect(systemMessage.indexOf('📂 **Topic & Related Lexicon**'))
        .toBeLessThan(systemMessage.indexOf('🧬 **Morphology & Family**'));
      expect(systemMessage).toContain('1–3');
      expect(systemMessage).toContain('3–5');
      expect(systemMessage).toContain('not automatically synonyms or antonyms');
      expect(systemMessage).toContain('creative association');
      expect(systemMessage).toContain('no direct antonym exists');
      expect(userMessage).toContain('Word: plosive');
      expect(userMessage).toContain('Compare consonant textures in prose.');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('includes the Special Focus contract in the system prompt fallback', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const runInitial = jest.fn().mockResolvedValue({
      content: '# Result',
      usage: undefined,
      finishReason: 'stop'
    });

    const utility = new DictionaryUtility(
      { runInitial } as any,
      {
        loadSharedPrompts: jest.fn().mockResolvedValue('shared-prompts'),
        loadPrompts: jest.fn().mockRejectedValue(new Error('missing prompt files'))
      } as any
    );

    await utility.lookup({
      word: 'crash',
      contextText: 'Need a sound word for a pencil cup tipping over.'
    });

    const { systemMessage, userMessage, policy } = runInitial.mock.calls[0][0];

    expect(systemMessage).toContain('Special Focus');
    expect(systemMessage).toContain('context or author notes are provided');
    expect(userMessage).toContain('Contextual Excerpt:');
    expect(userMessage).toContain('Need a sound word for a pencil cup tipping over.');
    expect(policy).toMatchObject({ id: 'dictionary', capabilityCatalog: 'none' });

    warnSpy.mockRestore();
  });
});
