/**
 * Guard: CATEGORY_MODELS must contain the same IDs as the app manifest enum.
 *
 * package.json cannot import the TypeScript constant, so this protects the
 * manual synchronization required for Category Search settings validation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CATEGORY_MODELS } from '@providers/OpenRouterModels';

describe('CATEGORY_MODELS ↔ package.json contributed enum', () => {
  it('contains the same Category Search model IDs', () => {
    // packages/core/src/__tests__/architecture -> repo root (../ x5).
    const pkgPath = path.resolve(__dirname, '..', '..', '..', '..', '..', 'apps', 'vscode-extension', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const contributedIds = pkg?.contributes?.configuration?.properties?.['proseMinion.categoryModel']?.enum;

    expect([...contributedIds].sort()).toEqual(CATEGORY_MODELS.map(model => model.id).sort());
  });
});
