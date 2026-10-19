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
 * - **Collisions.** Drawn only when both fields made it onto the board and a
 *   found quote holds a term of each: the host sees them share the sentence.
 * - **Literal set-asides.** Counted like a field, shown with their reason.
 * - **Palette.** A cluster's words and a swatch's color words are counted by
 *   the host; one whose words the chapter does not hold is withheld. A
 *   swatch's color is the reading's choice, carried as it proposed it.
 */

import type { LightboxCountedSupport, LightboxGravityTerm, LightboxVerifiedQuote } from '@messages';
import type { LightboxClaimAssembler } from '@/infrastructure/lightbox/LightboxReadingTiles';
import type {
  LightboxDecodedCollision,
  LightboxDecodedGravityBlock,
  LightboxDecodedPaletteBlock
} from '@/infrastructure/lightbox/LightboxReadingWire';
import { countLightboxField } from '@/infrastructure/lightbox/LightboxGravityCounts';
import { lightboxTextHoldsTerm } from '@/infrastructure/lightbox/LightboxTermCounts';

const nameKey = (name: string): string => name.toLocaleLowerCase('en-US');

export function assembleGravityBlock(block: LightboxDecodedGravityBlock, assembler: LightboxClaimAssembler): void {
  const { counter, verifier } = assembler.context;
  const friction = block.friction;

  assembler.malformed('gravity-field', 'gravity', block.malformed.fields);
  // The fields that reached the board, with the terms the host counted for them.
  const drawn = new Map<string, LightboxGravityTerm[]>();
  for (const field of block.fields) {
    const counted = countLightboxField(field.terms, counter, verifier.paragraphCount);
    const tile = assembler.claim(
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
    if (tile) {
      drawn.set(nameKey(field.name), counted.support);
    }
  }

  assembler.malformed('gravity-collision', 'gravity', block.malformed.collisions);
  for (const collision of block.collisions) {
    const [first, second] = collision.fields;
    assembler.claim(
      { kind: 'gravity-collision', lens: 'gravity', title: `${first} meets ${second}`, claim: collision.claim,
        quotes: collision.evidence, terms: [], support: [], friction,
        accept: (evidence) => collisionRefusal(collision, evidence, drawn) },
      (base) => ({ ...base, kind: 'gravity-collision', fields: [first, second] })
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
        terms: cluster.words, friction, requireCounted: 'None of its words are in the chapter.' },
      (base) => ({ ...base, kind: 'palette-cluster' })
    );
  }
  assembler.malformed('swatch', 'palette', block.malformed.swatches);
  for (const swatch of block.swatches) {
    assembler.claim(
      { kind: 'swatch', lens: 'palette', title: swatch.name, claim: swatch.note, quotes: swatch.evidence,
        terms: swatch.words, friction, requireCounted: 'Its color words are not in the chapter.' },
      (base) => ({ ...base, kind: 'swatch', hex: swatch.hex })
    );
  }
}

/** Why a collision cannot be drawn, or undefined when the host can see both fields share its quote. */
function collisionRefusal(
  collision: LightboxDecodedCollision,
  evidence: readonly LightboxVerifiedQuote[],
  drawn: ReadonlyMap<string, readonly LightboxGravityTerm[]>
): string | undefined {
  const withheld = collision.fields.find((name) => !drawn.has(nameKey(name)));
  if (withheld !== undefined) {
    return `It names "${withheld}", a field the board withheld.`;
  }
  const holds = (quote: LightboxVerifiedQuote, name: string): boolean =>
    (drawn.get(nameKey(name)) ?? []).some((term) => lightboxTextHoldsTerm(quote.text, term.term));
  return evidence.some((quote) => collision.fields.every((name) => holds(quote, name)))
    ? undefined
    : 'None of its quotes holds a term of each field, so the board cannot show them sharing a sentence.';
}
