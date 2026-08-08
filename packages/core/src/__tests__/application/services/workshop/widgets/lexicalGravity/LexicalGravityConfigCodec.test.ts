import {
  isLexicalGravityReach,
  isLexicalGravityWeight,
  LEXICAL_GRAVITY_REACH,
  LEXICAL_GRAVITY_WEIGHT,
  lexicalGravityConfigKey,
  normalizeLexicalGravityDraftForHydration,
  validateLexicalGravityDraft,
  validateLexicalGravityLens
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec';
import {
  builtInLexicalGravityLens,
  builtInLexicalGravityLenses
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';
import {
  buildLegacyLexicalGravityDirectiveFrame,
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
      evidenceMode: 'blend',
      weight: 63,
      reach: 2,
      metaphorPull: false,
      resolvedLens: photography
    })).toThrow(/5-point steps/);

    expect(() => validateLexicalGravityDraft({
      lensSlug: 'photography',
      applicationMode: 'interpret',
      evidenceMode: 'blend',
      weight: 60,
      reach: 4,
      metaphorPull: false,
      resolvedLens: photography
    })).toThrow(/must be 1, 2, 3/);

    expect(() => validateLexicalGravityDraft({
      lensSlug: 'music',
      applicationMode: 'interpret',
      evidenceMode: 'blend',
      weight: 60,
      reach: 2,
      metaphorPull: false,
      resolvedLens: photography
    })).toThrow(/selected lensSlug/);

    expect(() => validateLexicalGravityDraft({
      lensSlug: 'photography',
      applicationMode: 'decorate',
      evidenceMode: 'blend',
      weight: 60,
      reach: 2,
      metaphorPull: false,
      resolvedLens: photography
    })).toThrow(/applicationMode must be lexical \| interpret \| recompose/);
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
        evidenceMode: 'blend',
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

  it('recovers only the exact v1 word-field checkpoint into lexical + blend', () => {
    const current = builtInLexicalGravityLens('music')!;
    const { logic: _logic, ...wordField } = current;
    const checkpoint = {
      lensSlug: 'music',
      weight: 40,
      reach: 2,
      metaphorPull: false,
      resolvedLens: { ...wordField, version: 1 },
      preview: {
        configKey: 'music|40|2|0',
        sourceText: 'The room waited beneath the quiet rafters.',
        text: 'The room held a muted cadence.'
      }
    };

    const result = normalizeLexicalGravityDraftForHydration(checkpoint);

    expect(result.draft).toMatchObject({
      applicationMode: 'lexical',
      evidenceMode: 'blend',
      resolvedLens: { version: 1, slug: 'music' }
    });
    expect(result.draft.preview).toBeUndefined();
    expect(result.normalizations).toContain('recovered-widget-lexical-gravity-v1');
    expect(result.notices).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'recovered-widget-lexical-gravity-v1' })
    ]));
    expect(result.notices[0]?.message).not.toMatch(/preview/i);
    expect(() => validateLexicalGravityDraft(result.draft)).not.toThrow();
    expect(normalizeLexicalGravityDraftForHydration(result.draft)).toMatchObject({
      normalizations: [],
      notices: []
    });
    expect(buildLexicalGravityDirectiveFrame(
      { id: 'pd-legacy', revision: 1 },
      result.draft
    )).toBe(buildLegacyLexicalGravityDirectiveFrame(
      { id: 'pd-legacy', revision: 1 },
      result.draft
    ));
    expect(buildLegacyLexicalGravityDirectiveFrame(
  { id: 'pd-legacy', revision: 1 },
  result.draft
)).toMatchInlineSnapshot(`
"<prose-directive id="pd-legacy" family="lexical-gravity" revision="1">
This is a standing passage-prose directive. Keep it dormant during analysis, critique, planning, and ordinary conversation. Apply it only when you compose or revise story prose for the writer.
Lens: Music.
Weight: 40/100. Let this field influence diction and imagery at that intensity without making every sentence announce the lens.
Reach: 2/3. Draw only from vocabulary degrees 1 through 2.
Metaphor pull: off — prefer lexical influence over explicit comparison.
Degree 1: nouns [tempo, chord, key, refrain, cadence]; verbs [tune, resolve, swell, hum]; modifiers [off-key, muted, resonant, minor].
Degree 2: nouns [dissonance, downbeat, tremolo, rest, interval]; verbs [modulate, syncopate, harmonize, transpose]; modifiers [staccato, legato, atonal].
Gradient: plan, outline, pattern, sequence, arrangement.
Useful substitutions: plan → score; conflict → dissonance; agreement → harmony; turning → key change; ending → coda.
Avoid the worn form when the fresh alternative fits: struck a chord → resonated in a minor key; music to my ears → landed like a held note; marching to their own drum → keeping a time signature nobody else could count; change their tune → modulate mid-phrase.
Preserve character voice, scene facts, clarity, and the writer's requested meaning. The directive bends choices; it does not overwrite the story.
</prose-directive>"
`);

    expect(() => normalizeLexicalGravityDraftForHydration({
      ...checkpoint,
      resolvedLens: { ...checkpoint.resolvedLens, inventedLogic: {} }
    })).toThrow(/unknown field inventedLogic/);
  });

  it('states Blend explicitly for a current v2 lens in lexical gear', () => {
    const lens = builtInLexicalGravityLens('music')!;

    const frame = buildLexicalGravityDirectiveFrame(
      { id: 'pd-current-lexical', revision: 1 },
      {
        lensSlug: lens.slug,
        applicationMode: 'lexical',
        evidenceMode: 'blend',
        weight: 40,
        reach: 2,
        metaphorPull: false,
        resolvedLens: lens
      }
    );

    expect(frame).toContain('Application gear: LEXICAL.');
    expect(frame).toContain('Evidence mode: BLEND.');
    expect(frame).not.toContain('Interpretive premise:');
  });

  it('retains the semantic frame wording for current interpretive gears', () => {
    const lens = builtInLexicalGravityLens('music')!;
    const frame = buildLexicalGravityDirectiveFrame(
      { id: 'pd-semantic', revision: 1 },
      {
        lensSlug: lens.slug,
        applicationMode: 'interpret',
        evidenceMode: 'blend',
        weight: 40,
        reach: 2,
        metaphorPull: false,
        resolvedLens: lens
      }
    );

    expect(frame).toContain(
      'Let the interpretive grammar influence prose at that strength or frequency'
    );
    expect(frame).toContain(
      'off — avoid explicit cross-domain comparison; the interpretive grammar remains active'
    );
    expect(frame).not.toContain('prefer lexical influence over explicit comparison');
  });

  it('treats evidence mode as an independent preview identity axis', () => {
    const common = {
      lensSlug: 'music',
      applicationMode: 'recompose' as const,
      weight: 40,
      reach: 2 as const,
      metaphorPull: false
    };
    expect(lexicalGravityConfigKey({ ...common, evidenceMode: 'show' }))
      .not.toBe(lexicalGravityConfigKey({ ...common, evidenceMode: 'tell' }));
  });

  it('defaults the pre-evidence v2 checkpoint to Blend and discards its stale preview', () => {
    const checkpoint = {
      lensSlug: 'music',
      applicationMode: 'interpret' as const,
      weight: 40,
      reach: 2 as const,
      metaphorPull: false,
      resolvedLens: builtInLexicalGravityLens('music')!,
      preview: {
        version: 2 as const,
        configKey: 'music|interpret|40|2|0',
        sourceText: 'The room waited.',
        semanticPositions: [],
        selectedDynamicId: null,
        openEntailment: null,
        text: 'The room waited.'
      }
    };

    expect(() => validateLexicalGravityDraft(checkpoint)).toThrow(/evidenceMode/);
    const recovered = normalizeLexicalGravityDraftForHydration(checkpoint);
    expect(recovered.draft.evidenceMode).toBe('blend');
    expect(recovered.draft.preview).toBeUndefined();
    expect(recovered.normalizations).toEqual([
      'defaulted-widget-lexical-gravity-evidence-mode'
    ]);
    expect(recovered.notices).toEqual([]);
  });

  it('accepts only a preview tied to the current six-value configuration', () => {
    const resolvedLens = builtInLexicalGravityLens('music')!;
    const draft = {
      lensSlug: 'music',
      applicationMode: 'recompose' as const,
      evidenceMode: 'blend' as const,
      weight: 40,
      reach: 2 as const,
      metaphorPull: false,
      resolvedLens,
      preview: {
        version: 2 as const,
        configKey: lexicalGravityConfigKey({
          lensSlug: 'music', applicationMode: 'recompose', evidenceMode: 'blend', weight: 40, reach: 2,
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
    expect(() => validateLexicalGravityDraft(draft)).toThrow(/current six-value config key/);
    expect(lexicalGravityConfigKey({
      lensSlug: 'music', applicationMode: 'interpret', evidenceMode: 'blend', weight: 40, reach: 2,
      metaphorPull: false
    })).not.toBe(lexicalGravityConfigKey({
      lensSlug: 'music', applicationMode: 'recompose', evidenceMode: 'blend', weight: 40, reach: 2,
      metaphorPull: false
    }));
  });

  it('rejects Preview positions and dynamics not declared by the resolved lens', () => {
    const resolvedLens = builtInLexicalGravityLens('music')!;
    const base = {
      lensSlug: 'music',
      applicationMode: 'interpret' as const,
      evidenceMode: 'blend' as const,
      weight: 40,
      reach: 2 as const,
      metaphorPull: false,
      resolvedLens,
      preview: {
        version: 2 as const,
        configKey: lexicalGravityConfigKey({
          lensSlug: 'music', applicationMode: 'interpret', evidenceMode: 'blend', weight: 40, reach: 2,
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
