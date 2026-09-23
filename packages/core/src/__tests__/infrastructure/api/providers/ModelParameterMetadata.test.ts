import {
  getModelParameterMetadata,
  MODEL_PARAMETER_METADATA
} from '@providers/ModelParameterMetadata';
import { CATEGORY_MODELS, RECOMMENDED_MODELS } from '@providers/OpenRouterModels';

describe('ModelParameterMetadata', () => {
  it('only declares metadata for curated models', () => {
    const curatedIds = new Set([
      ...RECOMMENDED_MODELS.map(({ id }) => id),
      ...CATEGORY_MODELS.map(({ id }) => id)
    ]);

    expect(Object.keys(MODEL_PARAMETER_METADATA).filter(id => !curatedIds.has(id))).toEqual([]);
  });

  it('distinguishes published, estimated, undisclosed, and routed-system counts', () => {
    expect(getModelParameterMetadata('deepseek/deepseek-r1')).toEqual({
      label: '671B params · 37B active',
      confidence: 'published'
    });
    expect(getModelParameterMetadata('z-ai/glm-5.3-flash')).toEqual({
      label: '≈321B params',
      confidence: 'estimated'
    });
    expect(getModelParameterMetadata('anthropic/claude-fable-5.1')).toEqual({
      label: 'params undisclosed',
      confidence: 'undisclosed'
    });
    expect(getModelParameterMetadata('sakana/fugu-ultra')).toEqual({
      label: 'multi-model system',
      confidence: 'not-applicable'
    });
    for (const id of ['aion-labs/aion-3.5-mini', 'aion-labs/aion-3.5']) {
      expect(getModelParameterMetadata(id)).toEqual({
        label: 'multi-model system',
        confidence: 'not-applicable'
      });
    }
  });
});
