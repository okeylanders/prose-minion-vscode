/**
 * Guard the file-edit proposal prompt (ADR 2026-11-05 D2, D5, D9; epic
 * Slice 3) against drift from the code it teaches:
 *
 * - every number it quotes is pinned to PROMPT_BUDGETS, and it quotes no
 *   other number;
 * - its worked example decodes, through the production extractor and codec,
 *   to the edits it shows, placed last as the prose says;
 * - it teaches every element the codec reads, the four operations, the
 *   quoting rule, the per-target rules, and that nothing changes until the
 *   writer applies;
 * - it is taught to host and guest only while the setting is `ask`.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { CONTEXT_PATH_GROUPS } from '@shared/types/context';
import { extractWorkshopReplyControls } from '@/utils/workshopReplyControls';
import { WORKSHOP_FILE_EDIT_ELEMENTS } from '@/utils/workshopFileEditProtocol';
import {
  getWorkshopPersona,
  WORKSHOP_FILE_EDIT_PROPOSALS_PROMPT_PATH,
  WORKSHOP_GUEST_BASE_PROMPT_PATH,
  WORKSHOP_HOST_BASE_PROMPT_PATH,
  workshopPersonaSystemPromptPaths
} from '@shared/constants/workshopPersonas';

const PROMPT = fs.readFileSync(path.resolve(__dirname,
  '../../../resources/system-prompts/workshop-personas/file-edit-proposals.md'), 'utf8');
const budgets = PROMPT_BUDGETS.workshopFileEdits;
const number = (quoted: string): number => Number(quoted.replace(/,/g, ''));
const prose = PROMPT.replace(/```[\s\S]*?```/g, '');

describe('file-edit proposal prompt ↔ PROMPT_BUDGETS', () => {
  const pinned: ReadonlyArray<readonly [RegExp, number[]]> = [
    [/One reply suggests at most ([\d,]+) edits/, [budgets.proposalsPerReply]],
    [/a trailer longer than ([\d,]+) characters is dropped whole/, [budgets.frameCharacters]],
    [/`<why>`: required, one line, at most ([\d,]+) characters/, [budgets.whyCharacters]],
    [/quoted, at most ([\d,]+) characters, and what takes its place, at most ([\d,]+) characters/, [budgets.findCharacters, budgets.replaceWithCharacters]],
    [/At most ([\d,]+) find-and-replace pairs in one trailer/, [budgets.editReplaces]],
    [/each at most once and at most ([\d,]+) characters/, [budgets.insertCharacters]],
    [/after any front matter, at most ([\d,]+) characters/, [budgets.rewriteCharacters]],
    [/An append or a prepend adds at most ([\d,]+) words/, [budgets.insertWords]]
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

  it('teaches every element the codec reads, and no other', () => {
    const taught = new Set([...PROMPT.matchAll(/`<([a-z-]+)\/?>`/g)].map((match) => match[1]));
    for (const element of WORKSHOP_FILE_EDIT_ELEMENTS) {
      expect(taught).toContain(element);
    }
  });

  it('teaches the targets, the quoting rule and the per-target rules', () => {
    expect(prose).toContain('Name it as `resource.read` does: `<group>` and `<path>`');
    expect(prose).toContain('never an absolute path or a `..`');
    expect(prose).toContain('Or write `<excerpt/>` alone');
    expect(prose).toContain('Quote the file as it stands, exactly, enough to be unique');
    expect(prose).toContain('Read the file with `resource.read` before you quote it.');
    expect(prose).toContain('**Notes** take all four: a rewrite, find-and-replace, append and prepend.');
    expect(prose).toContain('is never rewritten whole');
    expect(prose).toContain('A rewrite takes no other change.');
    expect(prose).toContain('Prefer find-and-replace: it changes only what it quotes.');
    expect(prose).toContain('Rewrite only a short note with no links, images or code');
    expect(prose).toContain('never write `<rewrite>` for a chapter');
    // The prose groups it names are real groups.
    for (const group of [...prose.matchAll(/\*\*Prose\*\* \(([^)]*)\)/g)][0][1].matchAll(/`([a-zA-Z]+)`/g)) {
      expect(CONTEXT_PATH_GROUPS as readonly string[]).toContain(group[1]);
    }
  });

  it('teaches that nothing changes until the writer applies', () => {
    expect(prose).toContain('Nothing changes in a file until the writer applies it');
    expect(prose).toContain('never say a file was changed');
  });
});

describe('the worked example, through the production extractor and codec', () => {
  const examples = [...PROMPT.matchAll(/```xml\n([\s\S]*?)```/g)].map((match) => match[1].trim());

  it('shows one example of two trailers', () => {
    expect(examples).toHaveLength(1);
  });

  it('decodes to the two edits it shows, in order', () => {
    const reply = `Alice is ten now, and the Rabbit's line is cut.\n\n${examples[0]}\n`;
    const controls = extractWorkshopReplyControls(reply, { memoryOpen: false, fileEditsOpen: true });
    expect(controls.rest).toBe('Alice is ten now, and the Rabbit\'s line is cut.');
    expect(controls.fileEdits).toEqual({
      kind: 'frames',
      proposals: [{
        target: { kind: 'resource', group: 'characters', path: 'characters/alice.md' },
        why: 'Alice\'s age changed when we moved the story to her tenth summer.',
        operations: [
          { op: 'replace', find: 'Alice is seven and a half', with: 'Alice is ten' },
          { op: 'append', text: 'She is old enough to be impatient with her sister\'s book, and young enough to follow a rabbit.' }
        ]
      }, {
        target: { kind: 'excerpt' },
        why: 'The cut you asked for: the Rabbit\'s line lands harder alone.',
        operations: [{
          op: 'replace',
          find: '"Oh dear! Oh dear! I shall be late!" said the Rabbit, quite out of breath.',
          with: '"Oh dear! Oh dear! I shall be late!"'
        }]
      }],
      rejections: []
    });
  });

  it('is refused anywhere but last, as the prose says', () => {
    const reply = `${examples[0]}\n\nAlice is ten now.`;
    expect(extractWorkshopReplyControls(reply, { memoryOpen: false, fileEditsOpen: true }).fileEdits)
      .toEqual({ kind: 'frames', proposals: [], rejections: ['misplaced', 'misplaced'] });
  });

  it('the prose example uses no rewrite, as the prose rule says', () => {
    expect(examples[0]).not.toContain('<rewrite>');
  });
});

describe('when the file-edit prompt is taught (D9)', () => {
  const jill = getWorkshopPersona('jill')!;
  const behavior = { interactionMode: 'conversational', expressionLevel: 'subtle', relationalDepth: 'reserved' } as const;

  it('host and guest, only while the setting is on, and independent of memory', () => {
    expect(WORKSHOP_FILE_EDIT_PROPOSALS_PROMPT_PATH).toBe('workshop-personas/file-edit-proposals.md');
    for (const base of [WORKSHOP_HOST_BASE_PROMPT_PATH, WORKSHOP_GUEST_BASE_PROMPT_PATH]) {
      expect(workshopPersonaSystemPromptPaths(base, jill, behavior, { fileEdits: true })).toContain(WORKSHOP_FILE_EDIT_PROPOSALS_PROMPT_PATH);
      expect(workshopPersonaSystemPromptPaths(base, jill, behavior, { fileEdits: true, projectMemory: true }))
        .toContain(WORKSHOP_FILE_EDIT_PROPOSALS_PROMPT_PATH);
      expect(workshopPersonaSystemPromptPaths(base, jill, behavior, { projectMemory: true })).not.toContain(WORKSHOP_FILE_EDIT_PROPOSALS_PROMPT_PATH);
      expect(workshopPersonaSystemPromptPaths(base, jill, behavior)).not.toContain(WORKSHOP_FILE_EDIT_PROPOSALS_PROMPT_PATH);
    }
  });

  it('never to a base that is not a participant\'s', () => {
    expect(workshopPersonaSystemPromptPaths('workshop-personas/other.md', jill, behavior, { fileEdits: true }))
      .not.toContain(WORKSHOP_FILE_EDIT_PROPOSALS_PROMPT_PATH);
  });
});
