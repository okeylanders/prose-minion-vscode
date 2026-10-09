/**
 * Show vs. Tell Playground feature contracts (Sprint 05).
 *
 * Slice 1 declared the exact authoring draft and the generated workup it
 * stores. Slice 2 adds the generate, cancel, progress, and result messages.
 * Slice 4 adds the commit payload. Slice 5 adds the input-only persona
 * recommendation seed.
 */

import type { NarrativeHandlingPosition } from '@shared/constants/narrativeHandlingVocabulary';
import { MessageType, type MessageEnvelope } from '../base';
import type { CancelRequestPayload } from '../streaming';
import type { WorkshopWidgetSourceReference } from './context';
import type { WorkshopPersonaId } from './participants';

export const SHOW_VS_TELL_GENERATION_PROTOCOL_VERSION = 1 as const;

/**
 * Line keys of the committed `widget:show-vs-tell` artifact body. The host's
 * artifact projection and the 600-character fit guarantee share these, so the
 * counted grammar has one source. Each key is followed by one space and its
 * value; the body joins its lines with `\n`.
 */
export const SHOW_VS_TELL_ARTIFACT_LINE_KEYS = Object.freeze({
  beat: 'beat:',
  position: 'position:',
  mustSurvive: 'must survive:',
  mustNotChange: 'must not change:',
  keep: 'keep:',
  direction: 'direction:',
  note: 'note:'
} as const);

/** Display-safe intake/custody record for the beat (Sprint 03 provenance rules). */
export type WorkshopShowVsTellBeatProvenance =
  | { kind: 'pasted' }
  | {
      kind: 'persona-prefill';
      /** Canonical persona custody, preserved when the committed sheet reopens. */
      personaId: WorkshopPersonaId;
      /** One-way audit fact: the writer changed the persona-prepared beat. */
      editedByWriter: boolean;
    }
  | {
      kind: 'excerpt';
      relativePath: string;
      /** 1-based inclusive editor lines when the host supplied a range. */
      startLine?: number;
      endLine?: number;
    };

/** One beat, not a passage: a single line of at most 160 characters. */
export interface WorkshopShowVsTellBeat {
  text: string;
  provenance: WorkshopShowVsTellBeatProvenance;
}

export type WorkshopShowVsTellPovMode =
  | 'unspecified'
  | 'first'
  | 'close-third'
  | 'distant-third'
  | 'second'
  | 'omniscient';

/**
 * POV is a constraint on generation, not a channel. With `unspecified` the
 * prompt still forbids head-hopping but names no focal character, so the
 * focal character is blank for that mode.
 */
export interface WorkshopShowVsTellPov {
  mode: WorkshopShowVsTellPovMode;
  /** Optional single-line name; blank when none is declared. */
  focalCharacter: string;
}

export interface WorkshopShowVsTellInvariants {
  /** Required: the fact, emotion, or turn every variant has to carry. */
  mustSurvive: string;
  /** Optional hard boundary; blank declares no constraint. */
  mustNotChange: string;
}

export type WorkshopShowVsTellChannel =
  | 'observable-action'
  | 'sensory-evidence'
  | 'interiority'
  | 'dialogue-subtext'
  | 'summary-exposition';

export type WorkshopShowVsTellLengthBudget =
  | 'tighter'
  | 'same-length'
  | 'plus-one-sentence'
  | 'plus-one-paragraph';

/** The four fixed workup groups. Grouped by kind, never ranked. */
export type WorkshopShowVsTellGroupKind =
  | 'told-cleanly'
  | 'shown-as-evidence'
  | 'shown-from-inside'
  | 'mixed';

export type WorkshopShowVsTellInvariantField = 'must-survive' | 'must-not-change';

interface WorkshopShowVsTellInvariantFlagBase {
  /** Host-derived from the variant id and the one-based flag ordinal. */
  id: string;
  note: string;
}

