/**
 * How readily personas suggest notes (Everyday Conveniences, Round Two,
 * item B): the closed level list, the three proposals prompts, the manifest
 * and the prompt assembly, held together.
 *
 * - **Sparingly is today.** Its file is the proposals prompt as it was
 *   before the setting, pinned by its recorded SHA-256, and its paragraph by
 *   a copy. With the setting at its default, the assembled persona prompt is
 *   byte for byte what the list of files before the setting assembles.
 * - **One paragraph moves.** Everything outside it is byte-identical across
 *   the three files, and every level keeps the bounds that never move, word
 *   for word.
 * - **Exactly one file, and none while memory is off.**
 * - **The manifest's enum is the code's list.**
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { FileSystem } from '@/platform';
import { PromptLoader } from '@/tools/shared/prompts';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  coerceWorkshopMemorySuggestionLevel,
  DEFAULT_WORKSHOP_MEMORY_SUGGESTION_LEVEL,
  isWorkshopMemorySuggestionLevel,
  WORKSHOP_MEMORY_SUGGESTION_LEVELS,
  WORKSHOP_MEMORY_SUGGESTIONS_SETTING,
  type WorkshopMemorySuggestionLevel
} from '@shared/constants/workshopMemorySuggestions';
import {
  getWorkshopPersona,
  WORKSHOP_ANALYSIS_CAPABILITY_PROMPT_PATH,
  WORKSHOP_GUEST_BASE_PROMPT_PATH,
  WORKSHOP_HOST_BASE_PROMPT_PATH,
  WORKSHOP_INTERACTION_CONTRACT_PROMPT_PATH,
  WORKSHOP_HELP_CAPABILITY_PROMPT_PATH,
  WORKSHOP_HISTORY_CAPABILITY_PROMPT_PATH,
  WORKSHOP_LENS_CAPABILITY_PROMPT_PATH,
  WORKSHOP_INTERACTION_MODE_PROMPT_PATHS,
  WORKSHOP_PROJECT_MEMORY_CAPABILITY_PROMPT_PATH,
  WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATH,
  WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATHS,
  WORKSHOP_REACTIONS_PROMPT_PATH,
  WORKSHOP_RELATIONAL_CONTRACT_PROMPT_PATH,
  WORKSHOP_RELATIONAL_DEPTH_PROMPT_PATHS,
  WORKSHOP_TRANSCRIPT_RECALL_CAPABILITY_PROMPT_PATH,
  WORKSHOP_TODO_STATUS_PROMPT_PATH,
  workshopPersonaSystemPromptPaths
} from '@shared/constants/workshopPersonas';

const CORE_ROOT = path.resolve(__dirname, '../../..');
const PROMPTS_ROOT = path.join(CORE_ROOT, 'resources/system-prompts');
const read = (promptPath: string): string => fs.readFileSync(path.join(PROMPTS_ROOT, promptPath), 'utf8');
const FILES = Object.fromEntries(
  WORKSHOP_MEMORY_SUGGESTION_LEVELS.map((level) => [level, read(WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATHS[level])])
) as Record<WorkshopMemorySuggestionLevel, string>;

/** The proposals prompt before the setting existed (recorded 2026-11-17, before this slice). */
const SPARINGLY_SHA256 = 'aa233638cc0c34763125c56ad83e59b2f149b4f2a9d5888a99a622e5b00f96f5';

/** Today's paragraph, copied: the one that moves with the level. */
const SPARINGLY_PARAGRAPH = 'Don\'t suggest one for something the notes already say, something only this conversation needs, or a passing thought. ' +
  'Most replies suggest none. One reply suggests at most 10 notes. Suggest several only when the writer asks for them, ' +
  'or when several distinct things settled in this exchange. Each one stands alone: it names one thing, and it never ' +
  'repeats or overlaps another suggestion in the same reply.';

const OPENS = 'Don\'t suggest one for something the notes already say';
const BOUND = 'One reply suggests at most 10 notes.';
const ALONE = 'Each one stands alone: it names one thing, and it never repeats or overlaps another suggestion in the same reply.';

