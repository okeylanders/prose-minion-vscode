import { DictionaryUtility } from '@/tools/utility/dictionaryUtility';
import * as fs from 'fs';
import * as path from 'path';

const PROMPT_ROOT = path.resolve(__dirname, '../../../../resources/system-prompts');

describe('DictionaryUtility', () => {
  it.each([
    ['bundled', undefined],
    ['bundled', true],
    ['bundled', false],
    ['fallback', undefined],
    ['fallback', true],
    ['fallback', false],
    ['empty', true],
    ['empty', false]
  ] as const)('composes %s lookup instructions with includeEncyclopedia=%s', async (mode, includeEncyclopedia) => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const runInitial = jest.fn().mockResolvedValue({ content: '# Result' });
    const loadPrompts = jest.fn(async (paths: string[]) => {
      if (mode === 'fallback') {
        throw new Error('missing prompt files');
      }
      if (mode === 'empty') {
        return '';
      }
      return paths.map((file) => fs.readFileSync(path.join(PROMPT_ROOT, file), 'utf8')).join('\n\n');
    });
    const utility = new DictionaryUtility(
      { runInitial } as never,
      {
        loadSharedPrompts: async () => '',
        loadPrompts
      } as never
    );

    try {
      await utility.lookup({ word: 'plosive', contextText: 'Compare consonant textures in prose.', includeEncyclopedia });

      const { systemMessage, userMessage } = runInitial.mock.calls[0][0];
      const encyclopediaPath = 'dictionary-utility/02-encyclopedia-entry.md';
      const blueprintEnd = systemMessage.indexOf(mode === 'bundled' ? '## Style Guardrails' : '### Additional Guidelines');
      const blueprint = systemMessage.slice(0, blueprintEnd);
      const activeRequirements = systemMessage.split('\n\n---\n\n').at(-1);
      expect(systemMessage).not.toContain('{{ENCYCLOPEDIA_BLUEPRINT_SECTION}}');
      if (includeEncyclopedia === false) {
        expect(loadPrompts.mock.calls[0][0]).not.toContain(encyclopediaPath);
        expect(systemMessage).not.toContain('📂 **Topic & Related Lexicon**');
        expect(systemMessage).not.toContain('Topic & Related Lexicon Guidance');
        expect(systemMessage).not.toContain('1–2 seminal or foundational reference books');
        expect(systemMessage).not.toContain('The New Science of Strong Materials');
        expect(systemMessage).toContain('encyclopedia) section is disabled for this lookup');
        expect(systemMessage).toContain('ending with AI Advisory Notes');
        expect(blueprint.match(/^\d+\. /gm)).toHaveLength(15);
        expect(activeRequirements).toContain('disabled for this lookup');
        expect(userMessage).toContain('Do not include an encyclopedia entry');
      } else {
        expect(loadPrompts.mock.calls[0][0]).toContain(encyclopediaPath);
        expect(blueprint).toContain('16. 📂 **Topic & Related Lexicon**');
        expect(blueprint.match(/^\d+\. /gm)).toHaveLength(16);
        expect(blueprint.indexOf('16. 📂 **Topic & Related Lexicon**'))
          .toBeGreaterThan(blueprint.indexOf('15. 🧠 **AI Advisory Notes**'));
        expect(activeRequirements).toContain('Encyclopedia entry: ENABLED');
        expect(activeRequirements).toContain('required final section 16');
        expect(userMessage).toContain('Include the encyclopedia entry: after AI Advisory Notes');
        expect(systemMessage).not.toContain('# Dictionary Utility — Optional Encyclopedia Entry');
        expect(systemMessage).not.toContain('# Optional Encyclopedia Entry');
        expect(systemMessage).toContain('LAST, after **AI Advisory Notes**');
        expect(systemMessage).toContain('2–4 useful topic families');
        expect(systemMessage).toContain('at least two developed paragraphs');
        expect(systemMessage).toContain('4–8 useful terms');
        expect(systemMessage).toContain('1–2 seminal or foundational reference books');
        expect(systemMessage).toContain('no short word cap');
        expect(systemMessage).toContain('do not compress the other dictionary sections');
        expect(systemMessage).toContain('not automatically synonyms or antonyms');
        expect(systemMessage).toContain('creative association');
      }
      expect(systemMessage).toContain(mode === 'bundled' ? '8–12 synonyms, 4–6 antonyms' : 'expanded synonyms (8–12), antonyms');
      expect(systemMessage).not.toContain('no direct antonym exists');
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
