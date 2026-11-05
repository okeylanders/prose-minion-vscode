import * as fs from 'fs';
import * as path from 'path';
import {
  WORKSHOP_CONVERSATION_BEHAVIOR_SETTING,
  WORKSHOP_WEB_RESEARCH_SETTING,
  WORKSHOP_WRITER_PROFILE_SETTING
} from '@messages';

/**
 * The Workshop's writer-owned settings are user settings only.
 *
 * `SettingsStore.update` writes the global level, while `get` reads VS Code's
 * merged value. A window-scoped setting therefore lets a project's
 * `.vscode/settings.json` override what the writer chose in Conversation
 * settings, including switching live web research on in a cloned repository.
 * Application scope makes VS Code ignore workspace, folder and remote values.
 * See ADR 2026-07-20's addendum of 2026-11-05.
 *
 * This reads the manifest only: VS Code enforces the scope at runtime.
 */
const WORKSHOP_SETTING_SCOPES: ReadonlyArray<{
  setting: { section: string; key: string };
  scope: string;
}> = [
  { setting: WORKSHOP_CONVERSATION_BEHAVIOR_SETTING, scope: 'application' },
  { setting: WORKSHOP_WRITER_PROFILE_SETTING, scope: 'application' },
  { setting: WORKSHOP_WEB_RESEARCH_SETTING, scope: 'application' }
];

const fullKey = ({ section, key }: { section: string; key: string }): string => `${section}.${key}`;

function contributedSettings(): Record<string, { scope?: string }> {
  const packagePath = path.resolve(
    __dirname,
    '..', '..', '..', '..', '..',
    'apps', 'vscode-extension', 'package.json'
  );
  const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return manifest.contributes.configuration.properties;
}

describe('Workshop settings scope', () => {
  it.each(WORKSHOP_SETTING_SCOPES.map(({ setting, scope }) => [fullKey(setting), scope]))(
    '%s declares %s scope',
    (key, scope) => {
      const contributed = contributedSettings()[key];

      expect(contributed).toBeDefined();
      expect(contributed.scope).toBe(scope);
    }
  );

  it('records a scope decision for every contributed Workshop setting', () => {
    const contributedWorkshopKeys = Object.keys(contributedSettings())
      .filter((key) => key.startsWith('proseMinion.workshop.'))
      .sort();
    const decidedKeys = WORKSHOP_SETTING_SCOPES.map(({ setting }) => fullKey(setting)).sort();

    expect(contributedWorkshopKeys).toEqual(decidedKeys);
  });
});
