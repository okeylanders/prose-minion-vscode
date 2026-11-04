/**
 * The project-memory switch in the manifest (ADR 2026-11-04 D8; PR #197
 * F-01): one global mode for every project, so it is user-only. A setting's
 * omitted scope is `window`, which a repository's `.vscode/settings.json`
 * can override; `application` is read from user settings alone, so no
 * project can turn memory on over the writer's own Off. Its modes and
 * default are the code's.
 */
import * as fs from 'fs';
import * as path from 'path';
import { WORKSHOP_PROJECT_MEMORY_MODES, WORKSHOP_PROJECT_MEMORY_SETTING, coerceWorkshopProjectMemoryMode } from '@messages';

const MANIFEST = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../../apps/vscode-extension/package.json'), 'utf8')) as {
  contributes: { configuration: { properties: Record<string, { scope?: string; enum?: string[]; default?: unknown }> } | Array<{ properties: Record<string, { scope?: string; enum?: string[]; default?: unknown }> }> };
};

function property(key: string) {
  const configuration = MANIFEST.contributes.configuration;
  const sections = Array.isArray(configuration) ? configuration : [configuration];
  return sections.map((section) => section.properties[key]).find((entry) => entry !== undefined);
}

describe('proseMinion.workshop.projectMemory in the manifest', () => {
  const entry = property(`${WORKSHOP_PROJECT_MEMORY_SETTING.section}.${WORKSHOP_PROJECT_MEMORY_SETTING.key}`);

  it('is user-only, so no workspace can override the writer\'s global mode', () => {
    expect(entry?.scope).toBe('application');
  });

  it('offers exactly the code\'s modes, and defaults to off', () => {
    expect(entry?.enum).toEqual([...WORKSHOP_PROJECT_MEMORY_MODES]);
    expect(entry?.default).toBe('off');
    expect(coerceWorkshopProjectMemoryMode(entry?.default)).toBe('off');
  });
});
