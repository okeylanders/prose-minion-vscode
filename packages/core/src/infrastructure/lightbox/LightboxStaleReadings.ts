/**
 * Stale readings (ADR 2026-10-19 D4). Pure: no host, no I/O.
 *
 * When a source's text changes, the board is rebuilt from the new text and
 * its readings are carried over rather than dropped: they were paid for, and
 * the writer may only have fixed a typo. They are not trusted as they stand,
 * though. Carrying a reading over:
 * - marks every lens it holds stale, with the hash of the text it was read
 *   against (a lens already stale keeps its original hash);
 * - checks each found quote again, now against the current paragraphs. A
 *   quote still in the paragraph it names keeps its place; one whose
 *   paragraph moved follows its words to the nearest paragraph that holds
 *   them (the host moving its own verified span, never a model's claim); a
 *   quote whose words are gone is withheld as no longer in the chapter;
 * - recounts every counted term against the current text, so no count on the
 *   board describes a text that is gone;
 * - holds every tile to the rules a first reading meets, through the same
 *   `LightboxTileGates` fresh assembly uses (PR #150 F-05): a claim left with
 *   no quote, a motif in one paragraph, a collision with no sentence its
 *   fields still share (or a field that did not survive), and a palette tile
 *   whose words are gone are withheld, by title, with a host-owned reason;
 * - sets aside a group that was still being read when the text changed: its
 *   run read the old text, and nothing it returns is attached here.
 * A fresh reading of a lens replaces its stale readings and clears the mark
 * (`LightboxReadingState`).
 */

