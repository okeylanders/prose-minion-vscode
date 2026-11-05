/**
 * Guard the helper's prompts (ADR 2026-11-05 D1, D5) against drift from the
 * code they teach:
 *
 * - every task in the registry has its prompt section on disk;
 * - the generic prompt names no task and quotes no number;
 * - the memory draft's numbers are the memory's own bounds, and it quotes
 *   no other number; its kinds are the closed list, with the boundaries
 *   the persona prompt teaches;
 * - its worked example's request is byte-identical to what the engine
 *   sends, and its reply decodes through the production reader and codec.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PROJECT_MEMORY_FIELD_CHARACTERS, PROJECT_MEMORY_KINDS } from '@shared/types/projectMemory';
import { buildHelperUserMessage } from '@services/helper/HelperAgentService';
import { readHelperReply } from '@services/helper/HelperReply';
import { HELPER_TASK_POLICIES } from '@services/helper/HelperTaskPolicies';
import { HELPER_BASE_PROMPT } from '@services/helper/HelperTaskPolicy';
import { MEMORY_DRAFT_POLICY } from '@services/helper/tasks/MemoryDraftTask';

const PROMPTS = path.resolve(__dirname, '../../../resources/system-prompts');
const read = (file: string) => fs.readFileSync(path.join(PROMPTS, file), 'utf8');
const number = (quoted: string): number => Number(quoted.replace(/,/g, ''));
const withoutFences = (text: string) => text.replace(/```[\s\S]*?```/g, '');
const fences = (text: string) => [...text.matchAll(/```[a-z]*\n([\s\S]*?)\n```/g)].map((match) => match[1]);

describe('the helper\'s prompts ↔ its registry', () => {
  it('has a prompt section on disk for every task, and the generic prompt first', () => {
    expect(fs.existsSync(path.join(PROMPTS, HELPER_BASE_PROMPT))).toBe(true);
    for (const policy of Object.values(HELPER_TASK_POLICIES)) {
      expect(fs.existsSync(path.join(PROMPTS, policy.promptSection))).toBe(true);
    }
  });

  it('keeps the generic prompt generic: no task named, no number, and the D1 rules', () => {
    const base = read(HELPER_BASE_PROMPT);
    for (const task of Object.keys(HELPER_TASK_POLICIES)) {
      expect(base).not.toContain(task);
    }
    expect(base.match(/\d/g)).toBeNull();
    expect(base).toContain('Be brief and exact.');
    expect(base).toContain('Return only the JSON the task asks for.');
    expect(base).toContain('Never invent facts.');
    expect(base).toContain('The writer\'s words outrank yours.');
  });
});

describe('memory-draft prompt ↔ code', () => {
  const prompt = read(MEMORY_DRAFT_POLICY.promptSection);
  const prose = withoutFences(prompt);
  const pinned: ReadonlyArray<readonly [RegExp, number]> = [
    [/`title`: one line, at most ([\d,]+) characters/, PROJECT_MEMORY_FIELD_CHARACTERS.title],
    [/`summary`: one line, at most ([\d,]+) characters/, PROJECT_MEMORY_FIELD_CHARACTERS.summary]
  ];

  it.each(pinned)('quotes %s from the memory\'s bound', (pattern, expected) => {
    const match = pattern.exec(prose);
    expect(match).not.toBeNull();
    expect(number(match![1])).toBe(expected);
  });

  it('quotes no number it does not pin', () => {
    const unpinned = pinned.reduce((text, [pattern]) => text.replace(new RegExp(pattern.source, 'g'), ''), prose);
    expect(unpinned.match(/\d[\d,.]*/g)).toBeNull();
  });

  it('names the closed kinds, in order, and only those', () => {
    const named = [...prose.matchAll(/`([a-z-]+)` \(/g)].map((match) => match[1]);
    expect(named).toEqual([...PROJECT_MEMORY_KINDS]);
  });

  it('teaches the kinds\' boundaries as the persona prompt does, and never to invent', () => {
    expect(prose).toContain('Canon is what happens in the story; a theme is what it means.');
    expect(prose).toContain('An idea is unsettled');
    expect(prose).toContain('an idea is a candidate answer or direction');
    expect(prose).toContain('Never add a fact, a name or a reason it does not hold.');
  });

  it('shows a request the engine sends byte for byte, and a reply the production codec reads', () => {
    const [request, reply] = fences(prompt);
    const sent = JSON.parse(request.split('\n\n').slice(1).join('\n\n')) as { task: string; source: 'writer' | 'persona'; passage: string };
    expect(sent.task).toBe('memory-draft');
    expect(request).toBe(buildHelperUserMessage('memory-draft', MEMORY_DRAFT_POLICY.buildInput({ text: sent.passage, source: sent.source })));

    const decoded = readHelperReply(MEMORY_DRAFT_POLICY, reply, 'stop');
    expect(decoded).toEqual({ ok: true, value: JSON.parse(reply), repairs: [] });
    expect(sent.passage).toMatch(/Alice/);
  });
});
