/**
 * Kind-specific acceptance rules for reading tiles (ADR 2026-10-19 D7;
 * PR #150 F-04). Pure: no host, no I/O.
 *
 * A collision claims two borrowed fields share a sentence. The host holds it
 * to that: one sentence of a found quote, by the prose-stats sentence rule
 * (`proseSentenceSpans`), must hold a term of each field. That sentence is
 * the collision's witness, kept on the tile and shown on the board. A quote
 * whose fields' terms stand in different sentences is not a witness.
 */

import type { LightboxVerifiedQuote } from '@messages';
import { lightboxTextHoldsTerm } from '@/infrastructure/lightbox/LightboxTermCounts';
import { proseSentenceSpans } from '@/tools/measure/passageProseStats';

/** Writer-facing: no sentence of a collision's quotes holds both fields. */
export const LIGHTBOX_NO_SHARED_SENTENCE =
  'No sentence of its quotes holds a term of each field, so the board cannot show them sharing one.';

/** Writer-facing: a field the collision names is not on the board. */
export const LIGHTBOX_COLLISION_FIELD_WITHHELD = 'One of the fields it names was withheld.';

/**
 * The first sentence, in quote order, that holds a term of each field, as a
 * quote of its own (the chapter's span, its paragraph and match kind); or
 * undefined when no sentence does.
 */
export function lightboxCollisionWitness(
  evidence: readonly LightboxVerifiedQuote[],
  fieldTerms: readonly [readonly string[], readonly string[]]
): LightboxVerifiedQuote | undefined {
  const holdsField = (sentence: string, terms: readonly string[]) =>
    terms.some((term) => lightboxTextHoldsTerm(sentence, term));
  for (const quote of evidence) {
    for (const { start, end } of proseSentenceSpans(quote.text)) {
      const sentence = quote.text.slice(start, end).trim();
      if (holdsField(sentence, fieldTerms[0]) && holdsField(sentence, fieldTerms[1])) {
        return { paragraph: quote.paragraph, text: sentence, match: quote.match };
      }
    }
  }
  return undefined;
}
