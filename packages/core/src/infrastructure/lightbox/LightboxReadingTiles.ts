/**
 * From a decoded group to board tiles (ADR 2026-10-19 D3, D7). Pure: no host,
 * no I/O.
 *
 * This is where a reading becomes something the board can show, and every
 * honesty rule that needs the chapter runs here:
 * - each quote is checked against the paragraph it names (the verifier);
 *   found quotes keep the chapter's own span and match kind, failed ones
 *   become withheld quotes with their reason, never their text;
 * - a claim left with no found quote is withheld by its title, and a motif
 *   found in fewer than two paragraphs is withheld because a motif recurs;
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
  LightboxReadingTile,
  LightboxReadingTileKind,
  LightboxVerifiedQuote,
  LightboxWithheldBlock,
  LightboxWithheldClaim,
  LightboxWithheldQuote
} from '@messages';
import type { LightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import type { LightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import {
  LIGHTBOX_MOTIF_MINIMUM_PARAGRAPHS,
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
  /** Every quote the verifier saw, and how many it withheld. */
  quotesChecked: number;
  quotesWithheld: number;
}

const NO_QUOTE_FOUND = 'No quote it gave was found in the paragraph it named.';

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
    quotesChecked: assembly.quotesChecked,
    quotesWithheld: assembly.quotesWithheld
  };
}

interface CheckedEvidence {
  evidence: LightboxVerifiedQuote[];
  withheld: LightboxWithheldQuote[];
}

/** Claim fields every tile shares; the kind-specific fields are added by each block. */
interface ClaimDraft {
  kind: LightboxReadingTileKind;
  lens: LightboxLensId;
  title: string;
  claim: string;
  quotes: readonly (LightboxWireQuote | LightboxWirePeak)[];
  terms: readonly string[];
  friction: string;
  /** A motif recurs: its found quotes must stand in this many paragraphs. */
  minimumParagraphs?: number;
}

type TileBase = Omit<Extract<LightboxReadingTile, { kind: 'headline' }>, 'kind'>;

class GroupAssembly {
  readonly tiles: LightboxReadingTile[] = [];
  readonly withheldBlocks: LightboxWithheldBlock[] = [];
  readonly withheldClaims: LightboxWithheldClaim[] = [];
  quotesChecked = 0;
  quotesWithheld = 0;

  constructor(private readonly context: LightboxTileAssemblyContext) {}

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
              terms: motif.terms, friction: block.friction, minimumParagraphs: LIGHTBOX_MOTIF_MINIMUM_PARAGRAPHS },
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
              ...(key === 'music' && average !== undefined && average > 0 ? { measured: `${average} avg` } : {})
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
    }
  }

  /** Items the codec could not read, withheld by title. */
  private malformed(kind: LightboxReadingTileKind, lens: LightboxLensId, items: readonly LightboxMalformedItem[]): void {
    for (const item of items) {
      this.withheldClaims.push({ kind, lens, title: item.title, reason: item.reason, quotes: [] });
    }
  }

  /** Check a claim's quotes; keep it as a tile, or withhold it by title. */
  private claim(draft: ClaimDraft, build: (base: TileBase) => LightboxReadingTile): void {
    const checked = this.check(draft.quotes);
    const foundParagraphs = new Set(checked.evidence.map((quote) => quote.paragraph));
    if (checked.evidence.length === 0) {
      this.withhold(draft, NO_QUOTE_FOUND, checked.withheld);
      return;
    }
    if (draft.minimumParagraphs !== undefined && foundParagraphs.size < draft.minimumParagraphs) {
      this.withhold(
        draft,
        `A motif recurs, but its quotes were found in only ${foundParagraphs.size === 1 ? 'one paragraph' : 'no paragraph'}.`,
        checked.withheld
      );
      return;
    }
    const support = this.support(draft.terms);
    const paragraphs = new Set<number>(foundParagraphs);
    for (const term of support) {
      term.paragraphs.forEach((index) => paragraphs.add(index));
    }
    this.tiles.push(build({
      id: this.context.mintId(),
      lens: draft.lens,
      title: draft.title,
      claim: draft.claim,
      paragraphs: [...paragraphs].sort((a, b) => a - b),
      evidence: checked.evidence,
      withheldQuotes: checked.withheld,
      support,
      friction: draft.friction
    }));
  }

  private withhold(draft: ClaimDraft, reason: string, quotes: LightboxWithheldQuote[]): void {
    this.withheldClaims.push({ kind: draft.kind, lens: draft.lens, title: draft.title, reason, quotes });
  }

  private check(quotes: readonly (LightboxWireQuote | LightboxWirePeak)[]): CheckedEvidence {
    const evidence: LightboxVerifiedQuote[] = [];
    const withheld: LightboxWithheldQuote[] = [];
    const seen = new Set<string>();
    for (const wire of quotes) {
      this.quotesChecked += 1;
      const verdict = this.context.verifier.verify(wire.para, wire.quote);
      if (!verdict.found) {
        this.quotesWithheld += 1;
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

  /** Count each named term once; a lone stopword ("she") counts nothing worth showing. */
  private support(terms: readonly string[]): LightboxCountedSupport[] {
    const support: LightboxCountedSupport[] = [];
    const seen = new Set<string>();
    for (const term of terms) {
      if (this.context.counter.isStopword(term)) {
        continue;
      }
      const counted = this.context.counter.count(term);
      if (counted.term.length === 0 || seen.has(counted.term)) {
        continue;
      }
      seen.add(counted.term);
      support.push(counted);
    }
    return support;
  }
}
