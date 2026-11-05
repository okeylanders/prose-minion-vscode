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
import { WORKSHOP_MEMORY_EDIT_ELEMENTS } from '@/utils/workshopMemoryEditProtocol';
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
    [/one per element, at most ([\d,]+)\./, [PROJECT_MEMORY_LIST_ENTRIES.supersedes]],
    [/One reply suggests at most ([\d,]+) notes\./, [budgets.proposalsPerReply]],
    [/At most ([\d,]+) find-and-replace pairs in one change/, [budgets.editReplaces]]
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

  it('teaches several suggestions: rarely, on request or for distinct things, each alone (Slice 6b)', () => {
    expect(prose).toContain('Most replies suggest none.');
    expect(prose).toContain('Suggest several only when the writer asks for them, or when several distinct things settled in this exchange.');
    expect(prose).toContain('it never repeats or overlaps another suggestion in the same reply');
    expect(prose).toContain('Each trailer is checked on its own');
    expect(prose).toContain('A note that replaces another always waits for the writer to save it.');
    expect(prose).not.toContain('at most one note');
  });

  it('teaches changing a saved note: when to change, replace or suggest new, and how to quote (Slice 6c)', () => {
    expect(prose).toContain('**Change it** when the same note needs refining');
    expect(prose).toContain('**Replace it** with a new note that names it in `<supersedes>` when the decision or the fact itself changed');
    expect(prose).toContain('**Suggest a new note** for anything else.');
    expect(prose).toContain('Read the note with `memory.read` before you quote it, and quote exactly as written.');
    expect(prose).toContain('A change you can\'t quote exactly is better written as a rewrite of that field.');
    expect(prose).toContain('The quote must appear exactly once in the field');
    expect(prose).toContain('it always waits for the writer to save it');
    // Every element the edit grammar reads is taught, and nothing else.
    const taught = [...prose.matchAll(/`<([a-z-]+)>`/g)].map((match) => match[1]);
    for (const element of WORKSHOP_MEMORY_EDIT_ELEMENTS) {
      expect(taught).toContain(element);
    }
  });

  it('carries the never-list (D9)', () => {
    expect(prose).toContain('It never records anything about the writer\'s feelings, health, relationships or private life');
    expect(prose).toContain('never say a note was saved, and never promise to remember anything');
  });
});

describe('the trailer example, through the production extractor and codec', () => {
  const examples = [...PROMPT.matchAll(/```xml\n([\s\S]*?)```/g)].map((match) => match[1].trim());

  it('shows two examples: two new notes, then a change to a saved note (Slice 6c)', () => {
    expect(examples).toHaveLength(2);
  });

  it('the first example is two trailers, which decode to the two proposals it shows', () => {
    const reply = `Good. It earns its place.\n\n${examples[0]}\n`;
    expect(extractWorkshopReplyControls(reply, { memoryOpen: true })).toEqual({
      rest: 'Good. It earns its place.',
      redacted: 'Good. It earns its place.\n\n[project memory proposal removed]\n\n[project memory proposal removed]',
      memory: {
        kind: 'frames',
        proposals: [{
          title: 'The Rabbit\'s watch runs backward',
          kind: 'canon',
          summary: 'From chapter 3 on, the White Rabbit\'s watch runs backward; nobody in Wonderland remarks on it.',
          body: 'We settled this while working the tea-party scene. The watch running backward is the first sign that time in Wonderland is wrong. Nobody comments on it; the reader notices before Alice does.',
          supersedes: ['mem-1a9e04']
        }, {
          title: 'The Hatter might know the Rabbit',
          kind: 'idea',
          summary: 'A possibility, not chosen: the Hatter and the White Rabbit knew each other before Alice arrived.',
          body: '',
          supersedes: []
        }],
        rejections: []
      }
    });
  });

  it('the second example decodes to the change it shows, in order', () => {
    const reply = `Good.\n\n${examples[1]}\n`;
    expect(extractWorkshopReplyControls(reply, { memoryOpen: true }).memory).toEqual({
      kind: 'frames',
      proposals: [{
        proposes: 'edit',
        target: 'mem-7f3c2a',
        operations: [
          { op: 'replace', field: 'body', find: 'the reader notices before Alice does', with: 'Alice notices first, and says nothing' },
          { op: 'append', text: 'The Hatter\'s watch, by contrast, is always two days slow.' }
        ]
      }],
      rejections: []
    });
  });

  it('the change quotes the first example\'s note exactly once, so it anchors', () => {
    const body = /<body>([\s\S]*?)<\/body>/.exec(examples[0])![1];
    expect(body.split('the reader notices before Alice does')).toHaveLength(2);
  });

  it('is refused anywhere but last, as the prose says', () => {
    const reply = `${examples[0]}\n\nGood. It earns its place.`;
    expect(extractWorkshopReplyControls(reply, { memoryOpen: true }).memory)
      .toEqual({ kind: 'frames', proposals: [], rejections: ['misplaced', 'misplaced'] });
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
