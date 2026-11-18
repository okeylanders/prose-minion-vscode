/**
 * The persona system prompt, assembled and measured by section (ADR
 * 2026-11-18 D4). The text is the old assembly's, byte for byte; every path
 * `workshopPersonaSystemPromptPaths` returns is measured, so a new section is
 * measured with no further work; the sections are kept only when they rebuild
 * the prompt exactly; and no section carries prompt text.
 */

import {
  assembleWorkshopPersonaSystemPrompt,
  WORKSHOP_TOOL_USE_PROMPT_PATHS,
  workshopSystemPromptSectionName,
  workshopSystemPromptSectionPart,
  WorkshopPersonaSystemPromptInput
} from '@services/analysis/WorkshopPersonaSystemPrompt';
import { WorkshopSystemPromptMeasures } from '@services/analysis/WorkshopSystemPromptMeasures';
import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import {
  getWorkshopPersona,
  WORKSHOP_HELP_CAPABILITY_PROMPT_PATH,
  WORKSHOP_HOST_BASE_PROMPT_PATH,
  WORKSHOP_INTERACTION_MODE_PROMPT_PATHS,
  WORKSHOP_PERSONA_CATALOG,
  workshopPersonaSystemPromptPaths
} from '@shared/constants/workshopPersonas';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR } from '@messages';
import { buildWorkshopWriterProfileFrame } from '@/utils/workshopWriterProfile';

const jill = getWorkshopPersona('jill')!;
const text = (path: string) => `Body of ${path} for Alice.`;
const loader = () => ({
  loadPrompt: jest.fn(async (path: string) => text(path)),
  loadPrompts: jest.fn(async (paths: string[]) => paths.map(text).join('\n\n---\n\n'))
});

const input = (overrides: Partial<WorkshopPersonaSystemPromptInput> = {}): WorkshopPersonaSystemPromptInput => ({
  role: 'host',
  persona: jill,
  behavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, expressionLevel: 'amplified' },
  writerProfile: { preferredName: 'Alice' } as never,
  standingDirectiveFrames: ['  <standing-directive>Keep the rabbit</standing-directive> ', ''],
  grammars: { projectMemory: true, memorySuggestions: 'readily', fileEdits: true, personaReactions: true },
  widgetRecommendationInstruction: 'Widget contract.',
  ...overrides
});

