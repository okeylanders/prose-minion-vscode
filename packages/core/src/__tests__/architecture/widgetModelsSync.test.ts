/** Guard the curated model catalog's availability in every Workshop widget picker. */

import * as fs from 'fs';
import * as path from 'path';
import { RECOMMENDED_MODELS } from '@providers/OpenRouterModels';

const EXPECTED_SHARED_MODEL_IDS = [
  'openai/gpt-6.1-terra',
  'openai/gpt-6.1-terra-pro',
  'inception/mercury-3',
  'deepseek/deepseek-v4.1-flash-1017',
  'moonshotai/kimi-k3.1-pro',
  'minimax/minimax-m3.1-flash',
  'meta/muse-spark-1.1',
  'meta/muse-spark-1.3',
  'meta/muse-wonder',
  'qwen/qwen3.8-max-0902',
  'qwen/qwen3.8-max-prime',
  'anthropic/claude-fable-5.1',
  'inception/mercury-2.5',
  'google/gemini-3.8-flash',
  'google/gemini-4-argon',
  'openai/gpt-6-luna',
  'openai/gpt-6-luna-pro',
  'openai/gpt-6-sol',
  'openai/gpt-6-sol-pro',
  'openai/gpt-6.1-sol',
  'openai/gpt-6.1-sol-pro',
  'openai/gpt-6-astra',
  'anthropic/claude-opus-5.5',
  'anthropic/claude-sonnet-5.5',
  'anthropic/claude-haiku-5.5',
  'upstage/solar-mini4',
  'deepseek/deepseek-v4.1-flash',
  'x-ai/grok-4.7',
  'openai/gpt-6-astra-pro',
  'z-ai/glm-5.3-flashx',
  'z-ai/glm-5.3-prime',
  'xiaomi/mimo-v2.6-flash',
  'xiaomi/mimo-v2.6-pro',
  'xiaomi/mimo-v2.6-pro-ultraspeed',
  'mistralai/mistral-large-2407',
  'mistralai/mistral-large-4-0',
  'stepfun/step-5-preview',
  'nousresearch/hermes-3-llama-3.1-70b',
  'nousresearch/hermes-3-llama-3.1-405b',
  'aion-labs/aion-3.5-mini',
  'aion-labs/aion-3.5'
] as const;

const RETIRED_MODEL_IDS = [
  'deepseek/deepseek-r1',
  'sao10k/l3.3-euryale-70b',
  'arcee-ai/trinity-large-thinking',
  'anthropic/claude-opus-4.7-fast',
  'anthropic/claude-opus-4.8-fast',
  'anthropic/claude-opus-5-fast',
  'arcee-ai/virtuoso-large',
  'inception/mercury-2.5-preview',
  'qwen/qwen3.8-max',
  'mistralai/mistral-large-2512',
  'qwen/qwen3-coder-plus',
  'qwen/qwen3-max',
  'qwen/qwen3-max-thinking',
  'qwen/qwen3.6-max-preview',
  'nousresearch/hermes-4-70b'
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

    expect(fullCatalogBindings).toHaveLength(4);
  });
});
