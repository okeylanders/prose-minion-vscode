import * as fs from 'fs';
import * as path from 'path';
import { MODEL_SCOPE_SETTING_KEYS, resolveModelScopeSelections } from '@orchestration/ModelScopeSelections';
import { CATEGORY_MODELS, RECOMMENDED_MODELS } from '@providers/OpenRouterModels';
import { DEFAULT_MODEL_SELECTIONS } from '@shared/constants/defaultModelSelections';
import { MODEL_SCOPES, isFollowingModelScope } from '@messages';

const manifestPath = path.resolve(__dirname, '../../../../../apps/vscode-extension/package.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

describe('model defaults in code and the extension manifest', () => {
  it.each(MODEL_SCOPES)('agrees on the %s default', scope => {
    const setting = manifest.contributes.configuration.properties[`proseMinion.${MODEL_SCOPE_SETTING_KEYS[scope]}`];
    expect(setting).toMatchObject({
      type: 'string',
      default: isFollowingModelScope(scope) ? '' : DEFAULT_MODEL_SELECTIONS[scope]
    });
  });

  it.each(Object.entries(DEFAULT_MODEL_SELECTIONS))('lists the %s default in its picker', (scope, id) => {
    const choices = scope === 'category' ? CATEGORY_MODELS : RECOMMENDED_MODELS;
    expect(choices.map(model => model.id)).toContain(id);
  });

  it('defaults Proofread and the helper to a model that supports disabling reasoning', () => {
    // OpenRouter's catalog on 2026-11-27 reports that this route supports effort "none".
    const selections = resolveModelScopeSelections({ get: () => undefined });
    for (const scope of ['proofread', 'helper'] as const) {
      expect(selections[scope]).toBe('anthropic/claude-haiku-5.5');
    }
    expect(selections.craft).toBe(DEFAULT_MODEL_SELECTIONS.assistant);
  });
});
