/**
 * Lightbox craft readings (ADR 2026-10-19 D3, D7 and its 2026-10-20
 * addendum; Slice 4B): group D, where the chapter spends attention, how its
 * sentences move, and how its standout numbers are used.
 *
 * **Stock & signature.** The cognitive-economy tier mix is counted by the
 * host from the beats the reading classified and the host found
 * (`stock-tiers`): a share of those beats, never of the chapter. Signature
 * phrases, familiar phrasing (the host counts each phrase), air-lock passages
 * and echoes are readings with quotes. An echo says what a line "sounds
 * reminiscent of": the quote is checked against the chapter, the resemblance
 * is not, and it carries no likelihood.
 *
 * **Rhythm & handoffs.** How each ribbon column's paragraphs end (Lands,
 * Holds, Opens) is read, one per column, and follows each column's text
 * through a stale carry as the tension arc does (`columnKeys`). A handoff is
 * a pair of sentences the host found adjacent in one paragraph. The
 * sentence lengths are measured, on the board (`LightboxParagraphMetric`).
 *
 * **The numbers.** A usage reading names a figure the host measured as
 * standing out (`lightboxNumbers.ts`) and says how it is used; every quote
 * it keeps holds an instance of that figure, by the detector that counted it.
 *
 * Every tile here is a reading tile: host-minted ids and paragraphs, quotes
 * the host found, and a friction (`lightboxReadings.ts`).
 */

import type { LightboxReadingTileBase, LightboxVerifiedQuote } from './lightboxReadings';
import type { LightboxNumberStatId } from './lightboxNumbers';
import type { FamiliarPhraseKind } from '@shared/constants/familiarPhrasing';

/** The cognitive-economy tiers, from invisible infrastructure to the chapter's own. */
export type LightboxStockTier = 'functional' | 'decorated' | 'weighted' | 'signature';

/** What kind of familiar phrasing a phrase is: the vocabulary Craft Flags shares (Slice 3c). Familiar is not a fault. */
export type LightboxFamiliarKind = FamiliarPhraseKind;

/** How a paragraph ends: it lands, holds a pause, or opens onto what follows. */
export type LightboxParagraphEnding = 'lands' | 'holds' | 'opens';

/** What one sentence's handoff to the next does. */
export type LightboxHandoffEffect = 'continues' | 'pause' | 'closure' | 'loses';

/** How a standout figure reads in use. */
export type LightboxNumberUsage = 'deliberate' | 'mixed' | 'habit';

/** A beat the reading classified, found in the chapter. */
export interface LightboxStockBeat {
  quote: LightboxVerifiedQuote;
  tier: LightboxStockTier;
}

/**
 * The tier mix: `claim` is the reading's note on it; `beats` the classified
 * beats the host found (also the tile's evidence); `tiers` and `classified`
 * the host's counts of them.
 */
export interface LightboxStockTiersTile extends LightboxReadingTileBase {
  kind: 'stock-tiers';
  beats: LightboxStockBeat[];
  tiers: Record<LightboxStockTier, number>;
  /** Beats found and counted: the denominator of every share shown. */
  classified: number;
}

/** A line the reading calls the chapter's own; `claim` says why. */
export interface LightboxSignatureTile extends LightboxReadingTileBase {
  kind: 'signature';
}

/** Familiar phrasing: the phrase, its kind, and (in `support`) the host's count of it. */
export interface LightboxFamiliarPhraseTile extends LightboxReadingTileBase {
  kind: 'familiar-phrase';
  phrase: string;
  familiar: LightboxFamiliarKind;
}

/** A closure-complete line that could stand alone: a craft signal, not a risk. */
export interface LightboxAirLockTile extends LightboxReadingTileBase {
  kind: 'air-lock';
}

/** An aphoristic line that sounds reminiscent of something: worth a look, never a finding. */
export interface LightboxEchoTile extends LightboxReadingTileBase {
  kind: 'echo';
  /** What it sounds reminiscent of, as the reading names it (unverified). */
  reminiscentOf: string;
}

/**
 * How each ribbon column's paragraphs end, read; `claim` is whether the
 * sentences move toward conclusion. An ending is `null` where a carried
 * column's text changed (D4; never an old position on a new paragraph).
 */
export interface LightboxRhythmEndingsTile extends LightboxReadingTileBase {
  kind: 'rhythm-endings';
  endings: Array<LightboxParagraphEnding | null>;
  /** Host-private identity of each column's paragraphs as read (`lightboxColumnKeys`). */
  columnKeys: string[];
}

/**
 * Two sentences the host found adjacent in one paragraph: `from`, then the
 * sentence directly after it, `to` (both also lead the evidence). `claim`
 * is what changes between them.
 */
export interface LightboxHandoffTile extends LightboxReadingTileBase {
  kind: 'handoff';
  from: LightboxVerifiedQuote;
  to: LightboxVerifiedQuote;
  /** What the second sentence takes up from the first. */
  carried: string;
  effect: LightboxHandoffEffect;
}

/** How a figure that stands out is used here; `claim` says how. */
export interface LightboxNumberUsageTile extends LightboxReadingTileBase {
  kind: 'number-usage';
  stat: LightboxNumberStatId;
  usage: LightboxNumberUsage;
}
