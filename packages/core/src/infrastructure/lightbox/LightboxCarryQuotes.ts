/**
 * How a carried reading's quotes are found again on changed text (ADR
 * 2026-10-19 D4; Slice 4B). Pure: no host, no I/O. Used by
 * `LightboxStaleReadings`, which holds every carried tile to its kind's gate.
 *
 * - **Any quote** stays where it stands, or follows its words to the nearest
 *   paragraph that now holds them (the earlier one on a tie): the host
 *   moving its own verified span, never a model's claim. A quote whose words
 *   are gone is withheld as no longer in the chapter.
 * - **Group D's kinds** carry their quotes by their own rules, the rules a
 *   fresh read checks them by:
 *   - a numbers reading's quotes are found again with the instance filter of
 *     the figure as the **new** board measures it, so a quote whose words
 *     stand but hold no instance now is withheld as `no-instance`;
 *   - a handoff's two sentences are found again as a pair, adjacent in one
 *     paragraph: in the paragraph it named, else in the nearest paragraph
 *     that holds its first sentence's words;
 *   - a tier mix's beats are found again one by one, each keeping its tier,
 *     and the tiers are counted again from the beats that stand.
 * - **Group G's kinds** (Slice 4F, craft steering): a figure's reading and
 *   a note keep only quotes the figure's own detector finds an instance in
 *   on the changed text; a note's example is anchored again in its carried
 *   quote, and withheld alone when it no longer stands there.
 */

