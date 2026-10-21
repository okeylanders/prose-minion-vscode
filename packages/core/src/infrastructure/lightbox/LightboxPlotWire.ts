/**
 * Group E's wire vocabulary (ADR 2026-10-19 D6, D7; Slice 4C): the closed
 * vocabularies, the protocol's own rules for the story lenses, and the
 * shapes their blocks decode into (unverified, still the model's word).
 * Beside `LightboxReadingWire`, which holds the frame and every other
 * group's shapes; split so each stays within its size. The ceilings are
 * `PROMPT_BUDGETS.lightbox`.
 */

import type {
  LightboxEngagementLevel,
  LightboxFreshnessLevel,
  LightboxTemplateStance
} from '@messages';
import type { LightboxMalformedItem, LightboxWireQuote } from '@/infrastructure/lightbox/LightboxReadingWire';

export const LIGHTBOX_TEMPLATE_STANCES: readonly LightboxTemplateStance[] = ['aligns', 'subverts', 'departs'];
export const LIGHTBOX_FRESHNESS_READINGS: readonly LightboxFreshnessLevel[] = ['familiar', 'mixed', 'fresh'];
export const LIGHTBOX_ENGAGEMENT_READINGS: readonly LightboxEngagementLevel[] = ['low', 'medium', 'high'];

/** A synopsis stands on at least this many found quotes. */
export const LIGHTBOX_SYNOPSIS_MINIMUM_QUOTES = 2;

/**
 * What a movement's id may be: a short key the response names it by, so
 * engagement can point at it ("I", "II", "m3"). Letters, digits and hyphens;
 * never shown, never kept: the host's own tile id replaces it.
 */
export const LIGHTBOX_MOVEMENT_ID = /^[A-Za-z0-9-]{1,12}$/;

/** How a movement's id is matched: case folded. */
export function lightboxMovementKey(id: string): string {
  return id.toLocaleLowerCase('en-US');
}

export interface LightboxDecodedTemplateBeat {
  stance: LightboxTemplateStance;
  note: string;
  evidence: LightboxWireQuote[];
}

export interface LightboxDecodedEngagement {
  /** A movement id as the response wrote it (case is folded when matched). */
  movement: string;
  level: LightboxEngagementLevel;
}

export interface LightboxDecodedTemplateBlock {
  lens: 'template';
  name: string;
  description: string;
  evidence: LightboxWireQuote[];
  beats: LightboxDecodedTemplateBeat[];
  freshness: { level: LightboxFreshnessLevel; note: string };
  /** Checked against the summary block's movements once both are assembled. */
  engagement: LightboxDecodedEngagement[];
  /** Host words: the engagement list broke the format, which withholds engagement alone. */
  engagementFault?: string;
  malformed: LightboxMalformedItem[];
  friction: string;
}

export interface LightboxDecodedThread {
  question: string;
  planted: LightboxWireQuote;
  escalations: LightboxWireQuote[];
  resolution: LightboxWireQuote | null;
  /** Already checked: a dormant thread gives no escalation and no resolution. */
  dormant: boolean;
}

export interface LightboxDecodedPressureBlock {
  lens: 'pressure';
  threads: LightboxDecodedThread[];
  malformed: LightboxMalformedItem[];
  friction: string;
}

export interface LightboxDecodedArtifactStep extends LightboxWireQuote {
  step: string;
}

export interface LightboxDecodedArtifact {
  name: string;
  /** As they stand in the chapter; the host counts them. */
  terms: string[];
  arc: LightboxDecodedArtifactStep[];
  plantedUnused: boolean;
}

export interface LightboxDecodedArtifactsBlock {
  lens: 'artifacts';
  objects: LightboxDecodedArtifact[];
  malformed: LightboxMalformedItem[];
  friction: string;
}

export interface LightboxDecodedMovement {
  /** The response's own key for it, unique in its block (case folded). */
  id: string;
  title: string;
  from: number;
  to: number;
  gist: string;
  boundary: LightboxWireQuote;
}

export interface LightboxDecodedSummaryBlock {
  lens: 'summary';
  synopsis: { text: string; evidence: LightboxWireQuote[] };
  /** Host words: the synopsis broke the format, which withholds the synopsis alone. */
  synopsisFault?: string;
  movements: LightboxDecodedMovement[];
  /** Movements that broke the format: any one withholds the set, since the rest no longer tile the chapter. */
  malformed: LightboxMalformedItem[];
  friction: string;
}

export type LightboxDecodedPlotBlock =
  | LightboxDecodedTemplateBlock
  | LightboxDecodedPressureBlock
  | LightboxDecodedArtifactsBlock
  | LightboxDecodedSummaryBlock;
