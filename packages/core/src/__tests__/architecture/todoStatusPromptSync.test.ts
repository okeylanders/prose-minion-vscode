/**
 * Guard the to-do status prompt (ADR 2026-11-19 D2, D3, D10) against drift
 * from the code it teaches:
 *
 * - every number it quotes is pinned to `PROMPT_BUDGETS.workshopTodoStatus`,
 *   and it quotes no other number;
 * - it teaches every element the codec reads, and no other;
 * - its worked example decodes, through the production extractor, to the
 *   changes it shows, placed last as the prose says;
 * - it is in every persona's chain, host and guest, with no setting, and
 *   measured as a tool-use section;
 * - session recall points to it beside `transcript.todos`.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { extractWorkshopReplyControls } from '@/utils/workshopReplyControls';
import { WORKSHOP_TODO_STATUS_ELEMENTS } from '@/utils/workshopReplyTodoStatus';
import {
  getWorkshopPersona,
  WORKSHOP_GUEST_BASE_PROMPT_PATH,
  WORKSHOP_HOST_BASE_PROMPT_PATH,
  WORKSHOP_TODO_STATUS_PROMPT_PATH,
  workshopPersonaSystemPromptPaths
} from '@shared/constants/workshopPersonas';
import { WORKSHOP_TOOL_USE_PROMPT_PATHS } from '@/infrastructure/api/services/analysis/WorkshopPersonaSystemPrompt';

const read = (file: string): string => fs.readFileSync(path.resolve(__dirname, '../../../resources/system-prompts', file), 'utf8');
const PROMPT = read(WORKSHOP_TODO_STATUS_PROMPT_PATH);
const budgets = PROMPT_BUDGETS.workshopTodoStatus;
const prose = PROMPT.replace(/```[\s\S]*?```/g, '');

describe('to-do status prompt ↔ PROMPT_BUDGETS', () => {
  const pinned: ReadonlyArray<readonly [RegExp, number[]]> = [
    [/one line, at most (\d+) characters/, [budgets.noteCharacters]],
    [/One reply may make at most (\d+) changes, touching at most (\d+) saved sessions/, [budgets.changesPerReply, budgets.savedSessionsPerReply]]
  ];

  it.each(pinned)('quotes %s from its bound', (pattern, expected) => {
    const match = pattern.exec(prose);
    expect(match).not.toBeNull();
    expect(match!.slice(1).map(Number)).toEqual(expected);
  });

  it('quotes no number it does not pin', () => {
    const unpinned = [...pinned.map(([pattern]) => pattern), /`[^`\n]*`/]
      .reduce((text, pattern) => text.replace(new RegExp(pattern.source, 'g'), ''), prose);
    expect(unpinned.match(/\d[\d,.]*/g)).toBeNull();
  });

  it('teaches every element the codec reads, and no other', () => {
    const taught = new Set([...prose.matchAll(/`<([a-z-]+)>`/g)].map((match) => match[1]));
    expect([...taught].sort()).toEqual([...WORKSHOP_TODO_STATUS_ELEMENTS].sort());
  });

  it('its worked example decodes to the two changes it shows, at the tail', () => {
    const example = /### Example[\s\S]*?```text\n([\s\S]*?)```/.exec(PROMPT)![1].replace(/^Reply ends: /, '');
    const controls = extractWorkshopReplyControls(example, { memoryOpen: false });
    expect(controls.todoStatus).toEqual({
      changes: [
        { session: 'a1b2c3d4-alice-chapter-6', todoId: 'todo-4-1763400000000', status: 'completed' },
        { session: 'current', todoId: 'todo-2-1763500000000', status: 'dismissed', note: 'The writer chose to keep the line.' }
      ],
      rejections: []
    });
    expect(controls.rest).not.toContain('prose-minion-todo-status');
  });

  it('the trailer sample in the grammar section decodes', () => {
    const sample = /### The trailer[\s\S]*?```xml\n([\s\S]*?)```/.exec(PROMPT)![1];
    expect(extractWorkshopReplyControls(sample, { memoryOpen: false }).todoStatus?.changes).toHaveLength(1);
  });

  it('is in every persona chain, host and guest, whatever the settings', () => {
    const persona = getWorkshopPersona('jill')!;
    const behavior = { interactionMode: 'balanced', expressionLevel: 'subtle', relationalDepth: 'reserved' } as const;
    for (const base of [WORKSHOP_HOST_BASE_PROMPT_PATH, WORKSHOP_GUEST_BASE_PROMPT_PATH]) {
      expect(workshopPersonaSystemPromptPaths(base, persona, behavior)).toContain(WORKSHOP_TODO_STATUS_PROMPT_PATH);
      expect(workshopPersonaSystemPromptPaths(base, persona, behavior, { projectMemory: true, fileEdits: true, personaReactions: true }))
        .toContain(WORKSHOP_TODO_STATUS_PROMPT_PATH);
    }
    expect(WORKSHOP_TOOL_USE_PROMPT_PATHS.has(WORKSHOP_TODO_STATUS_PROMPT_PATH)).toBe(true);
  });

  it('session recall points to it beside transcript.todos', () => {
    expect(read('workshop-personas/transcript-recall-capability.md')).toContain('copy those two ids into a to-do status trailer');
  });
});
