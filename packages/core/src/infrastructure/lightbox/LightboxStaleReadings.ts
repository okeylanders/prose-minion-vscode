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
 *   quote whose words are gone is withheld as no longer in the chapter. A
 *   pair's said line is found again on its own, in speech where it can be,
 *   and leads the pair's evidence as a fresh read's does
 *   (`lightboxSaidLedEvidence`, PR #151 F-07);
 * - recounts every counted term against the current text, so no count on the
 *   board describes a text that is gone, and moves each tension score with
 *   the paragraphs it was read on, leaving changed ones unscored (F-06);
 * - holds every tile to the rules a first reading meets, through the same
 *   `LightboxTileGates` fresh assembly uses (PR #150 F-05): a claim left with
 *   no quote, a motif in one paragraph, a collision with no sentence its
 *   fields still share (or a field that did not survive), a palette tile
 *   whose words are gone, a said line that is gone or no longer inside
 *   dialogue, and a spark whose counted words are gone are withheld, by
 *   title, with a host-owned reason;
 * - carries group D's kinds by their own rules (Slice 4B,
 *   `LightboxCarryQuotes`): a numbers reading's quotes against the new
 *   board's measured figure, a handoff as a pair of adjacent sentences, a
 *   tier mix beat by beat with its tiers counted again; and moves each
 *   paragraph ending with its column's text, as tension moves;
 * - carries group G's kinds (Slice 4F, `LightboxCarryQuotes`): a steering
 *   reading's and note's quotes by the figure's own detector on the new
 *   text, and a note's example anchored again in its carried quote, with
 *   its instance placed in dialogue or narration again (epic decision 26);
 * - carries group E's kinds by their own rules (Slice 4C,
 *   `LightboxPlotCarry`): the movements as one set, each starting where its
 *   boundary quote now stands and the set withheld whole when it no longer
 *   tiles the chapter; engagement with its movements; a thread's quotes in
 *   order with its span recomputed; an object recounted with its arc in
 *   order;
 * - carries group F's Opinion last, held to its own rules against the
 *   carried board (Slice 4D, `LightboxOpinionGates`): an observation whose
 *   cited tile did not survive, or whose cited quote is gone from it, is
 *   withheld, a view weighing it with it, and the tile with no view left;
 *   what stands is stale, as every carried lens is;
 * - keeps the writer's own marks on what survives: a spark set aside stays
 *   set aside (Slice 4), since its id and its words are unchanged;
 * - sets aside a group that was still being read when the text changed: its
 *   run read the old text, and nothing it returns is attached here.
 * A fresh reading of a lens replaces its stale readings and clears the mark
 * (`LightboxReadingState`).
 */

