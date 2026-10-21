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
 *   palette's words are in the text, a said line is dialogue, a spark is
 *   counted, a handoff's sentences are adjacent, a numbers reading's quotes
 *   hold an instance, a thread's quotes stand in order, an object is
 *   counted) run through `LightboxTileGates`, the same rules stale carry
 *   applies (PR #150 F-05), and group E's movements are held as a set
 *   (`LightboxPlotTiles`);
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
  LightboxNumberStatId,
  LightboxLensQuoteChecks,
  LightboxReadingTile,
  LightboxReadingTileKind,
  LightboxVerifiedQuote,
  LightboxWithheldBlock,
  LightboxWithheldClaim,
  LightboxWithheldQuote
} from '@messages';
import type { LightboxQuoteVerdict, LightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { lightboxPhraseHeld, type LightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { countLightboxSupport } from '@/infrastructure/lightbox/LightboxTileCounts';
import { assembleGravityBlock, assemblePaletteBlock } from '@/infrastructure/lightbox/LightboxGravityTiles';
import { assembleLineageBlock, assembleSparkBlock, assembleSubtextBlock } from '@/infrastructure/lightbox/LightboxStoryTiles';
import { assembleNumbersBlock, assembleRhythmBlock, assembleStockBlock } from '@/infrastructure/lightbox/LightboxCraftTiles';
import { LightboxPlotAssembly } from '@/infrastructure/lightbox/LightboxPlotTiles';
import { assembleFirstReadingBlock } from '@/infrastructure/lightbox/LightboxFirstReadingTiles';
import type { LightboxThreadCandidate } from '@/infrastructure/lightbox/LightboxPlotGates';
import { findLightboxSentencePair, type LightboxSentencePair } from '@/infrastructure/lightbox/LightboxSentencePairs';
import type { LightboxStandoutRows } from '@/infrastructure/lightbox/LightboxNumberInstances';
import {
  createLightboxDialogueIndex,
  lightboxSaidLedEvidence,
  type LightboxDialogueIndex
} from '@/infrastructure/lightbox/LightboxDialogueAnchor';
import { lightboxFieldKey, lightboxTileGate } from '@/infrastructure/lightbox/LightboxTileGates';
import type {
  LightboxDecodedBlock,
  LightboxDecodedGroup,
  LightboxMalformedItem,
  LightboxWireQuote,
  LightboxWirePeak
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
  subtext: 'subtext',
  genre: 'genre-neighbor',
  lineage: 'lineage',
  spark: 'spark',
  stock: 'stock-tiers',
  rhythm: 'rhythm-endings',
  numbers: 'number-usage',
  template: 'template',
  pressure: 'pressure-thread',
  artifacts: 'artifact',
  summary: 'synopsis',
  opinion: 'opinion'
};

export interface LightboxTileAssemblyContext {
  verifier: LightboxQuoteVerifier;
  counter: LightboxTermCounter;
  /** Mints the run's tile ids, in tile order. */
  mintId: () => string;
  /** The board's measured average words per sentence, set beside the voice's sentence music. */
  averageWordsPerSentence?: number;
  /** Each ribbon column's key (`lightboxColumnKeys`), kept on the tension arc and the endings so they follow their text. */
  columnKeys?: readonly string[];
  /** The figures that stand out on the board read (Slice 4B): what a numbers reading may name, and its quotes' instance checks. */
  standouts?: LightboxStandoutRows;
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
  // The lenses this call read: those decoded and those withheld by the codec.
  const requested = [...decoded.blocks.map((block) => block.lens), ...decoded.withheld.map((entry) => entry.lens)];
  const assembly = new GroupAssembly(context, requested);
  for (const { lens, reason } of decoded.withheld) {
    assembly.withheldBlocks.push({ kind: LIGHTBOX_LENS_BLOCK_KIND[lens], lens, reason });
  }
  for (const block of decoded.blocks) {
    assembly.block(block);
  }
  // Engagement sits on the movements, so it is joined once every block is assembled (Slice 4C).
  assembly.plot.finish();
  return {
    tiles: assembly.tiles,
    withheldBlocks: assembly.withheldBlocks,
    withheldClaims: assembly.withheldClaims,
    frictions: decoded.blocks.map((block) => ({
      lens: block.lens,
      friction: block.friction,
      // Lineage keeps what it checked and set aside with its friction: the block's own notes.
      ...(block.lens === 'lineage' ? { setAside: block.setAside.map((entry) => ({ ...entry })) } : {})
    })),
    quoteChecks: decoded.blocks.map((block) => ({ lens: block.lens, ...(assembly.checks.get(block.lens) ?? { checked: 0, withheld: 0 }) })),
    quotesChecked: assembly.quotesChecked,
    quotesWithheld: assembly.quotesWithheld
  };
}

interface CheckedEvidence {
  evidence: LightboxVerifiedQuote[];
  withheld: LightboxWithheldQuote[];
  /** Each quote as found, in input order (undefined where it was not). */
  found: Array<LightboxVerifiedQuote | undefined>;
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
  /** A subtext pair's said line, checked first and held to the dialogue rule (`LightboxTileGates`). */
  said?: LightboxWireQuote;
  /** A handoff's two quotes, checked as adjacent sentences of one paragraph (`LightboxSentencePairs`). */
  pair?: { from: LightboxWireQuote; to: LightboxWireQuote };
  /** How each of `quotes` is verified, when not plainly (a numbers reading's instance check). */
  verifyQuote?: (paragraph: number, quote: string) => LightboxQuoteVerdict;
  /** A numbers reading's figure, for its gate. */
  stat?: LightboxNumberStatId;
  /** A familiar phrase, for its gate. */
  phrase?: string;
  /** The title a withheld claim is shown by, when the tile's own would show unchecked words as the chapter's. */
  withheldTitle?: string;
  /** Quotes the block already checked (`verifyQuotes`), in place of checking `quotes` (Slice 4C). */
  prechecked?: { evidence: LightboxVerifiedQuote[]; withheld: LightboxWithheldQuote[] };
  /** A pressure thread's quotes as found, for its gate (Slice 4C). */
  thread?: LightboxThreadCandidate;
}

export type LightboxTileBase = Omit<Extract<LightboxReadingTile, { kind: 'headline' }>, 'kind'>;

/** What the gate found while accepting a tile: a collision's witness, a pair's said line. */
export interface LightboxAcceptedClaim {
  witness?: LightboxVerifiedQuote;
  said?: LightboxVerifiedQuote;
  pair?: LightboxSentencePair;
  /** Each of the draft's `quotes` as found, in order (undefined where it was not). */
  found: Array<LightboxVerifiedQuote | undefined>;
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
  /** Check quotes against the paragraphs they name, counted in the lens's tally: each as found, in order (Slice 4C). */
  verifyQuotes(
    lens: LightboxLensId,
    quotes: readonly LightboxWireQuote[]
  ): { found: Array<LightboxVerifiedQuote | undefined>; withheld: LightboxWithheldQuote[] };
  /** Keep a tile whose rules its block applied as a set (a movement of a set that tiles the chapter). */
  keep(tile: LightboxReadingTile): void;
  /** Swap a kept tile for its completed self (a template with its engagement), in place. */
  replace(tile: LightboxReadingTile): void;
  /** Withhold a claim its block judged as a whole (the movements, engagement), by a host title. */
  withholdClaim(claim: LightboxWithheldClaim): void;
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
  /** Where the chapter's dialogue stands, for a said line's gate. */
  private readonly dialogue: LightboxDialogueIndex;
  /** Group E's own state across its blocks: the movements drawn, the template awaiting its engagement. */
  readonly plot: LightboxPlotAssembly;

  constructor(readonly context: LightboxTileAssemblyContext, requested: readonly LightboxLensId[]) {
    this.dialogue = createLightboxDialogueIndex(context.verifier);
    this.plot = new LightboxPlotAssembly(this, requested);
  }

  block(block: LightboxDecodedBlock): void {
    switch (block.lens) {
      case 'headline':
      case 'motif':
      case 'tension':
      case 'characters':
      case 'voice':
      case 'genre':
        assembleFirstReadingBlock(block, this);
        return;
      case 'gravity':
        assembleGravityBlock(block, this);
        return;
      case 'palette':
        assemblePaletteBlock(block, this);
        return;
      case 'subtext':
        assembleSubtextBlock(block, this);
        return;
      case 'lineage':
        assembleLineageBlock(block, this);
        return;
      case 'spark':
        assembleSparkBlock(block, this);
        return;
      case 'stock':
        assembleStockBlock(block, this);
        return;
      case 'rhythm':
        assembleRhythmBlock(block, this);
        return;
      case 'numbers':
        assembleNumbersBlock(block, this);
        return;
      case 'template':
        this.plot.template(block);
        return;
      case 'pressure':
        this.plot.pressure(block);
        return;
      case 'artifacts':
        this.plot.artifacts(block);
        return;
      case 'summary':
        this.plot.summary(block);
        return;
      case 'opinion':
        // The Opinion is assembled from the board's digest (`LightboxOpinionReply`), never from the chapter.
        this.withheldBlocks.push({ kind: 'opinion', lens: 'opinion', reason: 'The Opinion reads the board, not the chapter, so it is not read with a chapter group.' });
        return;
    }
  }

  verifyQuotes(
    lens: LightboxLensId,
    quotes: readonly LightboxWireQuote[]
  ): { found: Array<LightboxVerifiedQuote | undefined>; withheld: LightboxWithheldQuote[] } {
    const checked = this.check(lens, quotes);
    return { found: checked.found, withheld: checked.withheld };
  }

  keep(tile: LightboxReadingTile): void {
    this.tiles.push(tile);
  }

  replace(tile: LightboxReadingTile): void {
    const index = this.tiles.findIndex((candidate) => candidate.id === tile.id);
    if (index >= 0) {
      this.tiles[index] = tile;
    }
  }

  withholdClaim(claim: LightboxWithheldClaim): void {
    this.withheldClaims.push(claim);
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
    // A said line is checked first, so it leads the tile's evidence; it is found in speech where the verifier can (PR #151 F-04).
    const saidCheck = draft.said
      ? this.check(draft.lens, [draft.said], (paragraph, quote) => this.dialogue.verifySaid(paragraph, quote))
      : undefined;
    const pairCheck = draft.pair ? this.checkPair(draft.lens, draft.pair) : undefined;
    const rest = draft.prechecked
      ? { ...draft.prechecked, found: [...draft.prechecked.evidence] }
      : this.check(draft.lens, draft.quotes, draft.verifyQuote);
    const said = saidCheck ? (saidCheck.evidence[0] ?? null) : undefined;
    const checked: CheckedEvidence = {
      evidence: lightboxSaidLedEvidence(said, [...(pairCheck?.evidence ?? []), ...rest.evidence]),
      withheld: [...(saidCheck?.withheld ?? []), ...(pairCheck?.withheld ?? []), ...rest.withheld],
      found: rest.found
    };
    const support = draft.support ?? countLightboxSupport(draft.terms, this.context.counter);
    const verdict = lightboxTileGate(
      {
        kind: draft.kind, evidence: checked.evidence, support, fields: draft.fields,
        ...(said !== undefined ? { said } : {}),
        ...(pairCheck ? { pair: pairCheck.pair } : {}),
        ...(draft.stat ? { stat: draft.stat } : {}),
        // A familiar phrase is held to a whole occurrence inside a found quote's span (PR #155 F-03).
        ...(draft.phrase !== undefined ? { phraseHeld: lightboxPhraseHeld(this.context.verifier, checked.evidence, draft.phrase) } : {}),
        ...(draft.thread ? { thread: draft.thread } : {})
      },
      { phase: 'fresh', drawnFields: this.drawnFields, dialogue: this.dialogue, standouts: this.context.standouts ?? new Map() }
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
    }, {
      witness: verdict.witness,
      found: checked.found,
      ...(said ? { said } : {}),
      ...(pairCheck && typeof pairCheck.pair === 'object' ? { pair: pairCheck.pair } : {})
    });
    if (tile.kind === 'gravity-field') {
      this.drawnFields.set(lightboxFieldKey(tile.title), tile.support.map((term) => term.term));
    }
    this.tiles.push(tile);
    return tile;
  }

  private withhold(draft: LightboxClaimDraft, reason: string, quotes: LightboxWithheldQuote[]): void {
    this.withheldClaims.push({ kind: draft.kind, lens: draft.lens, title: draft.withheldTitle ?? draft.title, reason, quotes });
  }

  /** A handoff's two quotes, as one check of two quotes: adjacent sentences of one paragraph, or why not. */
  private checkPair(
    lens: LightboxLensId,
    pair: { from: LightboxWireQuote; to: LightboxWireQuote }
  ): CheckedEvidence & { pair: LightboxSentencePair | 'gone' | 'not-adjacent' } {
    const counts = this.checks.get(lens) ?? { checked: 0, withheld: 0 };
    this.checks.set(lens, counts);
    const verdict = findLightboxSentencePair(
      this.context.verifier,
      { paragraph: pair.from.para, text: pair.from.quote },
      { paragraph: pair.to.para, text: pair.to.quote }
    );
    const withheld = verdict.ok ? [] : verdict.withheld;
    this.quotesChecked += 2;
    counts.checked += 2;
    this.quotesWithheld += withheld.length;
    counts.withheld += withheld.length;
    return verdict.ok
      ? { evidence: [verdict.pair.from, verdict.pair.to], withheld, found: [], pair: verdict.pair }
      : { evidence: verdict.found, withheld, found: [], pair: verdict.why };
  }

  private check(
    lens: LightboxLensId,
    quotes: readonly (LightboxWireQuote | LightboxWirePeak)[],
    verify: (paragraph: number, quote: string) => LightboxQuoteVerdict = (paragraph, quote) => this.context.verifier.verify(paragraph, quote)
  ): CheckedEvidence {
    const evidence: LightboxVerifiedQuote[] = [];
    const withheld: LightboxWithheldQuote[] = [];
    const found: Array<LightboxVerifiedQuote | undefined> = [];
    const seen = new Set<string>();
    const counts = this.checks.get(lens) ?? { checked: 0, withheld: 0 };
    this.checks.set(lens, counts);
    for (const wire of quotes) {
      this.quotesChecked += 1;
      counts.checked += 1;
      const verdict = verify(wire.para, wire.quote);
      if (!verdict.found) {
        found.push(undefined);
        this.quotesWithheld += 1;
        counts.withheld += 1;
        withheld.push({
          paragraph: verdict.paragraph,
          reason: verdict.reason,
          ...(verdict.foundIn ? { foundIn: verdict.foundIn } : {})
        });
        continue;
      }
      const quote: LightboxVerifiedQuote = {
        paragraph: verdict.paragraph,
        text: verdict.text,
        match: verdict.match,
        ...('note' in wire ? { note: wire.note } : {})
      };
      found.push(quote);
      const key = `${verdict.paragraph}:${verdict.text}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      evidence.push(quote);
    }
    return { evidence, withheld, found };
  }
}
