/**
 * Whether a handoff's two quotes are adjacent sentences in one paragraph
 * (Slice 4B; ADR 2026-10-19 D7). Pure: no host, no I/O.
 *
 * A handoff sample claims that one sentence hands something to the next.
 * The host holds it to that literally:
 * - both quotes are found in the one paragraph the reading named;
 * - each lies inside a single sentence of that paragraph, by the prose-stats
 *   splitter (`proseSentenceSpans`), so a quote that runs across a sentence
 *   break is no sentence's;
 * - the second quote's sentence directly follows the first's.
 * A quote may be part of its sentence: a long sentence is more than one
 * quote can carry (`PROMPT_BUDGETS.lightbox.quoteCharacters`).
 *
 * **One matcher.** Nothing here matches text. The verifier offers every
 * span it would accept for a quote, exact before folded, through its span
 * filter (`LightboxSpanFilter`), as the dialogue anchor's said line is
 * found: first every sentence the first quote could stand in is collected,
 * then the second quote is found in a sentence directly after one of them,
 * then the first is found again in the sentence before that. So the same
 * words in another sentence never decide the pair.
 */

import type { LightboxVerifiedQuote, LightboxWithheldQuote } from '@messages';
import { proseSentenceSpans } from '@/tools/measure/passageProseStats';
import type { LightboxQuoteVerdict, LightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';

/** A quote to check: the paragraph named (1-based) and the words. */
export interface LightboxPairQuote {
  paragraph: number;
  text: string;
}

export interface LightboxSentencePair {
  from: LightboxVerifiedQuote;
  to: LightboxVerifiedQuote;
}

export type LightboxPairVerdict =
  | { ok: true; pair: LightboxSentencePair }
  /** `gone`: a quote is not in the paragraph named; `not-adjacent`: both are, but not in sentences side by side. */
  | { ok: false; why: 'gone' | 'not-adjacent'; found: LightboxVerifiedQuote[]; withheld: LightboxWithheldQuote[] };

/** Check a pair in the paragraph it names. */
export function findLightboxSentencePair(
  verifier: LightboxQuoteVerifier,
  from: LightboxPairQuote,
  to: LightboxPairQuote
): LightboxPairVerdict {
  const plainFrom = verifier.verify(from.paragraph, from.text);
  const plainTo = verifier.verify(to.paragraph, to.text);
  if (!plainFrom.found || !plainTo.found) {
    return {
      ok: false,
      why: 'gone',
      found: [plainFrom, plainTo].flatMap(foundQuote),
      withheld: [plainFrom, plainTo].flatMap(withheldQuote)
    };
  }
  const pair = from.paragraph === to.paragraph ? adjacentIn(verifier, from.paragraph, from.text, to.text) : undefined;
  return pair
    ? { ok: true, pair }
    : { ok: false, why: 'not-adjacent', found: [plainFrom, plainTo].flatMap(foundQuote), withheld: [] };
}

/** The pair found adjacent in paragraph `paragraph`, or undefined. */
function adjacentIn(
  verifier: LightboxQuoteVerifier,
  paragraph: number,
  fromText: string,
  toText: string
): LightboxSentencePair | undefined {
  const source = verifier.paragraphs[paragraph - 1];
  if (source === undefined) {
    return undefined;
  }
  const sentences = proseSentenceSpans(source);
  const sentenceOf = (start: number, end: number): number =>
    sentences.findIndex((sentence) => sentence.start <= start && end <= sentence.end);

  // Every sentence the first quote could stand in: the filter records each span offered and accepts none.
  const fromSentences = new Set<number>();
  verifier.verify(paragraph, fromText, (at, start, end) => {
    const index = at === paragraph ? sentenceOf(start, end) : -1;
    if (index >= 0) {
      fromSentences.add(index);
    }
    return false;
  });
  let toSentence = -1;
  const to = verifier.verify(paragraph, toText, (at, start, end) => {
    const index = at === paragraph ? sentenceOf(start, end) : -1;
    if (index >= 1 && fromSentences.has(index - 1)) {
      toSentence = index;
      return true;
    }
    return false;
  });
  if (!to.found || to.paragraph !== paragraph || toSentence < 1) {
    return undefined;
  }
  const from = verifier.verify(paragraph, fromText, (at, start, end) => at === paragraph && sentenceOf(start, end) === toSentence - 1);
  if (!from.found || from.paragraph !== paragraph) {
    return undefined;
  }
  return {
    from: { paragraph, text: from.text, match: from.match },
    to: { paragraph, text: to.text, match: to.match }
  };
}

function foundQuote(verdict: LightboxQuoteVerdict): LightboxVerifiedQuote[] {
  return verdict.found ? [{ paragraph: verdict.paragraph, text: verdict.text, match: verdict.match }] : [];
}

function withheldQuote(verdict: LightboxQuoteVerdict): LightboxWithheldQuote[] {
  return verdict.found
    ? []
    : [{ paragraph: verdict.paragraph, reason: verdict.reason, ...(verdict.foundIn ? { foundIn: verdict.foundIn } : {}) }];
}
