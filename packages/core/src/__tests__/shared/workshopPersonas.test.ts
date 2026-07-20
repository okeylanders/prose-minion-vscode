import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_WORKSHOP_PERSONA_ID,
  getWorkshopPersona,
  isWorkshopPersonaId,
  WORKSHOP_INTERACTION_CONTRACT_PROMPT_PATH,
  WORKSHOP_INTERACTION_MODE_PROMPT_PATHS,
  WORKSHOP_PERSONA_CATALOG,
  workshopPersonaSystemPromptPaths,
  workshopPersonaLabel
} from '@shared/constants/workshopPersonas';

const PROMPTS_ROOT = path.resolve(__dirname, '..', '..', '..', 'resources', 'system-prompts');
const EXPECTED_IDS = ['jill', 'agnes', 'cliff', 'dev', 'edna', 'felix', 'harper', 'margot', 'penny', 'quinn', 'theo', 'wren'];
const SPECIALIST_SECTION_ORDER = [
  '## Who you are',
  '## Your craft jurisdiction',
  '## How you think',
  '## How you use your thinking space',
  '## How you sound',
  '## How you behave across turns',
  '## What you do not sound like',
  '## Voice in practice',
  '## Your shelf',
  '## Colleagues'
] as const;

describe('Workshop persona catalog and packaged prompts', () => {
  it('contains exactly the deterministic host roster with Jill as its default', () => {
    expect(WORKSHOP_PERSONA_CATALOG.map((persona) => persona.id)).toEqual(EXPECTED_IDS);
    expect(DEFAULT_WORKSHOP_PERSONA_ID).toBe('jill');
    expect(isWorkshopPersonaId('quinn')).toBe(true);
    expect(isWorkshopPersonaId('tool')).toBe(false);
    expect(getWorkshopPersona('wren')?.specialty).toBe('Line craft');
    expect(workshopPersonaLabel('unknown-persona' as any)).toBe('unknown-persona');
  });

  it('uses unique, relative, contained prompt paths with non-empty curated prompt files', () => {
    const foundationPaths = WORKSHOP_PERSONA_CATALOG.map((persona) => persona.promptPath);
    const expressionPaths = WORKSHOP_PERSONA_CATALOG.map((persona) => persona.expressionProfilePath);
    const paths = [
      ...foundationPaths,
      ...expressionPaths,
      WORKSHOP_INTERACTION_CONTRACT_PROMPT_PATH,
      ...Object.values(WORKSHOP_INTERACTION_MODE_PROMPT_PATHS)
    ];
    expect(new Set(foundationPaths).size).toBe(WORKSHOP_PERSONA_CATALOG.length);
    expect(new Set(expressionPaths).size).toBe(WORKSHOP_PERSONA_CATALOG.length);

    for (const promptPath of paths) {
      expect(path.isAbsolute(promptPath)).toBe(false);
      expect(promptPath).not.toMatch(/(^|[\\/])\.\.([\\/]|$)/);
      const absolute = path.resolve(PROMPTS_ROOT, promptPath);
      expect(absolute.startsWith(`${PROMPTS_ROOT}${path.sep}`)).toBe(true);
      expect(fs.existsSync(absolute)).toBe(true);
      expect(fs.readFileSync(absolute, 'utf8').trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps every full-expression overlay reviewable and assembles exactly one selected mode', () => {
    for (const persona of WORKSHOP_PERSONA_CATALOG) {
      const expression = fs.readFileSync(
        path.resolve(PROMPTS_ROOT, persona.expressionProfilePath),
        'utf8'
      );
      expect(expression).toContain('## Your trait tensions');
      expect(expression).toContain('## Your verbal palette');

      const paths = workshopPersonaSystemPromptPaths(
        'workshop-personas/base.md',
        persona,
        'conversational'
      );
      expect(paths).toEqual([
        'workshop-personas/base.md',
        persona.promptPath,
        persona.expressionProfilePath,
        WORKSHOP_INTERACTION_CONTRACT_PROMPT_PATH,
        WORKSHOP_INTERACTION_MODE_PROMPT_PATHS.conversational
      ]);
      expect(paths).not.toContain(WORKSHOP_INTERACTION_MODE_PROMPT_PATHS.analysis);
      expect(paths).not.toContain(WORKSHOP_INTERACTION_MODE_PROMPT_PATHS.balanced);
    }
  });

  it('keeps runtime prompts product-safe rather than shipping authoring skills', () => {
    const paths = ['workshop-personas/base.md', ...WORKSHOP_PERSONA_CATALOG.map((persona) => persona.promptPath)];
    for (const promptPath of paths) {
      const content = fs.readFileSync(path.resolve(PROMPTS_ROOT, promptPath), 'utf8');
      expect(content).not.toMatch(/^---\s*\n/);
      expect(content).not.toContain('/Users/okeylanders');
      expect(content).not.toContain('zsh-setup');
      expect(content).not.toMatch(/\b(?:Codex|Claude)\b.*\b(?:skill|subagent|agent)\b/i);
    }
  });

  it('keeps every specialist prompt on the normalized persona schema', () => {
    for (const persona of WORKSHOP_PERSONA_CATALOG.filter(({ id }) => id !== 'jill')) {
      const content = fs.readFileSync(path.resolve(PROMPTS_ROOT, persona.promptPath), 'utf8');
      let previousSectionIndex = -1;

      for (const section of SPECIALIST_SECTION_ORDER) {
        const sectionIndex = content.indexOf(section);
        expect(sectionIndex).toBeGreaterThan(previousSectionIndex);
        previousSectionIndex = sectionIndex;
      }

      const voiceExamples = content.slice(
        content.indexOf('## Voice in practice'),
        content.indexOf('## Your shelf')
      );
      expect(voiceExamples.match(/^### /gm)).toHaveLength(3);
    }
  });

  it('gives hosts truthful autonomous access to configured project resources', () => {
    const base = fs.readFileSync(
      path.resolve(PROMPTS_ROOT, 'workshop-personas/base.md'),
      'utf8'
    );

    expect(base).toContain('when the turn contract advertises them, autonomously search and read configured project resources');
    expect(base).toContain('Before treating important context as unavailable');
    expect(base).toContain('inspect neighboring chapters');
    expect(base).toContain('project-bible facts');
    expect(base).toContain('do not need the writer to paste a path');
    expect(base).toContain('search directly instead of requesting the full catalog');
    expect(base).not.toContain('the three Workshop capabilities');
  });
});
