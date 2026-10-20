/**
 * From decoded lineage, subtext and Spark blocks to board tiles (ADR
 * 2026-10-19 D7; Slice 4). Pure: no host, no I/O. Called by
 * `LightboxReadingTiles` through its claim assembler, so every claim here
 * meets the same rules as every other reading: quotes checked against the
 * paragraph they name, a claim with none withheld by title, the kind's own
 * gate (`LightboxTileGates`) applied as stale carry applies it, ids minted
 * per run.
 *
 * - **Lineage.** A story's stances are carried as decoded; it stands on its
 *   found quotes. Its set-aside list rides with the lens's friction, not as a
 *   tile (`assembleLightboxGroup`).
 * - **Subtext.** The said line is checked first and leads the tile's
 *   evidence; the gate holds it to dialogue. The meant side becomes the
 *   tile's claim.
 * - **Spark.** The terms it names are counted by the host; the gate holds it
 *   to counted support. The question becomes the tile's claim.
 */

import type { LightboxVerifiedQuote } from '@messages';
import type { LightboxClaimAssembler } from '@/infrastructure/lightbox/LightboxReadingTiles';
import type {
  LightboxDecodedLineageBlock,
  LightboxDecodedSparkBlock,
  LightboxDecodedSubtextBlock
} from '@/infrastructure/lightbox/LightboxReadingWire';

export function assembleLineageBlock(block: LightboxDecodedLineageBlock, assembler: LightboxClaimAssembler): void {
  assembler.malformed('lineage', 'lineage', block.malformed);
  for (const story of block.items) {
    assembler.claim(
      { kind: 'lineage', lens: 'lineage', title: story.title, claim: story.claim, quotes: story.evidence,
        terms: [], support: [], friction: block.friction },
      (base) => ({
        ...base,
        kind: 'lineage',
        source: story.source,
        stances: story.stances.map((row) => ({ ...row }))
      })
    );
  }
}

export function assembleSubtextBlock(block: LightboxDecodedSubtextBlock, assembler: LightboxClaimAssembler): void {
  assembler.malformed('subtext', 'subtext', block.malformed);
  for (const pair of block.items) {
    // The gate accepts a pair only with its said line found inside dialogue, so `said` is set here.
    assembler.claim(
      { kind: 'subtext', lens: 'subtext', title: pair.speaker, claim: pair.meant, quotes: pair.evidence,
        said: pair.said, terms: [], support: [], friction: block.friction },
      (base, accepted) => ({
        ...base,
        kind: 'subtext',
        speaker: pair.speaker,
        said: accepted.said as LightboxVerifiedQuote
      })
    );
  }
}

export function assembleSparkBlock(block: LightboxDecodedSparkBlock, assembler: LightboxClaimAssembler): void {
  assembler.malformed('spark', 'spark', block.malformed);
  for (const spark of block.items) {
    assembler.claim(
      { kind: 'spark', lens: 'spark', title: spark.title, claim: spark.question, quotes: spark.evidence,
        terms: spark.terms, friction: block.friction },
      (base) => ({ ...base, kind: 'spark' })
    );
  }
}
