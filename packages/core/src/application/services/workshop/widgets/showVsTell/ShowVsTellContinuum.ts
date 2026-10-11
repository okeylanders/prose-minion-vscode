/**
 * Show vs. Tell's feature-owned continuum, readout, and authoring vocabulary.
 *
 * Copy here was frozen at Slice 0 (Sprint 05, Locked decisions). Position ids
 * and their Controller lever come from the shared narrative-handling
 * vocabulary; names, subtitles, tradeoff lines, and the readout stay here
 * because this surface teaches the lever in its own words. Order is telling →
 * showing, never worse → better: nothing here scores, ranks, or recommends.
 */

import type {
  WorkshopShowVsTellCarryMode,
  WorkshopShowVsTellChannel,
  WorkshopShowVsTellGroupKind,
  WorkshopShowVsTellLengthBudget,
  WorkshopShowVsTellPovMode
} from '@messages';
import type { NarrativeHandlingPosition } from '@shared/constants/narrativeHandlingVocabulary';

/** Resolves to `true` only when `Listed` names every member of `Id`. */
type NamesEvery<Id extends string, Listed extends string> =
  [Exclude<Id, Listed>] extends [never] ? true : false;
/** Compile-time witness: an ordered list that omits an id fails `tsc`. */
type AssertTrue<Witness extends true> = Witness;

export interface ShowVsTellPositionDescriptor {
  readonly id: NarrativeHandlingPosition;
  readonly name: string;
  readonly subtitle: string;
  /** Generic shipped copy: it must read true for any beat. */
  readonly tradeoff: string;
}

/** The five steps, in the shared vocabulary's telling → showing order. */
export const SHOW_VS_TELL_POSITIONS = Object.freeze([
  {
    id: 'state-it',
    name: 'State it',
    subtitle: 'direct tell',
    tradeoff: 'Gets the fact across in the fewest words. Spends nothing, teaches nothing.'
  },
  {
    id: 'summarize',
    name: 'Summarize',
    subtitle: 'compressed narrative',
    tradeoff: 'Buys a stretch of time in a clause — right when the beat is a bridge to somewhere else.'
  },
  {
    id: 'hinge',
    name: 'Hinge',
    subtitle: 'tell the bridge, show the fulcrum',
    tradeoff: 'Tells the bridge, shows the moment that turns. Usually the working answer — so distrust it once.'
  },
  {
    id: 'evidence',
    name: 'Evidence',
    subtitle: 'observable action & sense',
    tradeoff: 'Nothing is claimed, so nothing can be argued with. The most ambiguous position, on purpose.'
  },
  {
    id: 'inhabit',
    name: 'Inhabit',
    subtitle: 'full scene time',
    tradeoff: 'The scene becomes the argument. Costs the most page of anything here.'
  }
] as const satisfies readonly ShowVsTellPositionDescriptor[]);

type PositionsNameEveryId = AssertTrue<
  NamesEvery<NarrativeHandlingPosition, typeof SHOW_VS_TELL_POSITIONS[number]['id']>
>;

/** End labels of the segmented continuum control. */
export const SHOW_VS_TELL_CONTINUUM_END_LABELS = Object.freeze({
  tell: 'compress / explain',
  show: 'dramatize / embody'
} as const);

/**
 * Versioned deterministic tradeoff readout. Changing any level, row, or label
 * requires a new version. Each bar has four segments in one accent colour; a
 * level is how many are filled. *Ambiguity* and *reader work* peak at
 * Evidence, not Inhabit: a deliberate craft claim, pinned by a test.
 */
export const SHOW_VS_TELL_READOUT_VERSION = 'show-vs-tell-readout-v1' as const;
export const SHOW_VS_TELL_READOUT_SEGMENTS = 4;
export const SHOW_VS_TELL_READOUT_CAPTION =
  'deterministic tradeoff readout · no model call · no bar is a score';

export type ShowVsTellReadoutLevel = 0 | 1 | 2 | 3 | 4;

export interface ShowVsTellReadoutDimension {
  readonly label: string;
  readonly levels: Readonly<Record<NarrativeHandlingPosition, ShowVsTellReadoutLevel>>;
}

