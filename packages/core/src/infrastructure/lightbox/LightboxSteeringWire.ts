/**
 * Group G's wire vocabulary: craft steering (ADR 2026-10-19 D7 second
 * addendum; Slice 4F). Pure. The shapes a `"steering"` block decodes into
 * (`LightboxSteeringCodec`), before any quote is checked or any example is
 * anchored (`LightboxSteeringTiles`). Everything here is still the model's
 * word except the host titles.
 */

import type { LightboxSteeringExample, LightboxSteeringStance, LightboxSteeringStatId } from '@messages';
import type { LightboxMalformedItem, LightboxWireQuote } from '@/infrastructure/lightbox/LightboxReadingWire';
import { lightboxMovementNumeral } from '@shared/constants/lightboxPlot';

export const LIGHTBOX_STEERING_STANCES: readonly LightboxSteeringStance[] = ['earns', 'leans', 'compensates'];

/** One instance note, decoded. Its text has passed the text rules; its quote and example are unchecked. */
export interface LightboxDecodedSteeringNote extends LightboxWireQuote {
  /** From 1, its place among its figure's notes as the reading gave them: its title's number. */
  ordinal: number;
  stance: LightboxSteeringStance;
  why: string;
  /** Leans or compensates only; absent there when the reading gave none, the shape for dialogue (epic decision 26). */
  nudge?: string;
  /** The one example as the reading gave it: `before` is still to be found in the checked quote. */
  example?: LightboxSteeringExample;
  /** Why the reading's example (or one past the first) is not shown, in host words. */
  exampleWithheld?: string;
}

export interface LightboxDecodedSteeringFigure {
  stat: LightboxSteeringStatId;
  /** The figure's reading, or, when its claim broke a text rule, why it is withheld (its notes still stand on their own). */
  reading: { claim: string; evidence: LightboxWireQuote[] } | { withheld: string };
  notes: LightboxDecodedSteeringNote[];
  /** Notes that broke their rules, by host title ("Being verbs · note 2"). */
  malformedNotes: LightboxMalformedItem[];
}

export interface LightboxDecodedSteeringBlock {
  lens: 'steering';
  figures: LightboxDecodedSteeringFigure[];
  /** Figures that broke their shape, by host label (or "Figure n" when no figure is named). */
  malformed: LightboxMalformedItem[];
  friction: string;
}

/**
 * A note's host title: its figure's label and its place, as a Roman numeral
 * ("Adverbs (-ly) · note II"). Never the reading's words, and no digit: a
 * title is shown to the Opinion, and a host's ordinal is no figure it may
 * state (PR #157 F-01).
 */
export function lightboxSteeringNoteTitle(label: string, ordinal: number): string {
  return `${label} · note ${lightboxMovementNumeral(ordinal)}`;
}
