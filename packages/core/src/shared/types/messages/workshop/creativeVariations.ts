/** Creative Variations Explorer feature contracts. */

import type { CancelRequestPayload } from '../streaming';
import { MessageType, type MessageEnvelope } from '../base';
import type { WorkshopWidgetSourceReference } from './context';
import type { WorkshopPersonaId } from './participants';

export const CREATIVE_VARIATIONS_GENERATION_PROTOCOL_VERSION = 1 as const;
export const CREATIVE_VARIATIONS_OVERLAP_ALGORITHM_VERSION = 'textual-overlap-v2' as const;

export type WorkshopCreativeVariationsDistance =
  | 'familiar'
  | 'adjacent'
  | 'tail'
  | 'far-tail';

/** Display-safe intake/custody record for the exact subject the writer is varying. */
export type WorkshopCreativeVariationsSubjectProvenance =
  | { kind: 'pasted' }
  | {
      kind: 'persona-prefill';
      /** Canonical persona custody, preserved when the committed sheet reopens. */
      personaId: WorkshopPersonaId;
      /** One-way audit fact: the writer changed the persona-prepared text. */
      editedByWriter: boolean;
    }
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

/**
 * Input-only persona handoff. The persona may prepare deterministic scaffold,
 * but cannot claim provenance or supply generated/selected/committed state.
 * Empty optional prose fields preserve the writer's explicit no-constraint and
 * random-aim semantics.
 */
export interface WorkshopCreativeVariationsRecommendationSeed {
  subjectText?: string;
  contextText?: string;
  sourceReferences?: WorkshopWidgetSourceReference[];
  mustSurvive?: string;
  mustNotChange?: string;
  aim?: string;
  distance?: WorkshopCreativeVariationsDistance;
  requestedCount?: WorkshopCreativeVariationsRequestedCount;
}

/**
 * Exact one-shot commit arm. The authored Draft crosses unchanged so the host
 * can validate and persist the writer's truth (including a blank aim) before
 * the feature compiler projects the compact room artifact.
 */
export interface WorkshopCreativeVariationsCommitPayload {
  widgetId: 'creative-variations';
  /** Fresh webview-minted correlation token for this commit attempt. */
  requestToken: string;
  draft: WorkshopCreativeVariationsDraft;
  /** Present only when recommitting a historical config as a fresh turn. */
  clonedFromConfigId?: string;
}

/** Complete transient authoring input for one full-set generation attempt. */
export interface WorkshopCreativeVariationsGeneratePayload {
  widgetId: 'creative-variations';
  /** Webview-minted correlation token; never reused for a regenerate. */
  token: string;
  subject: WorkshopCreativeVariationsSubject;
  surroundingContext: WorkshopCreativeVariationsSurroundingContext;
  invariants: WorkshopCreativeVariationsInvariants;
  intent: WorkshopCreativeVariationsIntent;
  requestedCount: WorkshopCreativeVariationsRequestedCount;
}

export interface WorkshopCreativeVariationsGenerateMessage
  extends MessageEnvelope<WorkshopCreativeVariationsGeneratePayload> {
  type: MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATE;
}

export interface CancelCreativeVariationsGenerateRequestMessage
  extends MessageEnvelope<CancelRequestPayload> {
  type: MessageType.CANCEL_CREATIVE_VARIATIONS_GENERATE_REQUEST;
}

export interface WorkshopCreativeVariationsGenerationProgressPayload {
  widgetId: 'creative-variations';
  token: string;
  /** Host-minted for this attempt; cancelled and failed ids are never reused. */
  workupId: string;
  phase: 'started' | 'streaming' | 'completed' | 'cancelled';
  stage: 'requesting' | 'variations' | 'validating';
  outputCharacters: number;
  estimatedOutputTokens: number;
  completionTokens?: number;
  outputTokenLimit: number;
}

export interface WorkshopCreativeVariationsGenerationProgressMessage
  extends MessageEnvelope<WorkshopCreativeVariationsGenerationProgressPayload> {
  type: MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATION_PROGRESS;
}

interface WorkshopCreativeVariationsResultBasePayload {
  widgetId: 'creative-variations';
  token: string;
  workupId: string;
}

export type WorkshopCreativeVariationsResultPayload =
  | (WorkshopCreativeVariationsResultBasePayload & {
      ok: true;
      workup: WorkshopCreativeVariationsWorkup;
    })
  | (WorkshopCreativeVariationsResultBasePayload & {
      ok: false;
      error: string;
    });

export interface WorkshopCreativeVariationsResultMessage
  extends MessageEnvelope<WorkshopCreativeVariationsResultPayload> {
  type: MessageType.WORKSHOP_CREATIVE_VARIATIONS_RESULT;
}
