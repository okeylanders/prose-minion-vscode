import {
  isLexicalGravityReach,
  isLexicalGravityWeight,
  LEXICAL_GRAVITY_REACH,
  LEXICAL_GRAVITY_WEIGHT,
  lexicalGravityConfigKey,
  validateLexicalGravityDraft,
  validateLexicalGravityLens
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec';
import {
  builtInLexicalGravityLens,
  builtInLexicalGravityLenses
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';
import {
  buildLexicalGravityDirectiveFrame
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityDirective';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

describe('LexicalGravityConfigCodec', () => {
  it('owns the exact weight and reach value grammar', () => {
    expect(LEXICAL_GRAVITY_WEIGHT).toEqual({ minimum: 10, maximum: 100, step: 5 });
    expect([9, 11, 63, 101].map(isLexicalGravityWeight)).toEqual([
      false,
      false,
      false,
      false
    ]);
    expect([10, 15, 100].map(isLexicalGravityWeight)).toEqual([true, true, true]);

    expect(LEXICAL_GRAVITY_REACH).toEqual({
      minimum: 1,
      maximum: 3,
      values: [1, 2, 3]
    });
    expect([0, 1, 2, 3, 4].map(isLexicalGravityReach)).toEqual([
      false,
      true,
      true,
      true,
      false
    ]);
  });

  it('validates exact project lens shape and returns a defensive clone', () => {
    const source = { ...builtInLexicalGravityLens('photography')!, source: 'project' as const };

    const validated = validateLexicalGravityLens(source);
    validated.degrees[1].nouns[0] = 'mutated';
    validated.logic.attention.foregrounds[0] = 'mutated';
    validated.logic.axes[0].poles[0] = 'mutated';
    validated.logic.roles[0].description = 'mutated';
    validated.logic.dynamics[0].entailment = 'mutated';

    expect(source.degrees[1].nouns[0]).toBe('aperture');
    expect(source.logic.attention.foregrounds[0]).not.toBe('mutated');
    expect(source.logic.axes[0].poles[0]).not.toBe('mutated');
    expect(source.logic.roles[0].description).not.toBe('mutated');
    expect(source.logic.dynamics[0].entailment).not.toBe('mutated');
  });

  it('validates every built-in as one complete v2 interpretive grammar', () => {
    const lenses = builtInLexicalGravityLenses();

    expect(lenses).toHaveLength(6);
    expect(() => lenses.forEach(validateLexicalGravityLens)).not.toThrow();
    expect(lenses.every(({ version, logic }) =>
      version === 2
      && logic.axes.length >= 2
      && logic.roles.length >= 2
      && logic.dynamics.length >= 2
    )).toBe(true);
  });

  it('rejects version 1 instead of inventing interpretive logic', () => {
    const current = builtInLexicalGravityLens('photography')!;
    expect(() => validateLexicalGravityLens({ ...current, version: 1 })).toThrow(
      /lens\.version must be 2/i
    );
  });

  it('rejects unknown lens fields', () => {
    expect(() => validateLexicalGravityLens({
      ...builtInLexicalGravityLens('photography'),
      secret: '/workspace/private.md'
    })).toThrow(/unknown field secret/);
  });

  it('rejects duplicate lens terms', () => {
    const duplicate = builtInLexicalGravityLens('photography')!;
    duplicate.degrees[1].nouns = ['frame', 'FRAME'];
    expect(() => validateLexicalGravityLens(duplicate)).toThrow(/without duplicates/);
  });

  it('requires exact lens logic ids, axis tuples, and collection bounds', () => {
    const duplicateRole = builtInLexicalGravityLens('photography')!;
    duplicateRole.logic.roles[1].id = duplicateRole.logic.roles[0].id;
    expect(() => validateLexicalGravityLens(duplicateRole)).toThrow(/unique id/);

    const invalidAxis = builtInLexicalGravityLens('photography')! as unknown as {
      logic: { axes: Array<{ poles: string[] }> };
    };
    invalidAxis.logic.axes[0].poles = ['one'];
    expect(() => validateLexicalGravityLens(invalidAxis)).toThrow(/two-string tuple/);

    const missingGuardrails = builtInLexicalGravityLens('photography')!;
    missingGuardrails.logic.guardrails = [];
    expect(() => validateLexicalGravityLens(missingGuardrails)).toThrow(/2–4 strings/);
  });

  it('rejects each invalid control and the single-lens mismatch independently', () => {
    const photography = builtInLexicalGravityLens('photography')!;
    expect(() => validateLexicalGravityDraft({
      lensSlug: 'photography',
      applicationMode: 'interpret',
      weight: 63,
      reach: 2,
      metaphorPull: false,
      resolvedLens: photography
    })).toThrow(/5-point steps/);

    expect(() => validateLexicalGravityDraft({
      lensSlug: 'photography',
      applicationMode: 'interpret',
      weight: 60,
      reach: 4,
      metaphorPull: false,
      resolvedLens: photography
    })).toThrow(/must be 1, 2, 3/);

    expect(() => validateLexicalGravityDraft({
      lensSlug: 'music',
      applicationMode: 'interpret',
      weight: 60,
      reach: 2,
      metaphorPull: false,
      resolvedLens: photography
    })).toThrow(/selected lensSlug/);

    expect(() => validateLexicalGravityDraft({
      lensSlug: 'photography',
      applicationMode: 'decorate',
      weight: 60,
      reach: 2,
      metaphorPull: false,
      resolvedLens: photography
    })).toThrow(/applicationMode must be interpret \| recompose/);
  });

  it('renders a worst-case valid v2 lens within the measured aggregate prompt budget', () => {
    const oversized = builtInLexicalGravityLens('photography')!;
    for (const degree of [1, 2, 3] as const) {
      for (const part of ['nouns', 'verbs', 'modifiers'] as const) {
        oversized.degrees[degree][part] = Array.from(
          { length: 12 },
          (_, index) => `${degree}-${part}-${index}-${'x'.repeat(55)}`
        );
      }
    }
    oversized.gradient = Array.from(
      { length: 12 },
      (_, index) => `gradient-${index}-${'x'.repeat(55)}`
    );
    oversized.cliches = Array.from({ length: 8 }, (_, index) => ({
      worn: `worn-${index}-${'x'.repeat(100)}`,
      fresh: `fresh-${index}-${'x'.repeat(100)}`
    }));
    oversized.substitutions = {
      plan: 'p'.repeat(200),
      conflict: 'c'.repeat(200),
      agreement: 'a'.repeat(200),
      turning: 't'.repeat(200),
      ending: 'e'.repeat(200)
    };
    oversized.metaphor = 'm'.repeat(200);
    oversized.logic.premise = 'p'.repeat(400);
    oversized.logic.attention.foregrounds = Array.from(
      { length: 4 },
      (_, index) => `${index}-${'f'.repeat(177)}`
    );
    oversized.logic.attention.backgrounds = Array.from(
      { length: 4 },
      (_, index) => `${index}-${'b'.repeat(177)}`
    );
    oversized.logic.axes = Array.from({ length: 4 }, (_, index) => ({
      id: `axis-${index}`,
      name: `${index}-${'n'.repeat(77)}`,
      poles: [
        `${index}-${'l'.repeat(97)}`,
        `${index}-${'r'.repeat(97)}`
      ] as [string, string]
    }));
    oversized.logic.roles = Array.from({ length: 4 }, (_, index) => ({
      id: `role-${index}`,
      name: `${index}-${'n'.repeat(77)}`,
      description: `${index}-${'d'.repeat(237)}`
    }));
    oversized.logic.dynamics = Array.from({ length: 4 }, (_, index) => ({
      id: `dynamic-${index}`,
      operation: `${index}-${'o'.repeat(77)}`,
      movement: `${index}-${'m'.repeat(197)}`,
      entailment: `${index}-${'e'.repeat(357)}`,
      narrativeAffordance: `${index}-${'a'.repeat(357)}`
    }));
    oversized.logic.guardrails = Array.from(
      { length: 4 },
      (_, index) => `${index}-${'g'.repeat(237)}`
    );

    expect(() => validateLexicalGravityLens(oversized)).not.toThrow();
    const frame = buildLexicalGravityDirectiveFrame(
      { id: 'pd-worst-case', revision: Number.MAX_SAFE_INTEGER },
      {
        lensSlug: oversized.slug,
        applicationMode: 'recompose',
        weight: 100,
        reach: 3,
        metaphorPull: true,
        resolvedLens: oversized
      }
    );
    expect(frame.length).toBeGreaterThan(12_000);
    expect(frame.length).toBeLessThanOrEqual(
      PROMPT_BUDGETS.workshopWidgets.lexicalDirectiveCharacters
    );
  });

  it('accepts only a preview tied to the current five-value configuration', () => {
    const resolvedLens = builtInLexicalGravityLens('music')!;
    const draft = {
      lensSlug: 'music',
      applicationMode: 'recompose' as const,
      weight: 40,
      reach: 2 as const,
      metaphorPull: false,
      resolvedLens,
      preview: {
        version: 2 as const,
        configKey: lexicalGravityConfigKey({
          lensSlug: 'music', applicationMode: 'recompose', weight: 40, reach: 2,
          metaphorPull: false
        }),
        sourceText: 'The room waited beneath the quiet rafters.',
        semanticPositions: [{
          element: 'the room',
          roleId: 'rest',
          axisId: 'time',
          axisPosition: 'suspended after the expected answer',
          significance: 'The missing reply becomes active pressure.'
        }],
        selectedDynamicId: 'hold-rest',
        openEntailment: 'The next speaker must answer the silence before the old rhythm can resume.',
        text: 'The room held a muted cadence.'
      }
    };

    expect(validateLexicalGravityDraft(draft)).toEqual(draft);
    draft.preview.configKey = 'stale|config';
    expect(() => validateLexicalGravityDraft(draft)).toThrow(/current five-value config key/);
    expect(lexicalGravityConfigKey({
      lensSlug: 'music', applicationMode: 'interpret', weight: 40, reach: 2,
      metaphorPull: false
    })).not.toBe(lexicalGravityConfigKey({
      lensSlug: 'music', applicationMode: 'recompose', weight: 40, reach: 2,
      metaphorPull: false
    }));
  });

  it('rejects Preview positions and dynamics not declared by the resolved lens', () => {
    const resolvedLens = builtInLexicalGravityLens('music')!;
    const base = {
      lensSlug: 'music',
      applicationMode: 'interpret' as const,
      weight: 40,
      reach: 2 as const,
      metaphorPull: false,
      resolvedLens,
      preview: {
        version: 2 as const,
        configKey: lexicalGravityConfigKey({
          lensSlug: 'music', applicationMode: 'interpret', weight: 40, reach: 2,
          metaphorPull: false
        }),
        sourceText: 'The room waited.',
        semanticPositions: [{
          element: 'the room', roleId: 'camera', axisId: null,
          axisPosition: null, significance: 'It waits.'
        }],
        selectedDynamicId: null as string | null,
        openEntailment: null,
        text: 'The room waited.'
      }
    };

    expect(() => validateLexicalGravityDraft(base)).toThrow(/roleId.*selected lens/);
    base.preview.semanticPositions[0].roleId = 'rest';
    base.preview.selectedDynamicId = 'develop';
    expect(() => validateLexicalGravityDraft(base)).toThrow(/selectedDynamicId.*selected lens/);
  });
});