describe('assembleWorkshopPersonaSystemPrompt (ADR 2026-11-18 D4)', () => {
  it('writes exactly what the old assembly wrote', async () => {
    const given = input();
    const paths = workshopPersonaSystemPromptPaths(WORKSHOP_HOST_BASE_PROMPT_PATH, jill, given.behavior, given.grammars);
    const profile = buildWorkshopWriterProfileFrame(given.writerProfile, given.behavior.relationalDepth);
    const chain = paths.map(text).join('\n\n---\n\n');
    const old = [profile ? `${chain}\n\n${profile}` : chain, '<standing-directive>Keep the rabbit</standing-directive>', 'Widget contract.'].join('\n\n');

    const assembled = await assembleWorkshopPersonaSystemPrompt(loader(), given);
    expect(assembled.text).toBe(old);
  });

  it('measures every path the chain returns, in order, with the host\'s names and parts', async () => {
    const given = input();
    const paths = workshopPersonaSystemPromptPaths(WORKSHOP_HOST_BASE_PROMPT_PATH, jill, given.behavior, given.grammars);
    const assembled = await assembleWorkshopPersonaSystemPrompt(loader(), given);
    const fromPaths = assembled.sections!.slice(0, paths.length);
    expect(fromPaths.map((section) => section.name)).toEqual(paths.map((path) => workshopSystemPromptSectionName(path, jill)));
    expect(fromPaths.map((section) => section.tokens)).toEqual(paths.map((path) => estimateTextTokens(text(path))));
    expect(fromPaths.map((section) => section.part)).toEqual(paths.map(workshopSystemPromptSectionPart));
    expect(assembled.sections!.slice(paths.length).map((section) => section.name))
      .toEqual(expect.arrayContaining(['Standing directives (1)', 'Widget recommendations']));
    // Item H's help section is tool-use (D5).
    expect(fromPaths.find((section) => section.name === 'Help capability')?.part).toBe('tool-use');
    expect(WORKSHOP_TOOL_USE_PROMPT_PATHS.has(WORKSHOP_HELP_CAPABILITY_PROMPT_PATH)).toBe(true);
  });

  it('names every section any persona and setting can produce, never with prompt text', async () => {
    const levels = ['subtle', 'full', 'amplified'] as const;
    for (const persona of WORKSHOP_PERSONA_CATALOG) {
      for (const expressionLevel of levels) {
        for (const interactionMode of Object.keys(WORKSHOP_INTERACTION_MODE_PROMPT_PATHS) as Array<keyof typeof WORKSHOP_INTERACTION_MODE_PROMPT_PATHS>) {
          const paths = workshopPersonaSystemPromptPaths(WORKSHOP_HOST_BASE_PROMPT_PATH, persona,
            { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, expressionLevel, interactionMode },
            { projectMemory: true, fileEdits: true, personaReactions: true });
          for (const path of paths) {
            const name = workshopSystemPromptSectionName(path, persona);
            expect(name).not.toMatch(/\.md|\//);
            expect(name.length).toBeGreaterThan(0);
          }
        }
      }
    }
    expect(workshopSystemPromptSectionName('workshop-personas/interaction-modes/balanced.md', jill)).toBe('Interaction mode: Balanced');
    expect(workshopSystemPromptSectionName('workshop-personas/some-new_section.md', jill)).toBe('Some new section');
    expect(workshopSystemPromptSectionPart('workshop-personas/some-new_section.md')).toBe('persona');
  });

  it('keeps no sections when they do not rebuild the prompt, or the loader loads only lists', async () => {
    const drifting = loader();
    drifting.loadPrompt.mockImplementation(async (path: string) => `${text(path)} changed`);
    expect((await assembleWorkshopPersonaSystemPrompt(drifting, input())).sections).toBeUndefined();
    const listsOnly = { loadPrompts: loader().loadPrompts };
    const assembled = await assembleWorkshopPersonaSystemPrompt(listsOnly, input());
    expect(assembled.sections).toBeUndefined();
    expect(assembled.text.length).toBeGreaterThan(0);
  });
});

describe('WorkshopSystemPromptMeasures (D4)', () => {
  it('measures the held message: sections when it was assembled here, its total either way', async () => {
    const measures = new WorkshopSystemPromptMeasures(2);
    const assembled = await assembleWorkshopPersonaSystemPrompt(loader(), input());
    measures.record(assembled);
    const held = measures.measure({ systemMessage: assembled.text, messageCount: 2, tally: [] })!;
    expect(held.sections).toEqual(assembled.sections);
    expect(held.systemTokens).toBe(estimateTextTokens(assembled.text));

    const unseen = measures.measure({ systemMessage: 'A prompt built elsewhere', messageCount: 0, tally: [] })!;
    expect(unseen.sections).toBeUndefined();
    expect(unseen.systemTokens).toBe(estimateTextTokens('A prompt built elsewhere'));
  });

  it('keeps only the newest prompts', async () => {
    const measures = new WorkshopSystemPromptMeasures(1);
    const first = await assembleWorkshopPersonaSystemPrompt(loader(), input());
    const second = await assembleWorkshopPersonaSystemPrompt(loader(), input({ widgetRecommendationInstruction: 'Other.' }));
    measures.record(first);
    measures.record(second);
    expect(measures.measure({ systemMessage: first.text, messageCount: 0, tally: [] })?.sections).toBeUndefined();
    expect(measures.measure({ systemMessage: second.text, messageCount: 0, tally: [] })?.sections).toBeDefined();
  });
});