/** The file split around its one level paragraph: the line that opens with `OPENS`. */
function parts(file: string): { before: string; paragraph: string; after: string } {
  const lines = file.split('\n');
  const at = lines.flatMap((line, index) => (line.startsWith(OPENS) ? [index] : []));
  expect(at).toHaveLength(1);
  return {
    before: lines.slice(0, at[0]).join('\n'),
    paragraph: lines[at[0]],
    after: lines.slice(at[0] + 1).join('\n')
  };
}

describe('the closed list of memory-suggestion levels', () => {
  it('is three levels, Sparingly the default, and anything unknown reads as the default', () => {
    expect([...WORKSHOP_MEMORY_SUGGESTION_LEVELS]).toEqual(['sparingly', 'readily', 'aggressively']);
    expect(DEFAULT_WORKSHOP_MEMORY_SUGGESTION_LEVEL).toBe('sparingly');
    for (const level of WORKSHOP_MEMORY_SUGGESTION_LEVELS) {
      expect(coerceWorkshopMemorySuggestionLevel(level)).toBe(level);
    }
    for (const raw of [undefined, null, '', 'Readily', 'always', 3, true, {}]) {
      expect(isWorkshopMemorySuggestionLevel(raw)).toBe(false);
      expect(coerceWorkshopMemorySuggestionLevel(raw)).toBe('sparingly');
    }
  });

  it('has one proposals file per level and no other: Sparingly is the file that was always there', () => {
    expect(Object.keys(WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATHS)).toEqual([...WORKSHOP_MEMORY_SUGGESTION_LEVELS]);
    expect(WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATHS.sparingly).toBe('workshop-personas/project-memory-proposals.md');
    expect(WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATHS.sparingly).toBe(WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATH);
    expect(new Set(Object.values(WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATHS)).size).toBe(WORKSHOP_MEMORY_SUGGESTION_LEVELS.length);
    const others = fs.readdirSync(path.join(PROMPTS_ROOT, 'workshop-personas/memory-suggestions')).sort();
    expect(others.map((file) => `workshop-personas/memory-suggestions/${file}`)).toEqual([
      WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATHS.aggressively,
      WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATHS.readily
    ]);
  });
});

describe('the three proposals prompts', () => {
  it('Sparingly is the prompt as it was before the setting, byte for byte', () => {
    expect(createHash('sha256').update(fs.readFileSync(path.join(PROMPTS_ROOT, WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATH))).digest('hex'))
      .toBe(SPARINGLY_SHA256);
    expect(parts(FILES.sparingly).paragraph).toBe(SPARINGLY_PARAGRAPH);
  });

  it('are byte-identical outside the one paragraph', () => {
    const sparingly = parts(FILES.sparingly);
    for (const level of WORKSHOP_MEMORY_SUGGESTION_LEVELS) {
      const file = parts(FILES[level]);
      expect(file.before).toBe(sparingly.before);
      expect(file.after).toBe(sparingly.after);
    }
  });

  it('differ from each other in that paragraph', () => {
    const paragraphs = WORKSHOP_MEMORY_SUGGESTION_LEVELS.map((level) => parts(FILES[level]).paragraph);
    expect(new Set(paragraphs).size).toBe(paragraphs.length);
  });

  it.each([...WORKSHOP_MEMORY_SUGGESTION_LEVELS])('%s keeps the bounds that never move, word for word, and ends on them', (level) => {
    const { paragraph } = parts(FILES[level]);
    expect(paragraph.startsWith(OPENS)).toBe(true);
    expect(paragraph.split(BOUND)).toHaveLength(2);
    expect(paragraph.endsWith(ALONE)).toBe(true);
    expect(paragraph.indexOf(BOUND)).toBeLessThan(paragraph.indexOf(ALONE));
    // The ceiling is the budget's, and the paragraph quotes no other figure.
    expect(BOUND).toContain(` ${PROMPT_BUDGETS.workshopProjectMemory.proposalsPerReply} `);
    expect(paragraph.replace(BOUND, '').match(/\d/)).toBeNull();
  });

  it('only Sparingly holds the brake; the others say how often instead', () => {
    expect(parts(FILES.sparingly).paragraph).toContain('Most replies suggest none.');
    expect(parts(FILES.readily).paragraph).not.toContain('Most replies suggest none.');
    expect(parts(FILES.aggressively).paragraph).not.toContain('Most replies suggest none.');
    expect(parts(FILES.readily).paragraph).toContain('about one reply in three suggests a note');
    expect(parts(FILES.aggressively).paragraph).toContain('most replies suggest at least one note');
  });
});

