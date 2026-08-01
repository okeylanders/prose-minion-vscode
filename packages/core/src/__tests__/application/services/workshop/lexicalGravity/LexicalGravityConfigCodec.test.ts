import {
  lexicalGravityConfigKey,
  validateLexicalGravityDraft,
  validateLexicalGravityLens
} from '@/application/services/workshop/lexicalGravity/LexicalGravityConfigCodec';
import {
  builtInLexicalGravityLens
} from '@/application/services/workshop/lexicalGravity/LexicalGravityLenses';

describe('LexicalGravityConfigCodec', () => {
  it('validates exact project lens shape and returns a defensive clone', () => {
    const source = { ...builtInLexicalGravityLens('photography')!, source: 'project' as const };

    const validated = validateLexicalGravityLens(source);
    validated.degrees[1].nouns[0] = 'mutated';

    expect(source.degrees[1].nouns[0]).toBe('aperture');
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

  it('rejects each invalid control and the single-lens mismatch independently', () => {
    const photography = builtInLexicalGravityLens('photography')!;
    expect(() => validateLexicalGravityDraft({
      lensSlug: 'photography',
      weight: 63,
      reach: 2,
      metaphorPull: false,
      resolvedLens: photography
    })).toThrow(/5-point steps/);

    expect(() => validateLexicalGravityDraft({
      lensSlug: 'photography',
      weight: 60,
      reach: 4,
      metaphorPull: false,
      resolvedLens: photography
    })).toThrow(/must be 1, 2, 3/);

    expect(() => validateLexicalGravityDraft({
      lensSlug: 'music',
      weight: 60,
      reach: 2,
      metaphorPull: false,
      resolvedLens: photography
    })).toThrow(/selected lensSlug/);
  });

  it('rejects a shape-valid lens whose reach-3 directive exceeds its prompt budget', () => {
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

    expect(() => validateLexicalGravityLens(oversized)).toThrow(
      /reach-3 directive fits within 3000 characters/
    );
  });

  it('accepts only a preview tied to the current four-value configuration', () => {
    const resolvedLens = builtInLexicalGravityLens('music')!;
    const draft = {
      lensSlug: 'music',
      weight: 40,
      reach: 2 as const,
      metaphorPull: false,
      resolvedLens,
      preview: {
        configKey: lexicalGravityConfigKey({
          lensSlug: 'music', weight: 40, reach: 2, metaphorPull: false
        }),
        sourceText: 'The room waited beneath the quiet rafters.',
        text: 'The room held a muted cadence.'
      }
    };

    expect(validateLexicalGravityDraft(draft)).toEqual(draft);
    draft.preview.configKey = 'stale|config';
    expect(() => validateLexicalGravityDraft(draft)).toThrow(/current four-value config key/);
  });
});
