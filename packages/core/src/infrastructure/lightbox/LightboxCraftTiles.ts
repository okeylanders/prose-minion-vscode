/**
 * From decoded group D blocks to board tiles (ADR 2026-10-19 D7; Slice 4B).
 * Pure: no host, no I/O. Called by `LightboxReadingTiles` through its claim
 * assembler, so every claim here meets the same rules as every other
 * reading: quotes checked against the paragraph they name, a claim with none
 * withheld by title, the kind's gate (`LightboxTileGates`) applied as stale
 * carry applies it, ids minted per run.
 *
 * - **Stock.** The tier mix is one tile: its beats are its quotes, each kept
 *   with its tier when found (once each), and the host counts the tiers from
 *   the beats found. Familiar phrasing is counted by the host as one term,
 *   stopwords included; a phrase withheld is named by its kind and position,
 *   so words the chapter may not hold are never shown as a title. Signature
 *   phrases, air-locks and echoes are readings with quotes.
 * - **Rhythm.** The endings tile keeps one ending per ribbon column with
 *   each column's key, so a stale carry moves an ending only with its text.
 *   A handoff's two quotes are checked as adjacent sentences of one
 *   paragraph (`LightboxSentencePairs`); its title is the host's.
 * - **Numbers.** A reading's title is its figure's host label, and its
 *   quotes are verified with that figure's instance filter
 *   (`LightboxNumberInstances`), so each kept quote holds an instance.
 */

import type { LightboxStockBeat, LightboxStockTier, LightboxVerifiedQuote } from '@messages';
import { LIGHTBOX_FAMILIAR_KIND_LABELS } from '@shared/constants/lightbox';
import type { LightboxClaimAssembler } from '@/infrastructure/lightbox/LightboxReadingTiles';
import {
  LIGHTBOX_STOCK_TIERS,
  type LightboxDecodedNumbersBlock,
  type LightboxDecodedRhythmBlock,
  type LightboxDecodedStockBlock
} from '@/infrastructure/lightbox/LightboxReadingWire';
import { lightboxNumberLabel } from '@/infrastructure/lightbox/LightboxNumbers';
import { verifyLightboxInstance } from '@/infrastructure/lightbox/LightboxNumberInstances';

export const LIGHTBOX_STOCK_TIERS_TITLE = 'Cognitive economy';
export const LIGHTBOX_ENDINGS_TITLE = 'How paragraphs end';

export function assembleStockBlock(block: LightboxDecodedStockBlock, assembler: LightboxClaimAssembler): void {
  const friction = block.friction;
  const { beats } = block.economy;
  assembler.malformed('stock-tiers', 'stock', block.malformed.beats);
  assembler.claim(
    { kind: 'stock-tiers', lens: 'stock', title: LIGHTBOX_STOCK_TIERS_TITLE, claim: block.economy.note, quotes: beats,
      terms: [], support: [], friction },
    (base, accepted) => {
      const kept = lightboxFoundBeats(beats.map((beat, index) => ({ tier: beat.tier, quote: accepted.found[index] })));
      return { ...base, kind: 'stock-tiers', beats: kept, tiers: lightboxTierCounts(kept), classified: kept.length };
    }
  );

  assembler.malformed('signature', 'stock', block.malformed.signature);
  for (const line of block.signature) {
    assembler.claim(
      { kind: 'signature', lens: 'stock', title: line.title, claim: line.note, quotes: line.evidence, terms: [], support: [], friction },
      (base) => ({ ...base, kind: 'signature' })
    );
  }

  assembler.malformed('familiar-phrase', 'stock', block.malformed.familiar);
  block.familiar.forEach((familiar, index) => {
    assembler.claim(
      {
        kind: 'familiar-phrase', lens: 'stock', title: familiar.phrase, claim: familiar.note, quotes: familiar.evidence,
        // One term, counted as named, a lone stopword included ("very").
        terms: [], support: [assembler.context.counter.count(familiar.phrase)], phrase: familiar.phrase, friction,
        withheldTitle: `${LIGHTBOX_FAMILIAR_KIND_LABELS[familiar.kind]} ${index + 1}`
      },
      (base) => ({ ...base, kind: 'familiar-phrase', phrase: familiar.phrase, familiar: familiar.kind })
    );
  });

  assembler.malformed('air-lock', 'stock', block.malformed.airLocks);
  for (const line of block.airLocks) {
    assembler.claim(
      { kind: 'air-lock', lens: 'stock', title: line.title, claim: line.note, quotes: line.evidence, terms: [], support: [], friction },
      (base) => ({ ...base, kind: 'air-lock' })
    );
  }

  assembler.malformed('echo', 'stock', block.malformed.echoes);
  for (const echo of block.echoes) {
    assembler.claim(
      { kind: 'echo', lens: 'stock', title: echo.title, claim: echo.note, quotes: echo.evidence, terms: [], support: [], friction },
      (base) => ({ ...base, kind: 'echo', reminiscentOf: echo.reminiscentOf })
    );
  }
}

