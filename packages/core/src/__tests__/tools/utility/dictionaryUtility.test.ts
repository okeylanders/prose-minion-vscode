import { DictionaryUtility } from '@/tools/utility/dictionaryUtility';
import * as fs from 'fs';
import * as path from 'path';

const PROMPT_ROOT = path.resolve(__dirname, '../../../../resources/system-prompts');
const PALETTES_PATH = 'dictionary-utility/03-chromatic-palettes.md';
const ENCYCLOPEDIA_PATH = 'dictionary-utility/02-encyclopedia-entry.md';

type PromptSource = 'bundled' | 'fallback';

async function composeLookup(
  source: PromptSource,
  entryOptions: { includePalettes?: boolean; includeEncyclopedia?: boolean }
) {
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const runInitial = jest.fn().mockResolvedValue({ content: '# Result' });
  const loadPrompts = jest.fn(async (paths: string[]) => {
    if (source === 'fallback') {
      throw new Error('missing prompt files');
    }
    return paths.map((file) => fs.readFileSync(path.join(PROMPT_ROOT, file), 'utf8')).join('\n\n---\n\n');
  });
  const utility = new DictionaryUtility(
    { runInitial } as never,
    { loadSharedPrompts: async () => '', loadPrompts } as never
  );
  try {
    await utility.lookup({ word: 'copper', contextText: 'A copper roof at dusk.', ...entryOptions });
  } finally {
    warnSpy.mockRestore();
  }
  const { systemMessage, userMessage } = runInitial.mock.calls[0][0] as { systemMessage: string; userMessage: string };
  const blueprintEnd = systemMessage.indexOf(source === 'bundled' ? '## Style Guardrails' : '### Additional Guidelines');
  return {
    systemMessage,
    userMessage,
    blueprint: systemMessage.slice(0, blueprintEnd),
    activeRequirements: systemMessage.split('\n\n---\n\n').at(-1)!,
    loadedPaths: loadPrompts.mock.calls[0]?.[0] ?? []
  };
}

/**
 * Sentences that order Topic & Related Lexicon (or the encyclopedia) after
 * AI Advisory Notes without naming Chromatic Palettes between them. With both
 * optional sections enabled, every such sentence is a conflicting instruction.
 */