import type {
  LightboxCountedSupport,
  LightboxLensId,
  LightboxReadingGroup,
  LightboxReadingTile,
  LightboxStaleLens,
  LightboxVerifiedQuote,
  LightboxWithheldClaim,
  LightboxWithheldQuote
} from '@messages';
import { LIGHTBOX_LENSES } from '@shared/constants/lightbox';
import { createLightboxQuoteVerifier, type LightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter, type LightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { recountLightboxTile } from '@/infrastructure/lightbox/LightboxTileCounts';
import { lightboxFieldKey, lightboxTileGate } from '@/infrastructure/lightbox/LightboxTileGates';

export interface LightboxCarryContext {
  /** The hash of the text the readings were read against (the replaced board's). */
  readAgainst: string;
  /** The current text's paragraphs; index 0 is ¶1. */
  paragraphs: readonly string[];
  /** The current board's measured average words per sentence, set beside the voice. */
  averageWordsPerSentence: number;
}

/** Writer-facing: a group that was mid-run when the text changed. */
export const LIGHTBOX_CHANGED_WHILE_READING =
  'The chapter changed while this group was being read, so that reading was set aside. Read the rest to read the new text.';


interface CarryTools {
  verifier: LightboxQuoteVerifier;
  counter: LightboxTermCounter;
  context: LightboxCarryContext;
}

/** Carry a replaced board's reading groups onto the board built from the changed text. */
export function carryLightboxReadings(
  readings: readonly LightboxReadingGroup[],
  context: LightboxCarryContext
): LightboxReadingGroup[] {
  const tools: CarryTools = {
    verifier: createLightboxQuoteVerifier(context.paragraphs),
    counter: createLightboxTermCounter(context.paragraphs),
    context
  };
  return readings.map((group) => carryGroup(group, tools));
}

function carryGroup(group: LightboxReadingGroup, tools: CarryTools): LightboxReadingGroup {
  if (group.status === 'not-run') {
    return group;
  }
  const withheldClaims: LightboxWithheldClaim[] = group.withheldClaims.map((claim) => ({
    ...claim,
    quotes: claim.quotes.map(withoutAddresses)
  }));
  // Fields before collisions, so a collision's gate sees the fields that
  // survive the carry; the board keeps the tiles' original order.
  const results = new Map<LightboxReadingTile, CarriedTile>();
  const drawnFields = new Map<string, readonly string[]>();
  for (const tile of group.tiles.filter((candidate) => candidate.kind !== 'gravity-collision')) {
    const result = carryTile(tile, tools, drawnFields);
    results.set(tile, result);
    if ('tile' in result && result.tile.kind === 'gravity-field') {
      drawnFields.set(lightboxFieldKey(result.tile.title), result.tile.support.map((term) => term.term));
    }
  }
  for (const tile of group.tiles.filter((candidate) => candidate.kind === 'gravity-collision')) {
    results.set(tile, carryTile(tile, tools, drawnFields));
  }
  const tiles: LightboxReadingTile[] = [];
  const lostByLens = new Map<LightboxLensId, number>();
  for (const tile of group.tiles) {
    const result = results.get(tile) as CarriedTile;
    lostByLens.set(tile.lens, (lostByLens.get(tile.lens) ?? 0) + result.lost);
    if ('tile' in result) {
      tiles.push(result.tile);
    } else {
      withheldClaims.push(result.withheld);
    }
  }
  const staleLenses = staleMarks(group, tools.context.readAgainst);
  const { pending: _pending, staleLenses: _previous, ...rest } = group;
  const carried: LightboxReadingGroup = {
    ...rest,
    tiles,
    // A quote that was found and is gone now counts as withheld in the tally.
    quoteChecks: group.quoteChecks.map((checks) => ({ ...checks, withheld: checks.withheld + (lostByLens.get(checks.lens) ?? 0) })),
    withheldClaims,
    ...(staleLenses.length > 0 ? { staleLenses } : {})
  };
  return group.status === 'running'
    ? { ...carried, status: 'cancelled', error: LIGHTBOX_CHANGED_WHILE_READING }
    : carried;
}

/** Every lens the group holds readings for is stale now; one already stale keeps its hash. */
function staleMarks(group: LightboxReadingGroup, readAgainst: string): LightboxStaleLens[] {
  const marks = new Map<LightboxLensId, string>();
  for (const mark of group.staleLenses ?? []) {
    marks.set(mark.lens, mark.readAgainst);
  }
  for (const lens of group.lenses) {
    if (!marks.has(lens)) {
      marks.set(lens, readAgainst);
    }
  }
  return LIGHTBOX_LENSES
    .filter((lens) => marks.has(lens.id))
    .map((lens) => ({ lens: lens.id, readAgainst: marks.get(lens.id) as string }));
}

/** A withheld quote's "the words stand in ¶n" pointed into the old text; it is dropped. */
function withoutAddresses(quote: LightboxWithheldQuote): LightboxWithheldQuote {
  return { paragraph: quote.paragraph, reason: quote.reason };
}

/** A carried tile, or the claim it became, with how many of its found quotes are gone. */
type CarriedTile = ({ tile: LightboxReadingTile } | { withheld: LightboxWithheldClaim }) & { lost: number };

function carryTile(
  tile: LightboxReadingTile,
  tools: CarryTools,
  drawnFields: ReadonlyMap<string, readonly string[]>
): CarriedTile {
  const evidence: LightboxVerifiedQuote[] = [];
  const lost: LightboxWithheldQuote[] = [];
  const seen = new Set<string>();
  for (const quote of tile.evidence) {
    const found = recheckQuote(quote, tools.verifier);
    if (!found) {
      lost.push({ paragraph: quote.paragraph, reason: 'no-longer-in-chapter' });
      continue;
    }
    const key = `${found.paragraph}:${found.text}`;
    if (!seen.has(key)) {
      seen.add(key);
      evidence.push(found);
    }
  }
  const withheldQuotes = [...lost, ...tile.withheldQuotes.map(withoutAddresses)];
  const recounted = recountLightboxTile(tile, tools.counter, {
    paragraphCount: tools.context.paragraphs.length,
    averageWordsPerSentence: tools.context.averageWordsPerSentence
  });
  // The same rules a first reading meets (PR #150 F-05).
  const verdict = lightboxTileGate(
    {
      kind: tile.kind,
      evidence,
      support: recounted.support,
      ...(tile.kind === 'gravity-collision' ? { fields: tile.fields } : {})
    },
    { phase: 'carried', drawnFields }
  );
  if (!verdict.ok) {
    return {
      withheld: { kind: tile.kind, lens: tile.lens, title: tile.title, reason: verdict.reason, quotes: withheldQuotes },
      lost: lost.length
    };
  }
  const foundParagraphs = new Set(evidence.map((quote) => quote.paragraph));
  const kept: LightboxReadingTile = {
    ...recounted,
    evidence,
    withheldQuotes,
    paragraphs: paragraphsOf(foundParagraphs, recounted.support)
  };
  return {
    tile: kept.kind === 'gravity-collision' && verdict.witness ? { ...kept, witness: verdict.witness } : kept,
    lost: lost.length
  };
}

/**
 * The quote where it stood, or where its words now stand: the nearest
 * paragraph that holds them (the earlier one on a tie). Undefined when the
 * words are gone.
 */
function recheckQuote(quote: LightboxVerifiedQuote, verifier: LightboxQuoteVerifier): LightboxVerifiedQuote | undefined {
  const note = quote.note !== undefined ? { note: quote.note } : {};
  const verdict = verifier.verify(quote.paragraph, quote.text);
  if (verdict.found) {
    return { paragraph: verdict.paragraph, text: verdict.text, match: verdict.match, ...note };
  }
  const nearest = [...(verdict.foundIn ?? [])]
    .sort((a, b) => Math.abs(a - quote.paragraph) - Math.abs(b - quote.paragraph) || a - b)[0];
  if (nearest === undefined) {
    return undefined;
  }
  const moved = verifier.verify(nearest, quote.text);
  return moved.found ? { paragraph: moved.paragraph, text: moved.text, match: moved.match, ...note } : undefined;
}

function paragraphsOf(found: ReadonlySet<number>, support: readonly LightboxCountedSupport[]): number[] {
  const paragraphs = new Set<number>(found);
  for (const term of support) {
    term.paragraphs.forEach((index) => paragraphs.add(index));
  }
  return [...paragraphs].sort((a, b) => a - b);
}