/**
 * Model-declared, passive invariant warning. It never blocks keep or commit.
 * A `hard-conflict` is expressible only against must-not-change.
 */
export type WorkshopShowVsTellInvariantFlag =
  | (WorkshopShowVsTellInvariantFlagBase & {
      invariantField: 'must-survive';
      kind: 'advisory-risk';
    })
  | (WorkshopShowVsTellInvariantFlagBase & {
      invariantField: 'must-not-change';
      kind: 'advisory-risk' | 'hard-conflict';
    });

export interface WorkshopShowVsTellVariant {
  /** Host-derived from the workup id and the variant's one-based workup ordinal. */
  id: string;
  /** Proposed prose; may span lines for dialogue. */
  prose: string;
  /** One or two channels, in the order the variant uses them. */
  channels: WorkshopShowVsTellChannel[];
  /** Plain text; the UI supplies the bold label. */
  gains: string;
  /** Plain text; the UI supplies the bold label. */
  costs: string;
  /** Abstract, reusable instruction, strictly shorter than `prose`. */
  direction: string;
  invariantFlags: WorkshopShowVsTellInvariantFlag[];
}

export interface WorkshopShowVsTellWorkupGroup {
  kind: WorkshopShowVsTellGroupKind;
  /** One or two variants. */
  variants: WorkshopShowVsTellVariant[];
}

export interface WorkshopShowVsTellWorkup {
  /** Host-minted for one full generation attempt; never supplied by the model. */
  workupId: string;
  generationProtocolVersion: typeof SHOW_VS_TELL_GENERATION_PROTOCOL_VERSION;
  /** Exactly the four groups, always in their fixed order; four to eight variants. */
  groups: WorkshopShowVsTellWorkupGroup[];
}

/** A newly kept variant carries its direction until the writer promotes it to prose. */
export type WorkshopShowVsTellCarryMode = 'direction' | 'prose';

export interface WorkshopShowVsTellKeptVariant {
  variantId: string;
  carryMode: WorkshopShowVsTellCarryMode;
}

/**
 * Which room source grounds POV and meaning for generation. Only the
 * reference persists: the host resolves the passage text at generation time,
 * so the text never crosses from the webview, is never stored, and never
 * rides the commit.
 */
export interface WorkshopShowVsTellSurroundingContext {
  /** Zero or one reference; empty means no surrounding passage. */
  sourceReferences: WorkshopWidgetSourceReference[];
}

/**
 * Exact authoring truth, stored by config id so a chip reopens the whole
 * draft. The surrounding passage is read-only room context: its source
 * reference is part of the draft, its text is not. Focus, scroll, and the busy
 * state are presentation state.
 */
export interface WorkshopShowVsTellDraft {
  beat: WorkshopShowVsTellBeat;
  surroundingContext: WorkshopShowVsTellSurroundingContext;
  pov: WorkshopShowVsTellPov;
  invariants: WorkshopShowVsTellInvariants;
  /** At least one channel, in the fixed channel order. */
  channels: WorkshopShowVsTellChannel[];
  lengthBudget: WorkshopShowVsTellLengthBudget;
  /** Moving it re-weighs the readout and changes what commits; it keeps the workup. */
  position: NarrativeHandlingPosition;
  workup: WorkshopShowVsTellWorkup | null;
  /** Kept variants, in workup order; empty when no workup exists. */
  kept: WorkshopShowVsTellKeptVariant[];
  /** Optional single-line note to the room. */
  note: string;
}

/**
 * Input-only persona recommendation seed. It names a beat and the inputs a
 * persona may suggest; it cannot represent a workup, kept variants, a carry
 * mode, a note, or provenance. Opening it prefills the sheet and never
 * generates. Optional suggestions left absent open on the feature defaults.
 */
