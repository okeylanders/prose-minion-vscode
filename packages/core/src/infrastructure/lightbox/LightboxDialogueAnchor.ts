/**
 * Whether a found quote stands inside dialogue (ADR 2026-10-19 D7; Slice 4).
 * Pure: no host, no I/O.
 *
 * A subtext pair's *said* line must be speech: the quote the verifier found
 * must lie wholly inside one dialogue span of its paragraph, as the shared
 * matcher (`findDialogueSpans`, the one Metrics and the ribbon count
 * dialogue with) finds them. The quote may include its quote marks or not.
 * Single-quoted dialogue is not matched, as the shared matcher documents.
 *
 * **One matcher (PR #151 F-04).** This matches no text of its own. A
 * paragraph can hold a line's words twice, once in narration and once in
 * speech, in different typography ("I don't know was written on his face.
 * “I don’t know,” he said."). The verifier finds the first equivalent span,
 * so a said line is found with a dialogue filter (`LightboxSpanFilter`): the
 * verifier offers every span it accepts under its own rules, exact before
 * folded, and the first one inside dialogue is the said line. Only when no
 * equivalent span is speech is the plain match kept, for the gate to refuse
 * as narration. The gate's own check asks the verifier the same question.
 *
 * **The said line leads (PR #151 F-07).** A pair's evidence is its said line
 * as found, then every other found quote once (`lightboxSaidLedEvidence`).
 * Fresh assembly and stale carry both build it here, so a carried pair
 * cannot lead with the narration's copy of the words its said line found
 * in speech.
 */

import type { LightboxVerifiedQuote } from '@messages';
import { findDialogueSpans, type DialogueSpan } from '@/utils/dialogueSpans';
import type { LightboxQuoteVerdict, LightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';

export interface LightboxDialogueIndex {
  /** True when [start, end) of the paragraph (1-based) lies wholly inside one of its dialogue spans. */
  contains(paragraph: number, start: number, end: number): boolean;
  /** Find a said line: the first span the verifier accepts inside dialogue, else its plain match (narration), else its failure. */
  verifySaid(paragraph: number, quote: string): LightboxQuoteVerdict;
  /** True when the found quote's text stands inside dialogue in its paragraph, by the verifier's own rules. */
  holds(quote: Pick<LightboxVerifiedQuote, 'paragraph' | 'text'>): boolean;
}

/** Whether two found quotes are the same span: the same paragraph and the same chapter text. */
export function lightboxSameQuote(
  a: Pick<LightboxVerifiedQuote, 'paragraph' | 'text'>,
  b: Pick<LightboxVerifiedQuote, 'paragraph' | 'text'>
): boolean {
  return a.paragraph === b.paragraph && a.text === b.text;
}

/** A pair's evidence: its said line first when found, then the other found quotes, without the said line again. */
export function lightboxSaidLedEvidence(
  said: LightboxVerifiedQuote | null | undefined,
  evidence: readonly LightboxVerifiedQuote[]
): LightboxVerifiedQuote[] {
  return said ? [said, ...evidence.filter((quote) => !lightboxSameQuote(quote, said))] : [...evidence];
}

/** An index over the verifier's paragraphs; each paragraph's spans are found once, when first asked. */
export function createLightboxDialogueIndex(verifier: LightboxQuoteVerifier): LightboxDialogueIndex {
  const { paragraphs } = verifier;
  const spans = new Map<number, DialogueSpan[]>();
  const spansOf = (index: number): DialogueSpan[] => {
    let found = spans.get(index);
    if (!found) {
      found = findDialogueSpans(paragraphs[index]);
      spans.set(index, found);
    }
    return found;
  };
  const contains = (paragraph: number, start: number, end: number): boolean => {
    const index = paragraph - 1;
    if (paragraphs[index] === undefined || end <= start) {
      return false;
    }
    return spansOf(index).some((span) => span.start <= start && end <= span.end);
  };
  return {
    contains,
    verifySaid(paragraph, quote) {
      const spoken = verifier.verify(paragraph, quote, contains);
      return spoken.found ? spoken : verifier.verify(paragraph, quote);
    },
    holds(quote) {
      if (paragraphs[quote.paragraph - 1] === undefined) {
        return false;
      }
      const verdict = verifier.verify(quote.paragraph, quote.text, contains);
      return verdict.found && verdict.paragraph === quote.paragraph;
    }
  };
}
