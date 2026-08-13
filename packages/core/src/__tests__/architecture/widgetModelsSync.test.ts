/** Guard the curated model catalog's availability in every Workshop widget picker. */

import * as fs from 'fs';
import * as path from 'path';
import { RECOMMENDED_MODELS } from '@providers/OpenRouterModels';

const NEW_MODEL_IDS = [
  'meta/muse-spark-1.1',
  'qwen/qwen3.8-max'
] as const;

describe('Workshop widget model catalog', () => {
  it('contains the models introduced by the v2.1.1 catalog refresh', () => {
    const recommendedIds = RECOMMENDED_MODELS.map(({ id }) => id);

    expect(recommendedIds).toEqual(expect.arrayContaining(NEW_MODEL_IDS));
  });

  it('passes the full recommended model options to every widget picker', () => {
    const workshopAppPath = path.resolve(
      __dirname,
      '..',
      '..',
      'presentation',
      'webview',
      'WorkshopApp.tsx'
    );
    const workshopAppSource = fs.readFileSync(workshopAppPath, 'utf8');
    const fullCatalogBindings = workshopAppSource.match(
      /widgetModelOptions=\{\s*modelsSettings\.modelOptions\s*\}/g
    );

    expect(fullCatalogBindings).toHaveLength(3);
  });
});
