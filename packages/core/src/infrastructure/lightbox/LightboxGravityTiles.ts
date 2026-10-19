/**
 * From decoded gravity and palette blocks to board tiles (ADR 2026-10-19 D7;
 * Slice 3). Pure: no host, no I/O. Called by `LightboxReadingTiles` for the
 * two group A lenses it does not assemble itself, through its claim
 * assembler, so every claim here meets the same rules: quotes checked
 * against the paragraph they name, a claim with none withheld by title, ids
 * minted per run.
 *
 * - **Borrowed fields.** The host counts each field's terms, its hits (an
 *   occurrence once, under the longest named term), its split by degree, its
 *   drift, and whether it clears the gravity line (`LightboxGravityCounts`).
 *   A field under the line is drawn below it, not dropped.
 * - **Collisions.** Drawn only when both fields made it onto the board and one
 *   sentence of a found quote holds a term of each; that sentence is the
 *   tile's witness. The rule is `LightboxTileGates`', shared with stale carry.
 * - **Literal set-asides.** Counted like a field, shown with their reason.
 * - **Palette.** A cluster's words and a swatch's color words are counted by
 *   the host; one whose words the chapter does not hold is withheld (the
 *   gate again). A
 *   swatch's color is the reading's choice, carried as it proposed it.
 */

import type { LightboxCountedSupport, LightboxVerifiedQuote } from '@messages';
import type { LightboxClaimAssembler } from '@/infrastructure/lightbox/LightboxReadingTiles';
import type {
  LightboxDecodedGravityBlock,
  LightboxDecodedPaletteBlock
} from '@/infrastructure/lightbox/LightboxReadingWire';
import { countLightboxField } from '@/infrastructure/lightbox/LightboxGravityCounts';

export function assembleGravityBlock(block: LightboxDecodedGravityBlock, assembler: LightboxClaimAssembler): void {
  const { counter, verifier } = assembler.context;
  const friction = block.friction;

  assembler.malformed('gravity-field', 'gravity', block.malformed.fields);
  for (const field of block.fields) {
    const counted = countLightboxField(field.terms, counter, verifier.paragraphCount);
    assembler.claim(
      { kind: 'gravity-field', lens: 'gravity', title: field.name, claim: field.claim, quotes: field.evidence,
        terms: [], support: counted.support, friction },
      (base) => ({
        ...base,
        kind: 'gravity-field',
        metaphor: field.metaphor,
        pull: field.pull,
        support: counted.support,
        hits: counted.hits,
        degreeHits: counted.degreeHits,
        belowLine: counted.belowLine,
        drift: counted.drift
      })
    );
  }

  assembler.malformed('gravity-collision', 'gravity', block.malformed.collisions);
  for (const collision of block.collisions) {
    const [first, second] = collision.fields;
    // The gate holds it to a sentence both fields share, its witness (F-04, F-05).
    assembler.claim(
      { kind: 'gravity-collision', lens: 'gravity', title: `${first} meets ${second}`, claim: collision.claim,
        quotes: collision.evidence, terms: [], support: [], friction, fields: [first, second] },
      (base, accepted) => ({
        ...base,
        kind: 'gravity-collision',
        fields: [first, second],
        witness: accepted.witness as LightboxVerifiedQuote
      })
    );
  }

  assembler.malformed('gravity-literal', 'gravity', block.malformed.literal);
  for (const literal of block.literal) {
    const counted = countLightboxField(literal.terms.map((term) => ({ term, degree: 1 })), counter, verifier.paragraphCount);
    const support: LightboxCountedSupport[] = counted.support.map(({ degree: _degree, ...term }) => term);
    assembler.claim(
      { kind: 'gravity-literal', lens: 'gravity', title: literal.name, claim: literal.reason, quotes: literal.evidence,
        terms: [], support, friction },
      (base) => ({ ...base, kind: 'gravity-literal', hits: counted.hits })
    );
  }
}

export function assemblePaletteBlock(block: LightboxDecodedPaletteBlock, assembler: LightboxClaimAssembler): void {
  const friction = block.friction;
  assembler.malformed('palette-cluster', 'palette', block.malformed.clusters);
  for (const cluster of block.clusters) {
    assembler.claim(
      { kind: 'palette-cluster', lens: 'palette', title: cluster.name, claim: cluster.claim, quotes: cluster.evidence,
        terms: cluster.words, friction },
      (base) => ({ ...base, kind: 'palette-cluster' })
    );
  }
  assembler.malformed('swatch', 'palette', block.malformed.swatches);
  for (const swatch of block.swatches) {
    assembler.claim(
      { kind: 'swatch', lens: 'palette', title: swatch.name, claim: swatch.note, quotes: swatch.evidence,
        terms: swatch.words, friction },
      (base) => ({ ...base, kind: 'swatch', hex: swatch.hex })
    );
  }
}
