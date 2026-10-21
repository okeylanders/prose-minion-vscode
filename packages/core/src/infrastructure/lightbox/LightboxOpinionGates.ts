/**
 * The Opinion's acceptance rules (ADR 2026-10-19 D7 addendum; Slice 4D).
 * Pure: no host, no I/O.
 *
 * One set of rules decides what of an Opinion can stand, applied to a fresh
 * reply (against the digest the call read) and to a carried Opinion
 * (against the board rebuilt from changed text) alike, as every tile's
 * gates are (PR #150 F-05); only the wording differs by phase:
 * - **An observation** stands while every item it cites is one the board
 *   holds (fresh: an item of the digest, which held only current,
 *   drawn readings and measured figures; carried: an item of the rebuilt
 *   board), each quote it cites is one its tile holds (fresh: by the
 *   digest's number; carried: by its words, following them to where they
 *   stand now), and its text keeps the text rules
 *   (`LightboxOpinionPhrasing`), its figures checked against the items it
 *   cites. Otherwise it is withheld by its id.
 * - **A view** stands while every observation its Why points cite is drawn
 *   ("a view may weigh only the observations below"), and its headline,
 *   body and points keep the text rules, their figures checked against the
 *   items its observations cite. Otherwise it is withheld whole, by name.
 * - **The tile** stands while one view does (`LightboxTileGates`); with
 *   none, it is withheld, with each view's reason.
 * A carried citation keeps the basis it was read with: the carried
 * Opinion is stale until it is read again, and its standing says so.
 * Every reason is host-owned: none repeats the Opinion's words or a key it
 * named.
 */

import type {
  LightboxOpinionCite,
  LightboxOpinionDigestSummary,
  LightboxOpinionObservation,
  LightboxOpinionTile,
  LightboxOpinionView,
  LightboxOpinionViewId,
  LightboxOpinionWithheldObservation,
  LightboxOpinionWithheldView,
  LightboxOpinionWhy,
  LightboxVerifiedQuote,
  LightboxWithheldClaim
} from '@messages';
import type { LightboxOpinionItem } from '@shared/constants/lightboxOpinionItems';
import {
  LIGHTBOX_OPINION_VIEWS,
  LIGHTBOX_OPINION_VIEW_LABELS,
  lightboxOpinionDefaultView
} from '@shared/constants/lightboxOpinion';
import { lightboxOpinionPhrasingFault } from '@/infrastructure/lightbox/LightboxOpinionPhrasing';
import { lightboxTileGate, type LightboxGatePhase } from '@/infrastructure/lightbox/LightboxTileGates';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxDialogueIndex } from '@/infrastructure/lightbox/LightboxDialogueAnchor';

/** The tile's own title, never a model's. */
export const LIGHTBOX_OPINION_TITLE = 'Opinion';

export const LIGHTBOX_OPINION_GATE_REASONS = {
  notOnBoard: {
    fresh: 'It cites an item that was not on the board the Opinion read: an id the digest did not hold, or a reading that was stale, withheld or being read again.',
    carried: 'It cites an item that is no longer on the board: the chapter changed, and that reading or figure did not survive it.'
  },
  quoteNotHeld: {
    fresh: 'It cites a quote the tile it names does not hold.',
    carried: 'The quote it cites is no longer in the tile it names.'
  },
  quoteOfMeasured: 'It cites a quote of a measured figure, which holds none.',
  viewUndrawn: 'A view may weigh only the observations below, and this one weighs one that is not drawn.'
} as const;

/** A cite to check: an item's key and, for a tile, the quote named (fresh: by the digest's number; carried: by its words). */
export interface LightboxOpinionCiteCandidate {
  item: string;
  quote?: number | LightboxVerifiedQuote;
  /** Carried: the basis it was read with, kept. */
  basis?: string;
}

export interface LightboxOpinionObservationCandidate {
  id: string;
  text: string;
  cites: readonly LightboxOpinionCiteCandidate[];
}

export interface LightboxOpinionViewCandidate {
  headline: string;
  body: string;
  why: readonly LightboxOpinionWhy[];
}

export interface LightboxOpinionCandidate {
  observations: readonly LightboxOpinionObservationCandidate[];
  /** Observations already withheld (by the codec, or before a carry), kept as they are. */
  withheld: readonly LightboxOpinionWithheldObservation[];
  /** Each view, or the fault that already withholds it. */
  views: ReadonlyArray<readonly [LightboxOpinionViewId, { value: LightboxOpinionViewCandidate } | { fault: string }]>;
}

export interface LightboxOpinionGated {
  observations: LightboxOpinionObservation[];
  withheldObservations: LightboxOpinionWithheldObservation[];
  views: LightboxOpinionView[];
  withheldViews: LightboxOpinionWithheldView[];
}

