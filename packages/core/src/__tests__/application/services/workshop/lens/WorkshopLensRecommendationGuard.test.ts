/**
 * Recommendations stay starter-only (ADR 2026-11-17 D19). A persona can now
 * read the writer's own lenses, and still cannot recommend one by slug: the
 * guard in `LexicalGravityRecommendation.ts` accepts the built-in slugs and
 * nothing else, and its instruction is the text it was before this family.
 */
import {
  inspectLexicalGravityRecommendation,
  LEXICAL_GRAVITY_RECOMMENDATION_INSTRUCTION
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityRecommendation';
import { builtInLexicalGravityLenses } from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';
import { aliceLens, lensCapability, lensLibrary } from '@/__tests__/application/services/workshop/lens/lensLibraryFixtures';

const recommendation = (lensSlug: string): string[] => [
  '<workshop-widget-recommendation version="1">',
  '<widget-id>', 'lexical-gravity', '</widget-id>',
  '<lens-slug>', lensSlug, '</lens-slug>',
  '<weight>', '60', '</weight>',
  '<reach>', '2', '</reach>',
  '<metaphor-pull>', 'false', '</metaphor-pull>',
  '</workshop-widget-recommendation>'
];
const UNSUPPORTED = { outcome: 'rejected', rejection: 'invalid_field', field: 'lensSlug', reason: 'unsupported_lens' };

describe('the recommendation guard, beside the lens family', () => {
  it('refuses a project lens the persona has just read, by its slug', async () => {
    const { capability } = lensCapability(lensLibrary([aliceLens('tea-party')]));
    const read = await capability.fulfill({ capability: 'lens.read', lens: 'tea-party' });
    expect(read.status).toBe('success');
    const catalog = await capability.fulfill({ capability: 'lens.catalog' });
    expect(catalog.content).toContain('- tea-party · ');
    // Listed and readable, and still not recommendable.
    expect(inspectLexicalGravityRecommendation(recommendation('tea-party'))).toEqual(UNSUPPORTED);
    expect(inspectLexicalGravityRecommendation(recommendation('alice-000'))).toEqual(UNSUPPORTED);
  });

  it('accepts every built-in starter, and only those', () => {
    const builtIns = builtInLexicalGravityLenses().map((lens) => lens.slug);
    expect(builtIns).toEqual(['photography', 'music', 'mathematics', 'weather', 'botany', 'architecture']);
    for (const slug of builtIns) {
      expect([slug, inspectLexicalGravityRecommendation(recommendation(slug))]).toEqual([slug, {
        outcome: 'accepted',
        recommendation: { widgetId: 'lexical-gravity', seed: { lensSlug: slug, weight: 60, reach: 2, metaphorPull: false } }
      }]);
    }
    for (const slug of ['Photography', 'photography-2', 'tea-party', 'lens.read', '']) {
      expect([slug, inspectLexicalGravityRecommendation(recommendation(slug)).outcome]).toEqual([slug, 'rejected']);
    }
  });

  it('keeps the instruction as it was: starters by name, no word of the lens library', () => {
    expect(LEXICAL_GRAVITY_RECOMMENDATION_INSTRUCTION.split('\n')[0]).toBe(
      'For Lexical Gravity, propose but never install. Choose one starter lens slug from photography, music, mathematics, ' +
      'weather, botany, architecture; weight must be 10–100 in steps of 5; reach is 1, 2, 3; metaphor-pull is true or false. ' +
      'The writer can change every value before explicitly installing it.'
    );
    expect(LEXICAL_GRAVITY_RECOMMENDATION_INSTRUCTION).not.toMatch(/lens\.(?:catalog|read)|project lens|library/);
  });
});