export interface WorkshopShowVsTellRecommendationSeed {
  /** Exact told beat copied from supplied material: one line, at most 160 characters. */
  beatText: string;
  /**
   * Persona-written chip label, at most 60 characters, single line. Shown on the
   * chip only: it never reaches generation, the draft, or a commit.
   */
  subject?: string;
  /** Zero or one reference; the passage text never travels with the seed. */
  sourceReferences: WorkshopWidgetSourceReference[];
  /** Required: generation has no meaning without a declared "same". */
  mustSurvive: string;
  mustNotChange?: string;
  /** Persona-suggested POV; with a focal character only for a declared mode. */
  pov?: WorkshopShowVsTellPov;
  position?: NarrativeHandlingPosition;
  channels?: WorkshopShowVsTellChannel[];
  lengthBudget?: WorkshopShowVsTellLengthBudget;
}

/**
 * Commit transports the authored draft unchanged. The host validates it, then
 * compiles the artifact itself, so the webview never supplies artifact text.
 */
export interface WorkshopShowVsTellCommitPayload {
  widgetId: 'show-vs-tell';
  /** Fresh webview-minted correlation token for this commit attempt. */
  requestToken: string;
  draft: WorkshopShowVsTellDraft;
  /** Present only when recommitting a historical config as a fresh turn. */
  clonedFromConfigId?: string;
}

/**
 * Complete transient authoring input for one workup generation attempt. The
 * surrounding passage crosses as a source reference only: the host resolves
 * its text at generation time. The position steers the variants, but moving
 * it afterwards never discards a workup, so it is not an invalidating input
 * (every other field here is).
 */
export interface WorkshopShowVsTellGeneratePayload {
  widgetId: 'show-vs-tell';
  /** Webview-minted correlation token; never reused for a regenerate. */
  token: string;
  beat: WorkshopShowVsTellBeat;
  surroundingContext: WorkshopShowVsTellSurroundingContext;
  pov: WorkshopShowVsTellPov;
  invariants: WorkshopShowVsTellInvariants;
  channels: WorkshopShowVsTellChannel[];
  lengthBudget: WorkshopShowVsTellLengthBudget;
  position: NarrativeHandlingPosition;
}

export interface WorkshopShowVsTellGenerateMessage
  extends MessageEnvelope<WorkshopShowVsTellGeneratePayload> {
  type: MessageType.WORKSHOP_SHOW_VS_TELL_GENERATE;
}

export interface CancelShowVsTellGenerateRequestMessage
  extends MessageEnvelope<CancelRequestPayload> {
  type: MessageType.CANCEL_SHOW_VS_TELL_GENERATE_REQUEST;
}

export interface WorkshopShowVsTellGenerationProgressPayload {
  widgetId: 'show-vs-tell';
  token: string;
  /** Host-minted for this attempt; cancelled and failed ids are never reused. */
  workupId: string;
  /** `completed` and `cancelled` are terminal: no later progress follows. */
  phase: 'started' | 'streaming' | 'completed' | 'cancelled';
  stage: 'requesting' | 'workup' | 'validating';
  outputCharacters: number;
  estimatedOutputTokens: number;
  completionTokens?: number;
  outputTokenLimit: number;
}

export interface WorkshopShowVsTellGenerationProgressMessage
  extends MessageEnvelope<WorkshopShowVsTellGenerationProgressPayload> {
  type: MessageType.WORKSHOP_SHOW_VS_TELL_GENERATION_PROGRESS;
}

interface WorkshopShowVsTellResultBasePayload {
  widgetId: 'show-vs-tell';
  token: string;
  workupId: string;
}

export type WorkshopShowVsTellResultPayload =
  | (WorkshopShowVsTellResultBasePayload & {
      ok: true;
      workup: WorkshopShowVsTellWorkup;
    })
  | (WorkshopShowVsTellResultBasePayload & {
      ok: false;
      error: string;
    });

export interface WorkshopShowVsTellResultMessage
  extends MessageEnvelope<WorkshopShowVsTellResultPayload> {
  type: MessageType.WORKSHOP_SHOW_VS_TELL_RESULT;
}