describe('which proposals prompt a persona is given', () => {
  const jill = getWorkshopPersona('jill')!;
  const behavior = { interactionMode: 'conversational', expressionLevel: 'subtle', relationalDepth: 'reserved' } as const;
  const bases = [WORKSHOP_HOST_BASE_PROMPT_PATH, WORKSHOP_GUEST_BASE_PROMPT_PATH];
  const proposalFiles = Object.values(WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATHS);

  it.each([...WORKSHOP_MEMORY_SUGGESTION_LEVELS])('%s: exactly its own file, directly after the grammar, for host and guest', (level) => {
    for (const base of bases) {
      const paths = workshopPersonaSystemPromptPaths(base, jill, behavior, { projectMemory: true, memorySuggestions: level });
      expect(paths.filter((each) => proposalFiles.includes(each))).toEqual([WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATHS[level]]);
      expect(paths.indexOf(WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATHS[level]))
        .toBe(paths.indexOf(WORKSHOP_PROJECT_MEMORY_CAPABILITY_PROMPT_PATH) + 1);
    }
  });

  it('off stays off: no level adds a proposals file while memory is off', () => {
    for (const base of bases) {
      for (const level of WORKSHOP_MEMORY_SUGGESTION_LEVELS) {
        const paths = workshopPersonaSystemPromptPaths(base, jill, behavior, { memorySuggestions: level });
        expect(paths.filter((each) => proposalFiles.includes(each))).toEqual([]);
        expect(paths).toEqual(workshopPersonaSystemPromptPaths(base, jill, behavior));
      }
    }
  });

  it('a level changes nothing but that one entry', () => {
    const sparingly = workshopPersonaSystemPromptPaths(WORKSHOP_HOST_BASE_PROMPT_PATH, jill, behavior, { projectMemory: true });
    for (const level of ['readily', 'aggressively'] as const) {
      const paths = workshopPersonaSystemPromptPaths(WORKSHOP_HOST_BASE_PROMPT_PATH, jill, behavior, { projectMemory: true, memorySuggestions: level });
      expect(paths.map((each) => (each === WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATHS[level] ? WORKSHOP_PROJECT_MEMORY_PROPOSALS_PROMPT_PATH : each)))
        .toEqual(sparingly);
    }
  });
});