/* eslint-disable @typescript-eslint/naming-convention -- position ids are persisted protocol literals. */
export const SHOW_VS_TELL_READOUT: readonly ShowVsTellReadoutDimension[] = Object.freeze([
  { label: 'reader speed', levels: { 'state-it': 4, summarize: 4, hinge: 3, evidence: 2, inhabit: 1 } },
  { label: 'fact clarity', levels: { 'state-it': 4, summarize: 4, hinge: 3, evidence: 2, inhabit: 2 } },
  { label: 'intimacy', levels: { 'state-it': 1, summarize: 1, hinge: 2, evidence: 3, inhabit: 4 } },
  { label: 'page emphasis', levels: { 'state-it': 1, summarize: 2, hinge: 3, evidence: 3, inhabit: 4 } },
  { label: 'ambiguity', levels: { 'state-it': 0, summarize: 1, hinge: 2, evidence: 4, inhabit: 3 } },
  { label: 'scene time', levels: { 'state-it': 0, summarize: 1, hinge: 2, evidence: 3, inhabit: 4 } },
  { label: 'reader work', levels: { 'state-it': 0, summarize: 1, hinge: 3, evidence: 4, inhabit: 3 } }
]);
/* eslint-enable @typescript-eslint/naming-convention */

export interface ShowVsTellGroupDescriptor {
  readonly kind: WorkshopShowVsTellGroupKind;
  readonly header: string;
  readonly subLabel: string;
}

/** The workup's four groups, always present and always rendered in this order. */
export const SHOW_VS_TELL_GROUPS = Object.freeze([
  { kind: 'told-cleanly', header: 'Told, cleanly', subLabel: 'compress / explain' },
  { kind: 'shown-as-evidence', header: 'Shown as evidence', subLabel: 'observable action & sense' },
  {
    kind: 'shown-from-inside',
    header: 'Shown from inside',
    subLabel: "POV-legal — the POV character's read, not another's mind"
  },
  { kind: 'mixed', header: 'Mixed — tell the bridge, show the fulcrum', subLabel: 'the hinge' }
] as const satisfies readonly ShowVsTellGroupDescriptor[]);

type GroupsNameEveryKind = AssertTrue<
  NamesEvery<WorkshopShowVsTellGroupKind, typeof SHOW_VS_TELL_GROUPS[number]['kind']>
>;

export interface ShowVsTellOptionDescriptor<Id extends string> {
  readonly id: Id;
  readonly label: string;
}

/** Channels to emphasize, in their fixed display and persistence order. */
export const SHOW_VS_TELL_CHANNELS = Object.freeze([
  { id: 'observable-action', label: 'observable action' },
  { id: 'sensory-evidence', label: 'sensory evidence' },
  { id: 'interiority', label: 'interiority' },
  { id: 'dialogue-subtext', label: 'dialogue / subtext' },
  { id: 'summary-exposition', label: 'summary / exposition' }
] as const satisfies readonly ShowVsTellOptionDescriptor<WorkshopShowVsTellChannel>[]);

type ChannelsNameEveryId = AssertTrue<
  NamesEvery<WorkshopShowVsTellChannel, typeof SHOW_VS_TELL_CHANNELS[number]['id']>
>;

export const SHOW_VS_TELL_LENGTH_BUDGETS = Object.freeze([
  { id: 'tighter', label: 'tighter' },
  { id: 'same-length', label: 'same length' },
  { id: 'plus-one-sentence', label: '+1 sentence' },
  { id: 'plus-one-paragraph', label: '+1 paragraph' }
] as const satisfies readonly ShowVsTellOptionDescriptor<WorkshopShowVsTellLengthBudget>[]);

type LengthBudgetsNameEveryId = AssertTrue<
  NamesEvery<WorkshopShowVsTellLengthBudget, typeof SHOW_VS_TELL_LENGTH_BUDGETS[number]['id']>
>;

export const SHOW_VS_TELL_POV_MODES = Object.freeze([
  { id: 'unspecified', label: 'unspecified' },
  { id: 'first', label: 'first' },
  { id: 'close-third', label: 'close third' },
  { id: 'distant-third', label: 'distant third' },
  { id: 'second', label: 'second' },
  { id: 'omniscient', label: 'omniscient' }
] as const satisfies readonly ShowVsTellOptionDescriptor<WorkshopShowVsTellPovMode>[]);

type PovModesNameEveryId = AssertTrue<
  NamesEvery<WorkshopShowVsTellPovMode, typeof SHOW_VS_TELL_POV_MODES[number]['id']>
>;

export interface ShowVsTellDefaults {
  readonly position: NarrativeHandlingPosition;
  readonly channels: readonly WorkshopShowVsTellChannel[];
  readonly lengthBudget: WorkshopShowVsTellLengthBudget;
  readonly pov: Readonly<{ mode: WorkshopShowVsTellPovMode; focalCharacter: string }>;
  /** A newly kept variant carries direction only; prose is a per-variant promotion. */
  readonly carryMode: WorkshopShowVsTellCarryMode;
}

export const SHOW_VS_TELL_DEFAULTS: ShowVsTellDefaults = Object.freeze({
  position: 'hinge',
  channels: Object.freeze(['observable-action', 'sensory-evidence'] as const),
  lengthBudget: 'same-length',
  pov: Object.freeze({ mode: 'unspecified', focalCharacter: '' } as const),
  carryMode: 'direction'
});
