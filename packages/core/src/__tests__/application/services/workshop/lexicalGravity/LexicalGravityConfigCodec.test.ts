import {
  validateLexicalGravityDraft,
  validateLexicalGravityLens
} from '@/application/services/workshop/lexicalGravity/LexicalGravityConfigCodec';
import {
  builtInLexicalGravityLens,
  lexicalGravityConfigKey
} from '@/application/services/workshop/lexicalGravity/LexicalGravityLenses';

describe('LexicalGravityConfigCodec', () => {
  it('validates exact project lens shape and returns a defensive clone', () => {
    const source = { ...builtInLexicalGravityLens('photography')!, source: 'project' as const };

    const validated = validateLexicalGravityLens(source);
    validated.degrees[1].nouns[0] = 'mutated';

    expect(source.degrees[1].nouns[0]).toBe('aperture');
  });

  it('rejects unknown fields, mismatched slugs, duplicate terms, and bad control steps', () => {
    expect(() => validateLexicalGravityLens({
      ...builtInLexicalGravityLens('photography'),
      secret: '/workspace/private.md'
    })).toThrow(/unknown field secret/);

    const duplicate = builtInLexicalGravityLens('photography')!;
    duplicate.degrees[1].nouns = ['frame', 'FRAME'];
    expect(() => validateLexicalGravityLens(duplicate)).toThrow(/without duplicates/);

    expect(() => validateLexicalGravityDraft({
      lensSlug: 'music',
      weight: 63,
      reach: 4,
      metaphorPull: false,
      resolvedLens: builtInLexicalGravityLens('photography')
    })).toThrow(/five-point steps/);
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
        text: 'The room held a muted cadence.'
      }
    };

    expect(validateLexicalGravityDraft(draft)).toEqual(draft);
    draft.preview.configKey = 'stale|config';
    expect(() => validateLexicalGravityDraft(draft)).toThrow(/current four-value config key/);
  });
});
