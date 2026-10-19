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
 * - withholds a claim left with no quote, by title, as a first reading would,
 *   holds a motif to recurring in two paragraphs, and draws a collision only
 *   while both its fields are still drawn;
 * - recounts every counted term against the current text, so no count on the
 *   board describes a text that is gone;
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
import { LIGHTBOX_MOTIF_MINIMUM_PARAGRAPHS } from '@/infrastructure/lightbox/LightboxReadingWire';
import { recountLightboxTile } from '@/infrastructure/lightbox/LightboxTileCounts';

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

const NO_QUOTE_LEFT = 'Its quotes are no longer in the chapter.';
const COLLISION_FIELD_GONE = 'One of the fields it names is no longer on the board.';
const nameKey = (name: string): string => name.toLocaleLowerCase('en-US');

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
  const tiles: LightboxReadingTile[] = [];
  const withheldClaims: LightboxWithheldClaim[] = group.withheldClaims.map((claim) => ({
    ...claim,
    quotes: claim.quotes.map(withoutAddresses)
  }));
  const lostByLens = new Map<LightboxLensId, number>();
  for (const tile of group.tiles) {
    const carried = carryTile(tile, tools);
    lostByLens.set(tile.lens, (lostByLens.get(tile.lens) ?? 0) + carried.lost);
    if ('tile' in carried) {
      tiles.push(carried.tile);
    } else {
      withheldClaims.push(carried.withheld);
    }
  }
  // A collision is drawn only between two drawn fields (as on a first reading).
  const fields = new Set(tiles.flatMap((tile) => (tile.kind === 'gravity-field' ? [nameKey(tile.title)] : [])));
  const orphaned = tiles.filter((tile) => tile.kind === 'gravity-collision' && !tile.fields.every((name) => fields.has(nameKey(name))));
  for (const collision of orphaned) {
    tiles.splice(tiles.indexOf(collision), 1);
    withheldClaims.push({
      kind: collision.kind,
      lens: collision.lens,
      title: collision.title,
      reason: COLLISION_FIELD_GONE,
      quotes: collision.withheldQuotes
    });
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

function carryTile(tile: LightboxReadingTile, tools: CarryTools): CarriedTile {
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
  const withhold = (reason: string): CarriedTile => ({
    withheld: { kind: tile.kind, lens: tile.lens, title: tile.title, reason, quotes: withheldQuotes },
    lost: lost.length
  });
  if (evidence.length === 0) {
    return withhold(NO_QUOTE_LEFT);
  }
  const foundParagraphs = new Set(evidence.map((quote) => quote.paragraph));
  if (tile.kind === 'motif' && foundParagraphs.size < LIGHTBOX_MOTIF_MINIMUM_PARAGRAPHS) {
    return withhold('A motif recurs, but its quotes now stand in only one paragraph.');
  }
  const recounted = recountLightboxTile(tile, tools.counter, {
    paragraphCount: tools.context.paragraphs.length,
    averageWordsPerSentence: tools.context.averageWordsPerSentence
  });
  return {
    tile: {
      ...recounted,
      evidence,
      withheldQuotes,
      paragraphs: paragraphsOf(foundParagraphs, recounted.support)
    },
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
