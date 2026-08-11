/** Creative Variations Explorer feature contracts. */

import type { WorkshopWidgetSourceReference } from './context';

export const CREATIVE_VARIATIONS_GENERATION_PROTOCOL_VERSION = 1 as const;
export const CREATIVE_VARIATIONS_OVERLAP_ALGORITHM_VERSION = 'textual-overlap-v1' as const;

export type WorkshopCreativeVariationsDistance =
  | 'familiar'
  | 'adjacent'
  | 'tail'
  | 'far-tail';

/** Display-safe origin for the exact subject the writer is varying. */
export type WorkshopCreativeVariationsSubjectProvenance =
  | { kind: 'pasted' }
  | {
      kind: 'excerpt';
      relativePath: string;
      /** 1-based inclusive editor lines when the host supplied a range. */
      startLine?: number;
      endLine?: number;
    };

export interface WorkshopCreativeVariationsSubject {
  text: string;
  provenance: WorkshopCreativeVariationsSubjectProvenance;
}

export interface WorkshopCreativeVariationsSurroundingContext {
  writerText: string;
  sourceReferences: WorkshopWidgetSourceReference[];
}

export interface WorkshopCreativeVariationsInvariants {
  mustSurvive: string;
  mustNotChange: string;
}

export interface WorkshopCreativeVariationsIntent {
  kind: 'custom-aim';
  aim: string;
  distance: WorkshopCreativeVariationsDistance;
}

export type WorkshopCreativeVariationsRequestedCount = 3 | 4 | 5;
export type WorkshopCreativeVariationsInvariantField =
  | 'must-survive'
  | 'must-not-change';
export type WorkshopCreativeVariationsInvariantFlagKind =
  | 'advisory-risk'
  | 'hard-conflict';

export interface WorkshopCreativeVariationsInvariantFlag {
  /** Host-derived from workup id, card position, and one-based flag ordinal. */
  id: string;
  invariantField: WorkshopCreativeVariationsInvariantField;
  kind: WorkshopCreativeVariationsInvariantFlagKind;
  note: string;
}

export interface WorkshopCreativeVariationCard {
  /** Stable, one-based position in the settled workup. */
  position: number;
  approach: string;
  /** Compact portable instruction used by the default carry mode. */
  direction: string;
  prose: string;
  tradeoff: {
    gain: string;
    cost: string;
  };
  invariantFlags: WorkshopCreativeVariationsInvariantFlag[];
}

export interface WorkshopCreativeVariationsPairOverlap {
  leftPosition: number;
  rightPosition: number;
  prose: number;
  direction: number;
  /** Maximum of this pair's prose and direction percentages. */
  maximum: number;
}

export interface WorkshopCreativeVariationsMaximumOverlapPair {
  leftPosition: number;
  rightPosition: number;
  score: number;
}

export interface WorkshopCreativeVariationsWorkup {
  workupId: string;
  generationProtocolVersion: typeof CREATIVE_VARIATIONS_GENERATION_PROTOCOL_VERSION;
  cards: WorkshopCreativeVariationCard[];
  overlap: {
    algorithmVersion: typeof CREATIVE_VARIATIONS_OVERLAP_ALGORITHM_VERSION;
    /** Every unordered card pair, in canonical position order. */
    pairs: WorkshopCreativeVariationsPairOverlap[];
    /** The first pair at the set's maximum score, for deterministic ties. */
    maximumPair: WorkshopCreativeVariationsMaximumOverlapPair;
  };
}

export type WorkshopCreativeVariationsCarryMode = 'direction' | 'full-prose';

export interface WorkshopCreativeVariationsSelection {
  position: number;
  carryMode: WorkshopCreativeVariationsCarryMode;
  acceptedAdvisoryRiskIds: string[];
}

/**
 * Exact authoring truth. Generated cards persist for chip reopen, while focus,
 * scroll, comparison expansion, progress, and errors remain presentation state.
 */
export interface WorkshopCreativeVariationsDraft {
  subject: WorkshopCreativeVariationsSubject;
  surroundingContext: WorkshopCreativeVariationsSurroundingContext;
  invariants: WorkshopCreativeVariationsInvariants;
  intent: WorkshopCreativeVariationsIntent;
  requestedCount: WorkshopCreativeVariationsRequestedCount;
  workup: WorkshopCreativeVariationsWorkup | null;
  selections: WorkshopCreativeVariationsSelection[];
  note: string;
}
