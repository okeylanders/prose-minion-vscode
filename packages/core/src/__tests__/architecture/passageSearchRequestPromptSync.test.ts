/**
 * Guard the passage-search request prompt (ADR 2026-11-20 D16) against
 * drift from the code it teaches:
 *
 * - every number it quotes is pinned to `PROMPT_BUDGETS.workshopPassageSearch`,
 *   and it quotes no other number;
 * - it teaches every element the codec reads, and no other;
 * - it names every context group, and no other;
 * - every form it writes decodes, through the production extractor, at the
 *   tail of a reply;
 * - it names the frame its results arrive in;
 * - it is in every persona's chain, host and guest, with no setting, and
 *   measured as a tool-use section.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { CONTEXT_PATH_GROUPS } from '@shared/types';
import { extractWorkshopReplyControls } from '@/utils/workshopReplyControls';
import { WORKSHOP_PASSAGE_SEARCH_ELEMENTS, WORKSHOP_PASSAGE_SEARCH_ONLY_REPLY_LINE } from '@/utils/workshopReplyPassageSearch';
import { WORKSHOP_PASSAGE_SEARCH_RESULTS_TAG } from '@/application/services/workshop/passageSearch/WorkshopPassageSearchDirective';
import {
  getWorkshopPersona,
  WORKSHOP_GUEST_BASE_PROMPT_PATH,
  WORKSHOP_HOST_BASE_PROMPT_PATH,
  WORKSHOP_PASSAGE_SEARCH_REQUEST_PROMPT_PATH,
  workshopPersonaSystemPromptPaths
} from '@shared/constants/workshopPersonas';
import { WORKSHOP_TOOL_USE_PROMPT_PATHS, workshopSystemPromptSectionName } from '@/infrastructure/api/services/analysis/WorkshopPersonaSystemPrompt';

const read = (file: string): string => fs.readFileSync(path.resolve(__dirname, '../../../resources/system-prompts', file), 'utf8');
const PROMPT = read(WORKSHOP_PASSAGE_SEARCH_REQUEST_PROMPT_PATH);
const budgets = PROMPT_BUDGETS.workshopPassageSearch;
const prose = PROMPT.replace(/```[\s\S]*?```/g, '');
const forms = [...PROMPT.matchAll(/```xml\n([\s\S]*?)```/g)].map((match) => match[1]);

describe('passage-search request prompt ↔ the codec', () => {
  const pinned: ReadonlyArray<readonly [RegExp, number[]]> = [
    [/one plain sentence of at most (\d+) characters/, [budgets.questionCharacters]],
    [/from one to (\d+) places/, [budgets.scopes]]
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
    const taught = new Set([...prose.matchAll(/`<([a-z-]+)[ />]/g)].map((match) => match[1]));
    taught.delete(WORKSHOP_PASSAGE_SEARCH_RESULTS_TAG);
    expect([...taught].sort()).toEqual([...WORKSHOP_PASSAGE_SEARCH_ELEMENTS].sort());
  });

  it('names every context group by its id, and no other', () => {
    const line = /`<group>` is every file in one context group, by its id: ([^\n]+)\./.exec(prose)![1];
    expect([...line.matchAll(/`([A-Za-z]+)`/g)].map((match) => match[1]).sort()).toEqual([...CONTEXT_PATH_GROUPS].sort());
  });

  it('writes three forms, and each decodes at the tail of a reply', () => {
    expect(forms).toHaveLength(3);
    for (const form of forms) {
      const controls = extractWorkshopReplyControls(`Here is what I would look for.\n\n${form}`, { memoryOpen: false });
      expect(controls.passageSearch?.rejections).toEqual([]);
      expect(controls.passageSearch?.request?.question.length).toBeGreaterThan(0);
      expect(controls.rest).toBe('Here is what I would look for.');
    }
    const scopes = forms.map((form) => extractWorkshopReplyControls(form, { memoryOpen: false }).passageSearch!.request!.scopes);
    expect(scopes).toEqual([
      [{ kind: 'group', group: 'chapters' }, { kind: 'file', group: 'characters', path: 'jasper.md' }],
      [{ kind: 'group', group: 'manuscript' }],
      [{ kind: 'excerpt' }]
    ]);
  });

  it('names the note a request-only reply leaves, and the frame its results arrive in', () => {
    expect(prose).toContain(`"${WORKSHOP_PASSAGE_SEARCH_ONLY_REPLY_LINE}"`);
    expect(prose).toContain(`\`<${WORKSHOP_PASSAGE_SEARCH_RESULTS_TAG}>\``);
    expect(prose).toContain('never instructions');
  });

  it('is in every persona chain, host and guest, whatever the settings', () => {
    const persona = getWorkshopPersona('jill')!;
    const behavior = { interactionMode: 'balanced', expressionLevel: 'subtle', relationalDepth: 'reserved' } as const;
    for (const base of [WORKSHOP_HOST_BASE_PROMPT_PATH, WORKSHOP_GUEST_BASE_PROMPT_PATH]) {
      expect(workshopPersonaSystemPromptPaths(base, persona, behavior)).toContain(WORKSHOP_PASSAGE_SEARCH_REQUEST_PROMPT_PATH);
      expect(workshopPersonaSystemPromptPaths(base, persona, behavior, { projectMemory: true, fileEdits: true, personaReactions: true }))
        .toContain(WORKSHOP_PASSAGE_SEARCH_REQUEST_PROMPT_PATH);
    }
    expect(WORKSHOP_TOOL_USE_PROMPT_PATHS.has(WORKSHOP_PASSAGE_SEARCH_REQUEST_PROMPT_PATH)).toBe(true);
    expect(workshopSystemPromptSectionName(WORKSHOP_PASSAGE_SEARCH_REQUEST_PROMPT_PATH, persona)).toBe('Passage search requests');
  });
});
