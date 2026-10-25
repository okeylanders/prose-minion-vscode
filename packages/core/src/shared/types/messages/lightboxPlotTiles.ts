/**
 * Lightbox story readings (ADR 2026-10-19 D3, D7 and its 2026-10-20
 * addendum; Slice 4C): group E, the shape the chapter rides and what builds
 * in it. The modules are named "plot" because Slice 4's lineage, subtext and
 * Spark already hold the story name (`lightboxStoryTiles.ts`).
 *
 * **Template & freshness.** The template the chapter rides, as a reading
 * (`template`: its name and a brief description, with quotes), the beats
 * where it aligns, subverts or departs (`template-beat`, each quoted), a
 * freshness reading on a three-step scale, labelled "a reading, not a grade"
 * (ADR D7 addendum), and engagement per movement: a reading of pull, kept
 * apart from the tension lane. Engagement names each movement by the host
 * id of a movement tile drawn from the same call; a movement with no mark
 * has none, never a guessed one. The freshness basis line is never stored
 * here: it is a host join of group D's tier counts and these beats
 * (`lightboxFreshnessBasis`).
 *
 * **Pressure.** Threads: a question or event planted, escalated, resolved
 * or still open, each step a quote the host found, in paragraph order. The
 * host computes each thread's span; the counts and the open-threads lane are
 * computed from the drawn threads (`lightboxPressureLane`).
 *
 * **Artifacts.** The objects in the scene: the reading names each and its
 * terms; the host counts their mentions and first paragraph with the gravity
 * lens's counter, and finds each step of its arc, in paragraph order.
 *
 * **Summary & movements.** A synopsis standing on at least two found quotes,
 * and movements that tile the chapter: each opens with a boundary quote
 * found in its first paragraph, and the set is checked as a whole
 * (contiguous, no overlap, ¶1 to the last paragraph) or withheld whole.
 *
 * Every tile here is a reading tile: host-minted ids and paragraphs, quotes
 * the host found, and a friction (`lightboxReadings.ts`).
 */

import type { LightboxReadingTileBase, LightboxVerifiedQuote } from './lightboxReadings';

/** How a beat of the chapter stands to its template. */
export type LightboxTemplateStance = 'aligns' | 'subverts' | 'departs';

/** Where the chapter sits on the freshness scale: a reading, not a grade. Familiar is not a fault. */
export type LightboxFreshnessLevel = 'familiar' | 'mixed' | 'fresh';

/** How strongly a movement pulls the reader on, as read. Not tension. */
export type LightboxEngagementLevel = 'low' | 'medium' | 'high';

export interface LightboxFreshnessReading {
  level: LightboxFreshnessLevel;
  /** One line: the reading's own account of where the chapter sits. */
  note: string;
}

/** One movement's engagement, as read. */
export interface LightboxEngagementMark {
  /** The host-minted id of a movement tile in the same group; never a model's name for it. */
  movementId: string;
  level: LightboxEngagementLevel;
}

/**
 * The template the chapter rides: `title` is its name, `claim` the brief
 * description, `evidence` the quotes that show it.
 */
export interface LightboxTemplateTile extends LightboxReadingTileBase {
  kind: 'template';
  freshness: LightboxFreshnessReading;
  /**
   * Exactly one mark per movement drawn in this group, in the movements'
   * order; empty when the movements were not read with it, were withheld,
   * or the engagement broke its rules (withheld by title, "Engagement").
   */
  engagement: LightboxEngagementMark[];
}

/** A beat where the chapter aligns with, subverts or departs from its template; `claim` says how. */
export interface LightboxTemplateBeatTile extends LightboxReadingTileBase {
  kind: 'template-beat';
  stance: LightboxTemplateStance;
}

/** A paragraph range, 1-based and inclusive. */
export interface LightboxParagraphSpan {
  from: number;
  to: number;
}

/**
 * A thread of pressure: `title` (and `claim`) is the question or event
 * that builds. Its quotes stand in paragraph order, planted first; the host
 * found each one. `paragraphs` is its span.
 */
export interface LightboxPressureThreadTile extends LightboxReadingTileBase {
  kind: 'pressure-thread';
  planted: LightboxVerifiedQuote;
  escalations: LightboxVerifiedQuote[];
  /** `null`: still open at the chapter's end, carried out of it. */
  resolution: LightboxVerifiedQuote | null;
  /** Read: planted and never touched again. The host checks it has no later quote. */
  dormant: boolean;
  /** The host's: the planted paragraph to the resolution's, or to the last paragraph while open. */
  span: LightboxParagraphSpan;
}

/** One state of an object, as read, with the quote that shows it. */
export interface LightboxArtifactStep {
  step: string;
  quote: LightboxVerifiedQuote;
}

/**
 * An object in the scene: `title` is its name, `claim` its arc in words.
 * `support` holds its named terms with the host's counts.
 */
export interface LightboxArtifactTile extends LightboxReadingTileBase {
  kind: 'artifact';
  /** Every occurrence of its terms, each once (the gravity lens's counter). */
  mentions: number;
  /** The first paragraph any of its terms stands in. */
  firstParagraph: number;
  /** Found steps, in paragraph order; a step whose quote failed or broke the order is withheld by its position. */
  arc: LightboxArtifactStep[];
  /**
   * The reading's "planted, unused", kept only when the host finds every
   * mention and every step within `LIGHTBOX_UNUSED_REACH` paragraphs of its
   * first. Otherwise false, with `unusedWithheld` saying why.
   */
  plantedUnused: boolean;
  /** Host words: why the reading's "planted, unused" was not kept. */
  unusedWithheld?: string;
}

/** The chapter in a few sentences: `claim` is the synopsis, standing on at least two found quotes. */
export interface LightboxSynopsisTile extends LightboxReadingTileBase {
  kind: 'synopsis';
}

/**
 * One movement of a set that tiles the chapter: `title` is its name, `claim`
 * its gist. `paragraphs` is its whole range.
 */
export interface LightboxMovementTile extends LightboxReadingTileBase {
  kind: 'movement';
  /** Its place in the set, from 1, in paragraph order. */
  ordinal: number;
  from: number;
  to: number;
  /** Found in ¶`from`; also the first entry of `evidence`. */
  boundary: LightboxVerifiedQuote;
}