export function assembleRhythmBlock(block: LightboxDecodedRhythmBlock, assembler: LightboxClaimAssembler): void {
  const friction = block.friction;
  assembler.claim(
    { kind: 'rhythm-endings', lens: 'rhythm', title: LIGHTBOX_ENDINGS_TITLE, claim: block.movement, quotes: block.evidence,
      terms: [], support: [], friction },
    (base) => ({ ...base, kind: 'rhythm-endings', endings: [...block.endings], columnKeys: [...(assembler.context.columnKeys ?? [])] })
  );
  assembler.malformed('handoff', 'rhythm', block.malformed);
  for (const handoff of block.handoffs) {
    // The gate accepts a handoff only with its pair found adjacent, so `pair` is set here.
    assembler.claim(
      { kind: 'handoff', lens: 'rhythm', title: `Handoff in ¶${handoff.from.para}`, claim: handoff.changes, quotes: [],
        pair: { from: handoff.from, to: handoff.to }, terms: [], support: [], friction },
      (base, accepted) => ({
        ...base,
        kind: 'handoff',
        from: (accepted.pair as NonNullable<typeof accepted.pair>).from,
        to: (accepted.pair as NonNullable<typeof accepted.pair>).to,
        carried: handoff.carried,
        effect: handoff.effect
      })
    );
  }
}

export function assembleNumbersBlock(block: LightboxDecodedNumbersBlock, assembler: LightboxClaimAssembler): void {
  const { verifier, standouts } = assembler.context;
  assembler.malformed('number-usage', 'numbers', block.malformed);
  for (const reading of block.items) {
    const row = standouts?.get(reading.stat);
    assembler.claim(
      {
        kind: 'number-usage', lens: 'numbers', title: lightboxNumberLabel(reading.stat), claim: reading.claim,
        quotes: reading.evidence, terms: [], support: [], friction: block.friction, stat: reading.stat,
        ...(row ? { verifyQuote: (paragraph: number, quote: string) => verifyLightboxInstance(verifier, row, paragraph, quote) } : {})
      },
      (base) => ({ ...base, kind: 'number-usage', stat: reading.stat, usage: reading.usage })
    );
  }
}

/** The beats found, each once (the first tier given for a span stands), in order. */
export function lightboxFoundBeats(
  beats: ReadonlyArray<{ tier: LightboxStockTier; quote: LightboxVerifiedQuote | undefined }>
): LightboxStockBeat[] {
  const seen = new Set<string>();
  const kept: LightboxStockBeat[] = [];
  for (const { tier, quote } of beats) {
    const key = quote ? `${quote.paragraph}:${quote.text}` : undefined;
    if (quote && key && !seen.has(key)) {
      seen.add(key);
      kept.push({ quote, tier });
    }
  }
  return kept;
}

/** How many found beats sit in each tier. */
export function lightboxTierCounts(beats: readonly LightboxStockBeat[]): Record<LightboxStockTier, number> {
  const counts = Object.fromEntries(LIGHTBOX_STOCK_TIERS.map((tier) => [tier, 0])) as Record<LightboxStockTier, number>;
  for (const beat of beats) {
    counts[beat.tier] += 1;
  }
  return counts;
}
