/** Guard the curated model catalog's availability in every Workshop widget picker. */

import * as fs from 'fs';
import * as path from 'path';
import { RECOMMENDED_MODELS } from '@providers/OpenRouterModels';

const EXPECTED_SHARED_MODEL_IDS = [
  'meta/muse-spark-1.1',
  'qwen/qwen3.8-max',
  'anthropic/claude-fable-5.1',
  'inception/mercury-2.5-preview'
] as const;

const RETIRED_MODEL_IDS = [
  'anthropic/claude-opus-4.7-fast',
  'anthropic/claude-opus-4.8-fast',
  'anthropic/claude-opus-5-fast',
  'arcee-ai/virtuoso-large'
] as const;

describe('Workshop widget model catalog', () => {
  it('contains the models expected in every shared model picker', () => {
    const recommendedIds = RECOMMENDED_MODELS.map(({ id }) => id);

    expect(recommendedIds).toEqual(expect.arrayContaining(EXPECTED_SHARED_MODEL_IDS));
  });

  it('excludes retired model IDs from every shared model picker', () => {
    const recommendedIds = RECOMMENDED_MODELS.map(({ id }) => id);

    RETIRED_MODEL_IDS.forEach(modelId => {
      expect(recommendedIds).not.toContain(modelId);
    });
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
