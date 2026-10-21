/**
 * The Lightbox Opinion (ADR 2026-10-19 D6, D7 and its 2026-10-20 addendum;
 * Slice 4D): group F, the one evaluative tile, and the fenced exception to
 * "describe, never grade".
 *
 * One call returns a shared list of **observations** and three **views** of
 * them, which the writer clicks between: Enthusiastic (what is working),
 * Neutral (weighed evenly, the default) and Blunt (what costs the most).
 * Same facts, three temperaments:
 * - the call reads the board's verified digest, never the chapter: each
 *   current reading tile by its host id, with its claim, its found quotes
 *   and its host counts, and the measured figures by stable refs. So the
 *   Opinion cannot invent a quote: it cites board items, and the quotes it
 *   shows are the cited tiles' own;
 * - an observation cites one to three board items by their host keys, and
 *   is withheld (by its id, never its words) when it cites anything the
 *   digest did not hold, or when its text breaks the Opinion's text rules;
 * - a view weighs only the observations drawn: one citing any other is
 *   withheld whole, and Blunt diagnoses the work, never the writer, with no
 *   rewrites. A tile with no view standing is withheld;
 * - every citation records its item's content identity (`basis`) as read,
 *   so the board can say, from its own tiles, when anything it cites has
 *   changed since: the Opinion is then stale (`lightboxOpinionStanding`).
 *   Nothing else on the board reads it, so ignoring it changes nothing.
 */

import type { LightboxNumberStatId } from './lightboxNumbers';
import type { LightboxReadingTileBase, LightboxVerifiedQuote } from './lightboxReadings';

/** The three temperaments, in tab order. Neutral is the default view. */
export type LightboxOpinionViewId = 'enthusiastic' | 'neutral' | 'blunt';

/** How a Why point weighs its observations. */
export type LightboxOpinionWeight = 'strength' | 'even' | 'concern';

/**
 * A measured figure the Opinion may cite, by a ref that names it on any
 * board: the headline stats, a figure that stands out (by its stat id), or
 * a section of the Sections lane (by its place, from 1). A section's place
 * is positional, so its citation's `basis` holds the section's own range.
 */
export type LightboxOpinionMeasuredRef = 'headline' | `standout:${LightboxNumberStatId}` | `section:${number}`;

/** One board item an observation cites. */
export interface LightboxOpinionCite {
  /** The item's host key: a reading tile's id, or a measured ref. */
  item: string;
  /** For a tile, the one quote cited: as that tile held it when the Opinion read the board. */
  quote?: LightboxVerifiedQuote;
  /** Host words naming the item ("Pressure · Thread: Will the fall ever end?"). */
  label: string;
  /** The item's content identity when the Opinion read it (`lightboxOpinionItems`). */
  basis: string;
}

/** A fact the three views share, citing the board. */
export interface LightboxOpinionObservation {
  /** The response's own key, `O1`–`O6`: what the views cite it by. */
  id: string;
  text: string;
  /** One to three board items. */
  cites: LightboxOpinionCite[];
  /** Every paragraph its cited items touch, ascending: what hovering it lights. */
  paragraphs: number[];
}

/** One reason a view gives, weighted, citing observations by id. */
export interface LightboxOpinionWhy {
  weight: LightboxOpinionWeight;
  text: string;
  /** One to three observation ids, each drawn on the tile. */
  observations: string[];
}

export interface LightboxOpinionView {
  view: LightboxOpinionViewId;
  headline: string;
  /** The short paragraph under the headline. */
  body: string;
  /** One to four points. */
  why: LightboxOpinionWhy[];
}

/**
 * A part of the Opinion withheld by a rule: an observation by its id, or a
 * view by its name, with the host's reason. Its words are never shown.
 */
export interface LightboxOpinionWithheldObservation {
  id: string;
  reason: string;
}

export interface LightboxOpinionWithheldView {
  view: LightboxOpinionViewId;
  reason: string;
}

/** What the Opinion read: the digest's identity and size, never its text. */
export interface LightboxOpinionDigestSummary {
  /** `LightboxOpinionDigest.key`: the board, its text, and every item the digest held, by content. */
  key: string;
  /** Board items the digest held. */
  items: number;
  /** Current items left out to keep the digest within its bound. */
  leftOut: number;
}

/**
 * The Opinion tile. `title` is the host's ("Opinion"); `claim` is the
 * headline of the default view that stands (Neutral, else the first);
 * `evidence` holds the quotes its observations cite, as the cited tiles
 * hold them (possibly none: an Opinion cites, it never quotes); `paragraphs`
 * is every observation's. `support` is empty: it counts nothing.
 */
export interface LightboxOpinionTile extends LightboxReadingTileBase {
  kind: 'opinion';
  /** Drawn observations, in the response's order. */
  observations: LightboxOpinionObservation[];
  withheldObservations: LightboxOpinionWithheldObservation[];
  /** Views that stand, in tab order; at least one. */
  views: LightboxOpinionView[];
  withheldViews: LightboxOpinionWithheldView[];
  digest: LightboxOpinionDigestSummary;
}
