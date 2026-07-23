import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  WORKSHOP_WRITER_PROFILE_LIMITS,
  WORKSHOP_WRITER_PROFILE_SETTING
} from '@messages';

describe('Workshop writer profile settings contract', () => {
  it('keeps the manifest default and bounds synchronized with the host contract', () => {
    const packagePath = path.resolve(
      __dirname,
      '..', '..', '..', '..', '..',
      'apps', 'vscode-extension', 'package.json'
    );
    const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const fullKey = `${WORKSHOP_WRITER_PROFILE_SETTING.section}.${WORKSHOP_WRITER_PROFILE_SETTING.key}`;
    const contributed = manifest.contributes.configuration.properties[fullKey];

    expect(contributed.scope).toBe('application');
    expect(contributed.default).toEqual(DEFAULT_WORKSHOP_WRITER_PROFILE);
    expect(contributed.required.sort()).toEqual(Object.keys(DEFAULT_WORKSHOP_WRITER_PROFILE).sort());
    expect(contributed.additionalProperties).toBe(false);
    expect(contributed.properties.preferredAddress.maxLength)
      .toBe(WORKSHOP_WRITER_PROFILE_LIMITS.preferredAddress);
    expect(contributed.properties.bio.maxLength).toBe(WORKSHOP_WRITER_PROFILE_LIMITS.bio);
  });
});
