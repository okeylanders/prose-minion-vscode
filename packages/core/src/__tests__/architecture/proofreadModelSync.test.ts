/**
 * Guard: the manifest's `proseMinion.proofreadModel` default is the code's
 * `DEFAULT_PROOFREAD_MODEL` (ADR 2026-10-21 D6), and it is a curated model.
 *
 * package.json cannot import the TypeScript constant, and VS Code serves the
 * manifest default whenever the writer has not chosen a model, so the two
 * must never drift.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_PROOFREAD_MODEL } from '@orchestration/ModelScopeSelections';
import { RECOMMENDED_MODELS } from '@providers/OpenRouterModels';

describe('DEFAULT_PROOFREAD_MODEL ↔ package.json proofreadModel', () => {
  const pkgPath = path.resolve(__dirname, '..', '..', '..', '..', '..', 'apps', 'vscode-extension', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const contributedSetting = pkg?.contributes?.configuration?.properties?.['proseMinion.proofreadModel'];

  it('defaults to the same model in code and in the manifest', () => {
    expect(contributedSetting).toMatchObject({ type: 'string', default: DEFAULT_PROOFREAD_MODEL });
  });

  it('defaults to a curated model, so the Settings Overlay lists it', () => {
    expect(RECOMMENDED_MODELS.map((model) => model.id)).toContain(DEFAULT_PROOFREAD_MODEL);
  });
});