import type {
  LightboxBoard,
  LightboxCountedSupport,
  LightboxLensId,
  LightboxNumberRow,
  LightboxReadingGroup,
  LightboxReadingTile,
  LightboxStaleLens,
  LightboxVerifiedQuote,
  LightboxWithheldClaim,
  LightboxWithheldQuote
} from '@messages';
import { LIGHTBOX_LENSES, lightboxGroupReadsBoard } from '@shared/constants/lightbox';
import { lightboxOpinionItemMap } from '@shared/constants/lightboxOpinionItems';
import { carryLightboxOpinion } from '@/infrastructure/lightbox/LightboxOpinionGates';
import { createLightboxQuoteVerifier, type LightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { carryLightboxCraftEvidence, recheckLightboxQuote } from '@/infrastructure/lightbox/LightboxCarryQuotes';
import {
  carryLightboxEngagement,
  carryLightboxMovements,
  carryLightboxPlotEvidence,
  type LightboxCarriedPlot
} from '@/infrastructure/lightbox/LightboxPlotCarry';
import { lightboxStandoutRows, type LightboxStandoutRows } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { createLightboxTermCounter, lightboxPhraseHeld, type LightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { lightboxColumnKeys, recountLightboxTile } from '@/infrastructure/lightbox/LightboxTileCounts';
import { lightboxFieldKey, lightboxTileGate } from '@/infrastructure/lightbox/LightboxTileGates';
import {
  createLightboxDialogueIndex,
  lightboxSaidLedEvidence,
  lightboxSameQuote,
  type LightboxDialogueIndex
} from '@/infrastructure/lightbox/LightboxDialogueAnchor';

export interface LightboxCarryContext {
  /** The hash of the text the readings were read against (the replaced board's). */
  readAgainst: string;
  /** The current text's paragraphs; index 0 is ¶1. */
  paragraphs: readonly string[];
  /** The current board's measured average words per sentence, set beside the voice. */
  averageWordsPerSentence: number;
  /** The current board's ribbon columns, so a tension score follows its paragraphs (F-06). */
  columns?: ReadonlyArray<{ from: number; to: number }>;
  /** The current board's measured figures, so a numbers reading is held to what stands out now (Slice 4B). */
  numbers?: readonly LightboxNumberRow[];
  /**
   * The rebuilt board's measured set (Slice 4D): what the Opinion's measured
   * citations are held to. Without it, an Opinion citing a measured figure
   * cannot be checked, and that observation is withheld.
   */
  measured?: LightboxBoard['measured'];
}

/** Writer-facing: a group that was mid-run when the text changed. */
export const LIGHTBOX_CHANGED_WHILE_READING =
  'The chapter changed while this group was being read, so that reading was set aside. Press Finish or Analyze to read the new text.';


interface CarryTools {
  verifier: LightboxQuoteVerifier;
  counter: LightboxTermCounter;
  dialogue: LightboxDialogueIndex;
  context: LightboxCarryContext;
  columnKeys: string[];
  standouts: LightboxStandoutRows;
}

/** Carry a replaced board's reading groups onto the board built from the changed text. */
export function carryLightboxReadings(
  readings: readonly LightboxReadingGroup[],
  context: LightboxCarryContext
): LightboxReadingGroup[] {
  const verifier = createLightboxQuoteVerifier(context.paragraphs);
  const tools: CarryTools = {
    verifier,
    counter: createLightboxTermCounter(context.paragraphs),
    dialogue: createLightboxDialogueIndex(verifier),
    context,
    columnKeys: lightboxColumnKeys(
      context.paragraphs,
      context.columns ?? context.paragraphs.map((_text, index) => ({ from: index + 1, to: index + 1 }))
    ),
    standouts: lightboxStandoutRows(context.numbers)
  };
  // The Opinion reads the other groups' tiles, so it is carried after them, against what survived (Slice 4D).
  const carried = readings.map((group) => (lightboxGroupReadsBoard(group.group) ? group : carryGroup(group, tools)));
  return carried.map((group) => (lightboxGroupReadsBoard(group.group) ? carryOpinionGroup(group, carried, context) : group));
}

/** Group F carried: each Opinion held to its rules against the carried board's items, then stale-marked like any lens. */
function carryOpinionGroup(
  group: LightboxReadingGroup,
  carried: readonly LightboxReadingGroup[],
  context: LightboxCarryContext
): LightboxReadingGroup {
  if (group.status === 'not-run') {
    return group;
  }
  const items = lightboxOpinionItemMap({ ...(context.measured ? { measured: context.measured } : {}), readings: carried });
  const tiles: LightboxReadingTile[] = [];
  const withheldClaims: LightboxWithheldClaim[] = group.withheldClaims.map((claim) => ({ ...claim, quotes: claim.quotes.map(withoutAddresses) }));
  for (const tile of group.tiles) {
    const result = tile.kind === 'opinion' ? carryLightboxOpinion(tile, items) : { tile };
    if ('tile' in result) {
      tiles.push(result.tile);
    } else {
      withheldClaims.push(...result.withheld);
    }
  }
  const staleLenses = staleMarks(group, context.readAgainst);
  const { pending: _pending, staleLenses: _previous, ...rest } = group;
  const next: LightboxReadingGroup = { ...rest, tiles, withheldClaims, ...(staleLenses.length > 0 ? { staleLenses } : {}) };
  return group.status === 'running' ? { ...next, status: 'cancelled', error: LIGHTBOX_CHANGED_WHILE_READING } : next;
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
  // Group E's movements as one set, before the template whose engagement sits on them (Slice 4C).
  const standingMovements = carryMovementSet(group.tiles, tools, results);
  for (const tile of group.tiles.filter((candidate) => candidate.kind !== 'gravity-collision' && candidate.kind !== 'movement')) {
    const result = carryTile(tile, tools, drawnFields);
    results.set(tile, result);
    if ('tile' in result && result.tile.kind === 'template') {
      const engagement = carryLightboxEngagement(result.tile.engagement, standingMovements);
      result.tile = { ...result.tile, engagement: engagement.engagement };
      if (engagement.withheld) {
        withheldClaims.push(engagement.withheld);
      }
    }
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
    } else if ('withheld' in result) {
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

/**
 * A carried tile, or the claim it became, with how many of its found quotes
 * are gone; or, for a movement of a set withheld whole, nothing of its own
 * (the set's one claim stands for every movement).
 */
type CarriedTile = ({ tile: LightboxReadingTile } | { withheld: LightboxWithheldClaim } | { dropped: true }) & { lost: number };

/**
 * Carry the group's movements as one set: each kept, moved to where its
 * boundary now stands, or the whole set withheld under the first movement's
 * entry. Returns the host ids of the movements that stand.
 */
function carryMovementSet(
  tiles: readonly LightboxReadingTile[],
  tools: CarryTools,
  results: Map<LightboxReadingTile, CarriedTile>
): ReadonlySet<string> {
  const movements = tiles.filter((tile): tile is Extract<LightboxReadingTile, { kind: 'movement' }> => tile.kind === 'movement');
  if (movements.length === 0) {
    return new Set();
  }
  const carried = carryLightboxMovements(movements, tools.verifier);
  if (!carried.ok) {
    movements.forEach((movement, index) => results.set(
      movement,
      index === 0 ? { withheld: carried.withheld, lost: carried.lost } : { dropped: true, lost: 0 }
    ));
    return new Set();
  }
  for (const movement of movements) {
    results.set(movement, { tile: carried.tiles.find((tile) => tile.id === movement.id) as LightboxReadingTile, lost: 0 });
  }
  return new Set(carried.tiles.map((tile) => tile.id));
}

function carryTile(
  tile: LightboxReadingTile,
  tools: CarryTools,
  drawnFields: ReadonlyMap<string, readonly string[]>
): CarriedTile {
  const found: LightboxVerifiedQuote[] = [];
  const lost: LightboxWithheldQuote[] = [];
  const seen = new Set<string>();
  // Group D's kinds (Slice 4B) and group E's threads and objects (Slice 4C) carry their quotes by their own rules.
  const craft: LightboxCarriedPlot | undefined = carryLightboxCraftEvidence(tile, tools.verifier, tools.standouts) ??
    carryLightboxPlotEvidence(tile, tools.verifier, tools.counter);
  // A pair's said line leads its evidence; it is checked on its own, below, and leads again (PR #151 F-07).
  const saidLine = tile.kind === 'subtext' ? tile.said : undefined;
  for (const quote of craft ? [] : tile.evidence) {
    if (saidLine && lightboxSameQuote(quote, saidLine)) {
      continue;
    }
    const again = recheckLightboxQuote(quote, (paragraph, text) => tools.verifier.verify(paragraph, text));
    if ('reason' in again) {
      lost.push({ paragraph: quote.paragraph, reason: again.reason });
      continue;
    }
    const key = `${again.quote.paragraph}:${again.quote.text}`;
    if (!seen.has(key)) {
      seen.add(key);
      found.push(again.quote);
    }
  }
  lost.push(...(craft?.lost ?? []));
  // A said line is held to its own rule: found again, in speech where the verifier can (PR #151 F-04), and inside dialogue.
  const saidAgain = saidLine
    ? recheckLightboxQuote(saidLine, (paragraph, text) => tools.dialogue.verifySaid(paragraph, text))
    : undefined;
  const said = saidAgain ? ('quote' in saidAgain ? saidAgain.quote : null) : undefined;
  if (saidLine && !said) {
    lost.unshift({ paragraph: saidLine.paragraph, reason: 'no-longer-in-chapter' });
  }
  // The said line it found leads, then the rest once each, exactly as a fresh read builds a pair.
  const evidence = craft ? craft.evidence : saidLine ? lightboxSaidLedEvidence(said, found) : found;
  const withheldQuotes = [...lost, ...tile.withheldQuotes.map(withoutAddresses)];
  const recounted = recountLightboxTile(tile, tools.counter, {
    paragraphCount: tools.context.paragraphs.length,
    averageWordsPerSentence: tools.context.averageWordsPerSentence,
    columnKeys: tools.columnKeys
  });
  // The same rules a first reading meets (PR #150 F-05).
  const verdict = lightboxTileGate(
    {
      kind: tile.kind,
      evidence,
      support: recounted.support,
      ...(tile.kind === 'gravity-collision' ? { fields: tile.fields } : {}),
      ...(said !== undefined ? { said } : {}),
      ...(craft?.pair ? { pair: craft.pair } : {}),
      ...(tile.kind === 'number-usage' ? { stat: tile.stat } : {}),
      ...(tile.kind === 'familiar-phrase' ? { phraseHeld: lightboxPhraseHeld(tools.verifier, evidence, tile.phrase) } : {}),
      ...(craft?.thread ? { thread: craft.thread } : {}),
      // The note as read: a nudge withheld as voice is not there to be named in narration (epic decision 26).
      ...(tile.kind === 'steering-note' ? { steeringNote: { leans: tile.stance !== 'earns', nudged: tile.nudge !== undefined, voice: craft?.voice } } : {})
    },
    { phase: 'carried', drawnFields, dialogue: tools.dialogue, standouts: tools.standouts }
  );
  if (!verdict.ok) {
    return {
      withheld: { kind: tile.kind, lens: tile.lens, title: tile.title, reason: verdict.reason, quotes: withheldQuotes },
      lost: lost.length
    };
  }
  const foundParagraphs = new Set(evidence.map((quote) => quote.paragraph));
  const kept = {
    ...recounted,
    ...(craft?.patch ?? {}),
    evidence,
    withheldQuotes,
    paragraphs: craft?.paragraphs ?? paragraphsOf(foundParagraphs, recounted.support)
  } as LightboxReadingTile;
  if (kept.kind === 'artifact' && kept.unusedWithheld === undefined) {
    // An object's flag withheld before is cleared when the new counts bear it out.
    delete kept.unusedWithheld;
  }
  if (kept.kind === 'steering-note') {
    // A note's example is re-anchored, and its voice placed again, on carry (Slice 4F, epic decision 26):
    // a field it no longer has is dropped, not left undefined.
    for (const field of ['nudge', 'example', 'exampleWithheld', 'voice'] as const) {
      if (kept[field] === undefined) {
        delete kept[field];
      }
    }
  }
  if (kept.kind === 'subtext' && said) {
    return { tile: { ...kept, said }, lost: lost.length };
  }
  return {
    tile: kept.kind === 'gravity-collision' && verdict.witness ? { ...kept, witness: verdict.witness } : kept,
    lost: lost.length
  };
}

function paragraphsOf(found: ReadonlySet<number>, support: readonly LightboxCountedSupport[]): number[] {
  const paragraphs = new Set<number>(found);
  for (const term of support) {
    term.paragraphs.forEach((index) => paragraphs.add(index));
  }
  return [...paragraphs].sort((a, b) => a - b);
}