describe('the default\'s assembled prompt, through the production loader', () => {
  const jill = getWorkshopPersona('jill')!;
  const behavior = { interactionMode: 'conversational', expressionLevel: 'subtle', relationalDepth: 'reserved' } as const;
  const fileSystem = { readFile: async (file: string) => new Uint8Array(fs.readFileSync(file)) } as unknown as FileSystem;
  const loader = new PromptLoader(CORE_ROOT, fileSystem);

  /** The chain as it was written before the setting: the one proposals file, named outright. */
  const before = (base: string): string[] => [
    base,
    jill.promptPath,
    WORKSHOP_ANALYSIS_CAPABILITY_PROMPT_PATH,
    WORKSHOP_TRANSCRIPT_RECALL_CAPABILITY_PROMPT_PATH,
    WORKSHOP_PROJECT_MEMORY_CAPABILITY_PROMPT_PATH,
    'workshop-personas/project-memory-proposals.md',
    // The to-do status, help, history and lens grammars joined the chain after the setting (ADR 2026-11-17 D16,
    // ADR 2026-11-19 D10, D11); it is the same at every level.
    WORKSHOP_TODO_STATUS_PROMPT_PATH,
    WORKSHOP_HELP_CAPABILITY_PROMPT_PATH,
    WORKSHOP_HISTORY_CAPABILITY_PROMPT_PATH,
    WORKSHOP_LENS_CAPABILITY_PROMPT_PATH,
    WORKSHOP_INTERACTION_CONTRACT_PROMPT_PATH,
    WORKSHOP_INTERACTION_MODE_PROMPT_PATHS.conversational,
    WORKSHOP_RELATIONAL_CONTRACT_PROMPT_PATH,
    WORKSHOP_RELATIONAL_DEPTH_PROMPT_PATHS.reserved,
    WORKSHOP_REACTIONS_PROMPT_PATH
  ];

  it.each([WORKSHOP_HOST_BASE_PROMPT_PATH, WORKSHOP_GUEST_BASE_PROMPT_PATH])('%s: unset and Sparingly are byte for byte the prompt before the setting', async (base) => {
    const expected = await loader.loadPrompts(before(base));
    const unset = await loader.loadPrompts(workshopPersonaSystemPromptPaths(base, jill, behavior, { projectMemory: true }));
    const sparingly = await loader.loadPrompts(
      workshopPersonaSystemPromptPaths(base, jill, behavior, { projectMemory: true, memorySuggestions: 'sparingly' })
    );
    expect(unset).toBe(expected);
    expect(sparingly).toBe(expected);
    expect(expected).toContain(SPARINGLY_PARAGRAPH);
  });

  it('another level\'s assembled prompt differs from the default\'s only by its paragraph', async () => {
    const sparingly = await loader.loadPrompts(workshopPersonaSystemPromptPaths(WORKSHOP_HOST_BASE_PROMPT_PATH, jill, behavior, { projectMemory: true }));
    for (const level of ['readily', 'aggressively'] as const) {
      const prompt = await loader.loadPrompts(
        workshopPersonaSystemPromptPaths(WORKSHOP_HOST_BASE_PROMPT_PATH, jill, behavior, { projectMemory: true, memorySuggestions: level })
      );
      expect(prompt).not.toBe(sparingly);
      expect(prompt.replace(parts(FILES[level]).paragraph, SPARINGLY_PARAGRAPH)).toBe(sparingly);
    }
  });
});

describe('proseMinion.workshop.memory.suggestions in the manifest', () => {
  type Property = { type?: string; scope?: string; enum?: string[]; enumDescriptions?: string[]; default?: unknown; markdownDescription?: string };
  const manifest = JSON.parse(fs.readFileSync(path.resolve(CORE_ROOT, '../../apps/vscode-extension/package.json'), 'utf8')) as {
    contributes: { configuration: { properties: Record<string, Property> } | Array<{ properties: Record<string, Property> }> };
  };
  const configuration = manifest.contributes.configuration;
  const entry = (Array.isArray(configuration) ? configuration : [configuration])
    .map((section) => section.properties[`${WORKSHOP_MEMORY_SUGGESTIONS_SETTING.section}.${WORKSHOP_MEMORY_SUGGESTIONS_SETTING.key}`])
    .find((property) => property !== undefined);

  it('is the setting the code reads', () => {
    expect(WORKSHOP_MEMORY_SUGGESTIONS_SETTING).toEqual({ section: 'proseMinion', key: 'workshop.memory.suggestions' });
    expect(entry?.type).toBe('string');
  });

  it('is user-only, like the memory mode beside it', () => {
    expect(entry?.scope).toBe('application');
  });

  it('offers exactly the code\'s levels, one description each, and defaults to Sparingly', () => {
    expect(entry?.enum).toEqual([...WORKSHOP_MEMORY_SUGGESTION_LEVELS]);
    expect(entry?.enumDescriptions).toHaveLength(WORKSHOP_MEMORY_SUGGESTION_LEVELS.length);
    expect(entry?.default).toBe(DEFAULT_WORKSHOP_MEMORY_SUGGESTION_LEVEL);
  });

  it('states Save and tell me\'s limit from the budget', () => {
    expect(entry?.markdownDescription).toContain(`at most ${PROMPT_BUDGETS.workshopProjectMemory.autoSavesPerRoom} are saved in one conversation`);
  });
});
