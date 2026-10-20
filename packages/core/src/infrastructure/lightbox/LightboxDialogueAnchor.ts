/**
 * Whether a found quote stands inside dialogue (ADR 2026-10-19 D7; Slice 4).
 * Pure: no host, no I/O.
 *
 * A subtext pair's *said* line must be speech: the quote the verifier found
 * must lie wholly inside one dialogue span of its paragraph, as the shared
 * matcher (`findDialogueSpans`, the one Metrics and the ribbon count
 * dialogue with) finds them. The quote may include its quote marks or not.
 *
 * This matches no model text. It only places a span the verifier already
 * returned (the chapter's own characters) within its paragraph, so it adds
 * no second quote matcher: every occurrence of that exact span in the
 * paragraph is tried, and one inside dialogue is enough. Single-quoted
 * dialogue is not matched, as the shared matcher documents.
 */

import type { LightboxVerifiedQuote } from '@messages';
import { findDialogueSpans, type DialogueSpan } from '@/utils/dialogueSpans';

export interface LightboxDialogueIndex {
  /** True when the found quote lies wholly inside one dialogue span of its paragraph. */
  holds(quote: Pick<LightboxVerifiedQuote, 'paragraph' | 'text'>): boolean;
}

/** An index over the chapter's paragraphs (index 0 is ¶1); each paragraph's spans are found once, when first asked. */
export function createLightboxDialogueIndex(paragraphs: readonly string[]): LightboxDialogueIndex {
  const spans = new Map<number, DialogueSpan[]>();
  const spansOf = (index: number): DialogueSpan[] => {
    let found = spans.get(index);
    if (!found) {
      found = findDialogueSpans(paragraphs[index]);
      spans.set(index, found);
    }
    return found;
  };
  return {
    holds(quote) {
      const index = quote.paragraph - 1;
      const paragraph = paragraphs[index];
      if (paragraph === undefined || quote.text.length === 0) {
        return false;
      }
      const dialogue = spansOf(index);
      // Occurrences and spans both ascend, so one pass over each settles every occurrence.
      let span = 0;
      for (let at = paragraph.indexOf(quote.text); at >= 0; at = paragraph.indexOf(quote.text, at + 1)) {
        const end = at + quote.text.length;
        while (span < dialogue.length && dialogue[span].end < end) {
          span += 1;
        }
        if (span < dialogue.length && dialogue[span].start <= at) {
          return true;
        }
      }
      return false;
    }
  };
}
