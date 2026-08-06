/** Lexical Gravity feature contracts. */

import { MessageEnvelope, MessageType } from '../base';
export type WorkshopLexicalGravityReach = 1 | 2 | 3;

export interface WorkshopLexicalGravityWordBucket {
  nouns: string[];
  verbs: string[];
  modifiers: string[];
}

export interface WorkshopLexicalGravityCliche {
  worn: string;
  fresh: string;
}

export interface WorkshopLexicalGravitySubstitutions {
  plan: string;
  conflict: string;
  agreement: string;
  turning: string;
  ending: string;
}

export interface WorkshopLexicalGravityLensAxis {
  id: string;
  name: string;
  poles: [string, string];
}

export interface WorkshopLexicalGravityLensRole {
  id: string;
  name: string;
  description: string;
}

export interface WorkshopLexicalGravityLensDynamic {
  id: string;
  operation: string;
  movement: string;
  entailment: string;
  narrativeAffordance: string;
}

/** Reusable, passage-independent meaning grammar for one lens. */
export interface WorkshopLexicalGravityLensLogic {
  premise: string;
  attention: {
    foregrounds: string[];
    backgrounds: string[];
  };
  axes: WorkshopLexicalGravityLensAxis[];
  roles: WorkshopLexicalGravityLensRole[];
  dynamics: WorkshopLexicalGravityLensDynamic[];
  guardrails: string[];
}

/**
 * One complete, deterministic lexical field. Built-ins and project-authored
 * fields share this contract so choosing a generated take makes every panel
 * tab immediately available without another model call.
 */
export interface WorkshopLexicalGravityLens {
  version: 2;
  slug: string;
  name: string;
  source: 'built-in' | 'project';
  /** Writer-entered subject that produced a project lens. */
  originQuery?: string;
  /** Human-readable angle distinguishing multiple generated takes. */
  variant?: string;
  description?: string;
  /** Interpretive grammar applied before vocabulary is selected. */
  logic: WorkshopLexicalGravityLensLogic;
  degrees: {
    1: WorkshopLexicalGravityWordBucket;
    2: WorkshopLexicalGravityWordBucket;
    3: WorkshopLexicalGravityWordBucket;
  };
  gradient: string[];
  cliches: WorkshopLexicalGravityCliche[];
  substitutions: WorkshopLexicalGravitySubstitutions;
  metaphor: string;
  sample: string;
}

/** One passage fact positioned in reusable lens semantics for Preview. */
export interface WorkshopLexicalGravitySemanticPosition {
  element: string;
  roleId: string;
  axisId: string | null;
  axisPosition: string | null;
  significance: string;
}

export interface WorkshopLexicalGravityPreview {
  version: 2;
  /** Stable key of the four writer-facing values this preview demonstrates. */
  configKey: string;
  sourceText: string;
  /** Writer-facing declarative mappings, never hidden model reasoning. */
  semanticPositions: WorkshopLexicalGravitySemanticPosition[];
  /** Null records an honest semantic no-op. */
  selectedDynamicId: string | null;
  /** Passage-specific pressure left open by the selected dynamic, if any. */
  openEntailment: string | null;
  text: string;
}

/** Four authored controls plus the resolved lens and optional cached preview. */
export interface WorkshopLexicalGravityDraft {
  lensSlug: string;
  weight: number;
  reach: WorkshopLexicalGravityReach;
  metaphorPull: boolean;
  resolvedLens: WorkshopLexicalGravityLens;
  preview?: WorkshopLexicalGravityPreview;
}

export interface WorkshopLexicalGravityRecommendationSeed {
  lensSlug?: string;
  weight?: number;
  reach?: WorkshopLexicalGravityReach;
  metaphorPull?: boolean;
}

export interface WorkshopRequestLexicalGravityLensesMessage
  extends MessageEnvelope<Record<string, never>> {
  type: MessageType.WORKSHOP_REQUEST_LEXICAL_GRAVITY_LENSES;
}

export interface WorkshopLexicalGravityLensesDataPayload {
  lenses: WorkshopLexicalGravityLens[];
  incompatibleResources: WorkshopLexicalGravityLensIncompatibility[];
  storagePath?: string;
  error?: string;
}

export interface WorkshopLexicalGravityLensIncompatibility {
  resourceName: string;
  foundVersion: number | null;
  message: string;
}

export interface WorkshopLexicalGravityLensesDataMessage
  extends MessageEnvelope<WorkshopLexicalGravityLensesDataPayload> {
  type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_DATA;
}

export interface WorkshopPreviewLexicalGravityMessage
  extends MessageEnvelope<{
    token: string;
    draft: WorkshopLexicalGravityDraft;
    sourceText: string;
  }> {
  type: MessageType.WORKSHOP_PREVIEW_LEXICAL_GRAVITY;
}

export interface WorkshopLexicalGravityPreviewResultPayload {
  token: string;
  ok: boolean;
  preview?: WorkshopLexicalGravityPreview;
  error?: string;
}

export interface WorkshopLexicalGravityPreviewResultMessage
  extends MessageEnvelope<WorkshopLexicalGravityPreviewResultPayload> {
  type: MessageType.WORKSHOP_LEXICAL_GRAVITY_PREVIEW_RESULT;
}

export interface WorkshopBuildLexicalGravityLensMessage
  extends MessageEnvelope<{ token: string; query: string }> {
  type: MessageType.WORKSHOP_BUILD_LEXICAL_GRAVITY_LENS;
}

export interface WorkshopLexicalGravityLensCandidate {
  candidateId: string;
  lens: WorkshopLexicalGravityLens;
}

export interface WorkshopLexicalGravityLensCandidatesPayload {
  token: string;
  query: string;
  ok: boolean;
  /** Existing project lens returned without a model call for repeat lookups. */
  existingLens?: WorkshopLexicalGravityLens;
  candidates?: WorkshopLexicalGravityLensCandidate[];
  error?: string;
}

export interface WorkshopLexicalGravityLensCandidatesMessage
  extends MessageEnvelope<WorkshopLexicalGravityLensCandidatesPayload> {
  type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENS_CANDIDATES;
}

export interface WorkshopSaveLexicalGravityLensesMessage
  extends MessageEnvelope<{
    token: string;
    query: string;
    /** Candidate ids selected by the writer; candidate bodies remain host-owned. */
    candidateIds: string[];
  }> {
  type: MessageType.WORKSHOP_SAVE_LEXICAL_GRAVITY_LENSES;
}

export interface WorkshopLexicalGravityLensesSavedPayload {
  token: string;
  ok: boolean;
  lenses?: WorkshopLexicalGravityLens[];
  /** Candidate ids admitted by this save operation. */
  candidateIds: string[];
  /** Generated candidates still available to save without another model call. */
  remainingCandidateIds?: string[];
  storagePath?: string;
  error?: string;
}

export interface WorkshopLexicalGravityLensesSavedMessage
  extends MessageEnvelope<WorkshopLexicalGravityLensesSavedPayload> {
  type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_SAVED;
}

export interface WorkshopLexicalGravityApplyStandingWidgetPayload {
  requestToken: string;
  widgetId: 'lexical-gravity';
  draft: WorkshopLexicalGravityDraft;
  /** Present for edit-in-place; omitted for a first install. */
  widgetConfigId?: string;
}
