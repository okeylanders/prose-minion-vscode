/**
 * Guard the context-paths grammar prompt (ADR 2026-11-19 D26–D28) against
 * drift from the code it teaches:
 *
 * - every number it quotes is pinned to PROMPT_BUDGETS, and it quotes no
 *   other number; it names no highest page;
 * - the groups it lists are `CONTEXT_PATH_GROUPS`, in order, each with the
 *   meaning the Settings helper reads;
 * - every capability example decodes through the real codec, and one shown
 *   as refused gets the reason the prose names;
 * - the trailer example decodes through the trailer's own decoder;
 * - it rides the system prompt of host and guest alike, once, and counts as
 *   tool use in the Context panel.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { CONTEXT_PATH_GROUPS } from '@shared/types';
import {
  getWorkshopPersona,
  WORKSHOP_GUEST_BASE_PROMPT_PATH,
  WORKSHOP_HOST_BASE_PROMPT_PATH,
  WORKSHOP_LOCATIONS_CAPABILITY_PROMPT_PATH,
  workshopPersonaSystemPromptPaths
} from '@shared/constants/workshopPersonas';
import { WORKSHOP_TOOL_USE_PROMPT_PATHS } from '@/infrastructure/api/services/analysis/WorkshopPersonaSystemPrompt';
import { PROJECT_LOCATION_GROUP_MEANINGS } from '@services/helper/tasks/ProjectLocationsTask';
import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { workshopLocationsFoldersCall } from '@/application/services/workshop/locations/WorkshopLocationsRenderer';
import { extractWorkshopReplyControls } from '@/utils/workshopReplyControls';

const PROMPT = fs.readFileSync(path.resolve(__dirname,
  '../../../resources/system-prompts/workshop-personas/locations-capability.md'), 'utf8');
const budgets = PROMPT_BUDGETS.contextPaths;
const codec = new WorkshopCapabilityXmlCodec();
const prose = PROMPT.replace(/```[\s\S]*?```/g, '');
const examples = [...PROMPT.matchAll(/```xml\n([\s\S]*?)```/g)].map((match) => match[1]);

describe('locations prompt ↔ PROMPT_BUDGETS', () => {
  const pinned: ReadonlyArray<readonly [RegExp, number]> = [
    [/A page shows ([\d,]+) folders/, budgets.foldersPerPage],
    [/up to ([\d,]+) in one call/, budgets.checkPatterns],
    [/A pattern is at most ([\d,]+) characters/, budgets.patternCharacters],
    [/at most ([\d,]+) to a group/, budgets.patternsPerGroup],
    [/each at most ([\d,]+) characters/, budgets.patternCharacters]
  ];

  it.each(pinned)('quotes %s from PROMPT_BUDGETS', (pattern, expected) => {
    const match = pattern.exec(prose);
    expect(match).not.toBeNull();
    expect(Number(match![1].replace(/,/g, ''))).toBe(expected);
  });

  it('quotes no number it does not pin, and names no highest page', () => {
    const unpinned = [...pinned.map(([pattern]) => pattern), /`[^`\n]*`/]
      .reduce((text, pattern) => text.replace(new RegExp(pattern.source, 'g'), ''), prose);
    expect(unpinned.match(/\d[\d,.]*/g)).toBeNull();
    expect(prose).not.toMatch(/highest page|last page is|at most \S+ pages/i);
  });

  it('lists every group, in order, with the meaning the helper reads', () => {
    const listed = [...prose.matchAll(/^- `([A-Za-z]+)`: (.+)$/gm)].map((match) => [match[1], match[2]]);
    expect(listed).toEqual(CONTEXT_PATH_GROUPS.map((group) => [group, PROJECT_LOCATION_GROUP_MEANINGS[group]]));
  });
});

describe('locations prompt ↔ the codecs', () => {
  const calls = examples.filter((example) => example.includes('prose-minion-tool-call'));

  it('teaches each of the three calls', () => {
    const named = new Set(calls.map((call) => /name="([^"]+)"/.exec(call)![1]));
    expect([...named].sort()).toEqual(['locations.check', 'locations.current', 'locations.folders']);
  });

  it('every call decodes, or is refused for the reason the prose names', () => {
    for (const call of calls) {
      const at = PROMPT.indexOf(call);
      // The paragraph just before the example's fence says what becomes of it.
      const lead = PROMPT.slice(0, PROMPT.lastIndexOf('```xml', at)).trimEnd();
      const before = lead.slice(lead.lastIndexOf('\n\n') + 2);
      const refused = /refused as `([a-z-]+)`/.exec(before);
      const inspected = codec.inspect(call);
      if (refused) {
        expect(inspected).toMatchObject({ kind: 'invalid', reason: refused[1] });
      } else {
        expect({ call, inspected }).toEqual({ call, inspected: expect.objectContaining({ kind: 'request' }) });
      }
    }
  });

  it('teaches the continuation\'s words, and the call it writes decodes as written to a later page', () => {
    expect(prose).toContain('the result ends with "The next page:" and that page\'s whole call');
    expect(codec.inspect(workshopLocationsFoldersCall(3))).toEqual({
      kind: 'request',
      request: { capability: 'locations.folders', page: 3 }
    });
  });

  it('its proposal example decodes as one proposal through the trailer\'s decoder', () => {
    const trailer = examples.find((example) => example.includes('prose-minion-locations-proposal'))!;
    const controls = extractWorkshopReplyControls(`Here is what I'd propose.\n\n${trailer}`, { memoryOpen: false });
    expect(controls.locations).toEqual({
      proposal: { characters: ['Cast/**/*'], locations: ['Wonderland/**/*'] },
      rejections: []
    });
    expect(controls.rest.trim()).toBe('Here is what I\'d propose.');
  });

  it('teaches that the writer applies, and that a call writes nothing', () => {
    expect(prose).toContain('A call never writes a setting.');
    expect(prose).toContain('Only the writer applies it, and an applied group changes for every project of theirs.');
    expect(prose).toContain('One reply carries one proposal.');
  });
});

describe('where the prompt is taught (D26)', () => {
  it.each([WORKSHOP_HOST_BASE_PROMPT_PATH, WORKSHOP_GUEST_BASE_PROMPT_PATH])('rides %s once', (base) => {
    const behavior = { interactionMode: 'balanced', expressionLevel: 'subtle', relationalDepth: 'attuned' } as const;
    const paths = workshopPersonaSystemPromptPaths(base, getWorkshopPersona('jill')!, behavior, {});
    expect(paths.filter((entry) => entry === WORKSHOP_LOCATIONS_CAPABILITY_PROMPT_PATH)).toHaveLength(1);
  });

  it('counts as tool use in the Context panel', () => {
    expect(WORKSHOP_TOOL_USE_PROMPT_PATHS.has(WORKSHOP_LOCATIONS_CAPABILITY_PROMPT_PATH)).toBe(true);
  });
});
