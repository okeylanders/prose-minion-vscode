/**
 * Gesture Dictionary composite generation (ADR 2026-07-22): one call on the
 * widget scope, a readable bounded dictionary, and a strict versioned menu.
 * A bad dictionary is fatal; a good dictionary with a bad menu remains useful
 * for inspection but never yields selectable state.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  GesturePlaygroundService,
  buildGestureDirective
} from '@services/widgets/GesturePlaygroundService';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const DICTIONARY_START = '===GESTURE_DICTIONARY_V1===';
const DICTIONARY_END = '===END_GESTURE_DICTIONARY_V1===';
const MENU_START = '===GESTURE_MENU_V1===';
const MENU_END = '===END_GESTURE_MENU_V1===';

const dictionaryMarkdown = [
  '# Gesture Dictionary — "she smiled"',
  '',
  '## 🔍 Sense Explorer',
  '',
  'The beat can deflect, invite, or conceal.'
].join('\n');

const groups = Array.from({ length: 4 }, (_, groupIndex) => ({
  heading: `Creative route ${groupIndex + 1}`,
  options: Array.from(
    { length: 3 },
    (_, optionIndex) => `Option ${groupIndex + 1}.${optionIndex + 1} uses a distinct beat`
  )
}));

const menuObject = { version: 1, groups };

const framed = (
  dictionary = dictionaryMarkdown,
  menuJson = JSON.stringify(menuObject, null, 2)
): string => [
  DICTIONARY_START,
  dictionary,
  DICTIONARY_END,
  MENU_START,
  menuJson,
  MENU_END
].join('\n');

const dictionaryOnly = (dictionary = dictionaryMarkdown): string => [
  DICTIONARY_START,
  dictionary,
  DICTIONARY_END
].join('\n');

const withGroups = (replacementGroups: unknown): string =>
  framed(dictionaryMarkdown, JSON.stringify({ version: 1, groups: replacementGroups }));

const build = (content: string) => {
  const runInitial = jest.fn().mockResolvedValue({
    content,
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
  });
  const appendLine = jest.fn();
  const manager = {
    getEngine: jest.fn().mockReturnValue({ runInitial })
  } as never;
  const promptLoader = {
    loadPrompts: jest.fn().mockResolvedValue('gesture dictionary system prompt')
  } as never;
  const service = new GesturePlaygroundService(manager, promptLoader, { appendLine } as never);
  return { service, runInitial, manager, promptLoader, appendLine };
};

const request = {
  targetPhrase: 'she smiled',
  writerInstructions: 'Keep it understated and do not use eye language.',
  contextText: 'He set the mug down. She smiled. "Somebody had to."',
  characterNotes: 'Mara — guarded.'
};

describe('Gesture Dictionary canonical prompt', () => {
  it('keeps the original Sense Explorer and the gesture-specific embodied lanes', () => {
    const charter = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'packages/core/resources/system-prompts/gesture-dictionary/00-gesture-dictionary.md'
      ),
      'utf8'
    );
    const example = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'packages/core/resources/system-prompts/gesture-dictionary/01-gesture-dictionary-example.md'
      ),
      'utf8'
    );

    expect(charter).toContain('## 🔍 Sense Explorer');
    expect(charter).toContain('8–12');
    expect(charter).toContain('4–6');
    expect(charter).toContain('## 🫀 Physical Mechanics');
    expect(charter).toContain('## 🧰 Embodiment Pathways');
    expect(charter).toContain('At least one group must stay directly embodied');
    expect(charter).toContain('## ⚠️ Cliché & Convention Pressure');
    expect(charter).toContain('## 🌱 Freshness Strategies & Neighboring Families');
    expect(charter).toContain('## 🎯 Special Focus: Scene Synthesis Brief');
    expect(example).toContain('Target phrase:\n\n`she folded her arms`');
  });
});

describe('GesturePlaygroundService.generateMenu', () => {
  it('loads the canonical pair and returns both artifacts from one quality-first call', async () => {
    const { service, runInitial, manager, promptLoader } = build(framed());

    const result = await service.generateMenu(request);

    expect((manager as { getEngine: jest.Mock }).getEngine).toHaveBeenCalledWith('widget');
    expect((promptLoader as { loadPrompts: jest.Mock }).loadPrompts).toHaveBeenCalledWith([
      'gesture-dictionary/00-gesture-dictionary.md',
      'gesture-dictionary/01-gesture-dictionary-example.md'
    ]);
    expect(runInitial).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'gesture-playground',
      systemMessage: 'gesture dictionary system prompt',
      userMessage: expect.stringContaining(
        'Writer instructions (quoted task data):\n'
        + '"Keep it understated and do not use eye language."'
      ),
      options: expect.objectContaining({
        temperature: 0.7,
        maxTokens: 14_000
      })
    }));
    expect(result.dictionaryMarkdown).toContain('Sense Explorer');
    expect(result.menu).toEqual(groups);
    expect(result.menuError).toBeUndefined();
    expect(result.usage?.totalTokens).toBe(30);
  });

  it('normalizes CRLF and harmless outer whitespace around the exact frames', async () => {
    const { service } = build(` \r\n${framed().replace(/\n/g, '\r\n')}\r\n `);
    await expect(service.generateMenu(request)).resolves.toEqual(
      expect.objectContaining({
        dictionaryMarkdown: expect.stringContaining('Sense Explorer'),
        menu: groups
      })
    );
  });

  it('rejects all writer inputs over their centralized bounds before model spend', async () => {
    const { service, runInitial } = build(framed());
    const budget = PROMPT_BUDGETS.workshopWidgets;

    await expect(service.generateMenu({ ...request, targetPhrase: '' }))
      .rejects.toThrow(/target phrase/i);
    await expect(service.generateMenu({
      ...request,
      targetPhrase: 'x'.repeat(budget.gestureTargetPhraseCharacters + 1)
    })).rejects.toThrow(/Target phrase exceeds/);
    await expect(service.generateMenu({
      ...request,
      writerInstructions: 'x'.repeat(budget.gestureWriterInstructionsCharacters + 1)
    })).rejects.toThrow(/Writer instructions exceed/);
    await expect(service.generateMenu({
      ...request,
      contextText: 'x'.repeat(budget.gestureContextCharacters + 1)
    })).rejects.toThrow(/Surrounding context exceeds/);
    await expect(service.generateMenu({
      ...request,
      characterNotes: 'x'.repeat(budget.gestureCharacterNotesCharacters + 1)
    })).rejects.toThrow(/Character notes exceed/);

    expect(runInitial).not.toHaveBeenCalled();
  });

  it('accepts exactly 10,000 surrounding-context characters', async () => {
    const { service, runInitial } = build(framed());
    const contextCharacters = PROMPT_BUDGETS.workshopWidgets.gestureContextCharacters;

    await expect(service.generateMenu({
      ...request,
      contextText: 'x'.repeat(contextCharacters)
    })).resolves.toEqual(expect.objectContaining({ menu: groups }));

    expect(runInitial).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['no frames', 'Here is a useful but unframed answer.'],
    ['empty dictionary', framed('   ')],
    [
      'dictionary over budget',
      framed('x'.repeat(PROMPT_BUDGETS.workshopWidgets.gestureDictionaryCharacters + 1))
    ],
    [
      'duplicate dictionary sentinel',
      `${DICTIONARY_START}\n${framed()}`
    ],
    [
      'leading commentary',
      `A preface the protocol forbids.\n${framed()}`
    ],
    [
      'menu sentinel inside dictionary',
      framed(`# Dictionary\n\n${MENU_START}\nnot a menu`)
    ]
  ])('rejects a fatally invalid dictionary: %s', async (_label, content) => {
    const { service } = build(content);
    await expect(service.generateMenu(request)).rejects.toThrow(/unusable Gesture Dictionary/);
  });

  it.each([
    ['missing menu frame', dictionaryOnly()],
    ['invalid JSON', framed(dictionaryMarkdown, '{"version":1,"groups":[')],
    ['top-level array', framed(dictionaryMarkdown, JSON.stringify(groups))],
    [
      'extra outer key',
      framed(dictionaryMarkdown, JSON.stringify({ version: 1, groups, commentary: 'nope' }))
    ],
    [
      'wrong version',
      framed(dictionaryMarkdown, JSON.stringify({ version: 2, groups }))
    ],
    ['too few groups', withGroups(groups.slice(0, 3))],
    [
      'too many groups',
      withGroups(Array.from({ length: 7 }, (_, index) => ({
        heading: `g${index}`,
        options: [`${index}-a`, `${index}-b`, `${index}-c`]
      })))
    ],
    [
      'group with extra key',
      withGroups([{ ...groups[0], rank: 1 }, ...groups.slice(1)])
    ],
    [
      'too few options',
      withGroups([{ ...groups[0], options: groups[0].options.slice(0, 2) }, ...groups.slice(1)])
    ],
    [
      'too many options',
      withGroups([
        {
          ...groups[0],
          options: Array.from({ length: 6 }, (_, index) => `overflow-${index}`)
        },
        ...groups.slice(1)
      ])
    ],
    [
      'duplicate options',
      withGroups([
        groups[0],
        { ...groups[1], options: [groups[0].options[0], ...groups[1].options.slice(1)] },
        ...groups.slice(2)
      ])
    ],
    [
      'over-long option',
      withGroups([
        { ...groups[0], options: ['x'.repeat(221), ...groups[0].options.slice(1)] },
        ...groups.slice(1)
      ])
    ],
    [
      'trailing commentary',
      `${framed()}\nThe end, allegedly.`
    ],
    [
      'duplicate menu sentinel',
      framed(dictionaryMarkdown, `${JSON.stringify(menuObject)}\n${MENU_START}`)
    ]
  ])('salvages the dictionary but rejects all menu state: %s', async (_label, content) => {
    const { service } = build(content);

    const result = await service.generateMenu(request);

    expect(result.dictionaryMarkdown).toContain('Sense Explorer');
    expect(result.menu).toBeUndefined();
    expect(result.menuError).toMatch(/alternatives menu was unusable/i);
  });

  it('prints the complete raw response between diagnostic markers when JSON parsing fails', async () => {
    const malformed = framed(dictionaryMarkdown, [
      '{',
      '  "version": 1,',
      '  "groups": [',
      '    {"heading":"A useful start","options":["a","b","c"]}',
      '    {"heading":"Missing comma","options":["d","e","f"]}',
      '  ]',
      '}'
    ].join('\n'));
    const { service, appendLine } = build(malformed);

    const result = await service.generateMenu(request);

    expect(result.menu).toBeUndefined();
    expect(appendLine).toHaveBeenCalledWith(
      '[GesturePlaygroundService] --- BEGIN REJECTED MODEL RESPONSE ---'
    );
    expect(appendLine).toHaveBeenCalledWith(malformed);
    expect(appendLine).toHaveBeenCalledWith(
      '[GesturePlaygroundService] --- END REJECTED MODEL RESPONSE ---'
    );
  });
});

describe('buildGestureDirective', () => {
  it('carries only selections and the note — never the exploration cloud', () => {
    expect(buildGestureDirective({
      targetPhrase: ' she smiled ',
      selections: ['the smile arrived late', 'it was the smile she used on waiters'],
      note: 'keep it small'
    })).toBe([
      'Gesture directions I want for "she smiled":',
      '· the smile arrived late',
      '· it was the smile she used on waiters',
      'note: keep it small'
    ].join('\n'));
  });

  it('omits the note line when empty', () => {
    expect(buildGestureDirective({ targetPhrase: 'p', selections: ['a'], note: '  ' }))
      .toBe('Gesture directions I want for "p":\n· a');
  });
});
