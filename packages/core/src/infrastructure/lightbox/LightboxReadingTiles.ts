/**
 * From a decoded group to board tiles (ADR 2026-10-19 D3, D7). Pure: no host,
 * no I/O.
 *
 * This is where a reading becomes something the board can show, and every
 * honesty rule that needs the chapter runs here:
 * - each quote is checked against the paragraph it names (the verifier);
 *   found quotes keep the chapter's own span and match kind, failed ones
 *   become withheld quotes with their reason, never their text;
 * - a claim left with no found quote is withheld by its title, and each
 *   kind's own rules (a motif recurs, a collision shares a sentence, a
 *   palette's words are in the text) run through `LightboxTileGates`, the
 *   same rules stale carry applies (PR #150 F-05);
 * - terms the reading names are counted by the host (the counter), and a
 *   tile's paragraphs are its found quotes' and counted terms' paragraphs,
 *   never a list the model supplied;
 * - ids are minted here, per run, in tile order.
 * Blocks the codec withheld arrive here already withheld, by kind.
 */

import type {
  LightboxCountedSupport,
  LightboxLensFriction,
  LightboxLensId,
  LightboxLensQuoteChecks,
  LightboxReadingTile,
  LightboxReadingTileKind,
  LightboxVerifiedQuote,
  LightboxWithheldBlock,
  LightboxWithheldClaim,
  LightboxWithheldQuote
} from '@messages';
import type { LightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import type { LightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { countLightboxSupport, lightboxMeasuredMusic } from '@/infrastructure/lightbox/LightboxTileCounts';
import { assembleGravityBlock, assemblePaletteBlock } from '@/infrastructure/lightbox/LightboxGravityTiles';
import { lightboxFieldKey, lightboxTileGate } from '@/infrastructure/lightbox/LightboxTileGates';
import {
  LIGHTBOX_VOICE_TRAITS,
  type LightboxDecodedBlock,
  type LightboxDecodedGroup,
  type LightboxMalformedItem,
  type LightboxWireQuote,
  type LightboxWirePeak
} from '@/infrastructure/lightbox/LightboxReadingWire';

/** The tile kind a withheld lens block is shown under. */
export const LIGHTBOX_LENS_BLOCK_KIND: Readonly<Record<LightboxLensId, LightboxReadingTileKind>> = {
  headline: 'headline',
  motif: 'motif',
  tension: 'tension-arc',
  palette: 'palette-cluster',
  gravity: 'gravity-field',
  characters: 'character',
  voice: 'voice',
  genre: 'genre-neighbor'
};

export interface LightboxTileAssemblyContext {
  verifier: LightboxQuoteVerifier;
  counter: LightboxTermCounter;
  /** Mints the run's tile ids, in tile order. */
  mintId: () => string;
  /** The board's measured average words per sentence, set beside the voice's sentence music. */
  averageWordsPerSentence?: number;
}

export interface LightboxAssembledGroup {
  tiles: LightboxReadingTile[];
  withheldBlocks: LightboxWithheldBlock[];
  withheldClaims: LightboxWithheldClaim[];
  /** Each decoded block's friction, even when the block holds no tile. */
  frictions: LightboxLensFriction[];
  /** Each decoded block's quotes checked and withheld, so a tally counts every check, kept or not. */
  quoteChecks: LightboxLensQuoteChecks[];
  /** Every quote the verifier saw, and how many it withheld. */
  quotesChecked: number;
  quotesWithheld: number;
}


export function assembleLightboxGroup(
  decoded: LightboxDecodedGroup,
  context: LightboxTileAssemblyContext
): LightboxAssembledGroup {
  const assembly = new GroupAssembly(context);
  for (const { lens, reason } of decoded.withheld) {
    assembly.withheldBlocks.push({ kind: LIGHTBOX_LENS_BLOCK_KIND[lens], lens, reason });
  }
  for (const block of decoded.blocks) {
    assembly.block(block);
  }
  return {
    tiles: assembly.tiles,
    withheldBlocks: assembly.withheldBlocks,
    withheldClaims: assembly.withheldClaims,
    frictions: decoded.blocks.map((block) => ({ lens: block.lens, friction: block.friction })),
    quoteChecks: decoded.blocks.map((block) => ({ lens: block.lens, ...(assembly.checks.get(block.lens) ?? { checked: 0, withheld: 0 }) })),
    quotesChecked: assembly.quotesChecked,
    quotesWithheld: assembly.quotesWithheld
  };
}

interface CheckedEvidence {
  evidence: LightboxVerifiedQuote[];
  withheld: LightboxWithheldQuote[];
}

/** Claim fields every tile shares; the kind-specific fields are added by each block. */
export interface LightboxClaimDraft {
  kind: LightboxReadingTileKind;
  lens: LightboxLensId;
  title: string;
  claim: string;
  quotes: readonly (LightboxWireQuote | LightboxWirePeak)[];
  terms: readonly string[];
  friction: string;
  /** Counted support the block computed itself (gravity's degrees); replaces counting `terms`. */
  support?: LightboxCountedSupport[];
  /** A collision's two field names, for its gate (`LightboxTileGates`). */
  fields?: readonly [string, string];
}

export type LightboxTileBase = Omit<Extract<LightboxReadingTile, { kind: 'headline' }>, 'kind'>;

/** What the gate found while accepting a tile: a collision's witness. */
export interface LightboxAcceptedClaim {
  witness?: LightboxVerifiedQuote;
}

/** What a lens block's assembly may ask of its group's (`LightboxGravityTiles`). */
export interface LightboxClaimAssembler {
  readonly context: LightboxTileAssemblyContext;
  /** Check a claim's quotes; keep it as a tile (returned), or withhold it by title. */
  claim(
    draft: LightboxClaimDraft,
    build: (base: LightboxTileBase, accepted: LightboxAcceptedClaim) => LightboxReadingTile
  ): LightboxReadingTile | undefined;
  /** Items the codec could not read, withheld by title. */
  malformed(kind: LightboxReadingTileKind, lens: LightboxLensId, items: readonly LightboxMalformedItem[]): void;
}

class GroupAssembly implements LightboxClaimAssembler {
  readonly tiles: LightboxReadingTile[] = [];
  readonly withheldBlocks: LightboxWithheldBlock[] = [];
  readonly withheldClaims: LightboxWithheldClaim[] = [];
  /** Quotes checked and withheld per lens, as the checks ran. */
  readonly checks = new Map<LightboxLensId, { checked: number; withheld: number }>();
  quotesChecked = 0;
  quotesWithheld = 0;
  /** The borrowed fields drawn so far, for a collision's gate. */
  private readonly drawnFields = new Map<string, readonly string[]>();

  constructor(readonly context: LightboxTileAssemblyContext) {}

  block(block: LightboxDecodedBlock): void {
    switch (block.lens) {
      case 'headline':
        this.claim(
          { kind: 'headline', lens: 'headline', title: block.sentence, claim: block.sentence,
            quotes: block.evidence, terms: block.terms, friction: block.friction },
          (base) => ({ ...base, kind: 'headline' })
        );
        return;
      case 'motif':
        this.malformed('motif', 'motif', block.malformed);
        for (const motif of block.items) {
          this.claim(
            { kind: 'motif', lens: 'motif', title: motif.title, claim: motif.claim, quotes: motif.evidence,
              terms: motif.terms, friction: block.friction },
            (base) => ({ ...base, kind: 'motif', gist: motif.gist })
          );
        }
        return;
      case 'tension':
        this.claim(
          { kind: 'tension-arc', lens: 'tension', title: 'Tension arc', claim: block.claim, quotes: block.peaks,
            terms: [], friction: block.friction },
          (base) => ({ ...base, kind: 'tension-arc', scores: [...block.scores] })
        );
        return;
      case 'characters':
        this.malformed('character', 'characters', block.malformed);
        for (const character of block.items) {
          this.claim(
            { kind: 'character', lens: 'characters', title: character.name, claim: character.claim,
              quotes: character.evidence, terms: [character.name, ...character.aliases], friction: block.friction },
            (base) => ({
              ...base,
              kind: 'character',
              archetype: character.archetype,
              energy: character.energy,
              wants: character.wants,
              hides: character.hides
            })
          );
        }
        return;
      case 'voice': {
        const average = this.context.averageWordsPerSentence;
        this.claim(
          { kind: 'voice', lens: 'voice', title: 'Narrative voice', claim: block.claim, quotes: block.evidence,
            terms: [], friction: block.friction },
          (base) => ({
            ...base,
            kind: 'voice',
            traits: block.traits.map(({ key, value }) => ({
              label: LIGHTBOX_VOICE_TRAITS.find(([candidate]) => candidate === key)?.[1] ?? key,
              value,
              ...(key === 'music' ? lightboxMeasuredMusic(average) : {})
            }))
          })
        );
        return;
      }
      case 'genre':
        this.malformed('genre-neighbor', 'genre', block.malformed);
        for (const neighbor of block.neighbors) {
          this.claim(
            { kind: 'genre-neighbor', lens: 'genre', title: neighbor.genre, claim: neighbor.claim,
              quotes: neighbor.evidence, terms: [], friction: block.friction },
            (base) => ({ ...base, kind: 'genre-neighbor', affinity: neighbor.affinity, nearMiss: neighbor.nearMiss })
          );
        }
        this.claim(
          { kind: 'reader-promise', lens: 'genre', title: 'Reader promise', claim: block.promise.text,
            quotes: block.promise.evidence, terms: [], friction: block.friction },
          (base) => ({ ...base, kind: 'reader-promise' })
        );
        return;
      case 'gravity':
        assembleGravityBlock(block, this);
        return;
      case 'palette':
        assemblePaletteBlock(block, this);
        return;
    }
  }

  /** Items the codec could not read, withheld by title. */
  malformed(kind: LightboxReadingTileKind, lens: LightboxLensId, items: readonly LightboxMalformedItem[]): void {
    for (const item of items) {
      this.withheldClaims.push({ kind, lens, title: item.title, reason: item.reason, quotes: [] });
    }
  }

  /** Check a claim's quotes and count its support; keep it as a tile if its kind's gate allows, or withhold it by title. */
  claim(
    draft: LightboxClaimDraft,
    build: (base: LightboxTileBase, accepted: LightboxAcceptedClaim) => LightboxReadingTile
  ): LightboxReadingTile | undefined {
    const checked = this.check(draft.lens, draft.quotes);
    const support = draft.support ?? countLightboxSupport(draft.terms, this.context.counter);
    const verdict = lightboxTileGate(
      { kind: draft.kind, evidence: checked.evidence, support, fields: draft.fields },
      { phase: 'fresh', drawnFields: this.drawnFields }
    );
    if (!verdict.ok) {
      this.withhold(draft, verdict.reason, checked.withheld);
      return undefined;
    }
    const paragraphs = new Set<number>(checked.evidence.map((quote) => quote.paragraph));
    for (const term of support) {
      term.paragraphs.forEach((index) => paragraphs.add(index));
    }
    const tile = build({
      id: this.context.mintId(),
      lens: draft.lens,
      title: draft.title,
      claim: draft.claim,
      paragraphs: [...paragraphs].sort((a, b) => a - b),
      evidence: checked.evidence,
      withheldQuotes: checked.withheld,
      support,
      friction: draft.friction
    }, { witness: verdict.witness });
    if (tile.kind === 'gravity-field') {
      this.drawnFields.set(lightboxFieldKey(tile.title), tile.support.map((term) => term.term));
    }
    this.tiles.push(tile);
    return tile;
  }

  private withhold(draft: LightboxClaimDraft, reason: string, quotes: LightboxWithheldQuote[]): void {
    this.withheldClaims.push({ kind: draft.kind, lens: draft.lens, title: draft.title, reason, quotes });
  }

  private check(lens: LightboxLensId, quotes: readonly (LightboxWireQuote | LightboxWirePeak)[]): CheckedEvidence {
    const evidence: LightboxVerifiedQuote[] = [];
    const withheld: LightboxWithheldQuote[] = [];
    const seen = new Set<string>();
    const counts = this.checks.get(lens) ?? { checked: 0, withheld: 0 };
    this.checks.set(lens, counts);
    for (const wire of quotes) {
      this.quotesChecked += 1;
      counts.checked += 1;
      const verdict = this.context.verifier.verify(wire.para, wire.quote);
      if (!verdict.found) {
        this.quotesWithheld += 1;
        counts.withheld += 1;
        withheld.push({
          paragraph: verdict.paragraph,
          reason: verdict.reason,
          ...(verdict.foundIn ? { foundIn: verdict.foundIn } : {})
        });
        continue;
      }
      const key = `${verdict.paragraph}:${verdict.text}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      evidence.push({
        paragraph: verdict.paragraph,
        text: verdict.text,
        match: verdict.match,
        ...('note' in wire ? { note: wire.note } : {})
      });
    }
    return { evidence, withheld };
  }
}