import type {
  LightboxQuoteFailure,
  LightboxReadingTile,
  LightboxVerifiedQuote,
  LightboxWithheldQuote
} from '@messages';
import type { LightboxQuoteVerdict, LightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { findLightboxSentencePair, type LightboxSentencePair } from '@/infrastructure/lightbox/LightboxSentencePairs';
import {
  verifyLightboxInstance,
  verifyLightboxPatternInstance,
  type LightboxStandoutRows
} from '@/infrastructure/lightbox/LightboxNumberInstances';
import { lightboxFoundBeats, lightboxTierCounts } from '@/infrastructure/lightbox/LightboxCraftTiles';
import { lightboxSteeringExampleFields } from '@/infrastructure/lightbox/LightboxSteeringTiles';

export type LightboxRecheck =
  | { quote: LightboxVerifiedQuote }
  | { reason: Extract<LightboxQuoteFailure, 'no-longer-in-chapter' | 'no-instance'> };

/** The quote where it stood, or where its words now stand; else why it is withheld. */
export function recheckLightboxQuote(
  quote: LightboxVerifiedQuote,
  verify: (paragraph: number, text: string) => LightboxQuoteVerdict
): LightboxRecheck {
  const note = quote.note !== undefined ? { note: quote.note } : {};
  const verdict = verify(quote.paragraph, quote.text);
  if (verdict.found) {
    return { quote: { paragraph: verdict.paragraph, text: verdict.text, match: verdict.match, ...note } };
  }
  const nearest = [...(verdict.foundIn ?? [])]
    .sort((a, b) => Math.abs(a - quote.paragraph) - Math.abs(b - quote.paragraph) || a - b)[0];
  const moved = nearest === undefined ? undefined : verify(nearest, quote.text);
  if (moved?.found) {
    return { quote: { paragraph: moved.paragraph, text: moved.text, match: moved.match, ...note } };
  }
  return { reason: verdict.reason === 'no-instance' ? 'no-instance' : 'no-longer-in-chapter' };
}

/** A craft tile's quotes on the changed text, and the fields that follow from them. */
export interface LightboxCarriedCraft {
  evidence: LightboxVerifiedQuote[];
  lost: LightboxWithheldQuote[];
  /** The tile's own fields, recomputed: a handoff's sentences, a tier mix's beats and counts. */
  patch: Partial<LightboxReadingTile>;
  /** For a handoff's gate. */
  pair?: LightboxSentencePair | 'gone' | 'not-adjacent';
}

/** Carry a numbers reading, a handoff, a tier mix or a steering tile by its own rules; undefined for any other kind. */
export function carryLightboxCraftEvidence(
  tile: LightboxReadingTile,
  verifier: LightboxQuoteVerifier,
  standouts: LightboxStandoutRows
): LightboxCarriedCraft | undefined {
  switch (tile.kind) {
    case 'number-usage': {
      const row = standouts.get(tile.stat);
      const verify = row
        ? (paragraph: number, text: string) => verifyLightboxInstance(verifier, row, paragraph, text)
        : (paragraph: number, text: string) => verifier.verify(paragraph, text);
      return { ...recheckAll(tile.evidence, verify), patch: {} };
    }
    case 'handoff':
      return carryHandoff(tile.from, tile.to, verifier);
    case 'steering-reading':
    case 'steering-note': {
      const stat = tile.stat;
      const carried = recheckAll(tile.evidence, (paragraph, text) => verifyLightboxPatternInstance(verifier, stat, paragraph, text));
      if (tile.kind === 'steering-reading') {
        return { ...carried, patch: {} };
      }
      // The example's anchor is the note's own quote, where it now stands; an example withheld stays withheld.
      const fields = lightboxSteeringExampleFields(verifier, stat, carried.evidence[0], tile.example, tile.exampleWithheld, 'carried');
      return { ...carried, patch: { example: fields.example, exampleWithheld: fields.exampleWithheld } as Partial<LightboxReadingTile> };
    }
    case 'stock-tiers': {
      const rechecked = tile.beats.map((beat) => ({ tier: beat.tier, result: recheckLightboxQuote(beat.quote, (p, t) => verifier.verify(p, t)) }));
      const beats = lightboxFoundBeats(rechecked.map(({ tier, result }) => ({ tier, quote: 'quote' in result ? result.quote : undefined })));
      const lost = rechecked.flatMap(({ result }, index) =>
        ('reason' in result ? [{ paragraph: tile.beats[index].quote.paragraph, reason: result.reason }] : []));
      return {
        evidence: beats.map((beat) => beat.quote),
        lost,
        patch: { beats, tiers: lightboxTierCounts(beats), classified: beats.length } as Partial<LightboxReadingTile>
      };
    }
    default:
      return undefined;
  }
}

function recheckAll(
  quotes: readonly LightboxVerifiedQuote[],
  verify: (paragraph: number, text: string) => LightboxQuoteVerdict
): Pick<LightboxCarriedCraft, 'evidence' | 'lost'> {
  const evidence: LightboxVerifiedQuote[] = [];
  const lost: LightboxWithheldQuote[] = [];
  const seen = new Set<string>();
  for (const quote of quotes) {
    const result = recheckLightboxQuote(quote, verify);
    if ('reason' in result) {
      lost.push({ paragraph: quote.paragraph, reason: result.reason });
      continue;
    }
    const key = `${result.quote.paragraph}:${result.quote.text}`;
    if (!seen.has(key)) {
      seen.add(key);
      evidence.push(result.quote);
    }
  }
  return { evidence, lost };
}

/**
 * A handoff's pair in the paragraph it named, else in the nearest other
 * paragraph that holds its first sentence's words, even when a copy of that
 * sentence stayed behind (PR #155 N-01). A pair whose words all still stand
 * somewhere, but nowhere side by side, is not adjacent, never "gone".
 */
function carryHandoff(
  from: LightboxVerifiedQuote,
  to: LightboxVerifiedQuote,
  verifier: LightboxQuoteVerifier
): LightboxCarriedCraft {
  const at = (paragraph: number) => findLightboxSentencePair(
    verifier,
    { paragraph, text: from.text },
    { paragraph, text: to.text }
  );
  const named = at(from.paragraph);
  if (named.ok) {
    return pairFound(named.pair);
  }
  const candidates = paragraphsHolding(verifier, from)
    .filter((paragraph) => paragraph !== from.paragraph)
    .sort((a, b) => Math.abs(a - from.paragraph) - Math.abs(b - from.paragraph) || a - b);
  for (const paragraph of candidates) {
    const moved = at(paragraph);
    if (moved.ok) {
      return pairFound(moved.pair);
    }
  }
  const standing = paragraphsHolding(verifier, from).length > 0 && paragraphsHolding(verifier, to).length > 0;
  if (named.why === 'gone' && !standing) {
    const lost: LightboxWithheldQuote[] = named.withheld.map((quote) => ({ paragraph: quote.paragraph, reason: 'no-longer-in-chapter' }));
    return { evidence: named.found, lost, patch: {}, pair: 'gone' };
  }
  return { evidence: named.found, lost: [], patch: {}, pair: 'not-adjacent' };
}

/** Every paragraph whose text holds the quote's words, by the verifier's own spans. */
function paragraphsHolding(verifier: LightboxQuoteVerifier, quote: { paragraph: number; text: string }): number[] {
  const found = new Set<number>();
  // A filter that accepts nothing is offered every span the verifier finds, in every paragraph.
  verifier.verify(quote.paragraph, quote.text, (paragraph) => {
    found.add(paragraph);
    return false;
  });
  return [...found];
}

function pairFound(pair: LightboxSentencePair): LightboxCarriedCraft {
  return { evidence: [pair.from, pair.to], lost: [], patch: { from: pair.from, to: pair.to } as Partial<LightboxReadingTile>, pair };
}
