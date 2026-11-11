/**
 * The file-edits switch (ADR 2026-11-05 D9; Q1): one global setting, so it
 * is user-only like the memory mode (no workspace can turn edits on over the
 * writer's own Off). Its modes and default (`ask`) are the code's; unset
 * reads as the default, and anything unknown fails closed to `off`.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  coerceWorkshopFileEditsMode,
  DEFAULT_WORKSHOP_FILE_EDITS_MODE,
  WORKSHOP_FILE_EDITS_MODES,
  WORKSHOP_FILE_EDITS_SETTING
} from '@messages';

const MANIFEST = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../../apps/vscode-extension/package.json'), 'utf8')) as {
  contributes: { configuration: { properties: Record<string, { scope?: string; enum?: string[]; default?: unknown }> } | Array<{ properties: Record<string, { scope?: string; enum?: string[]; default?: unknown }> }> };
};

function property(key: string) {
  const configuration = MANIFEST.contributes.configuration;
  const sections = Array.isArray(configuration) ? configuration : [configuration];
  return sections.map((section) => section.properties[key]).find((entry) => entry !== undefined);
}

describe('proseMinion.workshop.fileEdits', () => {
  const entry = property(`${WORKSHOP_FILE_EDITS_SETTING.section}.${WORKSHOP_FILE_EDITS_SETTING.key}`);

  it('is user-only', () => {
    expect(entry?.scope).toBe('application');
  });

  it('offers exactly the code\'s modes, and defaults to ask', () => {
    expect(entry?.enum).toEqual([...WORKSHOP_FILE_EDITS_MODES]);
    expect(entry?.default).toBe(DEFAULT_WORKSHOP_FILE_EDITS_MODE);
    expect(DEFAULT_WORKSHOP_FILE_EDITS_MODE).toBe('ask');
  });

  it('reads unset as ask, a known mode as itself, and anything else as off', () => {
    expect(coerceWorkshopFileEditsMode(undefined)).toBe('ask');
    expect(coerceWorkshopFileEditsMode('ask')).toBe('ask');
    expect(coerceWorkshopFileEditsMode('off')).toBe('off');
    for (const raw of ['auto', 'ASK', '', null, true, 1, { mode: 'ask' }]) {
      expect(coerceWorkshopFileEditsMode(raw)).toBe('off');
    }
  });
});