/** Hold an Opinion to its rules against the items the board holds. */
export function gateLightboxOpinion(
  candidate: LightboxOpinionCandidate,
  items: ReadonlyMap<string, LightboxOpinionItem>,
  phase: LightboxGatePhase
): LightboxOpinionGated {
  const observations: LightboxOpinionObservation[] = [];
  const withheldObservations: LightboxOpinionWithheldObservation[] = [...candidate.withheld];
  const drawn = new Map<string, ReadonlySet<string>>();
  for (const observation of candidate.observations) {
    const verdict = gateObservation(observation, items, phase);
    if ('reason' in verdict) {
      withheldObservations.push({ id: observation.id, reason: verdict.reason });
      continue;
    }
    observations.push(verdict.observation);
    drawn.set(observation.id, verdict.figures);
  }
  const views: LightboxOpinionView[] = [];
  const withheldViews: LightboxOpinionWithheldView[] = [];
  for (const [view, decoded] of candidate.views) {
    const verdict = 'fault' in decoded ? { reason: decoded.fault } : gateView(view, decoded.value, drawn);
    if ('reason' in verdict) {
      withheldViews.push({ view, reason: verdict.reason });
    } else {
      views.push(verdict.view);
    }
  }
  return { observations, withheldObservations, views, withheldViews };
}

function gateObservation(
  observation: LightboxOpinionObservationCandidate,
  items: ReadonlyMap<string, LightboxOpinionItem>,
  phase: LightboxGatePhase
): { observation: LightboxOpinionObservation; figures: ReadonlySet<string> } | { reason: string } {
  const cites: LightboxOpinionCite[] = [];
  const paragraphs = new Set<number>();
  const figures = new Set<string>();
  for (const cite of observation.cites) {
    const item = items.get(cite.item);
    if (!item) {
      return { reason: LIGHTBOX_OPINION_GATE_REASONS.notOnBoard[phase] };
    }
    if (cite.quote !== undefined && item.kind !== 'tile') {
      return { reason: LIGHTBOX_OPINION_GATE_REASONS.quoteOfMeasured };
    }
    const quote = cite.quote === undefined ? undefined : heldQuote(item, cite.quote);
    if (cite.quote !== undefined && !quote) {
      return { reason: LIGHTBOX_OPINION_GATE_REASONS.quoteNotHeld[phase] };
    }
    // The same item and quote twice is one citation.
    if (!cites.some((kept) => kept.item === item.key && sameQuote(kept.quote, quote))) {
      cites.push({ item: item.key, ...(quote ? { quote } : {}), label: item.label, basis: cite.basis ?? item.basis });
    }
    item.paragraphs.forEach((paragraph) => paragraphs.add(paragraph));
    item.figures.forEach((figure) => figures.add(figure));
  }
  const fault = lightboxOpinionPhrasingFault([observation.text], figures, 'This observation');
  if (fault) {
    return { reason: fault };
  }
  return {
    observation: { id: observation.id, text: observation.text, cites, paragraphs: [...paragraphs].sort((a, b) => a - b) },
    figures
  };
}

/** The quote as the item holds it: by the digest's number, or by its words wherever it now stands. */
function heldQuote(item: LightboxOpinionItem, named: number | LightboxVerifiedQuote): LightboxVerifiedQuote | undefined {
  if (typeof named === 'number') {
    return item.quotes[named];
  }
  return item.quotes.find((quote) => quote.text === named.text && quote.paragraph === named.paragraph) ??
    item.quotes.find((quote) => quote.text === named.text);
}

function sameQuote(a: LightboxVerifiedQuote | undefined, b: LightboxVerifiedQuote | undefined): boolean {
  return a === b || (a !== undefined && b !== undefined && a.paragraph === b.paragraph && a.text === b.text);
}

function gateView(
  view: LightboxOpinionViewId,
  candidate: LightboxOpinionViewCandidate,
  drawn: ReadonlyMap<string, ReadonlySet<string>>
): { view: LightboxOpinionView } | { reason: string } {
  const weighed = candidate.why.flatMap((point) => point.observations);
  if (weighed.some((id) => !drawn.has(id))) {
    return { reason: LIGHTBOX_OPINION_GATE_REASONS.viewUndrawn };
  }
  const figures = new Set<string>();
  for (const id of weighed) {
    drawn.get(id)?.forEach((figure) => figures.add(figure));
  }
  const fault = lightboxOpinionPhrasingFault(
    [candidate.headline, candidate.body, ...candidate.why.map((point) => point.text)],
    figures,
    `The ${LIGHTBOX_OPINION_VIEW_LABELS[view].label} view`
  );
  if (fault) {
    return { reason: fault };
  }
  return {
    view: {
      view,
      headline: candidate.headline,
      body: candidate.body,
      why: candidate.why.map((point) => ({ weight: point.weight, text: point.text, observations: [...new Set(point.observations)] }))
    }
  };
}

