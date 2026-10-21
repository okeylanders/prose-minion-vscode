/**
 * Being Verbs Tool (Lightbox Slice 4B)
 *
 * Finds the forms of "be" as whole words, in any case: am, is, are, was,
 * were, be, been, being. The Lightbox's "What stands out in the numbers"
 * counts them per 1,000 words, places them in paragraphs, and checks that a
 * reading's quote holds one, all through this one detector.
 *
 * Style Flags' "Weak Verbs" mixes these with has/have/do/make/get, so it is
 * not this figure; Style Flags is unchanged.
 *
 * **Limits, stated.** A word list, not a parser:
 * - contractions are not counted: "she's", "I'm", "they're", "isn't",
 *   "wasn't" hold no listed form as a whole word;
 * - every listed form counts, whatever it does in its sentence (a linking
 *   verb, an auxiliary, a passive), so the figure is a frequency, not a
 *   judgment of any one use.
 */

/** The forms counted, as whole words. */
export const BEING_VERB_FORMS = ['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being'] as const;

/** One form found: its offsets in the text and the text matched. */
export interface BeingVerbMatch {
  start: number;
  end: number;
  text: string;
}

/** Every listed form in `text`, in order. */
export function findBeingVerbs(text: string): BeingVerbMatch[] {
  const pattern = new RegExp(`\\b(?:${BEING_VERB_FORMS.join('|')})\\b`, 'gi');
  return [...text.matchAll(pattern)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    text: match[0]
  }));
}
