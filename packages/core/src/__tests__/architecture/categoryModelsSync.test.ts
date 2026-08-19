/**
 * Guard: CATEGORY_MODELS must contain the same IDs as the app manifest enum.
 *
 * package.json cannot import the TypeScript constant, so this protects the
 * manual synchronization required for Category Search settings validation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CATEGORY_MODELS, DEFAULT_CATEGORY_MODEL } from '@providers/OpenRouterModels';

describe('CATEGORY_MODELS ↔ package.json contributed enum', () => {
  const pkgPath = path.resolve(__dirname, '..', '..', '..', '..', '..', 'apps', 'vscode-extension', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const contributedSetting = pkg?.contributes?.configuration?.properties?.['proseMinion.categoryModel'];

  it('contains the same Category Search model IDs', () => {
    expect([...contributedSetting.enum].sort()).toEqual(CATEGORY_MODELS.map(model => model.id).sort());
  });

  it('keeps the shared Category Search default selectable and synchronized', () => {
    expect(contributedSetting.default).toBe(DEFAULT_CATEGORY_MODEL);
    expect(CATEGORY_MODELS.map(model => model.id)).toContain(DEFAULT_CATEGORY_MODEL);
  });
});
