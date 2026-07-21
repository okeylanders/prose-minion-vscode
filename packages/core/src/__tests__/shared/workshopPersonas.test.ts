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
    const calibrationPaths = WORKSHOP_PERSONA_CATALOG.map(
      (persona) => persona.expressionCalibrationPath
    );
    const paths = [
      ...foundationPaths,
      ...expressionPaths,
      ...calibrationPaths,
      WORKSHOP_INTERACTION_CONTRACT_PROMPT_PATH,
      ...Object.values(WORKSHOP_INTERACTION_MODE_PROMPT_PATHS)
    ];
    expect(new Set(foundationPaths).size).toBe(WORKSHOP_PERSONA_CATALOG.length);
    expect(new Set(expressionPaths).size).toBe(WORKSHOP_PERSONA_CATALOG.length);
    expect(new Set(calibrationPaths).size).toBe(calibrationPaths.length);

    for (const promptPath of paths) {
      expect(path.isAbsolute(promptPath)).toBe(false);
      expect(promptPath).not.toMatch(/(^|[\\/])\.\.([\\/]|$)/);
      const absolute = path.resolve(PROMPTS_ROOT, promptPath);
      expect(absolute.startsWith(`${PROMPTS_ROOT}${path.sep}`)).toBe(true);
      expect(fs.existsSync(absolute)).toBe(true);
      expect(fs.readFileSync(absolute, 'utf8').trim().length).toBeGreaterThan(0);
    }
  });

  it('conditionally assembles expression resources and exactly one selected mode', () => {
    for (const persona of WORKSHOP_PERSONA_CATALOG) {
      const expression = fs.readFileSync(
        path.resolve(PROMPTS_ROOT, persona.expressionProfilePath),
        'utf8'
      );
      expect(expression).toContain('## Your trait tensions');
      expect(expression).toContain('## Your verbal palette');
      expect(expression).toContain('At Full these behaviors reach their authored saturation');

      const subtlePaths = workshopPersonaSystemPromptPaths(
        'workshop-personas/base.md',
        persona,
        { interactionMode: 'conversational', expressionLevel: 'subtle' }
      );
      expect(subtlePaths).toEqual([
        'workshop-personas/base.md',
        persona.promptPath,
        WORKSHOP_INTERACTION_CONTRACT_PROMPT_PATH,
        WORKSHOP_INTERACTION_MODE_PROMPT_PATHS.conversational
      ]);

      const fullPaths = workshopPersonaSystemPromptPaths(
        'workshop-personas/base.md',
        persona,
        { interactionMode: 'conversational', expressionLevel: 'full' }
      );
      expect(fullPaths).toEqual([
        'workshop-personas/base.md',
        persona.promptPath,
        WORKSHOP_INTERACTION_CONTRACT_PROMPT_PATH,
        WORKSHOP_INTERACTION_MODE_PROMPT_PATHS.conversational,
        persona.expressionProfilePath
      ]);
      expect(fullPaths).not.toContain(WORKSHOP_INTERACTION_MODE_PROMPT_PATHS.analysis);
      expect(fullPaths).not.toContain(WORKSHOP_INTERACTION_MODE_PROMPT_PATHS.balanced);

      const amplifiedPaths = workshopPersonaSystemPromptPaths(
        'workshop-personas/base.md',
        persona,
        { interactionMode: 'conversational', expressionLevel: 'amplified' }
      );
      expect(amplifiedPaths).toEqual([
        'workshop-personas/base.md',
        persona.promptPath,
        WORKSHOP_INTERACTION_CONTRACT_PROMPT_PATH,
        WORKSHOP_INTERACTION_MODE_PROMPT_PATHS.conversational,
        persona.expressionProfilePath,
        persona.expressionCalibrationPath
      ]);
    }
  });

  it('ships reviewed Amplified calibrations for the complete persona roster', () => {
    const calibrated = WORKSHOP_PERSONA_CATALOG;
    expect(calibrated.map((persona) => persona.id)).toEqual(EXPECTED_IDS);

    for (const persona of calibrated) {
      const calibration = fs.readFileSync(
        path.resolve(PROMPTS_ROOT, persona.expressionCalibrationPath),
        'utf8'
      );
      expect(calibration).toContain('## Lexical gravity');
      expect(calibration).toContain('## Lexical field map');
      expect(calibration).toContain('**Neutral baseline:**');
      expect(calibration).toContain('## Signature activation');
      expect(calibration).toMatch(/substantive/i);
      expect(calibration).toMatch(/at least one/i);
      expect(calibration).toContain('## Communication gradients');
      expect(calibration).toContain('## Trait pressure');
      expect(calibration).toContain('## Amplification discipline');
      expect(calibration).toMatch(/Default:/);
      expect(calibration).toMatch(/(?:ceiling|closed|outside the range)/i);
    }
  });

  it('requires visible Amplified identity while bounding persona improv to the session', () => {
    const contract = fs.readFileSync(
      path.resolve(PROMPTS_ROOT, WORKSHOP_INTERACTION_CONTRACT_PROMPT_PATH),
      'utf8'
    );
    const jillProfile = fs.readFileSync(
      path.resolve(PROMPTS_ROOT, 'workshop-personas/expression-profiles/jill.md'),
      'utf8'
    );
    const jillCalibration = fs.readFileSync(
      path.resolve(PROMPTS_ROOT, 'workshop-personas/expression-calibrations/jill.md'),
      'utf8'
    );

    expect(contract).toContain('Full is the natural complete personality');
    expect(contract).toContain('Trait tensions are alive, not preemptive brakes');
    expect(contract).toContain('Every substantive reply makes at least one authored signature move visible');
    expect(contract).toContain('zero signature is under-expression');
    expect(contract).toContain('Persona improv before durable history');
    expect(contract).toContain('This is play, not hidden memory');
    expect(contract).toContain('noncanonical and session-bounded');
    expect(contract).toContain('not durable relationship canon');
    expect(contract).toContain('Harmless tics, awkward jokes, repeated phrases');
    expect(contract).not.toContain('do not invent one to seem alive');
    expect(jillProfile).toContain('Pop and YA shorthand');
    expect(jillProfile).toContain('Idiomatic pressure');
    expect(jillCalibration).toContain('Pop and YA memory');
    expect(jillCalibration).toContain('Mild cringe');
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