// ---------------------------------------------------------------------------
// The tile
// ---------------------------------------------------------------------------

export interface LightboxOpinionTileParts {
  id: string;
  friction: string;
  digest: LightboxOpinionDigestSummary;
}

/** No chapter is needed to gate an Opinion; the tile gate is given an empty one. */
const NO_TEXT = createLightboxQuoteVerifier([]);

/**
 * The tile the gated parts draw, when a view stands (`LightboxTileGates`),
 * or what is withheld instead: the tile by its title, then each view and
 * each observation by name, with its reason.
 */
export function lightboxOpinionTileOf(
  gated: LightboxOpinionGated,
  parts: LightboxOpinionTileParts,
  phase: LightboxGatePhase
): { tile: LightboxOpinionTile } | { withheld: LightboxWithheldClaim[] } {
  const evidence: LightboxVerifiedQuote[] = [];
  for (const cite of gated.observations.flatMap((observation) => observation.cites)) {
    if (cite.quote && !evidence.some((quote) => sameQuote(quote, cite.quote))) {
      evidence.push(cite.quote);
    }
  }
  const verdict = lightboxTileGate(
    { kind: 'opinion', evidence, support: [], opinionViews: gated.views.length },
    { phase, drawnFields: new Map(), dialogue: createLightboxDialogueIndex(NO_TEXT), standouts: new Map() }
  );
  if (!verdict.ok) {
    const claim = (title: string, reason: string): LightboxWithheldClaim => ({ kind: 'opinion', lens: 'opinion', title, reason, quotes: [] });
    return {
      withheld: [
        claim(LIGHTBOX_OPINION_TITLE, verdict.reason),
        ...LIGHTBOX_OPINION_VIEWS.flatMap((view) => gated.withheldViews.filter((entry) => entry.view === view))
          .map((entry) => claim(`${LIGHTBOX_OPINION_TITLE} · ${LIGHTBOX_OPINION_VIEW_LABELS[entry.view].label} view`, entry.reason)),
        ...gated.withheldObservations.map((entry) => claim(`${LIGHTBOX_OPINION_TITLE} · ${entry.id}`, entry.reason))
      ]
    };
  }
  const views = LIGHTBOX_OPINION_VIEWS.flatMap((view) => gated.views.filter((entry) => entry.view === view));
  const shown = views.find((entry) => entry.view === lightboxOpinionDefaultView({ views })) ?? views[0];
  const paragraphs = new Set(gated.observations.flatMap((observation) => observation.paragraphs));
  return {
    tile: {
      kind: 'opinion',
      id: parts.id,
      lens: 'opinion',
      title: LIGHTBOX_OPINION_TITLE,
      claim: shown.headline,
      paragraphs: [...paragraphs].sort((a, b) => a - b),
      evidence,
      withheldQuotes: [],
      support: [],
      friction: parts.friction,
      observations: gated.observations,
      withheldObservations: gated.withheldObservations,
      views,
      withheldViews: LIGHTBOX_OPINION_VIEWS.flatMap((view) => gated.withheldViews.filter((entry) => entry.view === view)),
      digest: parts.digest
    }
  };
}

/** A carried Opinion, held to the same rules against the board rebuilt from changed text. */
export function carryLightboxOpinion(
  tile: LightboxOpinionTile,
  items: ReadonlyMap<string, LightboxOpinionItem>
): { tile: LightboxOpinionTile } | { withheld: LightboxWithheldClaim[] } {
  const gated = gateLightboxOpinion({
    observations: tile.observations.map((observation) => ({
      id: observation.id,
      text: observation.text,
      cites: observation.cites.map((cite) => ({ item: cite.item, ...(cite.quote ? { quote: cite.quote } : {}), basis: cite.basis }))
    })),
    withheld: tile.withheldObservations,
    views: LIGHTBOX_OPINION_VIEWS.map((view) => {
      const drawn = tile.views.find((entry) => entry.view === view);
      const fault = tile.withheldViews.find((entry) => entry.view === view)?.reason ?? 'It was not drawn.';
      return [view, drawn ? { value: drawn } : { fault }] as const;
    })
  }, items, 'carried');
  return lightboxOpinionTileOf(gated, { id: tile.id, friction: tile.friction, digest: tile.digest }, 'carried');
}
