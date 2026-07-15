import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_WORKSHOP_PERSONA_ID,
  getWorkshopPersona,
  isWorkshopPersonaId,
  WORKSHOP_PERSONA_CATALOG,
  workshopPersonaLabel
} from '@shared/constants/workshopPersonas';

const PROMPTS_ROOT = path.resolve(__dirname, '..', '..', '..', 'resources', 'system-prompts');
const EXPECTED_IDS = ['jill', 'agnes', 'cliff', 'dev', 'edna', 'felix', 'harper', 'margot', 'penny', 'quinn', 'theo', 'wren'];

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
    const paths = WORKSHOP_PERSONA_CATALOG.map((persona) => persona.promptPath);
    expect(new Set(paths).size).toBe(WORKSHOP_PERSONA_CATALOG.length);

    for (const promptPath of paths) {
      expect(path.isAbsolute(promptPath)).toBe(false);
      expect(promptPath).not.toMatch(/(^|[\\/])\.\.([\\/]|$)/);
      const absolute = path.resolve(PROMPTS_ROOT, promptPath);
      expect(absolute.startsWith(`${PROMPTS_ROOT}${path.sep}`)).toBe(true);
      expect(fs.existsSync(absolute)).toBe(true);
      expect(fs.readFileSync(absolute, 'utf8').trim().length).toBeGreaterThan(0);
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

  it('gives hosts truthful autonomous access to configured project resources', () => {
    const base = fs.readFileSync(
      path.resolve(PROMPTS_ROOT, 'workshop-personas/base.md'),
      'utf8'
    );

    expect(base).toContain('autonomously search and read configured project resources');
    expect(base).toContain('Before treating important context as unavailable');
    expect(base).toContain('inspect neighboring chapters');
    expect(base).toContain('project-bible facts');
    expect(base).toContain('do not need the writer to paste a path');
    expect(base).toContain('search directly instead of requesting the full catalog');
    expect(base).not.toContain('the three Workshop capabilities');
  });
});
