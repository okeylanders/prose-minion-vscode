/**
 * Guard the project-memory proposal prompt (ADR 2026-11-04 D6, D9, D11;
 * epic Slice 3) against drift from the code it teaches:
 *
 * - every number it quotes is pinned to PROMPT_BUDGETS (or the format's
 *   list bound), and it quotes no other number;
 * - its one trailer example decodes, through the production extractor and
 *   codec, to the proposal it shows, placed last as the prose says;
 * - the kinds it names are the closed list, and the never-list is there;
 * - it is taught only beside the grammar, while project memory is open.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { PROJECT_MEMORY_KINDS, PROJECT_MEMORY_LIST_ENTRIES } from '@shared/types/projectMemory';
import { extractWorkshopReplyControls } from '@/utils/workshopReplyControls';
import {
  getWorkshopPersona,
  WORKSHOP_GUEST_BASE_PROMPT_PATH,
  WORKSHOP_HOST_BASE_PROMPT_PATH,
  workshopPersonaSystemPromptPaths
} from '@shared/constants/workshopPersonas';

const PROMPT = fs.readFileSync(path.resolve(__dirname,
  '../../../resources/system-prompts/workshop-personas/project-memory-proposals.md'), 'utf8');
const budgets = PROMPT_BUDGETS.workshopProjectMemory;
const number = (quoted: string): number => Number(quoted.replace(/,/g, ''));
const prose = PROMPT.replace(/```[\s\S]*?```/g, '');

describe('project-memory proposal prompt ↔ PROMPT_BUDGETS', () => {
  const pinned: ReadonlyArray<readonly [RegExp, number[]]> = [
    [/`<title>`: one line, at most ([\d,]+) characters/, [budgets.titleCharacters]],
    [/`<summary>`: one line, at most ([\d,]+) characters/, [budgets.summaryCharacters]],
    [/`<body>`: optional, at most ([\d,]+) characters/, [budgets.bodyCharacters]],
    [/one per element, at most ([\d,]+)\./, [PROJECT_MEMORY_LIST_ENTRIES.supersedes]]
  ];

  it.each(pinned)('quotes %s from its bound', (pattern, expected) => {
    const match = pattern.exec(prose);
    expect(match).not.toBeNull();
    expect(match!.slice(1).map(number)).toEqual(expected);
  });

  it('quotes no number it does not pin', () => {
    const unpinned = [...pinned.map(([pattern]) => pattern), /`[^`\n]*`/]
      .reduce((text, pattern) => text.replace(new RegExp(pattern.source, 'g'), ''), prose);
    expect(unpinned.match(/\d[\d,.]*/g)).toBeNull();
  });

  it('names the closed kinds, and only those', () => {
    const named = [...prose.matchAll(/`([a-z-]+)` \(/g)].map((match) => match[1]);
    expect(named).toEqual([...PROJECT_MEMORY_KINDS]);
  });

  it('teaches the boundaries of theme and idea (Slice 6a)', () => {
    expect(prose).toContain('Canon is what happens in the story; a theme is what it means.');
    expect(prose).toContain('An idea is unsettled: never propose one as `canon` or `decision` because it was discussed.');
    expect(prose).toContain('an idea is a candidate answer or direction');
    expect(prose).toContain('When the writer chooses an idea, propose the `decision` or `canon` note that records the choice, and name the idea in `<supersedes>`.');
  });

  it('carries the never-list (D9)', () => {
    expect(prose).toContain('It never records anything about the writer\'s feelings, health, relationships or private life');
    expect(prose).toContain('never say a note was saved, and never promise to remember anything');
  });
});

describe('the trailer example, through the production extractor and codec', () => {
  const examples = [...PROMPT.matchAll(/```xml\n([\s\S]*?)```/g)].map((match) => match[1].trim());

  it('shows exactly one example, and it decodes to the proposal it shows', () => {
    expect(examples).toHaveLength(1);
    const reply = `Good. It earns its place.\n\n${examples[0]}\n`;
    expect(extractWorkshopReplyControls(reply, { memoryOpen: true })).toEqual({
      rest: 'Good. It earns its place.',
      redacted: 'Good. It earns its place.\n\n[project memory proposal removed]',
      memory: {
        kind: 'proposal',
        proposal: {
          title: 'The Rabbit\'s watch runs backward',
          kind: 'canon',
          summary: 'From chapter 3 on, the White Rabbit\'s watch runs backward; nobody in Wonderland remarks on it.',
          body: 'We settled this while working the tea-party scene. The watch running backward is the first sign that time in Wonderland is wrong. Nobody comments on it; the reader notices before Alice does.',
          supersedes: ['mem-1a9e04']
        }
      }
    });
  });

  it('is refused anywhere but last, as the prose says', () => {
    const reply = `${examples[0]}\n\nGood. It earns its place.`;
    expect(extractWorkshopReplyControls(reply, { memoryOpen: true }).memory).toEqual({ kind: 'rejected', reason: 'misplaced' });
  });
});

describe('when the proposal prompt is taught (ADR 2026-11-04 D6)', () => {
  const jill = getWorkshopPersona('jill')!;
  const behavior = { interactionMode: 'conversational', expressionLevel: 'subtle', relationalDepth: 'reserved' } as const;
  const FILE = 'workshop-personas/project-memory-proposals.md';

  it('follows the grammar for host and guest, only while memory is open', () => {
    for (const base of [WORKSHOP_HOST_BASE_PROMPT_PATH, WORKSHOP_GUEST_BASE_PROMPT_PATH]) {
      const on = workshopPersonaSystemPromptPaths(base, jill, behavior, { projectMemory: true });
      expect(on.indexOf(FILE)).toBe(on.indexOf('workshop-personas/project-memory-capability.md') + 1);
      expect(workshopPersonaSystemPromptPaths(base, jill, behavior)).not.toContain(FILE);
    }
  });
});