function topicDirectlyAfterAdvisoryNotes(text: string): string[] {
  return text
    .replace(/[*"🧠🎨📂]/gu, '')
    .replace(/[ \t]+/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((sentence) =>
      /after AI Advisory Notes/i.test(sentence)
      && /Topic & Related Lexicon|encyclopedia/i.test(sentence)
      && !sentence.includes('Chromatic Palettes'));
}

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
      // An absent palette option means OFF: no palette prompt, blueprint slot, or fences.
      expect(systemMessage).not.toContain('{{PALETTES_BLUEPRINT_SECTION}}');
      expect(loadPrompts.mock.calls[0][0]).not.toContain('dictionary-utility/03-chromatic-palettes.md');
      expect(blueprint).not.toContain('Chromatic Palettes');
      expect(systemMessage).not.toContain('```pm-palette');
      expect(activeRequirements).toContain('Chromatic Palettes: DISABLED for this lookup');
      expect(userMessage).toContain('Do not include Chromatic Palettes or any `pm-palette` fences.');
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

  describe.each(['bundled', 'fallback'] as const)('Chromatic Palettes with %s prompts', (source) => {
    it.each([
      [false, false],
      [false, true],
      [true, false],
      [true, true]
    ] as const)('numbers and states the selection with palettes=%s encyclopedia=%s', async (includePalettes, includeEncyclopedia) => {
      const { systemMessage, userMessage, blueprint, activeRequirements, loadedPaths } =
        await composeLookup(source, { includePalettes, includeEncyclopedia });
      const topicSection = includePalettes ? 17 : 16;
      const lastSection = includeEncyclopedia ? 'Topic & Related Lexicon' : includePalettes ? 'Chromatic Palettes' : 'AI Advisory Notes';

      expect(systemMessage).not.toMatch(/\{\{\w+_BLUEPRINT_SECTION\}\}/);
      expect(blueprint.match(/^\d+\. /gm)).toHaveLength(15 + Number(includePalettes) + Number(includeEncyclopedia));
      expect(blueprint).toMatch(/^15\. 🧠 \*\*AI Advisory Notes\*\*/m);

      if (source === 'bundled') {
        expect(loadedPaths.includes(PALETTES_PATH)).toBe(includePalettes);
        expect(loadedPaths.includes(ENCYCLOPEDIA_PATH)).toBe(includeEncyclopedia);
        if (includePalettes && includeEncyclopedia) {
          // Guidance follows output order: the final guidance belongs to the final section.
          expect(loadedPaths.indexOf(PALETTES_PATH)).toBeLessThan(loadedPaths.indexOf(ENCYCLOPEDIA_PATH));
        }
      }

      if (includePalettes) {
        expect(blueprint).toMatch(/^16\. 🎨 \*\*Chromatic Palettes\*\* — Required color section/m);
        expect(blueprint.indexOf('16. 🎨')).toBeGreaterThan(blueprint.indexOf('15. 🧠'));
        expect(activeRequirements).toContain('Chromatic Palettes: ENABLED for this lookup.');
        expect(activeRequirements).toContain(
          `required ${includeEncyclopedia ? '' : 'final '}section 16, Chromatic Palettes; the response is incomplete without it.`
        );
        expect(activeRequirements).toContain('After AI Advisory Notes, ');
        expect(userMessage).toContain('Include Chromatic Palettes as section 16: after AI Advisory Notes');
        expect(userMessage).toContain('"# 🎨 Chromatic Palettes"');
        expect(userMessage).toContain('one `pm-palette` fence per palette');
        if (source === 'bundled') {
          expect(systemMessage).toContain('# Dictionary Utility — Chromatic Palettes Required for This Lookup');
          expect(systemMessage).toContain('## Palette Grammar');
          expect(systemMessage).toContain('Copper | #B87333 | the reddish-orange of the bare metal, freshly polished');
          expect(systemMessage).toContain('kind: evocative');
        } else {
          expect(systemMessage).toContain('# Chromatic Palettes Required for This Lookup');
          expect(systemMessage).toContain('`Color Name | #RRGGBB | short definition`');
          expect(systemMessage).toContain(includeEncyclopedia
            ? 'Write it after **AI Advisory Notes**, before the final **Topic & Related Lexicon** section'
            : 'Write it after **AI Advisory Notes**, as the final section');
        }
      } else {
        expect(blueprint).not.toContain('Chromatic Palettes');
        expect(systemMessage).not.toContain('```pm-palette');
        expect(systemMessage).not.toContain('Name every swatch');
        expect(activeRequirements).toContain(
          'Chromatic Palettes: DISABLED for this lookup. Do not generate a Chromatic Palettes section or any `pm-palette` fences.'
        );
        expect(userMessage).toContain('Do not include Chromatic Palettes or any `pm-palette` fences.');
      }

      if (includeEncyclopedia) {
        expect(blueprint).toMatch(new RegExp(`^${topicSection}\\. 📂 \\*\\*Topic & Related Lexicon\\*\\* — Required final`, 'm'));
        expect(activeRequirements).toContain(`required final section ${topicSection}, Topic & Related Lexicon`);
        expect(userMessage).toContain(includePalettes
          ? 'after AI Advisory Notes and Chromatic Palettes, finish with the complete "# 📂 Topic & Related Lexicon" section'
          : 'after AI Advisory Notes, finish with the complete "# 📂 Topic & Related Lexicon" section');
        if (includePalettes) {
          expect(blueprint.indexOf('17. 📂')).toBeGreaterThan(blueprint.indexOf('16. 🎨'));
          expect(activeRequirements).toContain('then continue with section 17, Topic & Related Lexicon.');
          expect(activeRequirements).toContain('Continue after AI Advisory Notes and Chromatic Palettes with "# 📂 Topic & Related Lexicon"');
          expect(systemMessage).toContain(source === 'bundled'
            ? 'LAST, after **AI Advisory Notes** and any enabled **Chromatic Palettes** section.'
            : 'LAST, after **AI Advisory Notes** and **Chromatic Palettes**.');
          expect(topicDirectlyAfterAdvisoryNotes(`${systemMessage}\n${userMessage}`)).toEqual([]);
        }
      } else {
        expect(blueprint).not.toContain('Topic & Related Lexicon');
        expect(activeRequirements).toContain(`ending with ${lastSection}.`);
        expect(userMessage).toContain(`Do not include an encyclopedia entry. Finish with ${lastSection}.`);
      }
    });
  });

  it('detects Topic directly following AI Advisory Notes, so the ordering guard is not vacuous', async () => {
    const { systemMessage, userMessage } = await composeLookup('bundled', { includeEncyclopedia: true, includePalettes: false });

    expect(topicDirectlyAfterAdvisoryNotes(`${systemMessage}\n${userMessage}`)).toEqual(expect.arrayContaining([
      'Continue after AI Advisory Notes with # Topic & Related Lexicon and the complete encyclopedia entry.',
      expect.stringContaining('Include the encyclopedia entry: after AI Advisory Notes, finish with the complete # Topic & Related Lexicon section')
    ]));
  });
});
