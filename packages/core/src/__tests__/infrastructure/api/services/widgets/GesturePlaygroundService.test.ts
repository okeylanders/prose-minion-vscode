/**
 * Gesture Playground generation (ADR 2026-07-22 decision 8): the model call
 * runs on the `widget` scope, and everything around it is deterministic —
 * inputs are cap-checked before any spend, and a menu violating ANY bound
 * rejects wholesale rather than becoming writer state.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  GesturePlaygroundService,
  buildGestureDirective
} from '@services/widgets/GesturePlaygroundService';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const goodMenu = JSON.stringify([
  { heading: 'The eyes', options: ['Her gaze snagged a half-second too long'] },
  { heading: 'Hands & body', options: ['She turned her mug a quarter-turn, then back'] }
]);

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
    loadPrompts: jest.fn().mockResolvedValue('gesture system prompt')
  } as never;
  const service = new GesturePlaygroundService(manager, promptLoader, { appendLine } as never);
  return { service, runInitial, manager, appendLine };
};

const request = {
  targetPhrase: 'she smiled',
  contextText: 'He set the mug down. She smiled. "Somebody had to."',
  characterNotes: 'Mara — guarded.'
};

describe('Gesture Playground creative brief', () => {
  it('asks for divergent, context-mined alternatives instead of an anatomical inventory', () => {
    const prompt = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'packages/core/resources/system-prompts/gesture-playground/00-gesture-playground.md'
      ),
      'utf8'
    );

    expect(prompt).toContain('dramatic function to');
    expect(prompt).toContain('Do not default to anatomical headings');
    expect(prompt).toContain('replacement-ready prose');
    expect(prompt).toContain('Mine the surrounding context');
    expect(prompt).toContain('## Quality benchmark');
  });
});

describe('GesturePlaygroundService.generateMenu', () => {
  it('runs one call on the widget engine and returns the parsed menu', async () => {
    const { service, runInitial, manager } = build(goodMenu);
    const result = await service.generateMenu(request);
    expect((manager as { getEngine: jest.Mock }).getEngine).toHaveBeenCalledWith('widget');
    expect(runInitial).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'gesture-playground',
      systemMessage: 'gesture system prompt',
      userMessage: expect.stringContaining(
        'Treat the target as a dramatic function you may rephrase, relocate, or replace'
      ),
      options: expect.objectContaining({
        temperature: 0.9,
        maxTokens: 10_000
      })
    }));
    expect(result.menu).toHaveLength(2);
    expect(result.menu[0]).toEqual({
      heading: 'The eyes',
      options: ['Her gaze snagged a half-second too long']
    });
    expect(result.usage?.totalTokens).toBe(30);
  });

  it('strips markdown fences before parsing', async () => {
    const { service } = build('```json\n' + goodMenu + '\n```');
    const result = await service.generateMenu(request);
    expect(result.menu).toHaveLength(2);
  });

  it('rejects writer inputs over budget before any model spend', async () => {
    const { service, runInitial } = build(goodMenu);
    await expect(service.generateMenu({ ...request, targetPhrase: '' }))
      .rejects.toThrow(/target phrase/i);
    await expect(service.generateMenu({
      ...request,
      targetPhrase: 'x'.repeat(PROMPT_BUDGETS.workshopWidgets.gestureTargetPhraseCharacters + 1)
    })).rejects.toThrow(/exceeds/);
    expect(runInitial).not.toHaveBeenCalled();
  });

  it('accepts 10,000 surrounding-context characters and rejects one more before any model spend', async () => {
    const { service, runInitial } = build(goodMenu);
    const contextCharacters = PROMPT_BUDGETS.workshopWidgets.gestureContextCharacters;

    await expect(service.generateMenu({ ...request, contextText: 'x'.repeat(contextCharacters) }))
      .resolves.toEqual(expect.objectContaining({ menu: expect.any(Array) }));
    await expect(service.generateMenu({ ...request, contextText: 'x'.repeat(contextCharacters + 1) }))
      .rejects.toThrow(`Surrounding context exceeds ${contextCharacters} characters`);

    expect(runInitial).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['not JSON at all', 'Here are some ideas: the eyes...'],
    ['not an array', '{"heading":"x","options":["y"]}'],
    ['empty array', '[]'],
    ['group missing options', '[{"heading":"The eyes"}]'],
    ['group with extra keys', '[{"heading":"x","options":["y"],"rank":1}]'],
    ['non-string option', '[{"heading":"x","options":[3]}]'],
    ['duplicate options across groups', '[{"heading":"a","options":["same"]},{"heading":"b","options":["same"]}]'],
    [
      'too many groups',
      JSON.stringify(Array.from({ length: 7 }, (_, i) => ({ heading: `g${i}`, options: [`o${i}`] })))
    ],
    [
      'too many options in one group',
      JSON.stringify([{ heading: 'g', options: Array.from({ length: 6 }, (_, i) => `o${i}`) }])
    ],
    [
      'over-long option',
      JSON.stringify([{ heading: 'g', options: ['x'.repeat(300)] }])
    ]
  ])('rejects wholesale: %s', async (_label, content) => {
    const { service } = build(content);
    await expect(service.generateMenu(request)).rejects.toThrow(/unusable menu/);
  });

  it('prints the complete raw response between diagnostic markers when JSON parsing fails', async () => {
    const malformed = [
      '[',
      '  {"heading":"A useful start","options":["first option"]}',
      '  {"heading":"Missing comma","options":["the failure is down here"]}',
      ']'
    ].join('\n');
    const { service, appendLine } = build(malformed);

    await expect(service.generateMenu(request)).rejects.toThrow(/unusable menu/);

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
  it('carries only selections and the note — never the cloud', () => {
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
