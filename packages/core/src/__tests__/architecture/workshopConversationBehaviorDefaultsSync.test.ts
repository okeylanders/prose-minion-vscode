import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  WORKSHOP_CONVERSATION_BEHAVIOR_SETTING
} from '@messages';

describe('Workshop conversation behavior settings contract', () => {
  it('keeps the contributed VS Code default synchronized with the host default', () => {
    const packagePath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      '..',
      'apps',
      'vscode-extension',
      'package.json'
    );
    const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const fullKey = `${WORKSHOP_CONVERSATION_BEHAVIOR_SETTING.section}.` +
      WORKSHOP_CONVERSATION_BEHAVIOR_SETTING.key;
    const contributed = manifest.contributes.configuration.properties[fullKey];

    expect(contributed.default).toEqual(DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
    expect(contributed.required.sort()).toEqual(
      Object.keys(DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR).sort()
    );
    expect(contributed.additionalProperties).toBe(false);
  });
});
